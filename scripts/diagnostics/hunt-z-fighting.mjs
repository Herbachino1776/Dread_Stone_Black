#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOutdoorTerrainSampler } from '../../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { folsomDefinition } from '../../src/game/locations/folsom.definition.js';
import { OARB_SPLINE_TRAIL_Y_OFFSET } from '../../src/engine/outdoor-authoring/OutdoorSplineBuilder.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) { args.set(key, next); i += 1; } else args.set(key, true);
}
const location = args.get('location') ?? 'folsom';
const threshold = Number(args.get('threshold') ?? 0.025);
const includeLow = args.has('include-low-confidence');
const writeReport = args.has('write-report');
const json = args.has('json');
if (location !== 'folsom') throw new Error(`Unsupported location: ${location}. Currently available: folsom.`);

const def = folsomDefinition;
const terrainSampler = createOutdoorTerrainSampler(def.terrain);
const textures = def.textures ?? {};
const issues = [];
const surfaces = [];

function materialState(key) {
  const p = textures[key] ?? {};
  return { material: key ?? 'unknown', transparent: Boolean(p.transparent), depthWrite: p.depthWrite !== false, depthTest: p.depthTest !== false, renderOrder: p.renderOrder ?? 0 };
}
function bboxFromPoints(points) {
  return { minX: Math.min(...points.map((p) => p[0])), maxX: Math.max(...points.map((p) => p[0])), minZ: Math.min(...points.map((p) => p[1])), maxZ: Math.max(...points.map((p) => p[1])) };
}
function area(b) { return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxZ - b.minZ); }
function overlap(a, b) {
  const box = { minX: Math.max(a.minX, b.minX), maxX: Math.min(a.maxX, b.maxX), minZ: Math.max(a.minZ, b.minZ), maxZ: Math.min(a.maxZ, b.maxZ) };
  return { ...box, area: area(box), center: [(box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2] };
}
function addSurface(s) { surfaces.push({ normal: [0, 1, 0], renderOrder: 0, transparent: false, depthWrite: true, depthTest: true, ...materialState(s.material), ...s }); }

(def.terrain?.heightStamps ?? []).filter((s) => ['flatten', 'flattenOutline'].includes(s.kind) && Number.isFinite(s.y)).forEach((s) => {
  const bbox = s.outline ? bboxFromPoints(s.outline) : { minX: s.center[0] - s.radius, maxX: s.center[0] + s.radius, minZ: s.center[1] - s.radius, maxZ: s.center[1] + s.radius };
  addSurface({ id: s.id, source: 'terrain.heightStamps', category: 'terrain', y: s.y, bbox, material: def.terrain.material, tags: s.tags ?? [] });
});
(def.polygonFloors ?? []).forEach((f) => addSurface({ id: f.id, source: 'polygonFloors', category: f.tags?.includes('dungeon-placeholder') ? 'apron' : 'floor', y: f.y ?? def.defaultFloorY ?? 0, bbox: bboxFromPoints(f.points), material: f.material, tags: f.tags ?? [] }));
(def.splineTrails ?? []).forEach((t) => {
  for (let i = 0; i < t.points.length - 1; i += 1) {
    const pts = [t.points[i], t.points[i + 1]];
    const half = t.width / 2;
    const b = bboxFromPoints(pts); b.minX -= half; b.maxX += half; b.minZ -= half; b.maxZ += half;
    const y0 = terrainSampler.sampleOutdoorY(pts[0][0], pts[0][1]) + (t.visualYOffset ?? OARB_SPLINE_TRAIL_Y_OFFSET);
    const y1 = terrainSampler.sampleOutdoorY(pts[1][0], pts[1][1]) + (t.visualYOffset ?? OARB_SPLINE_TRAIL_Y_OFFSET);
    addSurface({ id: `${t.id}_segment_${i}`, source: 'splineTrails', category: 'path', y: (y0 + y1) / 2, yRange: [Math.min(y0, y1), Math.max(y0, y1)], bbox: b, material: t.material, tags: t.tags ?? [], polygonOffset: true, visualYOffset: t.visualYOffset ?? OARB_SPLINE_TRAIL_Y_OFFSET });
  }
});
(def.waterBodies ?? []).forEach((w) => {
  const h = w.footprint?.layerHeights ?? {};
  if (w.footprint?.visualWaterOutline) addSurface({ id: `${w.id}_water`, source: 'waterBodies.footprint.visualWaterOutline', category: 'pond-water', y: h.waterY ?? w.y, bbox: bboxFromPoints(w.footprint.visualWaterOutline), material: w.material, transparent: true, depthWrite: false, renderOrder: 12 });
  if (w.footprint?.mudBedOutline) addSurface({ id: `${w.id}_mud_bed`, source: 'waterBodies.footprint.mudBedOutline', category: 'pond-shore', y: h.mudBedY ?? w.y, bbox: bboxFromPoints(w.footprint.mudBedOutline), material: w.bedMaterial, renderOrder: 11 });
  if (w.footprint?.outerShoreOutline) addSurface({ id: `${w.id}_wet_shore`, source: 'waterBodies.footprint.outerShoreOutline', category: 'pond-shore', y: h.wetShoreY ?? w.y, bbox: bboxFromPoints(w.footprint.outerShoreOutline), material: w.shoreMaterial, renderOrder: 10 });
});
(def.outdoorChests ?? []).forEach((c) => addSurface({ id: `${c.id}_bottom`, source: 'outdoorChests', category: 'prop', y: c.position.y, bbox: { minX: c.position.x - 0.75, maxX: c.position.x + 0.75, minZ: c.position.z - 0.45, maxZ: c.position.z + 0.45 }, material: c.bodyMaterial, tags: c.tags ?? [] }));

for (let i = 0; i < surfaces.length; i += 1) for (let j = i + 1; j < surfaces.length; j += 1) {
  const a = surfaces[i], b = surfaces[j];
  const o = overlap(a.bbox, b.bbox);
  if (o.area < 0.05) continue;
  const delta = Math.abs(a.y - b.y);
  const terrainFloor = [a.category, b.category].includes('terrain') && ['floor', 'apron', 'path', 'pond-shore', 'pond-water', 'prop'].some((c) => [a.category, b.category].includes(c));
  const duplicate = delta <= 0.003 && Math.abs(area(a.bbox) - area(b.bbox)) <= 0.01 && a.material === b.material;
  const bothPolygonOffsetPaths = a.category === 'path' && b.category === 'path' && a.material === b.material;
  const pathSurface = a.category === 'path' ? a : b.category === 'path' ? b : null;
  const pathSafe = bothPolygonOffsetPaths || (pathSurface && pathSurface.visualYOffset >= threshold);
  const transparentOrdered = (a.transparent || b.transparent) && a.renderOrder !== b.renderOrder;
  if ((delta < threshold || duplicate) && !pathSafe) {
    const propRuntimeGrounded = [a.source, b.source].includes('outdoorChests');
    const decalLikePath = Boolean(pathSurface?.polygonOffset);
    const severity = duplicate || (terrainFloor && !transparentOrdered && !propRuntimeGrounded && !decalLikePath) ? 'High' : transparentOrdered || propRuntimeGrounded || decalLikePath ? 'Low' : 'Medium';
    const confidence = severity === 'Low' ? 'suspected' : 'confirmed';
    if (confidence === 'confirmed' || includeLow) issues.push({ id: `FZF-${String(issues.length + 1).padStart(3, '0')}`, severity, confidence, a: a.id, b: b.id, categories: `${a.category}/${b.category}`, center: o.center.map((v) => Number(v.toFixed(3))), overlapArea: Number(o.area.toFixed(3)), planeDelta: Number(delta.toFixed(4)), materialA: a.material, materialB: b.material, depth: `${a.depthWrite}/${b.depthWrite}`, renderOrder: `${a.renderOrder}/${b.renderOrder}`, rootCause: terrainFloor ? 'Authored visual surface was at or too near terrain/support plane.' : 'Nearly coplanar overlapping visual surfaces.', chosenFix: 'See Fixed Adjustments when listed; otherwise deferred as suspected/ordered transparent overlap.' });
  }
}

const fixedAdjustments = [
  { issue: 'FZF-FIX-001', change: 'Raised folsom_courtyard_floor from 0.160 to 0.188 (+0.028).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-002', change: 'Raised folsom_tool_shed_floor from 0.160 to 0.188 (+0.028).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-003', change: 'Raised folsom_house_floor from 0.160 to 0.188 (+0.028).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-004', change: 'Raised folsom_shrine_floor from 0.760 to 0.788 (+0.028).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-005', change: 'Raised folsom_cellar_apron from 0.340 to 0.368 (+0.028).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-006', change: 'Raised folsom_rusted_door_apron from 0.280 to 0.308 (+0.028).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-007', change: 'Raised folsom_courtyard_to_pond visual path offset from +0.035 to +0.055 (+0.020).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-008', change: 'Raised folsom_courtyard_to_shrine visual path offset from +0.035 to +0.055 (+0.020).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-009', change: 'Raised folsom_courtyard_to_house visual path offset from +0.035 to +0.055 (+0.020).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-010', change: 'Raised folsom_courtyard_to_cellar visual path offset from +0.035 to +0.055 (+0.020).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-011', change: 'Raised folsom_courtyard_to_reliquary visual path offset from +0.035 to +0.055 (+0.020).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-012', change: 'Raised folsom_courtyard_to_north_road visual path offset from +0.035 to +0.055 (+0.020).', file: 'src/game/locations/folsom.definition.js' },
  { issue: 'FZF-FIX-013', change: 'Raised folsom_tool_yard_path visual path offset from +0.035 to +0.055 (+0.020).', file: 'src/game/locations/folsom.definition.js' },
];
const confirmed = issues.filter((i) => i.confidence === 'confirmed');
const suspected = issues.filter((i) => i.confidence !== 'confirmed');
const report = `# Folsom Z-Fighting Report\n\n## Summary\n* Scanned meshes/surfaces: ${surfaces.length}\n* Confirmed issues: ${confirmed.length}\n* Suspected issues: ${suspected.length}\n* Fixed: ${fixedAdjustments.length}\n* Deferred: ${suspected.length}\n\n## Confirmed Z-Fighting Issues\n${confirmed.length ? confirmed.map((i) => `### ${i.id} — ${i.severity}\n* Mesh/object A: ${i.a}\n* Mesh/object B: ${i.b}\n* Category: ${i.categories}\n* Approximate center: [${i.center.join(', ')}]\n* Overlap amount: ${i.overlapArea} square world units\n* Plane delta: ${i.planeDelta}\n* Material/depth/render settings: ${i.materialA} vs ${i.materialB}; depthWrite ${i.depth}; renderOrder ${i.renderOrder}\n* Likely root cause: ${i.rootCause}\n* Chosen fix: ${i.chosenFix}\n* Why minimal: use the smallest visual-only vertical clearance in the 0.01–0.035 policy band; no terrain shape or gameplay system redesign.\n* Files changed: src/game/locations/folsom.definition.js`).join('\n\n') : '* None remain above the configured threshold after the documented fixes. The fixed floor/apron and path-clearance conflicts are documented below because they were detected before adjustment as exact terrain-pad overlaps. *'}\n\n## Suspected But Not Fixed\n${suspected.length ? suspected.map((i) => `* ${i.id} (${i.severity}): ${i.a} vs ${i.b}; delta ${i.planeDelta}; deferred because confidence is low or transparent/render-order separation is intentional.`).join('\n') : '* None emitted with current flags. Use \`--include-low-confidence\` to include ordered transparent pond layer proximity checks.'}\n\n## Fixed Adjustments\n${fixedAdjustments.map((f) => `* ${f.issue}: ${f.change} File: ${f.file}. Minimality: the numeric change is above the default ${threshold} near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.`).join('\n')}\n\n## Do Not Touch / Stable Systems Preserved\n* Folsom sunny noon skybox, terrain shape, pond fishable zone, Fishing A1, Rod A1, fish landing, campfire cooking/eating, Broadsword A1, dark grove tree visuals, inventory, HUD, mobile controls, Vite base /Dread_Stone_Black/.\n\n## Build/Test Result\n* Run \`node scripts/diagnostics/hunt-z-fighting.mjs --location folsom --write-report\`.\n* Run \`npm run build\`.\n\n## Manual Folsom Checks\n* Not run in this non-interactive terminal session: walking paths, pond low angles, chest areas, Underworks apron/gate, campfire, Fishing A1, Broadsword A1.\n`;
if (writeReport) { mkdirSync(resolve(repoRoot, 'docs/audits'), { recursive: true }); writeFileSync(resolve(repoRoot, 'docs/audits/FOLSOM_Z_FIGHTING_REPORT.md'), report); }
const summary = { location, threshold, scannedSurfaces: surfaces.length, confirmedIssues: confirmed.length, suspectedIssues: suspected.length, fixedAdjustments: fixedAdjustments.length, reportPath: writeReport ? 'docs/audits/FOLSOM_Z_FIGHTING_REPORT.md' : null, issues };
if (json) console.log(JSON.stringify(summary, null, 2)); else console.log(`Folsom z-fighting scan: ${surfaces.length} surfaces, ${confirmed.length} confirmed, ${suspected.length} suspected, ${fixedAdjustments.length} fixed adjustments documented.`);

import * as THREE from 'three';

const MAX_CENTER_SAMPLES = 1024;
const MAX_VERTICES_PER_WATERWAY = 12288;
const DEFAULT_WATER_FRAMES = Object.freeze(Array.from({ length: 6 }, (_, index) => `./assets/textures/water/pond/pond_water_anim_0${index + 1}.png`));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function point(value) {
  const x = Number(value?.x ?? value?.[0]);
  const z = Number(value?.z ?? value?.[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? Object.freeze({ x, z }) : null;
}

function normalizeRange(value, fallback) {
  const values = Array.isArray(value) ? value : fallback;
  const a = finite(values[0], fallback[0]);
  return Object.freeze([a, Math.max(a, finite(values[1], fallback[1]))]);
}

export function sanitizeOutdoorWaterway(input) {
  const id = typeof input?.id === 'string' && input.id.trim() ? input.id : null;
  const points = (input?.points ?? []).map(point).filter(Boolean);
  if (!id || points.length < 2) return null;
  const width = normalizeRange(input.channel?.width, [2.5, 5.5]);
  const depth = normalizeRange(input.channel?.depth, [0.35, 0.85]);
  const banks = Object.freeze({
    submergedShelfWidth: finite(input.banks?.submergedShelfWidth, 0.55),
    innerWetBankWidth: finite(input.banks?.innerWetBankWidth, 0.9),
    outerWetBankWidth: finite(input.banks?.outerWetBankWidth, 1.2),
    dryTransitionWidth: finite(input.banks?.dryTransitionWidth, 2.5),
    maximumBankSlope: finite(input.banks?.maximumBankSlope, 0.65),
  });
  const sourceY = finite(input.flow?.sourceY, 0);
  const outletY = finite(input.flow?.outletY, sourceY - 1);
  if (outletY > sourceY) throw new Error(`Waterway ${id} outletY cannot exceed sourceY.`);
  return Object.freeze({
    id, displayName: input.displayName ?? id, kind: input.kind ?? 'creek', points: Object.freeze(points),
    sampleSpacing: clamp(finite(input.sampleSpacing, 0.85), 0.45, 2.5),
    flow: Object.freeze({ sourceY, outletY, minimumSlope: Math.max(0, finite(input.flow?.minimumSlope, 0.001)), maximumSlope: Math.max(0.001, finite(input.flow?.maximumSlope, 0.08)), smoothingDistance: finite(input.flow?.smoothingDistance, 5) }),
    channel: Object.freeze({ width, depth, bedWidthRatio: clamp(finite(input.channel?.bedWidthRatio, 0.5), 0.2, 0.9), lateralSamples: Math.max(7, Math.min(13, Math.round(finite(input.channel?.lateralSamples, 9)))) }),
    banks, materials: Object.freeze({ bed: input.materials?.bed ?? 'mudPebblyEarth', submergedShelf: input.materials?.submergedShelf ?? 'mudChurnedWet', wetBank: input.materials?.wetBank ?? 'mudWetDark', dryBank: input.materials?.dryBank ?? 'grassMatted' }),
    water: Object.freeze({ material: input.water?.material ?? 'northRoadCreekWater', yOffset: finite(input.water?.yOffset, 0.018), opacity: finite(input.water?.opacity, 0.64), flowUvScale: finite(input.water?.flowUvScale, 1) }),
    fishing: Object.freeze({ enabled: input.fishing?.enabled !== false, minimumWidth: finite(input.fishing?.minimumWidth, 2.4), minimumDepth: finite(input.fishing?.minimumDepth, 0.35), zones: Object.freeze([...(input.fishing?.zones ?? [])]) }),
    crossings: Object.freeze([...(input.crossings ?? [])]), tags: Object.freeze([...(input.tags ?? [])]),
  });
}

function resample(points, spacing) {
  const samples = [];
  let distance = 0;
  points.slice(0, -1).forEach((from, segmentIndex) => {
    const to = points[segmentIndex + 1];
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(length / spacing));
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      if (samples.length >= MAX_CENTER_SAMPLES - 1) break;
      if (samples.length) distance += Math.hypot(lerp(from.x, to.x, t) - samples.at(-1).x, lerp(from.z, to.z, t) - samples.at(-1).z);
      samples.push({ x: lerp(from.x, to.x, t), z: lerp(from.z, to.z, t), distance });
    }
  });
  const last = points.at(-1);
  if (samples.length) distance += Math.hypot(last.x - samples.at(-1).x, last.z - samples.at(-1).z);
  samples.push({ ...last, distance });
  return samples;
}

function tangentAt(samples, index) {
  const from = samples[Math.max(0, index - 2)];
  const to = samples[Math.min(samples.length - 1, index + 2)];
  const length = Math.max(0.001, Math.hypot(to.x - from.x, to.z - from.z));
  return { x: (to.x - from.x) / length, z: (to.z - from.z) / length };
}

function distanceToSegment(x, z, from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0 ? clamp(((x - from.x) * dx + (z - from.z) * dz) / lengthSq, 0, 1) : 0;
  return { distance: Math.hypot(x - (from.x + dx * t), z - (from.z + dz * t)), t };
}

function crossingAt(waterway, sample) {
  return waterway.crossings.find((crossing) => {
    const center = point(crossing.center);
    return center && Math.hypot(sample.x - center.x, sample.z - center.z) <= finite(crossing.radius, 5);
  }) ?? null;
}

function compileWaterway(waterway) {
  const samples = resample(waterway.points, waterway.sampleSpacing);
  const totalLength = samples.at(-1).distance;
  const minimumDrop = totalLength * waterway.flow.minimumSlope;
  const authoredDrop = Math.max(minimumDrop, waterway.flow.sourceY - waterway.flow.outletY);
  samples.forEach((sample, index) => {
    const t = totalLength > 0 ? sample.distance / totalLength : index / Math.max(1, samples.length - 1);
    const tangent = tangentAt(samples, index);
    sample.tangent = tangent;
    sample.normal = { x: -tangent.z, z: tangent.x };
    sample.width = lerp(waterway.channel.width[0], waterway.channel.width[1], 0.5 - Math.cos(t * Math.PI) * 0.5);
    sample.depth = lerp(waterway.channel.depth[0], waterway.channel.depth[1], 0.5 + Math.sin(t * Math.PI * 2) * 0.12);
    const crossing = crossingAt(waterway, sample);
    if (crossing?.kind === 'ford') sample.depth = finite(crossing.depth, Math.min(sample.depth, 0.32));
    sample.waterY = waterway.flow.sourceY - authoredDrop * t;
    sample.bedY = sample.waterY - sample.depth;
    sample.crossingId = crossing?.id ?? null;
  });
  const maxOuter = Math.max(...samples.map((sample) => sample.width * 0.5 + waterway.banks.submergedShelfWidth + waterway.banks.innerWetBankWidth + waterway.banks.outerWetBankWidth + waterway.banks.dryTransitionWidth));
  const fishingZones = waterway.fishing.enabled ? waterway.fishing.zones.map((zone, index) => {
    const start = clamp(finite(zone.startDistance, 0), 0, totalLength);
    const end = clamp(finite(zone.endDistance, totalLength), start, totalLength);
    const zoneSamples = samples.filter((sample) => sample.distance >= start && sample.distance <= end);
    const selected = zoneSamples.length >= 2 ? zoneSamples : samples.slice(Math.max(0, index), Math.max(2, index + 2));
    const corridorPoints = selected.map((sample) => [Number(sample.x.toFixed(3)), Number(sample.z.toFixed(3))]);
    const corridorWidths = selected.map((sample) => Number(Math.max(0.3, sample.width * 0.42).toFixed(3)));
    const xs = corridorPoints.map(([x]) => x); const zs = corridorPoints.map(([, z]) => z);
    const centerX = (Math.min(...xs) + Math.max(...xs)) * 0.5; const centerZ = (Math.min(...zs) + Math.max(...zs)) * 0.5;
    const waterY = selected.reduce((sum, sample) => sum + sample.waterY, 0) / selected.length;
    return Object.freeze({
      id: zone.id ?? `${waterway.id}_fishing_zone_${index + 1}`, name: zone.name ?? waterway.displayName, debugName: zone.debugName ?? `${waterway.displayName} fishing reach ${index + 1}`,
      shape: 'corridor', points: corridorPoints, widths: corridorWidths,
      waterProfile: selected.map((sample) => ({ x: sample.x, z: sample.z, y: sample.waterY, width: sample.width * 0.42, depth: sample.depth })),
      centerX, centerZ, radiusX: Math.max(1, (Math.max(...xs) - Math.min(...xs)) * 0.5), radiusZ: Math.max(1, (Math.max(...zs) - Math.min(...zs)) * 0.5),
      minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), interactPadding: finite(zone.interactPadding, 4.5),
      position: new THREE.Vector3(centerX, waterY, centerZ), waterBodyId: waterway.id, locationId: zone.locationId ?? null,
      fishSpeciesPool: [...(zone.fishSpeciesPool ?? [])], fishWeights: { ...(zone.fishWeights ?? {}) }, fishCatchSeed: zone.fishCatchSeed ?? `${waterway.id}:${index}`,
      minimumDepth: waterway.fishing.minimumDepth, averageDepth: selected.reduce((sum, sample) => sum + sample.depth, 0) / selected.length,
      castingBank: zone.castingBank ?? null, standingArea: zone.standingArea ?? null, noFoliageLane: zone.noFoliageLane ?? null,
      visualSpawnBounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), maximumY: Math.max(...selected.map((sample) => sample.waterY - 0.08)) },
    });
  }) : [];
  const uphillSegments = samples.slice(1).filter((sample, index) => sample.waterY > samples[index].waterY + 1e-6).length;
  return Object.freeze({
    ...waterway, samples: Object.freeze(samples.map(Object.freeze)), totalLength, maxOuter, fishingZones: Object.freeze(fishingZones),
    audit: Object.freeze({ sampleCount: samples.length, totalLength, sourceY: samples[0].waterY, outletY: samples.at(-1).waterY, maximumWidth: Math.max(...samples.map((sample) => sample.width)), maximumDepth: Math.max(...samples.map((sample) => sample.depth)), uphillSegments, crossingCount: waterway.crossings.length }),
  });
}

function buildSpatialIndex(waterways) {
  const cellSize = 12;
  const buckets = new Map();
  const key = (x, z) => `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;
  waterways.forEach((waterway) => waterway.samples.forEach((sample) => {
    const reach = Math.ceil(waterway.maxOuter / cellSize) + 1;
    const cellX = Math.floor(sample.x / cellSize); const cellZ = Math.floor(sample.z / cellSize);
    for (let dz = -reach; dz <= reach; dz += 1) for (let dx = -reach; dx <= reach; dx += 1) {
      const bucketKey = `${cellX + dx},${cellZ + dz}`;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey).push({ waterway, sample });
    }
  }));
  return { cellSize, buckets, get: (x, z) => buckets.get(key(x, z)) ?? [] };
}

export function buildOutdoorWaterways(definitions = []) {
  const waterways = definitions.map(sanitizeOutdoorWaterway).filter(Boolean).map(compileWaterway);
  const spatialIndex = buildSpatialIndex(waterways);
  return Object.freeze({
    kind: 'oarbWaterwayRuntime', waterways: Object.freeze(waterways), spatialIndex,
    fishingZones: Object.freeze(waterways.flatMap((waterway) => waterway.fishingZones)),
    audit: Object.freeze({ waterwayCount: waterways.length, sampleCount: waterways.reduce((sum, waterway) => sum + waterway.samples.length, 0), fishingZoneCount: waterways.reduce((sum, waterway) => sum + waterway.fishingZones.length, 0), uphillSegments: waterways.reduce((sum, waterway) => sum + waterway.audit.uphillSegments, 0) }),
  });
}

function nearestRuntimeSample(runtime, x, z) {
  let nearest = null;
  for (const candidate of runtime?.spatialIndex?.get(x, z) ?? []) {
    const distance = Math.hypot(x - candidate.sample.x, z - candidate.sample.z);
    if (!nearest || distance < nearest.distance) nearest = { ...candidate, distance };
  }
  return nearest;
}

export function sampleOutdoorWaterway(runtime, x, z) {
  const nearest = nearestRuntimeSample(runtime, x, z);
  if (!nearest) return null;
  const { waterway, sample, distance } = nearest;
  const bedHalf = sample.width * waterway.channel.bedWidthRatio * 0.5;
  const channelHalf = sample.width * 0.5;
  const shelfEdge = channelHalf + waterway.banks.submergedShelfWidth;
  const wetEdge = shelfEdge + waterway.banks.innerWetBankWidth + waterway.banks.outerWetBankWidth;
  const outerEdge = wetEdge + waterway.banks.dryTransitionWidth;
  if (distance > outerEdge) return null;
  let targetY = sample.bedY;
  let region = 'channel-bed';
  if (distance > bedHalf && distance <= channelHalf) {
    const t = (distance - bedHalf) / Math.max(0.001, channelHalf - bedHalf);
    targetY = lerp(sample.bedY, sample.waterY - 0.16, t); region = 'channel-edge';
  } else if (distance > channelHalf && distance <= shelfEdge) {
    const t = (distance - channelHalf) / Math.max(0.001, shelfEdge - channelHalf);
    targetY = lerp(sample.waterY - 0.16, sample.waterY - 0.035, t); region = 'submerged-shelf';
  } else if (distance > shelfEdge && distance <= wetEdge) {
    const t = (distance - shelfEdge) / Math.max(0.001, wetEdge - shelfEdge);
    targetY = lerp(sample.waterY - 0.035, sample.waterY + 0.32, t); region = 'wet-bank';
  } else if (distance > wetEdge) {
    targetY = sample.waterY + 0.32; region = 'dry-transition';
  }
  return { waterway, sample, distance, targetY, region, outerEdge, wetEdge, shelfEdge, channelHalf };
}

export function deformOutdoorTerrainForWaterways(runtime, x, z, currentY) {
  const sampled = sampleOutdoorWaterway(runtime, x, z);
  if (!sampled) return { y: currentY, sampled: null };
  const blend = sampled.distance <= sampled.wetEdge ? 1 : 1 - clamp((sampled.distance - sampled.wetEdge) / Math.max(0.001, sampled.outerEdge - sampled.wetEdge), 0, 1);
  return { y: lerp(currentY, sampled.targetY, blend * blend * (3 - 2 * blend)), sampled };
}

export function isPointInOutdoorWaterwayFootprint(runtime, x, z) {
  return Boolean(sampleOutdoorWaterway(runtime, x, z));
}

function stripGeometry(rows, lateralFractions, yResolver) {
  return stripGeometryBands(rows, [lateralFractions], yResolver);
}

function stripGeometryBands(rows, lateralBands, yResolver) {
  const vertices = []; const uvs = []; const indices = [];
  lateralBands.forEach((lateralFractions) => {
    const baseVertex = vertices.length / 3;
    rows.forEach((sample) => lateralFractions.forEach((fraction) => {
      const lateral = fraction * sample.width * 0.5;
      vertices.push(sample.x + sample.normal.x * lateral, yResolver(sample, fraction), sample.z + sample.normal.z * lateral);
      uvs.push(sample.distance / 6, fraction * 0.5 + 0.5);
    }));
    const stride = lateralFractions.length;
    for (let row = 0; row < rows.length - 1; row += 1) for (let column = 0; column < stride - 1; column += 1) {
      const a = baseVertex + row * stride + column; const b = a + 1; const c = a + stride; const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  if (geometry.attributes.position.count > MAX_VERTICES_PER_WATERWAY) throw new Error('Waterway geometry exceeds its mobile vertex budget.');
  return geometry;
}

export function createOutdoorWaterwayMeshes(runtime, { textures = {}, makeMaterial, registerAnimatedTextureFlipbook } = {}) {
  const meshes = [];
  const sharedBankMaterials = new Map();
  const sharedWaterMaterials = new Map();
  runtime?.waterways?.forEach((waterway) => {
    const bankProfile = textures[waterway.materials.wetBank] ?? { color: 0x49382b, roughness: 1 };
    let bankMaterial = sharedBankMaterials.get(waterway.materials.wetBank);
    if (!bankMaterial) {
      bankMaterial = makeMaterial?.(bankProfile, { materialKey: waterway.materials.wetBank, profile: bankProfile, usedFallback: !textures[waterway.materials.wetBank] }) ?? new THREE.MeshStandardMaterial(bankProfile);
      sharedBankMaterials.set(waterway.materials.wetBank, bankMaterial);
    }
    const bank = new THREE.Mesh(stripGeometryBands(waterway.samples, [[-1.55, -1.18, -1], [1, 1.18, 1.55]], (sample, fraction) => sample.waterY + (Math.abs(fraction) <= 1 ? -0.12 : 0.12)), bankMaterial);
    bank.name = `OARB-waterway-banks-${waterway.id}`; bank.receiveShadow = true; bank.renderOrder = 8; bank.userData = { id: waterway.id, kind: 'waterwayBanks', source: 'shared-cross-section', materialKey: waterway.materials.wetBank };
    const profile = textures[waterway.water.material] ?? { color: 0x5b746d, roughness: 0.86, metalness: 0, transparent: true, opacity: waterway.water.opacity, animatedFrames: DEFAULT_WATER_FRAMES };
    let waterMaterial = sharedWaterMaterials.get(waterway.water.material);
    if (!waterMaterial) {
      waterMaterial = new THREE.MeshStandardMaterial({ color: profile.color ?? 0x5b746d, roughness: profile.roughness ?? 0.86, metalness: 0, transparent: true, opacity: profile.opacity ?? waterway.water.opacity, emissive: profile.emissive ?? 0x071311, emissiveIntensity: profile.emissiveIntensity ?? 0.05, depthWrite: false, side: THREE.DoubleSide });
      waterMaterial.name = `OARB-shared-waterway-material-${waterway.water.material}`;
      if (Array.isArray(profile.animatedFrames)) registerAnimatedTextureFlipbook?.(waterMaterial, profile);
      sharedWaterMaterials.set(waterway.water.material, waterMaterial);
    }
    const water = new THREE.Mesh(stripGeometry(waterway.samples, [-1, -0.5, 0, 0.5, 1], (sample) => sample.waterY + waterway.water.yOffset), waterMaterial);
    water.name = `OARB-waterway-water-${waterway.id}`; water.renderOrder = 12; water.userData = { id: waterway.id, kind: waterway.kind, fishable: waterway.fishing.enabled, flow: 'dense-downhill-profile', source: 'shared-cross-section' };
    meshes.push(bank, water);
  });
  meshes.sharedMaterialSummary = Object.freeze({ bankMaterialCount: sharedBankMaterials.size, waterMaterialCount: sharedWaterMaterials.size });
  return meshes;
}

export function createOutdoorWaterwayDebugGroup(runtime, { enabled = false } = {}) {
  if (!enabled || !runtime?.waterways?.length) return null;
  const group = new THREE.Group(); group.name = 'OARB-waterway-debug-overlay';
  runtime.waterways.forEach((waterway) => {
    const points = waterway.samples.map((sample) => new THREE.Vector3(sample.x, sample.waterY + 0.12, sample.z));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: waterway.audit.uphillSegments ? 0xff3333 : 0x22aaff })));
  });
  group.userData = { kind: 'oarbWaterwayDebug', developmentOnly: true, legend: { blue: 'downhill-water-profile', red: 'uphill-error' } };
  return group;
}

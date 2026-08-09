import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  PROGRESSIVE_SITE_BINDING_MODES,
  ProgressiveDamageSiteTargeting,
  createProgressiveDamageSiteTargetRecord,
  resolveProgressiveDamageSiteCaptureCenter,
  selectProgressiveDamageSiteTarget,
} from '../src/game/combat/ProgressiveDamageSiteTargeting.js';
import { CreatureLabSiteMarkerRenderer } from '../src/game/creatures/CreatureLabSiteMarkerRenderer.js';
import { ForgeDamageDeformationRuntime } from '../src/game/combat/ForgeDamageDeformationRuntime.js';

function site(siteId, center, {
  radius = 0.2,
  regionId = 'body_core',
  structuralGroup = 'body',
  direction = [0, 0, 1],
  authority = 'NATIVE',
} = {}) {
  return {
    siteId,
    displayName: siteId,
    authority,
    regionId,
    structuralGroup,
    radius,
    radiusWorld: radius,
    bindingMode: PROGRESSIVE_SITE_BINDING_MODES.skinnedSurface,
    currentWorldCenter: new THREE.Vector3().fromArray(center),
    currentWorldPreferredDirection: direction ? new THREE.Vector3().fromArray(direction).normalize() : null,
  };
}

function select(sites, point, options = {}) {
  return selectProgressiveDamageSiteTarget(sites, {
    impactRegion: options.region ?? 'upper_chest',
    impactWorld: new THREE.Vector3().fromArray(point),
    impactDirection: options.direction ? new THREE.Vector3().fromArray(options.direction) : new THREE.Vector3(0, 0, 1),
  });
}

test('3D distance selects the nearest of two same-side sites', () => {
  const result = select([site('left_near', [-0.2, 1.2, 0]), site('left_far', [-0.2, 0.8, 0])], [-0.2, 1.18, 0]);
  assert.equal(result.record.siteId, 'left_near');
});

test('forehead and jaw resolve independently with nearly identical X', () => {
  const sites = [site('forehead', [-0.01, 1.7, 0], { regionId: 'head', structuralGroup: 'head' }), site('jaw', [-0.01, 1.4, 0], { regionId: 'head', structuralGroup: 'head' })];
  assert.equal(select(sites, [-0.01, 1.68, 0], { region: 'head' }).record.siteId, 'forehead');
  assert.equal(select(sites, [-0.01, 1.42, 0], { region: 'head' }).record.siteId, 'jaw');
});

test('upper chest and abdomen resolve independently with identical X', () => {
  const sites = [site('upper_chest', [0, 1.25, 0]), site('abdomen', [0, 0.95, 0])];
  assert.equal(select(sites, [0, 1.24, 0]).record.siteId, 'upper_chest');
  assert.equal(select(sites, [0, 0.96, 0]).record.siteId, 'abdomen');
});

test('front and back sites resolve by depth', () => {
  const sites = [site('front', [0, 1.1, 0.15]), site('back', [0, 1.1, -0.15])];
  assert.equal(select(sites, [0, 1.1, 0.14]).record.siteId, 'front');
  assert.equal(select(sites, [0, 1.1, -0.14]).record.siteId, 'back');
});

test('two centerline sites resolve by full 3D distance', () => {
  const sites = [site('sternum', [0, 1.3, 0]), site('pelvis', [0, 0.75, 0])];
  assert.equal(select(sites, [0, 0.77, 0]).record.siteId, 'pelvis');
});

test('left and right still resolve naturally from XYZ distance', () => {
  const sites = [site('left', [-0.2, 1, 0]), site('right', [0.2, 1, 0])];
  assert.equal(select(sites, [-0.19, 1, 0]).record.siteId, 'left');
  assert.equal(select(sites, [0.19, 1, 0]).record.siteId, 'right');
});

test('impact outside every authored radius produces a spatial miss', () => {
  const result = select([site('small', [0, 1, 0], { radius: 0.05 })], [0, 1.2, 0]);
  assert.equal(result.record, null);
  assert.equal(result.decision.rejectionReason, 'no-site-inside-authored-radius');
  assert.equal(result.decision.candidates[0].eligible, false);
  assert.equal(result.decision.candidates[0].rejectionReason, 'outside-authored-radius');
});

test('overlapping radii choose the smaller normalized distance', () => {
  const sites = [site('wide', [0, 1, 0], { radius: 0.4 }), site('tight', [0.08, 1, 0], { radius: 0.1 })];
  const result = select(sites, [0.04, 1, 0]);
  assert.equal(result.record.siteId, 'wide');
  assert.equal(result.decision.eligibleCandidateCount, 2);
});

test('preferred direction breaks a near spatial tie', () => {
  const sites = [site('away', [0, 1, 0], { direction: [0, 0, -1] }), site('approach', [0.004, 1, 0], { direction: [0, 0, 1] })];
  assert.equal(select(sites, [0, 1, 0], { direction: [0, 0, 1] }).record.siteId, 'approach');
});

test('direction cannot override a clearly nearer site', () => {
  const sites = [site('near', [0, 1, 0], { direction: [0, 0, -1] }), site('far', [0.1, 1, 0], { direction: [0, 0, 1] })];
  assert.equal(select(sites, [0, 1, 0], { direction: [0, 0, 1] }).record.siteId, 'near');
});

test('an exact semantic and spatial tie uses stable siteId ordering', () => {
  const sites = [site('z_site', [0, 1, 0]), site('a_site', [0, 1, 0])];
  assert.equal(select(sites, [0, 1, 0]).record.siteId, 'a_site');
});

test('missing or malformed radius makes a normalized record untargetable', () => {
  const authored = { siteId: 'bad_radius', stageOrder: ['LIGHT'], stages: [{ stage: 'LIGHT', measurements: { captureCenterLocal: [0, 0, 1] } }] };
  const record = createProgressiveDamageSiteTargetRecord(authored);
  assert.equal(record.bindingMode, PROGRESSIVE_SITE_BINDING_MODES.untargetable);
  assert.equal(record.rejectionReason, 'missing-or-invalid-authored-radius');
});

test('missing capture center receives an explicit diagnostic', () => {
  const resolution = resolveProgressiveDamageSiteCaptureCenter({ stageOrder: ['LIGHT'], stages: [{ stage: 'LIGHT' }] });
  assert.equal(resolution.captureCenterLocal, null);
  assert.equal(resolution.rejectionReason, 'missing-authored-capture-center');
});

test('first finite stage capture center wins over a numeric zero anchor', () => {
  const resolution = resolveProgressiveDamageSiteCaptureCenter({
    anchorLocal: [0, 0, 0],
    stageOrder: ['LIGHT', 'MEDIUM'],
    stages: [
      { stage: 'LIGHT', measurements: { captureCenterLocal: [0.1, 0.2, 1.3] } },
      { stage: 'MEDIUM', measurements: { captureCenterLocal: [0.2, 0.3, 1.2] } },
    ],
  });
  assert.deepEqual(resolution.captureCenterLocal, [0.1, 0.2, 1.3]);
  assert.equal(resolution.source, 'stage:LIGHT');
});

test('a valid site retains a diagnosed static fallback without a surface binder', () => {
  const targeting = new ProgressiveDamageSiteTargeting({ sites: [{
    siteId: 'static', authority: 'NATIVE', regionId: 'body_core', structuralGroup: 'body', radius: 0.2,
    stageOrder: ['LIGHT'], stages: [{ stage: 'LIGHT', measurements: { captureCenterLocal: [0, 0, 1] } }],
  }] });
  const record = targeting.getRecord('static');
  assert.equal(record.bindingMode, PROGRESSIVE_SITE_BINDING_MODES.staticActorLocalFallback);
  assert.equal(record.bindingDiagnostic, 'skinned-surface-binding-api-unavailable');
  targeting.dispose();
});

test('native and compatibility authorities remain distinct and have no score priority', () => {
  const sites = [site('native', [0.02, 1, 0], { authority: 'NATIVE' }), site('compat', [0, 1, 0], { authority: 'COMPATIBILITY' })];
  const result = select(sites, [0, 1, 0]);
  assert.equal(result.record.siteId, 'compat');
  assert.deepEqual(result.decision.candidates.map((candidate) => candidate.authority).sort(), ['COMPATIBILITY', 'NATIVE']);
});

test('no eligible progressive site can be diagnosed as using region fallback', () => {
  const targeting = new ProgressiveDamageSiteTargeting({ sites: [{
    siteId: 'missed', authority: 'NATIVE', regionId: 'body_core', structuralGroup: 'body', radius: 0.05,
    stageOrder: ['LIGHT'], stages: [{ stage: 'LIGHT', measurements: { captureCenterLocal: [0, 0, 1] } }],
  }] });
  const result = targeting.select({ impactRegion: 'upper_chest', impactWorld: new THREE.Vector3(0, 1.3, 0), impactDirection: new THREE.Vector3(0, 0, 1) });
  assert.equal(result.record, null);
  targeting.noteRegionFallback(true);
  assert.equal(targeting.getDiagnostics().lastTargetingDecision.fallbackUsed, true);
  targeting.dispose();
});

test('Forge selects its existing non-progressive region fallback after a spatial miss', () => {
  const runtime = Object.create(ForgeDamageDeformationRuntime.prototype);
  const fallbackRecord = { name: 'Body_Core_Fallback', regionId: 'body_core', stampCenterX: 0.1 };
  runtime.adapter = {
    worldToActorLocal: (point, target) => target.copy(point),
    worldDirectionToActorLocal: (direction, target) => target.copy(direction).normalize(),
  };
  runtime.root = new THREE.Object3D();
  runtime.keyRecords = new Map([[fallbackRecord.name, fallbackRecord]]);
  runtime.progressiveStageByKey = new Map();
  let fallbackUsed = null;
  runtime.progressiveSiteTargeting = {
    select: () => ({ record: null, decision: { rejectionReason: 'no-site-inside-authored-radius' } }),
    noteRegionFallback: (used) => { fallbackUsed = used; },
  };
  const result = runtime.selectMaceDamage({
    hit: { regionId: 'upper_chest' },
    impact: { primitive: 'mace_head', worldPoint: new THREE.Vector3(0.1, 1, 0), impactDirection: new THREE.Vector3(-1, 0, 0) },
  });
  assert.equal(result.site, null);
  assert.equal(result.record, fallbackRecord);
  assert.equal(fallbackUsed, true);
});

test('mobile lab markers reuse production records and clean up shared presentation', () => {
  const scene = new THREE.Scene();
  const records = [site('native', [0, 1, 0]), site('compatibility', [0.1, 1, 0], { authority: 'COMPATIBILITY' })];
  const targeting = { records, listRecords: () => records };
  const markers = new CreatureLabSiteMarkerRenderer({ scene, targeting });
  markers.setSettings({ selectedSiteId: 'compatibility', showSites: true, showSelectedRadius: true });
  assert.equal(markers.markers.count, 2);
  assert.equal(markers.markers.visible, true);
  assert.equal(markers.selectedRadius.visible, true);
  assert.equal(markers.markers.raycast(), undefined);
  const markerMesh = markers.markers;
  markers.dispose();
  assert.equal(markerMesh.parent, null);
  assert.equal(scene.children.length, 0);
});

test('a 32-site authored character remains a deterministic bounded linear scan', () => {
  const sites = Array.from({ length: 32 }, (_, index) => site(`site_${String(index).padStart(2, '0')}`, [index * 0.15, 1, 0], { radius: 0.08 }));
  const result = select(sites, [27 * 0.15, 1, 0]);
  assert.equal(result.record.siteId, 'site_27');
  assert.equal(result.decision.candidateCount, 32);
  assert.equal(result.decision.eligibleCandidateCount, 1);
});

test('lab probes do not overwrite the last physical targeting decision', () => {
  const targeting = new ProgressiveDamageSiteTargeting({ sites: [{
    siteId: 'physical_site', displayName: 'Physical Face', authority: 'NATIVE', regionId: 'head', structuralGroup: 'head', radius: 0.1,
    stageOrder: ['LIGHT'], stages: [{ stage: 'LIGHT', measurements: { captureCenterLocal: [0, 0, 1] } }],
  }] });
  const center = targeting.getRecord('physical_site').currentWorldCenter.clone();
  targeting.select({ impactRegion: 'head', impactWorld: center, impactDirection: new THREE.Vector3(0, 0, 1), source: 'physical' });
  targeting.select({ impactRegion: 'head', impactWorld: center.clone().addScalar(1), impactDirection: new THREE.Vector3(0, 0, 1), source: 'creature_lab_probe' });
  const diagnostics = targeting.getDiagnostics();
  assert.equal(diagnostics.lastTargetingDecision.selectedSiteId, null);
  assert.equal(diagnostics.lastPhysicalTargetingDecision.selectedSiteId, 'physical_site');
  targeting.dispose();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { KNIFE_COMBAT_CONFIG } from '../src/game/combat/CombatConfig.js';
import { CombatWoundSystem, PUNCTURE_DECAL_SCALE } from '../src/game/combat/CombatWoundSystem.js';
import { HumanoidCombatActor } from '../src/game/combat/HumanoidCombatActor.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../src/game/combat/CombatPhysicsWorld.js';
import {
  getAlphaBoundUv,
  installKnifeWoundManifestForHeadlessTests,
  selectKnifeSlashFragmentVariant,
} from '../src/game/combat/KnifeWoundDecalLibrary.js';
import {
  MAX_SLASH_FRAGMENT_COUNT,
  SLASH_CONTINUITY_TOLERANCE,
  SLASH_FRAGMENT_ENDPOINT_SCALE,
  SLASH_FRAGMENT_MAXIMUM_ANGLE_RADIANS,
  SLASH_FRAGMENT_SCALE_VARIATION,
  SLASH_FRAGMENT_SPACING_RATIO,
  appendSlashVisualPathPoint,
  createSlashVisualWorkspace,
  deriveSlashFragmentMetrics,
  makeSlashFragmentGeometry,
  resetSlashVisualPath,
  updateSlashFragmentGeometry,
} from '../src/game/combat/SlashWoundVisual.js';
import { findClosestSkinnedSurface, reconstructSkinnedSurface } from '../src/game/combat/SkinnedSurfaceBinding.js';

const manifest = JSON.parse(readFileSync(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8'));
const decalLibrary = installKnifeWoundManifestForHeadlessTests(manifest);
const normal = new THREE.Vector3(0, 0, 1);

function variant(id) {
  return manifest.variants.find((entry) => entry.id === id);
}

function pathLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += points[index].distanceTo(points[index - 1]);
  return length;
}

function renderPath(points, {
  variantId = 'knife_puncture_slit_01',
  maximumDepth = 0.018,
  severity = 0.35,
  fallbackUsage = false,
  seed = 0x1234abcd,
  geometry = makeSlashFragmentGeometry(),
  workspace = createSlashVisualWorkspace(),
  layoutRevision = 1,
} = {}) {
  resetSlashVisualPath(workspace);
  points.forEach((point) => appendSlashVisualPathPoint(workspace, point, normal));
  const physicalCutLength = pathLength(points);
  const metrics = deriveSlashFragmentMetrics({ maximumDepth, severity });
  const diagnostics = updateSlashFragmentGeometry({
    geometry,
    workspace,
    variant: variant(variantId),
    deterministicSeed: seed,
    physicalCutLength,
    fragmentMajorLength: metrics.majorLength,
    fragmentWidth: maximumDepth >= 0.04 ? 0.015 : 0.008,
    centerSpacing: metrics.maximumCenterSpacing,
    fallbackUsage,
    layoutRevision,
  });
  return { geometry, workspace, diagnostics, metrics };
}

function createGridSurface() {
  const divisions = 4;
  const positions = [];
  const indices = [];
  for (let y = 0; y <= divisions; y += 1) {
    for (let x = 0; x <= divisions; x += 1) positions.push(-0.3 + x * 0.15, -0.3 + y * 0.15, 0);
  }
  for (let y = 0; y < divisions; y += 1) {
    for (let x = 0; x < divisions; x += 1) {
      const a = y * (divisions + 1) + x;
      const b = a + 1;
      const c = a + divisions + 1;
      const d = c + 1;
      indices.push(a, b, c, c, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const vertexCount = positions.length / 3;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(vertexCount * 4), 4));
  const weights = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index += 1) weights[index * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const bone = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = 'slash-test-animated-torso';
  mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone]));
  const root = new THREE.Group();
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.skeleton.update();
  return { root, mesh, bone, geometry };
}

function createSurfaceAdapter(fixture) {
  return {
    scene: fixture.root,
    failNextBinding: false,
    bindVisibleSurface(point, options) {
      if (this.failNextBinding) { this.failNextBinding = false; return null; }
      return findClosestSkinnedSurface([fixture.mesh], point, options);
    },
    reconstructVisibleSurface(binding, target) { return reconstructSkinnedSurface(binding, target); },
    getFallbackWoundAnchor(bodyId, point, surfaceNormal) { return { bodyId, point: point.clone(), normal: surfaceNormal.clone(), fallback: true }; },
  };
}

function createWoundSystem(visualAdapter = null) {
  const body = {
    rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
    translation: () => ({ x: 0, y: 0, z: 0 }),
  };
  const actor = { bodies: new Map([['upper_chest', { body }]]), visualAdapter };
  const scene = new THREE.Scene();
  const system = new CombatWoundSystem({ actor, scene, decalLibrary, maximumWounds: 4 });
  const hit = { bodyId: 'upper_chest', regionId: 'upper_chest', region: { vital: 'none' }, body, localPoint: new THREE.Vector3(-0.24, -0.12, 0.01) };
  return { system, scene, hit };
}

function createSlash(system, hit, overrides = {}) {
  const startPoint = overrides.startPoint ?? hit.localPoint.clone();
  const endPoint = overrides.endPoint ?? new THREE.Vector3(0.24, 0.12, 0.01);
  return system.createSlash({
    hit,
    startPoint,
    endPoint,
    surfaceNormal: normal,
    cutDirection: endPoint.clone().sub(startPoint).normalize(),
    depth: overrides.depth ?? 0.022,
    cutLength: overrides.cutLength ?? startPoint.distanceTo(endPoint),
    severity: overrides.severity ?? 0.42,
    classification: overrides.classification ?? 'shallow_cut',
    edgeAlignment: overrides.edgeAlignment ?? 0.88,
  });
}

test('ordinary and deep slash chains select only authored slit-class puncture decals deterministically', () => {
  const shallow = selectKnifeSlashFragmentVariant(manifest, { woundId: 'slash-a', maximumDepth: 0.014, surfaceDisruption: 0.25, selectionSeverity: 0.3 });
  const deep = selectKnifeSlashFragmentVariant(manifest, { woundId: 'slash-b', maximumDepth: 0.04, surfaceDisruption: 0.6, selectionSeverity: 0.65 });
  const disruptive = selectKnifeSlashFragmentVariant(manifest, { woundId: 'slash-c', maximumDepth: 0.07, surfaceDisruption: 0.9, selectionSeverity: 0.95 });
  assert.equal(shallow.variant.id, 'knife_puncture_slit_01');
  assert.equal(deep.variant.id, 'knife_puncture_slit_02');
  assert.equal(disruptive.variant.id, 'knife_puncture_split_01');
  [shallow, deep, disruptive].forEach((selection) => {
    assert.equal(selection.variant.family, 'puncture');
    assert.doesNotMatch(selection.variant.id, /_(?:burst|double)_/);
    assert.equal(selectKnifeSlashFragmentVariant(manifest, { woundId: selection === shallow ? 'slash-a' : selection === deep ? 'slash-b' : 'slash-c', maximumDepth: selection === shallow ? 0.014 : selection === deep ? 0.04 : 0.07, surfaceDisruption: selection === shallow ? 0.25 : selection === deep ? 0.6 : 0.9, selectionSeverity: selection === shallow ? 0.3 : selection === deep ? 0.65 : 0.95 }).variant.id, selection.variant.id);
  });
});

test('straight, short, shallow, deep, and maximum-length slash chains cover endpoints without gaps', () => {
  const cases = [
    { name: 'short', length: 0.03, depth: 0.012, severity: 0.2, variantId: 'knife_puncture_slit_01' },
    { name: 'shallow', length: 0.16, depth: 0.018, severity: 0.35, variantId: 'knife_puncture_slit_01' },
    { name: 'deep', length: 0.28, depth: 0.045, severity: 0.72, variantId: 'knife_puncture_slit_02' },
    { name: 'maximum', length: 0.52, depth: 0.072, severity: 1, variantId: 'knife_puncture_split_01' },
  ];
  cases.forEach(({ name, length, depth, severity, variantId }) => {
    const result = renderPath([new THREE.Vector3(), new THREE.Vector3(length, 0, 0)], { maximumDepth: depth, severity, variantId });
    const { diagnostics, workspace } = result;
    assert.ok(diagnostics.fragmentCount >= 1 && diagnostics.fragmentCount <= MAX_SLASH_FRAGMENT_COUNT, `${name} stays in the bounded pool`);
    assert.ok(diagnostics.maximumUncoveredGap <= SLASH_CONTINUITY_TOLERANCE, `${name} has no uncovered path interval`);
    assert.ok(diagnostics.minimumVisibleOverlapRatio >= 0.6, `${name} visibly overlaps neighboring alpha intervals`);
    assert.ok(diagnostics.averageCenterSpacing <= diagnostics.maximumPermittedSpacing + 1e-8, `${name} center spacing is bounded`);
    assert.equal(workspace.fragmentPathDistances[0], 0, `${name} covers its start`);
    const last = diagnostics.fragmentCount - 1;
    assert.ok(length - workspace.fragmentPathDistances[last] <= workspace.fragmentLengths[last] * 0.5 + SLASH_CONTINUITY_TOLERANCE, `${name} covers its end`);
  });
  const longest = renderPath([new THREE.Vector3(), new THREE.Vector3(0.52, 0, 0)], { maximumDepth: 0.012 });
  assert.ok(longest.diagnostics.fragmentCount < MAX_SLASH_FRAGMENT_COUNT, 'the longest allowed slash leaves spare pooled capacity');
  assert.equal(SLASH_FRAGMENT_SPACING_RATIO, 0.3);
  assert.equal(SLASH_FRAGMENT_ENDPOINT_SCALE, 0.9);
});

test('curved slash fragments sample the recorded path and align to each local tangent', () => {
  const points = Array.from({ length: 9 }, (_, index) => {
    const angle = -0.8 + index * 0.2;
    return new THREE.Vector3(Math.sin(angle) * 0.28, (1 - Math.cos(angle)) * 0.28, 0);
  });
  const { diagnostics, workspace } = renderPath(points, { variantId: 'knife_puncture_slit_02', maximumDepth: 0.04, severity: 0.7 });
  assert.ok(diagnostics.maximumPathCurvature > 0);
  assert.ok(diagnostics.maximumUncoveredGap <= SLASH_CONTINUITY_TOLERANCE);
  for (let fragment = 0; fragment < diagnostics.fragmentCount; fragment += 1) {
    const offset = fragment * 3;
    const center = new THREE.Vector3(workspace.fragmentCenters[offset], workspace.fragmentCenters[offset + 1], workspace.fragmentCenters[offset + 2]);
    const tangent = new THREE.Vector3(workspace.fragmentTangents[offset], workspace.fragmentTangents[offset + 1], workspace.fragmentTangents[offset + 2]);
    const radial = new THREE.Vector3(center.x, center.y - 0.28, 0).normalize();
    assert.ok(Math.abs(tangent.dot(radial)) < 0.16, `fragment ${fragment} follows the local curved tangent`);
  }
});

test('fragment UVs stay inside authored alpha bounds and deterministic variation is stable between frames', () => {
  const geometry = makeSlashFragmentGeometry();
  const workspace = createSlashVisualWorkspace();
  const points = [new THREE.Vector3(), new THREE.Vector3(0.24, 0.06, 0)];
  const first = renderPath(points, { geometry, workspace, seed: 77 });
  const count = first.diagnostics.fragmentCount;
  const snapshot = {
    mirrors: [...workspace.fragmentMirrors.slice(0, count)],
    scales: [...workspace.fragmentScales.slice(0, count)],
    angles: [...workspace.fragmentAngles.slice(0, count)],
    centers: [...workspace.fragmentCenters.slice(0, count * 3)],
  };
  const geometryId = geometry.uuid;
  const second = renderPath(points, { geometry, workspace, seed: 77, layoutRevision: 1 });
  assert.equal(second.geometry.uuid, geometryId, 'the pooled geometry object is reused');
  assert.deepEqual([...workspace.fragmentMirrors.slice(0, count)], snapshot.mirrors);
  assert.deepEqual([...workspace.fragmentScales.slice(0, count)], snapshot.scales);
  assert.deepEqual([...workspace.fragmentAngles.slice(0, count)], snapshot.angles);
  assert.deepEqual([...workspace.fragmentCenters.slice(0, count * 3)], snapshot.centers);
  assert.ok(snapshot.scales.every((scale) => Math.abs(scale - 1) <= SLASH_FRAGMENT_SCALE_VARIATION + 1e-7));
  assert.ok(snapshot.angles.every((angle) => Math.abs(angle) <= SLASH_FRAGMENT_MAXIMUM_ANGLE_RADIANS + 1e-7));
  const authored = variant('knife_puncture_slit_01');
  const normalUv = getAlphaBoundUv(authored, false);
  const mirroredUv = getAlphaBoundUv(authored, true);
  const uv = geometry.attributes.uv.array;
  for (let fragment = 0; fragment < count; fragment += 1) {
    const offset = fragment * 8;
    const expected = workspace.fragmentMirrors[fragment] ? mirroredUv : normalUv;
    assert.deepEqual([...uv.slice(offset, offset + 8)], [expected.u0, expected.v0, expected.u1, expected.v0, expected.u0, expected.v1, expected.u1, expected.v1]);
    assert.ok(uv[offset] !== 0 && uv[offset + 2] !== 1 && uv[offset + 1] !== 0 && uv[offset + 5] !== 1, 'full transparent canvas UVs are excluded');
  }
});

test('live growth appends stable deterministic tail fragments instead of rebuilding the earlier chain', () => {
  const geometry = makeSlashFragmentGeometry();
  const workspace = createSlashVisualWorkspace();
  const first = renderPath([new THREE.Vector3(), new THREE.Vector3(0.18, 0, 0)], { geometry, workspace, seed: 991, layoutRevision: 1 });
  const stableCount = Math.max(0, first.diagnostics.fragmentCount - 1);
  const centers = [...workspace.fragmentCenters.slice(0, stableCount * 3)];
  const mirrors = [...workspace.fragmentMirrors.slice(0, stableCount)];
  const scales = [...workspace.fragmentScales.slice(0, stableCount)];
  const second = renderPath([new THREE.Vector3(), new THREE.Vector3(0.34, 0, 0)], { geometry, workspace, seed: 991, layoutRevision: 2 });
  assert.ok(second.diagnostics.fragmentCount > first.diagnostics.fragmentCount);
  assert.ok([...workspace.fragmentCenters.slice(0, stableCount * 3)].every((value, index) => Math.abs(value - centers[index]) < 1e-7));
  assert.deepEqual([...workspace.fragmentMirrors.slice(0, stableCount)], mirrors);
  assert.deepEqual([...workspace.fragmentScales.slice(0, stableCount)], scales);
  assert.ok(second.diagnostics.maximumUncoveredGap <= SLASH_CONTINUITY_TOLERANCE);
});

test('one slash owns one wound, one material, one draw call, and no fragment gameplay state', () => {
  const { system, scene, hit } = createWoundSystem();
  const wound = createSlash(system, hit, { endPoint: new THREE.Vector3(0.2, 0.04, 0.01) });
  const woundCount = system.wounds.length;
  const geometryId = wound.visualSlot.slash.geometry.uuid;
  for (let frame = 0; frame < 5; frame += 1) system.updateWoundVisual(wound);
  assert.equal(system.wounds.length, woundCount);
  assert.equal(woundCount, 1);
  assert.equal(wound.visualSlot.slash.geometry.uuid, geometryId);
  assert.equal(wound.slashVisualDiagnostics.materialCount, 1);
  assert.equal(wound.slashVisualDiagnostics.drawCallCount, 1);
  assert.ok(wound.decalVariantId.startsWith('knife_puncture_slit_'));
  assert.equal(wound.decalFamily, 'slash');
  assert.equal(wound.visualSlot.puncture.visible, false);
  assert.equal(wound.visualSlot.slash.visible, true);
  assert.equal(scene.children.filter((object) => object.name === wound.visualSlot.slash.name).length, 1, 'fragments do not create child meshes');
  assert.equal('bleedingRate' in wound.visualSlot.slashWorkspace, false);
  assert.equal('physiology' in wound.visualSlot.slashWorkspace, false);
  system.dispose();
});

test('fragment rendering creates no additional physiology or pain events for the authoritative slash wound', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene() });
  const bodyEntry = actor.bodies.get('upper_chest');
  const collider = actor.colliders.get('upper_chest');
  const translation = bodyEntry.body.translation();
  const worldPoint = new THREE.Vector3(translation.x - 0.1, translation.y, translation.z + 0.1);
  const hit = actor.resolveHit(collider, worldPoint);
  let woundCreatedEvents = 0;
  let traumaEvents = 0;
  let painEvents = 0;
  const onWoundCreated = actor.physiology.onWoundCreated.bind(actor.physiology);
  const onTrauma = actor.physiology.onTrauma.bind(actor.physiology);
  actor.physiology.onWoundCreated = (...args) => { woundCreatedEvents += 1; return onWoundCreated(...args); };
  actor.physiology.onTrauma = (...args) => { traumaEvents += 1; return onTrauma(...args); };
  actor.triggerReflex = () => { painEvents += 1; };
  const endPoint = worldPoint.clone().add(new THREE.Vector3(0.16, 0.03, 0));
  const wound = actor.applySlashWound({ hit, startPoint: worldPoint, endPoint, surfaceNormal: normal, cutDirection: endPoint.clone().sub(worldPoint).normalize(), depth: 0.02, cutLength: worldPoint.distanceTo(endPoint), severity: 0.4, classification: 'shallow_cut' });
  assert.equal(actor.woundSystem.wounds.length, 1);
  assert.equal(woundCreatedEvents, 1);
  assert.equal(traumaEvents, 1);
  assert.equal(painEvents, 1);
  const eventSnapshot = [woundCreatedEvents, traumaEvents, painEvents];
  for (let frame = 0; frame < 12; frame += 1) actor.woundSystem.updateWoundVisual(wound);
  assert.deepEqual([woundCreatedEvents, traumaEvents, painEvents], eventSnapshot, 'presentation fragments emit no gameplay events');
  assert.equal(actor.woundSystem.wounds.length, 1);
  actor.dispose(); physics.dispose();
});

test('animated multi-triangle torso bindings preserve curved-chain continuity and pooled geometry', () => {
  const fixture = createGridSurface();
  const adapter = createSurfaceAdapter(fixture);
  const { system, hit } = createWoundSystem(adapter);
  const wound = createSlash(system, hit);
  assert.ok(new Set(wound.slashSamples.map((sample) => sample.binding.triangleIndex)).size >= 3, 'recorded slash crosses several valid surface triangles');
  const geometryId = wound.visualSlot.slash.geometry.uuid;
  const before = [...wound.visualSlot.slashWorkspace.fragmentCenters.slice(0, wound.renderedSegmentCount * 3)];
  fixture.bone.position.set(0.11, 0.035, 0);
  fixture.root.updateMatrixWorld(true);
  fixture.mesh.skeleton.update();
  system.updateWoundVisual(wound);
  const after = [...wound.visualSlot.slashWorkspace.fragmentCenters.slice(0, wound.renderedSegmentCount * 3)];
  assert.equal(wound.visualSlot.slash.geometry.uuid, geometryId);
  assert.ok(Math.abs(after[0] - before[0] - 0.11) < 1e-4, 'fragment centers follow animated torso translation');
  assert.ok(Math.abs(after[1] - before[1] - 0.035) < 1e-4);
  assert.ok(wound.slashVisualDiagnostics.maximumUncoveredGap <= SLASH_CONTINUITY_TOLERANCE);
  system.dispose(); fixture.geometry.dispose(); fixture.mesh.material.dispose();
});

test('temporary failed binding splits invalid surface space without breaking valid-section continuity', () => {
  const fixture = createGridSurface();
  const adapter = createSurfaceAdapter(fixture);
  const { system, hit } = createWoundSystem(adapter);
  const wound = createSlash(system, hit, { endPoint: new THREE.Vector3(0.02, -0.02, 0.01), cutLength: 0.27 });
  adapter.failNextBinding = true;
  system.extendSlash(wound.id, { localEnd: new THREE.Vector3(0.08, 0.04, 0.01), worldEnd: new THREE.Vector3(0.08, 0.04, 0.01), surfaceNormal: normal, addedTravel: 0.08, depth: 0.025, severity: 0.5, edgeAlignment: 0.8 });
  system.extendSlash(wound.id, { localEnd: new THREE.Vector3(0.16, 0.1, 0.01), worldEnd: new THREE.Vector3(0.16, 0.1, 0.01), surfaceNormal: normal, addedTravel: 0.1, depth: 0.026, severity: 0.52, edgeAlignment: 0.8 });
  system.extendSlash(wound.id, { localEnd: new THREE.Vector3(0.24, 0.15, 0.01), worldEnd: new THREE.Vector3(0.24, 0.15, 0.01), surfaceNormal: normal, addedTravel: 0.1, depth: 0.026, severity: 0.52, edgeAlignment: 0.8 });
  assert.ok(wound.slashSamples.some((sample) => sample.breakBefore), 'the failed binding is not bridged');
  assert.ok(wound.slashVisualDiagnostics.maximumUncoveredGap <= SLASH_CONTINUITY_TOLERANCE, 'each valid section remains continuous');
  assert.equal(wound.slashVisualDiagnostics.drawCallCount, 1);
  system.dispose(); fixture.geometry.dispose(); fixture.mesh.material.dispose();
});

test('fallback and reopening remain continuous chains rather than stretched or dotted punctures', () => {
  const { system, hit } = createWoundSystem();
  const wound = createSlash(system, hit, { endPoint: new THREE.Vector3(0.2, 0.04, 0.01), cutLength: 0.31 });
  const geometryId = wound.visualSlot.slash.geometry.uuid;
  const initialWidth = wound.visualWidthMeters;
  assert.equal(wound.slashVisualDiagnostics.fallbackUsage, true);
  assert.ok(wound.slashVisualDiagnostics.fragmentCount > 1);
  assert.ok(wound.slashVisualDiagnostics.maximumUncoveredGap <= SLASH_CONTINUITY_TOLERANCE);
  wound.reopenedCount += 1;
  wound.lateralTearingMeters = 0.018;
  system.updateSlashDimensions(wound);
  system.updateWoundVisual(wound);
  assert.equal(wound.visualSlot.slash.geometry.uuid, geometryId);
  assert.ok(wound.visualWidthMeters > initialWidth);
  assert.ok(wound.slashVisualDiagnostics.fragmentCount > 1);
  assert.ok(wound.slashVisualDiagnostics.maximumUncoveredGap <= SLASH_CONTINUITY_TOLERANCE);
  assert.equal(wound.visualSlot.puncture.visible, false);
  system.dispose();
});

test('stab puncture presentation is uniformly 30 percent larger without changing its authored UV or wound dimensions', () => {
  const { system, hit } = createWoundSystem();
  const wound = system.createPuncture({ hit, entryPoint: hit.localPoint, axis: new THREE.Vector3(0, 0, -1), surfaceNormal: normal, entryTangent: new THREE.Vector3(1, 0, 0), depth: 0.018, impactSeverity: 0.3, weaponProfile: KNIFE_COMBAT_CONFIG });
  assert.equal(PUNCTURE_DECAL_SCALE, 1.3);
  assert.ok(Math.abs(wound.visualSlot.puncture.scale.x - wound.visualMajorMeters * 1.3) < 1e-9);
  assert.ok(Math.abs(wound.visualSlot.puncture.scale.y - wound.visualMinorMeters * 1.3) < 1e-9);
  assert.equal(wound.visualSlot.puncture.visible, true);
  assert.equal(wound.visualSlot.slash.visible, false);
  assert.equal(wound.visualSlot.puncture.material.userData.authoredKnifeWoundVariantId, wound.decalVariantId);
  const cropped = getAlphaBoundUv(variant(wound.decalVariantId), wound.mirroredX);
  assert.deepEqual([...wound.visualSlot.puncture.geometry.attributes.uv.array], [cropped.u0, cropped.v0, cropped.u1, cropped.v0, cropped.u0, cropped.v1, cropped.u1, cropped.v1]);
  system.dispose();
});

test('slash visual source has no unseeded randomness, fragment meshes, or gameplay wound creation', () => {
  const source = readFileSync(new URL('../src/game/combat/SlashWoundVisual.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /new THREE\.Mesh/);
  assert.doesNotMatch(source, /createWound|onWoundCreated|triggerReflex|physiology|bleedingRate/);
  assert.match(source, /DynamicDrawUsage/);
  assert.match(source, /getAlphaBoundUv/);
});

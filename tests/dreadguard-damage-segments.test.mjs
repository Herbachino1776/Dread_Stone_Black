import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../src/game/combat/CombatPhysicsWorld.js';
import { HumanoidDamageSegmentRuntime, validateDamageAsset } from '../src/game/combat/HumanoidDamageSegmentRuntime.js';
import { DREADGUARD_DAMAGE_COMBAT_PROFILE, getHumanoidProfileScale } from '../src/game/combat/HumanoidModelProfiles.js';
import { FORGE_GORE_RENDER_ORDER } from '../src/game/combat/ForgeDamageDeformationRuntime.js';
import { isForgeGoreSurfaceObject, prepareHumanoidCombatMaterial } from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import { BLUNT_IMPACT_CLASSIFICATIONS } from '../src/game/combat/weapons/BluntImpactInteraction.js';

const glbUrl = new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb', import.meta.url);
const manifestUrl = new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.json', import.meta.url);
const validationUrl = new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001_validation.json', import.meta.url);
const damageManifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
const validationReport = JSON.parse(readFileSync(validationUrl, 'utf8'));

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
};
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

function parseGlbJson(buffer) {
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'JSON') return JSON.parse(buffer.toString('utf8', offset + 8, offset + 8 + length).replace(/\u0000+$/, ''));
    offset += 8 + length;
  }
  throw new Error('GLB JSON chunk was not found');
}

async function loadDamageGltf() {
  const bytes = readFileSync(glbUrl);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new GLTFLoader().parseAsync(buffer, new URL('../public/assets/enemies/dreadguard/damage/', import.meta.url).href);
}

async function createRuntimeFixture({ livingVelocity = new THREE.Vector3() } = {}) {
  await initializeCombatPhysics();
  const gltf = await loadDamageGltf();
  const physics = new CombatPhysicsWorld();
  const hostScene = new THREE.Scene();
  const presentationRoot = new THREE.Group();
  hostScene.add(presentationRoot);
  presentationRoot.add(gltf.scene);
  gltf.scene.scale.setScalar(getHumanoidProfileScale(DREADGUARD_DAMAGE_COMBAT_PROFILE));
  presentationRoot.updateMatrixWorld(true);
  gltf.scene.traverse((object) => object.skeleton?.update?.());
  const actor = {
    physics,
    scene: hostScene,
    livingVelocity: livingVelocity.clone(),
    mortalityCount: 0,
    bloodCount: 0,
    nonfatalCount: 0,
    reactionCount: 0,
    lifeState: 'alive',
    detachedSemanticBodyIds: new Set(),
    requestFatalSegmentDetachment() {
      if (this.lifeState === 'dying' || this.lifeState === 'dead') return false;
      this.mortalityCount += 1;
      return true;
    },
    emitDetachmentBlood() { this.bloodCount += 1; return true; },
    disableDetachedSemanticBodies(bodyIds) { bodyIds.forEach((bodyId) => this.detachedSemanticBodyIds.add(bodyId)); },
    restoreDetachedSemanticBodies(bodyIds) { bodyIds.forEach((bodyId) => this.detachedSemanticBodyIds.delete(bodyId)); },
    getSemanticBodyVelocity(_bodyIds, target = new THREE.Vector3()) { return target.set(0, 0, 0); },
    applyNonfatalSegmentDetachment() {
      this.nonfatalCount += 1;
      this.reactionCount += 1;
      return { accepted: true, reactionTriggered: true };
    },
  };
  const adapter = {
    profile: DREADGUARD_DAMAGE_COMBAT_PROFILE,
    loadedClips: gltf.animations,
    animationManifest: null,
    presentationRoot,
    prepareVisibleSurfaceFrame() {
      presentationRoot.updateMatrixWorld(true);
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((object) => object.skeleton?.update?.());
      return true;
    },
  };
  const runtime = new HumanoidDamageSegmentRuntime({
    actor,
    adapter,
    loadedGlbRoot: gltf.scene,
    damageManifest,
    physicsWorld: physics,
    hostScene,
  });
  return {
    gltf,
    physics,
    hostScene,
    presentationRoot,
    actor,
    adapter,
    runtime,
    dispose() {
      runtime.dispose();
      physics.dispose();
    },
  };
}

function requestDetachment(runtime, segmentId) {
  const side = segmentId === 'left_elbow' ? -1 : 1;
  return runtime.requestDetachment({
    segmentId,
    cause: 'manifest-runtime-test',
    impulse: segmentId === 'head_neck'
      ? new THREE.Vector3(0.35, 1.05, 0.3)
      : new THREE.Vector3(0.22 * side, -0.08, 0.18),
    angularImpulse: new THREE.Vector3(0.18, 0.32 * side, -0.24),
  });
}

function stageRecords() {
  const [site] = damageManifest.deformations.progressiveDamageSites;
  return site.stageOrder.map((stageName) => {
    const stage = site.stages.find((entry) => entry.stage === stageName);
    return { site, stageName, stage, anchor: site.severityAnchors[stageName.toLowerCase()] };
  });
}

function expectedGoreNames(keyName, role) {
  return damageManifest.deformations.generatedGoreMeshes
    .filter((entry) => entry.deformationKey === keyName && (entry.ownershipRole ?? entry.attachedDetachedRole) === role)
    .map((entry) => entry.nodeName)
    .sort();
}

test('Forge bundle identity, GLB structure, and validation report agree', async () => {
  const json = parseGlbJson(readFileSync(glbUrl));
  const gltf = await loadDamageGltf();
  assert.equal(damageManifest.schema, 'dreadstone.damage_authoring.v1');
  assert.equal(damageManifest.glb, 'dreadguard_damage_v001.glb');
  assert.equal(validationReport.status, 'PASS');
  assert.deepEqual(validationReport.errors, []);
  assert.deepEqual(validationReport.warnings, []);
  assert.equal(validationReport.deformation.status, 'PASS');
  assert.equal(validationReport.deformation.progressiveDamageSites.status, 'PASS');
  assert.equal(validationReport.deformation.progressiveDamageSites.siteCount, 1);
  assert.equal(json.skins.length, 1);
  assert.ok(json.nodes.length >= 50);
  assert.ok(json.meshes.length >= 27);
  assert.ok(json.materials.length >= 18);
  assert.ok(json.images.length >= 18);
  assert.equal(gltf.animations.length, 1, 'the bundle contains one non-authoritative embedded walk clip');
  assert.deepEqual(DREADGUARD_DAMAGE_COMBAT_PROFILE.damageExpectedAnimationNames, []);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.authoredForwardAxis, '+Y');
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.rootYaw, Math.PI, 'the +Y-authored Dreadguard is rotated into runtime forward instead of gliding backward');
  assert.doesNotThrow(() => validateDamageAsset({
    manifest: damageManifest,
    root: gltf.scene,
    profile: DREADGUARD_DAMAGE_COMBAT_PROFILE,
    clips: gltf.animations,
    animationManifest: null,
  }));
});

test('manifest validation fails clearly for a missing required node or morph target', async () => {
  const gltf = await loadDamageGltf();
  const attachedHead = gltf.scene.getObjectByName(damageManifest.intact.attachedSegments[0]);
  const originalName = attachedHead.name;
  attachedHead.name = `${originalName}_MISSING`;
  assert.throws(
    () => validateDamageAsset({ manifest: damageManifest, root: gltf.scene, profile: DREADGUARD_DAMAGE_COMBAT_PROFILE, clips: gltf.animations }),
    /missing manifest objects: DSB_ATTACHED_HEAD/,
  );
  attachedHead.name = originalName;

  const morphName = stageRecords()[0].stage.deformationKeyName;
  const morphIndex = attachedHead.morphTargetDictionary[morphName];
  delete attachedHead.morphTargetDictionary[morphName];
  assert.throws(
    () => new HumanoidDamageSegmentRuntime({
      actor: {},
      adapter: { profile: DREADGUARD_DAMAGE_COMBAT_PROFILE, loadedClips: gltf.animations, animationManifest: null },
      loadedGlbRoot: gltf.scene,
      damageManifest,
      physicsWorld: {},
      hostScene: new THREE.Scene(),
    }),
    new RegExp(`missing morph ${morphName}`),
  );
  attachedHead.morphTargetDictionary[morphName] = morphIndex;
});

test('intact startup visibility and all active segment relationships come from the manifest', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const diagnostics = fixture.runtime.getDiagnostics();
    assert.deepEqual(new Set(Object.keys(diagnostics.perSegment)), new Set(DREADGUARD_DAMAGE_COMBAT_PROFILE.activeDamageSegmentIds));
    assert.equal(fixture.gltf.scene.getObjectByName(damageManifest.intact.bodyCore).visible, true);
    damageManifest.intact.attachedSegments.forEach((name) => assert.equal(fixture.gltf.scene.getObjectByName(name).visible, true));
    for (const segmentId of DREADGUARD_DAMAGE_COMBAT_PROFILE.activeDamageSegmentIds) {
      const record = damageManifest.segments.find((segment) => segment.segmentId === segmentId);
      const state = diagnostics.perSegment[segmentId];
      assert.equal(state.attachedVisible, true);
      assert.equal(state.proximalStumpVisible, false);
      assert.equal(state.detachedVisible, false);
      assert.equal(state.distalStumpVisible, false);
      assert.equal(fixture.gltf.scene.getObjectByName(record.distalStump).parent, fixture.gltf.scene.getObjectByName(record.detachedObject));
      assert.equal(fixture.gltf.scene.getObjectByName(record.bone).isBone, true);
    }
    assert.deepEqual(diagnostics.deformation.visibleGoreNodes, []);
    Object.values(diagnostics.deformation.morphWeights).forEach((weights) => {
      assert.equal(weights.attached, 0);
      assert.equal(weights.detached, 0);
    });
  } finally {
    fixture.dispose();
  }
});

test('Forge gore surfaces preserve authored wetness and render above the deformed host surface', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const light = stageRecords()[0];
    const goreNames = expectedGoreNames(light.stage.deformationKeyName, 'ATTACHED');
    const meshes = [];
    goreNames.forEach((name) => fixture.gltf.scene.getObjectByName(name).traverse((object) => {
      if (object.isMesh) meshes.push(object);
    }));
    assert.ok(meshes.length > 0);
    assert.equal(fixture.runtime.getDiagnostics().deformation.gorePresentationMeshCount > 0, true);
    fixture.runtime.setProgressiveDamageStage(light.site.siteId, 'LIGHT', { source: 'gore-material-diagnostics-test' });
    const visibleMaterialDiagnostics = fixture.runtime.getDiagnostics().deformation.visibleGoreMaterials;
    assert.ok(visibleMaterialDiagnostics.length > 0);
    assert.ok(visibleMaterialDiagnostics.some((material) => material.roughness < 0.9));
    assert.ok(visibleMaterialDiagnostics.every((material) => material.polygonOffset && material.renderOrder >= FORGE_GORE_RENDER_ORDER));
    meshes.forEach((mesh) => {
      assert.equal(isForgeGoreSurfaceObject(mesh), true);
      assert.equal(mesh.frustumCulled, false);
      assert.ok(mesh.renderOrder >= FORGE_GORE_RENDER_ORDER);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const authoredRoughness = material.roughness;
        prepareHumanoidCombatMaterial(mesh, material);
        assert.equal(material.roughness, authoredRoughness, 'runtime tuning must not flatten Forge wet/clotted material response');
        assert.equal(material.polygonOffset, true);
        assert.equal(material.polygonOffsetFactor, -1);
        assert.equal(material.polygonOffsetUnits, -4);
      });
    });
  } finally {
    fixture.dispose();
  }
});

test('Light, Medium, and Heavy preserve the exact exported stage/key mapping', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const records = stageRecords();
    assert.deepEqual(records.map(({ stageName, stage }) => [stageName, stage.deformationKeyName]), [
      ['LIGHT', 'Left_Head_Impact_v003'],
      ['MEDIUM', 'Left_Head_Impact_v002'],
      ['HEAVY', 'Left_Head_Impact_v001'],
    ]);
    for (const { site, stageName, stage, anchor } of records) {
      const result = fixture.runtime.setProgressiveDamageStage(site.siteId, stageName, { source: 'stage-contract-test' });
      const diagnostics = fixture.runtime.getDiagnostics().deformation;
      const siteDiagnostics = diagnostics.progressiveSites[site.siteId];
      assert.equal(result.applied, true);
      assert.equal(result.stage, stageName);
      assert.equal(result.selectedMorph, stage.deformationKeyName);
      assert.equal(result.severity, anchor);
      assert.equal(result.terminalStage, 'HEAVY');
      assert.equal(result.terminalStageReached, stageName === 'HEAVY');
      assert.equal(siteDiagnostics.currentStage, stageName);
      assert.equal(siteDiagnostics.goreStage, stageName);
      assert.equal(siteDiagnostics.stageKeyMapping[stageName], stage.deformationKeyName);
      assert.equal(diagnostics.morphWeights[stage.deformationKeyName].attached, 1);
      records.filter((entry) => entry.stageName !== stageName).forEach((entry) => {
        assert.equal(diagnostics.morphWeights[entry.stage.deformationKeyName].attached, 0);
      });
      assert.deepEqual(diagnostics.visibleGoreNodes.sort(), expectedGoreNames(stage.deformationKeyName, 'ATTACHED'));
    }
  } finally {
    fixture.dispose();
  }
});

test('adjacent smoothstep crossfade uses at most two stage morphs and midpoint-replaces gore', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const [light, medium] = stageRecords();
    const severity = light.anchor + (medium.anchor - light.anchor) * 0.75;
    const result = fixture.runtime.deformationRuntime.setProgressiveSiteSeverity(light.site.siteId, severity, { source: 'crossfade-test' });
    const diagnostics = fixture.runtime.getDiagnostics().deformation;
    const weights = diagnostics.progressiveSites[light.site.siteId].stageWeights;
    const nonzero = Object.entries(weights).filter(([, value]) => value > 1e-8);
    assert.equal(result.applied, true);
    assert.equal(nonzero.length, 2);
    assert.ok(Math.abs(Object.values(weights).reduce((sum, value) => sum + value, 0) - 1) < 1e-8);
    assert.ok(weights.LIGHT > 0 && weights.MEDIUM > weights.LIGHT);
    assert.equal(weights.HEAVY, 0);
    assert.equal(diagnostics.progressiveSites[light.site.siteId].goreStage, 'MEDIUM');
    assert.deepEqual(diagnostics.visibleGoreNodes.sort(), expectedGoreNames(medium.stage.deformationKeyName, 'ATTACHED'));
  } finally {
    fixture.dispose();
  }
});

test('left-head mace hits advance Light to Heavy while opposite-side hits do not guess a site', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const request = {
      hit: { regionId: 'head', collisionPointWorld: new THREE.Vector3(-0.05, 1.45, 0) },
      impact: {
        primitive: 'mace_head',
        classification: BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt,
        worldPoint: new THREE.Vector3(-0.05, 1.45, 0),
        impactDirection: new THREE.Vector3(1, 0, 0),
      },
    };
    const glancing = fixture.runtime.applyForgeMaceDamage({
      ...request,
      impact: { ...request.impact, classification: BLUNT_IMPACT_CLASSIFICATIONS.glancingBlunt },
    });
    assert.equal(glancing.applied, false);
    assert.equal(glancing.reason, 'insufficient-progressive-impact');
    assert.equal(fixture.runtime.getDiagnostics().deformation.progressiveSites.damage_site.currentStage, null);
    const light = fixture.runtime.applyForgeMaceDamage(request);
    const medium = fixture.runtime.applyForgeMaceDamage(request);
    const heavy = fixture.runtime.applyForgeMaceDamage(request);
    assert.equal(light.stage, 'LIGHT');
    assert.equal(light.terminalStageReached, false);
    assert.equal(medium.stage, 'MEDIUM');
    assert.equal(medium.terminalStageReached, false);
    assert.equal(heavy.stage, 'HEAVY');
    assert.equal(heavy.terminalStageReached, true);
    assert.equal(fixture.runtime.applyForgeMaceDamage(request).reason, 'site-at-heavy');
    fixture.runtime.resetForgeDamage();
    const opposite = fixture.runtime.applyForgeMaceDamage({
      hit: { regionId: 'head', collisionPointWorld: new THREE.Vector3(0.05, 1.45, 0) },
      impact: {
        primitive: 'mace_head',
        classification: BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt,
        worldPoint: new THREE.Vector3(0.05, 1.45, 0),
        impactDirection: new THREE.Vector3(-1, 0, 0),
      },
    });
    assert.equal(opposite.applied, false);
    assert.equal(opposite.reason, 'unmanaged-hit');
  } finally {
    fixture.dispose();
  }
});

test('active progressive damage transfers to detached head ownership without stacking stages', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const heavy = stageRecords()[2];
    fixture.runtime.setProgressiveDamageStage(heavy.site.siteId, 'HEAVY', { source: 'detachment-transfer-test' });
    const result = requestDetachment(fixture.runtime, 'head_neck');
    const diagnostics = fixture.runtime.getDiagnostics();
    assert.equal(result.accepted, true);
    assert.equal(diagnostics.attachedHeadVisible, false);
    assert.equal(diagnostics.detachedHeadVisible, true);
    assert.equal(diagnostics.torsoStumpVisible, true);
    assert.equal(diagnostics.detachedHeadStumpVisible, true);
    assert.equal(diagnostics.deformation.morphWeights[heavy.stage.deformationKeyName].detached, 1);
    assert.deepEqual(diagnostics.deformation.visibleGoreNodes.sort(), expectedGoreNames(heavy.stage.deformationKeyName, 'DETACHED'));
    assert.equal(diagnostics.deformation.headOwnershipOverlap, false);
    assert.equal(diagnostics.detachedRigidBodyCount, 1);
    assert.equal(diagnostics.detachedColliderCount, 1);
    assert.ok(['convex_hull', 'ball-fallback'].includes(diagnostics.colliderTypeUsed));
  } finally {
    fixture.dispose();
  }
});

test('head and forearm detachment remain independent, physical, single-shot, and resettable', async () => {
  const fixture = await createRuntimeFixture({ livingVelocity: new THREE.Vector3(0.25, 0, 0.1) });
  try {
    for (const segmentId of ['left_elbow', 'right_elbow', 'head_neck']) {
      const first = requestDetachment(fixture.runtime, segmentId);
      const duplicate = requestDetachment(fixture.runtime, segmentId);
      assert.equal(first.accepted, true);
      assert.equal(duplicate.accepted, false);
      assert.equal(duplicate.reason, 'already-detached');
    }
    let diagnostics = fixture.runtime.getDiagnostics();
    assert.deepEqual(new Set(diagnostics.detachedSegments), new Set(['left_elbow', 'right_elbow', 'head_neck']));
    assert.equal(diagnostics.detachedRigidBodyCount, 3);
    assert.equal(diagnostics.detachedColliderCount, 3);
    assert.deepEqual(new Set(diagnostics.disabledProxyBodyIds), new Set(['left_forearm', 'left_hand', 'right_forearm', 'right_hand']));
    fixture.physics.stepSingle();
    fixture.runtime.updateAfterPhysics();
    Object.values(fixture.runtime.getDiagnostics().perSegment).forEach((segment) => {
      assert.ok(segment.position.every(Number.isFinite));
      assert.ok(segment.quaternion.every(Number.isFinite));
    });

    fixture.runtime.reset();
    diagnostics = fixture.runtime.getDiagnostics();
    assert.deepEqual(diagnostics.detachedSegments, []);
    assert.equal(diagnostics.detachedRigidBodyCount, 0);
    assert.equal(diagnostics.detachedColliderCount, 0);
    assert.deepEqual(diagnostics.disabledProxyBodyIds, []);
    assert.equal(fixture.physics.world.bodies.len(), 0);
    assert.equal(fixture.physics.world.colliders.len(), 0);
    assert.equal(requestDetachment(fixture.runtime, 'head_neck').accepted, true);
  } finally {
    fixture.dispose();
  }
});

test('runtime configuration is Dreadguard, no-animation safe, and free of site-name hard-coding', () => {
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.assetPath, './assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb');
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.animationAuthoritative, false);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.restPoseAuthoritative, true);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.authoredDeathAnimations, false);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.ignoreEmbeddedAnimations, true);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.noAnimationFallback, 'exported_rest_pose');
  assert.deepEqual(DREADGUARD_DAMAGE_COMBAT_PROFILE.activeDamageSegmentIds, ['head_neck', 'left_elbow', 'right_elbow']);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.activeDamageSegmentIds.includes('lower_spine'), false);

  const deformationSource = readFileSync(new URL('../src/game/combat/ForgeDamageDeformationRuntime.js', import.meta.url), 'utf8');
  assert.doesNotMatch(deformationSource, /['"]damage_site['"]|Left_Head_Impact_v00[123]/);
  const folsomSource = readFileSync(new URL('../src/game/combat/FolsomCombatEncounter.js', import.meta.url), 'utf8');
  assert.match(folsomSource, /this\.modelProfile = DREADGUARD_DAMAGE_COMBAT_PROFILE/);
  assert.match(folsomSource, /__DSB_DREADGUARD_DAMAGE__/);
  assert.match(folsomSource, /Light: \(\) => this\.debugSetProgressiveDamageStage\('LIGHT'\)/);
  assert.match(folsomSource, /Medium: \(\) => this\.debugSetProgressiveDamageStage\('MEDIUM'\)/);
  assert.match(folsomSource, /Heavy: \(\) => this\.debugSetProgressiveDamageStage\('HEAVY'\)/);
  assert.match(folsomSource, /solidHeadImpact: \(\) => this\.debugApplySolidHeadImpact\(\)/);
  assert.match(folsomSource, /captureCenterLocal/);
  assert.match(folsomSource, /characterDiagnostics: \(\) => this\.actor\?\.getDiagnostics/);
});

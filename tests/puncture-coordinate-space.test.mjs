import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CollisionWorld } from '../src/game/Collision.js';
import { CombatLabScene } from '../src/game/combat/CombatLabScene.js';
import { CombatDirector } from '../src/game/combat/CombatDirector.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../src/game/combat/CombatPhysicsWorld.js';
import {
  actorLocalDirectionToWorld,
  actorLocalToWorld,
  createPunctureCoordinateSnapshot,
  physicsBodyLocalToWorld,
  skinnedMeshLocalToWorld,
  worldDirectionToActorLocal,
  worldToActorLocal,
  worldToPhysicsBodyLocal,
  worldToSkinnedMeshLocal,
} from '../src/game/combat/CombatCoordinateSpaces.js';
import { KNIFE_COMBAT_CONFIG } from '../src/game/combat/CombatConfig.js';
import {
  KNIFE_PUNCTURE_SURFACE_BINDING_OPTIONS,
  SWORD_THRUST_SURFACE_BINDING_OPTIONS,
  resolvePunctureSurfaceBindingOptions,
} from '../src/game/combat/CombatWoundSystem.js';
import { FolsomCombatEncounter } from '../src/game/combat/FolsomCombatEncounter.js';
import { HumanoidCombatActor } from '../src/game/combat/HumanoidCombatActor.js';
import { HumanoidGlbVisualAdapter, measureVisibleSkinnedBounds } from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import { TESTMAN_COMBAT_PROFILE, TESTMAN_DAMAGE_COMBAT_PROFILE, getHumanoidProfileScale } from '../src/game/combat/HumanoidModelProfiles.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';
import { MeleeIntentWeapon } from '../src/game/combat/MeleeIntentWeapon.js';
import { buildSkinnedTriangleInfluenceMetadata, validateSurfaceBinding } from '../src/game/combat/SkinnedSurfaceBinding.js';
import { DREADSTONE_SWORD_DIMENSIONS, SWORD_MAXIMUM_PENETRATION_DEPTH, SwordWorldWeaponController } from '../src/game/combat/weapons/SwordWorldWeaponController.js';

installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(
  new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url),
  'utf8',
)));

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
};
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const TESTMAN_POSE_SECONDS = 0.31;
const FOLSOM_STYLE_POSITION = new THREE.Vector3(8, 0.16, -4);
const FOLSOM_STYLE_YAW = THREE.MathUtils.degToRad(67.2);
let testmanAssetPromise = null;
let canonicalChestPuncturePromise = null;

function loadTestmanAsset() {
  testmanAssetPromise ??= (async () => {
    const bytes = readFileSync(new URL('../public/assets/enemies/testman/testman_animpack_v002.glb', import.meta.url));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return new GLTFLoader().parseAsync(buffer, new URL('../public/assets/enemies/testman/', import.meta.url).href);
  })();
  return testmanAssetPromise;
}

async function createTestmanPose(position, yaw) {
  const asset = await loadTestmanAsset();
  const modelScene = clone(asset.scene);
  const mixer = new THREE.AnimationMixer(modelScene);
  const walk = asset.animations.find((clip) => /Walk/.test(clip.name));
  mixer.clipAction(walk).play();
  mixer.setTime(TESTMAN_POSE_SECONDS);
  modelScene.updateMatrixWorld(true);
  modelScene.scale.setScalar(getHumanoidProfileScale(TESTMAN_COMBAT_PROFILE));
  const scaledBounds = measureVisibleSkinnedBounds(modelScene);
  modelScene.position.y = TESTMAN_COMBAT_PROFILE.groundClearance - scaledBounds.min.y;

  const presentationRoot = new THREE.Group();
  presentationRoot.name = 'deterministic-testman-presentation-root';
  presentationRoot.position.copy(position);
  presentationRoot.rotation.y = yaw;
  presentationRoot.add(modelScene);
  presentationRoot.updateMatrixWorld(true);

  const bones = new Map();
  const skinnedMeshes = [];
  const skeletons = [];
  modelScene.traverse((object) => {
    if (object.isBone) bones.set(object.name, object);
    if (!object.isSkinnedMesh) return;
    skinnedMeshes.push(object);
    if (!skeletons.includes(object.skeleton)) skeletons.push(object.skeleton);
  });
  skeletons.forEach((skeleton) => skeleton.update());
  const surfaceBindingMetadata = new Map(skinnedMeshes.map((mesh) => [
    mesh,
    buildSkinnedTriangleInfluenceMetadata(mesh, { boneMap: TESTMAN_COMBAT_PROFILE.boneMap }),
  ]));
  const adapter = Object.create(HumanoidGlbVisualAdapter.prototype);
  Object.assign(adapter, {
    profile: TESTMAN_COMBAT_PROFILE,
    scene: modelScene,
    presentationRoot,
    skinnedMeshes,
    skeletons,
    surfaceBindingMetadata,
    bones,
    dispose() {},
    reset() {},
  });

  return {
    asset,
    modelScene,
    presentationRoot,
    mixer,
    bones,
    skinnedMeshes,
    skeletons,
    surfaceBindingMetadata,
    adapter,
    advanceHurt(fraction = 0.5) {
      const hurt = asset.animations.find((clip) => /Hurt_LEFT/.test(clip.name));
      mixer.stopAllAction();
      mixer.clipAction(hurt).reset().play();
      mixer.setTime(hurt.duration * fraction);
      adapter.prepareVisibleSurfaceFrame();
      return hurt;
    },
  };
}

function getProxyPose(fixture, bodyId) {
  return HumanoidGlbVisualAdapter.prototype.getProxyPose.call({
    profile: TESTMAN_COMBAT_PROFILE,
    bones: fixture.bones,
  }, bodyId);
}

async function getCanonicalChestPuncture() {
  canonicalChestPuncturePromise ??= (async () => {
    const fixture = await createTestmanPose(new THREE.Vector3(), 0);
    const bodyId = 'upper_chest';
    const proxyPose = getProxyPose(fixture, bodyId);
    const outward = new THREE.Vector3(0, 0, 1).applyQuaternion(proxyPose.quaternion).normalize();
    const probe = proxyPose.position.clone().addScaledVector(outward, TESTMAN_COMBAT_PROFILE.proxyFit[bodyId].halfExtents[2]);
    const binding = fixture.adapter.bindVisibleSurface(probe, {
      bodyId,
      regionId: bodyId,
      referenceNormal: outward,
      ...KNIFE_PUNCTURE_SURFACE_BINDING_OPTIONS,
    });
    assert.ok(validateSurfaceBinding(binding), 'canonical Testman chest probe reaches visible skin');
    const reconstructed = fixture.adapter.reconstructVisibleSurface(binding);
    return {
      actorLocalPoint: worldToActorLocal(fixture.presentationRoot, reconstructed.point),
      actorLocalNormal: worldDirectionToActorLocal(fixture.presentationRoot, reconstructed.normal),
    };
  })();
  return canonicalChestPuncturePromise;
}

async function createRuntimeCase({ position, yaw }) {
  await initializeCombatPhysics();
  const canonical = await getCanonicalChestPuncture();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const spawnOffset = new THREE.Vector3(position.x, position.y, position.z + 3.55);
  const actor = new HumanoidCombatActor({
    physics,
    scene,
    spawnOffset,
    spawnYaw: yaw,
    visualProfile: TESTMAN_COMBAT_PROFILE,
  });
  const fixture = await createTestmanPose(position, yaw);
  scene.add(fixture.presentationRoot);
  actor.visualAdapter = fixture.adapter;

  const bodyId = 'upper_chest';
  const proxyPose = getProxyPose(fixture, bodyId);
  const body = actor.bodies.get(bodyId).body;
  body.setTranslation(proxyPose.position, true);
  body.setRotation(proxyPose.quaternion, true);
  physics.world.propagateModifiedBodyPositionsToColliders();

  const collisionEntryWorld = actorLocalToWorld(fixture.presentationRoot, canonical.actorLocalPoint);
  const collisionNormalWorld = actorLocalDirectionToWorld(fixture.presentationRoot, canonical.actorLocalNormal);
  const hit = actor.resolveHit(actor.colliders.get(bodyId), collisionEntryWorld);
  const collisionEntryBodyLocal = hit.localPoint.clone();

  // Reproduce director delay: the live proxy advances after collision, while the
  // physical collision point and collision-time body transform stay immutable.
  const rootYaw = fixture.presentationRoot.getWorldQuaternion(new THREE.Quaternion());
  const staleTranslation = new THREE.Vector3(0.19, 0.04, -0.07).applyQuaternion(rootYaw);
  body.setTranslation(proxyPose.position.clone().add(staleTranslation), true);
  const staleRotation = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.31)
    .multiply(proxyPose.quaternion)
    .normalize();
  body.setRotation(staleRotation, true);
  physics.world.propagateModifiedBodyPositionsToColliders();

  return {
    canonical,
    physics,
    scene,
    actor,
    fixture,
    body,
    hit,
    collisionEntryWorld,
    collisionNormalWorld,
    collisionEntryBodyLocal,
    createKnifePuncture() {
      return actor.beginPunctureWound({
        hit,
        entryPoint: collisionEntryWorld,
        direction: collisionNormalWorld.clone().negate(),
        surfaceNormal: collisionNormalWorld,
        entryTangent: actorLocalDirectionToWorld(fixture.presentationRoot, new THREE.Vector3(1, 0, 0)),
        depth: 0.034,
        impactSeverity: 0.62,
        weaponProfile: KNIFE_COMBAT_CONFIG,
      });
    },
    dispose() {
      actor.dispose();
      physics.dispose();
    },
  };
}

function triangleSemantic(fixture, binding) {
  return fixture.surfaceBindingMetadata.get(binding.mesh)?.triangles?.[binding.triangleIndex]?.dominantSemanticId ?? null;
}

function traceCase(runtime, wound) {
  const reconstructed = runtime.fixture.adapter.reconstructVisibleSurface(wound.surfaceBinding);
  return {
    reconstructed,
    snapshot: createPunctureCoordinateSnapshot({
      collisionEntryWorld: runtime.collisionEntryWorld,
      collisionEntryBodyLocal: runtime.collisionEntryBodyLocal,
      collisionNormalWorld: runtime.collisionNormalWorld,
      bodyTransformAtCollision: runtime.hit.bodyTransformAtCollision,
      presentationRoot: runtime.fixture.presentationRoot,
      binding: wound.surfaceBinding,
      reconstructed,
    }),
  };
}

test('origin and translated/yawed Testman punctures bind the same actor-local visible surface', async (t) => {
  const lab = await createRuntimeCase({ position: new THREE.Vector3(), yaw: 0 });
  const folsom = await createRuntimeCase({ position: FOLSOM_STYLE_POSITION, yaw: FOLSOM_STYLE_YAW });
  try {
    const labWound = lab.createKnifePuncture();
    const folsomWound = folsom.createKnifePuncture();
    assert.ok(validateSurfaceBinding(labWound.surfaceBinding));
    assert.ok(validateSurfaceBinding(folsomWound.surfaceBinding));
    assert.equal(labWound.surfaceBindingLocked, true);
    assert.equal(folsomWound.surfaceBindingLocked, true);
    assert.equal(labWound.visualSlot.puncture.visible, true);
    assert.equal(folsomWound.visualSlot.puncture.visible, true);

    const labTrace = traceCase(lab, labWound);
    const folsomTrace = traceCase(folsom, folsomWound);
    assert.equal(labWound.surfaceBinding.meshName, folsomWound.surfaceBinding.meshName);
    assert.equal(labWound.surfaceBinding.triangleIndex, folsomWound.surfaceBinding.triangleIndex);
    assert.deepEqual(labWound.surfaceBinding.triangleIndices, folsomWound.surfaceBinding.triangleIndices);
    assert.ok(labWound.surfaceBinding.barycentric.distanceTo(folsomWound.surfaceBinding.barycentric) < 2e-5);
    assert.equal(triangleSemantic(lab.fixture, labWound.surfaceBinding), triangleSemantic(folsom.fixture, folsomWound.surfaceBinding));
    assert.equal(labWound.regionId, 'upper_chest');
    assert.equal(folsomWound.regionId, 'upper_chest');

    const labActorLocal = worldToActorLocal(lab.fixture.presentationRoot, labTrace.reconstructed.point);
    const folsomActorLocal = worldToActorLocal(folsom.fixture.presentationRoot, folsomTrace.reconstructed.point);
    assert.ok(labActorLocal.distanceTo(folsomActorLocal) < 1e-6);
    assert.ok(labActorLocal.distanceTo(lab.canonical.actorLocalPoint) < 0.006);
    assert.ok(folsomActorLocal.distanceTo(folsom.canonical.actorLocalPoint) < 0.006);
    t.diagnostic(`Lab body-local entry ${lab.collisionEntryBodyLocal.toArray().map((value) => value.toFixed(6)).join(', ')}`);
    t.diagnostic(`Folsom body-local entry ${folsom.collisionEntryBodyLocal.toArray().map((value) => value.toFixed(6)).join(', ')}`);
    assert.ok(lab.collisionEntryBodyLocal.toArray().every(Number.isFinite));
    assert.ok(folsom.collisionEntryBodyLocal.toArray().every(Number.isFinite));
    assert.ok(lab.collisionEntryBodyLocal.distanceTo(folsom.collisionEntryBodyLocal) < 1e-6);

    const labDecalNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(labWound.visualSlot.puncture.quaternion);
    const folsomDecalNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(folsomWound.visualSlot.puncture.quaternion);
    assert.ok(labDecalNormal.dot(labTrace.reconstructed.normal) > 0.999999);
    assert.ok(folsomDecalNormal.dot(folsomTrace.reconstructed.normal) > 0.999999);
    assert.ok(worldDirectionToActorLocal(lab.fixture.presentationRoot, labDecalNormal)
      .dot(worldDirectionToActorLocal(folsom.fixture.presentationRoot, folsomDecalNormal)) > 0.999999);

    assert.ok(labWound.surfaceBinding.sourcePoint.distanceTo(lab.collisionEntryWorld) < 1e-9);
    assert.ok(folsomWound.surfaceBinding.sourcePoint.distanceTo(folsom.collisionEntryWorld) < 1e-9);
    const meshLocal = worldToSkinnedMeshLocal(folsomWound.surfaceBinding.mesh, folsom.collisionEntryWorld);
    assert.ok(skinnedMeshLocalToWorld(folsomWound.surfaceBinding.mesh, meshLocal).distanceTo(folsom.collisionEntryWorld) < 1e-8);
    assert.ok(physicsBodyLocalToWorld(folsom.hit.bodyTransformAtCollision, folsom.collisionEntryBodyLocal).distanceTo(folsom.collisionEntryWorld) < 1e-8);
    assert.ok(worldToPhysicsBodyLocal(folsom.hit.bodyTransformAtCollision, folsom.collisionEntryWorld).distanceTo(folsom.collisionEntryBodyLocal) < 1e-8);

    for (const snapshot of [labTrace.snapshot, folsomTrace.snapshot]) {
      assert.ok(snapshot.collisionEntryWorld);
      assert.ok(snapshot.collisionEntryBodyLocal);
      assert.ok(snapshot.presentationRoot?.matrixWorld);
      assert.ok(snapshot.skinnedMesh?.matrixWorld);
      assert.ok(snapshot.surfaceBindingSourceWorld);
      assert.ok(snapshot.triangleIndices);
      assert.ok(snapshot.barycentric);
      assert.ok(snapshot.reconstructedWorld);
      assert.ok(snapshot.reconstructedActorLocal);
    }
    const maximumError = Math.max(labTrace.snapshot.anchorErrorMeters, folsomTrace.snapshot.anchorErrorMeters);
    assert.ok(maximumError < 0.006);
    t.diagnostic(`maximum puncture-anchor error ${maximumError.toExponential(9)} m`);
  } finally {
    lab.dispose();
    folsom.dispose();
  }
});

test('locked puncture triangle and barycentrics remain attached after hurt animation advances', async () => {
  const runtime = await createRuntimeCase({ position: FOLSOM_STYLE_POSITION, yaw: FOLSOM_STYLE_YAW });
  try {
    const wound = runtime.createKnifePuncture();
    const binding = wound.surfaceBinding;
    const indices = [...binding.triangleIndices];
    const barycentric = binding.barycentric.clone();
    const before = runtime.fixture.adapter.reconstructVisibleSurface(binding).point.clone();
    runtime.fixture.advanceHurt(0.55);
    runtime.actor.woundSystem.update(1 / 60);
    const after = runtime.fixture.adapter.reconstructVisibleSurface(binding);
    assert.ok(after, 'hurt pose still reconstructs the locked surface binding');
    assert.equal(wound.surfaceBinding, binding);
    assert.deepEqual(binding.triangleIndices, indices);
    assert.ok(binding.barycentric.distanceTo(barycentric) < 1e-12);
    assert.ok(after.point.distanceTo(before) > 0.001);
    assert.equal(wound.visualSlot.puncture.visible, true);
    assert.equal(wound.surfaceBindingStatus, 'skinned_triangle');
  } finally {
    runtime.dispose();
  }
});

test('Combat Lab damage Testman and Folsom Testman share puncture binding function and options', async () => {
  const lab = await CombatLabScene.create({ query: new URLSearchParams('walker=0') });
  const collision = new CollisionWorld({
    walkableRects: [{ minX: -18, maxX: 22, minZ: -20, maxZ: 18 }],
    blockerRects: [],
    defaultFloorY: 0.16,
    outdoorTerrainSampler: { sampleOutdoorY: () => 0.16 },
    sourceLocationId: 'folsom',
  });
  const dungeon = { scene: new THREE.Scene(), collision, isPositionInFishingWater: () => false };
  const folsom = await FolsomCombatEncounter.create({ dungeon, query: new URLSearchParams('folsomWalker=0&folsomShowcase=0') });
  try {
    assert.equal(lab.actor.visualProfile, TESTMAN_DAMAGE_COMBAT_PROFILE);
    assert.equal(folsom.actor.visualProfile, TESTMAN_DAMAGE_COMBAT_PROFILE);
    assert.equal(lab.actor.woundSystem.bindPunctureSurface, folsom.actor.woundSystem.bindPunctureSurface);
    assert.equal(lab.actor.woundSystem.getPunctureSurfaceBindingOptions({ weaponFamily: 'knife' }), KNIFE_PUNCTURE_SURFACE_BINDING_OPTIONS);
    assert.equal(folsom.actor.woundSystem.getPunctureSurfaceBindingOptions({ weaponFamily: 'knife' }), KNIFE_PUNCTURE_SURFACE_BINDING_OPTIONS);
    assert.equal(resolvePunctureSurfaceBindingOptions({ weaponFamily: 'sword' }), SWORD_THRUST_SURFACE_BINDING_OPTIONS);
  } finally {
    lab.dispose();
    folsom.dispose();
  }
});

test('invalid punctures stay hidden and every slash surface visual remains retired', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene });
  try {
    const bodyId = 'upper_chest';
    const body = actor.bodies.get(bodyId).body;
    const point = physicsBodyLocalToWorld(body, new THREE.Vector3(0, 0, 0.1));
    const hit = actor.resolveHit(actor.colliders.get(bodyId), point);
    const normal = new THREE.Vector3(0, 0, 1);
    const puncture = actor.beginPunctureWound({ hit, entryPoint: point, direction: normal.clone().negate(), surfaceNormal: normal, depth: 0.02 });
    assert.equal(puncture.surfaceBinding, null);
    assert.equal(puncture.surfaceBindingStatus, 'puncture_hidden_invalid_surface');
    assert.equal(puncture.visualSlot.puncture.visible, false);

    const slashPoint = point.clone().add(new THREE.Vector3(0.12, 0.03, 0));
    const slash = actor.applySlashWound({
      hit,
      startPoint: point,
      endPoint: slashPoint,
      surfaceNormal: normal,
      cutDirection: slashPoint.clone().sub(point).normalize(),
      depth: 0.026,
      cutLength: point.distanceTo(slashPoint),
      severity: 0.62,
      classification: 'deep_slash',
    });
    assert.equal(slash.visualSlot.puncture.visible, false);
    assert.equal(slash.visualSlot.slash.visible, false);
    assert.equal(slash.visualSlot.slash.geometry.drawRange.count, 0);
    assert.equal(slash.surfaceVisualStatus, 'retired_no_persistent_slash');

    const swordCut = actor.beginSwordCutWound({
      hit,
      point,
      surfaceNormal: normal,
      direction: new THREE.Vector3(1, 0, 0),
      sample: { travel: 0.08, depth: 0.02, severity: 0.7, edgeAlignment: 0.9, swingSpeed: 1.3 },
      edgeDamage: { schema: 'test', startedAt: 0 },
    });
    assert.equal(swordCut.swordVisualSlot.ribbon.visible, false);
    assert.equal(swordCut.swordVisualSlot.ribbon.geometry.drawRange.count, 0);
    assert.equal(swordCut.surfaceVisualStatus, 'retired_no_persistent_slash');
    assert.ok(actor.woundSystem.visualSlots.every((slot) => !slot.slash.visible));
    assert.ok(actor.woundSystem.swordVisualSlots.every((slot) => !slot.ribbon.visible));
  } finally {
    actor.dispose();
    physics.dispose();
  }
});

test('sword thrust punctures use the same transform-invariant world-space binding path', async () => {
  const runtime = await createRuntimeCase({ position: FOLSOM_STYLE_POSITION, yaw: FOLSOM_STYLE_YAW });
  const director = new CombatDirector({ actor: runtime.actor });
  try {
    const weapon = {
      id: 'dreadstone_sword',
      family: 'sword',
      bladeLength: DREADSTONE_SWORD_DIMENSIONS.bladeLength,
      bladeWidth: DREADSTONE_SWORD_DIMENSIONS.bladeWidth,
      bladeThickness: DREADSTONE_SWORD_DIMENSIONS.bladeThickness,
      maximumPenetrationDepth: SWORD_MAXIMUM_PENETRATION_DEPTH,
    };
    const intent = new MeleeIntentWeapon({ weaponId: weapon.id }).interpret({
      ownerId: 41,
      controlState: 'attacking',
      localVelocity: new THREE.Vector3(0, 0, -1.2),
    });
    const interaction = director.beginSwordPuncture({
      weapon,
      intent,
      hit: runtime.hit,
      entryPoint: runtime.collisionEntryWorld,
      surfaceNormal: runtime.collisionNormalWorld,
      direction: runtime.collisionNormalWorld.clone().negate(),
      contactDirection: runtime.collisionNormalWorld.clone().negate(),
      depth: 0.04,
      force: 1.2,
    });
    director.update(0.4);
    runtime.actor.woundSystem.update(1 / 60);
    const wound = interaction.result.wound;
    assert.ok(wound);
    assert.equal(wound.interactionKind, 'sword_thrust');
    assert.equal(wound.weaponFamily, 'sword');
    assert.equal(wound.surfaceBinding.sourcePoint.distanceTo(runtime.collisionEntryWorld) < 1e-9, true);
    assert.equal(wound.surfaceBindingLocked, true);
    assert.equal(validateSurfaceBinding(wound.surfaceBinding), true);
    assert.equal(wound.visualSlot.puncture.visible, true);
    assert.equal(runtime.actor.woundSystem.getPunctureSurfaceBindingOptions(wound), SWORD_THRUST_SURFACE_BINDING_OPTIONS);
  } finally {
    director.dispose();
    runtime.dispose();
  }
});

test('deliberate sword tip contact creates the wound at knife-style surface entry before presentation', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene });
  const camera = new THREE.PerspectiveCamera(70, 390 / 702, 0.1, 100);
  camera.position.set(0, 1.81, -2.3);
  camera.updateMatrixWorld(true);
  const viewport = { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 702 }) };
  const equipment = { getEquippedWeaponProfile: () => ({ id: 'dreadstone_sword' }), hasItem: () => true };
  const sword = new SwordWorldWeaponController({
    app: viewport,
    scene,
    camera,
    actor,
    physics,
    equipmentRuntime: equipment,
    bindPointerInput: false,
    contactActivationProvider: () => true,
    visualAssetLoader: async () => new THREE.Group(),
  });
  try {
    await sword.visualLoadPromise;
    sword.acquireGrip(42, 280, 470, 0);
    let contactStep = 0;
    for (let step = 1; step <= 18 && actor.woundSystem.wounds.length === 0; step += 1) {
      contactStep = step;
      sword.applyGripGesture(42, 0, -step * 5, 280, 470 - step * 5, step * 16);
      physics.stepSingle(
        (dt) => { sword.beforePhysics(dt); actor.beforePhysics(dt); },
        (dt) => sword.afterPhysicsStep(dt),
      );
    }
    const wound = actor.woundSystem.wounds[0];
    assert.equal(sword.lastContactPart, 'tip');
    assert.equal(sword.contactState, 'surface_contact', 'the first accepted contact establishes the same shallow puncture used by the knife');
    const entryDepth = sword.penetrationDepth;
    assert.equal(sword.punctureBeginCount, 1);
    assert.equal(sword.edgeDamageCount, 0);
    assert.ok(wound, 'tip contact created a wound before any presentation decision');
    assert.equal(wound.interactionKind, 'sword_thrust');
    assert.equal(wound.surfaceBindingStatus, 'puncture_hidden_invalid_surface', 'headless actor has no visible surface, so display fails after creation');
    assert.equal(wound.visualSlot.puncture.visible, false);

    for (let step = contactStep + 1; step <= contactStep + 6; step += 1) {
      sword.applyGripGesture(42, 0, -step * 5, 280, 470 - step * 5, step * 16);
      physics.stepSingle(
        (dt) => { sword.beforePhysics(dt); actor.beforePhysics(dt); },
        (dt) => sword.afterPhysicsStep(dt),
      );
    }
    assert.equal(sword.contactState, 'embedded', 'continued thumb travel deepens the accepted puncture through the knife penetration solver');
    assert.ok(sword.penetrationDepth > entryDepth, 'penetration advances after entry instead of using a sword-only collision-frame shortcut');
  } finally {
    sword.dispose();
    actor.dispose();
    physics.dispose();
  }
});

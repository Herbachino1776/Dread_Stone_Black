import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateForgeDamageDeformationAsset } from '../src/game/combat/ForgeDamageDeformationRuntime.js';
import {
  ProgressiveDamageSiteTargeting,
  PROGRESSIVE_SITE_RADIUS_TOLERANCE_METERS,
} from '../src/game/combat/ProgressiveDamageSiteTargeting.js';
import {
  findClosestSkinnedSurface,
  reconstructSkinnedSurface,
  reconstructSurfaceBindingNeighborhood,
  validateSurfaceBinding,
} from '../src/game/combat/SkinnedSurfaceBinding.js';
import {
  createEmbeddedAnimationPackManifest,
  resolveAnimationPackManifest,
} from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import {
  composeHumanoidCreatureRuntimeProfile,
} from '../src/game/creatures/CreatureRuntimePolicies.js';
import {
  DREAD_RAM_GOD_CREATURE_DEFINITION,
  DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES,
} from '../src/game/creatures/CreatureDefinitionRegistry.js';

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
};
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const glbUrl = new URL('../public/assets/enemies/dread_ram_god/damage/Dread_Ram_God.glb', import.meta.url);
const manifestUrl = new URL('../public/assets/enemies/dread_ram_god/damage/Dread_Ram_God.json', import.meta.url);
const validationUrl = new URL('../public/assets/enemies/dread_ram_god/damage/Dread_Ram_God_validation.json', import.meta.url);
const descriptorUrl = new URL('../public/generated/creature-packs/dread_ram_god_damage_v001.json', import.meta.url);

let assetPromise = null;
async function loadAsset() {
  assetPromise ??= (async () => {
    const bytes = readFileSync(glbUrl);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), glbUrl.href);
    const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
    const validation = JSON.parse(readFileSync(validationUrl, 'utf8'));
    const descriptor = JSON.parse(readFileSync(descriptorUrl, 'utf8'));
    gltf.scene.visible = true;
    gltf.scene.updateMatrixWorld(true);
    return { gltf, manifest, validation, descriptor };
  })();
  return assetPromise;
}

function createSurfaceAdapter(root) {
  const skinnedMeshes = [];
  const skeletons = [];
  root.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    skinnedMeshes.push(object);
    if (object.skeleton && !skeletons.includes(object.skeleton)) skeletons.push(object.skeleton);
  });
  const prepareVisibleSurfaceFrame = () => {
    root.updateMatrixWorld(true);
    skinnedMeshes.forEach((mesh) => mesh.updateMatrixWorld(true));
    skeletons.forEach((skeleton) => skeleton.update());
  };
  return {
    prepareVisibleSurfaceFrame,
    bindVisibleSurface(worldPoint, options = {}) {
      prepareVisibleSurfaceFrame();
      return findClosestSkinnedSurface(options.targetMeshes ?? skinnedMeshes, worldPoint, options);
    },
    reconstructVisibleSurface(binding, target, { refresh = true } = {}) {
      if (!validateSurfaceBinding(binding)) return null;
      if (refresh) prepareVisibleSurfaceFrame();
      return reconstructSkinnedSurface(binding, target);
    },
    reconstructVisibleSurfaceNeighborhood(binding, target, { refresh = true } = {}) {
      if (refresh) prepareVisibleSurfaceFrame();
      return reconstructSurfaceBindingNeighborhood(binding, target);
    },
    worldToActorLocal(point, target) { return root.worldToLocal(target.copy(point)); },
  };
}

function siteImpactRegion(record) {
  return /face|head|skull/i.test(`${record.displayName} ${record.siteId}`) ? 'head' : 'upper_chest';
}

function strikePoint(record, probe) {
  const outward = new THREE.Vector3(Math.sign(record.currentWorldCenter.x) || 1, 0, 0);
  const distance = probe === 'edge'
    ? record.radiusWorld * 0.96
    : probe === 'outside'
      ? record.radiusWorld + PROGRESSIVE_SITE_RADIUS_TOLERANCE_METERS + Math.max(0.012, record.radiusWorld * 0.15)
      : 0;
  return record.currentWorldCenter.clone().addScaledVector(outward, distance);
}

test('Dread Ram God Forge report, GLB skeleton, sites, and embedded animation inventory agree', async () => {
  const { gltf, manifest, validation, descriptor } = await loadAsset();
  assert.equal(validation.status, 'PASS');
  assert.deepEqual(validation.errors, []);
  assert.equal(manifest.validation.status, 'PASS');
  assert.deepEqual(manifest.validation, validation);
  assert.equal(manifest.glb, 'Dread_Ram_God.glb');
  assert.equal(descriptor.presentation.skeletonFamilyId, 'DSB_HUMANOID_V1');
  assert.equal(manifest.runtimeSkeleton.armature, 'DSB_DAMAGE_RIG');
  assert.equal(manifest.runtimeSkeleton.skeletonCount, 1);
  assert.deepEqual(descriptor.presentation.runtimeSkeleton, {
    schema: 'dreadstone.runtime_skeleton.v1',
    armature: 'DSB_DAMAGE_RIG',
    skeletonCount: 1,
    skinCount: 1,
    requiredBoneCount: 21,
  });
  const skeletons = new Set();
  gltf.scene.traverse((object) => { if (object.isSkinnedMesh && object.skeleton) skeletons.add(object.skeleton); });
  assert.equal(skeletons.size, 1);
  assert.ok(gltf.scene.getObjectByName('DSB_DAMAGE_RIG'));
  assert.equal(manifest.deformations.progressiveDamageSites.length, 4);
  assert.equal(descriptor.cost.deformationKeyCount, 12);
  assert.equal(manifest.deformations.surfaceStainMeshes.length, 12);
  assert.equal(manifest.deformations.generatedGoreMeshes.length, 15);
  assert.deepEqual(gltf.animations.map((clip) => clip.name).sort(), [...DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES].sort(), 'no source-only animations may survive the production export');
  assert.ok(gltf.animations.every((clip) => clip.userData?.dsb_approved === true && clip.userData?.dsb_draft === false));
});

test('all four native sites bind to animated skin and remain independently selectable through every approved pose', async () => {
  const { gltf, manifest, descriptor } = await loadAsset();
  const profile = composeHumanoidCreatureRuntimeProfile(descriptor, DREAD_RAM_GOD_CREATURE_DEFINITION);
  const deformation = validateForgeDamageDeformationAsset({
    manifest,
    root: gltf.scene,
    progressiveDamageSiteFallbacks: profile.progressiveDamageSiteFallbacks,
  });
  assert.equal(deformation.progressiveSites.size, 4);
  assert.ok([...deformation.progressiveSites.values()].every((site) => site.authority === 'NATIVE'));
  const targeting = new ProgressiveDamageSiteTargeting({
    sites: deformation.progressiveSites.values(),
    adapter: createSurfaceAdapter(gltf.scene),
    root: gltf.scene,
  });
  const initialRecords = targeting.listRecords({ refresh: true });
  assert.equal(initialRecords.length, 4);
  assert.ok(initialRecords.every((record) => record.bindingMode === 'SKINNED_SURFACE'));
  assert.ok(initialRecords.every((record) => Number.isFinite(record.radius) && record.radius > 0));
  assert.equal(new Set(initialRecords.map((record) => record.siteId)).size, 4);
  assert.equal(new Set(initialRecords.map((record) => record.captureCenterLocal.join(','))).size, 4);

  const animationManifest = createEmbeddedAnimationPackManifest(gltf.animations, profile);
  const animationPack = resolveAnimationPackManifest(animationManifest, gltf.animations, profile.name, {
    allowedKinds: profile.animationRuntimeKinds,
    requireEmbeddedApprovalMetadata: true,
  });
  assert.deepEqual([...animationPack.entriesByName.keys()].sort(), [...DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES].sort());
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const positionsBySite = new Map(initialRecords.map((record) => [record.siteId, []]));
  for (const animationName of DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES) {
    const clip = animationPack.clipsByName.get(animationName);
    assert.ok(clip, `${animationName} must be available`);
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).reset().play();
    mixer.update(Math.min(0.45, Math.max(0.08, clip.duration * 0.45)));
    for (const record of targeting.listRecords({ refresh: true })) {
      assert.equal(record.bindingMode, 'SKINNED_SURFACE', `${record.siteId} must stay skin-bound during ${animationName}`);
      assert.notEqual(record.reconstructionMode, 'STATIC_RECONSTRUCTION_FALLBACK');
      positionsBySite.get(record.siteId).push(record.currentWorldCenter.clone());
      const center = targeting.select({
        impactRegion: siteImpactRegion(record),
        impactWorld: strikePoint(record, 'center'),
        impactDirection: record.currentWorldPreferredDirection,
        source: 'animated-real-asset-test',
      });
      assert.equal(center.record?.siteId, record.siteId, `${animationName} center hit must select ${record.siteId}`);
    }
    action.stop();
  }
  for (const [siteId, positions] of positionsBySite) {
    assert.ok(positions.some((point, index) => index > 0 && point.distanceTo(positions[0]) > 0.001), `${siteId} must follow at least one animated pose`);
  }

  mixer.stopAllAction();
  for (const record of targeting.listRecords({ refresh: true })) {
    const impactRegion = siteImpactRegion(record);
    const direction = record.currentWorldPreferredDirection;
    const edge = targeting.select({ impactRegion, impactWorld: strikePoint(record, 'edge'), impactDirection: direction, source: 'edge-real-asset-test' });
    assert.equal(edge.record?.siteId, record.siteId, `edge hit must select ${record.siteId}`);
    const outside = targeting.select({ impactRegion, impactWorld: strikePoint(record, 'outside'), impactDirection: direction, source: 'outside-real-asset-test' });
    assert.equal(outside.record, null, `outside hit must not route to ${record.siteId} or a same-side neighbor`);
  }
  targeting.dispose();
});

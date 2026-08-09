import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  ProgressiveDamageSiteTargeting,
} from '../src/game/combat/ProgressiveDamageSiteTargeting.js';
import {
  findClosestSkinnedSurface,
  reconstructSkinnedSurface,
  reconstructSurfaceBindingNeighborhood,
  validateSurfaceBinding,
} from '../src/game/combat/SkinnedSurfaceBinding.js';
import { validateForgeDamageDeformationAsset } from '../src/game/combat/ForgeDamageDeformationRuntime.js';
import {
  CHEZWICK_DAMAGE_COMBAT_PROFILE,
  DREADGUARD_DAMAGE_COMBAT_PROFILE,
} from '../src/game/combat/HumanoidModelProfiles.js';
import { createEmbeddedAnimationPackManifest, resolveAnimationPackManifest } from '../src/game/combat/HumanoidGlbVisualAdapter.js';

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

async function loadAsset(glbUrl, manifestUrl) {
  const bytes = readFileSync(glbUrl);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  gltf.scene.visible = true;
  gltf.scene.updateMatrixWorld(true);
  return { gltf, manifest };
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

function createTargeting(gltf, manifest, profile) {
  const validation = validateForgeDamageDeformationAsset({
    manifest,
    root: gltf.scene,
    progressiveDamageSiteFallbacks: profile.progressiveDamageSiteFallbacks,
  });
  const targeting = new ProgressiveDamageSiteTargeting({
    sites: validation.progressiveSites.values(),
    adapter: createSurfaceAdapter(gltf.scene),
    root: gltf.scene,
  });
  return { validation, targeting };
}

function centerStrike(targeting, siteId, region = 'head') {
  const record = targeting.getRecord(siteId, { refresh: true });
  return targeting.select({
    impactRegion: region,
    impactWorld: record.currentWorldCenter.clone(),
    impactDirection: record.currentWorldPreferredDirection?.clone() ?? new THREE.Vector3(0, 0, 1),
    source: 'asset-test',
  });
}

test('Chezwick native-right and compatibility-left targets bind and resolve in real GLB space', async () => {
  const { gltf, manifest } = await loadAsset(
    new URL('../public/assets/enemies/chezwick/damage/chezwick_v001.glb', import.meta.url),
    new URL('../public/assets/enemies/chezwick/damage/chezwick_v001.json', import.meta.url),
  );
  const { targeting } = createTargeting(gltf, manifest, CHEZWICK_DAMAGE_COMBAT_PROFILE);
  const records = targeting.listRecords();
  assert.deepEqual(records.map((record) => [record.siteId, record.authority, record.bindingMode]), [
    ['damage_site_face_right', 'NATIVE', 'SKINNED_SURFACE'],
    ['damage_site_face_left_compatibility', 'COMPATIBILITY', 'SKINNED_SURFACE'],
  ]);
  assert.equal(centerStrike(targeting, 'damage_site_face_right').record.siteId, 'damage_site_face_right');
  assert.equal(centerStrike(targeting, 'damage_site_face_left_compatibility').record.siteId, 'damage_site_face_left_compatibility');
  const outside = targeting.select({ impactRegion: 'head', impactWorld: new THREE.Vector3(0, 0.5, 0.5), impactDirection: new THREE.Vector3(0, 0, 1) });
  assert.equal(outside.record, null);
  assert.equal(outside.decision.rejectionReason, 'no-site-inside-authored-radius');
  targeting.dispose();
});

test('Dreadguard compatibility head target binds and native site count remains zero', async () => {
  const { gltf, manifest } = await loadAsset(
    new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb', import.meta.url),
    new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.json', import.meta.url),
  );
  const { validation, targeting } = createTargeting(gltf, manifest, DREADGUARD_DAMAGE_COMBAT_PROFILE);
  assert.equal(manifest.deformations.progressiveDamageSites.length, 0);
  assert.equal([...validation.progressiveSites.values()].filter((site) => site.authority === 'NATIVE').length, 0);
  const record = targeting.getRecord('damage_site');
  assert.equal(record.authority, 'COMPATIBILITY');
  assert.equal(record.bindingMode, 'SKINNED_SURFACE');
  assert.equal(centerStrike(targeting, 'damage_site').record.siteId, 'damage_site');
  targeting.dispose();
});

test('Chezwick target centers follow idle, walk, hurt, and guard animation poses', async () => {
  const { gltf, manifest } = await loadAsset(
    new URL('../public/assets/enemies/chezwick/damage/chezwick_v001.glb', import.meta.url),
    new URL('../public/assets/enemies/chezwick/damage/chezwick_v001.json', import.meta.url),
  );
  const { targeting } = createTargeting(gltf, manifest, CHEZWICK_DAMAGE_COMBAT_PROFILE);
  const animationManifest = createEmbeddedAnimationPackManifest(gltf.animations, CHEZWICK_DAMAGE_COMBAT_PROFILE);
  const pack = resolveAnimationPackManifest(animationManifest, gltf.animations, CHEZWICK_DAMAGE_COMBAT_PROFILE.name, {
    allowedKinds: CHEZWICK_DAMAGE_COMBAT_PROFILE.animationRuntimeKinds,
    requireEmbeddedApprovalMetadata: true,
  });
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const kinds = ['IDLE', 'WALK', 'HURT_LEFT', 'MACE_GUARD_RIGHT_ARM'];
  const positions = [];
  for (const kind of kinds) {
    const entry = pack.entriesByKind.get(kind)?.[0];
    const clip = pack.clipsByName.get(entry?.name);
    assert.ok(clip, `${kind} clip should be available`);
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).reset().play();
    mixer.update(Math.min(0.35, Math.max(0.05, clip.duration * 0.4)));
    const record = targeting.getRecord('damage_site_face_right', { refresh: true });
    positions.push(record.currentWorldCenter.clone());
    assert.equal(record.bindingMode, 'SKINNED_SURFACE');
    assert.equal(centerStrike(targeting, record.siteId).record.siteId, record.siteId, `${kind} center strike should resolve without resetting pose`);
    action.stop();
  }
  assert.ok(positions.some((point, index) => index > 0 && point.distanceTo(positions[0]) > 0.001), 'at least one authored pose must move the reconstructed target');
  mixer.stopAllAction();
  targeting.dispose();
});

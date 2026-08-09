import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CollisionWorld } from '../src/game/Collision.js';
import { FolsomCombatEncounter, FOLSOM_WALKER_CONFIG } from '../src/game/combat/FolsomCombatEncounter.js';
import { CHEZWICK_DAMAGE_COMBAT_PROFILE } from '../src/game/combat/HumanoidModelProfiles.js';
import { createEmbeddedAnimationPackManifest, measureVisibleSkinnedBounds, resolveAnimationPackManifest } from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import { validateDamageAsset } from '../src/game/combat/HumanoidDamageSegmentRuntime.js';
import { ForgeDamageDeformationRuntime, validateForgeDamageDeformationAsset } from '../src/game/combat/ForgeDamageDeformationRuntime.js';
import { BLUNT_IMPACT_CLASSIFICATIONS } from '../src/game/combat/weapons/BluntImpactInteraction.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });
installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8')));

async function loadChezwick() {
  const bytes = readFileSync(new URL('../public/assets/enemies/chezwick/damage/chezwick_v001.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/enemies/chezwick/damage/chezwick_v001.json', import.meta.url), 'utf8'));
  return { gltf, manifest };
}

test('Chezwick bundle resolves its approved embedded roles and exact 1.5 m scale', async () => {
  const { gltf, manifest } = await loadChezwick();
  const animationManifest = createEmbeddedAnimationPackManifest(gltf.animations, CHEZWICK_DAMAGE_COMBAT_PROFILE);
  const pack = resolveAnimationPackManifest(animationManifest, gltf.animations, CHEZWICK_DAMAGE_COMBAT_PROFILE.name, {
    allowedKinds: CHEZWICK_DAMAGE_COMBAT_PROFILE.animationRuntimeKinds,
    requireEmbeddedApprovalMetadata: true,
  });
  validateDamageAsset({ manifest, root: gltf.scene, profile: CHEZWICK_DAMAGE_COMBAT_PROFILE, clips: gltf.animations, animationManifest });
  assert.ok(Math.abs(measureVisibleSkinnedBounds(gltf.scene).getSize(new THREE.Vector3()).y - 1.5) < 0.00001);
  assert.deepEqual([...pack.entriesByKind.keys()], ['DEATH', 'HURT_LEFT', 'HURT_RIGHT', 'IDLE', 'MACE_GUARD_RIGHT_ARM', 'WALK']);
});

test('Chezwick ships authoritative right and exact-artifact left progressive sites', async () => {
  const { gltf, manifest } = await loadChezwick();
  const validation = validateForgeDamageDeformationAsset({
    manifest,
    root: gltf.scene,
    progressiveDamageSiteFallbacks: CHEZWICK_DAMAGE_COMBAT_PROFILE.progressiveDamageSiteFallbacks,
  });
  assert.equal(validation.progressiveSiteSource, 'manifest+profile-compatibility');
  assert.deepEqual([...validation.progressiveSites.keys()], ['damage_site_face_right', 'damage_site_face_left_compatibility']);
  assert.deepEqual(validation.progressiveSites.get('damage_site_face_left_compatibility').stageRecords.map((stage) => stage.keyRecord.name), [
    'Body_Core_Damage_Left_v003', 'Body_Core_Damage_Left_v002', 'Body_Core_Damage_Left_v001',
  ]);
  assert.deepEqual(validation.progressiveSites.get('damage_site_face_right').stageRecords.map((stage) => stage.keyRecord.name), [
    'Body_Core_Damage_Right_v003', 'Body_Core_Damage_Right_v002', 'Body_Core_Damage_Right_v001',
  ]);
});

test('Chezwick left and right counters independently resolve 1-2 Light, 3-4 Medium, and 5+ Heavy', async () => {
  const { gltf, manifest } = await loadChezwick();
  const adapter = {
    profile: CHEZWICK_DAMAGE_COMBAT_PROFILE,
    worldToActorLocal: (point, target) => target.copy(point),
    worldDirectionToActorLocal: (direction, target) => target.copy(direction).normalize(),
  };
  const runtime = new ForgeDamageDeformationRuntime({
    adapter, root: gltf.scene, manifest,
    progressiveDamageSiteFallbacks: CHEZWICK_DAMAGE_COMBAT_PROFILE.progressiveDamageSiteFallbacks,
    progressiveDamageHitsPerStage: 2,
  });
  const strike = (side, index) => runtime.applyMaceHit({
    hit: { regionId: 'head' },
    impact: {
      interactionId: `${side}-${index}`, primitive: 'mace_head',
      classification: BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt,
      // Forge centers are Blender Z-up; runtime target records convert them to
      // glTF Y-up before performing the 3D/radius selection.
      worldPoint: side === 'left'
        ? new THREE.Vector3(-0.042, 1.381, -0.055)
        : new THREE.Vector3(0.035, 1.387, -0.061),
      impactDirection: side === 'left'
        ? new THREE.Vector3(0.844, 0.087, 0.529)
        : new THREE.Vector3(1, 0, 0),
    },
  });
  assert.equal(strike('left', 1).stage, 'LIGHT');
  assert.equal(strike('left', 2).stage, 'LIGHT');
  assert.equal(strike('left', 3).stage, 'MEDIUM');
  assert.equal(strike('right', 1).stage, 'LIGHT');
  assert.equal(strike('right', 2).stage, 'LIGHT');
  assert.equal(strike('left', 4).stage, 'MEDIUM');
  assert.equal(strike('left', 5).stage, 'HEAVY');
  assert.equal(strike('right', 3).stage, 'MEDIUM');
  const diagnostics = runtime.getDiagnostics();
  assert.equal(diagnostics.progressiveSites.damage_site_face_left_compatibility.acceptedHitCount, 5);
  assert.equal(diagnostics.progressiveSites.damage_site_face_right.acceptedHitCount, 3);
  assert.equal(diagnostics.progressiveTargeting.lastPhysicalTargetingDecision.selectedSiteId, 'damage_site_face_right');
  assert.equal(diagnostics.progressiveTargeting.lastPhysicalTargetingDecision.stage, 'MEDIUM');
  assert.ok(diagnostics.progressiveTargeting.lastPhysicalTargetingDecision.selectedDistance < 0.01);
  assert.ok(diagnostics.visibleSurfaceStainNodes.some((name) => name.includes('Left_v001')));
  assert.ok(diagnostics.visibleSurfaceStainNodes.some((name) => name.includes('Right_v002')));
  runtime.dispose();
});

test('Folsom owns four independently respawning Chezwick roaming slots', async () => {
  const scene = new THREE.Scene();
  const collision = new CollisionWorld({ walkableRects: [{ minX: -18, maxX: 22, minZ: -20, maxZ: 18 }], blockerRects: [], defaultFloorY: 0.16 });
  const player = { position: new THREE.Vector3(-2, 1.71, -4), yaw: 0 };
  const encounter = await FolsomCombatEncounter.create({ dungeon: { scene, collision, isPositionInFishingWater: () => false }, player });
  const controllers = encounter.getWalkerControllers();
  assert.equal(controllers.length, 4);
  assert.equal(new Set(controllers.map((controller) => controller.actor.instanceId)).size, 4);
  assert.ok(controllers.every((controller) => controller.actor.visualProfile === CHEZWICK_DAMAGE_COMBAT_PROFILE));
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  assert.equal(FOLSOM_WALKER_CONFIG.groundedRespawnSeconds, 15);
  encounter.dispose();
});

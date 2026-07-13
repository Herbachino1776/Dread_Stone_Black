import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COMBAT_READABILITY_LIGHT_LAYER, enableCombatReadabilityLightLayer } from '../src/game/combat/CombatReadabilityLightLayer.js';
import {
  HELD_TORCH_CLOSE_COMBAT,
  HeldTorchLightingRuntime,
  resolveHeldTorchBeamSettings,
  resolveTorchSpotlightFootprint,
  shouldActivateCloseCombatTorch,
} from '../src/game/viewmodels/HeldTorchLightingRuntime.js';
import { getOutdoorLightSourceRegistry } from '../src/game/world-scene/OutdoorLightSourceRegistry.js';

function makeActor(scene, z = -2) {
  const root = new THREE.Group();
  root.name = 'test-combat-actor';
  scene.add(root);
  const positions = {
    upper_chest: new THREE.Vector3(0, 1.38, z),
    lower_chest: new THREE.Vector3(0, 1.08, z),
  };
  return {
    id: 'actor-test',
    root,
    lifeState: 'alive',
    disposed: false,
    getBodyWorldPosition(id, target = new THREE.Vector3()) { return target.copy(positions[id] ?? positions.upper_chest); },
    setZ(nextZ) { positions.upper_chest.z = nextZ; positions.lower_chest.z = nextZ; },
    setX(nextX) { positions.upper_chest.x = nextX; positions.lower_chest.x = nextX; },
  };
}

function makeRig({ z = -2, darkness = 1 } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 9 / 16, 0.05, 100);
  camera.position.set(0, 1.58, 0);
  scene.add(camera);
  const actor = makeActor(scene, z);
  let lookups = 0;
  let darknessLevel = darkness;
  const registry = getOutdoorLightSourceRegistry(scene);
  const rig = new HeldTorchLightingRuntime({
    camera,
    lightRegistry: registry,
    actorProvider: () => { lookups += 1; return actor; },
    darknessProvider: () => darknessLevel,
  });
  const pointLight = new THREE.PointLight(0xffc58f, 28, 8, 2);
  pointLight.userData.baseTorchIntensity = 28;
  camera.add(pointLight);
  const flame = new THREE.Vector3(-0.45, 1.36, -1.36);
  const advance = (frames = 1, active = true) => {
    for (let index = 0; index < frames; index += 1) rig.update(1 / 60, { torchActive: active, flameWorldPosition: flame, pointLight, flicker: 1 });
    return rig.debugState;
  };
  return { scene, camera, actor, rig, registry, pointLight, advance, getLookups: () => lookups, setDarkness: (value) => { darknessLevel = value; } };
}

test('close-combat activation requires a lit torch, dark presentation, nearby actor, and forward facing', () => {
  const base = { darkness: 1, actorRelevant: true, distance: 2, facingDot: 0.9 };
  assert.equal(shouldActivateCloseCombatTorch({ ...base, torchActive: false }), false);
  assert.equal(shouldActivateCloseCombatTorch({ ...base, torchActive: true, darkness: 0.3 }), false);
  assert.equal(shouldActivateCloseCombatTorch({ ...base, torchActive: true, distance: 4 }), false);
  assert.equal(shouldActivateCloseCombatTorch({ ...base, torchActive: true, facingDot: -0.2 }), false);
  assert.equal(shouldActivateCloseCombatTorch({ ...base, torchActive: true }), true);
});

test('target selection is bounded, hysteretic, torso-aimed, smooth, and safely releases disposed actors', () => {
  const context = makeRig({ z: -3.1 });
  context.advance(45);
  assert.equal(context.rig.activeActor, context.actor);
  assert.ok(context.getLookups() <= 8, 'actor provider refresh stays bounded rather than running every frame');
  assert.ok(context.rig.desiredTarget.y > 1.2 && context.rig.desiredTarget.y < 1.3, 'target uses an upper/lower chest midpoint');
  const previousTarget = context.rig.smoothedTarget.clone();
  context.actor.setX(0.35);
  context.advance(1);
  assert.ok(context.rig.smoothedTarget.x > previousTarget.x && context.rig.smoothedTarget.x < context.rig.desiredTarget.x, 'torso target moves without snapping');
  context.actor.setX(0);
  context.actor.setZ(-3.52);
  context.advance(10);
  assert.equal(context.rig.activeActor, context.actor, 'exit hysteresis holds beyond the enter distance');
  context.actor.setZ(-3.9);
  context.advance(10);
  assert.equal(context.rig.activeActor, null);
  context.actor.setZ(-2);
  context.advance(10);
  assert.equal(context.rig.activeActor, context.actor);
  context.actor.disposed = true;
  context.advance(1);
  assert.equal(context.rig.activeActor, null);
  assert.equal(context.rig.closeRequested, false);
  context.rig.dispose();
});

test('beam broadens toward melee range while key and flame-point intensity remain bounded at point blank', () => {
  const samples = [0.4, 0.7, 1, 1.5, 2.5].map((distance) => resolveHeldTorchBeamSettings(distance, 1, { distance }));
  for (let index = 1; index < samples.length; index += 1) assert.ok(samples[index - 1].angle > samples[index].angle);
  assert.ok(samples.every((sample) => sample.angle > 0 && sample.angle < Math.PI / 2));
  assert.ok(samples[0].keyIntensity < samples.at(-1).keyIntensity);
  assert.ok(samples[0].pointMultiplier < samples.at(-1).pointMultiplier);
  assert.ok(samples[0].fillIntensity <= HELD_TORCH_CLOSE_COMBAT.fill.maximumIntensity);
  assert.ok(samples.every((sample) => Math.abs(sample.footprintRadius - resolveTorchSpotlightFootprint(sample.distance, sample.angle)) < 1e-12));
});

test('beam transitions smoothly and restores exploration settings after target loss', () => {
  const context = makeRig({ z: -1 });
  let previousAngle = context.rig.keyLight.angle;
  let maximumJump = 0;
  for (let index = 0; index < 90; index += 1) {
    context.advance(1);
    maximumJump = Math.max(maximumJump, Math.abs(context.rig.keyLight.angle - previousAngle));
    previousAngle = context.rig.keyLight.angle;
  }
  assert.equal(context.rig.mode, 'close-combat');
  assert.ok(maximumJump < THREE.MathUtils.degToRad(3), 'angle has no frame-visible parameter jump');
  assert.ok(context.rig.keyLight.angle > HELD_TORCH_CLOSE_COMBAT.key.explorationAngle);
  context.actor.setZ(1);
  context.advance(120);
  assert.equal(context.rig.mode, 'exploration');
  assert.ok(Math.abs(context.rig.keyLight.angle - HELD_TORCH_CLOSE_COMBAT.key.explorationAngle) < 1e-4);
  assert.equal(context.rig.fillLight.intensity, 0);
  context.rig.dispose();
});

test('one registered non-shadow fill uses the readability layer without affecting terrain', () => {
  const context = makeRig({ z: -1 });
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial());
  const npc = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  const wound = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshStandardMaterial());
  enableCombatReadabilityLightLayer(npc);
  enableCombatReadabilityLightLayer(wound);
  assert.equal(context.rig.fillLight.castShadow, false);
  assert.equal(context.rig.keyLight.castShadow, true);
  assert.equal(context.rig.fillLight.layers.isEnabled(COMBAT_READABILITY_LIGHT_LAYER), true);
  assert.equal(context.rig.fillLight.layers.isEnabled(0), false);
  assert.equal(terrain.layers.isEnabled(COMBAT_READABILITY_LIGHT_LAYER), false);
  assert.equal(npc.layers.isEnabled(0) && npc.layers.isEnabled(COMBAT_READABILITY_LIGHT_LAYER), true);
  assert.equal(wound.layers.isEnabled(0) && wound.layers.isEnabled(COMBAT_READABILITY_LIGHT_LAYER), true);
  assert.equal(context.registry.getDiagnostics().filter((entry) => entry.source === 'torch-close-combat-fill').length, 1);
  context.advance(90);
  assert.ok(context.rig.fillLight.intensity > 0 && context.rig.fillLight.intensity <= HELD_TORCH_CLOSE_COMBAT.fill.maximumIntensity);
  context.advance(90, false);
  assert.equal(context.rig.fillLight.intensity, 0);
  context.rig.dispose();
  terrain.geometry.dispose(); terrain.material.dispose(); npc.geometry.dispose(); npc.material.dispose(); wound.geometry.dispose(); wound.material.dispose();
});

test('lighting updates reuse the same two lights and one shadow map through repeated combat updates', () => {
  const context = makeRig({ z: -0.7 });
  const keyUuid = context.rig.keyLight.uuid;
  const fillUuid = context.rig.fillLight.uuid;
  const registryCount = context.registry.entries.size;
  for (let index = 0; index < 600; index += 1) context.advance(1, index % 40 !== 0);
  assert.equal(context.rig.keyLight.uuid, keyUuid);
  assert.equal(context.rig.fillLight.uuid, fillUuid);
  assert.equal(context.registry.entries.size, registryCount);
  assert.equal([context.rig.keyLight, context.rig.fillLight].filter((light) => light.castShadow).length, 1);
  context.rig.dispose();
});

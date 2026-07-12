import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FINAL_DUSK_BLACKOUT_DURATION_SECONDS, OutdoorLightingDirector, resolveOutdoorLightingProfile, resolveOutdoorPresentationState, OUTDOOR_LIGHTING_PROFILES } from '../src/game/world-scene/OutdoorLightingDirector.js';
import { TORCH_LIGHTING, resolveTorchLightActive } from '../src/game/viewmodels/TorchViewmodel.js';
import { KEEPERS_LANTERN_LIGHTING, resolveKeepersLanternLightActive } from '../src/game/viewmodels/KeepersLanternViewmodel.js';
import { resolveOutdoorTorchWarning } from '../src/game/world-scene/OutdoorTorchRequirement.js';

for (const phase of [0, 0.3, 0.35, 0.39999, 0.4, 0.5, 0.8, 0.85, 0.9, 0.999]) {
  const profile = resolveOutdoorLightingProfile(phase);
  assert.ok(profile.fogNear < profile.fogFar);
  assert.ok(profile.exposure >= 0.7 && profile.exposure <= 1);
  assert.ok(profile.keyIntensity >= 0 && profile.moonIntensity >= 0);
  ['sky', 'ground', 'key', 'moon', 'fog'].forEach((key) => assert.ok(profile[key] instanceof THREE.Color));
}

const noon = resolveOutdoorPresentationState(0);
const night = resolveOutdoorPresentationState(0.5);
assert.equal(night.sunIntensity, 0);
assert.equal(night.sunCastsShadow, false);
assert.equal(night.moonCastsShadow, false);
assert.equal(night.naturalAmbientIntensity, 0);
assert.equal(night.moonIntensity, 0);
assert.equal(night.environmentIntensity, 0);
assert.equal(night.playerNaturalLightIntensity, 0);
assert.equal(night.cameraNaturalLightIntensity, 0);
assert.equal(night.fallbackExplorationLightEnabled, false);
assert.equal(night.ordinaryEmissiveScale, 0);
assert.ok(night.fogNear >= 100 && night.fogFar >= 400);
assert.ok(night.fog.getHex() <= 0x000101);
assert.ok(night.outdoorExposure <= noon.outdoorExposure);
assert.equal(resolveOutdoorPresentationState(0.4).sunIntensity, 0, 'full night sky and zero sunlight begin at the same phase');
assert.equal(FINAL_DUSK_BLACKOUT_DURATION_SECONDS, 12);
assert.equal(resolveOutdoorPresentationState(0.3899).environmentIntensity, 1, 'environment remains intact before the final dusk blackout');
const lateDuskEnvironment = resolveOutdoorPresentationState(0.395).environmentIntensity;
assert.ok(lateDuskEnvironment > 0 && lateDuskEnvironment < 1, 'environment eases down during the final dusk blackout');
assert.equal(resolveOutdoorPresentationState(0.4).environmentIntensity, 0, 'environment reaches zero exactly at full night');

const scene = new THREE.Scene();
const ordinary = new THREE.MeshStandardMaterial({ emissive: 0x332211, emissiveIntensity: 0.4 });
ordinary.userData = { ordinaryOutdoorMaterial: true };
scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ordinary));
const director = new OutdoorLightingDirector({ scene, clock: { getSnapshot: () => ({ phase: 0.5, name: 'night', progress: 0.25, dayWeight: 0, redWeight: 0, nightWeight: 1, skyRotation: 0 }) } });
director.bindSceneMaterials();
const debug = director.update();
assert.equal(director.key.intensity, 0);
assert.equal(director.key.castShadow, false);
assert.equal(director.moon.castShadow, false);
assert.equal(ordinary.emissiveIntensity, 0);
assert.equal(debug.activeShadowCasters, 0);

assert.equal(TORCH_LIGHTING.point.distance, 8);
assert.equal(TORCH_LIGHTING.point.decay, 2);
assert.equal(TORCH_LIGHTING.point.kelvin, 3200);
assert.equal(KEEPERS_LANTERN_LIGHTING.point.distance, 7);
assert.equal(KEEPERS_LANTERN_LIGHTING.point.decay, 2);
assert.equal(KEEPERS_LANTERN_LIGHTING.point.kelvin, 8000);
assert.equal(resolveTorchLightActive({ ownsTorch: true, equippedOffhandId: 'torch', lit: true }), true);
assert.equal(resolveTorchLightActive({ ownsTorch: true, equippedOffhandId: null, lit: true }), false);
assert.equal(resolveTorchLightActive({ ownsTorch: true, equippedOffhandId: 'torch', lit: false }), false);
assert.equal(resolveTorchLightActive({ ownsTorch: false, equippedOffhandId: 'torch', lit: true }), false);
assert.equal(resolveKeepersLanternLightActive({ ownsLantern: true, equippedOffhandId: 'keepers_lantern', lit: true }), true);
assert.equal(resolveKeepersLanternLightActive({ ownsLantern: true, equippedOffhandId: null, lit: true }), false);
assert.equal(resolveKeepersLanternLightActive({ ownsLantern: true, equippedOffhandId: 'keepers_lantern', lit: false }), false);
assert.equal(resolveOutdoorTorchWarning({ torchNeedLevel: 0.5, warningArmed: true, ownsTorch: true, equippedOffhandId: null }), 'Night is coming. Equip a torch in your offhand.');
assert.equal(resolveOutdoorTorchWarning({ torchNeedLevel: 0.5, warningArmed: true, ownsTorch: true, equippedOffhandId: 'keepers_lantern' }), 'Night is coming. Equip a torch in your offhand.');
assert.equal(resolveOutdoorTorchWarning({ torchNeedLevel: 0.5, warningArmed: true, ownsTorch: true, equippedOffhandId: 'torch' }), null);

const before = resolveOutdoorLightingProfile(0.39999); const after = resolveOutdoorLightingProfile(0.40001);
assert.ok(Math.hypot(before.fog.r - after.fog.r, before.fog.g - after.fog.g, before.fog.b - after.fog.b) < 0.01);
console.log('Outdoor lighting: synchronized true night, sunset shadows, black fog, emissive cutoff and torch dependency PASS');

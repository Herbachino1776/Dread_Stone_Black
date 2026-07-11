import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OutdoorLightingDirector, resolveOutdoorPresentationState } from '../src/game/world-scene/OutdoorLightingDirector.js';
import { OutdoorLightSourceRegistry, OUTDOOR_LIGHT_OWNER, sampleBoundedLight } from '../src/game/world-scene/OutdoorLightSourceRegistry.js';
import { TORCH_LIGHTING, resolveTorchLightActive } from '../src/game/viewmodels/TorchViewmodel.js';
import { KEEPERS_LANTERN_LIGHTING, resolveKeepersLanternLightActive } from '../src/game/viewmodels/KeepersLanternViewmodel.js';

const nightClock = { getSnapshot: () => ({ phase: 0.5, name: 'night', progress: 0.25, dayWeight: 0, redWeight: 0, nightWeight: 1, skyRotation: 0 }) };
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
scene.add(camera);
const registry = new OutdoorLightSourceRegistry(scene);
const materialKinds = ['terrain', 'road', 'foliage', 'water'];
const materials = materialKinds.map((kind, index) => {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x334455, emissiveIntensity: 0.2 + index * 0.1 });
  material.userData = { ordinaryOutdoorMaterial: true, materialKey: kind };
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  return material;
});
const director = new OutdoorLightingDirector({ scene, clock: nightClock });
director.bindSceneMaterials();

const naturalPlayerFallback = new THREE.PointLight(0xffffff, 1, 12, 2);
naturalPlayerFallback.name = 'legacy-player-exploration-fill';
camera.add(naturalPlayerFallback);
const hiddenCompiledAmbient = new THREE.HemisphereLight(0xffffff, 0x333333, 0.8);
hiddenCompiledAmbient.name = 'hidden-compiled-outdoor-ambient';
scene.add(hiddenCompiledAmbient);
director.update({ position: new THREE.Vector3(), camera });
const night = resolveOutdoorPresentationState(0.5);
assert.equal(night.naturalAmbientIntensity, 0);
assert.equal(night.sunIntensity, 0);
assert.equal(night.moonIntensity, 0);
assert.equal(night.environmentIntensity, 0);
assert.equal(night.outdoorExposure, 0.72);
assert.equal(naturalPlayerFallback.intensity, 0, 'anonymous camera fallback lights must be forcibly disabled at full night');
assert.equal(hiddenCompiledAmbient.intensity, 0, 'unregistered compiled/global fallback lights must be forcibly disabled at full night');
assert.equal(registry.getActivePlayerLights().length, 0, 'no-item full night must have zero player-owned lights');
materials.forEach((material, index) => assert.equal(material.emissiveIntensity, 0, `${materialKinds[index]} emissive must be zero at full night`));

const torchLight = new THREE.PointLight(TORCH_LIGHTING.point.color, TORCH_LIGHTING.point.intensity, TORCH_LIGHTING.point.distance, TORCH_LIGHTING.point.decay);
scene.add(torchLight);
registry.register(torchLight, { name: 'test-torch', owner: OUTDOOR_LIGHT_OWNER.PLAYER, source: 'torch', global: false });
assert.equal(resolveTorchLightActive({ ownsTorch: true, equippedOffhandId: 'torch', lit: true }), true);
assert.equal(registry.getActivePlayerLights().length, 1);
assert.equal(registry.getActivePlayerLights()[0].source, 'torch');
assert.ok(sampleBoundedLight(TORCH_LIGHTING.point, 2) > sampleBoundedLight(TORCH_LIGHTING.point, 5));
assert.equal(sampleBoundedLight(TORCH_LIGHTING.point, 8.01), 0);
assert.equal(director.exposure, 0.72); assert.equal(director.hemisphere.intensity, 0);
torchLight.intensity = 0;
assert.equal(resolveTorchLightActive({ ownsTorch: true, equippedOffhandId: null, lit: true }), false);
assert.equal(registry.getActivePlayerLights().length, 0);

const lanternLight = new THREE.PointLight(KEEPERS_LANTERN_LIGHTING.point.color, KEEPERS_LANTERN_LIGHTING.point.intensity, KEEPERS_LANTERN_LIGHTING.point.distance, KEEPERS_LANTERN_LIGHTING.point.decay);
scene.add(lanternLight);
registry.register(lanternLight, { name: 'test-lantern', owner: OUTDOOR_LIGHT_OWNER.PLAYER, source: 'keepers_lantern', global: false });
assert.equal(resolveKeepersLanternLightActive({ ownsLantern: true, equippedOffhandId: 'keepers_lantern', lit: true }), true);
assert.equal(registry.getActivePlayerLights().length, 1);
assert.equal(registry.getActivePlayerLights()[0].source, 'keepers_lantern');
assert.ok(sampleBoundedLight(KEEPERS_LANTERN_LIGHTING.point, 3) > sampleBoundedLight(KEEPERS_LANTERN_LIGHTING.point, 6));
assert.equal(sampleBoundedLight(KEEPERS_LANTERN_LIGHTING.point, 7.01), 0);
lanternLight.intensity = 0;
assert.equal(resolveKeepersLanternLightActive({ ownsLantern: true, equippedOffhandId: 'keepers_lantern', lit: false }), false);
assert.equal(registry.getActivePlayerLights().length, 0);
assert.equal(director.exposure, 0.72); assert.equal(director.hemisphere.intensity, 0);

const campfireA = new THREE.PointLight(0xff8833, 2, 7.5, 2);
const campfireB = new THREE.PointLight(0xff9933, 2, 7.5, 2);
scene.add(campfireA, campfireB);
registry.register(campfireA, { name: 'campfire-a', owner: OUTDOOR_LIGHT_OWNER.WORLD, source: 'campfire-a', global: false });
registry.register(campfireB, { name: 'campfire-b', owner: OUTDOOR_LIGHT_OWNER.WORLD, source: 'campfire-b', global: false });
assert.ok(sampleBoundedLight({ intensity: 4, distance: 7.5, decay: 2 }, 3) > 0);
assert.equal(sampleBoundedLight({ intensity: 4, distance: 7.5, decay: 2 }, 8), 0);
assert.equal(registry.getActiveDiagnostics().filter((entry) => entry.source.startsWith('campfire')).every((entry) => !entry.global), true);

console.log('Outdoor source lighting: no-item black baseline, bounded torch/lantern, local campfires, material cutoff and stable exposure PASS');

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldKnifeCombatController } from '../src/game/combat/WorldKnifeCombatController.js';
import { SwordWorldWeaponController } from '../src/game/combat/weapons/SwordWorldWeaponController.js';
import { WEAPON_VIEWMODEL_LAYER, WEAPON_WORLD_LAYER } from '../src/game/combat/weapons/WeaponRenderLayers.js';
import { captureWeaponMaterialLightingState } from '../src/game/combat/weapons/WeaponVisualAsset.js';
import { OutdoorLightingDirector } from '../src/game/world-scene/OutdoorLightingDirector.js';
import { OUTDOOR_LIGHT_OWNER } from '../src/game/world-scene/OutdoorLightSourceRegistry.js';
import { RendererHost } from '../src/game/hosts/RendererHost.js';

const viewport = { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 702 }) };

function createWeaponSource(name) {
  const root = new THREE.Group();
  root.name = `${name}-source`;
  const ordinary = new THREE.MeshStandardMaterial({
    color: 0x6f5949,
    roughness: 0.67,
    metalness: 0.38,
    emissive: 0x24180f,
    emissiveIntensity: 0.42,
  });
  ordinary.name = `${name}-ordinary`;
  const luminous = new THREE.MeshStandardMaterial({
    color: 0xb7d8ff,
    roughness: 0.2,
    metalness: 0.1,
    emissive: 0x88bbff,
    emissiveIntensity: 1.4,
  });
  luminous.name = `${name}-authored-luminous`;
  luminous.userData.authoredLuminousMaterial = true;
  root.add(
    new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.4), ordinary),
    new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.08), luminous),
  );
  return root;
}

function assertMaterialSurfaceEqual(before, after) {
  assert.deepEqual(after, before, 'render-layer switching cannot mutate authored material surface properties');
}

test('knife and sword overlay/world modes share outdoor lights and asynchronous ordinary-material policy', async () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 390 / 702, 0.05, 100);
  scene.add(camera);
  let phase = 0;
  const clock = { getSnapshot: () => ({ phase, skyRotation: 0 }) };
  const director = new OutdoorLightingDirector({ scene, clock });
  director.bindSceneMaterials();
  const knife = new WorldKnifeCombatController({
    app: viewport,
    scene,
    camera,
    equipmentRuntime: { getEquippedToolId: () => 'old_work_knife', hasItem: () => true },
    outdoorLightingDirector: director,
    visualAssetLoader: async () => createWeaponSource('knife'),
    bindPointerInput: false,
  });
  const sword = new SwordWorldWeaponController({
    app: viewport,
    scene,
    camera,
    equipmentRuntime: { getEquippedWeaponProfile: () => ({ id: 'dreadstone_sword' }), hasItem: () => true },
    outdoorLightingDirector: director,
    visualAssetLoader: async () => createWeaponSource('sword'),
    bindPointerInput: false,
  });
  await Promise.all([knife.visualLoadPromise, sword.visualLoadPromise]);

  try {
    const controllers = [knife, sword];
    controllers.forEach((controller) => {
      assert.equal(controller.outdoorMaterialRegistration.status, 'registered');
      assert.equal(controller.outdoorMaterialRegistration.eligibleMaterialCount, 1);
      const ordinary = (controller.materials ?? controller.visualMaterials).find((material) => !material.userData.authoredLuminousMaterial);
      const luminous = (controller.materials ?? controller.visualMaterials).find((material) => material.userData.authoredLuminousMaterial);
      assert.equal(director.ordinaryMaterialSet.has(ordinary), true, 'late-loaded ordinary GLB material is registered');
      assert.equal(director.ordinaryMaterialSet.has(luminous), false, 'authored luminous material remains excluded');
      assert.equal(ordinary.userData.baseOutdoorEmissiveIntensity, 0.42);
      assert.equal(luminous.emissiveIntensity, 1.4);
      const duplicate = director.registerOrdinaryObject(controller.visual);
      assert.equal(duplicate.newlyRegisteredMaterialCount, 0, 'repeat registration is idempotent');
    });

    const phases = [
      { name: 'noon', value: 0 },
      { name: 'dusk', value: 0.35 },
      { name: 'night', value: 0.5 },
      { name: 'dawn', value: 0.85 },
    ];
    for (const sample of phases) {
      phase = sample.value;
      const state = director.update({ position: new THREE.Vector3(), camera });
      for (const controller of controllers) {
        const ordinary = (controller.materials ?? controller.visualMaterials).find((material) => !material.userData.authoredLuminousMaterial);
        const luminous = (controller.materials ?? controller.visualMaterials).find((material) => material.userData.authoredLuminousMaterial);
        assert.ok(Math.abs(ordinary.emissiveIntensity - 0.42 * state.ordinaryEmissiveScale) < 1e-12, `${sample.name} applies the current outdoor emissive scale`);
        assert.equal(luminous.emissiveIntensity, 1.4, `${sample.name} preserves authored luminous exclusion`);
        const diagnostics = controller.getDiagnostics();
        assert.equal(diagnostics.currentRenderLayer, WEAPON_VIEWMODEL_LAYER);
        assert.equal(diagnostics.worldLightIntersectionStatus.intersects, true);
        assert.deepEqual(diagnostics.worldLightIntersectionStatus.intersectingLights.filter((name) => name.startsWith('outdoor-cycle-')), [
          'outdoor-cycle-hemisphere-light',
          'outdoor-cycle-moon-fill',
          'outdoor-cycle-primary-directional-light',
        ]);
        assert.equal(diagnostics.currentOutdoorEmissiveScale, state.ordinaryEmissiveScale);
      }
    }

    const knifeBefore = captureWeaponMaterialLightingState(knife.visual);
    knife.entry = {};
    knife.syncVisualDepthMode();
    assert.equal(knife.getDiagnostics().currentRenderLayer, WEAPON_WORLD_LAYER);
    assert.equal(knife.getDiagnostics().worldLightIntersectionStatus.intersects, true);
    assertMaterialSurfaceEqual(knifeBefore, captureWeaponMaterialLightingState(knife.visual));
    knife.entry = null;
    knife.syncVisualDepthMode();
    assertMaterialSurfaceEqual(knifeBefore, captureWeaponMaterialLightingState(knife.visual));

    const swordBefore = captureWeaponMaterialLightingState(sword.visual);
    sword.entry = {};
    sword.applyVisualLayer();
    assert.equal(sword.getDiagnostics().currentRenderLayer, WEAPON_WORLD_LAYER);
    assert.equal(sword.getDiagnostics().worldLightIntersectionStatus.intersects, true);
    assertMaterialSurfaceEqual(swordBefore, captureWeaponMaterialLightingState(sword.visual));
    sword.entry = null;
    sword.applyVisualLayer();
    assertMaterialSurfaceEqual(swordBefore, captureWeaponMaterialLightingState(sword.visual));
    assert.equal(knife.getDiagnostics().transitionLightingDiscontinuityCount, 0);
    assert.equal(sword.getDiagnostics().transitionLightingDiscontinuityCount, 0);

    const torch = new THREE.PointLight(0xffaa66, 5, 8, 2);
    torch.name = 'test-legitimate-player-torch';
    scene.add(torch);
    director.lightRegistry.register(torch, { name: torch.name, owner: OUTDOOR_LIGHT_OWNER.PLAYER, source: 'test-torch', global: false });
    assert.equal(torch.layers.isEnabled(WEAPON_VIEWMODEL_LAYER), true, 'registered nearby lights join the physical-weapon layer');
    const anonymousRodFill = new THREE.HemisphereLight(0xffe2b8, 0x60452f, 1.35);
    anonymousRodFill.name = 'rod-a1-fixed-viewmodel-fill-test';
    anonymousRodFill.layers.set(1);
    camera.add(anonymousRodFill);
    const knifeMesh = knife.visual.getObjectByProperty('isMesh', true);
    assert.equal(anonymousRodFill.layers.test(knifeMesh.layers), false, 'constant rod-only fill cannot illuminate a physical weapon');

  } finally {
    knife.entry = null;
    sword.entry = null;
    knife.dispose();
    sword.dispose();
  }
});

test('renderer isolates permanent viewmodel fills from the physical-weapon overlay pass', () => {
  const host = Object.create(RendererHost.prototype);
  const renderedMasks = [];
  let depthClearCount = 0;
  host.renderer = {
    autoClear: true,
    clearDepth() { depthClearCount += 1; },
    render(_scene, camera) { renderedMasks.push(camera.layers.mask); },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const originalMask = camera.layers.mask;
  host.renderViewmodelOverlay(scene, camera);
  assert.deepEqual(renderedMasks, [1 << 1, 1 << WEAPON_VIEWMODEL_LAYER]);
  assert.equal(depthClearCount, 2);
  assert.equal(camera.layers.mask, originalMask);
  assert.equal(host.renderer.autoClear, true);
});

test('procedural knife and sword fallbacks register ordinary materials immediately', async () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const director = new OutdoorLightingDirector({ scene, clock: { getSnapshot: () => ({ phase: 0.5, skyRotation: 0 }) } });
  director.bindSceneMaterials();
  const unavailable = async () => { throw new Error('expected test fallback'); };
  const knife = new WorldKnifeCombatController({ app: viewport, scene, camera, outdoorLightingDirector: director, visualAssetLoader: unavailable, bindPointerInput: false });
  const sword = new SwordWorldWeaponController({ app: viewport, scene, camera, outdoorLightingDirector: director, visualAssetLoader: unavailable, bindPointerInput: false });
  await Promise.all([knife.visualLoadPromise, sword.visualLoadPromise]);
  try {
    assert.equal(knife.visualAssetState, 'fallback');
    assert.equal(sword.visualAssetState, 'fallback');
    assert.equal(knife.outdoorMaterialRegistration.status, 'registered');
    assert.equal(sword.outdoorMaterialRegistration.status, 'registered');
    assert.ok(knife.materials.every((material) => director.ordinaryMaterialSet.has(material)));
    assert.ok(sword.visualMaterials.every((material) => director.ordinaryMaterialSet.has(material)));
    assert.ok([...knife.materials, ...sword.visualMaterials].every((material) => material.emissiveIntensity === 0));
  } finally {
    knife.dispose();
    sword.dispose();
  }
});

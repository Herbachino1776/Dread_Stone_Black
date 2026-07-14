import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import {
  BLOOD_CHROMA_PROGRAM_CACHE_KEY,
  BLOOD_CHROMA_RESPONSE,
  cloneBloodChromaMaterial,
  createBloodChromaMaterial,
  getBloodChromaFactoryDiagnostics,
  isBloodChromaMaterial,
  resolveBloodChromaResponse,
} from '../src/game/combat/BloodChromaMaterial.js';
import { BLOOD_COLOR_PALETTE } from '../src/game/combat/CombatStage2Config.js';
import { CombatBloodEffects } from '../src/game/combat/CombatBloodEffects.js';
import { CombatWoundSystem } from '../src/game/combat/CombatWoundSystem.js';
import { disposeKnifeWoundDecalLibrary, installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';

const manifest = JSON.parse(await readFile(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8'));

function normalizedHue(rgb) {
  const peak = Math.max(...rgb, 1e-12);
  return rgb.map((channel) => channel / peak);
}

function maximumDifference(a, b) {
  return Math.max(...a.map((value, index) => Math.abs(value - b[index])));
}

function equalLuminance(rgb, target = 1) {
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return rgb.map((channel) => channel * target / luminance);
}

test('blood materials use one stable chroma-preserving standard-material shader policy', () => {
  const material = createBloodChromaMaterial({ usage: 'test', color: BLOOD_COLOR_PALETTE.fresh, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const shader = { uniforms: {}, fragmentShader: '#include <common>\nvoid main() { vec3 totalDiffuse = vec3(0.0); vec3 totalSpecular = vec3(0.0); vec3 outgoingLight = vec3(0.0); vec4 diffuseColor = vec4(1.0); #include <opaque_fragment> }' };
  material.onBeforeCompile(shader);
  assert.equal(material.type, 'MeshStandardMaterial');
  assert.equal(isBloodChromaMaterial(material), true);
  assert.equal(material.customProgramCacheKey(), BLOOD_CHROMA_PROGRAM_CACHE_KEY);
  assert.equal(material.toneMapped, false, 'blood bypasses only global tone mapping after its bounded response');
  assert.equal(material.depthTest, true);
  assert.equal(material.blending, THREE.NormalBlending);
  assert.equal(material.emissive.getHex(), 0x000000);
  assert.equal(material.emissiveIntensity, 0);
  assert.match(shader.fragmentShader, /bloodDiffuseEnergy/);
  assert.match(shader.fragmentShader, /totalSpecular/);
  assert.match(shader.fragmentShader, /bloodMaximumBrightness/);
  assert.match(shader.fragmentShader, /#include <opaque_fragment>/);
  assert.equal(shader.uniforms.bloodMaximumBrightness.value, BLOOD_CHROMA_RESPONSE.maximumBrightness);
  assert.equal(shader.uniforms.bloodSaturationFloor.value, BLOOD_CHROMA_RESPONSE.saturationFloor);

  const clone = cloneBloodChromaMaterial(material);
  assert.notEqual(clone, material);
  assert.equal(clone.customProgramCacheKey(), material.customProgramCacheKey());
  assert.equal(clone.onBeforeCompile, material.onBeforeCompile);
  clone.dispose();
  material.dispose();
});

test('light chroma changes brightness only while blood hue stays saturated and red-dominant', () => {
  const albedo = new THREE.Color(BLOOD_COLOR_PALETTE.fresh);
  const lights = {
    neutral: [1, 1, 1],
    torchAmber: [1, 0.28, 0.055],
    combatFill: [1, 0.76, 0.62],
    moonlight: [0.34, 0.52, 1],
    daylight: [0.94, 0.98, 1],
  };
  const responses = Object.fromEntries(Object.entries(lights).map(([name, light]) => [name, resolveBloodChromaResponse({ albedo, illumination: equalLuminance(light) })]));
  const referenceHue = normalizedHue(responses.neutral.rgb);
  Object.entries(responses).forEach(([name, response]) => {
    assert.ok(maximumDifference(normalizedHue(response.rgb), referenceHue) <= 1e-12, `${name} cannot recolor normalized blood hue`);
    assert.ok(response.saturation >= BLOOD_CHROMA_RESPONSE.saturationFloor, `${name} retains the saturation floor`);
    assert.ok(response.rgb[0] > response.rgb[1] && response.rgb[0] > response.rgb[2], `${name} remains red-dominant`);
    assert.ok(response.rgb[1] < response.rgb[0] * 0.08, `${name} cannot produce orange, cream, or peach output`);
  });
});

test('zero, rising, strong, and extreme illumination follow a smooth bounded red response', () => {
  const albedo = new THREE.Color(BLOOD_COLOR_PALETTE.slashArterial);
  const energies = [0, 0.02, 0.1, 0.5, 1, 4, 100];
  const responses = energies.map((illumination) => resolveBloodChromaResponse({ albedo, illumination }));
  assert.ok(Math.max(...responses[0].rgb) <= 1e-12, 'zero light is effectively black');
  for (let index = 1; index < responses.length; index += 1) {
    assert.ok(responses[index].brightness >= responses[index - 1].brightness, 'brightness rises monotonically');
  }
  assert.ok(Math.max(...responses.at(-1).rgb) <= BLOOD_CHROMA_RESPONSE.maximumBrightness + 1e-12);
  assert.ok(responses.at(-1).rgb[0] < 1 && responses.at(-1).rgb[1] < 0.1, 'extreme light cannot clip to white or cream');
  const lowerCap = resolveBloodChromaResponse({ albedo, illumination: 100, maximumBrightness: 0.52 });
  assert.ok(maximumDifference(normalizedHue(lowerCap.rgb), normalizedHue(responses.at(-1).rgb)) <= 1e-12, 'highlight compression does not alter hue');
});

test('authored wound texture relationships and alpha survive the shader response', () => {
  const darkCenter = resolveBloodChromaResponse({ albedo: [0.09, 0.001, 0.002], alpha: 0.91, illumination: [1, 0.25, 0.04] });
  const freshEdge = resolveBloodChromaResponse({ albedo: [0.62, 0.007, 0.018], alpha: 0.37, illumination: [1, 0.25, 0.04] });
  const alternateEdge = resolveBloodChromaResponse({ albedo: [0.42, 0.018, 0.025], alpha: 0.63, illumination: [1, 0.25, 0.04] });
  assert.ok(darkCenter.brightness < freshEdge.brightness, 'dark wound interiors remain darker than fresh edges');
  assert.equal(darkCenter.alpha, 0.91);
  assert.equal(freshEdge.alpha, 0.37);
  assert.notDeepEqual(freshEdge.rgb, alternateEdge.rgb, 'authored local color variation remains present');

  const library = installKnifeWoundManifestForHeadlessTests(manifest);
  library.materialsById.forEach((material, id) => {
    assert.equal(isBloodChromaMaterial(material), true, `${id} uses the blood response`);
    assert.equal(material.color.getHex(), 0xffffff, `${id} keeps a neutral material tint`);
    assert.equal(material.alphaTest, 0.065);
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.equal(material.emissiveIntensity, 0);
    assert.equal(material.blending, THREE.NormalBlending);
    assert.equal(material.forceSinglePass, true);
  });
  assert.ok(manifest.variants.filter((variant) => variant.family === 'puncture').every((variant) => isBloodChromaMaterial(library.getMaterial(variant.id))));
  assert.ok(manifest.variants.filter((variant) => variant.family === 'slash').every((variant) => isBloodChromaMaterial(library.getMaterial(variant.id))));
  disposeKnifeWoundDecalLibrary();
});

test('particles and world marks retain their pools, light layer, and fixed material count through combat fade/reset', () => {
  const scene = new THREE.Scene();
  const baseline = getBloodChromaFactoryDiagnostics();
  const effects = new CombatBloodEffects({
    scene,
    woundSystem: { getActiveWounds: () => [], getWorldPose: () => null },
    physiology: { circulation: 0 },
    groundY: 0,
  });
  const created = getBloodChromaFactoryDiagnostics();
  assert.equal(created.materialCount, baseline.materialCount + 2, 'the two pooled effect materials are precreated');
  assert.equal(isBloodChromaMaterial(effects.material), true);
  assert.equal(isBloodChromaMaterial(effects.decalMaterial), true);
  assert.equal(effects.decalMaterial.forceSinglePass, true);
  assert.equal(effects.particleMesh.isInstancedMesh, true);
  assert.equal(effects.particleMesh.count, 72);
  assert.equal(effects.particleMesh.material, effects.material);
  assert.equal(new Set(effects.decals.map((entry) => entry.mesh.material)).size, 1);
  assert.ok(effects.decals.every((entry) => entry.mesh.layers.isEnabled(2)));
  assert.equal(effects.particleMesh.layers.isEnabled(2), true);

  const particleVersion = effects.material.version;
  const markVersion = effects.decalMaterial.version;
  const particleBaseline = { opacity: effects.material.opacity, transparent: effects.material.transparent, depthWrite: effects.material.depthWrite, alphaTest: effects.material.alphaTest };
  const markBaseline = { opacity: effects.decalMaterial.opacity, transparent: effects.decalMaterial.transparent, depthWrite: effects.decalMaterial.depthWrite, alphaTest: effects.decalMaterial.alphaTest };
  const opaqueBody = new THREE.MeshStandardMaterial({ opacity: 1, transparent: false, depthWrite: true });
  assert.equal(effects.setOpacity(1), false, 'full opacity cannot implicitly enter fade state');
  assert.equal(effects.fadePrepared, false);
  assert.equal(effects.beginFade(), true);
  assert.equal(effects.beginFade(), false, 'blood fade preparation is idempotent');
  for (let index = 0; index < 40; index += 1) {
    effects.placeDecal(new THREE.Vector3(index * 0.01, 0, 0), index % 2 ? 'ground' : 'wall', 0.6);
    effects.setFadeOpacity(1 - index / 80);
    effects.clear();
  }
  assert.equal(getBloodChromaFactoryDiagnostics().materialCount, created.materialCount, 'repeated combat does not allocate materials');
  assert.equal(effects.material.version, particleVersion, 'particle opacity never recompiles its shader');
  assert.equal(effects.decalMaterial.version, markVersion, 'mark opacity never recompiles its shader');
  assert.equal(effects.material.transparent, true);
  assert.equal(effects.material.depthWrite, false);
  assert.deepEqual({ opacity: opaqueBody.opacity, transparent: opaqueBody.transparent, depthWrite: opaqueBody.depthWrite }, { opacity: 1, transparent: false, depthWrite: true }, 'blood fade state is independent from character depth state');
  assert.equal(effects.resetFade(), true);
  assert.equal(effects.resetFade(), false, 'blood fade reset is idempotent');
  assert.deepEqual({ opacity: effects.material.opacity, transparent: effects.material.transparent, depthWrite: effects.material.depthWrite, alphaTest: effects.material.alphaTest }, particleBaseline);
  assert.deepEqual({ opacity: effects.decalMaterial.opacity, transparent: effects.decalMaterial.transparent, depthWrite: effects.decalMaterial.depthWrite, alphaTest: effects.decalMaterial.alphaTest }, markBaseline);
  opaqueBody.dispose();
  effects.dispose();
  assert.equal(getBloodChromaFactoryDiagnostics().materialCount, baseline.materialCount, 'materials dispose only at full effects shutdown');
});

test('isolated wound fade materials are precreated and never allocated during stabbing', () => {
  const library = installKnifeWoundManifestForHeadlessTests(manifest);
  const scene = new THREE.Scene();
  const wounds = new CombatWoundSystem({ actor: {}, scene, decalLibrary: library, isolateMaterials: true });
  assert.equal(wounds.materialCloneCount, manifest.variants.length, 'all isolated fade materials exist before the first wound');
  const materialCount = getBloodChromaFactoryDiagnostics().materialCount;
  const versionByMaterial = new Map([...wounds.ownedMaterials.values()].map((material) => [material, material.version]));
  const stateByMaterial = new Map([...wounds.ownedMaterials.values()].map((material) => [material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, alphaTest: material.alphaTest }]));
  assert.equal(wounds.setOpacity(1), false, 'full opacity leaves wound materials in their original depth contract');
  assert.equal(wounds.fadePrepared, false);
  assert.equal(wounds.beginFade(), true);
  assert.equal(wounds.beginFade(), false, 'wound fade preparation is idempotent');
  for (let index = 0; index < 80; index += 1) {
    const variant = manifest.variants[index % manifest.variants.length];
    assert.ok(wounds.getWoundMaterial({ woundType: 'puncture', decalVariantId: variant.id }));
    wounds.setFadeOpacity((index % 10) / 10);
  }
  assert.equal(wounds.materialCloneCount, manifest.variants.length);
  assert.equal(getBloodChromaFactoryDiagnostics().materialCount, materialCount, 'repeated stabbing/fade lookups allocate no materials');
  versionByMaterial.forEach((version, material) => assert.equal(material.version, version, 'opacity does not trigger recompilation'));
  assert.equal(wounds.resetFade(), true);
  assert.equal(wounds.resetFade(), false, 'wound fade reset is idempotent');
  stateByMaterial.forEach((state, material) => assert.deepEqual({ opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, alphaTest: material.alphaTest }, state));
  wounds.clear();
  assert.equal(getBloodChromaFactoryDiagnostics().materialCount, materialCount, 'actor reset preserves its material pool');
  wounds.dispose();
  disposeKnifeWoundDecalLibrary();
});

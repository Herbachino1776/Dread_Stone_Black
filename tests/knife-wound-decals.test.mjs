import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import {
  KnifeWoundDecalLibrary,
  getAlphaBoundUv,
  selectKnifeWoundVariant,
  validateKnifeWoundManifest,
} from '../src/game/combat/KnifeWoundDecalLibrary.js';
import {
  PUNCTURE_VISUAL_LIMITS,
  SLASH_VISUAL_WIDTH_LIMITS,
  derivePuncturePhysicalDimensions,
  deriveSlashPhysicalDimensions,
} from '../src/game/combat/CombatWoundSystem.js';

const manifestUrl = new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

function punctureProperties(overrides = {}) {
  return { family: 'puncture', woundId: 'wound_1', penetrationDepth: 0.018, entryObliqueness: 0.08, impactSeverity: 0.25, lateralTearingMeters: 0, withdrawalDamage: 0, reopeningCount: 0, surfaceDisruption: 0.2, selectionSeverity: 0.2, ...overrides };
}

function slashProperties(overrides = {}) {
  return { family: 'slash', woundId: 'wound_2', cutLength: 0.16, maximumDepth: 0.024, edgeAlignment: 0.86, pathCurvature: 0.08, interrupted: false, surfaceDisruption: 0.35, selectionSeverity: 0.4, ...overrides };
}

test('authored knife wound manifest and all 13 RGBA PNG assets are valid', async () => {
  const validation = validateKnifeWoundManifest(manifest);
  assert.equal(validation.variantCount, 13);
  assert.equal(validation.ids.size, 13);
  assert.ok(manifest.variants.some((variant) => variant.family === 'puncture'));
  assert.ok(manifest.variants.some((variant) => variant.family === 'slash'));
  await Promise.all(manifest.variants.map(async (variant) => {
    const buffer = await readFile(new URL(`../public/assets/textures/combat/wounds/knife/${variant.file}`, import.meta.url));
    assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${variant.id} is PNG`);
    assert.equal(buffer.readUInt32BE(16), variant.canvas[0]);
    assert.equal(buffer.readUInt32BE(20), variant.canvas[1]);
    assert.equal(buffer[24], 8, `${variant.id} is 8-bit`);
    assert.equal(buffer[25], 6, `${variant.id} is RGBA`);
  }));
});

test('authored pack loads and caches exactly once, then disposes only at library shutdown', async () => {
  const originalFetch = globalThis.fetch;
  const originalLoadAsync = THREE.TextureLoader.prototype.loadAsync;
  let fetchCount = 0;
  let textureLoadCount = 0;
  let textureDisposeCount = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => manifest });
  THREE.TextureLoader.prototype.loadAsync = async () => {
    textureLoadCount += 1;
    const texture = new THREE.Texture();
    texture.addEventListener('dispose', () => { textureDisposeCount += 1; });
    return texture;
  };
  const library = new KnifeWoundDecalLibrary();
  try {
    const fetchWrapper = globalThis.fetch;
    globalThis.fetch = async (...args) => { fetchCount += 1; return fetchWrapper(...args); };
    await library.load();
    await library.load();
    assert.equal(fetchCount, 1);
    assert.equal(textureLoadCount, 13);
    assert.equal(library.loadCount, 1);
    assert.equal(library.texturesById.size, 13);
    assert.equal(library.materialsById.size, 13);
    library.dispose();
    assert.equal(textureDisposeCount, 13);
    assert.equal(library.texturesById.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
    THREE.TextureLoader.prototype.loadAsync = originalLoadAsync;
  }
});

test('deterministic physical selection stays family-correct, plausible, mirrored only when allowed, and stable', () => {
  const ordinary = Array.from({ length: 100 }, (_, index) => selectKnifeWoundVariant(manifest, punctureProperties({ woundId: `ordinary_${index}` })));
  assert.ok(ordinary.every((selection) => selection.variant.family === 'puncture' && selection.variant.id.includes('_slit_')));
  const severe = selectKnifeWoundVariant(manifest, punctureProperties({ woundId: 'severe', penetrationDepth: 0.12, entryObliqueness: 0.7, impactSeverity: 0.95, lateralTearingMeters: 0.025, surfaceDisruption: 0.9, selectionSeverity: 0.9 }));
  assert.match(severe.variant.id, /_burst_/);
  const arterialOnly = selectKnifeWoundVariant(manifest, punctureProperties({ woundId: 'arterial-only', arterial: true }));
  assert.match(arterialOnly.variant.id, /_slit_/);
  const slash = selectKnifeWoundVariant(manifest, slashProperties());
  assert.equal(slash.variant.family, 'slash');
  assert.doesNotMatch(slash.variant.id, /_wide_/);
  const repeat = selectKnifeWoundVariant(manifest, slashProperties());
  assert.equal(repeat.variant.id, slash.variant.id);
  assert.equal(repeat.mirroredX, slash.mirroredX);
  assert.equal(repeat.deterministicSeed, slash.deterministicSeed);
  [ordinary[0], severe, slash].forEach((selection) => assert.ok(!selection.mirroredX || selection.variant.allowMirrorX));
});

test('bounded deterministic anti-repetition varies only among physically eligible authored categories', () => {
  const first = selectKnifeWoundVariant(manifest, punctureProperties({ woundId: 'ordered_1' }));
  const identical = selectKnifeWoundVariant(manifest, punctureProperties({ woundId: 'ordered_1' }));
  assert.equal(identical.variant.id, first.variant.id);
  const second = selectKnifeWoundVariant(manifest, punctureProperties({ woundId: 'ordered_2', recentVariantIds: [first.variant.id] }));
  assert.notEqual(second.variant.id, first.variant.id, 'immediate repeat is avoided when both slit variants are eligible');
  assert.ok(second.eligibleCandidateIds.includes(first.variant.id));

  const shallowPunctures = Array.from({ length: 12 }, (_, index) => selectKnifeWoundVariant(manifest, punctureProperties({ woundId: `shallow_${index}`, recentVariantIds: index ? [first.variant.id, second.variant.id] : [] })));
  assert.ok(shallowPunctures.every((selection) => selection.variant.family === 'puncture' && selection.category === 'slit'));
  assert.ok(shallowPunctures.every((selection) => !selection.variant.id.includes('_burst_')));
  const split = selectKnifeWoundVariant(manifest, punctureProperties({ woundId: 'medium_split', penetrationDepth: 0.06, surfaceDisruption: 0.46, selectionSeverity: 0.5 }));
  assert.equal(split.category, 'split');
  const double = selectKnifeWoundVariant(manifest, punctureProperties({ woundId: 'torn_double', penetrationDepth: 0.075, lateralTearingMeters: 0.016, surfaceDisruption: 0.62, selectionSeverity: 0.68 }));
  assert.equal(double.category, 'double');
  const burst = selectKnifeWoundVariant(manifest, punctureProperties({ woundId: 'severe_burst', penetrationDepth: 0.11, entryObliqueness: 0.62, impactSeverity: 0.94, lateralTearingMeters: 0.028, surfaceDisruption: 0.9, selectionSeverity: 0.92 }));
  assert.equal(burst.category, 'burst');

  const slashHistory = [];
  const shallowSlashes = Array.from({ length: 8 }, (_, index) => {
    const selection = selectKnifeWoundVariant(manifest, slashProperties({ woundId: `shallow_slash_${index}`, recentVariantIds: slashHistory.slice(-4) }));
    slashHistory.push(selection.variant.id);
    return selection;
  });
  assert.deepEqual(new Set(shallowSlashes.map((selection) => selection.variant.id)), new Set(['knife_slash_long_01', 'knife_slash_long_02']));
  assert.equal(selectKnifeWoundVariant(manifest, slashProperties({ woundId: 'jagged', maximumDepth: 0.04, surfaceDisruption: 0.58, selectionSeverity: 0.65 })).category, 'jagged');
  assert.equal(selectKnifeWoundVariant(manifest, slashProperties({ woundId: 'gouge', cutLength: 0.07, maximumDepth: 0.03, edgeAlignment: 0.3, surfaceDisruption: 0.55, selectionSeverity: 0.62 })).category, 'gouge');
  assert.equal(selectKnifeWoundVariant(manifest, slashProperties({ woundId: 'wide', maximumDepth: 0.065, surfaceDisruption: 0.82, selectionSeverity: 0.88 })).category, 'wide');
  assert.equal(selectKnifeWoundVariant(manifest, slashProperties({ woundId: 'crescent', maximumDepth: 0.03, pathCurvature: 0.4, surfaceDisruption: 0.62, selectionSeverity: 0.68 })).category, 'crescent');
});

test('cropped UVs map alpha content rather than the transparent 512 canvas', () => {
  const variant = manifest.variants.find((entry) => entry.id === 'knife_puncture_slit_01');
  const uv = getAlphaBoundUv(variant, false);
  assert.equal(uv.u1 - uv.u0, variant.contentSize[0] / variant.canvas[0]);
  assert.ok(Math.abs((uv.v1 - uv.v0) - variant.contentSize[1] / variant.canvas[1]) < 1e-12);
  const mirrored = getAlphaBoundUv(variant, true);
  assert.equal(mirrored.u0, uv.u1);
  assert.equal(mirrored.u1, uv.u0);
});

test('puncture dimensions derive only from bounded physical attack inputs and grow without accumulation', () => {
  const shallow = derivePuncturePhysicalDimensions({ penetrationDepth: 0.012, entryObliqueness: 0.05, impactSeverity: 0.2 });
  const deep = derivePuncturePhysicalDimensions({ penetrationDepth: 0.1, entryObliqueness: 0.08, impactSeverity: 0.45 });
  const reopened = derivePuncturePhysicalDimensions({ penetrationDepth: 0.1, entryObliqueness: 0.5, impactSeverity: 0.7, withdrawalDamage: 0.8, reopeningCount: 2, lateralTearingMeters: 0.028 });
  assert.ok(shallow.visualMajorMeters >= PUNCTURE_VISUAL_LIMITS.shallow.major[0] && shallow.visualMajorMeters <= PUNCTURE_VISUAL_LIMITS.shallow.major[1]);
  assert.ok(shallow.visualMinorMeters >= PUNCTURE_VISUAL_LIMITS.shallow.minor[0] && shallow.visualMinorMeters <= PUNCTURE_VISUAL_LIMITS.shallow.minor[1]);
  assert.ok(deep.visualMajorMeters > shallow.visualMajorMeters);
  assert.ok(deep.visualMinorMeters > shallow.visualMinorMeters);
  assert.ok(reopened.visualMajorMeters > deep.visualMajorMeters && reopened.visualMajorMeters <= PUNCTURE_VISUAL_LIMITS.severe.major[1]);
  assert.ok(reopened.visualMinorMeters > deep.visualMinorMeters && reopened.visualMinorMeters <= PUNCTURE_VISUAL_LIMITS.severe.minor[1]);
  assert.equal(shallow.entryAreaMetersSquared, Math.PI * shallow.entryMajorMeters * shallow.entryMinorMeters * 0.25);
  assert.deepEqual(derivePuncturePhysicalDimensions({ penetrationDepth: 0.1, entryObliqueness: 0.08, impactSeverity: 0.45, viewportWidth: 320, cameraDistance: 0.2 }), deep);
  assert.deepEqual(derivePuncturePhysicalDimensions({ penetrationDepth: 0.1, entryObliqueness: 0.08, impactSeverity: 0.45 }), deep, 'repeated derivation does not accumulate scale');
});

test('slash dimensions track physical path and bounded depth-derived width', () => {
  const short = deriveSlashPhysicalDimensions({ cutLength: 0.06, maximumDepth: 0.015, edgeAlignment: 0.8, severity: 0.25 });
  const long = deriveSlashPhysicalDimensions({ cutLength: 0.32, maximumDepth: 0.045, edgeAlignment: 0.9, severity: 0.7 });
  const severe = deriveSlashPhysicalDimensions({ cutLength: 0.8, maximumDepth: 0.072, edgeAlignment: 1, severity: 1.2, reopeningCount: 2, lateralTearingMeters: 0.03 });
  assert.equal(short.visualLengthMeters, 0.06);
  assert.equal(long.visualLengthMeters, 0.32);
  assert.ok(long.visualWidthMeters > short.visualWidthMeters);
  assert.ok(short.visualWidthMeters <= SLASH_VISUAL_WIDTH_LIMITS.shallow[1]);
  assert.ok(severe.visualWidthMeters <= SLASH_VISUAL_WIDTH_LIMITS.severeMaximum);
  assert.equal(severe.visualLengthMeters, 0.52, 'slash length remains capped by physical wound configuration');
});

test('production wound source contains no procedural wound DataTexture path', async () => {
  const source = await readFile(new URL('../src/game/combat/CombatWoundSystem.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /makeWoundTexture/);
  assert.doesNotMatch(source, /THREE\.DataTexture/);
  assert.match(source, /getAlphaBoundUv/);
  assert.match(source, /entryMajorMeters/);
  assert.match(source, /visualWidthMeters/);
});

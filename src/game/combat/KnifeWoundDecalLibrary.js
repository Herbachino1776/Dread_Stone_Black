import * as THREE from 'three';

export const KNIFE_WOUND_MANIFEST_URL = './assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json';

const MATERIAL_OPTIONS = Object.freeze({
  color: 0xffffff,
  roughness: 0.82,
  metalness: 0,
  side: THREE.DoubleSide,
  transparent: true,
  alphaTest: 0.065,
  depthTest: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});

let sharedLibrary = null;
let sharedLoadPromise = null;

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed) {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
}

export function punctureCategory(properties) {
  const severeTearing = properties.penetrationDepth >= 0.075
    && properties.surfaceDisruption >= 0.78
    && properties.entryObliqueness >= 0.45
    && properties.impactSeverity >= 0.8
    && (properties.lateralTearingMeters >= 0.02 || properties.reopeningCount >= 2 || properties.withdrawalDamage >= 0.8);
  if (severeTearing) return 'burst';
  if (properties.reopeningCount > 0 || properties.lateralTearingMeters >= 0.012 || properties.withdrawalDamage >= 0.55 || properties.entryObliqueness >= 0.28 && properties.impactSeverity >= 0.55) return 'double';
  if (properties.penetrationDepth >= 0.04 || properties.surfaceDisruption >= 0.38) return 'split';
  return 'slit';
}

export function slashCategory(properties) {
  if (properties.pathCurvature >= 0.32 && properties.cutLength >= 0.08 && properties.maximumDepth >= 0.02) return 'crescent';
  if (properties.cutLength <= 0.09 && properties.edgeAlignment < 0.5 && properties.maximumDepth >= 0.025) return 'gouge';
  if (properties.maximumDepth >= 0.055 && properties.surfaceDisruption >= 0.72) return 'wide';
  if (properties.maximumDepth >= 0.032 || properties.surfaceDisruption >= 0.52 || properties.interrupted && properties.maximumDepth >= 0.02) return 'jagged';
  return 'long';
}

export function getKnifeWoundPhysicalCategory(properties) {
  return properties.family === 'puncture' ? punctureCategory(properties) : slashCategory(properties);
}

export function validateKnifeWoundManifest(manifest) {
  const errors = [];
  const variants = Array.isArray(manifest?.variants) ? manifest.variants : [];
  const ids = new Set();
  if (!Array.isArray(manifest?.canvasSize) || manifest.canvasSize.length !== 2) errors.push('manifest canvasSize is invalid');
  variants.forEach((variant, index) => {
    const label = variant?.id ?? `variant ${index}`;
    if (!variant?.id || ids.has(variant.id)) errors.push(`duplicate or missing variant id: ${label}`);
    ids.add(variant?.id);
    if (!['puncture', 'slash'].includes(variant?.family)) errors.push(`${label} has invalid family`);
    if (!variant?.file || !variant.file.toLowerCase().endsWith('.png')) errors.push(`${label} has invalid PNG file`);
    const canvas = variant?.canvas;
    const bounds = variant?.alphaBounds;
    const content = variant?.contentSize;
    if (!Array.isArray(canvas) || canvas.length !== 2 || canvas.some((value) => !Number.isInteger(value) || value <= 0)) errors.push(`${label} has invalid canvas`);
    if (!Array.isArray(bounds) || bounds.length !== 4 || !canvas || bounds[0] < 0 || bounds[1] < 0 || bounds[2] > canvas[0] || bounds[3] > canvas[1] || bounds[2] <= bounds[0] || bounds[3] <= bounds[1]) errors.push(`${label} has invalid alphaBounds`);
    if (!Array.isArray(content) || content.length !== 2 || !bounds || content[0] !== bounds[2] - bounds[0] || content[1] !== bounds[3] - bounds[1]) errors.push(`${label} contentSize does not match alphaBounds`);
    if (!Array.isArray(variant?.severity) || variant.severity.length !== 2 || variant.severity[0] > variant.severity[1]) errors.push(`${label} has invalid severity range`);
    if (!(variant?.weight > 0)) errors.push(`${label} has invalid weight`);
  });
  if (!variants.some((variant) => variant.family === 'puncture')) errors.push('puncture family has no candidates');
  if (!variants.some((variant) => variant.family === 'slash')) errors.push('slash family has no candidates');
  if (errors.length) throw new Error(`Invalid knife wound decal manifest:\n${errors.join('\n')}`);
  return { valid: true, variantCount: variants.length, ids };
}

export function getAlphaBoundUv(variant, mirroredX = false) {
  const [width, height] = variant.canvas;
  const [left, top, right, bottom] = variant.alphaBounds;
  const u0 = left / width;
  const u1 = right / width;
  const v0 = 1 - bottom / height;
  const v1 = 1 - top / height;
  return mirroredX ? { u0: u1, u1: u0, v0, v1 } : { u0, u1, v0, v1 };
}

export function selectKnifeWoundVariant(manifest, properties) {
  const family = properties.family;
  const category = getKnifeWoundPhysicalCategory(properties);
  const severity = THREE.MathUtils.clamp(properties.selectionSeverity ?? properties.surfaceDisruption ?? 0.2, 0, 1);
  const familyCandidates = manifest.variants.filter((variant) => variant.family === family);
  let candidates = familyCandidates.filter((variant) => variant.id.includes(`_${category}_`) && severity >= variant.severity[0] - 0.08 && severity <= variant.severity[1] + 0.08);
  if (!candidates.length) candidates = familyCandidates.filter((variant) => variant.id.includes(`_${category}_`));
  if (!candidates.length) candidates = familyCandidates.filter((variant) => severity >= variant.severity[0] && severity <= variant.severity[1]);
  if (!candidates.length) candidates = familyCandidates;
  if (!candidates.length) throw new Error(`No authored ${family} wound decal candidate`);
  const eligibleCandidateIds = candidates.map((variant) => variant.id);
  const recentVariantIds = (properties.recentVariantIds ?? []).filter((id) => eligibleCandidateIds.includes(id)).slice(-4);
  const immediatePrevious = recentVariantIds.at(-1);
  if (candidates.length > 1 && immediatePrevious) candidates = candidates.filter((variant) => variant.id !== immediatePrevious);
  const stableKey = [properties.woundId, family, category].join(':');
  const deterministicSeed = hashString(stableKey);
  const weightedCandidates = candidates.map((variant) => {
    const historyDistance = recentVariantIds.slice(0, -1).reverse().indexOf(variant.id);
    return { variant, weight: variant.weight * (historyDistance >= 0 ? 0.18 + historyDistance * 0.08 : 1) };
  });
  const totalWeight = weightedCandidates.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = randomFromSeed(deterministicSeed) * totalWeight;
  let selected = weightedCandidates.at(-1).variant;
  for (const candidate of weightedCandidates) {
    cursor -= candidate.weight;
    if (cursor <= 0) { selected = candidate.variant; break; }
  }
  const mirroredX = selected.allowMirrorX === true && randomFromSeed(deterministicSeed ^ 0x9e3779b9) >= 0.5;
  const rotationVariationRadians = THREE.MathUtils.degToRad((randomFromSeed(deterministicSeed ^ 0x85ebca6b) * 2 - 1) * 5);
  return { variant: selected, category, eligibleCandidateIds, deterministicSeed, mirroredX, rotationVariationRadians, selectedAtSeverity: severity };
}

export function selectKnifeSlashFragmentVariant(manifest, properties) {
  const surfaceDisruption = THREE.MathUtils.clamp(properties.surfaceDisruption ?? 0, 0, 1);
  const maximumDepth = Math.max(0, properties.maximumDepth ?? 0);
  const severity = THREE.MathUtils.clamp(properties.selectionSeverity ?? properties.severity ?? 0, 0, 1);
  const stronglyDisruptive = maximumDepth >= 0.055 && surfaceDisruption >= 0.72 && severity >= 0.78;
  const baseVariantId = stronglyDisruptive
    ? 'knife_puncture_split_01'
    : maximumDepth >= 0.028 || surfaceDisruption >= 0.44 || severity >= 0.5
      ? 'knife_puncture_slit_02'
      : 'knife_puncture_slit_01';
  const permittedIds = stronglyDisruptive
    ? ['knife_puncture_split_01']
    : ['knife_puncture_slit_01', 'knife_puncture_slit_02'];
  const variant = manifest.variants.find((entry) => entry.id === baseVariantId)
    ?? manifest.variants.find((entry) => permittedIds.includes(entry.id));
  if (!variant) throw new Error('Authored slit-class puncture decals are required for slash fragment chains');
  const deterministicSeed = hashString(`${properties.woundId}:slash-fragment-chain:${variant.id}`);
  return {
    variant,
    category: variant.id.includes('_split_') ? 'split' : 'slit',
    eligibleCandidateIds: permittedIds.filter((id) => manifest.variants.some((entry) => entry.id === id)),
    deterministicSeed,
    mirroredX: false,
    rotationVariationRadians: 0,
    selectedAtSeverity: severity,
  };
}

export class KnifeWoundDecalLibrary {
  constructor({ manifestUrl = KNIFE_WOUND_MANIFEST_URL } = {}) {
    this.manifestUrl = manifestUrl;
    this.manifest = null;
    this.variantsById = new Map();
    this.texturesById = new Map();
    this.materialsById = new Map();
    this.loadCount = 0;
    this.loaded = false;
    this.disposed = false;
  }

  async load() {
    if (this.loaded) return this;
    const response = await fetch(this.manifestUrl);
    if (!response.ok) throw new Error(`Knife wound manifest failed to load (${response.status}): ${this.manifestUrl}`);
    const manifest = await response.json();
    validateKnifeWoundManifest(manifest);
    const loader = new THREE.TextureLoader();
    const textures = await Promise.all(manifest.variants.map(async (variant) => {
      const texture = await loader.loadAsync(`${manifest.basePath}${variant.file}`);
      texture.name = `authored-knife-wound-${variant.id}`;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      return [variant, texture];
    }));
    this.manifest = manifest;
    textures.forEach(([variant, texture]) => {
      this.variantsById.set(variant.id, variant);
      this.texturesById.set(variant.id, texture);
      const material = new THREE.MeshStandardMaterial({ ...MATERIAL_OPTIONS, map: texture });
      material.name = `authored-knife-wound-material-${variant.id}`;
      material.userData.authoredKnifeWoundVariantId = variant.id;
      this.materialsById.set(variant.id, material);
    });
    this.loadCount += 1;
    this.loaded = true;
    return this;
  }

  select(properties) {
    const selection = selectKnifeWoundVariant(this.manifest, properties);
    return { ...selection, material: this.materialsById.get(selection.variant.id) };
  }

  selectSlashFragment(properties) {
    const selection = selectKnifeSlashFragmentVariant(this.manifest, properties);
    return { ...selection, material: this.materialsById.get(selection.variant.id) };
  }

  getVariant(id) { return this.variantsById.get(id) ?? null; }
  getMaterial(id) { return this.materialsById.get(id) ?? null; }

  getDiagnostics() {
    return { manifestUrl: this.manifestUrl, loaded: this.loaded, loadCount: this.loadCount, textureCount: this.texturesById.size, materialCount: this.materialsById.size, variantIds: [...this.variantsById.keys()] };
  }

  dispose() {
    if (this.disposed) return;
    this.materialsById.forEach((material) => material.dispose());
    this.texturesById.forEach((texture) => texture.dispose());
    this.materialsById.clear();
    this.texturesById.clear();
    this.variantsById.clear();
    this.manifest = null;
    this.loaded = false;
    this.disposed = true;
  }
}

export function preloadKnifeWoundDecalLibrary() {
  if (!sharedLoadPromise) {
    sharedLibrary = new KnifeWoundDecalLibrary();
    sharedLoadPromise = sharedLibrary.load().catch((error) => { sharedLibrary = null; sharedLoadPromise = null; throw error; });
  }
  return sharedLoadPromise;
}

export function getKnifeWoundDecalLibrary() {
  if (!sharedLibrary?.loaded) throw new Error('Knife wound decal library must be preloaded before combat initialization');
  return sharedLibrary;
}

export function installKnifeWoundManifestForHeadlessTests(manifest) {
  if (globalThis.window) throw new Error('Headless knife wound manifest installation is test-only');
  validateKnifeWoundManifest(manifest);
  sharedLibrary?.dispose();
  sharedLibrary = new KnifeWoundDecalLibrary();
  sharedLibrary.manifest = manifest;
  manifest.variants.forEach((variant) => {
    sharedLibrary.variantsById.set(variant.id, variant);
    const material = new THREE.MeshStandardMaterial({ ...MATERIAL_OPTIONS });
    material.name = `headless-authored-knife-wound-material-${variant.id}`;
    material.userData.authoredKnifeWoundVariantId = variant.id;
    sharedLibrary.materialsById.set(variant.id, material);
  });
  sharedLibrary.loadCount = 1;
  sharedLibrary.loaded = true;
  sharedLoadPromise = Promise.resolve(sharedLibrary);
  return sharedLibrary;
}

export function disposeKnifeWoundDecalLibrary() {
  sharedLibrary?.dispose();
  sharedLibrary = null;
  sharedLoadPromise = null;
}

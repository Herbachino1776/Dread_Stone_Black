import * as THREE from 'three';

export const BLOOD_CHROMA_PROGRAM_CACHE_KEY = 'dread-stone-blood-chroma-v1';

export const BLOOD_CHROMA_RESPONSE = Object.freeze({
  saturationFloor: 0.78,
  contrast: 1.08,
  illuminationGain: 1.25,
  maximumBrightness: 0.82,
  specularEnergyScale: 0.08,
  readabilityScalar: 0.88,
  exposure: 1,
});

export const BLOOD_LIGHTING_DEBUG_MODES = Object.freeze([
  Object.freeze({ id: 'final', shaderValue: 0, label: 'final blood output' }),
  Object.freeze({ id: 'standard-pbr', shaderValue: 1, label: 'current standard PBR response' }),
  Object.freeze({ id: 'chroma', shaderValue: 2, label: 'chroma-preserved response' }),
  Object.freeze({ id: 'albedo', shaderValue: 3, label: 'texture / albedo only' }),
  Object.freeze({ id: 'illumination', shaderValue: 4, label: 'illumination luminance' }),
]);

const sharedUniforms = Object.freeze({
  bloodSaturationFloor: { value: BLOOD_CHROMA_RESPONSE.saturationFloor },
  bloodContrast: { value: BLOOD_CHROMA_RESPONSE.contrast },
  bloodIlluminationGain: { value: BLOOD_CHROMA_RESPONSE.illuminationGain },
  bloodMaximumBrightness: { value: BLOOD_CHROMA_RESPONSE.maximumBrightness },
  bloodSpecularEnergyScale: { value: BLOOD_CHROMA_RESPONSE.specularEnergyScale },
  bloodReadabilityScalar: { value: BLOOD_CHROMA_RESPONSE.readabilityScalar },
  bloodExposure: { value: BLOOD_CHROMA_RESPONSE.exposure },
  bloodLightingDebugMode: { value: 0 },
});

const registeredMaterials = new Set();
const rendererWarmups = new WeakMap();
let materialRevision = 0;
let shaderPatchCount = 0;
let warmupCount = 0;
let lastWarmupMaterialCount = 0;
let lastWarmupProgramDelta = 0;

const BLOOD_SHADER_UNIFORMS = `
uniform float bloodSaturationFloor;
uniform float bloodContrast;
uniform float bloodIlluminationGain;
uniform float bloodMaximumBrightness;
uniform float bloodSpecularEnergyScale;
uniform float bloodReadabilityScalar;
uniform float bloodExposure;
uniform int bloodLightingDebugMode;
`;

const BLOOD_SHADER_RESPONSE = `
vec3 bloodStandardPbr = outgoingLight;
vec3 bloodAlbedo = clamp( diffuseColor.rgb, vec3( 0.0 ), vec3( 1.0 ) );
float bloodSourcePeak = max( max( bloodAlbedo.r, bloodAlbedo.g ), bloodAlbedo.b );
float bloodSourceMinimum = min( min( bloodAlbedo.r, bloodAlbedo.g ), bloodAlbedo.b );
float bloodSourceLuminance = dot( bloodAlbedo, vec3( 0.2126, 0.7152, 0.0722 ) );
float bloodDiffuseLuminance = dot( max( totalDiffuse, vec3( 0.0 ) ), vec3( 0.2126, 0.7152, 0.0722 ) );
float bloodSpecularLuminance = dot( max( totalSpecular, vec3( 0.0 ) ), vec3( 0.2126, 0.7152, 0.0722 ) );
float bloodDiffuseEnergy = bloodDiffuseLuminance / max( bloodSourceLuminance, 0.002 );
float bloodIllumination = max( 0.0, ( bloodDiffuseEnergy + bloodSpecularLuminance * bloodSpecularEnergyScale ) * bloodReadabilityScalar * bloodExposure );
float bloodVisibility = 1.0 - exp( -bloodIllumination * bloodIlluminationGain );
vec3 bloodChroma = bloodSourcePeak > 0.00001 ? bloodAlbedo / bloodSourcePeak : vec3( 0.0 );
float bloodSourceSaturation = bloodSourcePeak > 0.00001 ? ( bloodSourcePeak - bloodSourceMinimum ) / bloodSourcePeak : 0.0;
float bloodTargetSaturation = max( bloodSourceSaturation, bloodSaturationFloor );
float bloodSaturationScale = bloodSourceSaturation > 0.00001 ? bloodTargetSaturation / bloodSourceSaturation : 1.0;
bloodChroma = clamp( vec3( 1.0 ) - ( vec3( 1.0 ) - bloodChroma ) * bloodSaturationScale, vec3( 0.0 ), vec3( 1.0 ) );
float bloodDetail = pow( bloodSourcePeak, bloodContrast );
float bloodBrightness = min( bloodMaximumBrightness, bloodDetail * bloodVisibility );
vec3 bloodChromaOnly = bloodChroma * min( bloodMaximumBrightness, bloodSourcePeak * bloodVisibility );
vec3 bloodFinal = bloodChroma * bloodBrightness;
outgoingLight = bloodLightingDebugMode == 1 ? bloodStandardPbr
  : bloodLightingDebugMode == 2 ? bloodChromaOnly
  : bloodLightingDebugMode == 3 ? bloodAlbedo
  : bloodLightingDebugMode == 4 ? vec3( min( 1.0, bloodIllumination / 4.0 ) )
  : bloodFinal;
#include <opaque_fragment>
`;

function asRgb(value, fallback = [0, 0, 0]) {
  if (typeof value === 'number') return [value, value, value];
  if (Array.isArray(value)) return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
  if (value && typeof value === 'object') return [Number(value.r) || 0, Number(value.g) || 0, Number(value.b) || 0];
  return [...fallback];
}

function rgbSaturation(rgb) {
  const maximum = Math.max(...rgb);
  const minimum = Math.min(...rgb);
  return maximum > 1e-8 ? (maximum - minimum) / maximum : 0;
}

function lightLuminance(value) {
  if (typeof value === 'number') return Math.max(0, value);
  const [red, green, blue] = asRgb(value);
  return Math.max(0, red * 0.2126 + green * 0.7152 + blue * 0.0722);
}

export function resolveBloodChromaResponse({
  albedo,
  alpha = 1,
  illumination = 1,
  exposure = BLOOD_CHROMA_RESPONSE.exposure,
  contrast = BLOOD_CHROMA_RESPONSE.contrast,
  maximumBrightness = BLOOD_CHROMA_RESPONSE.maximumBrightness,
  saturationFloor = BLOOD_CHROMA_RESPONSE.saturationFloor,
  illuminationGain = BLOOD_CHROMA_RESPONSE.illuminationGain,
  readabilityScalar = BLOOD_CHROMA_RESPONSE.readabilityScalar,
} = {}) {
  const source = asRgb(albedo);
  const sourcePeak = Math.max(...source, 0);
  const sourceMinimum = Math.min(...source);
  const sourceSaturation = sourcePeak > 1e-8 ? (sourcePeak - sourceMinimum) / sourcePeak : 0;
  const targetSaturation = Math.max(sourceSaturation, saturationFloor);
  const saturationScale = sourceSaturation > 1e-8 ? targetSaturation / sourceSaturation : 1;
  const chroma = sourcePeak > 1e-8
    ? source.map((channel) => THREE.MathUtils.clamp(1 - (1 - channel / sourcePeak) * saturationScale, 0, 1))
    : [0, 0, 0];
  const illuminationLuminance = lightLuminance(illumination);
  const resolvedIllumination = Math.max(0, illuminationLuminance * Math.max(0, exposure) * Math.max(0, readabilityScalar));
  const visibility = 1 - Math.exp(-resolvedIllumination * Math.max(0, illuminationGain));
  const detail = Math.pow(Math.max(0, sourcePeak), Math.max(0.001, contrast));
  const brightness = Math.min(Math.max(0, maximumBrightness), detail * visibility);
  const rgb = chroma.map((channel) => channel * brightness);
  return {
    rgb,
    alpha,
    source,
    chroma,
    illuminationLuminance,
    resolvedIllumination,
    visibility,
    brightness,
    saturation: rgbSaturation(rgb),
    redDominance: rgb[0] - Math.max(rgb[1], rgb[2]),
    maximumBrightness,
  };
}

function applyBloodChromaShader(shader) {
  shaderPatchCount += 1;
  Object.assign(shader.uniforms, sharedUniforms);
  if (!shader.fragmentShader.includes('#include <common>') || !shader.fragmentShader.includes('#include <opaque_fragment>')) {
    throw new Error('Blood chroma shader patch points are unavailable');
  }
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${BLOOD_SHADER_UNIFORMS}`)
    .replace('#include <opaque_fragment>', BLOOD_SHADER_RESPONSE);
}

function bloodProgramCacheKey() { return BLOOD_CHROMA_PROGRAM_CACHE_KEY; }

function registerMaterial(material, usage) {
  material.toneMapped = false;
  material.depthTest = true;
  material.blending = THREE.NormalBlending;
  if (material.transparent && material.side === THREE.DoubleSide) material.forceSinglePass = true;
  material.emissive.setHex(0x000000);
  material.emissiveIntensity = 0;
  material.onBeforeCompile = applyBloodChromaShader;
  material.customProgramCacheKey = bloodProgramCacheKey;
  material.userData = {
    ...material.userData,
    isBloodChromaMaterial: true,
    bloodUsage: usage,
    bloodProgramCacheKey: BLOOD_CHROMA_PROGRAM_CACHE_KEY,
    bloodResponseVersion: 1,
  };
  registeredMaterials.add(material);
  materialRevision += 1;
  material.addEventListener('dispose', () => {
    if (!registeredMaterials.delete(material)) return;
    materialRevision += 1;
  });
  return material;
}

export function createBloodChromaMaterial({ usage = 'generic', sourceColor = null, ...options } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
    depthTest: true,
    ...options,
  });
  if (sourceColor != null) material.userData.bloodSourceColor = sourceColor;
  return registerMaterial(material, usage);
}

export function cloneBloodChromaMaterial(sourceMaterial, { usage = sourceMaterial?.userData?.bloodUsage ?? 'wound-isolated' } = {}) {
  if (!sourceMaterial?.userData?.isBloodChromaMaterial) return sourceMaterial?.clone?.() ?? null;
  return registerMaterial(sourceMaterial.clone(), usage);
}

export function isBloodChromaMaterial(material) {
  return material?.userData?.isBloodChromaMaterial === true
    && material.customProgramCacheKey?.() === BLOOD_CHROMA_PROGRAM_CACHE_KEY;
}

export function setBloodLightingDebugMode(modeId = 'final') {
  const mode = BLOOD_LIGHTING_DEBUG_MODES.find((entry) => entry.id === modeId) ?? BLOOD_LIGHTING_DEBUG_MODES[0];
  sharedUniforms.bloodLightingDebugMode.value = mode.shaderValue;
  return mode;
}

export function getBloodLightingDebugMode() {
  return BLOOD_LIGHTING_DEBUG_MODES.find((entry) => entry.shaderValue === sharedUniforms.bloodLightingDebugMode.value) ?? BLOOD_LIGHTING_DEBUG_MODES[0];
}

export function getBloodMaterialDiagnostics(material, { albedo = material?.color, illumination = 1 } = {}) {
  const diagnosticAlbedo = material?.userData?.bloodSourceColor != null && albedo === material?.color
    ? new THREE.Color(material.userData.bloodSourceColor)
    : albedo;
  const response = resolveBloodChromaResponse({ albedo: diagnosticAlbedo, illumination });
  return {
    materialType: material?.type ?? 'none',
    response: isBloodChromaMaterial(material) ? 'blood-chroma' : 'standard-pbr',
    sourceRgb: response.source,
    illuminationLuminance: response.illuminationLuminance,
    finalRgb: response.rgb,
    finalSaturation: response.saturation,
    redDominance: response.redDominance,
    brightnessCap: BLOOD_CHROMA_RESPONSE.maximumBrightness,
    toneMapped: material?.toneMapped === true,
    emissiveIntensity: material?.emissiveIntensity ?? 0,
    programCacheKey: material?.customProgramCacheKey?.() ?? '',
    debugMode: getBloodLightingDebugMode().id,
  };
}

export function getBloodChromaFactoryDiagnostics() {
  return {
    materialCount: registeredMaterials.size,
    materialRevision,
    shaderPatchCount,
    warmupCount,
    lastWarmupMaterialCount,
    lastWarmupProgramDelta,
    programCacheKey: BLOOD_CHROMA_PROGRAM_CACHE_KEY,
    debugMode: getBloodLightingDebugMode().id,
  };
}

export function countBloodChromaRendererPrograms(renderer) {
  return (renderer?.info?.programs ?? []).filter((program) => String(program?.cacheKey ?? '').includes(BLOOD_CHROMA_PROGRAM_CACHE_KEY)).length;
}

function isHierarchyVisible(object) {
  for (let current = object; current; current = current.parent) if (!current.visible) return false;
  return true;
}

function getWarmupSignature(scene, camera) {
  const lights = [];
  scene?.traverse?.((object) => {
    if (!object.isLight || !camera?.layers?.test?.(object.layers)) return;
    lights.push(`${object.uuid}:${object.type}:${object.visible ? 1 : 0}:${isHierarchyVisible(object) ? 1 : 0}:${object.castShadow ? 1 : 0}:${object.layers.mask}`);
  });
  return `${scene?.uuid ?? 'isolated'}:${scene?.fog?.type ?? 'no-fog'}:${lights.join('|')}`;
}

function createWarmupScene({ sourceScene, camera, materials, geometry, includeInactiveLights }) {
  const scene = new THREE.Scene();
  scene.fog = sourceScene?.fog?.clone?.() ?? sourceScene?.fog ?? null;
  let lightCount = 0;
  sourceScene?.traverse?.((object) => {
    if (!object.isLight || !camera.layers.test(object.layers)) return;
    if (!includeInactiveLights && !isHierarchyVisible(object)) return;
    const light = object.clone();
    light.visible = true;
    scene.add(light);
    lightCount += 1;
  });
  if (lightCount === 0) scene.add(new THREE.AmbientLight(0xffffff, 1));
  addWarmupMeshes(scene, materials, geometry);
  return scene;
}

function addWarmupMeshes(parent, materials, geometry) {
  const group = new THREE.Group();
  group.name = 'blood-chroma-material-warmup';
  materials.forEach((material, index) => {
    const mesh = material.userData.bloodUsage === 'particle'
      ? new THREE.InstancedMesh(geometry, material, 1)
      : new THREE.Mesh(geometry, material);
    if (mesh.isInstancedMesh) mesh.setColorAt(0, new THREE.Color(material.userData.bloodSourceColor ?? 0xffffff));
    mesh.frustumCulled = false;
    mesh.position.x = (index % 8) * 0.12 - 0.42;
    mesh.position.y = Math.floor(index / 8) * 0.12 - 0.12;
    group.add(mesh);
  });
  parent.add(group);
  return group;
}

export async function warmBloodChromaMaterials(renderer, { scene: sourceScene = null, camera: sourceCamera = null, force = false, includeInactiveLights = true } = {}) {
  if (!renderer || registeredMaterials.size === 0) return getBloodChromaFactoryDiagnostics();
  const camera = sourceCamera?.clone?.() ?? new THREE.PerspectiveCamera(50, 1, 0.01, 10);
  camera.layers.set(0);
  camera.layers.enable(2);
  camera.position.z = sourceCamera ? sourceCamera.position.z : 2;
  camera.updateMatrixWorld(true);
  const signature = `${getWarmupSignature(sourceScene, camera)}:${includeInactiveLights ? 'all-lights' : 'active-lights'}`;
  const previous = rendererWarmups.get(renderer);
  if (!force && previous?.revision === materialRevision && previous?.signature === signature) return previous.promise;
  const revision = materialRevision;
  const promise = (async () => {
    const geometry = new THREE.PlaneGeometry(0.1, 0.1);
    const materials = [...registeredMaterials];
    const programsBefore = renderer.info?.programs?.length ?? 0;
    const activeScene = new THREE.Group();
    addWarmupMeshes(activeScene, materials, geometry);
    if (typeof renderer.compileAsync === 'function') {
      await renderer.compileAsync(activeScene, camera, sourceScene);
      if (includeInactiveLights) await renderer.compileAsync(createWarmupScene({ sourceScene, camera, materials, geometry, includeInactiveLights: true }), camera);
    } else {
      renderer.compile(activeScene, camera, sourceScene);
      if (includeInactiveLights) renderer.compile(createWarmupScene({ sourceScene, camera, materials, geometry, includeInactiveLights: true }), camera);
    }
    const programsAfter = renderer.info?.programs?.length ?? programsBefore;
    geometry.dispose();
    warmupCount += 1;
    lastWarmupMaterialCount = materials.length;
    lastWarmupProgramDelta = Math.max(0, programsAfter - programsBefore);
    return getBloodChromaFactoryDiagnostics();
  })();
  rendererWarmups.set(renderer, { revision, signature, promise });
  return promise;
}

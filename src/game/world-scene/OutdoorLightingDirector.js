import * as THREE from 'three';
import { resolveOutdoorSkyWeights, resolveOutdoorTimeOfDay } from './OutdoorWorldClock.js';
import { updateOutdoorWaterMaterial } from './OutdoorWaterMaterialRuntime.js';
import { updateOutdoorFoliageMaterial } from './OutdoorFoliageMaterialRuntime.js';
import { getOutdoorLightSourceRegistry, OUTDOOR_LIGHT_OWNER } from './OutdoorLightSourceRegistry.js';

export const OUTDOOR_LIGHTING_PROFILES = Object.freeze({
  noon: { sky: 0xb9d5ef, ground: 0x706b55, hemi: 0.9, key: 0xffe8be, keyIntensity: 1.12, moon: 0x9eb9df, moonIntensity: 0, fog: 0xb5c7cd, fogNear: 105, fogFar: 470, exposure: 1, elevation: 0.82 },
  dusk: { sky: 0x3b2021, ground: 0x080302, hemi: 0.18, key: 0xff8a55, keyIntensity: 0.22, moon: 0x8fa8c4, moonIntensity: 0.005, fog: 0x170b0c, fogNear: 8, fogFar: 55, exposure: 0.86, elevation: 0.04 },
  night: { sky: 0x02060a, ground: 0x000000, hemi: 0, key: 0x000000, keyIntensity: 0, moon: 0x000000, moonIntensity: 0, fog: 0x000000, fogNear: 115, fogFar: 470, exposure: 0.72, elevation: -0.18 },
  dawn: { sky: 0x332426, ground: 0x090504, hemi: 0.16, key: 0xffa76a, keyIntensity: 0.18, moon: 0x8fa8c4, moonIntensity: 0.004, fog: 0x160f11, fogNear: 9, fogFar: 58, exposure: 0.86, elevation: 0.035 },
});

const smooth = (value) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const wrapPhase = (phase) => ((phase % 1) + 1) % 1;

function blendProfile(a, b, amount) {
  const result = {};
  const t = smooth(amount);
  ['hemi', 'keyIntensity', 'moonIntensity', 'fogNear', 'fogFar', 'exposure', 'elevation'].forEach((key) => { result[key] = THREE.MathUtils.lerp(a[key], b[key], t); });
  ['sky', 'ground', 'key', 'moon', 'fog'].forEach((key) => { result[key] = new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), t); });
  return result;
}

export function resolveOutdoorLightingProfile(phase) {
  const p = wrapPhase(phase);
  if (p < 0.3 || p >= 0.9) return blendProfile(OUTDOOR_LIGHTING_PROFILES.noon, OUTDOOR_LIGHTING_PROFILES.noon, 0);
  if (p < 0.4) {
    const progress = (p - 0.3) / 0.1;
    return progress < 0.5
      ? blendProfile(OUTDOOR_LIGHTING_PROFILES.noon, OUTDOOR_LIGHTING_PROFILES.dusk, progress * 2)
      : blendProfile(OUTDOOR_LIGHTING_PROFILES.dusk, OUTDOOR_LIGHTING_PROFILES.night, (progress - 0.5) * 2);
  }
  if (p < 0.8) return blendProfile(OUTDOOR_LIGHTING_PROFILES.night, OUTDOOR_LIGHTING_PROFILES.night, 0);
  const progress = (p - 0.8) / 0.1;
  return progress < 0.5
    ? blendProfile(OUTDOOR_LIGHTING_PROFILES.night, OUTDOOR_LIGHTING_PROFILES.dawn, progress * 2)
    : blendProfile(OUTDOOR_LIGHTING_PROFILES.dawn, OUTDOOR_LIGHTING_PROFILES.noon, (progress - 0.5) * 2);
}

export function resolveOutdoorPresentationState(snapshotOrPhase) {
  const snapshot = typeof snapshotOrPhase === 'number' ? { phase: snapshotOrPhase } : snapshotOrPhase;
  const phase = wrapPhase(snapshot?.phase ?? 0);
  const timeOfDay = snapshot?.name ? snapshot : { ...snapshot, ...resolveOutdoorTimeOfDay(phase) };
  const skyWeights = Number.isFinite(snapshot?.dayWeight) ? snapshot : resolveOutdoorSkyWeights(phase);
  const profile = resolveOutdoorLightingProfile(phase);
  const duskWeight = timeOfDay.name === 'dusk' ? Math.sin(Math.PI * timeOfDay.progress) : 0;
  const dawnWeight = timeOfDay.name === 'dawn' ? Math.sin(Math.PI * timeOfDay.progress) : 0;
  const torchNeedLevel = timeOfDay.name === 'night' ? 1
    : timeOfDay.name === 'dusk' ? smooth(timeOfDay.progress)
      : timeOfDay.name === 'dawn' ? 1 - smooth(timeOfDay.progress) : 0;
  const sunCastsShadow = profile.keyIntensity > 0.03 && profile.elevation > 0.015 && skyWeights.nightWeight < 0.98;
  return {
    ...profile,
    phase,
    name: timeOfDay.name,
    progress: timeOfDay.progress,
    dayWeight: skyWeights.dayWeight,
    duskWeight,
    nightWeight: skyWeights.nightWeight,
    dawnWeight,
    redWeight: skyWeights.redWeight,
    sunElevation: profile.elevation,
    sunIntensity: profile.keyIntensity,
    naturalAmbientIntensity: profile.hemi,
    outdoorExposure: profile.exposure,
    torchNeedLevel,
    ordinaryEmissiveScale: 1 - torchNeedLevel,
    sunCastsShadow,
    moonCastsShadow: false,
    environmentIntensity: timeOfDay.name === 'night' ? 0 : 1,
    playerNaturalLightIntensity: 0,
    cameraNaturalLightIntensity: 0,
    fallbackExplorationLightEnabled: false,
  };
}

export class OutdoorLightingDirector {
  constructor({ scene, clock, qualityTier = 'mobile-balanced' } = {}) {
    this.scene = scene;
    this.clock = clock;
    this.qualityTier = qualityTier;
    this.hemisphere = new THREE.HemisphereLight();
    this.hemisphere.name = 'outdoor-cycle-hemisphere-light';
    this.key = new THREE.DirectionalLight();
    this.key.name = 'outdoor-cycle-primary-directional-light';
    this.key.castShadow = true;
    this.moon = new THREE.DirectionalLight();
    this.moon.name = 'outdoor-cycle-moon-fill';
    this.moon.castShadow = false;
    this.lightRegistry = getOutdoorLightSourceRegistry(scene);
    const high = qualityTier === 'desktop-high';
    this.shadowMapSize = high ? 2048 : 1024;
    this.shadowRadius = high ? 72 : 52;
    this.key.shadow.mapSize.set(this.shadowMapSize, this.shadowMapSize);
    this.key.shadow.camera.near = 3;
    this.key.shadow.camera.far = 210;
    this.key.shadow.bias = -0.00016;
    this.key.shadow.normalBias = 0.035;
    this.key.shadow.radius = 1.5;
    scene.add(this.hemisphere, this.key, this.key.target, this.moon, this.moon.target);
    this.lightRegistry.register(this.hemisphere, { name: this.hemisphere.name, owner: OUTDOOR_LIGHT_OWNER.WORLD, source: 'outdoor-day-night-cycle', global: true });
    this.lightRegistry.register(this.key, { name: this.key.name, owner: OUTDOOR_LIGHT_OWNER.WORLD, source: 'outdoor-sun-cycle', global: true });
    this.lightRegistry.register(this.moon, { name: this.moon.name, owner: OUTDOOR_LIGHT_OWNER.WORLD, source: 'outdoor-moon-cycle', global: true });
    if (!(scene.fog instanceof THREE.Fog)) scene.fog = new THREE.Fog(0xb5c7cd, 105, 470);
    scene.userData.outdoorLightingDirector = { qualityTier, shadowMapSize: this.shadowMapSize, primaryShadowCasters: 1 };
    this.waterMaterials = [];
    this.foliageMaterials = [];
    this.contactMaterials = [];
    this.ordinaryMaterials = [];
    this.torchDebug = {};
    const debugTokens = new Set((globalThis.location ? new URLSearchParams(globalThis.location.search).get('debug') ?? '' : '').split(','));
    if (globalThis.document && ['outdoor-lighting', 'outdoor-shadows', 'torch-lighting'].some((token) => debugTokens.has(token))) {
      this.debugPanel = document.querySelector('[data-outdoor-presentation-debug]') ?? document.body.appendChild(document.createElement('pre'));
      this.debugPanel.dataset.outdoorPresentationDebug = 'true';
      this.debugPanel.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;max-width:470px;padding:8px;background:#071018dd;color:#bfe8ff;font:11px/1.35 monospace;pointer-events:none;white-space:pre-wrap';
    }
  }

  bindSceneMaterials() {
    const water = new Set(); const foliage = new Set(); const contacts = new Set(); const ordinary = new Set();
    this.scene.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        if (material.userData?.outdoorWater) water.add(material);
        if (material.userData?.outdoorFoliage) foliage.add(material);
        if (material.userData?.outdoorFoliageContact) contacts.add(material);
        if (material.userData?.ordinaryOutdoorMaterial || ((material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial) && !material.userData?.authoredLuminousMaterial)) {
          material.userData.ordinaryOutdoorMaterial = true;
          material.userData.baseOutdoorEmissiveIntensity ??= material.emissiveIntensity ?? 0;
          ordinary.add(material);
        }
      });
    });
    this.waterMaterials = [...water]; this.foliageMaterials = [...foliage]; this.contactMaterials = [...contacts]; this.ordinaryMaterials = [...ordinary];
    Object.assign(this.scene.userData.outdoorLightingDirector, { waterMaterialCount: this.waterMaterials.length, foliageMaterialCount: this.foliageMaterials.length, contactMaterialCount: this.contactMaterials.length, ordinaryMaterialCount: this.ordinaryMaterials.length });
  }

  setTorchDebugState(state = {}) { this.torchDebug = state; }

  update(player = null) {
    const clockState = this.clock.getSnapshot();
    const state = resolveOutdoorPresentationState(clockState);
    this.hemisphere.color.copy(state.sky); this.hemisphere.groundColor.copy(state.ground); this.hemisphere.intensity = state.hemi;
    this.key.color.copy(state.key); this.key.intensity = state.sunIntensity;
    const shadowWasEnabled = this.key.castShadow;
    this.key.castShadow = state.sunCastsShadow;
    if (!shadowWasEnabled && this.key.castShadow) this.key.shadow.needsUpdate = true;
    this.moon.color.copy(state.moon); this.moon.intensity = state.moonIntensity; this.moon.castShadow = false;
    this.scene.fog.color.copy(state.fog); this.scene.fog.near = state.fogNear; this.scene.fog.far = state.fogFar; this.scene.background = state.fog.clone();
    this.scene.environmentIntensity = state.environmentIntensity;
    const angle = clockState.skyRotation + state.phase * Math.PI * 2;
    const center = player?.position ?? { x: 0, y: 0, z: 0 };
    const texel = (this.shadowRadius * 2) / this.shadowMapSize;
    const cx = Math.round(center.x / texel) * texel; const cz = Math.round(center.z / texel) * texel;
    const horizontal = 95 * Math.cos(state.sunElevation);
    this.key.position.set(cx + Math.sin(angle) * horizontal, 25 + Math.max(0, state.sunElevation) * 100, cz + Math.cos(angle) * horizontal);
    this.key.target.position.set(cx, center.y ?? 0, cz);
    this.moon.position.set(cx - Math.sin(angle) * 80, 65, cz - Math.cos(angle) * 80); this.moon.target.position.copy(this.key.target.position);
    if (this.key.castShadow) {
      const camera = this.key.shadow.camera; camera.left = camera.bottom = -this.shadowRadius; camera.right = camera.top = this.shadowRadius; camera.updateProjectionMatrix();
      this.key.target.updateMatrixWorld();
    }
    this.moon.target.updateMatrixWorld();
    this.waterMaterials.forEach((material) => updateOutdoorWaterMaterial(material, state, clockState));
    this.foliageMaterials.forEach((material) => updateOutdoorFoliageMaterial(material, state));
    this.contactMaterials.forEach((material) => { material.uniforms.intensity.value = state.sunCastsShadow ? 0.035 + 0.105 * state.sunIntensity : 0; });
    this.ordinaryMaterials.forEach((material) => { material.emissiveIntensity = material.userData.baseOutdoorEmissiveIntensity * state.ordinaryEmissiveScale; });
    this.exposure = state.outdoorExposure;
    const anonymousCameraLightsDisabled = state.name === 'night' ? this.lightRegistry.disableAnonymousCameraLights(player?.camera) : [];
    const unregisteredWorldLightsDisabled = state.name === 'night' ? this.lightRegistry.disableUnregisteredWorldLights() : [];
    const activeLights = this.lightRegistry.getActiveDiagnostics();
    this.scene.userData.outdoorActiveLightDiagnostics = activeLights;
    const torch = this.torchDebug;
    const activeShadowCasters = Number(this.key.castShadow) + Number(Boolean(torch.castShadow));
    this.debug = { ...clockState, ...state, exposure: state.outdoorExposure, shadowMapSize: this.shadowMapSize, shadowRadius: this.shadowRadius, texelSize: texel, snappedCenter: { x: cx, z: cz }, activeShadowCasters, torch, activeLights, anonymousCameraLightsDisabled, unregisteredWorldLightsDisabled };
    if (this.debugPanel) {
      const lightLines = this.lightRegistry.getDiagnostics().map((light) => `${light.active ? '*' : '-'} ${light.name} ${light.type} owner=${light.owner} source=${light.source} intensity=${light.intensity.toFixed(3)} range=${light.range.toFixed(2)} pos=${light.position.x.toFixed(1)},${light.position.y.toFixed(1)},${light.position.z.toFixed(1)} shadow=${light.castShadow} ${light.global ? 'global' : 'local'}`);
      this.debugPanel.textContent = `OUTDOOR ${state.name.toUpperCase()} phase ${state.phase.toFixed(4)}\nweights day/dusk/night/dawn ${state.dayWeight.toFixed(2)} ${state.duskWeight.toFixed(2)} ${state.nightWeight.toFixed(2)} ${state.dawnWeight.toFixed(2)}\nsun elev ${state.sunElevation.toFixed(3)} intensity ${state.sunIntensity.toFixed(3)} shadow ${this.key.castShadow}\nmoon ${state.moonIntensity.toFixed(3)} shadow false hemi ${state.hemi.toFixed(3)} environment ${state.environmentIntensity.toFixed(3)}\nfog #${state.fog.getHexString()} ${state.fogNear.toFixed(2)}-${state.fogFar.toFixed(2)} exposure ${state.outdoorExposure.toFixed(2)} emissive ${state.ordinaryEmissiveScale.toFixed(2)}\ntorch owned ${Boolean(torch.owned)} equipped ${Boolean(torch.equipped)} lit ${Boolean(torch.lit)}\ntorch intensity ${(torch.intensity ?? 0).toFixed(2)} range ${(torch.range ?? 0).toFixed(1)} shadow ${Boolean(torch.castShadow)}\nshadow lights ${activeShadowCasters} map ${this.shadowMapSize}px radius ${this.shadowRadius} texel ${texel.toFixed(3)}\nACTIVE/AUTHORED LIGHT SOURCES\n${lightLines.join('\n') || '(none)'}`;
    }
    return this.debug;
  }
}

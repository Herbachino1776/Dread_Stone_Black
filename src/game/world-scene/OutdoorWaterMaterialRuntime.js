import * as THREE from 'three';

export function createOutdoorWaterMaterial(profile = {}, { mode = 'pond', name = 'outdoor-water' } = {}) {
  const baseColor = new THREE.Color(profile.color ?? 0x58746c);
  const material = new THREE.MeshStandardMaterial({
    name,
    map: profile.map ?? null,
    color: baseColor,
    roughness: Math.max(0.62, profile.roughness ?? 0.84),
    metalness: 0,
    transparent: true,
    opacity: profile.opacity ?? 0.64,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: true,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  material.userData.outdoorWater = {
    mode,
    phase: 0,
    baseColor,
    flowSpeed: mode === 'flow' ? 0.018 : 0.006,
    rippleScale: mode === 'pond' ? 0.7 : 1.25,
  };
  return material;
}

export function updateOutdoorWaterMaterial(material, lighting, clockState) {
  const data = material?.userData?.outdoorWater;
  if (!data) return;
  data.phase = clockState?.phase ?? 0;
  const nightDarkening = 1 - (lighting.nightWeight ?? 0) * 0.82;
  material.color.copy(data.baseColor).multiplyScalar(nightDarkening).lerp(lighting.sky, 0.035 * nightDarkening);
  material.emissive.setHex(0x000000);
  material.emissiveIntensity = 0;
}

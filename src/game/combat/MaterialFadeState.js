import * as THREE from 'three';

export const FULLY_OPAQUE_THRESHOLD = 0.999;

export function clampFadeOpacity(opacity) {
  const value = Number(opacity);
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

export function captureAndPrepareFadeMaterials(materials, baselines) {
  const seen = new Set();
  for (const material of materials) {
    if (!material || seen.has(material)) continue;
    seen.add(material);
    baselines.set(material, {
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
      alphaTest: material.alphaTest,
    });
    const shaderStateChanged = material.transparent !== true || material.depthWrite !== false;
    material.transparent = true;
    material.depthWrite = false;
    if (shaderStateChanged) material.needsUpdate = true;
  }
}

export function applyFadeOpacity(baselines, opacity) {
  const value = clampFadeOpacity(opacity);
  baselines.forEach((baseline, material) => {
    material.opacity = baseline.opacity * value;
  });
  return value;
}

export function restoreFadeMaterials(baselines) {
  baselines.forEach((baseline, material) => {
    const shaderStateChanged = material.transparent !== baseline.transparent
      || material.depthWrite !== baseline.depthWrite
      || material.alphaTest !== baseline.alphaTest;
    material.opacity = baseline.opacity;
    material.transparent = baseline.transparent;
    material.depthWrite = baseline.depthWrite;
    material.alphaTest = baseline.alphaTest;
    if (shaderStateChanged) material.needsUpdate = true;
  });
  baselines.clear();
}

import * as THREE from 'three';

export class TorchFlickerController {
  constructor({ enabled = true } = {}) {
    this.enabled = enabled;
    this.time = 0;
    this.entries = [];
  }

  clear() {
    this.entries.length = 0;
  }

  registerFixture(fixture) {
    if (!fixture?.pointLight) return null;
    const entry = {
      pointLight: fixture.pointLight,
      flame: fixture.flame ?? null,
      flameOuter: fixture.flameOuter ?? null,
      flameInner: fixture.flameInner ?? null,
      glowMesh: fixture.glowMesh ?? null,
      baseIntensity: fixture.baseIntensity ?? fixture.pointLight.intensity,
      baseDistance: fixture.baseDistance ?? fixture.pointLight.distance,
      baseOuterOpacity: fixture.baseOuterOpacity ?? fixture.flameOuter?.material?.opacity ?? 0.82,
      baseInnerOpacity: fixture.baseInnerOpacity ?? fixture.flameInner?.material?.opacity ?? 0.9,
      baseGlowOpacity: fixture.baseGlowOpacity ?? fixture.glowMesh?.material?.opacity ?? 0,
      profile: fixture.profile ?? {},
      phase: fixture.phase ?? this.entries.length * 1.913,
      enabled: fixture.enabled !== false,
    };
    this.entries.push(entry);
    return entry;
  }

  registerFromObject(root) {
    if (!root) return;
    root.traverse?.((child) => {
      if (child.userData?.torchFixture) {
        this.registerFixture(child.userData.torchFixture);
      }
    });
  }

  update(deltaSeconds) {
    this.time += deltaSeconds;
    if (!this.enabled) return;

    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index];
      if (!entry.enabled) continue;
      const amount = entry.profile.flickerAmount ?? 0.11;
      const speed = entry.profile.flickerSpeed ?? 1;
      const phase = entry.phase;
      const t = this.time * speed;
      const slowPulse = Math.sin(t * 7.1 + phase) * amount;
      const fastPulse = Math.sin(t * 17.3 + phase * 2.17) * amount * 0.48;
      const emberPulse = Math.sin(t * 29.0 + phase * 0.61) * amount * 0.2;
      const flicker = THREE.MathUtils.clamp(1 + slowPulse + fastPulse + emberPulse, 0.78, 1.18);

      entry.pointLight.intensity = entry.baseIntensity * flicker;
      entry.pointLight.distance = entry.baseDistance * THREE.MathUtils.clamp(0.96 + (flicker - 1) * 0.35, 0.9, 1.05);

      const flameScale = THREE.MathUtils.clamp(0.96 + (flicker - 1) * 0.22, 0.9, 1.05);
      if (entry.flame) entry.flame.scale.setScalar(flameScale);
      if (entry.flameOuter?.material) entry.flameOuter.material.opacity = THREE.MathUtils.clamp(entry.baseOuterOpacity * (0.92 + flicker * 0.08), 0.55, 0.92);
      if (entry.flameInner?.material) entry.flameInner.material.opacity = THREE.MathUtils.clamp(entry.baseInnerOpacity * (0.88 + flicker * 0.12), 0.62, 0.96);
      if (entry.glowMesh?.material) entry.glowMesh.material.opacity = THREE.MathUtils.clamp(entry.baseGlowOpacity * (0.82 + flicker * 0.18), 0.08, entry.baseGlowOpacity * 1.18);
    }
  }
}

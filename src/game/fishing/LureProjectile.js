import * as THREE from 'three';
import { FishingLinePhysics } from './FishingLinePhysics.js';
import { FISH_BITE_SETTLE_MIN_MS, FISH_BITE_SETTLE_MAX_MS, LINE_SLACK_OPACITY, LINE_TAUT_OPACITY, LURE_RADIUS } from './CastingTuning.js';

export class LureProjectile {
  constructor({ scene, dungeon, waterResolver, onLanded, maxCastRange = 44 }) {
    this.scene = scene; this.dungeon = dungeon; this.waterResolver = waterResolver; this.onLanded = onLanded; this.maxCastRange = maxCastRange;
    this.physics = new FishingLinePhysics({ terrainSampler: dungeon?.outdoorTerrainRuntime }); this.position = this.physics.lurePosition; this.velocity = this.physics.lureVelocity; this.start = new THREE.Vector3();
    this.mesh = null; this.lineMesh = null; this.linePositions = null; this.active = false; this.landed = false; this.settleMs = 0; this.settleAgeMs = 0; this.pendingWaterZone = null; this.debug = { enabled: false, lureHitType: 'none', fishableWaterId: null };
  }
  ensureVisuals() {
    if (!this.mesh) {
      const group = new THREE.Group(); group.name = 'clean-bobber-metal-hook-weighted-lure-projectile';
      group.userData = { objectCategory: 'lureProjectile', lureType: 'clean-bobber-metal-hook', replacesUglyFakeWorm: true, weightedLureMass: this.physics.lureMass };
      const bobber = new THREE.Mesh(new THREE.SphereGeometry(LURE_RADIUS, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd8d2bd, roughness: 0.5 }));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 6), new THREE.MeshStandardMaterial({ color: 0x312219, roughness: 0.75 })); cap.position.y = 0.07;
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.01, 6, 14, Math.PI * 1.35), new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.45, metalness: 0.8 })); hook.position.y = -0.1; hook.rotation.x = Math.PI / 2;
      group.add(bobber, cap, hook); this.scene.add(group); this.mesh = group;
    }
    if (!this.lineMesh) {
      const points = this.physics.linePoints.length; this.linePositions = new Float32Array(points * 3);
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
      const material = new THREE.LineBasicMaterial({ color: 0xd8d0b8, transparent: true, opacity: LINE_SLACK_OPACITY, depthWrite: false });
      this.lineMesh = new THREE.Line(geometry, material); this.lineMesh.name = 'Rod-A1-dynamic-verlet-fishing-line-tension-visual'; this.lineMesh.userData = { dynamicSpoolLength: true, tensionOpacity: true, multiPointConstraintLine: true }; this.scene.add(this.lineMesh);
    }
  }
  syncVisuals() {
    this.ensureVisuals(); this.mesh.position.copy(this.physics.lurePosition);
    this.physics.linePoints.forEach((point, i) => { this.linePositions[i * 3] = point.x; this.linePositions[i * 3 + 1] = point.y; this.linePositions[i * 3 + 2] = point.z; });
    this.lineMesh.geometry.attributes.position.needsUpdate = true; this.lineMesh.material.opacity = THREE.MathUtils.lerp(LINE_SLACK_OPACITY, LINE_TAUT_OPACITY, THREE.MathUtils.clamp(this.physics.lineTension / 7, 0, 1));
  }
  readyAtRod(rodTip) { if (!rodTip) return; if (!this.mesh) this.physics.resetAtRodTip(rodTip); this.ensureVisuals(); this.physics.update(1 / 60, rodTip, { rodHeld: false }); this.active = false; this.landed = false; this.syncVisuals(); }
  launch(start, velocity) { this.cleanup(false); this.physics.resetAtRodTip(start); this.start.copy(start); this.physics.launch(start, velocity); this.active = true; this.landed = false; this.settleAgeMs = 0; this.pendingWaterZone = null; this.debug.lureHitType = 'airborne'; this.ensureVisuals(); this.syncVisuals(); }
  update(deltaSeconds, rodTip = null, options = {}) {
    const dt = Math.max(0, Math.min(0.05, deltaSeconds)); if (!rodTip) return;
    if (!this.mesh) this.readyAtRod(rodTip);
    this.physics.update(dt, rodTip, options); this.position = this.physics.lurePosition; this.velocity = this.physics.lureVelocity;
    if (this.active && this.physics.isLureAirborne) {
      const surfaceY = this.dungeon?.sampleFishLandingSurfaceY?.(this.physics.lurePosition) ?? 0; const tooFar = this.physics.lurePosition.distanceTo(this.start) > this.maxCastRange;
      if (this.physics.lurePosition.y <= surfaceY + 0.04 || tooFar) this.land(surfaceY, tooFar);
    } else if (this.landed && this.physics.isLureOnWater) {
      this.settleAgeMs += dt * 1000; if (this.settleAgeMs >= this.settleMs) this.finishWaterSettle();
    }
    this.syncVisuals();
  }
  land(surfaceY, forcedFail = false) {
    const zone = !forcedFail ? this.waterResolver?.resolveFishableWater(this.physics.lurePosition) : null; this.landed = true; this.active = false; this.pendingWaterZone = zone;
    if (zone?.fishSpeciesPool?.length) { this.physics.enterWater(surfaceY); this.settleMs = THREE.MathUtils.lerp(FISH_BITE_SETTLE_MIN_MS, FISH_BITE_SETTLE_MAX_MS, Math.random()); this.debug.lureHitType = 'fishable-water'; this.debug.fishableWaterId = zone.id ?? null; }
    else { this.physics.enterGround(surfaceY); this.debug.lureHitType = forcedFail ? 'max-range' : 'ground'; this.onLanded?.({ position: this.physics.lurePosition.clone(), zone: null, success: false, settled: false }); }
  }
  finishWaterSettle() { const zone = this.pendingWaterZone; this.pendingWaterZone = null; this.landed = false; this.onLanded?.({ position: this.physics.lurePosition.clone(), zone, success: Boolean(zone?.fishSpeciesPool?.length), settled: true }); }
  cleanup(removeVisuals = true) { if (removeVisuals) { if (this.mesh?.parent) this.mesh.parent.remove(this.mesh); if (this.lineMesh?.parent) this.lineMesh.parent.remove(this.lineMesh); this.mesh = null; this.lineMesh = null; this.linePositions = null; } this.active = false; this.landed = false; this.pendingWaterZone = null; }
  getDebugState() { return { ...this.physics.getDebugState(), lureHitType: this.debug.lureHitType, fishableWaterId: this.debug.fishableWaterId }; }
}

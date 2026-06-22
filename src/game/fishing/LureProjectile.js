import * as THREE from 'three';

export class LureProjectile {
  constructor({ scene, dungeon, waterResolver, onLanded, maxCastRange = 44 }) {
    this.scene = scene; this.dungeon = dungeon; this.waterResolver = waterResolver; this.onLanded = onLanded;
    this.gravity = -18; this.airDrag = 0.985; this.maxAgeSeconds = 4.5; this.maxCastRange = maxCastRange;
    this.position = new THREE.Vector3(); this.velocity = new THREE.Vector3(); this.start = new THREE.Vector3();
    this.mesh = null; this.active = false; this.landed = false;
  }
  launch(start, velocity) {
    this.cleanup();
    this.position.copy(start); this.start.copy(start); this.velocity.copy(velocity); this.age = 0; this.active = true; this.landed = false;
    const group = new THREE.Group(); group.name = 'clean-bobber-metal-hook-lure-projectile';
    group.userData = { objectCategory: 'lureProjectile', lureType: 'clean-bobber-metal-hook', replacesUglyFakeWorm: true };
    const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd8d2bd, roughness: 0.5 }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 6), new THREE.MeshStandardMaterial({ color: 0x312219, roughness: 0.75 })); cap.position.y = 0.07;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.01, 6, 14, Math.PI * 1.35), new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.45, metalness: 0.8 })); hook.position.y = -0.1; hook.rotation.x = Math.PI / 2;
    group.add(bobber, cap, hook); group.position.copy(this.position); this.scene.add(group); this.mesh = group;
  }
  update(deltaSeconds) {
    if (!this.active || this.landed) return;
    const dt = Math.max(0, Math.min(0.05, deltaSeconds)); this.age += dt;
    this.velocity.y += this.gravity * dt; this.velocity.multiplyScalar(this.airDrag);
    this.position.addScaledVector(this.velocity, dt); if (this.mesh) this.mesh.position.copy(this.position);
    const surfaceY = this.dungeon?.sampleFishLandingSurfaceY?.(this.position) ?? 0;
    const tooFar = this.position.distanceTo(this.start) > this.maxCastRange;
    if (this.position.y <= surfaceY + 0.04 || this.age >= this.maxAgeSeconds || tooFar) this.land(surfaceY);
  }
  land(surfaceY) {
    this.landed = true; this.active = false; this.position.y = surfaceY + 0.04; if (this.mesh) this.mesh.position.copy(this.position);
    const zone = this.waterResolver?.resolveFishableWater(this.position);
    this.onLanded?.({ position: this.position.clone(), zone, success: Boolean(zone?.fishSpeciesPool?.length) });
  }
  cleanup() { if (this.mesh?.parent) this.mesh.parent.remove(this.mesh); this.mesh = null; this.active = false; this.landed = false; }
}

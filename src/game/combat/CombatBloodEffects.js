import * as THREE from 'three';
import { BLOOD_COLOR_PALETTE, BLOOD_EFFECT_CONFIG } from './CombatStage2Config.js';

const dummy = new THREE.Object3D();
const tmpDirection = new THREE.Vector3();

export class CombatBloodEffects {
  constructor({ scene, woundSystem, physiology, groundY = 0, wallX = null, eventSink = null } = {}) {
    this.scene = scene;
    this.woundSystem = woundSystem;
    this.physiology = physiology;
    this.groundY = groundY;
    this.wallX = wallX;
    this.eventSink = eventSink;
    this.elapsed = 0;
    this.particles = Array.from({ length: BLOOD_EFFECT_CONFIG.maximumParticles }, () => ({ active: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, lifetime: 0, woundId: null, kind: 'drop' }));
    this.decals = [];
    this.nextDecal = 0;
    this.material = new THREE.MeshStandardMaterial({ color: BLOOD_COLOR_PALETTE.spray, roughness: 0.78, metalness: 0.02 });
    this.decalMaterial = new THREE.MeshStandardMaterial({ color: BLOOD_COLOR_PALETTE.pooled, roughness: 0.93, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.86, depthWrite: false });
    this.particleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(BLOOD_EFFECT_CONFIG.particleRadius, 5, 4), this.material, BLOOD_EFFECT_CONFIG.maximumParticles);
    this.particleMesh.name = 'pooled-world-wound-blood-particles';
    this.particleMesh.castShadow = false;
    this.particleMesh.receiveShadow = true;
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
    this.createDecalPool();
    this.updateInstances();
  }

  setEventSink(eventSink) { this.eventSink = eventSink; }

  createDecalPool() {
    const geometry = new THREE.CircleGeometry(1, 10);
    for (let index = 0; index < BLOOD_EFFECT_CONFIG.maximumDecals; index += 1) {
      const mesh = new THREE.Mesh(geometry, this.decalMaterial);
      mesh.name = `pooled-combat-blood-world-mark-${index}`;
      mesh.visible = false;
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      this.decals.push({ mesh, active: false, createdTime: 0, kind: 'ground' });
    }
    this.decalGeometry = geometry;
  }

  emitEntry(wound, severity = 0.2) {
    const count = Math.min(BLOOD_EFFECT_CONFIG.entryBurstMaximum, 1 + Math.floor(severity * 4));
    this.emitBurst(wound, count, 'entry', wound?.localPenetrationAxis?.clone?.().negate?.());
  }

  emitWithdrawal(wound, direction = null) {
    const count = Math.min(BLOOD_EFFECT_CONFIG.withdrawalBurstMaximum, 2 + Math.floor((wound?.severity ?? 0) * 5));
    this.emitBurst(wound, count, 'withdrawal', direction);
    if (count >= 4) this.eventSink?.('blood_spray', { position: this.woundSystem.getWorldPose(wound)?.point, severity: wound?.severity ?? 0.3 });
  }

  emitSlash(wound, direction = null) {
    const count = Math.min(BLOOD_EFFECT_CONFIG.slashBurstMaximum, 1 + Math.floor((wound?.severity ?? 0) * 4));
    this.emitBurst(wound, count, 'slash', direction);
  }

  emitBurst(wound, count, kind, direction = null) {
    const pose = this.woundSystem.getWorldPose(wound);
    if (!pose || !wound || wound.bleedingProfile.kind === 'none') return;
    for (let index = 0; index < count; index += 1) {
      const outward = direction?.clone?.() ?? pose.normal.clone();
      outward.normalize();
      outward.x += (Math.random() - 0.5) * 0.38;
      outward.y += (Math.random() - 0.2) * 0.32;
      outward.z += (Math.random() - 0.5) * 0.38;
      const speed = kind === 'withdrawal' ? 0.8 + Math.random() * 1.1 : kind === 'slash' ? 0.55 + Math.random() * 0.9 : 0.35 + Math.random() * 0.65;
      this.spawnParticle(wound, pose.point, outward.normalize().multiplyScalar(speed), kind);
    }
  }

  spawnParticle(wound, position, velocity, kind = 'drop') {
    const particle = this.particles.find((entry) => !entry.active) ?? this.particles.reduce((oldest, entry) => entry.life > oldest.life ? entry : oldest, this.particles[0]);
    particle.active = true;
    particle.position.copy(position).addScaledVector(velocity, 0.006);
    particle.velocity.copy(velocity);
    particle.life = 0;
    particle.lifetime = BLOOD_EFFECT_CONFIG.maximumLifetime * (0.65 + Math.random() * 0.35);
    particle.woundId = wound.id;
    particle.kind = kind;
    wound.bloodEmitted += 1;
  }

  update(dt) {
    this.elapsed += dt;
    this.emitContinuous(dt);
    this.particles.forEach((particle) => {
      if (!particle.active) return;
      particle.life += dt;
      particle.velocity.y += BLOOD_EFFECT_CONFIG.gravity * dt;
      particle.position.addScaledVector(particle.velocity, dt);
      if (particle.position.y <= this.groundY + 0.008) {
        if (particle.velocity.length() >= BLOOD_EFFECT_CONFIG.decalMinimumSpeed) this.placeDecal(particle.position, 'ground', particle.velocity.length());
        particle.active = false;
      } else if (this.wallX != null && particle.position.x <= this.wallX && particle.velocity.x < 0) {
        this.placeDecal(particle.position, 'wall', particle.velocity.length());
        particle.active = false;
      } else if (particle.life >= particle.lifetime) particle.active = false;
    });
    this.updateInstances();
  }

  emitContinuous(dt) {
    const circulation = this.physiology?.circulation ?? 0;
    if (circulation <= 0.005) return;
    (this.woundSystem?.getActiveWounds?.() ?? []).forEach((wound) => {
      if (wound.directedBloodReady === false) return;
      if (wound.bleedingRate <= 0.0001) return;
      wound.effectAccumulator = (wound.effectAccumulator ?? 0) + dt;
      const arterial = wound.bleedingProfile.kind.includes('arterial');
      const interval = arterial ? BLOOD_EFFECT_CONFIG.arterialPulseInterval : wound.bleedingProfile.kind === 'venous' || wound.bleedingProfile.kind === 'major_venous' ? BLOOD_EFFECT_CONFIG.venousDripInterval : BLOOD_EFFECT_CONFIG.capillaryDripInterval;
      const pulseInterval = interval / Math.max(0.35, circulation);
      if (wound.effectAccumulator < pulseInterval) return;
      wound.effectAccumulator %= pulseInterval;
      const pose = this.woundSystem.getWorldPose(wound);
      if (!pose) return;
      if (arterial) {
        const count = Math.max(1, Math.ceil(BLOOD_EFFECT_CONFIG.arterialPulseParticles * circulation * (wound.embeddedWeaponId ? 0.35 : 1)));
        for (let index = 0; index < count; index += 1) {
          tmpDirection.copy(pose.normal).multiplyScalar(0.8 + circulation * 1.45).add(new THREE.Vector3((Math.random() - 0.5) * 0.22, 0.18 + Math.random() * 0.22, (Math.random() - 0.5) * 0.22));
          this.spawnParticle(wound, pose.point, tmpDirection, 'arterial-pulse');
        }
      } else {
        this.spawnParticle(wound, pose.point, new THREE.Vector3((Math.random() - 0.5) * 0.08, -0.08, (Math.random() - 0.5) * 0.08), 'gravity-drip');
        this.eventSink?.('blood_drop', { position: pose.point, severity: wound.severity });
      }
    });
  }

  placeDecal(position, kind = 'ground', speed = 0.5) {
    const decal = this.decals[this.nextDecal % this.decals.length];
    this.nextDecal += 1;
    decal.active = true;
    decal.kind = kind;
    decal.createdTime = this.elapsed;
    decal.mesh.visible = true;
    const radius = THREE.MathUtils.clamp(0.025 + speed * 0.018, 0.025, 0.085);
    decal.mesh.scale.set(radius * (0.7 + Math.random() * 0.5), radius, 1);
    if (kind === 'wall') {
      decal.mesh.position.set(this.wallX + 0.006, position.y, position.z);
      decal.mesh.rotation.set(0, Math.PI / 2, Math.random() * Math.PI);
    } else {
      decal.mesh.position.set(position.x, this.groundY + 0.009, position.z);
      decal.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    }
  }

  updateInstances() {
    this.particles.forEach((particle, index) => {
      if (particle.active) {
        dummy.position.copy(particle.position);
        const lifeScale = Math.max(0.35, 1 - particle.life / Math.max(0.001, particle.lifetime) * 0.55);
        dummy.scale.set(lifeScale, lifeScale * (particle.kind === 'arterial-pulse' ? 1.7 : 1.15), lifeScale);
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0.0001);
      }
      dummy.updateMatrix();
      this.particleMesh.setMatrixAt(index, dummy.matrix);
    });
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.particleMesh.computeBoundingSphere();
  }

  clear() {
    this.particles.forEach((particle) => { particle.active = false; particle.woundId = null; particle.life = 0; });
    this.decals.forEach((decal) => { decal.active = false; decal.mesh.visible = false; });
    this.nextDecal = 0;
    this.updateInstances();
  }

  getDiagnostics() {
    return { particles: this.particles.filter((particle) => particle.active).length, particleLimit: this.particles.length, decals: this.decals.filter((decal) => decal.active).length, decalLimit: this.decals.length, approximateBytes: this.particles.length * 96 + this.decals.length * 48 };
  }

  dispose() {
    this.clear();
    this.particleMesh.geometry.dispose();
    this.particleMesh.removeFromParent();
    this.material.dispose();
    this.decals.forEach((decal) => decal.mesh.removeFromParent());
    this.decalGeometry.dispose();
    this.decalMaterial.dispose();
    this.decals = [];
  }
}

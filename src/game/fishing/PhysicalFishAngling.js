import * as THREE from 'three';
import { createFishMesh, FISH_SPECS } from './FishMeshFactory.js';
import { chooseFishSizeGroup, resolveFishSizeGroup } from './FishSizeGroups.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export class PhysicalFishAngling {
  constructor({ scene, dungeon, feedback = null }) {
    this.scene = scene; this.dungeon = dungeon; this.feedback = feedback;
    this.actor = null; this.zone = null; this.spawnTimer = 0; this.breachTimer = 2.5; this.rng = Math.random;
  }

  update(dt, { player = null, lure = null, rodTip = null, manualReelRate = 0, rodState = null, physics = null } = {}) {
    if (!player?.position || !this.dungeon?.isOutdoorSurvivalArea?.()) return;
    const nearbyZone = this.dungeon.getNearbyFishingZone?.(player.position) ?? this.dungeon.fieldFishingZones?.find?.((zone) => this.pointInZone(player.position, zone));
    if (!nearbyZone?.fishSpeciesPool?.length) { this.despawn(); return; }
    if (!this.actor || this.zone?.id !== nearbyZone.id) this.spawn(nearbyZone, player.position);
    if (!this.actor) return;
    this.zone = nearbyZone;
    this.actor.age += dt; this.actor.stateAge += dt;
    this.updateBreach(dt);
    this.updateLureAwareness(dt, lure, physics);
    this.updateStateMotion(dt, { player, lure, rodTip, manualReelRate, rodState, physics });
    this.syncVisual();
  }

  spawn(zone, playerPosition) {
    this.despawn();
    const species = this.selectSpecies(zone);
    const sizeGroup = chooseFishSizeGroup(this.rng());
    const size = resolveFishSizeGroup(sizeGroup);
    const mesh = createFishMesh(FISH_SPECS[species] ? species : 'smallRiverFish', { id: `physical_${species}`, baseUserData: { objectCategory: 'physicalPondFish', fishSpecies: species, fishSizeGroup: sizeGroup } });
    mesh.name = `physical-${sizeGroup}-${species}-pond-fish-actor`;
    mesh.scale.multiplyScalar(size.scale);
    this.scene.add(mesh);
    const position = this.randomPointInZone(zone, playerPosition);
    const surfaceY = this.dungeon.sampleFishLandingSurfaceY?.(position, zone) ?? position.y ?? 0;
    position.y = surfaceY - 0.28;
    this.actor = { mesh, species, sizeGroup, size, state: 'idle', stateAge: 0, age: 0, position, velocity: new THREE.Vector3(), target: position.clone(), interest: 0, lowRodSeconds: 0, hooked: false, lastLure: null };
    this.breachTimer = 1.8 + this.rng() * 3.2;
    this.syncVisual();
  }

  despawn() { if (this.actor?.mesh?.parent) this.actor.mesh.parent.remove(this.actor.mesh); this.actor = null; }
  setState(state) { if (this.actor?.state === state) return; this.actor.state = state; this.actor.stateAge = 0; }

  updateBreach(dt) {
    if (!['idle', 'aware'].includes(this.actor.state)) return;
    this.breachTimer -= dt;
    if (this.breachTimer > 0) return;
    this.setState('breach');
    this.actor.velocity.y = 1.2;
    this.makeSplash(this.actor.position, 0.55);
    this.breachTimer = 5 + this.rng() * 8;
  }

  updateLureAwareness(dt, lure, physics) {
    if (!lure || !physics?.isLureOnWater || this.actor.hooked) return;
    const distance = this.horizontalDistance(this.actor.position, lure.position);
    const lureSpeed = lure.velocity?.length?.() ?? 0;
    this.actor.lastLure = lure.position.clone();
    if (distance < 0.42 && this.actor.stateAge < 0.8 && this.actor.state !== 'spooked') {
      this.setState('spooked'); this.makeSplash(this.actor.position, 0.4); return;
    }
    if (distance < 5.8) {
      const work = THREE.MathUtils.clamp(lureSpeed * 0.22 + Math.max(0, physics.lineTension) * 0.045, 0.04, 0.8);
      this.actor.interest = THREE.MathUtils.clamp(this.actor.interest + work * dt * this.actor.size.hookEase, 0, 1.5);
      if (this.actor.interest > 0.35) this.setState(this.actor.interest > 0.86 ? 'chasingLure' : 'aware');
    } else {
      this.actor.interest = Math.max(0, this.actor.interest - dt * 0.18);
    }
  }

  updateStateMotion(dt, { player, lure, rodTip, manualReelRate, rodState, physics }) {
    const a = this.actor;
    const surfaceY = this.dungeon.sampleFishLandingSurfaceY?.(a.position, this.zone) ?? a.position.y;
    if (a.state === 'breach' && a.stateAge > 0.75) { a.position.y = surfaceY - 0.22; this.setState('idle'); }
    if (a.state === 'spooked') {
      tmp.copy(a.position).sub(player.position).setY(0).normalize(); a.velocity.addScaledVector(tmp, dt * 5.5); if (a.stateAge > 1.2) this.setState('idle');
    } else if (a.state === 'aware' && a.lastLure) {
      this.seek(a.lastLure, dt, 0.8);
    } else if (a.state === 'chasingLure' && a.lastLure) {
      this.seek(a.lastLure, dt, 1.7 / a.size.reelWeight);
      if (this.horizontalDistance(a.position, a.lastLure) < 0.34 + (a.sizeGroup === 'large' ? 0.12 : 0)) this.hookFish(physics);
    } else if (a.state === 'hooked') {
      const rodUp = (rodTip?.y ?? 0) > (player.position.y ?? 0) + 0.85 && (rodState?.rodPitch ?? 0) > -0.62;
      a.lowRodSeconds = rodUp ? Math.max(0, a.lowRodSeconds - dt * 1.4) : a.lowRodSeconds + dt;
      if (a.lowRodSeconds > 1.6) { this.escape(physics); return; }
      if (rodTip && manualReelRate > 0) this.seek(rodTip, dt, (1.15 + manualReelRate * 0.55) / a.size.reelWeight);
      tmp.copy(a.position).sub(rodTip ?? player.position).setY(0); if (tmp.lengthSq() > 0.001) a.velocity.addScaledVector(tmp.normalize(), dt * a.size.fightStrength * 0.9);
      if (this.horizontalDistance(a.position, player.position) < 2.15) this.land(player, physics);
    }
    a.velocity.multiplyScalar(Math.pow(0.82, dt * 60));
    a.position.addScaledVector(a.velocity, dt);
    this.clampToZone(a.position);
    if (a.state !== 'breach') a.position.y = THREE.MathUtils.lerp(a.position.y, surfaceY - 0.25, dt * 5);
    if (a.state === 'hooked' && physics?.lurePosition) {
      physics.lurePosition.copy(a.position);
      physics.lurePosition.y = surfaceY - 0.08;
      physics.lureVelocity.copy(a.velocity);
      physics.isLureOnWater = true;
      physics.isLureAirborne = false;
      physics.isLureGrounded = false;
      physics.isLureHeldNearRod = false;
    }
  }

  seek(target, dt, speed) { tmp.copy(target).sub(this.actor.position).setY(0); if (tmp.lengthSq() > 0.001) this.actor.velocity.addScaledVector(tmp.normalize(), speed * dt); }
  hookFish(physics) { this.actor.hooked = true; this.setState('hooked'); this.makeSplash(this.actor.position, 0.7); this.feedback?.shake?.({ durationMs: 210, intensity: 0.075 }); navigator.vibrate?.([18, 24, 18]); if (physics) { physics.isFishHooked = true; physics.isCasting = false; physics.lureRecoveryState = 'hookedFish'; physics.lineTension = Math.max(physics.lineTension, 8); } }
  escape(physics) { this.actor.hooked = false; this.setState('lost'); this.makeSplash(this.actor.position, 0.75); if (physics) { physics.isFishHooked = false; physics.lureRecoveryState = 'deployedWater'; physics.lineTension = 0; } setTimeout(() => this.actor && this.setState('idle'), 900); }
  land(player, physics) { const { species, sizeGroup } = this.actor; const pos = this.actor.position.clone(); this.setState('reeledToShore'); this.despawn(); this.dungeon.spawnRawFishPickupAtPosition?.(pos, this.zone, player, { fishSpecies: species, fishSizeGroup: sizeGroup }); if (physics) { physics.isFishHooked = false; physics.lureRecoveryState = 'deployedWater'; physics.lineTension = 0; } }

  makeSplash(position, scale = 0.5) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12 * scale, 0.22 * scale, 24), new THREE.MeshBasicMaterial({ color: 0xbfe7df, transparent: true, opacity: 0.58, side: THREE.DoubleSide }));
    ring.name = 'physical-fish-nontext-splash-ring'; ring.rotation.x = -Math.PI / 2; ring.position.copy(position); ring.position.y = (this.dungeon.sampleFishLandingSurfaceY?.(position, this.zone) ?? position.y) + 0.018; this.scene.add(ring);
    const start = performance.now(); const tick = () => { const t = (performance.now() - start) / 620; if (t >= 1) { ring.parent?.remove(ring); return; } ring.scale.setScalar(1 + t * 3); ring.material.opacity = 0.58 * (1 - t); requestAnimationFrame(tick); }; tick();
  }

  syncVisual() { const a = this.actor; if (!a) return; a.mesh.position.copy(a.position); if (a.velocity.lengthSq() > 0.001) a.mesh.rotation.y = Math.atan2(a.velocity.x, a.velocity.z) + Math.PI / 2; if (a.state === 'breach') a.mesh.rotation.z = Math.sin(a.stateAge * 12) * 0.28; else a.mesh.rotation.z = 0; }
  selectSpecies(zone) { const pool = zone?.fishSpeciesPool?.length ? zone.fishSpeciesPool : ['smallRiverFish']; return pool[Math.floor(this.rng() * pool.length)] ?? 'smallRiverFish'; }
  pointInZone(p, z) { if (!z) return false; const dx = p.x - z.centerX; const dz = p.z - z.centerZ; return z.shape === 'ellipse' ? (dx * dx) / (z.radiusX * z.radiusX) + (dz * dz) / (z.radiusZ * z.radiusZ) <= 1 : p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ; }
  randomPointInZone(zone, near) { for (let i = 0; i < 8; i += 1) { const p = new THREE.Vector3(zone.centerX + (this.rng() * 2 - 1) * zone.radiusX * 0.68, 0, zone.centerZ + (this.rng() * 2 - 1) * zone.radiusZ * 0.68); if (this.pointInZone(p, zone) && (!near || this.horizontalDistance(p, near) > 3)) return p; } return new THREE.Vector3(zone.centerX, 0, zone.centerZ); }
  clampToZone(p) { if (!this.zone || this.pointInZone(p, this.zone)) return; tmp.set(this.zone.centerX ?? p.x, p.y, this.zone.centerZ ?? p.z); p.lerp(tmp, 0.08); }
  horizontalDistance(a, b) { return tmp2.copy(a).setY(0).distanceTo(tmp.copy(b).setY(0)); }
}

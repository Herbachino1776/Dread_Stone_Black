import * as THREE from 'three';
import { createFishMesh, FISH_SPECS } from './FishMeshFactory.js';
import { chooseFishSizeGroup, resolveFishSizeGroup } from './FishSizeGroups.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const tmp3 = new THREE.Vector3();

const HOOK_LANDING_DISTANCE = 2.75;
const HOOKED_LANDING_LINE_THRESHOLD = 0.92;
const HOOKED_REEL_TARGET_CYCLES = Object.freeze({ small: 19, medium: 25, large: 39 });
const HOOKED_REEL_PULL_BASE = 9.5;
const HOOKED_REEL_PULL_RATE_SCALE = 2.4;
const HOOKED_FIGHT_BACKDRAG_SCALE = 0.42;
const HOOKED_LANDING_RECENT_REEL_SECONDS = 0.75;
const HOOKED_MIN_FIGHT_SECONDS = 0.5;
const HOOK_LIFT_HEIGHT = 0.82;
const HOOK_LIFT_SECONDS = 0.46;
const HOOK_LAND_SECONDS = 0.38;
const HOOK_LANDING_FORWARD_OFFSET = 1.45;
const HOOK_ZONE_EXIT_DISTANCE = 3.15;
const SAFE_GROUND_FALLBACK_DISTANCE = 1.05;

export class PhysicalFishAngling {
  constructor({ scene, dungeon, feedback = null }) {
    this.scene = scene; this.dungeon = dungeon; this.feedback = feedback;
    this.actor = null; this.zone = null; this.spawnTimer = 0; this.breachTimer = 2.5; this.rng = Math.random;
  }

  update(dt, { player = null, lure = null, rodTip = null, manualReelRate = 0, reelClockwiseRadians = 0, rodState = null, physics = null } = {}) {
    if (!player?.position) return;
    if (!this.dungeon?.isOutdoorSurvivalArea?.()) {
      this.cancelHookedFish(physics, 'leftOutdoorArea');
      this.despawn();
      return;
    }
    const nearbyZone = this.dungeon.getNearbyFishingZone?.(player.position) ?? this.dungeon.fieldFishingZones?.find?.((zone) => this.pointInZone(player.position, zone));
    const fightOwnsZone = this.actor && (this.actor.hooked || ['liftingFromWater', 'landedAttached'].includes(this.actor.state));
    const activeZone = fightOwnsZone ? this.zone : nearbyZone;
    if (!activeZone?.fishSpeciesPool?.length) { this.cancelHookedFish(physics, 'leftFishingZone'); this.despawn(); return; }
    if (!this.actor || (!fightOwnsZone && this.zone?.id !== activeZone.id)) this.spawn(activeZone, player.position);
    if (!this.actor) return;
    this.zone = activeZone;
    this.actor.age += dt; this.actor.stateAge += dt;
    this.updateBreach(dt);
    this.updateLureAwareness(dt, lure, physics);
    this.updateStateMotion(dt, { player, lure, rodTip, manualReelRate, reelClockwiseRadians, rodState, physics });
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
    this.actor = { mesh, species, sizeGroup, size, state: 'idle', stateAge: 0, age: 0, position, velocity: new THREE.Vector3(), target: position.clone(), liftStart: null, liftPeak: null, landingPoint: null, interest: 0, lowRodSeconds: 0, recentReelSeconds: 0, hooked: false, hookedAge: 0, landingTriggered: false, landingSpawned: false, lastLure: null, hookedReelCycles: 0, landingReason: 'none', lastReelPull: 0 };
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

  updateStateMotion(dt, { player, lure, rodTip, manualReelRate, reelClockwiseRadians, rodState, physics }) {
    const a = this.actor;
    const surfaceY = this.dungeon.sampleFishLandingSurfaceY?.(a.position, this.zone) ?? a.position.y;
    if (a.state === 'breach' && a.stateAge > 0.75) { a.position.y = surfaceY - 0.22; this.setState('idle'); }
    if (a.hooked) {
      a.hookedAge += dt;
      a.recentReelSeconds = manualReelRate > 0.05 ? HOOKED_LANDING_RECENT_REEL_SECONDS : Math.max(0, a.recentReelSeconds - dt);
      if (reelClockwiseRadians > 0) a.hookedReelCycles += reelClockwiseRadians / (Math.PI * 2);
    }
    if (a.state === 'spooked') {
      tmp.copy(a.position).sub(player.position).setY(0).normalize(); a.velocity.addScaledVector(tmp, dt * 5.5); if (a.stateAge > 1.2) this.setState('idle');
    } else if (a.state === 'aware' && a.lastLure) {
      this.seek(a.lastLure, dt, 0.8);
    } else if (a.state === 'chasingLure' && a.lastLure) {
      this.seek(a.lastLure, dt, 1.7 / a.size.reelWeight);
      if (this.horizontalDistance(a.position, a.lastLure) < 0.34 + (a.sizeGroup === 'large' ? 0.12 : 0)) this.hookFish(physics);
    } else if (a.state === 'hookedWater' || a.state === 'draggingToShore') {
      const rodUp = (rodTip?.y ?? 0) > (player.position.y ?? 0) + 0.85 && (rodState?.rodPitch ?? 0) > -0.62;
      a.lowRodSeconds = rodUp ? Math.max(0, a.lowRodSeconds - dt * 1.4) : a.lowRodSeconds + dt;
      if (a.lowRodSeconds > 1.6) { this.escape(physics); return; }
      if (manualReelRate > 0.05 && a.state === 'hookedWater') this.setState('draggingToShore');
      const pullTarget = rodTip ?? player.position;
      if (rodTip && manualReelRate > 0) {
        a.lastReelPull = (HOOKED_REEL_PULL_BASE + manualReelRate * HOOKED_REEL_PULL_RATE_SCALE) / a.size.reelWeight;
        this.seek(pullTarget, dt, a.lastReelPull);
      } else {
        a.lastReelPull = 0;
      }
      tmp.copy(a.position).sub(pullTarget).setY(0); if (tmp.lengthSq() > 0.001) a.velocity.addScaledVector(tmp.normalize(), dt * a.size.fightStrength * HOOKED_FIGHT_BACKDRAG_SCALE);
      this.updateHookedDebug(physics, rodUp);
      const landingReason = this.getLandingReason(a, physics);
      if (landingReason) this.beginLanding(player, rodTip, physics, landingReason);
    } else if (a.state === 'liftingFromWater') {
      this.updateLift(dt, physics);
    } else if (a.state === 'landedAttached') {
      this.updateLandedAttached(dt, player, physics);
    }
    const landingState = ['liftingFromWater', 'landedAttached'].includes(a.state);
    if (!landingState) {
      a.velocity.multiplyScalar(Math.pow(0.82, dt * 60));
      a.position.addScaledVector(a.velocity, dt);
      if (a.hooked && this.horizontalDistance(a.position, player.position) <= HOOK_ZONE_EXIT_DISTANCE) this.clampToZone(a.position, 0.015);
      else this.clampToZone(a.position);
      if (a.state !== 'breach') a.position.y = THREE.MathUtils.lerp(a.position.y, surfaceY - 0.25, dt * 5);
    }
    if ((a.state === 'hookedWater' || a.state === 'draggingToShore') && physics?.lurePosition) {
      physics.lurePosition.copy(a.position);
      physics.lurePosition.y = surfaceY - 0.08;
      physics.lureVelocity.copy(a.velocity);
      physics.isLureOnWater = true;
      physics.isLureAirborne = false;
      physics.isLureGrounded = false;
      physics.isLureHeldNearRod = false;
    } else if (landingState && physics?.lurePosition) {
      physics.lurePosition.copy(a.position);
      physics.lureVelocity.copy(a.velocity);
      physics.isLureOnWater = false;
      physics.isLureAirborne = a.state === 'liftingFromWater';
      physics.isLureGrounded = a.state === 'landedAttached';
      physics.isLureHeldNearRod = false;
      physics.lureRecoveryState = 'hookedFishLanding';
    }
  }

  seek(target, dt, speed) { tmp.copy(target).sub(this.actor.position).setY(0); if (tmp.lengthSq() > 0.001) this.actor.velocity.addScaledVector(tmp.normalize(), speed * dt); }
  hookFish(physics) { this.actor.hooked = true; this.actor.hookedAge = 0; this.actor.recentReelSeconds = 0; this.actor.hookedReelCycles = 0; this.actor.landingReason = 'none'; this.actor.landingTriggered = false; this.setState('hookedWater'); this.makeSplash(this.actor.position, 0.7); this.feedback?.shake?.({ durationMs: 210, intensity: 0.075 }); navigator.vibrate?.([18, 24, 18]); if (physics) { physics.isFishHooked = true; physics.hookedReelWeight = this.actor.size.reelWeight; physics.isCasting = false; physics.lureRecoveryState = 'hookedFish'; physics.lineTension = Math.max(physics.lineTension, 8); this.updateHookedDebug(physics, true); } }
  escape(physics) { this.actor.hooked = false; this.actor.hookedAge = 0; this.actor.landingTriggered = false; this.actor.landingReason = 'lost'; this.setState('lost'); this.makeSplash(this.actor.position, 0.75); this.cleanupHookedPhysics(physics, 'lost'); setTimeout(() => this.actor && this.setState('idle'), 900); }

  cancelHookedFish(physics, reason = 'lost') {
    if (!this.actor?.hooked && !physics?.isFishHooked) return;
    if (this.actor) {
      this.actor.hooked = false;
      this.actor.hookedAge = 0;
      this.actor.landingTriggered = false;
      this.actor.landingReason = reason;
      this.setState('lost');
    }
    this.cleanupHookedPhysics(physics, reason);
  }

  getLandingReason(a, physics) {
    if (!a.hooked || a.landingTriggered || a.landingSpawned || !physics?.isFishHooked) return null;
    const shortLine = physics.currentLineLength <= (physics.minLineLength ?? 0) + HOOKED_LANDING_LINE_THRESHOLD;
    const activeReel = a.recentReelSeconds > 0;
    const foughtLongEnough = a.hookedAge >= HOOKED_MIN_FIGHT_SECONDS;
    if (shortLine && activeReel && foughtLongEnough) return 'shortLineRecentReel';
    return null;
  }

  beginLanding(player, rodTip, physics, landingReason = 'shortLineRecentReel') {
    const a = this.actor;
    if (a.landingTriggered || a.landingSpawned) return;
    a.landingTriggered = true;
    a.landingReason = landingReason;
    a.hooked = false;
    a.liftStart = a.position.clone();
    a.landingPoint = this.resolveLandingPoint(a.position, player);
    a.liftPeak = a.liftStart.clone().lerp(a.landingPoint, 0.58);
    a.liftPeak.y = Math.max(a.liftStart.y, a.landingPoint.y) + HOOK_LIFT_HEIGHT;
    a.velocity.set(0, 0, 0);
    this.setState('liftingFromWater');
    if (physics) {
      physics.isFishHooked = false;
      physics.isLureOnWater = false;
      physics.isLureAirborne = true;
      physics.isLureGrounded = false;
      physics.isLureHeldNearRod = false;
      physics.lureRecoveryState = 'hookedFishLanding';
      physics.lineTension = Math.max(physics.lineTension, 6);
      this.updateHookedDebug(physics, true);
    }
  }

  updateLift(dt, physics) {
    const a = this.actor;
    const t = THREE.MathUtils.clamp(a.stateAge / HOOK_LIFT_SECONDS, 0, 1);
    const mid = a.liftPeak ?? a.position;
    a.position.lerpVectors(a.liftStart ?? a.position, mid, t);
    a.position.lerp(a.landingPoint ?? a.position, t * t);
    if (t >= 1) {
      a.position.copy(a.landingPoint);
      a.velocity.set(0, 0, 0);
      this.setState('landedAttached');
      if (physics) { physics.isLureAirborne = false; physics.isLureGrounded = true; physics.lineTension = 2; }
    }
  }

  updateLandedAttached(dt, player, physics) {
    if (this.actor.stateAge < HOOK_LAND_SECONDS || this.actor.landingSpawned) return;
    this.land(player, physics);
  }

  resolveLandingPoint(fishPosition, player) {
    const playerPos = player?.position ?? fishPosition;
    const preferredShore = this.dungeon.getRawFishLandingPosition?.(player, this.zone);
    if (preferredShore && !this.pointInZone(preferredShore, this.zone)) {
      const terrainY = this.dungeon.outdoorTerrainRuntime?.sampleOutdoorY?.(preferredShore.x, preferredShore.z);
      preferredShore.y = Number.isFinite(terrainY) ? terrainY : (this.dungeon.sampleFishLandingSurfaceY?.(preferredShore, null) ?? playerPos.y ?? 0);
      return preferredShore;
    }
    const landing = fishPosition.clone();
    tmp3.copy(playerPos).sub(fishPosition).setY(0);
    if (tmp3.lengthSq() > 0.001) tmp3.normalize(); else tmp3.set(0, 0, 1);
    landing.addScaledVector(tmp3, Math.min(HOOK_LANDING_FORWARD_OFFSET, Math.max(0.65, this.horizontalDistance(fishPosition, player.position) * 0.55)));
    if (this.pointInZone(landing, this.zone)) landing.copy(player.position).addScaledVector(tmp3.clone().negate(), SAFE_GROUND_FALLBACK_DISTANCE);
    if (this.pointInZone(landing, this.zone)) {
      const awayFromWater = tmp3.copy(player.position).setY(0).sub(tmp.set(this.zone?.centerX ?? playerPos.x, 0, this.zone?.centerZ ?? playerPos.z));
      if (awayFromWater.lengthSq() > 0.001) awayFromWater.normalize(); else awayFromWater.set(0, 0, 1);
      landing.copy(playerPos).addScaledVector(awayFromWater, SAFE_GROUND_FALLBACK_DISTANCE);
    }
    const terrainY = this.dungeon.outdoorTerrainRuntime?.sampleOutdoorY?.(landing.x, landing.z);
    landing.y = Number.isFinite(terrainY) ? terrainY : (this.dungeon.sampleFishLandingSurfaceY?.(landing, null) ?? player.position.y ?? 0);
    return landing;
  }

  land(player, physics) { const { species, sizeGroup } = this.actor; this.actor.landingSpawned = true; const pos = (this.actor.landingPoint ?? this.actor.position).clone(); this.setState('pickedUp'); this.dungeon.spawnRawFishPickupAtPosition?.(pos, this.zone, player, { fishSpecies: species, fishSizeGroup: sizeGroup }); this.cleanupHookedPhysics(physics, 'landed'); this.despawn(); }

  cleanupHookedPhysics(physics, result) {
    if (!physics) return;
    physics.isFishHooked = false;
    physics.hookedReelWeight = 1;
    physics.lineTension = 0;
    physics.lineSlack = 0;
    physics.isCasting = false;
    if (result === 'landed') {
      physics.isLureOnWater = false;
      physics.isLureAirborne = false;
      physics.isLureGrounded = true;
      physics.isLureHeldNearRod = false;
      physics.lureRecoveryState = 'deployedGround';
    } else {
      physics.isLureOnWater = false;
      physics.isLureAirborne = true;
      physics.isLureGrounded = false;
      physics.isLureHeldNearRod = false;
      physics.lureRecoveryState = 'recoveringToTip';
      physics.lureVelocity.y = Math.max(physics.lureVelocity.y, 0.18);
      physics.spoolLocked = false;
    }
    physics.hookedFishDebug = { ...(physics.hookedFishDebug ?? {}), cleanup: result, landingTriggered: result === 'landed', isFishHooked: false, isLureOnWater: physics.isLureOnWater, lureRecoveryState: physics.lureRecoveryState };
  }

  updateHookedDebug(physics, rodUp = false) {
    if (!physics || !this.actor) return;
    physics.hookedFishDebug = {
      fishState: this.actor.state,
      hookedAge: this.actor.hookedAge,
      recentReelSeconds: this.actor.recentReelSeconds,
      lineLength: physics.currentLineLength,
      minLineLength: physics.minLineLength,
      landingThreshold: HOOKED_LANDING_LINE_THRESHOLD,
      landingReady: this.getLandingReason(this.actor, physics) !== null,
      landingReason: this.actor.landingReason,
      hookedReelCycles: this.actor.hookedReelCycles,
      targetReelCycles: HOOKED_REEL_TARGET_CYCLES[this.actor.sizeGroup] ?? HOOKED_REEL_TARGET_CYCLES.medium,
      fishSizeGroup: this.actor.sizeGroup,
      reelPull: this.actor.lastReelPull,
      hookedReelWeight: physics.hookedReelWeight,
      minFightSeconds: HOOKED_MIN_FIGHT_SECONDS,
      rodUp,
      landingTriggered: this.actor.landingTriggered,
      landingSpawned: this.actor.landingSpawned,
    };
  }

  makeSplash(position, scale = 0.5) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12 * scale, 0.22 * scale, 24), new THREE.MeshBasicMaterial({ color: 0xbfe7df, transparent: true, opacity: 0.58, side: THREE.DoubleSide }));
    ring.name = 'physical-fish-nontext-splash-ring'; ring.rotation.x = -Math.PI / 2; ring.position.copy(position); ring.position.y = (this.dungeon.sampleFishLandingSurfaceY?.(position, this.zone) ?? position.y) + 0.018; this.scene.add(ring);
    const start = performance.now(); const tick = () => { const t = (performance.now() - start) / 620; if (t >= 1) { ring.parent?.remove(ring); return; } ring.scale.setScalar(1 + t * 3); ring.material.opacity = 0.58 * (1 - t); requestAnimationFrame(tick); }; tick();
  }

  syncVisual() { const a = this.actor; if (!a) return; a.mesh.position.copy(a.position); if (a.velocity.lengthSq() > 0.001) a.mesh.rotation.y = Math.atan2(a.velocity.x, a.velocity.z) + Math.PI / 2; if (a.state === 'breach') a.mesh.rotation.z = Math.sin(a.stateAge * 12) * 0.28; else a.mesh.rotation.z = 0; }
  selectSpecies(zone) { const pool = zone?.fishSpeciesPool?.length ? zone.fishSpeciesPool : ['smallRiverFish']; return pool[Math.floor(this.rng() * pool.length)] ?? 'smallRiverFish'; }
  pointInZone(p, z) { if (!z) return false; const dx = p.x - z.centerX; const dz = p.z - z.centerZ; return z.shape === 'ellipse' ? (dx * dx) / (z.radiusX * z.radiusX) + (dz * dz) / (z.radiusZ * z.radiusZ) <= 1 : p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ; }
  randomPointInZone(zone, near) { for (let i = 0; i < 8; i += 1) { const p = new THREE.Vector3(zone.centerX + (this.rng() * 2 - 1) * zone.radiusX * 0.68, 0, zone.centerZ + (this.rng() * 2 - 1) * zone.radiusZ * 0.68); if (this.pointInZone(p, zone) && (!near || this.horizontalDistance(p, near) > 3)) return p; } return new THREE.Vector3(zone.centerX, 0, zone.centerZ); }
  clampToZone(p, strength = 0.08) { if (!this.zone || this.pointInZone(p, this.zone)) return; tmp.set(this.zone.centerX ?? p.x, p.y, this.zone.centerZ ?? p.z); p.lerp(tmp, strength); }
  horizontalDistance(a, b) { return tmp2.copy(a).setY(0).distanceTo(tmp.copy(b).setY(0)); }
}

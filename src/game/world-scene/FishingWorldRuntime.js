import * as THREE from 'three';
import { FISH_SPECS, FISH_TEXTURE_PROFILES, createFishMesh } from '../fishing/FishMeshFactory.js';
import { PhysicalFishAngling } from '../fishing/PhysicalFishAngling.js';
import { resolveFishSizeGroup } from '../fishing/FishSizeGroups.js';
import { isPointInFishingZone, sampleFishingZoneWaterY } from '../fishing/FishingZoneGeometry.js';

export { FISH_SPECS, FISH_TEXTURE_PROFILES, createFishMesh, PhysicalFishAngling, resolveFishSizeGroup };

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function horizontalDistance(a, b) {
  const dx = (a?.x ?? 0) - (b?.x ?? 0);
  const dz = (a?.z ?? 0) - (b?.z ?? 0);
  return Math.sqrt(dx * dx + dz * dz);
}

export class FishingWorldRuntime {
  constructor({
    scene,
    dungeon,
    outdoorInteractions,
    isOutdoorActive,
    resolveOutdoorVisibleSurfaceY,
    alignObjectBottomToSurface,
    resolveRawFishPickupMaterial,
    fieldHalfSize = 200,
    maxRawFishPickups = 6,
    defaultSpecies = 'smallRiverFish',
  } = {}) {
    this.scene = scene;
    this.dungeon = dungeon;
    this.outdoorInteractions = outdoorInteractions ?? [];
    this.isOutdoorActive = isOutdoorActive ?? (() => true);
    this.resolveOutdoorVisibleSurfaceY = resolveOutdoorVisibleSurfaceY ?? (() => ({ y: 0, source: 'fallback-floor' }));
    this.alignObjectBottomToSurface = alignObjectBottomToSurface ?? (() => 0);
    this.resolveRawFishPickupMaterial = resolveRawFishPickupMaterial ?? ((reference, fallback) => fallback);
    this.fieldHalfSize = fieldHalfSize;
    this.maxRawFishPickups = maxRawFishPickups;
    this.defaultSpecies = defaultSpecies;
    this.fishingZones = [];
    this.rawFishPickups = [];
    this.physicalAngling = null;
    this.feedback = null;
  }

  registerFishingZones(zones = [], { replace = false } = {}) {
    if (replace) this.fishingZones.length = 0;
    zones.filter(Boolean).forEach((zone) => this.fishingZones.push(zone));
    return this.fishingZones;
  }

  getNearbyFishingZone(position) {
    if (!this.isOutdoorActive() || !position) return null;
    return this.fishingZones.find((zone) => this.isPointInZone(position, zone, zone.interactPadding ?? 0)) ?? null;
  }

  isPositionInFishingWater(position, margin = 0.35) {
    if (!this.isOutdoorActive() || !position) return false;
    return this.fishingZones.some((zone) => this.isPointInZone(position, zone, margin));
  }

  isPointInZone(position, zone, margin = 0) {
    return isPointInFishingZone(position, zone, margin);
  }

  sampleFishLandingSurfaceY(position, fishingZone = null) {
    if (!position) return 0;
    const zone = fishingZone ?? this.getNearbyFishingZone(position);
    if (zone && this.isPositionInFishingWater(position, -0.05)) {
      const waterY = sampleFishingZoneWaterY(position, zone);
      if (Number.isFinite(waterY)) return waterY + 0.035;
    }
    return this.resolveOutdoorVisibleSurfaceY(position.x, position.z, { water: false }).y;
  }

  getRawFishLandingPosition(player, fishingZone = null) {
    if (!player?.position) return null;
    const zone = fishingZone ?? this.getNearbyFishingZone(player.position);
    if (zone?.shape === 'ellipse' && [zone.centerX, zone.centerZ, zone.radiusX, zone.radiusZ].every(Number.isFinite)) {
      const center = new THREE.Vector3(zone.centerX, 0, zone.centerZ);
      const outward = player.position.clone().sub(center).setY(0);
      if (outward.lengthSq() < 0.001) outward.set(Math.cos(stableHash(zone.id) % 360), 0, Math.sin(stableHash(`${zone.id}:shore`) % 360));
      outward.normalize();
      const denom = Math.sqrt((outward.x * outward.x) / (zone.radiusX * zone.radiusX) + (outward.z * outward.z) / (zone.radiusZ * zone.radiusZ));
      const edgeDistance = denom > 0 ? 1 / denom : Math.max(zone.radiusX, zone.radiusZ);
      const waterEdge = center.clone().addScaledVector(outward, edgeDistance);
      const preferred = waterEdge.clone().addScaledVector(outward, 1.2);
      const landing = horizontalDistance(preferred, player.position) > 2.65
        ? player.position.clone().addScaledVector(preferred.clone().sub(player.position).setY(0).normalize(), 2.65)
        : preferred;
      const fromCenter = landing.clone().sub(center).setY(0);
      if (fromCenter.length() < edgeDistance + 0.45) landing.copy(center).addScaledVector(outward, edgeDistance + 0.45);
      landing.x = THREE.MathUtils.clamp(landing.x, -this.fieldHalfSize + 3, this.fieldHalfSize - 3);
      landing.z = THREE.MathUtils.clamp(landing.z, -this.fieldHalfSize + 3, this.fieldHalfSize - 3);
      landing.y = this.sampleFishLandingSurfaceY(landing, zone);
      landing.userData = { rawFishLanding: 'pond-shoreline-edge', waterEdgePoint: { x: waterEdge.x, z: waterEdge.z }, outsideWater: !this.isPositionInFishingWater(landing, 0) };
      if (!this.isPositionInFishingWater(landing, 0)) return landing;
    }
    const forward = typeof player.getLookDirection === 'function' ? player.getLookDirection().clone() : new THREE.Vector3(Math.sin(player.yaw ?? 0), 0, Math.cos(player.yaw ?? 0));
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, 1);
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const base = player.position.clone();
    const clampToField = (position) => {
      position.x = THREE.MathUtils.clamp(position.x, -this.fieldHalfSize + 3, this.fieldHalfSize - 3);
      position.z = THREE.MathUtils.clamp(position.z, -this.fieldHalfSize + 3, this.fieldHalfSize - 3);
      position.y = this.sampleFishLandingSurfaceY(position, zone);
      return position;
    };
    const candidates = [base.clone().addScaledVector(forward, 1.15), base.clone().addScaledVector(forward, 1.35), base.clone().addScaledVector(forward, 0.95).addScaledVector(right, 0.55), base.clone().addScaledVector(forward, 0.95).addScaledVector(right, -0.55), base.clone().addScaledVector(right, 0.75), base.clone().addScaledVector(right, -0.75)].map(clampToField);
    return candidates.find((candidate) => !this.isPositionInFishingWater(candidate)) ?? candidates[0] ?? null;
  }

  selectFishSpeciesForZone(zone) {
    const pool = zone?.fishSpeciesPool?.length ? zone.fishSpeciesPool : [this.defaultSpecies];
    const counter = this.rawFishPickups.length;
    return pool[stableHash(`${zone?.fishCatchSeed ?? zone?.id}:${counter}`) % pool.length] ?? this.defaultSpecies;
  }

  createRawFishPickupMesh(fishSpecies = this.defaultSpecies) {
    const resolvedSpecies = FISH_SPECS[fishSpecies] ? fishSpecies : this.defaultSpecies;
    const group = createFishMesh(resolvedSpecies, { materialResolver: (reference, fallback) => this.resolveRawFishPickupMaterial(reference, fallback), id: `raw-fish-pickup-${resolvedSpecies}`, userData: { itemId: 'raw_fish', fishSpecies: resolvedSpecies, objectCategory: 'rawFishPickup', generatedBy: 'FishingWorldRuntime:createRawFishPickupMesh' } });
    group.userData = { ...group.userData, itemId: 'raw_fish', fishSpecies: resolvedSpecies, objectCategory: 'rawFishPickupVisual', visualSource: 'sharedKerovacFishSpeciesFactory', pickupGroundOrientation: 'stable-root-yaw-plus-visual-side-roll', localFishAxis: 'X=head-tail-horizontal' };
    group.scale.setScalar(0.48);
    group.rotation.set(Math.PI / 2 + 0.18, 0, 0);

    const root = new THREE.Group();
    root.name = `raw-fish-pickup-ground-root-${resolvedSpecies}`;
    root.userData = { itemId: 'raw_fish', fishSpecies: resolvedSpecies, objectCategory: 'rawFishPickup', visualSource: 'sharedKerovacFishSpeciesFactory', pickupGroundOrientation: 'stable-root-yaw-plus-visual-side-roll', localFishAxis: 'X=head-tail-horizontal', interactionTargetStable: true, animatedVisualChild: true, flopAnimation: { rollAmplitude: [0.25, 0.45], hopHeight: [0.04, 0.1], pulseDuration: [0.18, 0.35], interval: [0.8, 1.6] } };
    root.add(group);
    root.userData.visualChild = group;
    return root;
  }

  spawnRawFishPickupForPlayer(player, fishingZone = null, options = {}) {
    if (!this.isOutdoorActive()) return null;
    const zone = fishingZone ?? this.getNearbyFishingZone(player?.position);
    const landing = options.landingOverride?.clone?.() ?? this.getRawFishLandingPosition(player, zone);
    if (!landing) return null;
    if (this.rawFishPickups.length >= this.maxRawFishPickups) this.removeRawFishPickup(this.rawFishPickups[0]);
    const pickupId = `field_raw_fish_${Date.now()}_${this.rawFishPickups.length + 1}`;
    const fishSpecies = options.fishSpecies ?? this.selectFishSpeciesForZone(zone);
    const fishSizeGroup = options.fishSizeGroup ?? 'medium';
    const fishSize = resolveFishSizeGroup(fishSizeGroup);
    const mesh = this.createRawFishPickupMesh(fishSpecies);
    mesh.scale.multiplyScalar(fishSize.scale);
    mesh.name = `${pickupId}-${fishSpecies}-raw-fish-pickup`;
    const surfaceY = this.resolveOutdoorVisibleSurfaceY(landing.x, landing.z, { fallbackY: landing.y ?? 0 }).y;
    mesh.position.set(landing.x, surfaceY + 0.9, landing.z);
    mesh.rotation.y = zone?.shape === 'ellipse' ? Math.atan2(landing.x - zone.centerX, landing.z - zone.centerZ) + Math.PI / 2 : (player?.yaw ?? 0) + Math.PI / 2;
    this.scene?.add(mesh);
    this.alignObjectBottomToSurface(mesh, surfaceY);
    const seed = stableHash(`${pickupId}:${fishSpecies}`);
    const visual = mesh.userData.visualChild ?? mesh.children[0] ?? mesh;
    const flop = { visual, baseY: visual.position.y, baseRotation: visual.rotation.clone(), elapsed: (seed % 1000) / 1000, interval: 0.8 + ((seed >>> 8) % 800) / 1000, duration: 0.18 + ((seed >>> 16) % 170) / 1000, rollAmplitude: 0.25 + ((seed >>> 4) % 200) / 1000, hopHeight: 0.04 + ((seed >>> 12) % 60) / 1000, direction: seed % 2 === 0 ? 1 : -1 };
    const target = mesh.position.clone();
    const start = target.clone().setY(target.y + 0.64);
    mesh.position.copy(start);
    const pickup = { id: pickupId, mesh, itemId: 'raw_fish', fishSpecies, fishSizeGroup, hungerSeconds: fishSize.hungerSeconds, start, target, elapsed: 0, duration: 0.55, landing: landing.clone().setY(surfaceY), surfaceY, flop };
    this.rawFishPickups.push(pickup);
    this.outdoorInteractions.push({ id: pickupId, label: 'Raw Fish', target: landing.clone().setY(surfaceY + 0.35), range: 2.85, hint: 'Pick up Raw Fish', message: 'Raw Fish Acquired.', type: 'rawFishPickup', pickup, itemId: 'raw_fish', fishSpecies, fishSizeGroup, hungerSeconds: fishSize.hungerSeconds });
    return pickup;
  }

  spawnRawFishPickupAtPosition(position, fishingZone = null, player = null, { fishSpecies = null, fishSizeGroup = 'medium' } = {}) {
    if (!position) return null;
    const landingPlayer = { position: position.clone?.() ?? new THREE.Vector3(position.x ?? 0, position.y ?? 0, position.z ?? 0), yaw: player?.yaw ?? 0, getLookDirection: () => (player?.position ? player.position.clone().sub(position).setY(0).normalize() : new THREE.Vector3(0, 0, 1)) };
    return this.spawnRawFishPickupForPlayer(landingPlayer, fishingZone, { fishSpecies, fishSizeGroup, landingOverride: position });
  }

  spawnRawFishPickupFromCast(lurePosition, fishingZone = null, player = null) {
    if (!lurePosition || !fishingZone) return null;
    const castPlayer = { position: lurePosition.clone?.() ?? new THREE.Vector3(lurePosition.x ?? 0, lurePosition.y ?? 0, lurePosition.z ?? 0), yaw: player?.yaw ?? 0, getLookDirection: () => (player?.position ? player.position.clone().sub(lurePosition).setY(0).normalize() : new THREE.Vector3(0, 0, 1)) };
    return this.spawnRawFishPickupForPlayer(castPlayer, fishingZone);
  }

  setFishingFeedback(feedback = null) { this.feedback = feedback; if (this.physicalAngling) this.physicalAngling.feedback = feedback; }
  ensurePhysicalFishAngling() { if (!this.physicalAngling) this.physicalAngling = new PhysicalFishAngling({ scene: this.scene, dungeon: this.dungeon, feedback: this.feedback }); this.physicalAngling.feedback = this.feedback; return this.physicalAngling; }
  updatePhysicalFishAngling(deltaSeconds, context = {}) { return this.ensurePhysicalFishAngling().update(deltaSeconds, context); }
  cancelPhysicalFishAngling(physics, reason = 'lost') { this.physicalAngling?.cancelHookedFish?.(physics, reason); }
  registerPhysicalLureLanding() { this.ensurePhysicalFishAngling(); }

  update(deltaSeconds) { this.updateRawFishPickups(deltaSeconds); }

  updateRawFishPickups(deltaSeconds) {
    this.rawFishPickups.forEach((pickup) => {
      if (!pickup.mesh) return;
      if (pickup.elapsed < pickup.duration) {
        pickup.elapsed = Math.min(pickup.duration, pickup.elapsed + deltaSeconds);
        const t = pickup.elapsed / pickup.duration;
        pickup.mesh.position.lerpVectors(pickup.start, pickup.target, t);
        pickup.mesh.position.y = THREE.MathUtils.lerp(pickup.start.y, pickup.target.y, t) + Math.sin(t * Math.PI) * 0.32;
      }
      const flop = pickup.flop;
      if (!flop?.visual || pickup.elapsed < pickup.duration) return;
      flop.elapsed += deltaSeconds;
      const pulseT = (flop.elapsed % flop.interval) / flop.duration;
      const active = pulseT >= 0 && pulseT <= 1;
      const pulse = active ? Math.sin(pulseT * Math.PI) : 0;
      const snap = active ? Math.sin(pulseT * Math.PI * 2) : 0;
      flop.visual.rotation.copy(flop.baseRotation);
      flop.visual.rotation.x += pulse * flop.rollAmplitude * flop.direction;
      flop.visual.rotation.y += snap * 0.12;
      flop.visual.position.y = flop.baseY + pulse * flop.hopHeight;
    });
  }

  removeRawFishPickup(pickup) {
    if (!pickup) return;
    if (pickup.mesh) this.scene?.remove(pickup.mesh);
    const pickupIndex = this.rawFishPickups.indexOf(pickup);
    if (pickupIndex >= 0) this.rawFishPickups.splice(pickupIndex, 1);
    const index = this.outdoorInteractions.length;
    for (let i = index - 1; i >= 0; i -= 1) if (this.outdoorInteractions[i]?.pickup === pickup) this.outdoorInteractions.splice(i, 1);
  }

  dispose() {
    [...this.rawFishPickups].forEach((pickup) => this.removeRawFishPickup(pickup));
    this.physicalAngling?.despawn?.();
    this.physicalAngling = null;
    this.fishingZones.length = 0;
  }

  getDebugSummary() { return { fishingZones: this.fishingZones.length, rawFishPickups: this.rawFishPickups.length, hasPhysicalAngling: Boolean(this.physicalAngling) }; }
}

export function createFishingWorldRuntime(options = {}) {
  return new FishingWorldRuntime(options);
}

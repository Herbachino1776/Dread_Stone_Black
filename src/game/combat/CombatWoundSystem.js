import * as THREE from 'three';
import { BLOOD_COLOR_PALETTE, VESSEL_ZONES, WOUND_CONFIG } from './CombatStage2Config.js';

const tmpPosition = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpNormal = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();
const tmpSide = new THREE.Vector3();

function makeSlashGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function distancePointToSegment2D(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 1e-8 ? THREE.MathUtils.clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export class CombatWoundSystem {
  constructor({ actor, scene, maximumWounds = WOUND_CONFIG.maximumWounds } = {}) {
    this.actor = actor;
    this.scene = scene;
    this.maximumWounds = maximumWounds;
    this.wounds = [];
    this.nextWoundId = 1;
    this.visualSlots = [];
    this.materials = {
      puncture: new THREE.MeshStandardMaterial({ color: BLOOD_COLOR_PALETTE.fresh, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }),
      cut: new THREE.MeshStandardMaterial({ color: BLOOD_COLOR_PALETTE.fresh, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
      deep: new THREE.MeshStandardMaterial({ color: BLOOD_COLOR_PALETTE.deep, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
      arterial: new THREE.MeshStandardMaterial({ color: BLOOD_COLOR_PALETTE.arterial, roughness: 0.86, metalness: 0, side: THREE.DoubleSide }),
      blunt: new THREE.MeshStandardMaterial({ color: 0x372229, roughness: 0.96, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
    };
    this.createVisualPool();
  }

  createVisualPool() {
    for (let index = 0; index < this.maximumWounds; index += 1) {
      const puncture = new THREE.Mesh(new THREE.CircleGeometry(1, 10), this.materials.puncture);
      puncture.name = `combat-wound-puncture-visual-${index}`;
      puncture.visible = false;
      puncture.castShadow = false;
      puncture.receiveShadow = true;
      const slash = new THREE.Mesh(makeSlashGeometry(), this.materials.cut);
      slash.name = `combat-wound-slash-visual-${index}`;
      slash.visible = false;
      slash.castShadow = false;
      slash.receiveShadow = true;
      this.scene.add(puncture, slash);
      this.visualSlots.push({ puncture, slash, woundId: null });
    }
  }

  allocateVisual(woundId) {
    let slot = this.visualSlots.find((entry) => entry.woundId == null);
    if (!slot) {
      const replace = this.wounds.find((wound) => !wound.active && !wound.vesselInvolvement) ?? this.wounds[0];
      if (replace) this.removeWound(replace.id);
      slot = this.visualSlots.find((entry) => entry.woundId == null);
    }
    if (!slot) return null;
    slot.woundId = woundId;
    return slot;
  }

  createPuncture({ hit, entryPoint, axis, depth = 0.004, hardStructureContact = false, embeddedWeaponId = null, createdTime = 0 } = {}) {
    const nearby = this.findNearbyWound(hit.bodyId, hit.localPoint, ['puncture', 'deep_puncture', 'arterial_wound']);
    if (nearby && nearby.localEntryPoint.distanceTo(hit.localPoint) <= WOUND_CONFIG.reopenResistanceFactor * 0.1) {
      nearby.active = true;
      nearby.closed = false;
      nearby.reopenedCount += 1;
      nearby.embeddedWeaponId = embeddedWeaponId;
      nearby.withdrawalBoostRemaining = 0;
      nearby.maximumDepth = Math.max(nearby.maximumDepth, depth);
      nearby.currentDepth = depth;
      return nearby;
    }
    const localAxis = axis.clone().applyQuaternion(new THREE.Quaternion(hit.body.rotation().x, hit.body.rotation().y, hit.body.rotation().z, hit.body.rotation().w).invert()).normalize();
    const wound = this.createWound({
      actor: this.actor,
      regionId: hit.regionId,
      bodyId: hit.bodyId,
      woundType: depth >= 0.075 ? 'deep_puncture' : 'puncture',
      localEntryPoint: hit.localPoint.clone(),
      localSurfaceNormal: localAxis.clone().negate(),
      localPenetrationAxis: localAxis,
      currentDepth: depth,
      maximumDepth: depth,
      cutLength: 0,
      localCutStart: hit.localPoint.clone(),
      localCutEnd: hit.localPoint.clone(),
      localCutDirection: new THREE.Vector3(),
      severity: THREE.MathUtils.clamp(depth * 5.2, 0.04, 1.5),
      tissueClass: hit.region?.vital ?? 'none',
      hardStructureContact,
      embeddedWeaponId,
      createdTime,
    });
    this.resolveBleedingProfile(wound);
    this.updateWoundVisual(wound);
    return wound;
  }

  createSlash({ hit, startPoint, endPoint, surfaceNormal, cutDirection, depth, cutLength, severity, classification, createdTime = 0 } = {}) {
    const localStart = hit.localPoint.clone();
    const bodyRotation = hit.body.rotation();
    const inverse = new THREE.Quaternion(bodyRotation.x, bodyRotation.y, bodyRotation.z, bodyRotation.w).invert();
    const worldDelta = endPoint.clone().sub(startPoint);
    const localEnd = localStart.clone().add(worldDelta.applyQuaternion(inverse));
    const localNormal = surfaceNormal.clone().applyQuaternion(inverse).normalize();
    const localDirection = cutDirection.clone().applyQuaternion(inverse).normalize();
    const existing = this.findReopenCandidate(hit.bodyId, localStart, localEnd);
    if (existing) {
      existing.active = true;
      existing.closed = false;
      existing.reopenedCount += 1;
      existing.withdrawalBoostRemaining = 0.35;
      existing.maximumDepth = Math.max(existing.maximumDepth, depth);
      existing.severity = Math.min(2, existing.severity + severity * 0.35);
      existing.cutLength = Math.min(WOUND_CONFIG.maximumCutLength, existing.cutLength + cutLength * 0.45);
      this.resolveBleedingProfile(existing);
      this.updateWoundVisual(existing);
      return existing;
    }
    const woundType = classification === 'deep_slash' ? 'deep_slash' : 'shallow_cut';
    const wound = this.createWound({ actor: this.actor, regionId: hit.regionId, bodyId: hit.bodyId, woundType, localEntryPoint: localStart.clone(), localSurfaceNormal: localNormal, localPenetrationAxis: localNormal.clone().negate(), currentDepth: depth, maximumDepth: depth, cutLength: Math.min(cutLength, WOUND_CONFIG.maximumCutLength), localCutStart: localStart, localCutEnd: localEnd, localCutDirection: localDirection, severity, tissueClass: hit.region?.vital ?? 'none', hardStructureContact: false, embeddedWeaponId: null, createdTime });
    this.resolveBleedingProfile(wound);
    this.updateWoundVisual(wound);
    return wound;
  }

  createBluntMarker({ hit, severity = 0.1, createdTime = 0 } = {}) {
    const wound = this.createWound({ actor: this.actor, regionId: hit.regionId, bodyId: hit.bodyId, woundType: 'blunt_trauma_marker', localEntryPoint: hit.localPoint.clone(), localSurfaceNormal: new THREE.Vector3(0, 0, 1), localPenetrationAxis: new THREE.Vector3(), currentDepth: 0, maximumDepth: 0, cutLength: 0, localCutStart: hit.localPoint.clone(), localCutEnd: hit.localPoint.clone(), localCutDirection: new THREE.Vector3(), severity, tissueClass: 'surface', hardStructureContact: true, embeddedWeaponId: null, createdTime });
    wound.bleedingProfile = { kind: 'none', baseRate: 0 };
    this.updateWoundVisual(wound);
    return wound;
  }

  createWound(data) {
    if (this.wounds.length >= this.maximumWounds) {
      const replace = this.wounds.find((wound) => !wound.active && !wound.vesselInvolvement) ?? this.wounds.reduce((oldest, wound) => wound.createdTime < oldest.createdTime ? wound : oldest, this.wounds[0]);
      if (replace) this.removeWound(replace.id);
    }
    const id = `wound_${this.nextWoundId++}`;
    const visualSlot = this.allocateVisual(id);
    const wound = { id, ...data, vesselInvolvement: null, bleedingProfile: { kind: 'capillary', baseRate: 0.002 }, bleedingRate: 0, bloodEmitted: 0, withdrawalBoostRemaining: 0, pulsePhase: 0, active: true, closed: false, reopenedCount: 0, visualSlot, visualOwner: visualSlot ? 'pooled-region-visual' : null };
    this.wounds.push(wound);
    return wound;
  }

  extendPuncture(woundId, { depth, hardStructureContact = false } = {}) {
    const wound = this.getWound(woundId);
    if (!wound) return null;
    wound.currentDepth = Math.max(0, depth);
    wound.maximumDepth = Math.max(wound.maximumDepth, depth);
    wound.hardStructureContact ||= hardStructureContact;
    if (wound.maximumDepth >= 0.075 && wound.woundType === 'puncture') wound.woundType = 'deep_puncture';
    wound.severity = Math.max(wound.severity, THREE.MathUtils.clamp(wound.maximumDepth * 5.2, 0.04, 1.7));
    this.resolveBleedingProfile(wound);
    this.updateWoundVisual(wound);
    return wound;
  }

  extendSlash(woundId, { localEnd, addedTravel, depth, severity } = {}) {
    const wound = this.getWound(woundId);
    if (!wound) return null;
    const physicalTravel = Math.max(0, addedTravel);
    wound.localCutEnd.copy(localEnd);
    wound.cutLength = Math.min(WOUND_CONFIG.maximumCutLength, wound.cutLength + physicalTravel);
    wound.currentDepth = Math.max(wound.currentDepth, depth);
    wound.maximumDepth = Math.max(wound.maximumDepth, depth);
    wound.severity = Math.min(2, Math.max(wound.severity, severity) + physicalTravel * 0.35);
    if (wound.maximumDepth >= 0.05 || wound.severity >= WOUND_CONFIG.seriousSeverity) wound.woundType = 'deep_slash';
    this.resolveBleedingProfile(wound);
    this.updateWoundVisual(wound);
    return wound;
  }

  finishSlash(woundId, interrupted = false) {
    const wound = this.getWound(woundId);
    if (!wound) return;
    wound.lastContactInterrupted = interrupted;
    wound.currentDepth = 0;
  }

  markEmbedded(woundId, embeddedWeaponId) {
    const wound = this.getWound(woundId);
    if (wound) wound.embeddedWeaponId = embeddedWeaponId;
  }

  markExtracted(woundId, { releaseSeverity = 0, direction = null } = {}) {
    const wound = this.getWound(woundId);
    if (!wound) return null;
    wound.embeddedWeaponId = null;
    wound.currentDepth = 0;
    wound.withdrawalBoostRemaining = 0.7;
    wound.severity = Math.min(2, wound.severity + releaseSeverity * 0.12);
    wound.withdrawalDirection = direction?.clone?.() ?? null;
    wound.reopenedCount += 1;
    return wound;
  }

  resolveBleedingProfile(wound) {
    const vessel = this.resolveVesselIntersection(wound);
    wound.vesselInvolvement = vessel;
    if (vessel) {
      wound.woundType = vessel.vesselType.includes('arterial') ? 'arterial_wound' : wound.woundType;
      wound.bleedingProfile = { kind: vessel.vesselType, baseRate: vessel.rate };
      return wound.bleedingProfile;
    }
    if (wound.woundType === 'blunt_trauma_marker') wound.bleedingProfile = { kind: 'none', baseRate: 0 };
    else if (wound.maximumDepth >= 0.055 || wound.woundType === 'deep_slash') wound.bleedingProfile = { kind: 'venous', baseRate: 0.014 + wound.severity * 0.007 };
    else wound.bleedingProfile = { kind: 'capillary', baseRate: 0.0015 + wound.severity * 0.0025 };
    return wound.bleedingProfile;
  }

  resolveVesselIntersection(wound) {
    const candidates = VESSEL_ZONES.filter((zone) => zone.regionId === wound.regionId && wound.maximumDepth >= zone.minimumDepth);
    for (const zone of candidates) {
      const distance = wound.cutLength > 0.001
        ? distancePointToSegment2D(zone.surfaceCenter[0], zone.surfaceCenter[1], wound.localCutStart.x, wound.localCutStart.y, wound.localCutEnd.x, wound.localCutEnd.y)
        : Math.hypot(wound.localEntryPoint.x - zone.surfaceCenter[0], wound.localEntryPoint.y - zone.surfaceCenter[1]);
      const axisAlignment = wound.localPenetrationAxis.lengthSq() > 0 ? Math.abs(wound.localPenetrationAxis.z) : 1;
      if (distance <= zone.surfaceRadius && axisAlignment >= 0.32) return zone;
    }
    return null;
  }

  findNearbyWound(bodyId, localPoint, categories = null) {
    return this.wounds.find((wound) => wound.bodyId === bodyId && (!categories || categories.includes(wound.woundType)) && wound.localEntryPoint.distanceTo(localPoint) <= WOUND_CONFIG.reopenDistance) ?? null;
  }

  findReopenCandidate(bodyId, start, end) {
    return this.wounds.find((wound) => wound.bodyId === bodyId && ['shallow_cut', 'deep_slash', 'arterial_wound'].includes(wound.woundType) && (wound.localCutStart.distanceTo(start) <= WOUND_CONFIG.reopenDistance || wound.localCutEnd.distanceTo(end) <= WOUND_CONFIG.reopenDistance)) ?? null;
  }

  getWound(id) { return this.wounds.find((wound) => wound.id === id) ?? null; }
  getActiveWounds() { return this.wounds.filter((wound) => wound.active); }

  getWorldPose(wound) {
    const entry = this.actor.bodies.get(wound?.bodyId);
    if (!entry) return null;
    const translation = entry.body.translation();
    const rotation = entry.body.rotation();
    const bodyQuaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    return {
      point: wound.localEntryPoint.clone().applyQuaternion(bodyQuaternion).add(new THREE.Vector3(translation.x, translation.y, translation.z)),
      normal: wound.localSurfaceNormal.clone().applyQuaternion(bodyQuaternion).normalize(),
      direction: wound.localCutDirection.clone().applyQuaternion(bodyQuaternion).normalize(),
      bodyQuaternion,
      translation: new THREE.Vector3(translation.x, translation.y, translation.z),
    };
  }

  update(dt) {
    this.wounds.forEach((wound) => {
      wound.withdrawalBoostRemaining = Math.max(0, wound.withdrawalBoostRemaining - dt);
      this.updateWoundVisual(wound);
    });
  }

  updateWoundVisual(wound) {
    const slot = wound?.visualSlot;
    const pose = this.getWorldPose(wound);
    if (!slot || !pose) return;
    const isSlash = wound.cutLength > 0.001 || ['shallow_cut', 'deep_slash'].includes(wound.woundType);
    slot.puncture.visible = !isSlash;
    slot.slash.visible = isSlash;
    const material = wound.vesselInvolvement?.vesselType?.includes('arterial') ? this.materials.arterial : wound.severity >= WOUND_CONFIG.seriousSeverity ? this.materials.deep : isSlash ? this.materials.cut : wound.woundType === 'blunt_trauma_marker' ? this.materials.blunt : this.materials.puncture;
    if (!isSlash) {
      slot.puncture.material = material;
      slot.puncture.position.copy(pose.point).addScaledVector(pose.normal, WOUND_CONFIG.visualNormalOffset);
      slot.puncture.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pose.normal);
      const radius = wound.woundType === 'blunt_trauma_marker' ? 0.04 + wound.severity * 0.035 : 0.015 + wound.severity * 0.025;
      slot.puncture.scale.set(radius * (wound.woundType === 'deep_puncture' ? 0.72 : 1), radius, 1);
      return;
    }
    slot.slash.material = material;
    slot.slash.position.copy(pose.translation);
    slot.slash.quaternion.copy(pose.bodyQuaternion);
    const start = wound.localCutStart;
    const end = wound.localCutEnd;
    tmpDirection.copy(end).sub(start);
    if (tmpDirection.lengthSq() < 1e-8) tmpDirection.set(0, 1, 0);
    tmpNormal.copy(wound.localSurfaceNormal).normalize();
    tmpSide.copy(tmpDirection).cross(tmpNormal).normalize();
    const width = 0.006 + THREE.MathUtils.clamp(wound.severity, 0, 1.5) * 0.009;
    const offset = tmpNormal.multiplyScalar(WOUND_CONFIG.visualNormalOffset);
    const a = start.clone().addScaledVector(tmpSide, width).add(offset);
    const b = start.clone().addScaledVector(tmpSide, -width).add(offset);
    const c = end.clone().addScaledVector(tmpSide, width).add(offset);
    const d = end.clone().addScaledVector(tmpSide, -width).add(offset);
    const array = slot.slash.geometry.attributes.position.array;
    [a, b, c, d].forEach((point, index) => { array[index * 3] = point.x; array[index * 3 + 1] = point.y; array[index * 3 + 2] = point.z; });
    slot.slash.geometry.attributes.position.needsUpdate = true;
    slot.slash.geometry.computeVertexNormals();
    slot.slash.geometry.computeBoundingSphere();
  }

  removeWound(id) {
    const index = this.wounds.findIndex((wound) => wound.id === id);
    if (index < 0) return;
    const [wound] = this.wounds.splice(index, 1);
    if (wound.visualSlot) {
      wound.visualSlot.puncture.visible = false;
      wound.visualSlot.slash.visible = false;
      wound.visualSlot.woundId = null;
    }
  }

  clear() {
    [...this.wounds].forEach((wound) => this.removeWound(wound.id));
    this.nextWoundId = 1;
  }

  getDiagnostics() {
    return { count: this.wounds.length, active: this.getActiveWounds().length, arterial: this.wounds.filter((wound) => wound.bleedingProfile.kind.includes('arterial')).length, selected: this.wounds.at(-1) ? { id: this.wounds.at(-1).id, regionId: this.wounds.at(-1).regionId, type: this.wounds.at(-1).woundType, depth: Number(this.wounds.at(-1).maximumDepth.toFixed(3)), length: Number(this.wounds.at(-1).cutLength.toFixed(3)), severity: Number(this.wounds.at(-1).severity.toFixed(3)), vessel: this.wounds.at(-1).vesselInvolvement?.id ?? null, bleedingRate: Number(this.wounds.at(-1).bleedingRate.toFixed(4)) } : null };
  }

  dispose() {
    this.clear();
    this.visualSlots.forEach((slot) => { slot.puncture.geometry.dispose(); slot.slash.geometry.dispose(); slot.puncture.removeFromParent(); slot.slash.removeFromParent(); });
    Object.values(this.materials).forEach((material) => material.dispose());
    this.visualSlots = [];
  }
}

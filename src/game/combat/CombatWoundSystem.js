import * as THREE from 'three';
import { BLOOD_COLOR_PALETTE, VESSEL_ZONES, WOUND_CONFIG } from './CombatStage2Config.js';
import { MAX_SLASH_SURFACE_SAMPLES, MIN_SLASH_SURFACE_SAMPLES, WOUND_SURFACE_BIAS, reconstructSkinnedSurface, sampleSlashPath, validateSurfaceBinding } from './SkinnedSurfaceBinding.js';

const tmpPosition = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpNormal = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();
const tmpSide = new THREE.Vector3();

function makeSlashGeometry() {
  const geometry = new THREE.BufferGeometry();
  const maximumSegments = MAX_SLASH_SURFACE_SAMPLES - 1;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(maximumSegments * 12), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(maximumSegments * 12), 3));
  const uvs = new Float32Array(maximumSegments * 8);
  for (let segment = 0; segment < maximumSegments; segment += 1) uvs.set([0, 0, 1, 0, 0, 1, 1, 1], segment * 8);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(Array.from({ length: maximumSegments }, (_, segment) => {
    const offset = segment * 4;
    return [offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3];
  }).flat());
  geometry.setDrawRange(0, 0);
  return geometry;
}

function makeWoundTexture(kind) {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const nx = (x + 0.5) / size * 2 - 1;
    const ny = (y + 0.5) / size * 2 - 1;
    const irregularity = 0.08 * Math.sin(x * 1.73 + y * 0.41) + 0.045 * Math.sin(y * 2.11 - x * 0.27);
    const distance = kind === 'slash' ? Math.abs(nx) * (0.9 + Math.abs(ny) * 0.28) : Math.hypot(nx * 0.93, ny * 1.08);
    const edge = kind === 'slash' ? 0.62 + irregularity : 0.79 + irregularity;
    const alpha = THREE.MathUtils.clamp((edge - distance) * 9, 0, 1);
    const center = kind === 'slash' ? THREE.MathUtils.clamp(1 - Math.abs(nx) * 5.2, 0, 1) : THREE.MathUtils.clamp(1 - distance * 3.2, 0, 1);
    const wetEdge = THREE.MathUtils.clamp((distance - edge * 0.42) * 3.8, 0, 1);
    const offset = (y * size + x) * 4;
    const minimumBrightness = kind === 'slash' ? 215 : 96;
    const centerDarkening = kind === 'slash' ? 0.18 : 0.58;
    const brightness = Math.round(THREE.MathUtils.lerp(minimumBrightness, 255, wetEdge) * (1 - center * centerDarkening));
    data[offset] = brightness;
    data[offset + 1] = brightness;
    data[offset + 2] = brightness;
    data[offset + 3] = Math.round(alpha * 255);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  texture.name = `combat-${kind}-irregular-alpha`;
  return texture;
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
    this.punctureTexture = makeWoundTexture('puncture');
    this.slashTexture = makeWoundTexture('slash');
    const materialOptions = { roughness: 0.88, metalness: 0, side: THREE.DoubleSide, transparent: true, alphaTest: 0.08, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    this.materials = {
      puncture: new THREE.MeshStandardMaterial({ ...materialOptions, color: BLOOD_COLOR_PALETTE.fresh, map: this.punctureTexture }),
      cut: new THREE.MeshStandardMaterial({ ...materialOptions, color: BLOOD_COLOR_PALETTE.slashArterial, map: this.slashTexture }),
      deep: new THREE.MeshStandardMaterial({ ...materialOptions, color: BLOOD_COLOR_PALETTE.deep, map: this.punctureTexture }),
      deepCut: new THREE.MeshStandardMaterial({ ...materialOptions, color: BLOOD_COLOR_PALETTE.slashArterial, map: this.slashTexture }),
      arterial: new THREE.MeshStandardMaterial({ ...materialOptions, color: BLOOD_COLOR_PALETTE.arterial, map: this.punctureTexture }),
      arterialCut: new THREE.MeshStandardMaterial({ ...materialOptions, color: BLOOD_COLOR_PALETTE.slashArterial, map: this.slashTexture }),
      blunt: new THREE.MeshStandardMaterial({ ...materialOptions, color: 0x372229, map: this.punctureTexture, opacity: 0.72 }),
    };
    this.failedProjectionCount = 0;
    this.fallbackUsageCount = 0;
    this.bindingFailureLogged = false;
    this.debugVisible = false;
    this.createVisualPool();
    this.createSurfaceDebug();
  }

  createVisualPool() {
    for (let index = 0; index < this.maximumWounds; index += 1) {
      const puncture = new THREE.Mesh(new THREE.CircleGeometry(1, 16), this.materials.puncture);
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

  createSurfaceDebug() {
    this.surfaceDebugRoot = new THREE.Group();
    this.surfaceDebugRoot.name = 'combat-wound-surface-binding-debug';
    this.surfaceDebugRoot.visible = false;
    const pointMaterial = (color) => new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false });
    this.debugAnchor = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), pointMaterial(0x5dff72));
    this.debugProxy = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), pointMaterial(0x55d9ff));
    const makeLine = (name, color, points) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false }));
      line.name = name;
      return line;
    };
    this.debugNormal = makeLine('wound-surface-normal', 0xffe563, [new THREE.Vector3(), new THREE.Vector3()]);
    this.debugTriangle = makeLine('wound-bound-triangle', 0xff62dd, [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    this.surfaceDebugRoot.add(this.debugAnchor, this.debugProxy, this.debugNormal, this.debugTriangle);
    this.scene.add(this.surfaceDebugRoot);
  }

  setDebugVisible(visible) {
    this.debugVisible = Boolean(visible);
    if (this.surfaceDebugRoot) this.surfaceDebugRoot.visible = this.debugVisible;
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

  bindSurfacePoint(wound, worldPoint, referenceNormal = null) {
    const adapter = this.actor.visualAdapter;
    const binding = adapter?.bindVisibleSurface?.(worldPoint, { regionId: wound.regionId, bodyId: wound.bodyId, referenceNormal });
    if (binding && validateSurfaceBinding(binding)) return binding;
    this.failedProjectionCount += 1;
    if (adapter?.scene && !this.bindingFailureLogged) {
      this.bindingFailureLogged = true;
      console.warn('[combat] Visible skinned-surface wound binding failed; using bounded mapped-bone fallback.');
    }
    return null;
  }

  attachPunctureSurface(wound, worldPoint, referenceNormal) {
    wound.surfaceBinding = this.bindSurfacePoint(wound, worldPoint, referenceNormal);
    wound.surfaceBindingStatus = wound.surfaceBinding ? 'skinned_triangle' : 'fallback_anchor';
    wound.fallbackAnchorUsage = !wound.surfaceBinding;
    wound.surfaceBindingAttempted = true;
    if (wound.fallbackAnchorUsage) this.fallbackUsageCount += 1;
  }

  attachSlashSamples(wound, startPoint, endPoint, referenceNormal) {
    const length = startPoint.distanceTo(endPoint);
    const desiredCount = THREE.MathUtils.clamp(Math.ceil(length / 0.045) + 1, MIN_SLASH_SURFACE_SAMPLES, 8);
    let breakBefore = false;
    wound.slashSamples = sampleSlashPath(startPoint, endPoint, desiredCount).map((worldPoint) => {
      const binding = this.bindSurfacePoint(wound, worldPoint, referenceNormal);
      const sample = { sourcePoint: worldPoint.clone(), binding, fallbackAnchorUsage: !binding, breakBefore };
      if (!binding) {
        breakBefore = true;
        wound.failedProjectionCount += 1;
      } else {
        if (breakBefore) sample.breakBefore = true;
        breakBefore = false;
      }
      return sample;
    }).filter((sample) => sample.binding);
    wound.surfaceBindingStatus = wound.slashSamples.length >= 2 ? 'segmented_skinned_surface' : 'fallback_anchor';
    wound.fallbackAnchorUsage = wound.slashSamples.length < 2;
    if (wound.fallbackAnchorUsage) this.fallbackUsageCount += 1;
  }

  appendSlashSurfaceSample(wound, worldPoint, referenceNormal) {
    if (!worldPoint || wound.slashSamples.length >= MAX_SLASH_SURFACE_SAMPLES) return;
    const previous = wound.slashSamples.at(-1);
    if (previous?.sourcePoint.distanceTo(worldPoint) < 0.025) return;
    const binding = this.bindSurfacePoint(wound, worldPoint, referenceNormal);
    if (!binding) {
      wound.failedProjectionCount += 1;
      wound.nextSampleBreak = true;
      return;
    }
    const reconstructed = reconstructSkinnedSurface(binding);
    const previousSurface = previous?.binding ? reconstructSkinnedSurface(previous.binding) : null;
    const wouldBridge = !previousSurface || previous.binding.mesh !== binding.mesh || reconstructed.point.distanceTo(previousSurface.point) > 0.14;
    wound.slashSamples.push({ sourcePoint: worldPoint.clone(), binding, fallbackAnchorUsage: false, breakBefore: wound.nextSampleBreak || wouldBridge });
    wound.nextSampleBreak = false;
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
    this.attachPunctureSurface(wound, entryPoint, axis.clone().negate());
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
    wound.failedProjectionCount = 0;
    wound.nextSampleBreak = false;
    this.attachSlashSamples(wound, startPoint, endPoint, surfaceNormal);
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
    const wound = { id, ...data, vesselInvolvement: null, bleedingProfile: { kind: 'capillary', baseRate: 0.002 }, bleedingRate: 0, bloodEmitted: 0, withdrawalBoostRemaining: 0, pulsePhase: 0, active: true, closed: false, reopenedCount: 0, visualSlot, visualOwner: visualSlot ? 'pooled-skinned-surface-visual' : null, surfaceBinding: null, surfaceBindingStatus: 'pending', surfaceBindingAttempted: false, fallbackAnchorUsage: false, surfaceDistance: null, slashSamples: [], failedProjectionCount: 0 };
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

  extendSlash(woundId, { localEnd, worldEnd = null, surfaceNormal = null, addedTravel, depth, severity } = {}) {
    const wound = this.getWound(woundId);
    if (!wound) return null;
    const physicalTravel = Math.max(0, addedTravel);
    wound.localCutEnd.copy(localEnd);
    wound.cutLength = Math.min(WOUND_CONFIG.maximumCutLength, wound.cutLength + physicalTravel);
    wound.currentDepth = Math.max(wound.currentDepth, depth);
    wound.maximumDepth = Math.max(wound.maximumDepth, depth);
    wound.severity = Math.min(2, Math.max(wound.severity, severity) + physicalTravel * 0.35);
    this.appendSlashSurfaceSample(wound, worldEnd, surfaceNormal);
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
    this.updateSurfaceDebug(this.wounds.at(-1));
  }

  getAttachedSurfacePose(wound) {
    if (validateSurfaceBinding(wound.surfaceBinding)) {
      const reconstructed = this.actor.visualAdapter?.reconstructVisibleSurface?.(wound.surfaceBinding) ?? reconstructSkinnedSurface(wound.surfaceBinding);
      if (reconstructed) {
        wound.surfaceBindingStatus = 'skinned_triangle';
        wound.fallbackAnchorUsage = false;
        return reconstructed;
      }
    }
    const semantic = this.getWorldPose(wound);
    if (!semantic) return null;
    if (!wound.surfaceRetryAttempted && this.actor.visualAdapter?.scene) {
      wound.surfaceRetryAttempted = true;
      this.attachPunctureSurface(wound, semantic.point, semantic.normal);
      if (wound.surfaceBinding) return this.getAttachedSurfacePose(wound);
    }
    wound.surfaceBindingStatus = 'fallback_anchor';
    wound.fallbackAnchorUsage = true;
    return this.actor.visualAdapter?.getFallbackWoundAnchor?.(wound.bodyId, semantic.point, semantic.normal) ?? semantic;
  }

  getWoundMaterial(wound, isSlash) {
    if (wound.vesselInvolvement?.vesselType?.includes('arterial')) return isSlash ? this.materials.arterialCut : this.materials.arterial;
    if (wound.severity >= WOUND_CONFIG.seriousSeverity) return isSlash ? this.materials.deepCut : this.materials.deep;
    if (wound.woundType === 'blunt_trauma_marker') return this.materials.blunt;
    return isSlash ? this.materials.cut : this.materials.puncture;
  }

  updateWoundVisual(wound) {
    const slot = wound?.visualSlot;
    if (!slot) return;
    const isSlash = wound.cutLength > 0.001 || ['shallow_cut', 'deep_slash'].includes(wound.woundType);
    const validSlashSamples = wound.slashSamples?.filter((sample) => validateSurfaceBinding(sample.binding)) ?? [];
    const useSlashVisual = isSlash && validSlashSamples.length >= 2;
    slot.puncture.visible = !useSlashVisual;
    slot.slash.visible = useSlashVisual;
    const material = this.getWoundMaterial(wound, useSlashVisual);
    if (!useSlashVisual) {
      const pose = this.getAttachedSurfacePose(wound);
      if (!pose) return;
      slot.puncture.material = material;
      slot.puncture.position.copy(pose.point).addScaledVector(pose.normal, WOUND_SURFACE_BIAS);
      slot.puncture.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pose.normal);
      slot.puncture.rotateZ(((Number(wound.id.split('_')[1]) * 2.399) % (Math.PI * 2)) - Math.PI);
      const radius = wound.woundType === 'blunt_trauma_marker' ? 0.028 + wound.severity * 0.02 : 0.013 + THREE.MathUtils.clamp(wound.severity, 0, 1.5) * 0.014;
      slot.puncture.scale.set(radius * (wound.woundType === 'deep_puncture' ? 0.76 : 0.92), radius, 1);
      wound.surfaceDistance = WOUND_SURFACE_BIAS;
      return;
    }
    slot.slash.material = material;
    slot.slash.position.set(0, 0, 0);
    slot.slash.quaternion.identity();
    slot.slash.scale.set(1, 1, 1);
    const reconstructed = wound.slashSamples.map((sample) => validateSurfaceBinding(sample.binding) ? reconstructSkinnedSurface(sample.binding) : null);
    const positions = slot.slash.geometry.attributes.position.array;
    const normals = slot.slash.geometry.attributes.normal.array;
    let segmentCount = 0;
    const baseWidth = 0.0048 + THREE.MathUtils.clamp(wound.severity, 0, 1.5) * 0.0052;
    for (let index = 0; index < reconstructed.length - 1 && segmentCount < MAX_SLASH_SURFACE_SAMPLES - 1; index += 1) {
      const start = reconstructed[index];
      const end = reconstructed[index + 1];
      const endSample = wound.slashSamples[index + 1];
      if (!start || !end || endSample.breakBefore || end.point.distanceTo(start.point) > 0.14) continue;
      tmpDirection.subVectors(end.point, start.point);
      if (tmpDirection.lengthSq() < 1e-8) continue;
      tmpDirection.normalize();
      tmpNormal.copy(start.normal).add(end.normal).normalize();
      tmpSide.copy(tmpDirection).cross(tmpNormal).normalize();
      if (tmpSide.lengthSq() < 1e-8) tmpSide.set(1, 0, 0).cross(tmpNormal).normalize();
      const startTaper = Math.max(0.28, Math.sin(Math.PI * index / Math.max(1, reconstructed.length - 1)));
      const endTaper = Math.max(0.28, Math.sin(Math.PI * (index + 1) / Math.max(1, reconstructed.length - 1)));
      const startWidth = baseWidth * startTaper * (0.92 + 0.08 * Math.sin(index * 3.1));
      const endWidth = baseWidth * endTaper * (0.94 + 0.06 * Math.sin(index * 4.7 + 1));
      const vertices = [
        start.point.clone().addScaledVector(tmpSide, startWidth).addScaledVector(start.normal, WOUND_SURFACE_BIAS),
        start.point.clone().addScaledVector(tmpSide, -startWidth).addScaledVector(start.normal, WOUND_SURFACE_BIAS),
        end.point.clone().addScaledVector(tmpSide, endWidth).addScaledVector(end.normal, WOUND_SURFACE_BIAS),
        end.point.clone().addScaledVector(tmpSide, -endWidth).addScaledVector(end.normal, WOUND_SURFACE_BIAS),
      ];
      vertices.forEach((point, vertexIndex) => {
        const offset = segmentCount * 12 + vertexIndex * 3;
        positions[offset] = point.x; positions[offset + 1] = point.y; positions[offset + 2] = point.z;
        const normal = vertexIndex < 2 ? start.normal : end.normal;
        normals[offset] = normal.x; normals[offset + 1] = normal.y; normals[offset + 2] = normal.z;
      });
      segmentCount += 1;
    }
    slot.slash.geometry.setDrawRange(0, segmentCount * 6);
    slot.slash.geometry.attributes.position.needsUpdate = true;
    slot.slash.geometry.attributes.normal.needsUpdate = true;
    slot.slash.geometry.computeBoundingSphere();
    slot.slash.visible = segmentCount > 0;
    slot.puncture.visible = segmentCount === 0;
    wound.surfaceDistance = WOUND_SURFACE_BIAS;
    wound.renderedSegmentCount = segmentCount;
  }

  updateSurfaceDebug(wound) {
    if (!this.debugVisible || !wound) return;
    this.surfaceDebugRoot.visible = true;
    const semantic = this.getWorldPose(wound);
    const binding = wound.surfaceBinding ?? wound.slashSamples?.at(-1)?.binding;
    const surface = validateSurfaceBinding(binding) ? reconstructSkinnedSurface(binding) : this.getAttachedSurfacePose(wound);
    if (!semantic || !surface) return;
    this.debugAnchor.position.copy(surface.point);
    this.debugProxy.position.copy(semantic.point);
    const normalPositions = this.debugNormal.geometry.attributes.position;
    normalPositions.setXYZ(0, surface.point.x, surface.point.y, surface.point.z);
    const normalEnd = surface.point.clone().addScaledVector(surface.normal, 0.08);
    normalPositions.setXYZ(1, normalEnd.x, normalEnd.y, normalEnd.z);
    normalPositions.needsUpdate = true;
    if (surface.vertices) {
      const trianglePositions = this.debugTriangle.geometry.attributes.position;
      [...surface.vertices, surface.vertices[0]].forEach((point, index) => trianglePositions.setXYZ(index, point.x, point.y, point.z));
      trianglePositions.needsUpdate = true;
      this.debugTriangle.visible = true;
    } else this.debugTriangle.visible = false;
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
    wound.surfaceBinding = null;
    wound.slashSamples.length = 0;
  }

  clear() {
    [...this.wounds].forEach((wound) => this.removeWound(wound.id));
    this.nextWoundId = 1;
    this.failedProjectionCount = 0;
    this.fallbackUsageCount = 0;
    this.surfaceDebugRoot.visible = false;
  }

  getDiagnostics() {
    const wound = this.wounds.at(-1);
    const binding = wound?.surfaceBinding ?? wound?.slashSamples?.at(-1)?.binding;
    return { count: this.wounds.length, active: this.getActiveWounds().length, arterial: this.wounds.filter((entry) => entry.bleedingProfile.kind.includes('arterial')).length, failedProjectionCount: this.failedProjectionCount, fallbackAnchorUsage: this.fallbackUsageCount, selected: wound ? { id: wound.id, regionId: wound.regionId, type: wound.woundType, depth: Number(wound.maximumDepth.toFixed(3)), length: Number(wound.cutLength.toFixed(3)), severity: Number(wound.severity.toFixed(3)), vessel: wound.vesselInvolvement?.id ?? null, bleedingRate: Number(wound.bleedingRate.toFixed(4)), surfaceBindingStatus: wound.surfaceBindingStatus, meshName: binding?.meshName ?? null, triangleIndices: binding?.triangleIndices ?? null, barycentric: binding?.barycentric?.toArray?.().map((value) => Number(value.toFixed(4))) ?? null, surfaceDistance: wound.surfaceDistance, slashSampleCount: wound.slashSamples?.length ?? 0, renderedSegmentCount: wound.renderedSegmentCount ?? 0, failedProjectionCount: wound.failedProjectionCount ?? 0, fallbackAnchorUsage: wound.fallbackAnchorUsage } : null };
  }

  dispose() {
    this.clear();
    this.visualSlots.forEach((slot) => { slot.puncture.geometry.dispose(); slot.slash.geometry.dispose(); slot.puncture.removeFromParent(); slot.slash.removeFromParent(); });
    Object.values(this.materials).forEach((material) => material.dispose());
    this.punctureTexture.dispose();
    this.slashTexture.dispose();
    this.surfaceDebugRoot.traverse((object) => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
    this.surfaceDebugRoot.removeFromParent();
    this.visualSlots = [];
  }
}

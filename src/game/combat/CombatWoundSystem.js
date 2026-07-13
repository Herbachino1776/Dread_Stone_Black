import * as THREE from 'three';
import { VESSEL_ZONES, WOUND_CONFIG } from './CombatStage2Config.js';
import { KNIFE_COMBAT_CONFIG } from './CombatConfig.js';
import { getAlphaBoundUv } from './KnifeWoundDecalLibrary.js';
import { MAX_SLASH_SURFACE_SAMPLES, MIN_SLASH_SURFACE_SAMPLES, WOUND_SURFACE_BIAS, reconstructSkinnedSurface, sampleSlashPath, validateSurfaceBinding } from './SkinnedSurfaceBinding.js';
import { enableCombatReadabilityLightLayer } from './CombatReadabilityLightLayer.js';

const tmpPosition = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpNormal = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();
const tmpSide = new THREE.Vector3();
const tmpTangent = new THREE.Vector3();
const tmpEdgeA = new THREE.Vector3();
const tmpEdgeB = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

export const PUNCTURE_VISUAL_LIMITS = Object.freeze({
  shallow: Object.freeze({ major: [0.012, 0.024], minor: [0.004, 0.01] }),
  deep: Object.freeze({ major: [0.02, 0.04], minor: [0.007, 0.015] }),
  severe: Object.freeze({ major: [0.02, 0.055], minor: [0.007, 0.022] }),
});

export const SLASH_VISUAL_WIDTH_LIMITS = Object.freeze({ shallow: [0.004, 0.01], deep: [0.008, 0.02], severeMaximum: 0.03 });

function makePunctureGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0,
  ], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(8), 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  return geometry;
}

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

export function derivePuncturePhysicalDimensions({
  bladeWidth = KNIFE_COMBAT_CONFIG.bladeWidth,
  bladeThickness = KNIFE_COMBAT_CONFIG.bladeThickness,
  penetrationDepth = 0.004,
  entryObliqueness = 0,
  impactSeverity = 0,
  withdrawalDamage = 0,
  reopeningCount = 0,
  lateralTearingMeters = 0,
} = {}) {
  const depthRatio = THREE.MathUtils.clamp(penetrationDepth / KNIFE_COMBAT_CONFIG.maximumPenetrationDepth, 0, 1);
  const oblique = THREE.MathUtils.clamp(entryObliqueness, 0, 1);
  const impact = THREE.MathUtils.clamp(impactSeverity, 0, 1);
  const withdrawal = THREE.MathUtils.clamp(withdrawalDamage, 0, 1);
  const reopening = Math.max(0, reopeningCount);
  const lateral = THREE.MathUtils.clamp(lateralTearingMeters, 0, 0.06);
  const entryMajorMeters = THREE.MathUtils.clamp(bladeWidth * (0.265 + depthRatio * 0.34 + impact * 0.035) * (1 + oblique * 0.22), 0.012, 0.04);
  const entryMinorMeters = THREE.MathUtils.clamp(bladeThickness * (0.33 + depthRatio * 0.55 + impact * 0.04) * (1 + oblique * 0.2), 0.004, 0.015);
  const disruption = THREE.MathUtils.clamp(depthRatio * 0.32 + oblique * 0.38 + impact * 0.18 + lateral / 0.06 * 0.36 + withdrawal * 0.2 + Math.min(3, reopening) * 0.12, 0, 1);
  const severe = oblique > 0.38 || lateral > 0.012 || withdrawal > 0.38 || reopening > 0;
  const majorMaximum = severe ? PUNCTURE_VISUAL_LIMITS.severe.major[1] : penetrationDepth < 0.025 ? PUNCTURE_VISUAL_LIMITS.shallow.major[1] : PUNCTURE_VISUAL_LIMITS.deep.major[1];
  const minorMaximum = severe ? PUNCTURE_VISUAL_LIMITS.severe.minor[1] : penetrationDepth < 0.025 ? PUNCTURE_VISUAL_LIMITS.shallow.minor[1] : PUNCTURE_VISUAL_LIMITS.deep.minor[1];
  const visualMajorMeters = THREE.MathUtils.clamp(entryMajorMeters + lateral * 0.42 + withdrawal * 0.006 + reopening * 0.0035 + oblique * depthRatio * 0.004, 0.012, majorMaximum);
  const visualMinorMeters = THREE.MathUtils.clamp(entryMinorMeters + lateral * 0.16 + withdrawal * 0.0025 + reopening * 0.0015 + oblique * depthRatio * 0.002, 0.004, minorMaximum);
  return { entryMajorMeters, entryMinorMeters, entryAreaMetersSquared: Math.PI * entryMajorMeters * entryMinorMeters * 0.25, visualMajorMeters, visualMinorMeters, surfaceDisruption: disruption };
}

export function deriveSlashPhysicalDimensions({ cutLength = 0, maximumDepth = 0, edgeAlignment = 1, severity = 0, reopeningCount = 0, lateralTearingMeters = 0 } = {}) {
  const depthRatio = THREE.MathUtils.clamp(maximumDepth / 0.072, 0, 1);
  const engagement = THREE.MathUtils.clamp(edgeAlignment, 0, 1);
  const severe = maximumDepth >= 0.055 || severity >= 0.85 || reopeningCount > 0 || lateralTearingMeters > 0.015;
  const base = 0.004 + depthRatio * 0.009 + engagement * 0.0025 + THREE.MathUtils.clamp(severity, 0, 1) * 0.0035;
  const growth = reopeningCount * 0.002 + THREE.MathUtils.clamp(lateralTearingMeters, 0, 0.04) * 0.18;
  const maximum = severe ? SLASH_VISUAL_WIDTH_LIMITS.severeMaximum : maximumDepth >= 0.032 ? SLASH_VISUAL_WIDTH_LIMITS.deep[1] : SLASH_VISUAL_WIDTH_LIMITS.shallow[1];
  return { visualLengthMeters: THREE.MathUtils.clamp(cutLength, 0, WOUND_CONFIG.maximumCutLength), visualWidthMeters: THREE.MathUtils.clamp(base + growth, SLASH_VISUAL_WIDTH_LIMITS.shallow[0], maximum) };
}

function distancePointToSegment2D(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 1e-8 ? THREE.MathUtils.clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export class CombatWoundSystem {
  constructor({ actor, scene, decalLibrary, maximumWounds = WOUND_CONFIG.maximumWounds } = {}) {
    this.actor = actor;
    this.scene = scene;
    this.maximumWounds = maximumWounds;
    this.wounds = [];
    this.nextWoundId = 1;
    this.visualSlots = [];
    this.decalLibrary = decalLibrary;
    this.bluntMaterial = new THREE.MeshStandardMaterial({ color: 0x372229, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.72, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.failedProjectionCount = 0;
    this.fallbackUsageCount = 0;
    this.bindingFailureLogged = false;
    this.debugVisible = false;
    this.createVisualPool();
    this.createSurfaceDebug();
  }

  createVisualPool() {
    for (let index = 0; index < this.maximumWounds; index += 1) {
      const puncture = new THREE.Mesh(makePunctureGeometry(), this.bluntMaterial);
      puncture.name = `combat-wound-puncture-visual-${index}`;
      puncture.visible = false;
      puncture.castShadow = false;
      puncture.receiveShadow = false;
      enableCombatReadabilityLightLayer(puncture);
      const slash = new THREE.Mesh(makeSlashGeometry(), this.bluntMaterial);
      slash.name = `combat-wound-slash-visual-${index}`;
      slash.visible = false;
      slash.castShadow = false;
      slash.receiveShadow = false;
      enableCombatReadabilityLightLayer(slash);
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

  captureEntryTangent(wound, worldTangent) {
    const tangent = worldTangent?.clone?.() ?? new THREE.Vector3(1, 0, 0);
    const bodyRotation = this.actor.bodies.get(wound.bodyId)?.body?.rotation?.();
    const inverseBody = bodyRotation ? new THREE.Quaternion(bodyRotation.x, bodyRotation.y, bodyRotation.z, bodyRotation.w).invert() : new THREE.Quaternion();
    wound.entryTangent = tangent.clone().applyQuaternion(inverseBody).normalize();
    const surface = validateSurfaceBinding(wound.surfaceBinding) ? reconstructSkinnedSurface(wound.surfaceBinding) : null;
    if (!surface?.vertices) return;
    tmpEdgeA.subVectors(surface.vertices[1], surface.vertices[0]);
    tmpEdgeB.subVectors(surface.vertices[2], surface.vertices[0]);
    tangent.addScaledVector(surface.normal, -tangent.dot(surface.normal)).normalize();
    const aa = tmpEdgeA.dot(tmpEdgeA); const ab = tmpEdgeA.dot(tmpEdgeB); const bb = tmpEdgeB.dot(tmpEdgeB);
    const at = tmpEdgeA.dot(tangent); const bt = tmpEdgeB.dot(tangent); const determinant = aa * bb - ab * ab;
    if (Math.abs(determinant) > 1e-10) wound.entryTangentSurface = new THREE.Vector2((at * bb - bt * ab) / determinant, (bt * aa - at * ab) / determinant);
  }

  updatePunctureDimensions(wound) {
    const dimensions = derivePuncturePhysicalDimensions({
      bladeWidth: wound.bladeWidth,
      bladeThickness: wound.bladeThickness,
      penetrationDepth: wound.maximumDepth,
      entryObliqueness: wound.entryObliqueness,
      impactSeverity: wound.impactSeverity,
      withdrawalDamage: wound.withdrawalDamage,
      reopeningCount: wound.reopenedCount,
      lateralTearingMeters: wound.lateralTearingMeters,
    });
    Object.assign(wound, dimensions);
    wound.visualRevision = (wound.visualRevision ?? 0) + 1;
    return dimensions;
  }

  updateSlashDimensions(wound) {
    Object.assign(wound, deriveSlashPhysicalDimensions({ cutLength: wound.cutLength, maximumDepth: wound.maximumDepth, edgeAlignment: wound.edgeAlignment, severity: wound.severity, reopeningCount: wound.reopenedCount, lateralTearingMeters: wound.lateralTearingMeters }));
    wound.visualRevision = (wound.visualRevision ?? 0) + 1;
  }

  ensureDecalSelection(wound, family) {
    if (wound.decalVariantId || family === 'blunt') return;
    const selectionSurfaceDisruption = THREE.MathUtils.clamp((wound.surfaceDisruption ?? 0) + (wound.impactSeverity ?? 0) * 0.38 + (wound.entryObliqueness ?? 0) * 0.18, 0, 1);
    const selection = this.decalLibrary.select(family === 'puncture' ? {
      family,
      woundId: wound.id,
      penetrationDepth: wound.maximumDepth,
      entryObliqueness: wound.entryObliqueness,
      impactSeverity: wound.impactSeverity,
      lateralTearingMeters: wound.lateralTearingMeters,
      withdrawalDamage: wound.withdrawalDamage,
      reopeningCount: wound.reopenedCount,
      surfaceDisruption: selectionSurfaceDisruption,
      selectionSeverity: selectionSurfaceDisruption,
    } : {
      family,
      woundId: wound.id,
      cutLength: wound.cutLength,
      maximumDepth: wound.maximumDepth,
      edgeAlignment: wound.edgeAlignment,
      pathCurvature: wound.pathCurvature,
      interrupted: wound.lastContactInterrupted,
      surfaceDisruption: THREE.MathUtils.clamp(wound.severity * 0.62 + wound.maximumDepth / 0.072 * 0.38, 0, 1),
      selectionSeverity: THREE.MathUtils.clamp(wound.severity, 0, 1),
    });
    wound.decalVariantId = selection.variant.id;
    wound.decalFamily = family;
    wound.deterministicSeed = selection.deterministicSeed;
    wound.mirroredX = selection.mirroredX;
    wound.decalRotationVariation = selection.rotationVariationRadians;
    wound.selectedAtSeverity = selection.selectedAtSeverity;
  }

  createPuncture({ hit, entryPoint, axis, surfaceNormal = null, entryTangent = null, depth = 0.004, impactSeverity = 0, weaponProfile = KNIFE_COMBAT_CONFIG, hardStructureContact = false, embeddedWeaponId = null, createdTime = 0 } = {}) {
    const nearby = this.findNearbyWound(hit.bodyId, hit.localPoint, ['puncture', 'deep_puncture', 'arterial_wound']);
    if (nearby && nearby.localEntryPoint.distanceTo(hit.localPoint) <= WOUND_CONFIG.reopenResistanceFactor * 0.1) {
      nearby.active = true;
      nearby.closed = false;
      nearby.reopenedCount += 1;
      nearby.embeddedWeaponId = embeddedWeaponId;
      nearby.withdrawalBoostRemaining = 0;
      nearby.maximumDepth = Math.max(nearby.maximumDepth, depth);
      nearby.currentDepth = depth;
      nearby.impactSeverity = Math.max(nearby.impactSeverity, THREE.MathUtils.clamp(impactSeverity, 0, 1));
      this.updatePunctureDimensions(nearby);
      this.updateWoundVisual(nearby);
      return nearby;
    }
    const inverseBody = new THREE.Quaternion(hit.body.rotation().x, hit.body.rotation().y, hit.body.rotation().z, hit.body.rotation().w).invert();
    const localAxis = axis.clone().applyQuaternion(inverseBody).normalize();
    const worldSurfaceNormal = surfaceNormal?.clone?.().normalize() ?? axis.clone().negate().normalize();
    const localNormal = worldSurfaceNormal.clone().applyQuaternion(inverseBody).normalize();
    const entryAlignment = THREE.MathUtils.clamp(Math.abs(axis.dot(worldSurfaceNormal)), 0, 1);
    const wound = this.createWound({
      actor: this.actor,
      regionId: hit.regionId,
      bodyId: hit.bodyId,
      woundType: depth >= 0.075 ? 'deep_puncture' : 'puncture',
      localEntryPoint: hit.localPoint.clone(),
      localSurfaceNormal: localNormal,
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
      bladeWidth: weaponProfile?.bladeWidth ?? KNIFE_COMBAT_CONFIG.bladeWidth,
      bladeThickness: weaponProfile?.bladeThickness ?? KNIFE_COMBAT_CONFIG.bladeThickness,
      entryAlignment,
      entryObliqueness: 1 - entryAlignment,
      impactSeverity: THREE.MathUtils.clamp(impactSeverity, 0, 1),
      withdrawalDamage: 0,
      lateralTearingMeters: 0,
    });
    this.updatePunctureDimensions(wound);
    this.ensureDecalSelection(wound, 'puncture');
    this.resolveBleedingProfile(wound);
    this.attachPunctureSurface(wound, entryPoint, worldSurfaceNormal);
    this.captureEntryTangent(wound, entryTangent);
    this.updateWoundVisual(wound);
    return wound;
  }

  createSlash({ hit, startPoint, endPoint, surfaceNormal, cutDirection, depth, cutLength, severity, classification, edgeAlignment = 1, createdTime = 0 } = {}) {
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
      this.updateSlashDimensions(existing);
      this.resolveBleedingProfile(existing);
      this.updateWoundVisual(existing);
      return existing;
    }
    const woundType = classification === 'deep_slash' ? 'deep_slash' : 'shallow_cut';
    const wound = this.createWound({ actor: this.actor, regionId: hit.regionId, bodyId: hit.bodyId, woundType, localEntryPoint: localStart.clone(), localSurfaceNormal: localNormal, localPenetrationAxis: localNormal.clone().negate(), currentDepth: depth, maximumDepth: depth, cutLength: Math.min(cutLength, WOUND_CONFIG.maximumCutLength), localCutStart: localStart, localCutEnd: localEnd, localCutDirection: localDirection, severity, tissueClass: hit.region?.vital ?? 'none', hardStructureContact: false, embeddedWeaponId: null, createdTime, edgeAlignment: THREE.MathUtils.clamp(edgeAlignment, 0, 1), pathCurvature: 0, lateralTearingMeters: 0 });
    wound.failedProjectionCount = 0;
    wound.nextSampleBreak = false;
    this.attachSlashSamples(wound, startPoint, endPoint, surfaceNormal);
    this.updateSlashDimensions(wound);
    this.ensureDecalSelection(wound, 'slash');
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
    const wound = { id, ...data, vesselInvolvement: null, bleedingProfile: { kind: 'capillary', baseRate: 0.002 }, bleedingRate: 0, bloodEmitted: 0, withdrawalBoostRemaining: 0, pulsePhase: 0, active: true, closed: false, reopenedCount: 0, visualSlot, visualOwner: visualSlot ? 'pooled-skinned-surface-visual' : null, surfaceBinding: null, surfaceBindingStatus: 'pending', surfaceBindingAttempted: false, fallbackAnchorUsage: false, surfaceDistance: null, slashSamples: [], failedProjectionCount: 0, decalVariantId: null, decalFamily: null, deterministicSeed: null, mirroredX: false, selectedAtSeverity: null, visualRevision: 0 };
    this.wounds.push(wound);
    return wound;
  }

  extendPuncture(woundId, { depth, hardStructureContact = false, lateralMotion = 0 } = {}) {
    const wound = this.getWound(woundId);
    if (!wound) return null;
    wound.currentDepth = Math.max(0, depth);
    wound.maximumDepth = Math.max(wound.maximumDepth, depth);
    wound.lateralTearingMeters = Math.max(wound.lateralTearingMeters ?? 0, Math.max(0, lateralMotion));
    wound.hardStructureContact ||= hardStructureContact;
    if (wound.maximumDepth >= 0.075 && wound.woundType === 'puncture') wound.woundType = 'deep_puncture';
    wound.severity = Math.max(wound.severity, THREE.MathUtils.clamp(wound.maximumDepth * 5.2, 0.04, 1.7));
    this.updatePunctureDimensions(wound);
    this.resolveBleedingProfile(wound);
    this.updateWoundVisual(wound);
    return wound;
  }

  extendSlash(woundId, { localEnd, worldEnd = null, surfaceNormal = null, addedTravel, depth, severity, edgeAlignment = null } = {}) {
    const wound = this.getWound(woundId);
    if (!wound) return null;
    const physicalTravel = Math.max(0, addedTravel);
    wound.localCutEnd.copy(localEnd);
    wound.cutLength = Math.min(WOUND_CONFIG.maximumCutLength, wound.cutLength + physicalTravel);
    wound.currentDepth = Math.max(wound.currentDepth, depth);
    wound.maximumDepth = Math.max(wound.maximumDepth, depth);
    wound.severity = Math.min(2, Math.max(wound.severity, severity) + physicalTravel * 0.35);
    if (Number.isFinite(edgeAlignment)) wound.edgeAlignment = THREE.MathUtils.lerp(wound.edgeAlignment, THREE.MathUtils.clamp(edgeAlignment, 0, 1), 0.35);
    this.appendSlashSurfaceSample(wound, worldEnd, surfaceNormal);
    if (wound.maximumDepth >= 0.05 || wound.severity >= WOUND_CONFIG.seriousSeverity) wound.woundType = 'deep_slash';
    this.updateSlashDimensions(wound);
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
    wound.withdrawalDamage = Math.max(wound.withdrawalDamage ?? 0, THREE.MathUtils.clamp(releaseSeverity / Math.max(0.02, wound.maximumDepth), 0, 1));
    this.updatePunctureDimensions(wound);
    this.updateWoundVisual(wound);
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

  getWoundMaterial(wound) { return wound.woundType === 'blunt_trauma_marker' ? this.bluntMaterial : this.decalLibrary.getMaterial(wound.decalVariantId); }

  applyPunctureUv(slot, wound) {
    const variant = this.decalLibrary.getVariant(wound.decalVariantId);
    if (!variant) return;
    const { u0, u1, v0, v1 } = getAlphaBoundUv(variant, wound.mirroredX);
    const uv = slot.puncture.geometry.attributes.uv;
    uv.setXY(0, u0, v0); uv.setXY(1, u1, v0); uv.setXY(2, u0, v1); uv.setXY(3, u1, v1);
    uv.needsUpdate = true;
  }

  resolvePunctureTangent(wound, pose) {
    if (pose.vertices && wound.entryTangentSurface) {
      tmpEdgeA.subVectors(pose.vertices[1], pose.vertices[0]);
      tmpEdgeB.subVectors(pose.vertices[2], pose.vertices[0]);
      tmpTangent.copy(tmpEdgeA).multiplyScalar(wound.entryTangentSurface.x).addScaledVector(tmpEdgeB, wound.entryTangentSurface.y);
    } else {
      const worldPose = this.getWorldPose(wound);
      tmpTangent.copy(wound.entryTangent ?? new THREE.Vector3(1, 0, 0)).applyQuaternion(worldPose?.bodyQuaternion ?? new THREE.Quaternion());
    }
    tmpTangent.addScaledVector(pose.normal, -tmpTangent.dot(pose.normal));
    if (tmpTangent.lengthSq() < 1e-8) tmpTangent.set(1, 0, 0).addScaledVector(pose.normal, -pose.normal.x);
    return tmpTangent.normalize();
  }

  updateWoundVisual(wound) {
    const slot = wound?.visualSlot;
    if (!slot) return;
    const isSlash = wound.cutLength > 0.001 || ['shallow_cut', 'deep_slash'].includes(wound.woundType);
    const validSlashSamples = wound.slashSamples?.filter((sample) => validateSurfaceBinding(sample.binding)) ?? [];
    const useSlashVisual = isSlash && validSlashSamples.length >= 2;
    slot.puncture.visible = !useSlashVisual;
    slot.slash.visible = useSlashVisual;
    const material = this.getWoundMaterial(wound);
    if (!useSlashVisual) {
      const pose = this.getAttachedSurfacePose(wound);
      if (!pose) return;
      if (slot.puncture.material !== material) slot.puncture.material = material;
      slot.puncture.position.copy(pose.point).addScaledVector(pose.normal, WOUND_SURFACE_BIAS);
      if (wound.woundType === 'blunt_trauma_marker') {
        slot.puncture.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pose.normal);
        const diameter = 0.028 + wound.severity * 0.02;
        slot.puncture.scale.set(diameter, diameter, 1);
      } else {
        const tangent = this.resolvePunctureTangent(wound, pose);
        tmpSide.crossVectors(pose.normal, tangent).normalize();
        tmpMatrix.makeBasis(tangent, tmpSide, pose.normal);
        slot.puncture.quaternion.setFromRotationMatrix(tmpMatrix);
        slot.puncture.rotateZ(wound.decalRotationVariation ?? 0);
        const signature = `${wound.decalVariantId}:${wound.mirroredX}:${wound.visualRevision}`;
        if (slot.puncture.userData.visualSignature !== signature) {
          this.applyPunctureUv(slot, wound);
          slot.puncture.scale.set(wound.visualMajorMeters, wound.visualMinorMeters, 1);
          slot.puncture.userData.visualSignature = signature;
        }
      }
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
    const halfWidth = wound.visualWidthMeters * 0.5;
    const variant = this.decalLibrary.getVariant(wound.decalVariantId);
    const croppedUv = variant ? getAlphaBoundUv(variant, wound.mirroredX) : { u0: 0, u1: 1, v0: 0, v1: 1 };
    const uvs = slot.slash.geometry.attributes.uv.array;
    const sourceLengths = [];
    let totalSourceLength = 0;
    for (let index = 0; index < wound.slashSamples.length - 1; index += 1) {
      const length = wound.slashSamples[index + 1].breakBefore ? 0 : wound.slashSamples[index].sourcePoint.distanceTo(wound.slashSamples[index + 1].sourcePoint);
      sourceLengths[index] = length;
      totalSourceLength += length;
    }
    let consumedSourceLength = 0;
    const updateUv = slot.slash.userData.uvRevision !== wound.visualRevision;
    for (let index = 0; index < reconstructed.length - 1 && segmentCount < MAX_SLASH_SURFACE_SAMPLES - 1; index += 1) {
      const start = reconstructed[index];
      const end = reconstructed[index + 1];
      const endSample = wound.slashSamples[index + 1];
      const sourceLength = sourceLengths[index] ?? 0;
      if (!start || !end || endSample.breakBefore || end.point.distanceTo(start.point) > 0.14) { consumedSourceLength += sourceLength; continue; }
      tmpDirection.subVectors(end.point, start.point);
      if (tmpDirection.lengthSq() < 1e-8) continue;
      tmpDirection.normalize();
      tmpNormal.copy(start.normal).add(end.normal).normalize();
      tmpSide.copy(tmpDirection).cross(tmpNormal).normalize();
      if (tmpSide.lengthSq() < 1e-8) tmpSide.set(1, 0, 0).cross(tmpNormal).normalize();
      const vertices = [
        start.point.clone().addScaledVector(tmpSide, halfWidth).addScaledVector(start.normal, WOUND_SURFACE_BIAS),
        start.point.clone().addScaledVector(tmpSide, -halfWidth).addScaledVector(start.normal, WOUND_SURFACE_BIAS),
        end.point.clone().addScaledVector(tmpSide, halfWidth).addScaledVector(end.normal, WOUND_SURFACE_BIAS),
        end.point.clone().addScaledVector(tmpSide, -halfWidth).addScaledVector(end.normal, WOUND_SURFACE_BIAS),
      ];
      vertices.forEach((point, vertexIndex) => {
        const offset = segmentCount * 12 + vertexIndex * 3;
        positions[offset] = point.x; positions[offset + 1] = point.y; positions[offset + 2] = point.z;
        const normal = vertexIndex < 2 ? start.normal : end.normal;
        normals[offset] = normal.x; normals[offset + 1] = normal.y; normals[offset + 2] = normal.z;
      });
      if (updateUv) {
        const startFraction = totalSourceLength > 1e-8 ? consumedSourceLength / totalSourceLength : 0;
        const endFraction = totalSourceLength > 1e-8 ? (consumedSourceLength + sourceLength) / totalSourceLength : 1;
        const startU = THREE.MathUtils.lerp(croppedUv.u0, croppedUv.u1, startFraction);
        const endU = THREE.MathUtils.lerp(croppedUv.u0, croppedUv.u1, endFraction);
        const uvOffset = segmentCount * 8;
        uvs.set([startU, croppedUv.v1, startU, croppedUv.v0, endU, croppedUv.v1, endU, croppedUv.v0], uvOffset);
      }
      consumedSourceLength += sourceLength;
      segmentCount += 1;
    }
    slot.slash.geometry.setDrawRange(0, segmentCount * 6);
    slot.slash.geometry.attributes.position.needsUpdate = true;
    slot.slash.geometry.attributes.normal.needsUpdate = true;
    if (updateUv) { slot.slash.geometry.attributes.uv.needsUpdate = true; slot.slash.userData.uvRevision = wound.visualRevision; }
    slot.slash.geometry.computeBoundingSphere();
    slot.slash.visible = segmentCount > 0;
    slot.puncture.visible = segmentCount === 0;
    wound.surfaceDistance = WOUND_SURFACE_BIAS;
    wound.renderedSegmentCount = segmentCount;
    wound.visualLengthMeters = Math.min(wound.cutLength, totalSourceLength || wound.cutLength);
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
    return { count: this.wounds.length, active: this.getActiveWounds().length, arterial: this.wounds.filter((entry) => entry.bleedingProfile.kind.includes('arterial')).length, failedProjectionCount: this.failedProjectionCount, fallbackAnchorUsage: this.fallbackUsageCount, decalLibrary: this.decalLibrary.getDiagnostics(), selected: wound ? { id: wound.id, regionId: wound.regionId, type: wound.woundType, depth: Number(wound.maximumDepth.toFixed(3)), length: Number(wound.cutLength.toFixed(3)), severity: Number(wound.severity.toFixed(3)), decalVariantId: wound.decalVariantId, decalFamily: wound.decalFamily, mirroredX: wound.mirroredX, entryMajorMeters: wound.entryMajorMeters ?? null, entryMinorMeters: wound.entryMinorMeters ?? null, visualMajorMeters: wound.visualMajorMeters ?? null, visualMinorMeters: wound.visualMinorMeters ?? null, visualLengthMeters: wound.visualLengthMeters ?? null, visualWidthMeters: wound.visualWidthMeters ?? null, vessel: wound.vesselInvolvement?.id ?? null, bleedingRate: Number(wound.bleedingRate.toFixed(4)), surfaceBindingStatus: wound.surfaceBindingStatus, meshName: binding?.meshName ?? null, triangleIndices: binding?.triangleIndices ?? null, barycentric: binding?.barycentric?.toArray?.().map((value) => Number(value.toFixed(4))) ?? null, surfaceDistance: wound.surfaceDistance, slashSampleCount: wound.slashSamples?.length ?? 0, renderedSegmentCount: wound.renderedSegmentCount ?? 0, failedProjectionCount: wound.failedProjectionCount ?? 0, fallbackAnchorUsage: wound.fallbackAnchorUsage } : null };
  }

  dispose() {
    this.clear();
    this.visualSlots.forEach((slot) => { slot.puncture.geometry.dispose(); slot.slash.geometry.dispose(); slot.puncture.removeFromParent(); slot.slash.removeFromParent(); });
    this.bluntMaterial.dispose();
    this.surfaceDebugRoot.traverse((object) => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
    this.surfaceDebugRoot.removeFromParent();
    this.visualSlots = [];
  }
}

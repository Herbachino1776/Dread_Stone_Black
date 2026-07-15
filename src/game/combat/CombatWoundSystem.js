import * as THREE from 'three';
import { cloneBloodChromaMaterial, createBloodChromaMaterial } from './BloodChromaMaterial.js';
import { BLOOD_COLOR_PALETTE, VESSEL_ZONES, WOUND_CONFIG } from './CombatStage2Config.js';
import { KNIFE_COMBAT_CONFIG } from './CombatConfig.js';
import { getAlphaBoundUv, getKnifeWoundPhysicalCategory } from './KnifeWoundDecalLibrary.js';
import { MAX_SLASH_SURFACE_SAMPLES, MIN_SLASH_SURFACE_SAMPLES, WOUND_SURFACE_BIAS, areSurfaceAnatomiesCompatible, createSurfaceBindingDiagnostics, reconstructSkinnedSurface, reconstructSurfaceBindingNeighborhood, sampleSlashPath, validateSurfaceBinding } from './SkinnedSurfaceBinding.js';
import { enableCombatReadabilityLightLayer } from './CombatReadabilityLightLayer.js';
import { createSlashVisualWorkspace, deriveSlashFragmentMetrics, makeSlashFragmentGeometry, resetSlashVisualPath } from './SlashWoundVisual.js';
import { MAX_SWORD_CUT_SURFACE_SAMPLES, SWORD_CUT_MAX_SEGMENT_LENGTH, SWORD_CUT_TARGET_SAMPLE_SPACING, createSwordCutRibbonWorkspace, makeSwordCutRibbonGeometry, resetSwordCutRibbonGeometry } from './SwordCutWoundVisual.js';
import { FULLY_OPAQUE_THRESHOLD, applyFadeOpacity, captureAndPrepareFadeMaterials, clampFadeOpacity, restoreFadeMaterials } from './MaterialFadeState.js';
import { capturePhysicsBodyTransform, createPunctureCoordinateSnapshot, physicsBodyLocalDirectionToWorld, physicsBodyLocalToWorld, worldDirectionToPhysicsBodyLocal } from './CombatCoordinateSpaces.js';

const tmpPosition = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
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

export const KNIFE_PUNCTURE_PRESENTATION_SCALE = 1.45;
export const SWORD_THRUST_PUNCTURE_PRESENTATION_SCALE = 2.1875;
export const PUNCTURE_DECAL_SCALE = KNIFE_PUNCTURE_PRESENTATION_SCALE;

export const SLASH_VISUAL_WIDTH_LIMITS = Object.freeze({ shallow: [0.004, 0.01], deep: [0.008, 0.02], severeMaximum: 0.03 });
export const MAX_SWORD_CUT_VISUALS = 12;
const LEGACY_KNIFE_SURFACE_PROJECTION_DISTANCE = 0.1;
const MAX_DEV_PUNCTURE_COORDINATE_SNAPSHOTS = 12;

export const KNIFE_PUNCTURE_SURFACE_BINDING_OPTIONS = Object.freeze({
  anatomyAware: false,
  maximumDistance: LEGACY_KNIFE_SURFACE_PROJECTION_DISTANCE,
  allowLegacyDistance: true,
});

export const SWORD_THRUST_SURFACE_BINDING_OPTIONS = Object.freeze({
  anatomyAware: true,
});

export function resolvePunctureSurfaceBindingOptions(wound = {}) {
  return wound.weaponFamily === 'sword'
    ? SWORD_THRUST_SURFACE_BINDING_OPTIONS
    : KNIFE_PUNCTURE_SURFACE_BINDING_OPTIONS;
}

export function createSwordCutVisualDiagnostics() {
  return {
    ...createSurfaceBindingDiagnostics(),
    rebindAttempts: 0,
    rebindSuccesses: 0,
    insertedResampleCount: 0,
    sampleCompactionCount: 0,
    renderedSegmentCount: 0,
    hiddenSegmentCount: 0,
    maximumRenderedSegmentLength: 0,
    maximumMidpointToSurfaceError: 0,
    oneSampleSeedUsageCount: 0,
  };
}

function deriveSwordWoundColors() {
  const arterial = new THREE.Color(BLOOD_COLOR_PALETTE.arterial);
  return {
    center: arterial.clone().multiplyScalar(0.72),
    lips: arterial.clone().multiplyScalar(0.86),
  };
}

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

export function derivePuncturePhysicalDimensions({
  bladeWidth = KNIFE_COMBAT_CONFIG.bladeWidth,
  bladeThickness = KNIFE_COMBAT_CONFIG.bladeThickness,
  maximumPenetrationDepth = KNIFE_COMBAT_CONFIG.maximumPenetrationDepth,
  penetrationDepth = 0.004,
  entryObliqueness = 0,
  impactSeverity = 0,
  withdrawalDamage = 0,
  reopeningCount = 0,
  lateralTearingMeters = 0,
} = {}) {
  const depthRatio = THREE.MathUtils.clamp(penetrationDepth / Math.max(0.001, maximumPenetrationDepth), 0, 1);
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
  constructor({ actor, scene, decalLibrary, maximumWounds = WOUND_CONFIG.maximumWounds, isolateMaterials = false } = {}) {
    this.actor = actor;
    this.scene = scene;
    this.maximumWounds = maximumWounds;
    this.wounds = [];
    this.suppressedBodyIds = new Set();
    this.nextWoundId = 1;
    this.visualSlots = [];
    this.swordVisualSlots = [];
    this.decalLibrary = decalLibrary;
    this.isolateMaterials = isolateMaterials === true;
    this.ownedMaterials = new Map();
    if (this.isolateMaterials) this.decalLibrary.materialsById.forEach((sourceMaterial) => this.ownedMaterials.set(sourceMaterial, cloneBloodChromaMaterial(sourceMaterial)));
    this.fadePrepared = false;
    this.fadeMaterialBaselines = new Map();
    this.bluntMaterial = new THREE.MeshStandardMaterial({ color: 0x372229, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.72, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const swordWoundColors = deriveSwordWoundColors();
    this.swordCutCenterMaterial = createBloodChromaMaterial({ usage: 'sword-wound-center', sourceColor: swordWoundColors.center.getHex(), color: swordWoundColors.center, roughness: 0.97, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.98, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.swordCutLipMaterial = createBloodChromaMaterial({ usage: 'sword-wound-lips', sourceColor: swordWoundColors.lips.getHex(), color: swordWoundColors.lips, roughness: 0.93, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.96, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -1 });
    this.failedProjectionCount = 0;
    this.fallbackUsageCount = 0;
    this.bindingFailureLogged = false;
    this.punctureCoordinateDiagnostics = import.meta.env?.DEV === true ? [] : null;
    this.recentVariantHistory = { puncture: [], slash: [] };
    this.missingMaterialWarnings = new Set();
    this.debugVisible = false;
    this.createVisualPool();
    this.createSwordVisualPool();
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
      const slash = new THREE.Mesh(makeSlashFragmentGeometry(), this.bluntMaterial);
      slash.name = `combat-wound-slash-visual-${index}`;
      slash.visible = false;
      slash.castShadow = false;
      slash.receiveShadow = false;
      slash.frustumCulled = false;
      enableCombatReadabilityLightLayer(slash);
      this.scene.add(puncture, slash);
      this.visualSlots.push({ puncture, slash, slashWorkspace: createSlashVisualWorkspace(), woundId: null });
    }
  }

  createSwordVisualPool() {
    const count = Math.min(this.maximumWounds, MAX_SWORD_CUT_VISUALS);
    for (let index = 0; index < count; index += 1) {
      const ribbon = new THREE.Mesh(makeSwordCutRibbonGeometry(), [this.swordCutCenterMaterial, this.swordCutLipMaterial]);
      ribbon.name = `combat-sword-cut-ribbon-${index}`;
      ribbon.visible = false;
      ribbon.castShadow = false;
      ribbon.receiveShadow = false;
      ribbon.frustumCulled = false;
      ribbon.renderOrder = 9;
      enableCombatReadabilityLightLayer(ribbon);
      this.scene.add(ribbon);
      this.swordVisualSlots.push({ ribbon, workspace: createSwordCutRibbonWorkspace(), woundId: null, assignedTime: 0 });
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

  hideWoundVisual(wound) {
    if (wound?.visualSlot) {
      wound.visualSlot.puncture.visible = false;
      wound.visualSlot.slash.visible = false;
    }
    if (wound?.swordVisualSlot) wound.swordVisualSlot.ribbon.visible = false;
    if (wound) wound.detachmentVisualSuppressed = true;
  }

  suppressBodyIds(bodyIds = []) {
    bodyIds.forEach((bodyId) => this.suppressedBodyIds.add(bodyId));
    this.wounds.forEach((wound) => {
      if (this.suppressedBodyIds.has(wound.bodyId)) this.hideWoundVisual(wound);
    });
  }

  restoreSuppressedBodyIds(bodyIds = [...this.suppressedBodyIds]) {
    bodyIds.forEach((bodyId) => this.suppressedBodyIds.delete(bodyId));
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

  allocateSwordVisual(woundId, createdTime = 0) {
    let slot = this.swordVisualSlots.find((entry) => entry.woundId == null);
    if (!slot) {
      slot = this.swordVisualSlots.reduce((oldest, entry) => entry.assignedTime < oldest.assignedTime ? entry : oldest, this.swordVisualSlots[0]);
      const displaced = this.getWound(slot?.woundId);
      if (displaced) {
        displaced.swordVisualSlot = null;
        displaced.visualOwner = null;
        displaced.renderedSegmentCount = 0;
      }
    }
    if (!slot) return null;
    slot.woundId = woundId;
    slot.assignedTime = createdTime;
    slot.ribbon.visible = false;
    resetSwordCutRibbonGeometry(slot.ribbon.geometry, slot.workspace);
    return slot;
  }

  bindSurfacePoint(wound, worldPoint, referenceNormal = null, regionId = wound.regionId, bodyId = wound.bodyId, bindingOptions = {}) {
    const adapter = this.actor.visualAdapter;
    const swordBinding = wound.visualFamily === 'sword' || wound.weaponFamily === 'sword';
    const binding = adapter?.bindVisibleSurface?.(worldPoint, {
      regionId,
      bodyId,
      referenceNormal,
      anatomyAware: swordBinding,
      diagnostics: swordBinding ? wound.swordBindingDiagnostics : null,
      ...(swordBinding ? {} : { maximumDistance: LEGACY_KNIFE_SURFACE_PROJECTION_DISTANCE, allowLegacyDistance: true }),
      ...bindingOptions,
    });
    if (binding && validateSurfaceBinding(binding)) return binding;
    this.failedProjectionCount += 1;
    if (adapter?.scene && !this.bindingFailureLogged) {
      this.bindingFailureLogged = true;
      console.warn('[combat] Visible skinned-surface wound binding failed; invalid surface visuals remain hidden.');
    }
    return null;
  }

  getPunctureSurfaceBindingOptions(wound = {}) {
    return resolvePunctureSurfaceBindingOptions(wound);
  }

  bindPunctureSurface(wound, collisionEntryWorld, collisionNormalWorld) {
    return this.bindSurfacePoint(
      wound,
      collisionEntryWorld,
      collisionNormalWorld,
      wound.regionId,
      wound.bodyId,
      this.getPunctureSurfaceBindingOptions(wound),
    );
  }

  recordPunctureCoordinateDiagnostic(wound) {
    if (!this.punctureCoordinateDiagnostics || !validateSurfaceBinding(wound?.surfaceBinding)) return null;
    const adapter = this.actor.visualAdapter;
    const reconstructed = adapter?.reconstructVisibleSurface?.(wound.surfaceBinding, undefined, { refresh: false })
      ?? reconstructSkinnedSurface(wound.surfaceBinding);
    if (!reconstructed) return null;
    const snapshot = createPunctureCoordinateSnapshot({
      collisionEntryWorld: wound.collisionEntryWorld,
      collisionEntryBodyLocal: wound.collisionEntryBodyLocal,
      collisionNormalWorld: wound.collisionNormalWorld,
      bodyTransformAtCollision: wound.bodyTransformAtCollision,
      presentationRoot: adapter?.getActorCoordinateRoot?.() ?? adapter?.presentationRoot ?? adapter?.scene,
      binding: wound.surfaceBinding,
      reconstructed,
    });
    this.punctureCoordinateDiagnostics.push(snapshot);
    if (this.punctureCoordinateDiagnostics.length > MAX_DEV_PUNCTURE_COORDINATE_SNAPSHOTS) {
      this.punctureCoordinateDiagnostics.splice(0, this.punctureCoordinateDiagnostics.length - MAX_DEV_PUNCTURE_COORDINATE_SNAPSHOTS);
    }
    return snapshot;
  }

  attachPunctureSurface(wound, worldPoint, referenceNormal) {
    wound.surfaceBinding = this.bindPunctureSurface(wound, worldPoint, referenceNormal);
    wound.surfaceBindingStatus = wound.surfaceBinding ? 'skinned_triangle' : 'puncture_hidden_invalid_surface';
    wound.surfaceBindingLocked = Boolean(wound.surfaceBinding);
    wound.fallbackAnchorUsage = false;
    wound.fallbackReason = wound.surfaceBinding ? null : 'skinned_projection_failed';
    wound.surfaceBindingAttempted = true;
    this.recordPunctureCoordinateDiagnostic(wound);
  }

  attachSlashSamples(wound, startPoint, endPoint, referenceNormal) {
    wound.slashPathPoints = [startPoint.clone(), endPoint.clone()];
    wound.pathCurvature = 0;
    const length = startPoint.distanceTo(endPoint);
    const desiredCount = THREE.MathUtils.clamp(Math.ceil(length / 0.025) + 1, MIN_SLASH_SURFACE_SAMPLES, 12);
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
    wound.surfaceBindingStatus = wound.slashSamples.length >= 2
      ? 'segmented_skinned_surface'
      : wound.slashSamples.length === 1 ? 'slash_single_surface_sample' : 'slash_surface_invalid';
    wound.fallbackAnchorUsage = false;
    wound.fallbackReason = wound.slashSamples.length < 2 ? 'insufficient_slash_surface_samples' : null;
  }

  appendSlashSurfaceSample(wound, worldPoint, referenceNormal) {
    if (!worldPoint) return;
    this.appendSlashPathPoint(wound, worldPoint);
    const previous = wound.slashSamples.at(-1);
    const binding = this.bindSurfacePoint(wound, worldPoint, referenceNormal);
    if (!binding) {
      wound.failedProjectionCount += 1;
      wound.nextSampleBreak = true;
      return;
    }
    const reconstructed = reconstructSkinnedSurface(binding);
    const previousSurface = previous?.binding ? reconstructSkinnedSurface(previous.binding) : null;
    const wouldBridge = !previousSurface || previous.binding.mesh !== binding.mesh || reconstructed.point.distanceTo(previousSurface.point) > 0.14;
    const beforePrevious = wound.slashSamples.at(-2);
    const canMoveLiveEndpoint = previous && beforePrevious
      && !wound.nextSampleBreak
      && !wouldBridge
      && beforePrevious.binding.mesh === binding.mesh
      && beforePrevious.sourcePoint.distanceTo(worldPoint) < 0.018;
    if (canMoveLiveEndpoint || wound.slashSamples.length >= MAX_SLASH_SURFACE_SAMPLES) {
      previous.sourcePoint.copy(worldPoint);
      previous.binding = binding;
      previous.fallbackAnchorUsage = false;
      previous.breakBefore ||= wound.nextSampleBreak || wouldBridge;
    } else wound.slashSamples.push({ sourcePoint: worldPoint.clone(), binding, fallbackAnchorUsage: false, breakBefore: wound.nextSampleBreak || wouldBridge });
    wound.nextSampleBreak = false;
  }

  appendSlashPathPoint(wound, worldPoint) {
    wound.slashPathPoints ??= [];
    const previous = wound.slashPathPoints.at(-1);
    if (previous?.distanceTo(worldPoint) < 0.012) return;
    if (wound.slashPathPoints.length >= MAX_SLASH_SURFACE_SAMPLES) wound.slashPathPoints[MAX_SLASH_SURFACE_SAMPLES - 1].copy(worldPoint);
    else wound.slashPathPoints.push(worldPoint.clone());
    let accumulatedTurn = 0;
    for (let index = 1; index < wound.slashPathPoints.length - 1; index += 1) {
      tmpEdgeA.subVectors(wound.slashPathPoints[index], wound.slashPathPoints[index - 1]);
      tmpEdgeB.subVectors(wound.slashPathPoints[index + 1], wound.slashPathPoints[index]);
      if (tmpEdgeA.lengthSq() < 1e-8 || tmpEdgeB.lengthSq() < 1e-8) continue;
      accumulatedTurn += tmpEdgeA.normalize().angleTo(tmpEdgeB.normalize());
    }
    wound.pathCurvature = THREE.MathUtils.clamp(accumulatedTurn / Math.PI, 0, 1);
  }

  captureEntryTangent(wound, worldTangent, bodyTransform = null) {
    const tangent = worldTangent?.clone?.() ?? new THREE.Vector3(1, 0, 0);
    const body = bodyTransform ?? this.actor.bodies.get(wound.bodyId)?.body;
    wound.entryTangent = worldDirectionToPhysicsBodyLocal(body, tangent) ?? tangent.clone().normalize();
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
      maximumPenetrationDepth: wound.maximumPenetrationDepth,
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
    const fragmentMetrics = deriveSlashFragmentMetrics({ bladeWidth: wound.bladeWidth ?? KNIFE_COMBAT_CONFIG.bladeWidth, maximumDepth: wound.maximumDepth, severity: wound.severity, pathCurvature: wound.pathCurvature, reopeningCount: wound.reopenedCount });
    wound.slashFragmentMajorMeters = Math.max(wound.slashFragmentMajorMeters ?? 0, fragmentMetrics.majorLength);
    wound.slashFragmentCenterSpacing ??= fragmentMetrics.maximumCenterSpacing;
    wound.visualRevision = (wound.visualRevision ?? 0) + 1;
  }

  getRecentVariantIds(family, woundId) {
    return (this.recentVariantHistory[family] ?? []).filter((entry) => entry.woundId !== woundId).map((entry) => entry.variantId);
  }

  recordVariantSelection(family, woundId, variantId) {
    const history = this.recentVariantHistory[family];
    const existing = history.find((entry) => entry.woundId === woundId);
    if (existing) existing.variantId = variantId;
    else history.push({ woundId, variantId });
    if (history.length > 4) history.splice(0, history.length - 4);
  }

  getDecalSelectionProperties(wound, family) {
    const selectionSurfaceDisruption = THREE.MathUtils.clamp((wound.surfaceDisruption ?? 0) + (wound.impactSeverity ?? 0) * 0.38 + (wound.entryObliqueness ?? 0) * 0.18, 0, 1);
    return family === 'puncture' ? {
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
      surfaceDisruption: THREE.MathUtils.clamp(wound.severity * 0.45 + wound.maximumDepth / 0.072 * 0.35 + (1 - (wound.edgeAlignment ?? 1)) * 0.2 + Math.min(2, wound.reopenedCount ?? 0) * 0.1, 0, 1),
      selectionSeverity: THREE.MathUtils.clamp(Math.max(wound.severity, wound.maximumDepth / 0.072), 0, 1),
    };
  }

  updateDecalSelection(wound, family, { lock = false } = {}) {
    if (family === 'blunt' || wound.decalSelectionLocked) return false;
    const properties = this.getDecalSelectionProperties(wound, family);
    if (family === 'slash') {
      if (wound.decalVariantId) {
        if (lock) { wound.decalSelectionLocked = true; wound.decalSelectionState = 'locked'; }
        return false;
      }
      const selection = this.decalLibrary.selectSlashFragment(properties);
      wound.decalVariantId = selection.variant.id;
      wound.decalFamily = family;
      wound.decalPhysicalCategory = selection.category;
      wound.decalEligibleCandidateIds = selection.eligibleCandidateIds;
      wound.deterministicSeed = selection.deterministicSeed;
      wound.mirroredX = false;
      wound.decalRotationVariation = 0;
      wound.selectedAtSeverity = selection.selectedAtSeverity;
      wound.decalSelectionState = lock ? 'locked' : 'provisional';
      wound.decalSelectionLocked = lock;
      this.recordVariantSelection(family, wound.id, wound.decalVariantId);
      return true;
    }
    const category = getKnifeWoundPhysicalCategory(properties);
    const punctureRank = { slit: 0, split: 1, double: 2, burst: 3 };
    const categoryChanged = wound.decalPhysicalCategory !== category;
    const isAllowedUpgrade = family !== 'puncture' || wound.decalPhysicalCategory == null || punctureRank[category] >= punctureRank[wound.decalPhysicalCategory];
    if (wound.decalVariantId && (!categoryChanged || !isAllowedUpgrade || wound.decalSelectionRevisionCount >= 3)) {
      if (lock) { wound.decalSelectionLocked = true; wound.decalSelectionState = 'locked'; }
      return false;
    }
    const selection = this.decalLibrary.select({ ...properties, recentVariantIds: this.getRecentVariantIds(family, wound.id) });
    const revising = Boolean(wound.decalVariantId);
    wound.decalVariantId = selection.variant.id;
    wound.decalFamily = family;
    wound.decalPhysicalCategory = selection.category;
    wound.decalEligibleCandidateIds = selection.eligibleCandidateIds;
    wound.deterministicSeed = selection.deterministicSeed;
    wound.mirroredX = selection.mirroredX;
    wound.decalRotationVariation = selection.rotationVariationRadians;
    wound.selectedAtSeverity = selection.selectedAtSeverity;
    wound.decalSelectionRevisionCount += revising ? 1 : 0;
    wound.decalSelectionState = lock ? 'locked' : 'provisional';
    wound.decalSelectionLocked = lock;
    if (revising) wound.visualRevision += 1;
    this.recordVariantSelection(family, wound.id, wound.decalVariantId);
    return true;
  }

  createPuncture({ hit, entryPoint, axis, surfaceNormal = null, entryTangent = null, depth = 0.004, impactSeverity = 0, weaponProfile = KNIFE_COMBAT_CONFIG, weaponId = weaponProfile?.id ?? weaponProfile?.itemId ?? KNIFE_COMBAT_CONFIG.itemId, hardStructureContact = false, embeddedWeaponId = null, createdTime = 0 } = {}) {
    const weaponFamily = weaponProfile?.family === 'sword' ? 'sword' : 'knife';
    const bladeWidth = weaponProfile?.bladeWidth ?? KNIFE_COMBAT_CONFIG.bladeWidth;
    const bladeThickness = weaponProfile?.bladeThickness ?? KNIFE_COMBAT_CONFIG.bladeThickness;
    const maximumPenetrationDepth = weaponProfile?.maximumPenetrationDepth ?? weaponProfile?.bladeLength ?? KNIFE_COMBAT_CONFIG.maximumPenetrationDepth;
    const puncturePresentationScale = weaponFamily === 'sword' ? SWORD_THRUST_PUNCTURE_PRESENTATION_SCALE : KNIFE_PUNCTURE_PRESENTATION_SCALE;
    const nearby = this.findNearbyWound(hit.bodyId, hit.localPoint, ['puncture', 'deep_puncture', 'arterial_wound']);
    if (nearby && nearby.localEntryPoint.distanceTo(hit.localPoint) <= WOUND_CONFIG.reopenResistanceFactor * 0.1) {
      nearby.active = true;
      nearby.closed = false;
      nearby.reopenedCount += 1;
      nearby.decalSelectionLocked = false;
      nearby.decalSelectionState = 'provisional';
      nearby.embeddedWeaponId = embeddedWeaponId;
      nearby.weaponId = weaponId;
      nearby.weaponFamily = weaponFamily;
      nearby.bladeWidth = bladeWidth;
      nearby.bladeThickness = bladeThickness;
      nearby.maximumPenetrationDepth = maximumPenetrationDepth;
      nearby.puncturePresentationScale = puncturePresentationScale;
      nearby.withdrawalBoostRemaining = 0;
      nearby.maximumDepth = Math.max(nearby.maximumDepth, depth);
      nearby.currentDepth = depth;
      nearby.impactSeverity = Math.max(nearby.impactSeverity, THREE.MathUtils.clamp(impactSeverity, 0, 1));
      this.updatePunctureDimensions(nearby);
      this.updateDecalSelection(nearby, 'puncture');
      this.updateWoundVisual(nearby);
      return nearby;
    }
    const bodyTransformAtCollision = capturePhysicsBodyTransform(hit.bodyTransformAtCollision ?? hit.body);
    const collisionEntryBodyLocal = hit.localPoint.clone();
    const collisionEntryWorld = entryPoint?.clone?.()
      ?? hit.collisionPointWorld?.clone?.()
      ?? physicsBodyLocalToWorld(bodyTransformAtCollision, collisionEntryBodyLocal);
    const collisionAxisWorld = axis.clone().normalize();
    const worldSurfaceNormal = surfaceNormal?.clone?.().normalize() ?? collisionAxisWorld.clone().negate();
    const localAxis = worldDirectionToPhysicsBodyLocal(bodyTransformAtCollision, collisionAxisWorld);
    const localNormal = worldDirectionToPhysicsBodyLocal(bodyTransformAtCollision, worldSurfaceNormal);
    const entryAlignment = THREE.MathUtils.clamp(Math.abs(collisionAxisWorld.dot(worldSurfaceNormal)), 0, 1);
    const wound = this.createWound({
      actor: this.actor,
      regionId: hit.regionId,
      bodyId: hit.bodyId,
      woundType: depth >= 0.075 ? 'deep_puncture' : 'puncture',
      localEntryPoint: collisionEntryBodyLocal.clone(),
      localSurfaceNormal: localNormal,
      localPenetrationAxis: localAxis,
      currentDepth: depth,
      maximumDepth: depth,
      cutLength: 0,
      localCutStart: collisionEntryBodyLocal.clone(),
      localCutEnd: collisionEntryBodyLocal.clone(),
      localCutDirection: new THREE.Vector3(),
      severity: THREE.MathUtils.clamp(depth * 5.2, 0.04, 1.5),
      tissueClass: hit.region?.vital ?? 'none',
      hardStructureContact,
      embeddedWeaponId,
      createdTime,
      weaponId,
      weaponFamily,
      bladeWidth,
      bladeThickness,
      maximumPenetrationDepth,
      puncturePresentationScale,
      entryAlignment,
      entryObliqueness: 1 - entryAlignment,
      impactSeverity: THREE.MathUtils.clamp(impactSeverity, 0, 1),
      withdrawalDamage: 0,
      lateralTearingMeters: 0,
      collisionEntryWorld,
      collisionEntryBodyLocal,
      collisionNormalWorld: worldSurfaceNormal.clone(),
      bodyTransformAtCollision,
    });
    this.updatePunctureDimensions(wound);
    this.updateDecalSelection(wound, 'puncture');
    this.resolveBleedingProfile(wound);
    // Binding starts from the immutable physical collision in world space. The
    // body-local point remains authoritative only for physiology and the planted
    // weapon; it is never treated as actor-local or SkinnedMesh-local geometry.
    this.attachPunctureSurface(wound, collisionEntryWorld, worldSurfaceNormal);
    this.captureEntryTangent(wound, entryTangent, bodyTransformAtCollision);
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
      existing.decalSelectionLocked = false;
      existing.decalSelectionState = 'provisional';
      existing.withdrawalBoostRemaining = 0.35;
      existing.maximumDepth = Math.max(existing.maximumDepth, depth);
      existing.severity = Math.min(2, existing.severity + severity * 0.35);
      existing.cutLength = Math.min(WOUND_CONFIG.maximumCutLength, existing.cutLength + cutLength * 0.45);
      this.updateSlashDimensions(existing);
      this.updateDecalSelection(existing, 'slash');
      this.resolveBleedingProfile(existing);
      this.updateWoundVisual(existing);
      return existing;
    }
    const woundType = classification === 'deep_slash' ? 'deep_slash' : 'shallow_cut';
    const wound = this.createWound({ actor: this.actor, regionId: hit.regionId, bodyId: hit.bodyId, woundType, localEntryPoint: localStart.clone(), localSurfaceNormal: localNormal, localPenetrationAxis: localNormal.clone().negate(), currentDepth: depth, maximumDepth: depth, cutLength: Math.min(cutLength, WOUND_CONFIG.maximumCutLength), localCutStart: localStart, localCutEnd: localEnd, localCutDirection: localDirection, severity, tissueClass: hit.region?.vital ?? 'none', hardStructureContact: false, embeddedWeaponId: null, createdTime, edgeAlignment: THREE.MathUtils.clamp(edgeAlignment, 0, 1), pathCurvature: 0, lateralTearingMeters: 0 });
    wound.failedProjectionCount = 0;
    wound.nextSampleBreak = false;
    const bindingStart = this.bodyLocalPointToWorld(hit.body, localStart);
    const bindingEnd = this.bodyLocalPointToWorld(hit.body, localEnd);
    const bindingNormal = this.bodyLocalNormalToWorld(hit.body, localNormal);
    this.attachSlashSamples(wound, bindingStart, bindingEnd, bindingNormal);
    this.updateSlashDimensions(wound);
    this.updateDecalSelection(wound, 'slash');
    this.resolveBleedingProfile(wound);
    this.updateWoundVisual(wound);
    return wound;
  }

  appendBoundedSwordSample(wound, sample) {
    const samples = wound.swordSamples;
    if (samples.length >= MAX_SWORD_CUT_SURFACE_SAMPLES) {
      let removalIndex = 1;
      let bestScore = Infinity;
      for (let index = 1; index < samples.length - 1; index += 1) {
        const previous = samples[index - 1];
        const current = samples[index];
        const next = samples[index + 1];
        tmpEdgeA.subVectors(next.sourcePoint, previous.sourcePoint);
        const lengthSq = tmpEdgeA.lengthSq();
        const t = lengthSq > 1e-10 ? THREE.MathUtils.clamp(tmpEdgeB.subVectors(current.sourcePoint, previous.sourcePoint).dot(tmpEdgeA) / lengthSq, 0, 1) : 0;
        tmpPosition.copy(previous.sourcePoint).addScaledVector(tmpEdgeA, t);
        const protectedSample = current.breakBefore || next.breakBefore
          || !areSurfaceAnatomiesCompatible(previous.regionId, current.regionId, previous.bodyId, current.bodyId)
          || !areSurfaceAnatomiesCompatible(current.regionId, next.regionId, current.bodyId, next.bodyId);
        const score = current.sourcePoint.distanceTo(tmpPosition) + (protectedSample ? 1 : 0);
        if (score < bestScore) { bestScore = score; removalIndex = index; }
      }
      const removed = samples[removalIndex];
      const next = samples[removalIndex + 1];
      const previous = samples[removalIndex - 1];
      if (next) {
        next.breakBefore ||= removed.breakBefore || !areSurfaceAnatomiesCompatible(previous.regionId, next.regionId, previous.bodyId, next.bodyId);
        next.midpointBinding = null;
        next.midpointBindingAttempted = false;
        next.midpointPreviousSampleId = null;
      }
      samples.splice(removalIndex, 1);
      wound.swordBindingDiagnostics.sampleCompactionCount += 1;
    }
    samples.push(sample);
    return sample;
  }

  appendSwordCutSurfaceSample(wound, { hit, worldPoint, surfaceNormal, direction = null } = {}) {
    if (!wound || !worldPoint || !hit?.regionId || !hit?.bodyId) return null;
    let previousAccepted = null;
    for (let index = wound.swordSamples.length - 1; index >= 0; index -= 1) {
      if (!validateSurfaceBinding(wound.swordSamples[index].binding)) continue;
      previousAccepted = wound.swordSamples[index];
      break;
    }
    if (previousAccepted && previousAccepted.sourcePoint.distanceTo(worldPoint) < 0.0015 && previousAccepted.regionId === hit.regionId && previousAccepted.bodyId === hit.bodyId) return previousAccepted;
    const sourceDistance = previousAccepted?.sourcePoint.distanceTo(worldPoint) ?? 0;
    const stepCount = previousAccepted
      ? Math.min(MAX_SWORD_CUT_SURFACE_SAMPLES - 1, Math.max(1, Math.ceil(sourceDistance / SWORD_CUT_TARGET_SAMPLE_SPACING)))
      : 1;
    let latestSample = null;
    for (let stepIndex = 1; stepIndex <= stepCount; stepIndex += 1) {
      const t = stepIndex / stepCount;
      const sourcePoint = previousAccepted ? previousAccepted.sourcePoint.clone().lerp(worldPoint, t) : worldPoint.clone();
      const sourceNormal = previousAccepted?.sourceNormal?.clone?.().lerp(surfaceNormal, t) ?? surfaceNormal.clone();
      if (sourceNormal.lengthSq() < 1e-10) sourceNormal.copy(surfaceNormal);
      sourceNormal.normalize();
      const usePreviousSemantic = previousAccepted && t < 0.5;
      const regionId = usePreviousSemantic ? previousAccepted.regionId : hit.regionId;
      const bodyId = usePreviousSemantic ? previousAccepted.bodyId : hit.bodyId;
      const binding = this.bindSurfacePoint(wound, sourcePoint, sourceNormal, regionId, bodyId);
      const previous = wound.swordSamples.at(-1);
      const localPoint = previousAccepted?.localPoint && previousAccepted.bodyId === hit.bodyId
        ? previousAccepted.localPoint.clone().lerp(hit.localPoint, t)
        : stepIndex === stepCount ? hit.localPoint.clone() : null;
      const sample = {
        sampleId: wound.nextSwordSampleId++,
        sourcePoint,
        sourceNormal,
        binding,
        regionId,
        bodyId,
        localPoint,
        breakBefore: Boolean(previous) && (
          !validateSurfaceBinding(previous.binding)
          || !validateSurfaceBinding(binding)
          || !areSurfaceAnatomiesCompatible(previous.regionId, regionId, previous.bodyId, bodyId)
          || previous.sourcePoint.distanceTo(sourcePoint) > SWORD_CUT_MAX_SEGMENT_LENGTH
        ),
        worldDirection: direction?.clone?.() ?? previousAccepted?.worldDirection?.clone?.() ?? null,
        segmentRebindAttempted: false,
        midpointBinding: null,
        midpointBindingAttempted: false,
        midpointPreviousSampleId: null,
      };
      if (!binding) {
        wound.failedProjectionCount += 1;
        wound.fallbackReason = 'sword_surface_projection_failed';
      } else {
        wound.surfaceBinding ??= binding;
        wound.fallbackReason = null;
      }
      if (previousAccepted && stepIndex < stepCount) wound.swordBindingDiagnostics.insertedResampleCount += 1;
      latestSample = this.appendBoundedSwordSample(wound, sample);
    }
    wound.surfaceBindingAttempted = true;
    const validCount = wound.swordSamples.reduce((count, entry) => count + (validateSurfaceBinding(entry.binding) ? 1 : 0), 0);
    wound.surfaceBindingStatus = validCount >= 2 ? 'sword_ribbon_skinned_surface' : validCount === 1 ? 'sword_surface_seed_pending' : 'sword_surface_invalid';
    wound.fallbackAnchorUsage = false;
    return latestSample;
  }

  updateSwordCutMetrics(wound) {
    const travelRatio = THREE.MathUtils.clamp(wound.totalTravel / 0.3, 0, 1.5);
    const depthRatio = THREE.MathUtils.clamp(wound.maximumDepth / 0.06, 0, 1.5);
    const speedRatio = THREE.MathUtils.clamp(wound.maximumSwingSpeed / 1.8, 0, 1.5);
    wound.cutLength = Math.min(WOUND_CONFIG.maximumCutLength, wound.totalTravel);
    wound.severity = THREE.MathUtils.clamp(wound.maximumContactSeverity * 0.44 + travelRatio * 0.25 + depthRatio * 0.24 + speedRatio * 0.07, 0.04, 2);
    wound.visualLengthMeters = wound.cutLength;
    wound.visualWidthMeters = THREE.MathUtils.clamp(0.006 + depthRatio * 0.006 + wound.severity * 0.0035, 0.006, 0.024);
    wound.woundType = wound.maximumDepth >= 0.028 || wound.severity >= 0.72 ? 'sword_deep_cut' : 'sword_cut';
    wound.swordLethality = THREE.MathUtils.clamp((wound.accumulatedTrauma ?? 0) * 0.55 + depthRatio * 0.42 + travelRatio * 0.28 + wound.severity * 0.25, 0, 4);
    wound.visualRevision += 1;
  }

  createSwordCut({ hit, point, surfaceNormal, direction, travel = 0, depth = 0, severity = 0, edgeAlignment = 0, swingSpeed = 0, edgeDamageId = null, createdTime = 0 } = {}) {
    if (!hit?.body || !point || !surfaceNormal || !direction) return null;
    const rotation = hit.body.rotation();
    const inverse = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).invert();
    const localNormal = surfaceNormal.clone().applyQuaternion(inverse).normalize();
    const localDirection = direction.clone().applyQuaternion(inverse).normalize();
    const localPoint = hit.localPoint.clone();
    const wound = this.createWound({
      actor: this.actor,
      regionId: hit.regionId,
      bodyId: hit.bodyId,
      woundType: 'sword_cut',
      interactionKind: 'sword_cut',
      weaponFamily: 'sword',
      edgeDamageId,
      localEntryPoint: localPoint.clone(),
      localSurfaceNormal: localNormal,
      localPenetrationAxis: localNormal.clone().negate(),
      currentDepth: depth,
      maximumDepth: depth,
      cutLength: 0,
      totalTravel: Math.max(0, travel),
      localCutStart: localPoint.clone(),
      localCutEnd: localPoint.clone(),
      localCutDirection: localDirection,
      severity: Math.max(0, severity),
      maximumContactSeverity: Math.max(0, severity),
      maximumSwingSpeed: Math.max(0, swingSpeed),
      averageEdgeAlignment: THREE.MathUtils.clamp(edgeAlignment, 0, 1),
      edgeAlignmentSampleCount: 1,
      accumulatedTrauma: 0,
      tissueClass: hit.region?.vital ?? 'none',
      hardStructureContact: false,
      embeddedWeaponId: null,
      createdTime,
      impactedRegionIds: [hit.regionId],
      swordSamples: [],
      lastWorldDirection: direction.clone(),
    }, { visualFamily: 'sword' });
    wound.swordBindingDiagnostics = createSwordCutVisualDiagnostics();
    wound.nextSwordSampleId = 1;
    this.appendSwordCutSurfaceSample(wound, { hit, worldPoint: point, surfaceNormal, direction });
    this.updateSwordCutMetrics(wound);
    this.resolveBleedingProfile(wound);
    this.updateWoundVisual(wound);
    return wound;
  }

  extendSwordCut(woundId, { hit, point, surfaceNormal, direction, travel = 0, depth = 0, severity = 0, edgeAlignment = 0, swingSpeed = 0 } = {}) {
    const wound = this.getWound(woundId);
    if (!wound || wound.visualFamily !== 'sword' || !hit?.body) return null;
    wound.totalTravel += Math.max(0, travel);
    wound.currentDepth = Math.max(wound.currentDepth, depth);
    wound.maximumDepth = Math.max(wound.maximumDepth, depth);
    wound.maximumContactSeverity = Math.max(wound.maximumContactSeverity, severity);
    wound.maximumSwingSpeed = Math.max(wound.maximumSwingSpeed, swingSpeed);
    wound.averageEdgeAlignment = (wound.averageEdgeAlignment * wound.edgeAlignmentSampleCount + THREE.MathUtils.clamp(edgeAlignment, 0, 1)) / (wound.edgeAlignmentSampleCount + 1);
    wound.edgeAlignmentSampleCount += 1;
    if (direction) wound.lastWorldDirection.copy(direction);
    if (!wound.impactedRegionIds.includes(hit.regionId)) wound.impactedRegionIds.push(hit.regionId);
    wound.localCutEnd.copy(hit.localPoint);
    this.appendSwordCutSurfaceSample(wound, { hit, worldPoint: point, surfaceNormal, direction });
    this.updateSwordCutMetrics(wound);
    this.resolveBleedingProfile(wound);
    this.updateWoundVisual(wound);
    return wound;
  }

  recordSwordCutTrauma(woundId, { traumaSeverity = 0, hit = null } = {}) {
    const wound = this.getWound(woundId);
    if (!wound || wound.visualFamily !== 'sword') return null;
    wound.accumulatedTrauma = Math.max(0, wound.accumulatedTrauma + Math.max(0, traumaSeverity));
    if (hit?.regionId && !wound.impactedRegionIds.includes(hit.regionId)) wound.impactedRegionIds.push(hit.regionId);
    this.updateSwordCutMetrics(wound);
    this.resolveBleedingProfile(wound);
    return wound;
  }

  finishSwordCut(woundId, interrupted = false) {
    const wound = this.getWound(woundId);
    if (!wound || wound.visualFamily !== 'sword') return null;
    wound.currentDepth = 0;
    wound.lastContactInterrupted = Boolean(interrupted);
    wound.completed = true;
    this.updateWoundVisual(wound);
    return wound;
  }

  createBluntMarker({ hit, severity = 0.1, createdTime = 0 } = {}) {
    const wound = this.createWound({ actor: this.actor, regionId: hit.regionId, bodyId: hit.bodyId, woundType: 'blunt_trauma_marker', localEntryPoint: hit.localPoint.clone(), localSurfaceNormal: new THREE.Vector3(0, 0, 1), localPenetrationAxis: new THREE.Vector3(), currentDepth: 0, maximumDepth: 0, cutLength: 0, localCutStart: hit.localPoint.clone(), localCutEnd: hit.localPoint.clone(), localCutDirection: new THREE.Vector3(), severity, tissueClass: 'surface', hardStructureContact: true, embeddedWeaponId: null, createdTime });
    wound.bleedingProfile = { kind: 'none', baseRate: 0 };
    this.updateWoundVisual(wound);
    return wound;
  }

  createWound(data, { visualFamily = 'knife' } = {}) {
    if (this.wounds.length >= this.maximumWounds) {
      const replace = this.wounds.find((wound) => !wound.active && !wound.vesselInvolvement) ?? this.wounds.reduce((oldest, wound) => wound.createdTime < oldest.createdTime ? wound : oldest, this.wounds[0]);
      if (replace) this.removeWound(replace.id);
    }
    const id = `wound_${this.nextWoundId++}`;
    const visualSlot = visualFamily === 'knife' ? this.allocateVisual(id) : null;
    const swordVisualSlot = visualFamily === 'sword' ? this.allocateSwordVisual(id, data.createdTime) : null;
    const wound = { id, ...data, visualFamily, vesselInvolvement: null, bleedingProfile: { kind: 'capillary', baseRate: 0.002 }, bleedingRate: 0, bloodEmitted: 0, withdrawalBoostRemaining: 0, pulsePhase: 0, active: true, closed: false, reopenedCount: 0, visualSlot, swordVisualSlot, visualOwner: visualSlot ? 'pooled-skinned-surface-visual' : swordVisualSlot ? 'pooled-sword-cut-ribbon' : null, surfaceBinding: null, surfaceBindingStatus: 'pending', surfaceBindingAttempted: false, surfaceBindingLocked: false, fallbackAnchorUsage: false, fallbackReason: null, semanticAnchorDistance: null, surfaceDistance: null, slashSamples: [], slashPathPoints: [], failedProjectionCount: 0, decalVariantId: null, decalFamily: null, decalPhysicalCategory: null, decalEligibleCandidateIds: [], decalSelectionState: 'provisional', decalSelectionLocked: false, decalSelectionRevisionCount: 0, deterministicSeed: null, mirroredX: false, selectedAtSeverity: null, materialAvailable: true, visualRevision: 0 };
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
    this.updateDecalSelection(wound, 'puncture');
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
    const body = this.actor.bodies.get(wound.bodyId)?.body;
    const bindingPoint = body ? this.bodyLocalPointToWorld(body, localEnd) : worldEnd;
    const bindingNormal = body ? this.bodyLocalNormalToWorld(body, wound.localSurfaceNormal) : surfaceNormal;
    this.appendSlashSurfaceSample(wound, bindingPoint, bindingNormal);
    if (wound.maximumDepth >= 0.05 || wound.severity >= WOUND_CONFIG.seriousSeverity) wound.woundType = 'deep_slash';
    this.updateSlashDimensions(wound);
    this.updateDecalSelection(wound, 'slash');
    this.resolveBleedingProfile(wound);
    this.updateWoundVisual(wound);
    return wound;
  }

  finishSlash(woundId, interrupted = false) {
    const wound = this.getWound(woundId);
    if (!wound) return;
    wound.lastContactInterrupted = interrupted;
    wound.currentDepth = 0;
    this.updateDecalSelection(wound, 'slash', { lock: true });
  }

  finishPuncture(woundId) {
    const wound = this.getWound(woundId);
    if (!wound || !['puncture', 'deep_puncture', 'arterial_wound'].includes(wound.woundType)) return null;
    wound.currentDepth = 0;
    this.updateDecalSelection(wound, 'puncture', { lock: true });
    this.updateWoundVisual(wound);
    return wound;
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
    wound.withdrawalDamage = Math.max(wound.withdrawalDamage ?? 0, THREE.MathUtils.clamp(releaseSeverity / KNIFE_COMBAT_CONFIG.maximumPenetrationDepth, 0, 1));
    this.updatePunctureDimensions(wound);
    this.updateDecalSelection(wound, 'puncture', { lock: true });
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
    if (wound.visualFamily === 'sword') {
      const vitalRegion = wound.impactedRegionIds?.some((regionId) => ['head', 'face', 'skull', 'neck', 'upper_chest', 'lower_chest'].includes(regionId));
      const deepCut = wound.woundType === 'sword_deep_cut';
      if (wound.impactedRegionIds?.includes('neck') && (wound.maximumDepth >= 0.018 || wound.severity >= 0.62)) {
        wound.bleedingProfile = { kind: 'major_venous', baseRate: 0.035 + wound.severity * 0.018 };
      } else if (deepCut || vitalRegion && wound.maximumDepth >= 0.02) {
        wound.bleedingProfile = { kind: 'venous', baseRate: 0.018 + wound.severity * (vitalRegion ? 0.014 : 0.008) };
      } else wound.bleedingProfile = { kind: 'capillary', baseRate: 0.0025 + wound.severity * 0.0045 };
      return wound.bleedingProfile;
    }
    if (wound.woundType === 'blunt_trauma_marker') wound.bleedingProfile = { kind: 'none', baseRate: 0 };
    else if (wound.maximumDepth >= 0.055 || wound.woundType === 'deep_slash') wound.bleedingProfile = { kind: 'venous', baseRate: 0.014 + wound.severity * 0.007 };
    else wound.bleedingProfile = { kind: 'capillary', baseRate: 0.0015 + wound.severity * 0.0025 };
    return wound.bleedingProfile;
  }

  resolveVesselIntersection(wound) {
    const candidates = VESSEL_ZONES.filter((zone) => (wound.visualFamily === 'sword' ? wound.impactedRegionIds?.includes(zone.regionId) : zone.regionId === wound.regionId) && wound.maximumDepth >= zone.minimumDepth);
    for (const zone of candidates) {
      if (wound.visualFamily === 'sword') {
        const samples = wound.swordSamples.filter((sample) => sample.regionId === zone.regionId && sample.localPoint);
        let distance = Infinity;
        for (let index = 0; index < samples.length; index += 1) {
          distance = Math.min(distance, Math.hypot(samples[index].localPoint.x - zone.surfaceCenter[0], samples[index].localPoint.y - zone.surfaceCenter[1]));
          if (index > 0 && samples[index - 1].bodyId === samples[index].bodyId) distance = Math.min(distance, distancePointToSegment2D(zone.surfaceCenter[0], zone.surfaceCenter[1], samples[index - 1].localPoint.x, samples[index - 1].localPoint.y, samples[index].localPoint.x, samples[index].localPoint.y));
        }
        if (distance <= zone.surfaceRadius) return zone;
        continue;
      }
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

  bodyLocalPointToWorld(body, localPoint, target = new THREE.Vector3()) {
    return physicsBodyLocalToWorld(body, localPoint, target);
  }

  bodyLocalNormalToWorld(body, localNormal, target = new THREE.Vector3()) {
    return physicsBodyLocalDirectionToWorld(body, localNormal, target);
  }

  getWorldPose(wound) {
    if (wound?.visualFamily === 'sword') {
      let hasSkinnedBinding = false;
      for (let index = wound.swordSamples.length - 1; index >= 0; index -= 1) {
        const sample = wound.swordSamples[index];
        if (!validateSurfaceBinding(sample.binding)) continue;
        hasSkinnedBinding = true;
        const reconstructed = this.actor.visualAdapter?.reconstructVisibleSurface?.(sample.binding) ?? reconstructSkinnedSurface(sample.binding);
        if (!reconstructed) continue;
        return {
          point: reconstructed.point.clone(),
          normal: reconstructed.normal.clone(),
          direction: sample.worldDirection?.clone?.() ?? wound.lastWorldDirection?.clone?.() ?? reconstructed.normal.clone(),
          surfaceBound: true,
        };
      }
      if (hasSkinnedBinding) return null;
    }
    const entry = this.actor.bodies.get(wound?.bodyId);
    if (!entry) return null;
    const translation = entry.body.translation();
    const rotation = entry.body.rotation();
    const bodyQuaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    return {
      point: physicsBodyLocalToWorld(entry.body, wound.localEntryPoint),
      normal: physicsBodyLocalDirectionToWorld(entry.body, wound.localSurfaceNormal),
      direction: physicsBodyLocalDirectionToWorld(entry.body, wound.localCutDirection),
      bodyQuaternion,
      translation: new THREE.Vector3(translation.x, translation.y, translation.z),
    };
  }

  update(dt) {
    this.actor.visualAdapter?.prepareVisibleSurfaceFrame?.();
    this.wounds.forEach((wound) => {
      wound.withdrawalBoostRemaining = Math.max(0, wound.withdrawalBoostRemaining - dt);
      this.updateWoundVisual(wound);
    });
    this.updateSurfaceDebug(this.wounds.at(-1));
  }

  bindSwordSegmentMidpoint(wound, previousSample, sample, { force = false } = {}) {
    if (!previousSample?.sourcePoint || !sample?.sourcePoint) return null;
    if (sample.midpointPreviousSampleId !== previousSample.sampleId) {
      sample.midpointBinding = null;
      sample.midpointBindingAttempted = false;
      sample.midpointPreviousSampleId = previousSample.sampleId;
    }
    if (force || !sample.midpointBindingAttempted) {
      sample.midpointBindingAttempted = true;
      const animatedNeighborhood = force && sample.midpointBinding
        ? this.actor.visualAdapter?.reconstructVisibleSurfaceNeighborhood?.(sample.midpointBinding, undefined, { refresh: false }) ?? reconstructSurfaceBindingNeighborhood(sample.midpointBinding)
        : null;
      if (animatedNeighborhood) tmpPosition.copy(animatedNeighborhood.point);
      else tmpPosition.lerpVectors(previousSample.sourcePoint, sample.sourcePoint, 0.5);
      if (animatedNeighborhood) tmpNormal.copy(animatedNeighborhood.normal);
      else tmpNormal.addVectors(previousSample.sourceNormal, sample.sourceNormal);
      if (tmpNormal.lengthSq() < 1e-10) tmpNormal.copy(sample.sourceNormal);
      tmpNormal.normalize();
      sample.midpointBinding = this.bindSurfacePoint(wound, tmpPosition, tmpNormal, sample.regionId, sample.bodyId);
    }
    return validateSurfaceBinding(sample.midpointBinding) ? sample.midpointBinding : null;
  }

  getSwordSegmentMidpointPose(wound, previousSample, sample, target) {
    const binding = this.bindSwordSegmentMidpoint(wound, previousSample, sample);
    if (!binding) return null;
    const pose = this.actor.visualAdapter?.reconstructVisibleSurface?.(binding, target, { refresh: false }) ?? reconstructSkinnedSurface(binding, target);
    if (pose) pose.binding = binding;
    return pose;
  }

  attemptSwordLocalRebind(wound, { previousSample, sample, previousValid, currentValid }) {
    if (sample.segmentRebindAttempted) return false;
    sample.segmentRebindAttempted = true;
    wound.swordBindingDiagnostics.rebindAttempts += 1;
    let rebound = null;
    if (!currentValid) {
      const animatedNeighborhood = this.actor.visualAdapter?.reconstructVisibleSurfaceNeighborhood?.(sample.binding, undefined, { refresh: false }) ?? reconstructSurfaceBindingNeighborhood(sample.binding);
      rebound = this.bindSurfacePoint(wound, animatedNeighborhood?.point ?? sample.sourcePoint, animatedNeighborhood?.normal ?? sample.sourceNormal, sample.regionId, sample.bodyId);
      if (rebound) sample.binding = rebound;
    } else if (!previousValid) {
      const animatedNeighborhood = this.actor.visualAdapter?.reconstructVisibleSurfaceNeighborhood?.(previousSample.binding, undefined, { refresh: false }) ?? reconstructSurfaceBindingNeighborhood(previousSample.binding);
      rebound = this.bindSurfacePoint(wound, animatedNeighborhood?.point ?? previousSample.sourcePoint, animatedNeighborhood?.normal ?? previousSample.sourceNormal, previousSample.regionId, previousSample.bodyId);
      if (rebound) previousSample.binding = rebound;
    } else {
      rebound = this.bindSwordSegmentMidpoint(wound, previousSample, sample, { force: true });
    }
    if (!rebound) return false;
    wound.swordBindingDiagnostics.rebindSuccesses += 1;
    return true;
  }

  updateSwordCutVisual(wound) {
    const slot = wound?.swordVisualSlot;
    if (!slot) return;
    const validSampleCount = wound.swordSamples.reduce((count, sample) => count + (validateSurfaceBinding(sample.binding) ? 1 : 0), 0);
    const diagnostics = {
      sampleCount: wound.swordSamples.length,
      validSampleCount,
      renderedSegmentCount: 0,
      renderedPrimitiveCount: 0,
      hiddenSegmentCount: Math.max(0, wound.swordSamples.length - 1),
      hiddenFragmentCount: Math.max(0, wound.swordSamples.length - 1),
      continuousRegionTransitionCount: 0,
      maximumRenderedSegmentLength: 0,
      maximumMidpointToSurfaceError: 0,
      oneSampleSeedUsageCount: 0,
      bounded: wound.swordSamples.length <= MAX_SWORD_CUT_SURFACE_SAMPLES,
      presentationStatus: 'retired_no_persistent_slash',
    };
    Object.assign(wound.swordBindingDiagnostics, {
      renderedSegmentCount: 0,
      hiddenSegmentCount: diagnostics.hiddenSegmentCount,
      maximumRenderedSegmentLength: 0,
      maximumMidpointToSurfaceError: 0,
      oneSampleSeedUsageCount: 0,
    });
    const combinedDiagnostics = { ...wound.swordBindingDiagnostics, ...diagnostics };
    slot.ribbon.visible = false;
    slot.ribbon.geometry.setDrawRange(0, 0);
    wound.renderedSegmentCount = 0;
    wound.invalidFragmentCount = diagnostics.hiddenFragmentCount;
    wound.continuousRegionTransitionCount = 0;
    wound.surfaceBindingStatus = validSampleCount >= 2
      ? 'sword_cut_bound_visual_retired'
      : validSampleCount === 1 ? 'sword_cut_single_sample_visual_retired' : 'sword_surface_invalid';
    wound.surfaceVisualStatus = 'retired_no_persistent_slash';
    wound.surfaceDistance = null;
    wound.swordVisualDiagnostics = combinedDiagnostics;
  }

  getAttachedSurfacePose(wound, semanticOverride = null) {
    const semantic = semanticOverride ?? this.getWorldPose(wound);
    if (validateSurfaceBinding(wound.surfaceBinding)) {
      const reconstructed = this.actor.visualAdapter?.reconstructVisibleSurface?.(wound.surfaceBinding) ?? reconstructSkinnedSurface(wound.surfaceBinding);
      if (reconstructed) {
        wound.surfaceBindingStatus = 'skinned_triangle';
        wound.fallbackAnchorUsage = false;
        wound.fallbackReason = null;
        wound.semanticAnchorDistance = semantic ? reconstructed.point.distanceTo(semantic.point) : null;
        return reconstructed;
      }
      wound.fallbackReason = 'skinned_binding_reconstruction_failed';
      // A successful triangle/barycentric bind is immutable. Temporary invalid
      // reconstruction hides the decal instead of selecting a different surface.
      wound.surfaceBindingStatus = 'puncture_hidden_invalid_surface';
      wound.semanticAnchorDistance = null;
      return null;
    }
    if (!wound.surfaceBindingLocked
      && !wound.surfaceRetryAttempted
      && this.actor.visualAdapter?.scene
      && wound.collisionEntryWorld) {
      wound.surfaceRetryAttempted = true;
      // A not-yet-ready presentation may retry once, but it must reuse the
      // immutable collision-world anchor rather than a live body-derived pose.
      this.attachPunctureSurface(wound, wound.collisionEntryWorld, wound.collisionNormalWorld);
      if (validateSurfaceBinding(wound.surfaceBinding)) return this.getAttachedSurfacePose(wound, semantic);
    }
    wound.surfaceBindingStatus = 'puncture_hidden_invalid_surface';
    wound.fallbackAnchorUsage = false;
    wound.fallbackReason ??= 'skinned_projection_failed';
    wound.semanticAnchorDistance = null;
    return null;
  }

  getWoundMaterial(wound) {
    if (wound.woundType === 'blunt_trauma_marker') { wound.materialAvailable = true; return this.bluntMaterial; }
    const sourceMaterial = this.decalLibrary.getMaterial(wound.decalVariantId);
    wound.materialAvailable = Boolean(sourceMaterial);
    if (!sourceMaterial && import.meta.env?.DEV && !this.missingMaterialWarnings.has(wound.decalVariantId)) {
      this.missingMaterialWarnings.add(wound.decalVariantId);
      console.error(`[combat] Authored wound material unavailable for ${wound.decalVariantId ?? 'unselected variant'}; using visible diagnostic fallback material.`);
    }
    if (!sourceMaterial || !this.isolateMaterials) return sourceMaterial ?? this.bluntMaterial;
    if (!this.ownedMaterials.has(sourceMaterial)) this.ownedMaterials.set(sourceMaterial, cloneBloodChromaMaterial(sourceMaterial));
    return this.ownedMaterials.get(sourceMaterial);
  }

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

  updateSlashVisual(wound, slot) {
    const diagnostics = {
      fragmentCount: 0,
      renderedPathLength: 0,
      materialCount: 0,
      drawCallCount: 0,
      oneSampleSeedUsageCount: 0,
      presentationStatus: 'retired_no_persistent_slash',
    };
    wound.slashFallbackUsage = false;
    wound.fallbackAnchorUsage = false;
    wound.surfaceVisualStatus = 'retired_no_persistent_slash';
    slot.slash.geometry.setDrawRange(0, 0);
    wound.slashVisualDiagnostics = diagnostics;
    wound.renderedSegmentCount = 0;
    wound.renderedPathLength = 0;
    wound.surfaceDistance = null;
    slot.slash.visible = false;
    slot.puncture.visible = false;
  }

  updateWoundVisual(wound) {
    if (this.suppressedBodyIds.has(wound?.bodyId)) {
      this.hideWoundVisual(wound);
      return;
    }
    if (wound) wound.detachmentVisualSuppressed = false;
    if (wound?.visualFamily === 'sword') {
      this.updateSwordCutVisual(wound);
      return;
    }
    const slot = wound?.visualSlot;
    if (!slot) return;
    const isSlash = wound.cutLength > 0.001 || ['shallow_cut', 'deep_slash'].includes(wound.woundType);
    if (isSlash) {
      this.updateSlashVisual(wound, slot);
      return;
    }
    const material = this.getWoundMaterial(wound);
    slot.puncture.visible = false;
    slot.slash.visible = false;
    const semantic = this.getWorldPose(wound);
    const pose = wound.woundType === 'blunt_trauma_marker' ? semantic : this.getAttachedSurfacePose(wound, semantic);
    if (!pose) return;
    if (slot.puncture.material !== material) slot.puncture.material = material;
    slot.puncture.position.copy(pose.point).addScaledVector(pose.normal, WOUND_SURFACE_BIAS);
    if (wound.woundType === 'blunt_trauma_marker') {
      slot.puncture.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pose.normal);
      const diameter = 0.028 + wound.severity * 0.02;
      slot.puncture.scale.set(diameter, diameter, 1);
    } else {
      const tangent = this.resolvePunctureTangent(wound, pose);
      if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0).addScaledVector(pose.normal, -pose.normal.x).normalize();
      tmpSide.crossVectors(pose.normal, tangent).normalize();
      tmpMatrix.makeBasis(tangent, tmpSide, pose.normal);
      slot.puncture.quaternion.setFromRotationMatrix(tmpMatrix);
      slot.puncture.rotateZ(wound.decalRotationVariation ?? 0);
      const signature = `puncture:${wound.decalVariantId}:${wound.mirroredX}:${wound.visualRevision}:${wound.visualMajorMeters}:${wound.visualMinorMeters}`;
      if (slot.puncture.userData.visualSignature !== signature) {
        this.applyPunctureUv(slot, wound);
        const presentationScale = wound.puncturePresentationScale ?? KNIFE_PUNCTURE_PRESENTATION_SCALE;
        slot.puncture.scale.set(wound.visualMajorMeters * presentationScale, wound.visualMinorMeters * presentationScale, 1);
        slot.puncture.userData.visualSignature = signature;
      }
    }
    slot.puncture.visible = true;
    wound.surfaceDistance = WOUND_SURFACE_BIAS;
    wound.renderedSegmentCount = 0;
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
    this.actor.physiology?.onWoundRemoved?.(wound);
    if (wound.visualSlot) {
      wound.visualSlot.puncture.visible = false;
      wound.visualSlot.slash.visible = false;
      wound.visualSlot.puncture.userData.visualSignature = null;
      wound.visualSlot.slash.geometry.setDrawRange(0, 0);
      resetSlashVisualPath(wound.visualSlot.slashWorkspace);
      wound.visualSlot.slashWorkspace.fragmentCount = 0;
      wound.visualSlot.woundId = null;
    }
    if (wound.swordVisualSlot) {
      wound.swordVisualSlot.ribbon.visible = false;
      resetSwordCutRibbonGeometry(wound.swordVisualSlot.ribbon.geometry, wound.swordVisualSlot.workspace);
      wound.swordVisualSlot.woundId = null;
      wound.swordVisualSlot.assignedTime = 0;
      wound.swordVisualSlot = null;
    }
    wound.surfaceBinding = null;
    wound.slashSamples.length = 0;
    wound.slashPathPoints.length = 0;
    wound.slashFallbackUsage = false;
    wound.slashVisualDiagnostics = null;
    if (wound.swordSamples) wound.swordSamples.length = 0;
    wound.swordVisualDiagnostics = null;
    wound.fallbackReason = null;
  }

  clear() {
    [...this.wounds].forEach((wound) => this.removeWound(wound.id));
    this.nextWoundId = 1;
    this.failedProjectionCount = 0;
    this.fallbackUsageCount = 0;
    this.recentVariantHistory.puncture.length = 0;
    this.recentVariantHistory.slash.length = 0;
    this.punctureCoordinateDiagnostics?.splice(0);
    this.missingMaterialWarnings.clear();
    this.suppressedBodyIds.clear();
    this.surfaceDebugRoot.visible = false;
  }

  getDiagnostics() {
    const wound = this.wounds.at(-1);
    const binding = wound?.surfaceBinding ?? wound?.slashSamples?.at(-1)?.binding;
    const latestSlash = this.wounds.filter((entry) => entry.cutLength > 0.001 || ['shallow_cut', 'deep_slash'].includes(entry.woundType)).at(-1);
    return {
      count: this.wounds.length,
      active: this.getActiveWounds().length,
      arterial: this.wounds.filter((entry) => entry.bleedingProfile.kind.includes('arterial')).length,
      swordCuts: this.wounds.filter((entry) => entry.visualFamily === 'sword').length,
      visibleSwordCuts: this.swordVisualSlots.filter((entry) => entry.ribbon.visible).length,
      suppressedBodyIds: [...this.suppressedBodyIds],
      swordCutVisualLimit: this.swordVisualSlots.length,
      materialCloneCount: this.materialCloneCount,
      failedProjectionCount: this.failedProjectionCount,
      fallbackAnchorUsage: this.fallbackUsageCount,
      ...(this.punctureCoordinateDiagnostics ? {
        punctureCoordinates: {
          count: this.punctureCoordinateDiagnostics.length,
          maximumCount: MAX_DEV_PUNCTURE_COORDINATE_SNAPSHOTS,
          latest: this.punctureCoordinateDiagnostics.at(-1) ?? null,
        },
      } : {}),
      decalLibrary: this.decalLibrary.getDiagnostics(),
      recentVariantHistory: {
        puncture: this.recentVariantHistory.puncture.map((entry) => entry.variantId),
        slash: this.recentVariantHistory.slash.map((entry) => entry.variantId),
      },
      latestSlash: latestSlash?.slashVisualDiagnostics ? { woundId: latestSlash.id, ...latestSlash.slashVisualDiagnostics } : null,
      selected: wound ? {
        id: wound.id,
        regionId: wound.regionId,
        type: wound.woundType,
        depth: Number(wound.maximumDepth.toFixed(3)),
        length: Number(wound.cutLength.toFixed(3)),
        severity: Number(wound.severity.toFixed(3)),
        decalVariantId: wound.decalVariantId,
        decalFamily: wound.decalFamily,
        decalPhysicalCategory: wound.decalPhysicalCategory,
        decalSelectionState: wound.decalSelectionState,
        decalEligibleCandidateIds: wound.decalEligibleCandidateIds,
        decalSelectionRevisionCount: wound.decalSelectionRevisionCount,
        recentSameFamilyVariantHistory: this.getRecentVariantIds(wound.decalFamily, wound.id),
        mirroredX: wound.mirroredX,
        entryMajorMeters: wound.entryMajorMeters ?? null,
        entryMinorMeters: wound.entryMinorMeters ?? null,
        visualMajorMeters: wound.visualMajorMeters ?? null,
        visualMinorMeters: wound.visualMinorMeters ?? null,
        visualLengthMeters: wound.visualLengthMeters ?? null,
        visualWidthMeters: wound.visualWidthMeters ?? null,
        pathCurvature: wound.pathCurvature ?? 0,
        interrupted: wound.lastContactInterrupted ?? false,
        vessel: wound.vesselInvolvement?.id ?? null,
        bleedingRate: Number(wound.bleedingRate.toFixed(4)),
        surfaceBindingStatus: wound.surfaceBindingStatus,
        fallbackReason: wound.fallbackReason,
        semanticAnchorDistance: wound.semanticAnchorDistance,
        meshName: binding?.meshName ?? null,
        triangleIndices: binding?.triangleIndices ?? null,
        barycentric: binding?.barycentric?.toArray?.().map((value) => Number(value.toFixed(4))) ?? null,
        surfaceDistance: wound.surfaceDistance,
        slashSampleCount: wound.slashSamples?.length ?? 0,
        renderedSegmentCount: wound.renderedSegmentCount ?? 0,
        failedProjectionCount: wound.failedProjectionCount ?? 0,
        fallbackAnchorUsage: wound.fallbackAnchorUsage,
        slashFallbackUsage: wound.slashFallbackUsage ?? false,
        materialAvailable: wound.materialAvailable,
        visualFamily: wound.visualFamily,
        impactedRegionIds: wound.impactedRegionIds ?? null,
        accumulatedTrauma: wound.accumulatedTrauma ?? null,
        swordLethality: wound.swordLethality ?? null,
        invalidFragmentCount: wound.invalidFragmentCount ?? 0,
        continuousRegionTransitionCount: wound.continuousRegionTransitionCount ?? 0,
        ...(wound.slashVisualDiagnostics ?? {}),
        ...(wound.swordVisualDiagnostics ?? {}),
      } : null,
    };
  }

  get materialCloneCount() { return this.ownedMaterials.size; }

  beginFade() {
    if (!this.isolateMaterials || this.fadePrepared) return false;
    this.fadePrepared = true;
    captureAndPrepareFadeMaterials([this.bluntMaterial, this.swordCutCenterMaterial, this.swordCutLipMaterial, ...this.ownedMaterials.values()], this.fadeMaterialBaselines);
    return true;
  }

  setFadeOpacity(opacity) {
    if (!this.isolateMaterials || !this.fadePrepared) return false;
    applyFadeOpacity(this.fadeMaterialBaselines, opacity);
    return true;
  }

  setOpacity(opacity) {
    if (!this.isolateMaterials) return false;
    const value = clampFadeOpacity(opacity);
    if (!this.fadePrepared && value >= FULLY_OPAQUE_THRESHOLD) return false;
    if (!this.fadePrepared) this.beginFade();
    return this.setFadeOpacity(value);
  }

  resetFade() {
    const restored = this.fadePrepared || this.fadeMaterialBaselines.size > 0;
    restoreFadeMaterials(this.fadeMaterialBaselines);
    this.fadePrepared = false;
    return restored;
  }

  dispose() {
    this.clear();
    this.visualSlots.forEach((slot) => { slot.puncture.geometry.dispose(); slot.slash.geometry.dispose(); slot.puncture.removeFromParent(); slot.slash.removeFromParent(); });
    this.bluntMaterial.dispose();
    this.swordVisualSlots.forEach((slot) => { slot.ribbon.geometry.dispose(); slot.ribbon.removeFromParent(); });
    this.swordCutCenterMaterial.dispose();
    this.swordCutLipMaterial.dispose();
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedMaterials.clear();
    this.fadeMaterialBaselines.clear();
    this.surfaceDebugRoot.traverse((object) => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
    this.surfaceDebugRoot.removeFromParent();
    this.visualSlots = [];
    this.swordVisualSlots = [];
  }
}

import * as THREE from 'three';
import { COMBAT_READABILITY_LIGHT_LAYER } from '../combat/CombatReadabilityLightLayer.js';
import { findOutdoorScene, OUTDOOR_LIGHT_OWNER } from '../world-scene/OutdoorLightSourceRegistry.js';

const DEG = Math.PI / 180;
const CAMERA_FORWARD_TARGET_DISTANCE = 6;
const COMBAT_KEY_ORIGIN = new THREE.Vector3(-0.16, -0.22, -0.1);
const COMBAT_FILL_ORIGIN = new THREE.Vector3(0.55, -0.14, -0.06);

export const HELD_TORCH_CLOSE_COMBAT = Object.freeze({
  activation: Object.freeze({
    darknessThreshold: 0.58,
    enterDistance: 3.35,
    exitDistance: 3.7,
    enterFacingDot: 0.16,
    exitFacingDot: 0.02,
    refreshSeconds: 0.12,
    blendSeconds: 0.2,
    targetSmoothSeconds: 0.18,
  }),
  key: Object.freeze({
    color: 0xffb36f,
    explorationIntensity: 18,
    explorationDistance: 10.5,
    closeDistance: 5.4,
    decay: 1.65,
    explorationAngle: 26 * DEG,
    explorationPenumbra: 0.72,
    closePenumbra: 0.9,
    shadowMapSize: 512,
    shadowNear: 0.12,
    shadowFar: 10.5,
    shadowBias: -0.00018,
    shadowNormalBias: 0.025,
  }),
  fill: Object.freeze({
    color: 0xffdfbd,
    maximumIntensity: 7.2,
    distance: 3.8,
    decay: 1.5,
    angle: 70 * DEG,
    penumbra: 1,
    layer: COMBAT_READABILITY_LIGHT_LAYER,
  }),
});

function smoothstep(minimum, maximum, value) {
  const t = THREE.MathUtils.clamp((value - minimum) / Math.max(1e-6, maximum - minimum), 0, 1);
  return t * t * (3 - 2 * t);
}

function interpolateKnots(distance, knots) {
  if (distance <= knots[0][0]) return knots[0][1];
  for (let index = 1; index < knots.length; index += 1) {
    if (distance > knots[index][0]) continue;
    const previous = knots[index - 1];
    const next = knots[index];
    return THREE.MathUtils.lerp(previous[1], next[1], smoothstep(previous[0], next[0], distance));
  }
  return knots.at(-1)[1];
}

const ANGLE_KNOTS = Object.freeze([[0.4, 52 * DEG], [0.7, 48 * DEG], [1, 44 * DEG], [1.5, 38 * DEG], [2.5, 31 * DEG], [3.35, 26 * DEG]]);
const KEY_KNOTS = Object.freeze([[0.4, 0.18], [0.7, 0.24], [1, 0.32], [1.5, 0.5], [2.5, 0.85], [3.35, 1]]);
const POINT_KNOTS = Object.freeze([[0.4, 0.03], [0.7, 0.05], [1, 0.08], [1.5, 0.16], [2.2, 0.55], [3.35, 1]]);
const FILL_KNOTS = Object.freeze([[0.35, 0.56], [0.55, 0.78], [0.75, 0.92], [1.2, 1], [1.7, 0.82], [2.5, 0.24], [3.35, 0]]);
const SHADOW_KNOTS = Object.freeze([[0.35, 0.48], [0.7, 0.65], [1.2, 0.82], [2, 0.96], [3.35, 1]]);

export function resolveHeldTorchBeamSettings(distance, combatInfluence = 1, target = {}) {
  const influence = THREE.MathUtils.clamp(combatInfluence, 0, 1);
  const closeAngle = interpolateKnots(distance, ANGLE_KNOTS);
  const keyMultiplier = interpolateKnots(distance, KEY_KNOTS);
  const pointMultiplier = interpolateKnots(distance, POINT_KNOTS);
  const fillMultiplier = interpolateKnots(distance, FILL_KNOTS);
  target.angle = THREE.MathUtils.lerp(HELD_TORCH_CLOSE_COMBAT.key.explorationAngle, closeAngle, influence);
  target.penumbra = THREE.MathUtils.lerp(HELD_TORCH_CLOSE_COMBAT.key.explorationPenumbra, HELD_TORCH_CLOSE_COMBAT.key.closePenumbra, influence);
  target.keyIntensity = HELD_TORCH_CLOSE_COMBAT.key.explorationIntensity * THREE.MathUtils.lerp(1, keyMultiplier, influence);
  target.keyDistance = THREE.MathUtils.lerp(HELD_TORCH_CLOSE_COMBAT.key.explorationDistance, HELD_TORCH_CLOSE_COMBAT.key.closeDistance, influence);
  target.pointMultiplier = THREE.MathUtils.lerp(1, pointMultiplier, influence);
  target.fillIntensity = HELD_TORCH_CLOSE_COMBAT.fill.maximumIntensity * fillMultiplier * influence;
  target.shadowIntensity = THREE.MathUtils.lerp(1, interpolateKnots(distance, SHADOW_KNOTS), influence);
  target.footprintRadius = Math.tan(target.angle) * Math.max(0, distance);
  return target;
}

export function resolveTorchSpotlightFootprint(distance, angle) {
  return Math.tan(THREE.MathUtils.clamp(angle, 0, Math.PI / 2 - 0.001)) * Math.max(0, distance);
}

export function isTorchCombatActorRelevant(actor) {
  if (!actor || actor.disposed === true || actor.root?.parent == null) return false;
  if (actor.attackable === false && !['incapacitated', 'dying', 'dead'].includes(actor.lifeState)) return false;
  return typeof actor.getBodyWorldPosition === 'function';
}

export function shouldActivateCloseCombatTorch({ torchActive, darkness, actorRelevant, distance, facingDot, wasActive = false } = {}) {
  const activation = HELD_TORCH_CLOSE_COMBAT.activation;
  if (!torchActive || darkness < activation.darknessThreshold || !actorRelevant) return false;
  return wasActive
    ? distance <= activation.exitDistance && facingDot >= activation.exitFacingDot
    : distance <= activation.enterDistance && facingDot >= activation.enterFacingDot;
}

function smoothDampVector(current, target, velocity, smoothTime, deltaSeconds, scratch) {
  const dt = Math.max(0.0001, deltaSeconds);
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  scratch.copy(current).sub(target);
  const temporaryX = (velocity.x + omega * scratch.x) * dt;
  const temporaryY = (velocity.y + omega * scratch.y) * dt;
  const temporaryZ = (velocity.z + omega * scratch.z) * dt;
  velocity.set(
    (velocity.x - omega * temporaryX) * decay,
    (velocity.y - omega * temporaryY) * decay,
    (velocity.z - omega * temporaryZ) * decay,
  );
  current.set(
    target.x + (scratch.x + temporaryX) * decay,
    target.y + (scratch.y + temporaryY) * decay,
    target.z + (scratch.z + temporaryZ) * decay,
  );
}

export class HeldTorchLightingRuntime {
  constructor({ camera, lightRegistry = null, actorProvider = null, darknessProvider = null } = {}) {
    this.camera = camera;
    this.lightRegistry = lightRegistry;
    this.actorProvider = actorProvider;
    this.darknessProvider = darknessProvider;
    this.scene = findOutdoorScene(camera);
    this.activeActor = null;
    this.targetRefreshElapsed = HELD_TORCH_CLOSE_COMBAT.activation.refreshSeconds;
    this.closeRequested = false;
    this.closeBlend = 0;
    this.actorDistance = Infinity;
    this.facingDot = -1;
    this.mode = 'exploration';
    this.settings = {};
    this.cameraPosition = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    this.actorDirection = new THREE.Vector3();
    this.upperChest = new THREE.Vector3();
    this.lowerChest = new THREE.Vector3();
    this.desiredTarget = new THREE.Vector3();
    this.smoothedTarget = new THREE.Vector3();
    this.targetVelocity = new THREE.Vector3();
    this.targetScratch = new THREE.Vector3();
    this.flameLocal = new THREE.Vector3();
    this.keyOrigin = new THREE.Vector3();
    this.worldKeyOrigin = new THREE.Vector3();
    this.worldFillOrigin = new THREE.Vector3();
    this.debugState = {
      mode: 'exploration', activeActorId: null, actorDistance: Infinity, facingDot: -1,
      spotlightOrigin: { x: 0, y: 0, z: 0 }, spotlightTarget: { x: 0, y: 0, z: 0 },
      fillOrigin: { x: 0, y: 0, z: 0 },
      spotlightAngle: HELD_TORCH_CLOSE_COMBAT.key.explorationAngle,
      spotlightPenumbra: HELD_TORCH_CLOSE_COMBAT.key.explorationPenumbra,
      spotlightIntensity: 0, spotlightDistance: HELD_TORCH_CLOSE_COMBAT.key.explorationDistance,
      spotlightDecay: HELD_TORCH_CLOSE_COMBAT.key.decay, spotlightFootprint: 0, fillIntensity: 0,
      fillDistance: HELD_TORCH_CLOSE_COMBAT.fill.distance,
      fillDecay: HELD_TORCH_CLOSE_COMBAT.fill.decay, fillLayer: COMBAT_READABILITY_LIGHT_LAYER, shadowCasterCount: 0,
      shadowMapSize: HELD_TORCH_CLOSE_COMBAT.key.shadowMapSize,
      shadowNear: HELD_TORCH_CLOSE_COMBAT.key.shadowNear, shadowFar: HELD_TORCH_CLOSE_COMBAT.key.shadowFar,
      shadowBias: HELD_TORCH_CLOSE_COMBAT.key.shadowBias, shadowNormalBias: HELD_TORCH_CLOSE_COMBAT.key.shadowNormalBias,
    };
    this.createLights();
    this.createStandaloneDebugPanel();
  }

  createStandaloneDebugPanel() {
    const debugTokens = new Set((globalThis.location ? new URLSearchParams(globalThis.location.search).get('debug') ?? '' : '').split(','));
    if (!import.meta.env?.DEV || !globalThis.document || !debugTokens.has('torch-lighting') || this.scene?.userData?.outdoorLightingDirector) return;
    this.debugPanel = document.body.appendChild(document.createElement('pre'));
    this.debugPanel.dataset.torchLightingDebug = 'true';
    this.debugPanel.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;max-width:470px;padding:8px;background:#160d07dd;color:#ffe0bd;font:11px/1.35 monospace;pointer-events:none;white-space:pre-wrap';
  }

  createLights() {
    const key = HELD_TORCH_CLOSE_COMBAT.key;
    this.keyLight = new THREE.SpotLight(key.color, 0, key.explorationDistance, key.explorationAngle, key.explorationPenumbra, key.decay);
    this.keyLight.name = 'torch-forward-shadow-key';
    this.keyLight.castShadow = true;
    this.keyLight.visible = false;
    this.keyLight.shadow.mapSize.set(key.shadowMapSize, key.shadowMapSize);
    this.keyLight.shadow.camera.near = key.shadowNear;
    this.keyLight.shadow.camera.far = key.shadowFar;
    this.keyLight.shadow.bias = key.shadowBias;
    this.keyLight.shadow.normalBias = key.shadowNormalBias;
    this.keyLight.shadow.radius = 2;
    this.keyLight.layers.set(0);

    const fill = HELD_TORCH_CLOSE_COMBAT.fill;
    this.fillLight = new THREE.SpotLight(fill.color, 0, fill.distance, fill.angle, fill.penumbra, fill.decay);
    this.fillLight.name = 'torch-close-combat-readability-fill';
    this.fillLight.castShadow = false;
    this.fillLight.visible = false;
    this.fillLight.layers.set(COMBAT_READABILITY_LIGHT_LAYER);
    this.fillLight.target.layers.set(COMBAT_READABILITY_LIGHT_LAYER);
    this.camera?.add?.(this.keyLight, this.fillLight);
    this.scene?.add?.(this.keyLight.target, this.fillLight.target);
    this.lightRegistry?.register(this.keyLight, { name: this.keyLight.name, owner: OUTDOOR_LIGHT_OWNER.PLAYER, source: 'torch-forward-key', global: false });
    this.lightRegistry?.register(this.fillLight, { name: this.fillLight.name, owner: OUTDOOR_LIGHT_OWNER.PLAYER, source: 'torch-close-combat-fill', global: false });
    this.initializeExplorationTarget();
  }

  initializeExplorationTarget() {
    this.camera?.updateMatrixWorld?.(true);
    this.camera?.getWorldPosition?.(this.cameraPosition);
    this.camera?.getWorldDirection?.(this.cameraDirection);
    this.desiredTarget.copy(this.cameraPosition).addScaledVector(this.cameraDirection, CAMERA_FORWARD_TARGET_DISTANCE);
    this.smoothedTarget.copy(this.desiredTarget);
    this.keyLight.target.position.copy(this.smoothedTarget);
    this.fillLight.target.position.copy(this.smoothedTarget);
  }

  resolveUpperTorsoTarget(actor, target) {
    if (!isTorchCombatActorRelevant(actor)) return false;
    actor.getBodyWorldPosition('upper_chest', this.upperChest);
    actor.getBodyWorldPosition('lower_chest', this.lowerChest);
    if (!Number.isFinite(this.upperChest.x + this.upperChest.y + this.upperChest.z)) return false;
    if (!Number.isFinite(this.lowerChest.x + this.lowerChest.y + this.lowerChest.z)) target.copy(this.upperChest);
    else target.copy(this.upperChest).lerp(this.lowerChest, 0.42);
    return true;
  }

  refreshTarget(torchActive, darkness) {
    const candidate = this.activeActor && isTorchCombatActorRelevant(this.activeActor) ? this.activeActor : this.actorProvider?.() ?? null;
    const relevant = isTorchCombatActorRelevant(candidate) && this.resolveUpperTorsoTarget(candidate, this.desiredTarget);
    if (relevant) {
      this.actorDirection.copy(this.desiredTarget).sub(this.cameraPosition);
      this.actorDistance = this.actorDirection.length();
      if (this.actorDistance > 1e-5) this.actorDirection.multiplyScalar(1 / this.actorDistance);
      this.facingDot = this.cameraDirection.dot(this.actorDirection);
    } else {
      this.actorDistance = Infinity;
      this.facingDot = -1;
    }
    this.closeRequested = shouldActivateCloseCombatTorch({
      torchActive,
      darkness,
      actorRelevant: relevant,
      distance: this.actorDistance,
      facingDot: this.facingDot,
      wasActive: this.closeRequested && candidate === this.activeActor,
    });
    this.activeActor = this.closeRequested ? candidate : null;
  }

  update(deltaSeconds, { torchActive = false, flameWorldPosition = null, pointLight = null, flicker = 1 } = {}) {
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0.001, 0.05);
    const darkness = THREE.MathUtils.clamp(Number(this.darknessProvider?.() ?? 0), 0, 1);
    this.camera?.updateMatrixWorld?.(true);
    this.camera?.getWorldPosition?.(this.cameraPosition);
    this.camera?.getWorldDirection?.(this.cameraDirection);

    if (this.activeActor && !isTorchCombatActorRelevant(this.activeActor)) {
      this.activeActor = null;
      this.closeRequested = false;
      this.targetRefreshElapsed = HELD_TORCH_CLOSE_COMBAT.activation.refreshSeconds;
    }
    this.targetRefreshElapsed += dt;
    if (this.targetRefreshElapsed >= HELD_TORCH_CLOSE_COMBAT.activation.refreshSeconds) {
      this.targetRefreshElapsed %= HELD_TORCH_CLOSE_COMBAT.activation.refreshSeconds;
      this.refreshTarget(torchActive, darkness);
    }

    if (this.activeActor && this.resolveUpperTorsoTarget(this.activeActor, this.desiredTarget)) {
      this.actorDirection.copy(this.desiredTarget).sub(this.cameraPosition);
      this.actorDistance = this.actorDirection.length();
      if (this.actorDistance > 1e-5) this.facingDot = this.cameraDirection.dot(this.actorDirection.multiplyScalar(1 / this.actorDistance));
    } else {
      this.desiredTarget.copy(this.cameraPosition).addScaledVector(this.cameraDirection, CAMERA_FORWARD_TARGET_DISTANCE);
    }

    const blendTarget = torchActive && this.closeRequested ? 1 : 0;
    const blendAlpha = 1 - Math.exp(-dt / HELD_TORCH_CLOSE_COMBAT.activation.blendSeconds);
    this.closeBlend = THREE.MathUtils.lerp(this.closeBlend, blendTarget, blendAlpha);
    if (Math.abs(this.closeBlend - blendTarget) < 0.001) this.closeBlend = blendTarget;
    this.mode = this.closeBlend >= 0.94 ? 'close-combat' : this.closeBlend <= 0.02 ? 'exploration' : 'transition';

    smoothDampVector(this.smoothedTarget, this.desiredTarget, this.targetVelocity, HELD_TORCH_CLOSE_COMBAT.activation.targetSmoothSeconds, dt, this.targetScratch);
    this.keyLight.target.position.copy(this.smoothedTarget);
    this.fillLight.target.position.copy(this.smoothedTarget);
    this.keyLight.target.updateMatrixWorld();
    this.fillLight.target.updateMatrixWorld();

    if (flameWorldPosition) {
      this.flameLocal.copy(flameWorldPosition);
      this.camera?.worldToLocal?.(this.flameLocal);
    }
    this.keyOrigin.copy(this.flameLocal).lerp(COMBAT_KEY_ORIGIN, this.closeBlend);
    this.keyLight.position.copy(this.keyOrigin);
    this.fillLight.position.copy(COMBAT_FILL_ORIGIN);

    const profileDistance = Number.isFinite(this.actorDistance) ? this.actorDistance : HELD_TORCH_CLOSE_COMBAT.activation.enterDistance;
    resolveHeldTorchBeamSettings(profileDistance, this.closeBlend, this.settings);
    this.keyLight.angle = this.settings.angle;
    this.keyLight.penumbra = this.settings.penumbra;
    this.keyLight.distance = this.settings.keyDistance;
    this.keyLight.intensity = torchActive ? this.settings.keyIntensity * flicker : 0;
    this.keyLight.visible = torchActive;
    this.keyLight.shadow.intensity = this.settings.shadowIntensity;
    this.fillLight.intensity = torchActive ? this.settings.fillIntensity * flicker : 0;
    this.fillLight.visible = torchActive && this.fillLight.intensity > 0;
    if (pointLight) pointLight.intensity = torchActive ? pointLight.userData.baseTorchIntensity * this.settings.pointMultiplier * flicker : 0;
    this.updateDebugState(torchActive);
    return this.debugState;
  }

  updateDebugState(torchActive) {
    this.keyLight.getWorldPosition(this.worldKeyOrigin);
    this.fillLight.getWorldPosition(this.worldFillOrigin);
    const state = this.debugState;
    state.mode = this.mode;
    state.activeActorId = this.activeActor?.id ?? this.activeActor?.root?.name ?? null;
    state.actorDistance = this.actorDistance;
    state.facingDot = this.facingDot;
    state.spotlightOrigin.x = this.worldKeyOrigin.x; state.spotlightOrigin.y = this.worldKeyOrigin.y; state.spotlightOrigin.z = this.worldKeyOrigin.z;
    state.fillOrigin.x = this.worldFillOrigin.x; state.fillOrigin.y = this.worldFillOrigin.y; state.fillOrigin.z = this.worldFillOrigin.z;
    state.spotlightTarget.x = this.smoothedTarget.x; state.spotlightTarget.y = this.smoothedTarget.y; state.spotlightTarget.z = this.smoothedTarget.z;
    state.spotlightAngle = this.keyLight.angle;
    state.spotlightPenumbra = this.keyLight.penumbra;
    state.spotlightIntensity = this.keyLight.intensity;
    state.spotlightDistance = this.keyLight.distance;
    state.spotlightFootprint = Number.isFinite(this.actorDistance) ? resolveTorchSpotlightFootprint(this.actorDistance, this.keyLight.angle) : 0;
    state.fillIntensity = this.fillLight.intensity;
    state.shadowCasterCount = torchActive && this.keyLight.intensity > 0 ? 1 : 0;
    if (this.debugPanel) this.debugPanel.textContent = `TORCH ${torchActive ? 'LIT' : 'OFF'} ${state.mode}\nactor ${state.activeActorId ?? 'none'} distance ${Number.isFinite(state.actorDistance) ? state.actorDistance.toFixed(2) : '-'} facing ${state.facingDot.toFixed(3)}\nspot origin ${state.spotlightOrigin.x.toFixed(2)},${state.spotlightOrigin.y.toFixed(2)},${state.spotlightOrigin.z.toFixed(2)}\ntarget ${state.spotlightTarget.x.toFixed(2)},${state.spotlightTarget.y.toFixed(2)},${state.spotlightTarget.z.toFixed(2)}\nangle ${THREE.MathUtils.radToDeg(state.spotlightAngle).toFixed(1)} penumbra ${state.spotlightPenumbra.toFixed(2)} intensity ${state.spotlightIntensity.toFixed(2)} range ${state.spotlightDistance.toFixed(1)} decay ${state.spotlightDecay}\nfootprint ${state.spotlightFootprint.toFixed(2)} fill ${state.fillIntensity.toFixed(2)} range ${state.fillDistance.toFixed(1)} decay ${state.fillDecay} layer ${state.fillLayer}\nshadow ${state.shadowCasterCount} map ${state.shadowMapSize}px ${state.shadowNear}-${state.shadowFar} bias ${state.shadowBias}/${state.shadowNormalBias}\ntorch self-shadow false`;
  }

  rebind({ camera = this.camera, lightRegistry = this.lightRegistry } = {}) {
    const nextScene = findOutdoorScene(camera);
    if (camera !== this.camera) {
      this.camera?.remove?.(this.keyLight, this.fillLight);
      this.camera = camera;
      this.camera?.add?.(this.keyLight, this.fillLight);
    }
    if (nextScene !== this.scene) {
      this.keyLight.target.removeFromParent();
      this.fillLight.target.removeFromParent();
      this.scene = nextScene;
      this.scene?.add?.(this.keyLight.target, this.fillLight.target);
    }
    if (lightRegistry !== this.lightRegistry) {
      this.lightRegistry?.unregister(this.keyLight);
      this.lightRegistry?.unregister(this.fillLight);
      this.lightRegistry = lightRegistry;
      this.lightRegistry?.register(this.keyLight, { name: this.keyLight.name, owner: OUTDOOR_LIGHT_OWNER.PLAYER, source: 'torch-forward-key', global: false });
      this.lightRegistry?.register(this.fillLight, { name: this.fillLight.name, owner: OUTDOOR_LIGHT_OWNER.PLAYER, source: 'torch-close-combat-fill', global: false });
    }
    this.activeActor = null;
    this.closeRequested = false;
    this.closeBlend = 0;
    this.targetRefreshElapsed = HELD_TORCH_CLOSE_COMBAT.activation.refreshSeconds;
    this.initializeExplorationTarget();
  }

  dispose() {
    this.lightRegistry?.unregister(this.keyLight);
    this.lightRegistry?.unregister(this.fillLight);
    this.keyLight.removeFromParent();
    this.fillLight.removeFromParent();
    this.keyLight.target.removeFromParent();
    this.fillLight.target.removeFromParent();
    this.keyLight.shadow.map?.dispose?.();
    this.debugPanel?.remove?.();
    this.debugPanel = null;
    this.activeActor = null;
    this.camera = null;
    this.scene = null;
  }
}

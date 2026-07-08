import * as THREE from 'three';
import { evaluatePhysicalToolGesture, getPhysicalToolAngleError, getPhysicalToolProfile } from './PhysicalToolProfiles.js';
import { PhysicalToolTargetRegistry } from './PhysicalToolTargetRegistry.js';

const GESTURE_HISTORY_MS = 140;

export class PhysicalToolActionController {
  constructor({ app, camera, player, dungeon, equipmentRuntime, viewmodel, feedback = null } = {}) {
    this.app = app;
    this.viewport = app?.querySelector?.('[data-game="viewport"]') ?? app;
    this.camera = camera;
    this.player = player;
    this.dungeon = dungeon;
    this.equipmentRuntime = equipmentRuntime;
    this.viewmodel = viewmodel;
    this.feedback = feedback;
    this.registry = new PhysicalToolTargetRegistry({ dungeon, camera, player, viewport: this.viewport });
    this.state = this.createIdleState();
    this.cooldownRemaining = 0;
    this.disposers = [];
    this.audioContext = null;
    this.bind();
  }

  createIdleState() {
    return { active: false, pointerId: null, samples: [], startX: 0, startY: 0, x: 0, y: 0, deltaX: 0, deltaY: 0, travelPx: 0, planted: false, plantX: 0, plantY: 0, plantSampleIndex: 0, leverTravelPx: 0, contact: null, contactSampleIndex: 0, contactAngleRadians: null };
  }

  bind() {
    const down = (event) => this.pointerDown(event);
    const move = (event) => this.pointerMove(event);
    const end = (event) => this.pointerEnd(event);
    this.viewport?.addEventListener?.('pointerdown', down, { passive: false, capture: true });
    this.viewport?.addEventListener?.('pointermove', move, { passive: false, capture: true });
    this.viewport?.addEventListener?.('pointerup', end, { passive: false, capture: true });
    this.viewport?.addEventListener?.('pointercancel', end, { passive: false, capture: true });
    this.disposers.push(() => this.viewport?.removeEventListener?.('pointerdown', down, { capture: true }));
    this.disposers.push(() => this.viewport?.removeEventListener?.('pointermove', move, { capture: true }));
    this.disposers.push(() => this.viewport?.removeEventListener?.('pointerup', end, { capture: true }));
    this.disposers.push(() => this.viewport?.removeEventListener?.('pointercancel', end, { capture: true }));
  }

  pointerDown(event) {
    if (this.cooldownRemaining > 0 || this.state.active || this.isInputBlocked(event)) return;
    const toolId = this.viewmodel?.getActiveToolId?.();
    const profile = getPhysicalToolProfile(toolId);
    if (!profile || !this.viewmodel?.projectGrabHit?.(event.clientX, event.clientY, this.viewport)) return;
    event.preventDefault();
    event.stopPropagation();
    this.viewport?.setPointerCapture?.(event.pointerId);
    const sample = this.makeSample(event);
    this.state = { ...this.createIdleState(), active: true, pointerId: event.pointerId, toolId, actionType: profile.actionType, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, samples: [sample] };
    this.viewmodel?.setGestureState?.(this.state);
  }

  pointerMove(event) {
    if (!this.state.active || event.pointerId !== this.state.pointerId) return;
    if (this.isInputBlocked(event)) {
      this.cancelGesture();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const previous = { x: this.state.x, y: this.state.y };
    this.state.x = event.clientX;
    this.state.y = event.clientY;
    this.state.deltaX = event.clientX - this.state.startX;
    this.state.deltaY = event.clientY - this.state.startY;
    this.state.travelPx = Math.hypot(this.state.deltaX, this.state.deltaY);
    this.state.samples.push(this.makeSample(event));
    this.trimSamples();
    const profile = getPhysicalToolProfile(this.state.toolId);
    const segmentLength = Math.hypot(event.clientX - previous.x, event.clientY - previous.y);
    const contact = segmentLength >= 1
      ? this.registry.findSweepContact(previous, { x: event.clientX, y: event.clientY }, profile)
      : null;
    if (contact) {
      const segmentAngle = Math.atan2(event.clientY - previous.y, event.clientX - previous.x);
      const angleError = getPhysicalToolAngleError(profile, segmentAngle);
      const contactScore = contact.distance + angleError * 22;
      if (!this.state.contact || contactScore <= (this.state.contact.score ?? Infinity)) {
        this.state.contact = { ...contact, score: contactScore };
        this.state.contactSampleIndex = Math.max(1, this.state.samples.length - 1);
        this.state.contactAngleRadians = segmentAngle;
      }
    }
    if (profile?.actionType === 'pry' && contact && !this.state.planted) {
      this.state.planted = true;
      this.state.plantX = event.clientX;
      this.state.plantY = event.clientY;
      this.state.plantSampleIndex = Math.max(0, this.state.samples.length - 1);
      this.state.contact = contact;
      navigator.vibrate?.(10);
      this.playContactSound('plant');
    }
    if (this.state.planted) this.state.leverTravelPx = Math.hypot(event.clientX - this.state.plantX, event.clientY - this.state.plantY);
    this.viewmodel?.setGestureState?.(this.state);
  }

  pointerEnd(event) {
    if (!this.state.active || event.pointerId !== this.state.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.pointerMove(event);
    if (!this.state.active) return;
    const profile = getPhysicalToolProfile(this.state.toolId);
    const actionStartIndex = profile?.actionType === 'pry'
      ? this.state.plantSampleIndex
      : Math.max(0, this.state.contactSampleIndex - 5);
    const actionSamples = this.state.samples.slice(actionStartIndex);
    const velocity = this.computeVelocity(actionSamples);
    const metrics = this.computePathMetrics(actionSamples);
    const gesture = {
      travelPx: this.state.travelPx,
      leverTravelPx: this.state.leverTravelPx,
      velocityPxPerSecond: Math.max(velocity.length() * 0.35, metrics.meanVelocityPxPerSecond),
      directionX: velocity.lengthSq() ? velocity.x / velocity.length() : 0,
      directionY: velocity.lengthSq() ? velocity.y / velocity.length() : 0,
      angleRadians: profile?.actionType === 'pry' ? metrics.angleRadians : (this.state.contactAngleRadians ?? metrics.angleRadians),
      smoothness: metrics.smoothness,
      pathLengthPx: metrics.pathLengthPx,
      durationMs: metrics.durationMs,
    };
    const quality = evaluatePhysicalToolGesture(profile, gesture);
    gesture.quality = quality.quality;
    gesture.qualityReason = quality.reason;
    const profileQualityMet = quality.effective && (profile?.actionType !== 'pry' || this.state.planted);
    let result = { accepted: false, reason: profileQualityMet ? 'miss' : quality.reason };
    if (profileQualityMet && this.state.contact) {
      result = this.registry.evaluate(this.state.contact.target, {
        toolId: this.state.toolId,
        actionType: this.state.actionType,
        gesture,
        contact: this.state.contact,
      });
    }
    this.resolveFeedback(result, profile);
    this.cooldownRemaining = result.accepted ? profile.cooldownSeconds : Math.min(0.22, profile.cooldownSeconds * 0.4);
    this.state = this.createIdleState();
    this.viewmodel?.setGestureState?.(this.state);
  }

  isInputBlocked(event) {
    if (this.app?.classList?.contains?.('is-paused')) return true;
    if (this.app?.querySelector?.('[data-equipment-panel][aria-hidden="false"]')) return true;
    return Boolean(event?.target?.closest?.('button, [data-equipment-panel], [data-pause-overlay], [data-control="move"]'));
  }

  cancelGesture() {
    this.state = this.createIdleState();
    this.viewmodel?.setGestureState?.(this.state);
  }

  resolveFeedback(result, profile) {
    if (result.accepted) {
      const final = result.completed === true || result.cleared === true || result.opened === true || result.destroyed === true || result.pried === true;
      this.viewmodel?.impact?.({ strength: final ? 1.35 : profile.actionType === 'chop' ? 1.05 : 0.72 });
      this.feedback?.shake?.(final ? profile.finalShake : profile.shake);
      navigator.vibrate?.(profile.actionType === 'chop' ? (final ? [28, 30, 48] : 32) : profile.actionType === 'pry' ? (final ? [35, 45, 70] : 24) : (final ? [18, 22, 30] : 14));
      this.playContactSound(final ? 'final' : profile.actionType);
      return;
    }
    if (this.state.contact) {
      this.viewmodel?.impact?.({ strength: 0.38 });
      navigator.vibrate?.(7);
      this.playContactSound(result.reason === 'wrong-tool' ? 'skid' : 'refuse');
    }
  }

  playContactSound(kind) {
    try {
      const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioContext ??= new AudioContextClass();
      const context = this.audioContext;
      if (context.state === 'suspended') context.resume?.();
      const duration = kind === 'final' ? 0.36 : kind === 'pry' ? 0.28 : 0.13;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      oscillator.type = kind === 'skid' || kind === 'plant' ? 'sawtooth' : 'triangle';
      oscillator.frequency.setValueAtTime(kind === 'skid' ? 260 : kind === 'pry' || kind === 'plant' ? 92 : kind === 'chop' ? 74 : 128, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'final' ? 38 : 54, context.currentTime + duration);
      filter.type = 'lowpass';
      filter.frequency.value = kind === 'skid' ? 920 : 520;
      gain.gain.setValueAtTime(kind === 'final' ? 0.13 : 0.07, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(filter); filter.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + duration);
    } catch {
      // Physical animation, contact validation, haptics, and world response remain authoritative.
    }
  }

  makeSample(event) {
    return { x: event.clientX, y: event.clientY, timeMs: performance.now() };
  }

  trimSamples() {
    const cutoff = performance.now() - 1800;
    const firstKeptIndex = this.state.samples.findIndex((sample) => sample.timeMs >= cutoff);
    if (firstKeptIndex <= 0) return;
    this.state.samples = this.state.samples.slice(firstKeptIndex);
    this.state.contactSampleIndex = Math.max(0, this.state.contactSampleIndex - firstKeptIndex);
    this.state.plantSampleIndex = Math.max(0, this.state.plantSampleIndex - firstKeptIndex);
  }

  computeVelocity(samples = this.state.samples) {
    const now = performance.now();
    const recent = samples.filter((sample) => now - sample.timeMs <= GESTURE_HISTORY_MS);
    if (recent.length < 2) return new THREE.Vector2();
    const first = recent[0];
    const last = recent.at(-1);
    const seconds = Math.max(0.016, (last.timeMs - first.timeMs) / 1000);
    return new THREE.Vector2((last.x - first.x) / seconds, (last.y - first.y) / seconds);
  }

  computePathMetrics(samples = this.state.samples) {
    if (samples.length < 2) return { pathLengthPx: 0, durationMs: 0, meanVelocityPxPerSecond: 0, smoothness: 0, angleRadians: 0 };
    let pathLengthPx = 0;
    let turnCost = 0;
    let previousDirection = null;
    for (let index = 1; index < samples.length; index += 1) {
      const dx = samples[index].x - samples[index - 1].x;
      const dy = samples[index].y - samples[index - 1].y;
      const length = Math.hypot(dx, dy);
      if (length < 0.5) continue;
      pathLengthPx += length;
      const direction = new THREE.Vector2(dx / length, dy / length);
      if (previousDirection) turnCost += Math.max(0, 1 - direction.dot(previousDirection));
      previousDirection = direction;
    }
    const first = samples[0];
    const last = samples.at(-1);
    const directX = last.x - first.x;
    const directY = last.y - first.y;
    const directLength = Math.hypot(directX, directY);
    const durationMs = Math.max(16, last.timeMs - first.timeMs);
    const pathEfficiency = pathLengthPx > 0 ? directLength / pathLengthPx : 0;
    const turnQuality = Math.exp(-turnCost * 0.72);
    return {
      pathLengthPx,
      durationMs,
      meanVelocityPxPerSecond: pathLengthPx / (durationMs / 1000),
      smoothness: THREE.MathUtils.clamp(pathEfficiency * 0.62 + turnQuality * 0.38, 0, 1),
      angleRadians: Math.atan2(directY, directX),
    };
  }

  update(deltaSeconds) {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - Math.min(0.05, deltaSeconds));
  }

  rebindSession({ camera, player, dungeon } = {}) {
    this.camera = camera ?? this.camera;
    this.player = player ?? this.player;
    this.dungeon = dungeon ?? this.dungeon;
    this.registry.rebind({ dungeon: this.dungeon, camera: this.camera, player: this.player, viewport: this.viewport });
    this.state = this.createIdleState();
    this.viewmodel?.setGestureState?.(this.state);
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose?.());
    this.disposers = [];
    this.audioContext?.close?.();
    this.audioContext = null;
  }
}

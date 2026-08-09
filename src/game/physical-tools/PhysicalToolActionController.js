import * as THREE from 'three';
import { evaluatePhysicalToolGesture, getPhysicalToolAngleError, getPhysicalToolProfile } from './PhysicalToolProfiles.js';
import { PhysicalToolTargetRegistry } from './PhysicalToolTargetRegistry.js';

const GESTURE_HISTORY_MS = 140;

export class PhysicalToolActionController {
  constructor({ app, camera, player, dungeon, equipmentRuntime, viewmodel, feedback = null, controls = null, audioRuntime = null } = {}) {
    this.app = app;
    this.viewport = app?.querySelector?.('[data-game="viewport"]') ?? app;
    this.camera = camera;
    this.player = player;
    this.dungeon = dungeon;
    this.equipmentRuntime = equipmentRuntime;
    this.viewmodel = viewmodel;
    this.feedback = feedback;
    this.controls = controls;
    this.audioRuntime = audioRuntime;
    this.registry = new PhysicalToolTargetRegistry({ dungeon, camera, player, viewport: this.viewport });
    this.state = this.createIdleState();
    this.cooldownRemaining = 0;
    this.disposers = [];
    this.audioContext = null;
    this.bind();
  }

  createIdleState() {
    return { active: false, pointerId: null, samples: [], startX: 0, startY: 0, x: 0, y: 0, deltaX: 0, deltaY: 0, travelPx: 0, planted: false, plantX: 0, plantY: 0, plantSampleIndex: 0, leverTravelPx: 0, contact: null, contactSampleIndex: 0, contactAngleRadians: null, activePartPoint: null, socketState: 'free_bar', seatedTarget: null, socketScreen: null, settle: 0, strain: 0, completed: false, feedbackCooldown: 0, feedbackStage: 'none' };
  }

  bind() {
    const down = (event) => this.pointerDown(event);
    const move = (event) => this.pointerMove(event);
    const end = (event) => this.pointerEnd(event);
    this.viewport?.addEventListener?.('pointerdown', down, { passive: false, capture: true });
    this.viewport?.addEventListener?.('pointermove', move, { passive: false, capture: true });
    this.viewport?.addEventListener?.('pointerup', end, { passive: false, capture: true });
    this.viewport?.addEventListener?.('pointercancel', end, { passive: false, capture: true });
    const suspend = () => this.cancelGesture('app-suspended');
    globalThis.document?.addEventListener?.('visibilitychange', suspend);
    globalThis.window?.addEventListener?.('pagehide', suspend);
    this.disposers.push(() => this.viewport?.removeEventListener?.('pointerdown', down, { capture: true }));
    this.disposers.push(() => this.viewport?.removeEventListener?.('pointermove', move, { capture: true }));
    this.disposers.push(() => this.viewport?.removeEventListener?.('pointerup', end, { capture: true }));
    this.disposers.push(() => this.viewport?.removeEventListener?.('pointercancel', end, { capture: true }));
    this.disposers.push(() => globalThis.document?.removeEventListener?.('visibilitychange', suspend));
    this.disposers.push(() => globalThis.window?.removeEventListener?.('pagehide', suspend));
  }

  pointerDown(event) {
    if (this.cooldownRemaining > 0 || this.state.active || this.isInputBlocked(event)) return;
    const toolId = this.viewmodel?.getActiveToolId?.();
    const profile = getPhysicalToolProfile(toolId);
    // A generous invisible grip zone owns input capture. Blade/head/tip geometry is
    // deliberately excluded here and is sampled separately for physical contact.
    if (!profile || !this.viewmodel?.projectGrabHit?.(event.clientX, event.clientY, this.viewport)) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    event.stopPropagation();
    this.viewport?.setPointerCapture?.(event.pointerId);
    const sample = this.makeSample(event);
    this.state = { ...this.createIdleState(), active: true, pointerId: event.pointerId, toolId, actionType: profile.actionType, socketState: profile.actionType === 'pry' ? 'socket_seeking' : 'free_bar', startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, samples: [sample] };
    this.state.activePartPoint = this.viewmodel?.getProjectedActivePoint?.(this.viewport, this.state) ?? null;
    this.viewmodel?.setGestureState?.(this.state);
  }

  pointerMove(event) {
    if (!this.state.active || event.pointerId !== this.state.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    event.stopPropagation();
    const previousInput = { x: this.state.x, y: this.state.y };
    this.state.x = event.clientX;
    this.state.y = event.clientY;
    this.state.deltaX = event.clientX - this.state.startX;
    this.state.deltaY = event.clientY - this.state.startY;
    this.state.travelPx = Math.hypot(this.state.deltaX, this.state.deltaY);
    this.state.samples.push(this.makeSample(event));
    this.trimSamples();
    const profile = getPhysicalToolProfile(this.state.toolId);
    const previousActivePart = this.state.activePartPoint;
    const activePart = this.viewmodel?.getProjectedActivePoint?.(this.viewport, this.state) ?? null;
    this.state.activePartPoint = activePart;
    if (profile?.actionType === 'pry') {
      this.updateSocketedPry(event, previousInput, previousActivePart, activePart, profile);
      this.viewmodel?.setGestureState?.(this.state);
      return;
    }
    const segmentLength = previousActivePart && activePart
      ? Math.hypot(activePart.x - previousActivePart.x, activePart.y - previousActivePart.y)
      : 0;
    const contact = segmentLength > 0.001
      ? this.registry.findActivePartSweepContact(previousActivePart, activePart, profile)
      : null;
    if (contact) {
      const segmentAngle = Math.atan2(event.clientY - previousInput.y, event.clientX - previousInput.x);
      const angleError = getPhysicalToolAngleError(profile, segmentAngle);
      const contactScore = contact.distance + angleError * 22;
      if (!this.state.contact || contactScore <= (this.state.contact.score ?? Infinity)) {
        this.state.contact = { ...contact, score: contactScore };
        this.state.contactSampleIndex = Math.max(1, this.state.samples.length - 1);
        this.state.contactAngleRadians = segmentAngle;
      }
    }
    this.viewmodel?.setGestureState?.(this.state);
  }

  updateSocketedPry(event, previousInput, previousActivePart, activePart, profile) {
    const stepMotion = Math.hypot(event.clientX - previousInput.x, event.clientY - previousInput.y);
    if (this.state.socketState === 'socket_seeking') {
      const candidate = this.registry.getSocketContact(activePart, profile);
      const seating = candidate ? this.registry.canSeat(candidate.target, {
        toolId: this.state.toolId, actionType: this.state.actionType, tipPoint: activePart, motionPx: stepMotion,
      }) : null;
      if (seating?.accepted) {
        const seatedContact = seating.contact;
        this.state.socketState = 'seated';
        this.state.seatedTarget = seatedContact.target;
        this.state.contact = seatedContact;
        this.state.socketScreen = { ...seatedContact.screen };
        const viewportRect = this.viewport?.getBoundingClientRect?.();
        this.state.viewportSize = viewportRect ? { width: viewportRect.width, height: viewportRect.height } : null;
        this.state.planted = true;
        this.state.plantX = event.clientX;
        this.state.plantY = event.clientY;
        this.state.settle = 0;
        this.setControlsConstrained(true);
        navigator.vibrate?.([8, 18, 12]);
        const acceptedSocketCue = this.playAcceptedSocketCue(seatedContact.target);
        if (!acceptedSocketCue) this.playContactSound('plant');
        this.viewmodel?.impact?.({ strength: 0.42 });
        return;
      }
      if (previousActivePart && activePart && stepMotion > 3) {
        const wrongContact = this.registry.findActivePartSweepContact(previousActivePart, activePart, profile);
        if (wrongContact && (!candidate || wrongContact.target.id !== candidate.target.id) && this.state.feedbackCooldown <= 0) {
          this.state.feedbackCooldown = 0.18;
          navigator.vibrate?.(6);
          this.playContactSound('skid');
        }
      }
      return;
    }
    if (!this.state.seatedTarget || this.state.completed) return;
    const lever = this.state.seatedTarget.lever ?? {};
    const [rawX = 0, rawY = 1] = lever.directionScreen ?? [0, 1];
    const length = Math.max(0.001, Math.hypot(rawX, rawY));
    const directionX = rawX / length;
    const directionY = rawY / length;
    const pullX = event.clientX - this.state.plantX;
    const pullY = event.clientY - this.state.plantY;
    const leverTravel = Math.max(0, pullX * directionX + pullY * directionY);
    const arcPx = Math.max(24, lever.arcPx ?? 110);
    this.state.leverTravelPx = Math.min(arcPx, leverTravel);
    this.state.strain = THREE.MathUtils.clamp(this.state.leverTravelPx / arcPx, 0, 1);
    this.state.constrainedDeltaX = directionX * this.state.leverTravelPx;
    this.state.constrainedDeltaY = directionY * this.state.leverTravelPx;
    if (this.state.settle >= 1 && this.state.strain > 0.015) this.state.socketState = 'tension_pry';
    this.state.seatedTarget.receivePryStrain?.({ strain: this.state.strain, stage: this.state.strain >= 0.8 ? 'final' : this.state.strain >= 0.42 ? 'mid' : 'early' });
    const feedbackStage = this.state.strain >= 0.8 ? 'final' : this.state.strain >= 0.42 ? 'mid' : this.state.strain > 0.04 ? 'early' : 'none';
    if (feedbackStage !== this.state.feedbackStage) {
      this.state.feedbackStage = feedbackStage;
      if (feedbackStage === 'early') this.playContactSound('pry');
      if (feedbackStage === 'mid') {
        navigator.vibrate?.(14);
        this.playContactSound('pry');
      }
      if (feedbackStage === 'final') {
        navigator.vibrate?.([18, 22, 28]);
        this.playContactSound('final-strain');
        this.feedback?.shake?.({ durationMs: 420, intensity: 0.09 });
      }
    }
    if (this.state.socketState === 'tension_pry' && this.state.strain >= 1) this.completeSocketedPry(profile);
  }

  completeSocketedPry(profile) {
    const target = this.state.seatedTarget;
    if (!target || this.state.completed) return;
    const gesture = {
      socketState: 'tension_pry', strain: 1, travelPx: this.state.leverTravelPx,
      leverTravelPx: this.state.leverTravelPx, velocityPxPerSecond: 120,
      smoothness: 1, angleRadians: Math.atan2(this.state.constrainedDeltaY ?? 1, this.state.constrainedDeltaX ?? 0),
    };
    const result = this.registry.evaluate(target, {
      toolId: this.state.toolId, actionType: this.state.actionType, gesture, contact: this.state.contact,
    });
    this.state.completed = result.accepted;
    this.state.socketState = result.accepted ? 'released/open' : 'seated';
    this.resolveFeedback(result, profile);
    if (result.accepted) {
      this.cooldownRemaining = profile.cooldownSeconds;
      this.setControlsConstrained(false);
    }
  }

  pointerEnd(event) {
    if (!this.state.active || event.pointerId !== this.state.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    event.stopPropagation();
    this.pointerMove(event);
    if (!this.state.active) return;
    const profile = getPhysicalToolProfile(this.state.toolId);
    if (profile?.actionType === 'pry') {
      const target = this.state.seatedTarget;
      if (!this.state.completed) {
        target?.receivePryRelease?.({ strain: this.state.strain, retainFactor: target?.release?.retainFactor ?? 0 });
        if (this.state.socketState === 'socket_seeking' && this.state.travelPx > 12) this.playContactSound('skid');
      }
      this.viewport?.releasePointerCapture?.(event.pointerId);
      this.setControlsConstrained(false);
      this.state = this.createIdleState();
      this.viewmodel?.setGestureState?.(this.state);
      return;
    }
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
    this.viewport?.releasePointerCapture?.(event.pointerId);
    this.state = this.createIdleState();
    this.viewmodel?.setGestureState?.(this.state);
  }

  isInputBlocked(event) {
    if (this.app?.classList?.contains?.('is-paused')) return true;
    if (this.app?.querySelector?.('[data-equipment-panel][aria-hidden="false"]')) return true;
    return Boolean(event?.target?.closest?.('button, [data-equipment-panel], [data-creature-lab-panel], [data-pause-overlay], [data-control="move"]'));
  }

  cancelGesture(_reason = 'cancelled') {
    if (this.state.pointerId != null) this.viewport?.releasePointerCapture?.(this.state.pointerId);
    this.state = this.createIdleState();
    this.setControlsConstrained(false);
    this.viewmodel?.setGestureState?.(this.state);
  }

  resolveFeedback(result, profile) {
    if (result.accepted) {
      const final = result.completed === true || result.cleared === true || result.opened === true || result.destroyed === true || result.pried === true;
      this.viewmodel?.impact?.({ strength: final ? 1.35 : profile.actionType === 'chop' ? 1.05 : 0.72 });
      this.feedback?.shake?.(final ? profile.finalShake : profile.shake);
      navigator.vibrate?.(profile.actionType === 'chop' ? (final ? [28, 30, 48] : 32) : profile.actionType === 'pry' ? (final ? [35, 45, 70] : 24) : (final ? [18, 22, 30] : 14));
      if (!result.audioAcceptedCuePlayed && !result.suppressProceduralSuccessAudio) this.playContactSound(final ? 'final' : profile.actionType);
      return;
    }
    if (this.state.contact) {
      this.viewmodel?.impact?.({ strength: 0.38 });
      navigator.vibrate?.(7);
      this.playContactSound(result.reason === 'wrong-tool' ? 'skid' : 'refuse');
    }
  }

  playContactSound(kind) {
    if (this.audioRuntime) return;
    try {
      const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioContext ??= new AudioContextClass();
      const context = this.audioContext;
      if (context.state === 'suspended') context.resume?.();
      const duration = kind === 'final' ? 0.36 : kind === 'final-strain' ? 0.48 : kind === 'pry' ? 0.28 : 0.13;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      oscillator.type = kind === 'skid' || kind === 'plant' || kind === 'final-strain' ? 'sawtooth' : 'triangle';
      oscillator.frequency.setValueAtTime(kind === 'skid' ? 260 : kind === 'final-strain' ? 68 : kind === 'pry' || kind === 'plant' ? 92 : kind === 'chop' ? 74 : 128, context.currentTime);
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

  playAcceptedSocketCue(target) {
    if (target?.id !== 'beneath_folsom_drain_grate') return false;
    const position = target.socket?.position ?? target.target;
    this.audioRuntime?.play3D?.('audio_ch2_beneath_folsom_drain_grate_bar_socket_oneshot', position);
    return true;
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
    if (this.state.active) this.state.feedbackCooldown = Math.max(0, this.state.feedbackCooldown - deltaSeconds);
    if (this.state.socketState === 'seated') {
      this.state.settle = Math.min(1, this.state.settle + deltaSeconds / 0.14);
      this.viewmodel?.setGestureState?.(this.state);
    }
  }

  setControlsConstrained(active) {
    if (!this.controls) return;
    this.controls.physicalToolSeated = active === true;
    if (active) {
      this.controls.move = { x: 0, y: 0 };
      this.controls.look = { x: 0, y: 0 };
    }
  }

  rebindSession({ camera, player, dungeon } = {}) {
    this.camera = camera ?? this.camera;
    this.player = player ?? this.player;
    this.dungeon = dungeon ?? this.dungeon;
    this.registry.rebind({ dungeon: this.dungeon, camera: this.camera, player: this.player, viewport: this.viewport });
    this.state = this.createIdleState();
    this.setControlsConstrained(false);
    this.viewmodel?.setGestureState?.(this.state);
  }

  dispose() {
    this.cancelGesture('disposed');
    this.disposers.forEach((dispose) => dispose?.());
    this.disposers = [];
    this.audioContext?.close?.();
    this.audioContext = null;
  }
}

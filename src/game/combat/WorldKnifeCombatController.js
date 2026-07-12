import * as THREE from 'three';
import { KNIFE_COMBAT_CONFIG } from './CombatConfig.js';
import { advancePenetrationDepth, clampWorkspacePoint, classifyKnifeContact, classifySlashContact, deriveBladeTip, normalizedBladeForward } from './CombatMath.js';
import { SLASH_CONFIG } from './CombatStage2Config.js';

const forwardLocal = new THREE.Vector3(0, 0, -1);
const edgeLocalA = new THREE.Vector3(-KNIFE_COMBAT_CONFIG.bladeWidth * 0.5, 0, -0.05);
const edgeLocalB = new THREE.Vector3(-KNIFE_COMBAT_CONFIG.bladeWidth * 0.5, 0, -KNIFE_COMBAT_CONFIG.bladeLength * 0.9);
const tmpVector = new THREE.Vector3();
const tmpVectorB = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();

function setLine(line, start, end) {
  const array = line.geometry.attributes.position.array;
  array[0] = start.x; array[1] = start.y; array[2] = start.z;
  array[3] = end.x; array[4] = end.y; array[5] = end.z;
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

export class WorldKnifeCombatController {
  constructor({ app, scene, camera, player, actor, physics, equipmentRuntime, controls, feedback = null, feedbackSystem = null, bloodEffects = null, activationProvider = null } = {}) {
    this.app = app;
    this.viewport = app?.querySelector?.('[data-game="viewport"]') ?? app;
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.actor = actor;
    this.physics = physics;
    this.equipmentRuntime = equipmentRuntime;
    this.controls = controls;
    this.feedback = feedback;
    this.feedbackSystem = feedbackSystem;
    this.bloodEffects = bloodEffects;
    this.activationProvider = activationProvider;
    this.config = KNIFE_COMBAT_CONFIG;
    this.state = 'no_contact';
    this.reason = 'ready';
    this.aimX = 0;
    this.aimY = 0;
    this.desiredExtension = 0;
    this.attackStartExtension = 0;
    this.lastAttackPointer = null;
    this.lastAttackSequence = 0;
    this.gripPointerId = null;
    this.gripStart = new THREE.Vector2();
    this.gripStartAim = new THREE.Vector2();
    this.desiredGrip = new THREE.Vector3();
    this.actualGrip = new THREE.Vector3();
    this.previousGrip = new THREE.Vector3();
    this.desiredQuaternion = new THREE.Quaternion();
    this.actualQuaternion = new THREE.Quaternion();
    this.previousQuaternion = new THREE.Quaternion();
    this.bladeForward = new THREE.Vector3(0, 0, -1);
    this.previousTip = new THREE.Vector3();
    this.currentTip = new THREE.Vector3();
    this.desiredTip = new THREE.Vector3();
    this.edgeStart = new THREE.Vector3();
    this.edgeEnd = new THREE.Vector3();
    this.previousEdgeStart = new THREE.Vector3();
    this.previousEdgeEnd = new THREE.Vector3();
    this.entry = null;
    this.activeSlash = null;
    this.lastContactPart = 'none';
    this.slashCount = 0;
    this.penetrationDepth = 0;
    this.maximumDepthReached = 0;
    this.contactNormal = new THREE.Vector3();
    this.lastSweep = null;
    this.lastFrameVelocity = 0;
    this.visibleCollisionError = 0;
    this.disposers = [];
    this.buildVisual();
    this.buildDebug();
    this.initializePose();
    this.bindInput();
  }

  buildVisual() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x4c3021, roughness: 0.96 });
    const wornWood = new THREE.MeshStandardMaterial({ color: 0x76513a, roughness: 0.9 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x6a4a3b, roughness: 0.72, metalness: 0.58 });
    const darkRust = new THREE.MeshStandardMaterial({ color: 0x302621, roughness: 0.82, metalness: 0.45 });
    this.materials = [wood, wornWood, rust, darkRust];
    this.visual = new THREE.Group();
    this.visual.name = 'old-work-knife-authoritative-world-weapon';
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, this.config.handleLength, 10), wood);
    handle.name = 'old-work-knife-grip';
    handle.rotation.x = Math.PI / 2;
    handle.position.z = this.config.handleLength * 0.5;
    this.visual.add(handle);
    [0.05, 0.16, 0.27].forEach((z, index) => {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.057, 0.009, 5, 10), index === 1 ? wornWood : darkRust);
      wrap.name = `old-work-knife-handle-wrap-${index}`;
      wrap.rotation.x = Math.PI / 2;
      wrap.position.z = z;
      this.visual.add(wrap);
    });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.045), darkRust);
    guard.name = 'old-work-knife-guard';
    guard.position.z = 0.015;
    this.visual.add(guard);
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.047, 0.008, -0.01, 0.047, 0.008, -0.01, 0.038, 0.008, -0.41, 0, 0.008, -this.config.bladeLength,
      -0.044, 0.008, -0.41, -0.047, -0.008, -0.01, 0.047, -0.008, -0.01, 0.038, -0.008, -0.41,
      0, -0.008, -this.config.bladeLength, -0.044, -0.008, -0.41,
    ], 3));
    blade.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3, 5, 7, 6, 5, 9, 7, 9, 8, 7, 0, 5, 6, 0, 6, 1, 1, 6, 7, 1, 7, 2, 2, 7, 8, 2, 8, 3, 3, 8, 9, 3, 9, 4, 4, 9, 5, 4, 5, 0]);
    blade.computeVertexNormals();
    const bladeMesh = new THREE.Mesh(blade, rust);
    bladeMesh.name = 'old-work-knife-blade-body';
    this.visual.add(bladeMesh);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.025, 0.39), darkRust);
    spine.name = 'old-work-knife-spine';
    spine.position.set(0.042, 0, -0.2);
    this.visual.add(spine);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.4), rust);
    edge.name = 'old-work-knife-cutting-edge';
    edge.position.set(-0.045, 0, -0.21);
    this.visual.add(edge);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), darkRust);
    pommel.name = 'old-work-knife-pommel';
    pommel.position.z = this.config.handleLength + 0.03;
    this.visual.add(pommel);
    this.visual.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; object.userData.itemId = this.config.itemId; object.userData.combatWeaponPart = object.name; } });
    this.scene.add(this.visual);
  }

  buildDebug() {
    this.debugRoot = new THREE.Group();
    this.debugRoot.name = 'world-knife-combat-debug';
    this.debugRoot.visible = false;
    const makeMarker = (color, size, name) => {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ color, depthTest: false }));
      marker.name = name;
      marker.renderOrder = 20000;
      this.debugRoot.add(marker);
      return marker;
    };
    const makeLine = (color, name) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
      line.name = name;
      line.renderOrder = 19999;
      this.debugRoot.add(line);
      return line;
    };
    this.debugDesired = makeMarker(0xffcf33, 0.025, 'desired-hand-position');
    this.debugActual = makeMarker(0x3dff83, 0.025, 'actual-hand-position');
    this.debugTip = makeMarker(0xff3a38, 0.02, 'knife-tip');
    this.debugEntry = makeMarker(0xcf4cff, 0.022, 'penetration-entry');
    this.debugForward = makeLine(0xff3434, 'blade-forward-axis');
    this.debugSweep = makeLine(0x47d6ff, 'previous-current-tip-sweep');
    this.debugEdge = makeLine(0xffd348, 'cutting-edge-segment');
    this.debugCameraRay = makeLine(0xffffff, 'camera-center-ray-comparison-only');
    this.debugPenetration = makeLine(0xcf4cff, 'penetration-axis-depth');
    const workspace = this.config.workspace;
    const size = new THREE.Vector3(workspace.max[0] - workspace.min[0], workspace.max[1] - workspace.min[1], workspace.max[2] - workspace.min[2]);
    this.debugWorkspace = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)), new THREE.LineBasicMaterial({ color: 0x4fd2ff, transparent: true, opacity: 0.45, depthTest: false }));
    this.debugWorkspace.name = 'camera-relative-hand-workspace-bounds';
    this.debugRoot.add(this.debugWorkspace);
    this.scene.add(this.debugRoot);
  }

  initializePose() {
    this.camera.updateMatrixWorld(true);
    const local = new THREE.Vector3(...this.config.workspace.ready);
    this.actualGrip.copy(local);
    this.camera.localToWorld(this.actualGrip);
    this.desiredGrip.copy(this.actualGrip);
    this.previousGrip.copy(this.actualGrip);
    this.camera.getWorldQuaternion(this.actualQuaternion);
    this.previousQuaternion.copy(this.actualQuaternion);
    this.desiredQuaternion.copy(this.actualQuaternion);
    this.updateDerivedPose(true);
  }

  bindInput() {
    const down = (event) => this.pointerDown(event);
    const move = (event) => this.pointerMove(event);
    const end = (event) => this.pointerEnd(event);
    this.viewport?.addEventListener?.('pointerdown', down, { passive: false, capture: true });
    this.viewport?.addEventListener?.('pointermove', move, { passive: false, capture: true });
    this.viewport?.addEventListener?.('pointerup', end, { passive: false, capture: true });
    this.viewport?.addEventListener?.('pointercancel', end, { passive: false, capture: true });
    const cancel = () => this.cancel('app-suspended');
    document.addEventListener('visibilitychange', cancel);
    window.addEventListener('pagehide', cancel);
    this.disposers.push(
      () => this.viewport?.removeEventListener?.('pointerdown', down, { capture: true }),
      () => this.viewport?.removeEventListener?.('pointermove', move, { capture: true }),
      () => this.viewport?.removeEventListener?.('pointerup', end, { capture: true }),
      () => this.viewport?.removeEventListener?.('pointercancel', end, { capture: true }),
      () => document.removeEventListener('visibilitychange', cancel),
      () => window.removeEventListener('pagehide', cancel),
    );
  }

  pointerDown(event) {
    if (!this.isEquipped() || event.target?.closest?.('button,[data-control="move"],[data-control="look"],[data-equipment-panel]')) return;
    const screen = this.projectGrip();
    if (!screen || Math.hypot(event.clientX - screen.x, event.clientY - screen.y) > 92) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    this.gripPointerId = event.pointerId;
    this.gripStart.set(event.clientX, event.clientY);
    this.gripStartAim.set(this.aimX, this.aimY);
    this.viewport.setPointerCapture?.(event.pointerId);
  }

  pointerMove(event) {
    if (event.pointerId !== this.gripPointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    this.aimX = THREE.MathUtils.clamp(this.gripStartAim.x + (event.clientX - this.gripStart.x) * this.config.workspace.aimSensitivity, -1, 1);
    this.aimY = THREE.MathUtils.clamp(this.gripStartAim.y - (event.clientY - this.gripStart.y) * this.config.workspace.aimSensitivity, -1, 1);
  }

  pointerEnd(event) {
    if (event.pointerId !== this.gripPointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    this.viewport.releasePointerCapture?.(event.pointerId);
    this.gripPointerId = null;
  }

  isEquipped() {
    return this.equipmentRuntime?.getEquippedToolId?.() === this.config.itemId && this.equipmentRuntime?.hasItem?.(this.config.itemId) && (this.activationProvider?.() ?? true);
  }

  updateInput(dt) {
    const attack = this.controls?.getAttackControlState?.() ?? { held: false, travel: 0, pointerId: null, sequence: 0 };
    if (attack.sequence !== this.lastAttackSequence) {
      this.lastAttackSequence = attack.sequence;
      this.attackStartExtension = this.desiredExtension;
    }
    if (attack.sequence > 0) this.desiredExtension = THREE.MathUtils.clamp(this.attackStartExtension + attack.travel * this.config.workspace.thrustSensitivity, 0, this.config.workspace.thrustDistance);
    if (!attack.held) {
      const keyboardThrust = this.player?.keyboard?.has?.('Space');
      const keyboardWithdraw = this.player?.keyboard?.has?.('ShiftLeft') || this.player?.keyboard?.has?.('ShiftRight');
      if (keyboardThrust) this.desiredExtension = Math.min(this.config.workspace.thrustDistance, this.desiredExtension + dt * 0.52);
      else if (keyboardWithdraw) this.desiredExtension = Math.max(0, this.desiredExtension - dt * 0.65);
      // Touch release holds the requested hand depth. A later downward gesture performs
      // deliberate retraction; release alone never plays an automatic withdrawal animation.
    }
  }

  computeDesiredPose() {
    const workspace = this.config.workspace;
    const local = new THREE.Vector3(
      workspace.ready[0] + this.aimX * workspace.lateralReach,
      workspace.ready[1] + this.aimY * workspace.verticalReach,
      workspace.ready[2] - this.desiredExtension,
    );
    clampWorkspacePoint(local, workspace);
    this.camera.updateMatrixWorld(true);
    this.desiredGrip.copy(local);
    this.camera.localToWorld(this.desiredGrip);
    this.camera.getWorldQuaternion(this.desiredQuaternion);
    tmpQuaternion.setFromEuler(new THREE.Euler(-this.aimY * 0.34, -this.aimX * 0.34, -this.aimX * 0.12, 'YXZ'));
    this.desiredQuaternion.multiply(tmpQuaternion).normalize();
    deriveBladeTip(this.desiredGrip, this.desiredQuaternion, this.config.bladeLength, this.desiredTip);
  }

  beforePhysics(dt) {
    this.visual.visible = this.isEquipped();
    if (!this.visual.visible) {
      if (this.entry) this.cancel('weapon-unequipped');
      return;
    }
    this.updateInput(dt);
    this.computeDesiredPose();
    this.previousGrip.copy(this.actualGrip);
    this.previousQuaternion.copy(this.actualQuaternion);
    this.previousTip.copy(this.currentTip);
    this.previousEdgeStart.copy(this.edgeStart);
    this.previousEdgeEnd.copy(this.edgeEnd);
    if (this.entry) this.solveEmbeddedPose(dt);
    else this.solveFreePose(dt);
    this.updateDerivedPose();
  }

  solveFreePose(dt) {
    const difference = tmpVector.copy(this.desiredGrip).sub(this.actualGrip);
    const maxTravel = this.config.maximumVelocity * dt;
    if (difference.length() > maxTravel) difference.setLength(maxTravel);
    this.actualGrip.add(difference);
    const angularAlpha = 1 - Math.exp(-this.config.workspace.rotationFollow * dt);
    this.actualQuaternion.slerp(this.desiredQuaternion, angularAlpha).normalize();
    const prospectiveTip = deriveBladeTip(this.actualGrip, this.actualQuaternion, this.config.bladeLength, tmpVectorB);
    const travel = prospectiveTip.distanceTo(this.previousTip);
    this.lastFrameVelocity = travel / Math.max(dt, 1e-5);
    this.lastSweep = { from: this.previousTip.clone(), to: prospectiveTip.clone() };
    if (travel <= 1e-5) { this.releaseSlashContact(dt, false); return; }
    const forward = normalizedBladeForward(this.actualQuaternion, new THREE.Vector3());
    const movementDirection = prospectiveTip.clone().sub(this.previousTip).normalize();
    const forwardMotion = movementDirection.dot(forward);
    const tangentialRatio = Math.sqrt(Math.max(0, 1 - forwardMotion * forwardMotion));
    // A physical draw cut can include inward pressure. Give the swept edge first
    // ownership only for a substantially tangential tip path; straight thrusts
    // remain tip-authoritative.
    if (tangentialRatio >= 0.52 && this.resolveSweptEdgeContact(dt)) {
      return;
    }
    this.releaseSlashContact(dt, false);
    const hit = this.physics.castWeaponTip(this.previousTip, prospectiveTip, this.config.tipRadius, (collider) => this.actor.colliderRegions.has(collider.handle));
    if (!hit?.collider) return;
    const toi = THREE.MathUtils.clamp(hit.time_of_impact ?? 0, 0, 1);
    const contactPoint = this.previousTip.clone().lerp(prospectiveTip, toi);
    const contactNormal = hit.normal1 ? new THREE.Vector3(hit.normal1.x, hit.normal1.y, hit.normal1.z).normalize() : this.bladeForward.clone().negate();
    const semanticHit = this.actor.resolveHit(hit.collider, contactPoint);
    if (!semanticHit) return;
    const alignment = movementDirection.dot(forward);
    this.contactNormal.copy(contactNormal);
    this.lastContactPart = 'tip';
    const classification = classifyKnifeContact({ speed: this.lastFrameVelocity, alignment, part: Math.abs(alignment) < 0.24 ? 'edge' : 'tip', minimumSpeed: this.config.minimumPunctureSpeed, minimumAlignment: this.config.minimumPunctureAlignment, failedAlignment: this.config.failedPenetrationAlignment });
    if (classification.state === 'edge_contact' || classification.state === 'glancing_contact') {
      this.state = classification.state;
      this.reason = classification.reason;
      this.actualGrip.add(contactNormal.multiplyScalar(Math.min(0.035, travel)));
      semanticHit.body.applyImpulseAtPoint(movementDirection.multiplyScalar(0.035), contactPoint, true);
      this.feedbackSystem?.emit(classification.state === 'glancing_contact' ? 'blade_scrape' : 'clothing_contact', { position: contactPoint, severity: 0.2 });
      return;
    }
    if (!classification.penetrates) {
      this.state = classification.state;
      this.reason = classification.reason;
      this.actualGrip.add(contactNormal.multiplyScalar(Math.min(0.025, travel)));
      this.feedbackSystem?.emit('failed_tip', { position: contactPoint, severity: this.lastFrameVelocity * 0.2 });
      return;
    }
    this.beginPenetration(semanticHit, contactPoint, forward, alignment);
  }

  resolveSweptEdgeContact(dt) {
    const prospectiveStart = edgeLocalA.clone().applyQuaternion(this.actualQuaternion).add(this.actualGrip);
    const prospectiveEnd = edgeLocalB.clone().applyQuaternion(this.actualQuaternion).add(this.actualGrip);
    const previousMidpoint = this.previousEdgeStart.clone().add(this.previousEdgeEnd).multiplyScalar(0.5);
    const currentMidpoint = prospectiveStart.clone().add(prospectiveEnd).multiplyScalar(0.5);
    const edgeMotion = currentMidpoint.clone().sub(previousMidpoint);
    if (edgeMotion.lengthSq() < 1e-8) { this.releaseSlashContact(dt, true); return false; }
    const hit = this.physics.castWeaponTip(previousMidpoint, currentMidpoint, this.config.bladeWidth * 0.32, (collider) => this.actor.colliderRegions.has(collider.handle));
    if (!hit?.collider) { this.releaseSlashContact(dt, false); return false; }
    const point = hit.witness1 ? new THREE.Vector3(hit.witness1.x, hit.witness1.y, hit.witness1.z) : currentMidpoint;
    const semanticHit = this.actor.resolveHit(hit.collider, point);
    if (!semanticHit) return false;
    const normal = hit.normal1 ? new THREE.Vector3(hit.normal1.x, hit.normal1.y, hit.normal1.z).normalize() : point.clone().sub(this.getBodyCenter(semanticHit.body)).normalize();
    const direction = edgeMotion.clone().normalize();
    const localMotion = direction.clone().applyQuaternion(this.actualQuaternion.clone().invert());
    const lateralLead = Math.abs(localMotion.x);
    const flatLead = Math.abs(localMotion.y);
    // The authored cutting edge occupies local -X. The leading blade part is
    // therefore determined from real local travel, not arbitrary mesh names or
    // a reticle ray. Reverse travel correctly presents the spine.
    const part = flatLead > lateralLead * 0.72 ? 'flat' : localMotion.x < -0.18 ? 'edge' : localMotion.x > 0.18 ? 'spine' : 'flat';
    const surfacePressure = Math.max(0, -direction.dot(normal));
    const forwardPressure = Math.max(0, -localMotion.z) * 0.65;
    const pressure = Math.max(surfacePressure, forwardPressure);
    const edgeAlignment = part === 'edge' ? THREE.MathUtils.clamp(-localMotion.x, 0, 1) : part === 'spine' ? THREE.MathUtils.clamp(localMotion.x, 0, 1) : 0;
    const stepTravel = Math.min(SLASH_CONFIG.maximumStepLength, edgeMotion.length());
    const speed = edgeMotion.length() / Math.max(dt, 1e-5);
    const sameOwner = this.activeSlash?.bodyId === semanticHit.bodyId && this.activeSlash?.regionId === semanticHit.regionId && this.activeSlash?.part === part;
    if (!sameOwner) {
      this.finishActiveSlash(true);
      this.activeSlash = { bodyId: semanticHit.bodyId, regionId: semanticHit.regionId, part, hit: semanticHit, startPoint: point.clone(), lastPoint: point.clone(), surfaceNormal: normal.clone(), direction: direction.clone(), duration: 0, travel: 0, pressure: 0, woundId: null, missedTime: 0, bloodEmitted: false };
    }
    const slash = this.activeSlash;
    slash.duration += dt;
    slash.travel = Math.min(SLASH_CONFIG.maximumWoundLength, slash.travel + stepTravel);
    slash.pressure = THREE.MathUtils.lerp(slash.pressure, pressure, 0.4);
    slash.direction.lerp(direction, 0.35).normalize();
    slash.lastPoint.copy(point);
    slash.surfaceNormal.copy(normal);
    slash.missedTime = 0;
    const regionKey = semanticHit.regionId.includes('arm') ? 'arm' : semanticHit.regionId.includes('leg') || semanticHit.regionId.includes('thigh') ? 'leg' : semanticHit.regionId.includes('hand') ? 'hand' : semanticHit.regionId.includes('foot') ? 'foot' : semanticHit.regionId;
    const classification = classifySlashContact({ part, edgeSpeed: speed, edgeAlignment, pressure: slash.pressure, contactDuration: slash.duration, travel: slash.travel, tissueResistance: semanticHit.region.softTissueResistance, clothingResistance: SLASH_CONFIG.clothingResistance[regionKey] ?? 0.2 });
    this.state = classification.state;
    this.reason = `${part}:${classification.state}`;
    this.lastContactPart = part;
    if (classification.cuts) {
      const wound = this.actor.applySlashWound({ hit: semanticHit, startPoint: slash.startPoint, endPoint: point, surfaceNormal: normal, cutDirection: slash.direction, depth: classification.depth, cutLength: slash.woundId ? stepTravel : classification.physicalTravel, severity: classification.severity, classification: classification.state, woundId: slash.woundId });
      if (wound && !slash.woundId) {
        slash.woundId = wound.id;
        this.slashCount += 1;
        this.feedbackSystem?.emit(classification.state === 'deep_slash' ? 'deep_slash' : 'shallow_slash', { position: point, severity: classification.severity });
        this.bloodEffects?.emitSlash(wound, slash.direction);
        slash.bloodEmitted = true;
      }
    } else if (part === 'flat' || part === 'spine') {
      semanticHit.body.applyImpulseAtPoint(direction.clone().multiplyScalar(Math.min(0.045, speed * 0.008)), point, true);
      this.feedbackSystem?.emit(part === 'spine' ? 'blunt_contact' : 'clothing_contact', { position: point, severity: pressure * speed * 0.1 });
    } else if (classification.state === 'scraping_contact') this.feedbackSystem?.emit('blade_scrape', { position: point, severity: speed * 0.1 });
    return true;
  }

  getBodyCenter(body) {
    const translation = body.translation();
    return new THREE.Vector3(translation.x, translation.y, translation.z);
  }

  releaseSlashContact(dt, interrupted) {
    if (!this.activeSlash) return;
    this.activeSlash.missedTime += dt;
    if (this.activeSlash.missedTime >= SLASH_CONFIG.contactReleaseSeconds) this.finishActiveSlash(interrupted);
  }

  finishActiveSlash(interrupted = false) {
    if (!this.activeSlash) return;
    if (this.activeSlash.woundId) this.actor.woundSystem.finishSlash(this.activeSlash.woundId, interrupted);
    if (!this.activeSlash.woundId && this.activeSlash.duration > 0) {
      this.state = interrupted ? 'interrupted_cut' : this.state;
      this.reason = interrupted ? 'edge-path-interrupted-before-cut' : this.reason;
    }
    this.activeSlash = null;
  }

  beginPenetration(hit, entryPoint, axis, alignment) {
    const wound = this.actor.beginPunctureWound({ hit, entryPoint, direction: axis, depth: 0.004, weaponId: this.config.itemId });
    this.entry = {
      hit,
      bodyId: hit.bodyId,
      localPoint: hit.localPoint.clone(),
      localAxis: axis.clone().applyQuaternion(new THREE.Quaternion(hit.body.rotation().x, hit.body.rotation().y, hit.body.rotation().z, hit.body.rotation().w).invert()),
      initialAlignment: alignment,
      hardDepth: this.resolveHardStructureDepth(hit),
      woundId: wound?.id ?? null,
      softFeedback: false,
      deepFeedback: false,
      hardFeedback: false,
    };
    this.penetrationDepth = 0.004;
    this.maximumDepthReached = 0.004;
    this.state = 'surface_puncture';
    this.reason = 'aligned-tip-punctured-surface';
    this.actor.setEmbeddedWeapon(this);
    this.actor.applyPenetration({ hit, entryPoint, direction: axis, deltaDepth: 0.004, depth: this.penetrationDepth, force: this.lastFrameVelocity, woundId: this.entry.woundId });
    this.bloodEffects?.emitEntry(wound, wound?.severity ?? 0.1);
    this.feedback?.shake?.({ durationMs: 75, intensity: 0.018 });
  }

  resolveHardStructureDepth(hit) {
    const region = hit.region;
    if (!region.hardStructure) return null;
    if (['skull', 'face', 'head'].includes(hit.regionId)) return region.hardStructureDepth;
    if (hit.regionId === 'neck') return Math.abs(hit.localPoint.x) < 0.055 ? region.hardStructureDepth : null;
    if (['upper_chest', 'lower_chest'].includes(hit.regionId)) {
      const ribBand = Math.abs(Math.sin((hit.localPoint.x + 0.42) * 17)) > 0.48;
      return ribBand ? region.hardStructureDepth : null;
    }
    return Math.abs(hit.localPoint.x) < 0.045 ? region.hardStructureDepth : null;
  }

  getEntryWorldPose() {
    const body = this.entry?.hit?.body;
    if (!body) return null;
    const translation = body.translation();
    const rotation = body.rotation();
    const bodyQ = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    return {
      point: this.entry.localPoint.clone().applyQuaternion(bodyQ).add(new THREE.Vector3(translation.x, translation.y, translation.z)),
      axis: this.entry.localAxis.clone().applyQuaternion(bodyQ).normalize(),
    };
  }

  solveEmbeddedPose(dt) {
    const worldEntry = this.getEntryWorldPose();
    if (!worldEntry || !this.actor.bodies.has(this.entry.bodyId)) { this.cancel('target-invalid'); return; }
    const maximumRegionDepth = Math.min(this.entry.hit.region.maximumTissueDepth, this.config.maximumPenetrationDepth, this.config.bladeLength);
    const desiredProjection = this.desiredTip.clone().sub(worldEntry.point).dot(worldEntry.axis);
    let targetDepth = THREE.MathUtils.clamp(desiredProjection, -0.04, maximumRegionDepth);
    const hardDepth = this.entry.hardDepth;
    const penetration = advancePenetrationDepth({ currentDepth: this.penetrationDepth, targetDepth, dt, tissueResistance: this.entry.hit.region.softTissueResistance + (hardDepth != null && targetDepth >= hardDepth ? this.entry.hit.region.hardStructureResistance : 0), hardDepth, maximumDepth: maximumRegionDepth, penetrationRate: this.config.penetrationRate, withdrawalRate: this.config.withdrawalRate });
    const hardContact = penetration.hardContact;
    targetDepth = penetration.targetDepth;
    if (hardContact) {
      this.state = 'bone_contact';
      this.reason = 'hard-structure-resistance';
      if (!this.entry.hardFeedback) {
        this.entry.hardFeedback = true;
        this.feedbackSystem?.emit('bone_contact', { position: worldEntry.point, severity: 0.85 });
        this.feedback?.shake?.({ durationMs: 85, intensity: 0.022 });
      }
    }
    const resistance = this.entry.hit.region.softTissueResistance + (hardContact ? this.entry.hit.region.hardStructureResistance : 0);
    const previousDepth = this.penetrationDepth;
    this.penetrationDepth = penetration.depth;
    if (penetration.extracted) { this.extract(); return; }
    const constrainedTip = worldEntry.point.clone().addScaledVector(worldEntry.axis, Math.max(0, this.penetrationDepth));
    const desiredLateral = this.desiredTip.clone().sub(constrainedTip).addScaledVector(worldEntry.axis, -this.desiredTip.clone().sub(constrainedTip).dot(worldEntry.axis));
    const lateralDistance = desiredLateral.length();
    const force = Math.min(1.2, lateralDistance * this.config.forceTransfer);
    if (lateralDistance > 0.002) this.entry.hit.body.applyImpulseAtPoint(desiredLateral.normalize().multiplyScalar(force * dt), worldEntry.point, true);
    if (lateralDistance > this.config.lateralBindDistance) this.feedbackSystem?.emit('blade_bind', { position: worldEntry.point, severity: lateralDistance / this.config.forcedExtractionDistance });
    if (lateralDistance > this.config.forcedExtractionDistance && targetDepth < this.penetrationDepth * 0.35) { this.extract('forced-lateral-release'); return; }
    this.actualQuaternion.setFromUnitVectors(forwardLocal, worldEntry.axis);
    this.actualGrip.copy(constrainedTip).addScaledVector(worldEntry.axis, -this.config.bladeLength);
    const deltaDepth = Math.max(0, this.penetrationDepth - previousDepth);
    const withdrawal = this.penetrationDepth < previousDepth - 0.001;
    this.maximumDepthReached = Math.max(this.maximumDepthReached, this.penetrationDepth);
    if (deltaDepth > 0) {
      this.actor.applyPenetration({ hit: this.entry.hit, entryPoint: worldEntry.point, direction: worldEntry.axis, deltaDepth, depth: this.penetrationDepth, force: resistance + force, hardContact, woundId: this.entry.woundId });
      if (this.penetrationDepth >= 0.025 && !this.entry.softFeedback) { this.entry.softFeedback = true; this.feedbackSystem?.emit('soft_penetration', { position: worldEntry.point, severity: 0.4 }); }
      if (this.penetrationDepth >= 0.075 && !this.entry.deepFeedback) { this.entry.deepFeedback = true; this.feedbackSystem?.emit('deep_penetration', { position: worldEntry.point, severity: 0.85 }); }
      else if (this.penetrationDepth > 0.025) this.feedbackSystem?.emit('embedded_move', { position: worldEntry.point, severity: deltaDepth * 8 });
    }
    if (!hardContact) this.state = withdrawal ? 'withdrawal' : this.penetrationDepth > 0.018 ? 'embedded' : 'active_penetration';
    if (!hardContact) this.reason = withdrawal ? 'controlled-extraction' : 'player-controlled-depth';
  }

  extract(reason = 'fully-extracted') {
    const entry = this.entry;
    const worldEntry = entry ? this.getEntryWorldPose() : null;
    const wound = entry?.woundId ? this.actor.onWeaponExtracted(entry.woundId, { releaseSeverity: this.maximumDepthReached, direction: worldEntry?.axis?.clone?.().negate?.() }) : null;
    this.state = 'fully_extracted';
    this.reason = reason;
    this.entry = null;
    this.penetrationDepth = 0;
    this.actor.setEmbeddedWeapon(null);
    if (wound) this.bloodEffects?.emitWithdrawal(wound, wound.withdrawalDirection);
    this.feedbackSystem?.emit('extraction', { position: worldEntry?.point ?? this.currentTip, severity: this.maximumDepthReached / this.config.maximumPenetrationDepth });
  }

  updateDerivedPose(initial = false) {
    normalizedBladeForward(this.actualQuaternion, this.bladeForward);
    deriveBladeTip(this.actualGrip, this.actualQuaternion, this.config.bladeLength, this.currentTip);
    this.edgeStart.copy(edgeLocalA).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
    this.edgeEnd.copy(edgeLocalB).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
    if (initial) this.previousTip.copy(this.currentTip);
    if (initial) {
      this.previousEdgeStart.copy(this.edgeStart);
      this.previousEdgeEnd.copy(this.edgeEnd);
    }
  }

  afterPhysics() {
    if (!this.visual.visible) return;
    this.visual.position.copy(this.actualGrip);
    this.visual.quaternion.copy(this.actualQuaternion);
    this.visibleCollisionError = this.visual.position.distanceTo(this.actualGrip);
    this.updateDebug();
  }

  afterPhysicsStep() {}

  updateDebug() {
    this.debugDesired.position.copy(this.desiredGrip);
    this.debugActual.position.copy(this.actualGrip);
    this.debugTip.position.copy(this.currentTip);
    this.debugEntry.visible = Boolean(this.entry);
    if (this.entry) this.debugEntry.position.copy(this.getEntryWorldPose()?.point ?? this.currentTip);
    setLine(this.debugForward, this.actualGrip, this.actualGrip.clone().addScaledVector(this.bladeForward, 0.8));
    setLine(this.debugSweep, this.previousTip, this.currentTip);
    setLine(this.debugEdge, this.edgeStart, this.edgeEnd);
    const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3());
    setLine(this.debugCameraRay, cameraPosition, cameraPosition.clone().addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), 3));
    const entryPose = this.entry ? this.getEntryWorldPose() : null;
    this.debugPenetration.visible = Boolean(entryPose);
    if (entryPose) setLine(this.debugPenetration, entryPose.point, entryPose.point.clone().addScaledVector(entryPose.axis, this.penetrationDepth));
    const workspace = this.config.workspace;
    const centerLocal = new THREE.Vector3((workspace.min[0] + workspace.max[0]) * 0.5, (workspace.min[1] + workspace.max[1]) * 0.5, (workspace.min[2] + workspace.max[2]) * 0.5);
    this.debugWorkspace.position.copy(centerLocal);
    this.camera.localToWorld(this.debugWorkspace.position);
    this.camera.getWorldQuaternion(this.debugWorkspace.quaternion);
  }

  projectGrip() {
    if (!this.camera || !this.viewport) return null;
    const projected = this.actualGrip.clone().project(this.camera);
    const rect = this.viewport.getBoundingClientRect();
    return { x: rect.left + (projected.x * 0.5 + 0.5) * rect.width, y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height };
  }

  setDebugVisible(visible) {
    this.debugRoot.visible = visible;
  }

  nudgeExtension(delta) {
    this.desiredExtension = THREE.MathUtils.clamp(this.desiredExtension + delta, 0, this.config.workspace.thrustDistance);
    this.attackStartExtension = this.desiredExtension;
    if (this.controls) {
      this.controls.attackTravel = 0;
      this.controls.attackSequence = (this.controls.attackSequence ?? 0) + 1;
      this.lastAttackSequence = this.controls.attackSequence;
    }
  }

  nudgeAim(deltaX = 0, deltaY = 0) {
    this.aimX = THREE.MathUtils.clamp(this.aimX + deltaX, -1, 1);
    this.aimY = THREE.MathUtils.clamp(this.aimY + deltaY, -1, 1);
  }

  cancel(reason = 'cancelled') {
    if (this.entry) {
      if (this.entry.woundId) this.actor.onWeaponExtracted(this.entry.woundId, { releaseSeverity: 0, direction: null });
      this.actor.setEmbeddedWeapon(null);
    }
    this.finishActiveSlash(true);
    this.entry = null;
    this.penetrationDepth = 0;
    this.desiredExtension = 0;
    this.attackStartExtension = 0;
    this.state = 'no_contact';
    this.reason = reason;
    this.gripPointerId = null;
    if (this.controls) { this.controls.attackHeld = false; this.controls.attackPointerId = null; this.controls.attackTravel = 0; }
  }

  reset() {
    this.cancel('reset');
    this.aimX = 0;
    this.aimY = 0;
    this.initializePose();
  }

  getDiagnostics() {
    const round = (v) => [v.x, v.y, v.z].map((value) => Number(value.toFixed(3)));
    const euler = new THREE.Euler().setFromQuaternion(this.actualQuaternion, 'YXZ');
    return {
      itemId: this.config.itemId,
      equipped: this.isEquipped(),
      state: this.state,
      reason: this.reason,
      worldPosition: round(this.actualGrip),
      worldRotation: [euler.x, euler.y, euler.z].map((value) => Number(value.toFixed(3))),
      desiredHand: round(this.desiredGrip),
      actualHand: round(this.actualGrip),
      tip: round(this.currentTip),
      bladeForward: round(this.bladeForward),
      penetrationDepth: Number(this.penetrationDepth.toFixed(3)),
      maximumDepthReached: Number(this.maximumDepthReached.toFixed(3)),
      forwardVelocity: Number(this.lastFrameVelocity.toFixed(3)),
      visibleCollisionError: Number(this.visibleCollisionError.toFixed(5)),
      gripPointerActive: this.gripPointerId != null,
      contactPart: this.lastContactPart,
      activeWoundId: this.entry?.woundId ?? this.activeSlash?.woundId ?? null,
      activeSlash: this.activeSlash ? { regionId: this.activeSlash.regionId, part: this.activeSlash.part, duration: Number(this.activeSlash.duration.toFixed(3)), travel: Number(this.activeSlash.travel.toFixed(3)), woundId: this.activeSlash.woundId } : null,
      slashCount: this.slashCount,
    };
  }

  dispose() {
    this.cancel('disposed');
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.visual.traverse((object) => object.geometry?.dispose?.());
    this.materials.forEach((entry) => entry.dispose());
    this.debugRoot.traverse((object) => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
    this.visual.removeFromParent();
    this.debugRoot.removeFromParent();
  }
}

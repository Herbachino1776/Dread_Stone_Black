import * as THREE from 'three';
import { CollisionWorld } from '../Collision.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from './CombatPhysicsWorld.js';
import { HumanoidCombatActor } from './HumanoidCombatActor.js';
import { CombatBloodEffects } from './CombatBloodEffects.js';
import { CombatFeedbackSystem } from './CombatFeedbackSystem.js';
import { resolveCombatMortalityMode } from './CombatMortality.js';
import { MODEL_IDLE_COMBAT_PROFILE } from './HumanoidModelProfiles.js';

export class CombatLabScene {
  static async create(options = {}) {
    await initializeCombatPhysics();
    return new CombatLabScene(options);
  }

  constructor({ root = null, audioRuntime = null } = {}) {
    this.root = root;
    this.area = 'combat-lab';
    this.locationId = 'combat-lab';
    this.fieldSpawn = 'combat-lab-start';
    this.spawnId = 'combat-lab-start';
    this.isCombatLab = true;
    this.scene = new THREE.Scene();
    this.scene.name = 'physical-humanoid-combat-laboratory';
    this.scene.background = new THREE.Color(0x879098);
    this.scene.fog = new THREE.Fog(0x879098, 18, 48);
    this.playerSpawn = { spawnPosition: new THREE.Vector3(0, 1.55, -1.98), spawnYaw: Math.PI };
    this.collision = new CollisionWorld({
      walkableRects: [{ minX: -7.8, maxX: 7.8, minZ: -9.8, maxZ: 5.8 }],
      blockerRects: [{ minX: -3.05, maxX: -2.65, minZ: -6.7, maxZ: -1.1, type: 'combatLabWall' }],
      defaultFloorY: 0,
      sourceLocationId: 'combat-lab',
    });
    this.physics = new CombatPhysicsWorld();
    this.feedbackSystem = new CombatFeedbackSystem({ audioRuntime });
    this.weaponController = null;
    this.player = null;
    this.night = false;
    this.lightingMode = 'day';
    this.disposed = false;
    this.buildEnvironment();
    this.actor = new HumanoidCombatActor({ physics: this.physics, scene: this.scene, visualProfile: MODEL_IDLE_COMBAT_PROFILE, mortalityMode: resolveCombatMortalityMode(), eventSink: (event, payload) => this.handleCombatEvent(event, payload) });
    this.actor.setEnvironmentContactHints({ groundY: 0, wallX: -2.65 });
    this.bloodEffects = new CombatBloodEffects({ scene: this.scene, woundSystem: this.actor.woundSystem, physiology: this.actor.physiology, groundY: 0, wallX: -2.65, eventSink: (event, payload) => this.handleCombatEvent(event, payload) });
  }

  handleCombatEvent(event, payload = {}) {
    if (event === 'final_exhale') this.feedbackSystem.stopOwnerVocal('combat-actor');
    this.feedbackSystem.emit(event, { ...payload, owner: 'combat-actor' });
  }

  build() {
    return this.scene;
  }

  buildEnvironment() {
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x5c5a51, roughness: 0.98 });
    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x2e302f, roughness: 0.94 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4f45, roughness: 0.96 });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 16), groundMaterial);
    ground.name = 'combat-lab-flat-ground';
    ground.position.set(0, -0.1, -2);
    ground.receiveShadow = true;
    this.scene.add(ground);
    for (let value = -7; value <= 7; value += 1) {
      const lineX = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 16), lineMaterial);
      lineX.position.set(value, 0.008, -2);
      const lineZ = new THREE.Mesh(new THREE.BoxGeometry(16, 0.012, 0.012), lineMaterial);
      lineZ.position.set(0, 0.008, value - 2);
      this.scene.add(lineX, lineZ);
    }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.5, 5.6), wallMaterial);
    wall.name = 'combat-lab-body-contact-wall';
    wall.position.set(-2.85, 1.75, -3.9);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    this.physics.createFixedBox({ position: { x: 0, y: -0.1, z: -2 }, halfExtents: { x: 8, y: 0.1, z: 8 }, userData: { type: 'combat-lab-ground' } });
    this.physics.createFixedBox({ position: wall.position, halfExtents: { x: 0.2, y: 1.75, z: 2.8 }, userData: { type: 'combat-lab-wall' } });

    this.hemisphere = new THREE.HemisphereLight(0xc8d3dd, 0x39322c, 1.65);
    this.sun = new THREE.DirectionalLight(0xffe0bd, 2.6);
    this.sun.position.set(4, 8, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -7;
    this.sun.shadow.camera.right = 7;
    this.sun.shadow.camera.top = 7;
    this.sun.shadow.camera.bottom = -7;
    this.sun.target.position.set(0, 1, -3.5);
    this.scene.add(this.hemisphere, this.sun, this.sun.target);
    this.torch = new THREE.PointLight(0xff8a3a, 0, 8, 1.7);
    this.torch.position.set(1.5, 2, -1.8);
    this.torch.castShadow = false;
    this.scene.add(this.torch);
    this.lantern = new THREE.PointLight(0x9cc9ff, 0, 7.2, 1.75);
    this.lantern.position.set(1.1, 1.8, -2.1);
    this.lantern.castShadow = false;
    this.scene.add(this.lantern);
  }

  attachWeaponController(controller) {
    if (this.weaponController === controller) return;
    this.weaponController?.cancel?.('controller-replaced');
    this.weaponController = controller;
  }

  update(deltaSeconds, player = this.player) {
    if (this.disposed) return;
    this.player = player ?? this.player;
    this.actor.prepareFrame(deltaSeconds);
    this.physics.step(
      deltaSeconds,
      (dt) => {
        this.feedbackSystem.update(dt);
        this.weaponController?.beforePhysics?.(dt);
        this.actor.beforePhysics(dt, this.player?.position);
      },
      (dt) => {
        this.weaponController?.afterPhysicsStep?.(dt);
        this.bloodEffects.update(dt);
      },
    );
    this.actor.afterPhysics(this.physics.interpolationAlpha);
    this.weaponController?.afterPhysics?.(this.physics.interpolationAlpha);
  }

  updateOutdoorPresentation() {}
  resolvePlayerEyeHeight(_position, baseEyeHeight) { return baseEyeHeight; }
  setLanternRevealEmitterProvider() {}
  countOffLocationSceneObjects() { return 0; }
  countOffLocationCollisionEntries() { return 0; }

  setNight(enabled) {
    this.night = Boolean(enabled);
    this.scene.background.set(this.night ? 0x010204 : 0x879098);
    this.scene.fog.color.copy(this.scene.background);
    this.hemisphere.intensity = this.night ? 0.005 : 1.65;
    this.sun.intensity = this.night ? 0 : 2.6;
    this.torch.intensity = this.night ? 5.2 : 0;
  }

  setLightingMode(mode = 'day') {
    this.lightingMode = ['day', 'dusk', 'night-dark', 'night-torch', 'night-lantern'].includes(mode) ? mode : 'day';
    const night = this.lightingMode.startsWith('night');
    this.night = night;
    this.scene.background.set(night ? 0x010204 : this.lightingMode === 'dusk' ? 0x332b32 : 0x879098);
    this.scene.fog.color.copy(this.scene.background);
    this.hemisphere.intensity = night ? 0.005 : this.lightingMode === 'dusk' ? 0.34 : 1.65;
    this.sun.intensity = night ? 0 : this.lightingMode === 'dusk' ? 0.48 : 2.6;
    this.sun.color.set(this.lightingMode === 'dusk' ? 0xd17b64 : 0xffe0bd);
    this.torch.intensity = this.lightingMode === 'night-torch' ? 5.2 : 0;
    this.lantern.intensity = this.lightingMode === 'night-lantern' ? 4.4 : 0;
  }

  stepPhysics() {
    this.actor.prepareFrame(1 / 60);
    this.physics.stepSingle((dt) => { this.feedbackSystem.update(dt); this.weaponController?.beforePhysics?.(dt); this.actor.beforePhysics(dt, this.player?.position); }, (dt) => { this.weaponController?.afterPhysicsStep?.(dt); this.bloodEffects.update(dt); });
    this.actor.afterPhysics(0);
    this.weaponController?.afterPhysics?.(0);
  }

  clearWounds() { this.actor.woundSystem.clear(); }
  clearBlood() { this.bloodEffects.clear(); }
  toggleMortalityMode() {
    const next = this.actor.mortalityMode === 'normal' ? 'immortal_reactive' : 'normal';
    this.actor.setMortalityMode(next);
    return next;
  }

  setPhysicsPaused(paused) {
    this.physics.paused = Boolean(paused);
  }

  setPhysicsSlow(slow) {
    this.physics.timeScale = slow ? 0.2 : 1;
  }

  resetActor() {
    this.weaponController?.cancel?.('lab-reset');
    this.actor.reset();
    this.bloodEffects.clear();
    this.feedbackSystem.reset();
    this.weaponController?.reset?.();
  }

  getDiagnostics() {
    return { physics: this.physics.getDiagnostics(), actor: this.actor.getDiagnostics(), weapon: this.weaponController?.getDiagnostics?.() ?? null, blood: this.bloodEffects.getDiagnostics(), feedback: this.feedbackSystem.getDiagnostics() };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.weaponController?.cancel?.('scene-dispose');
    this.bloodEffects.dispose();
    this.feedbackSystem.dispose();
    this.actor.dispose();
    this.physics.dispose();
  }
}

import * as THREE from 'three';

function cloneMaterial(object) {
  if (!object?.material) return;
  object.material = object.material.clone();
  object.material.transparent = true;
}

export class BeneathFolsomWhiteScabRuntime {
  constructor({ scene, collision, compiledGroup, gameState, interactions = [] } = {}) {
    this.scene = scene;
    this.collision = collision;
    this.gameState = gameState;
    this.interactions = interactions;
    this.destroyed = Boolean(gameState?.isBeneathFolsomWhiteScabLowerKnotDestroyed?.());
    this.hitCount = this.destroyed ? 3 : 0;
    this.pulse = 0;
    this.recoil = this.destroyed ? 1 : 0;
    this.effects = [];
    this.knot = compiledGroup?.getObjectByName('beneath_folsom_white_scab_lower_knot') ?? null;
    this.cords = [0, 1, 2].map((index) => compiledGroup?.getObjectByName(`beneath_folsom_white_scab_lower_knot_cord_${index}`)).filter(Boolean);
    [this.knot, ...this.cords].forEach((object) => {
      cloneMaterial(object);
      object.userData.restPosition = object.position.clone();
      object.userData.restRotation = object.rotation.clone();
    });
    if (this.destroyed) this.applyDestroyedState();
  }

  strike({ hasKnife = false } = {}) {
    if (this.destroyed) return { changed: false, destroyed: true, message: 'Only cut cord ends remain. The impossible seal is still shut.' };
    if (!hasKnife) return { changed: false, destroyed: false, message: 'The exposed cords need a short cutting edge.' };
    this.hitCount += 1;
    this.pulse = 0.34;
    this.spawnOil(this.hitCount >= 3 ? 13 : 5);
    if (this.hitCount < 3) {
      return { changed: true, destroyed: false, message: this.hitCount === 1 ? 'The lower knot twists under the knife.' : 'The cord nest splits and pulls downward.' };
    }
    this.destroyed = true;
    this.recoil = 0.001;
    this.gameState?.markBeneathFolsomWhiteScabLowerKnotDestroyed?.();
    const interaction = this.interactions.find((candidate) => candidate.id === 'beneath_folsom_white_scab_lower_knot');
    if (interaction) interaction.collected = true;
    return { changed: true, destroyed: true, message: 'The lower cords tear backward into the earth. The impossible seal does not move.' };
  }

  applyDestroyedState() {
    if (this.knot) this.knot.visible = false;
    this.cords.forEach((cord, index) => {
      cord.position.copy(cord.userData.restPosition);
      cord.position.y -= 0.7 + index * 0.15;
      cord.position.z += 0.46;
      cord.rotation.z += index % 2 ? -0.58 : 0.55;
      cord.scale.x = 0.34;
      cord.material.opacity = 0.28;
    });
    const interaction = this.interactions.find((candidate) => candidate.id === 'beneath_folsom_white_scab_lower_knot');
    if (interaction) interaction.collected = true;
  }

  spawnOil(count) {
    if (!this.knot) return;
    const world = new THREE.Vector3();
    this.knot.getWorldPosition(world);
    for (let index = 0; index < count; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: index % 4 ? 0x171411 : 0x51483d, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide });
      const fleck = new THREE.Mesh(new THREE.PlaneGeometry(0.08 + Math.random() * 0.18, 0.12 + Math.random() * 0.24), material);
      fleck.position.copy(world).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.4) * 0.7, -0.35));
      this.scene?.add(fleck);
      this.effects.push({ object: fleck, life: 0.42 + Math.random() * 0.24, velocity: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.25 + Math.random() * 0.75, -0.15) });
    }
  }

  update(deltaSeconds) {
    const dt = Math.min(deltaSeconds, 0.05);
    if (this.pulse > 0 && this.knot) {
      this.pulse = Math.max(0, this.pulse - dt);
      const wave = Math.sin((1 - this.pulse / 0.34) * Math.PI * 4);
      this.knot.scale.set(1 + wave * 0.09, 1 - wave * 0.07, 1 + wave * 0.04);
      if (this.pulse === 0) this.knot.scale.set(1, 1, 1);
    }
    if (this.destroyed && this.recoil < 1) {
      this.recoil = Math.min(1, this.recoil + dt * 1.5);
      const eased = 1 - ((1 - this.recoil) ** 3);
      if (this.knot?.material) {
        this.knot.material.opacity = 1 - eased;
        this.knot.scale.setScalar(1 - eased * 0.65);
        if (eased >= 1) this.knot.visible = false;
      }
      this.cords.forEach((cord, index) => {
        cord.position.copy(cord.userData.restPosition);
        cord.position.y -= eased * (0.7 + index * 0.15);
        cord.position.z += eased * 0.46;
        cord.rotation.copy(cord.userData.restRotation);
        cord.rotation.z += eased * (index % 2 ? -0.58 : 0.55);
        cord.scale.x = 1 - eased * 0.66;
        cord.material.opacity = 1 - eased * 0.72;
      });
    }
    this.effects = this.effects.filter((effect) => {
      effect.life -= dt;
      if (effect.life <= 0) {
        this.scene?.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); return false;
      }
      effect.object.position.addScaledVector(effect.velocity, dt);
      effect.velocity.y -= dt * 2.4;
      effect.object.material.opacity = Math.min(0.88, effect.life / 0.18);
      return true;
    });
  }
}

export class UnderShrineLabyrinthEndHatchRuntime {
  constructor({ collision, compiledGroup, gameState, interactions = [] } = {}) {
    this.collision = collision;
    this.gameState = gameState;
    this.interactions = interactions;
    this.hatch = compiledGroup?.getObjectByName('under_shrine_labyrinth_end_hatch') ?? null;
    this.blocker = (collision?.blockerRects ?? []).find((candidate) => candidate.id === 'under_shrine_labyrinth_end_hatch_blocker') ?? null;
    this.open = Boolean(gameState?.isUnderShrineLabyrinthEndHatchOpen?.());
    this.progress = this.open ? 1 : 0;
    if (this.hatch) {
      this.hatch.userData.closedPosition = this.hatch.position.clone();
      this.hatch.userData.closedRotation = this.hatch.rotation.clone();
    }
    if (this.open) this.applyOpenState();
  }

  openHatch() {
    const changed = !this.open;
    this.open = true;
    this.gameState?.markUnderShrineLabyrinthEndHatchOpen?.();
    if (this.blocker) this.collision?.removeBlocker?.(this.blocker);
    return { changed, opened: true, message: changed ? 'The buried end hatch tears inward.' : 'The end hatch stands open behind the White-Scab threshold.' };
  }

  update(deltaSeconds) {
    if (!this.open || this.progress >= 1) return;
    this.progress = Math.min(1, this.progress + Math.min(deltaSeconds, 0.05) * 1.25);
    this.applyProgress(1 - ((1 - this.progress) ** 3));
  }

  applyProgress(progress) {
    if (!this.hatch?.userData.closedPosition) return;
    this.hatch.position.copy(this.hatch.userData.closedPosition);
    this.hatch.rotation.copy(this.hatch.userData.closedRotation);
    this.hatch.position.x += progress * 1.1;
    this.hatch.rotation.z -= progress * 1.18;
  }

  applyOpenState() {
    if (this.blocker) this.collision?.removeBlocker?.(this.blocker);
    this.applyProgress(1);
  }
}

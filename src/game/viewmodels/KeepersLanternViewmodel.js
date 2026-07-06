import * as THREE from 'three';

export const KEEPERS_LANTERN_ITEM_ID = 'keepers_lantern';
export const KEEPERS_LANTERN_VIEWMODEL_LAYER = 1;

export const KEEPERS_LANTERN_EMITTER = Object.freeze({
  coneAngleDegrees: 40,
  range: 4,
});

export const KEEPERS_LANTERN_LIGHTING = Object.freeze({
  point: Object.freeze({ color: 0xc8d1c8, intensity: 5.2, distance: 22, decay: 1.45 }),
  wash: Object.freeze({ color: 0xd8ddd4, intensity: 6.6, distance: 34, angle: 0.82, penumbra: 0.88, decay: 1.35 }),
});

const REST_POSITION = Object.freeze({ x: -0.48, y: -0.38, z: -1.08 });
const MAX_SWAY_X = THREE.MathUtils.degToRad(7);
const MAX_SWAY_Y = THREE.MathUtils.degToRad(5);
const MAX_SWAY_Z = THREE.MathUtils.degToRad(8);
const screenPoint = new THREE.Vector3();

function material(color, roughness, metalness = 0, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

function addCylinder(group, radiusTop, radiusBottom, height, materialValue, position, name, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), materialValue);
  mesh.position.set(position.x, position.y, position.z);
  mesh.name = name;
  group.add(mesh);
  return mesh;
}

function markViewmodel(object) {
  object.traverse((child) => {
    child.layers?.set?.(KEEPERS_LANTERN_VIEWMODEL_LAYER);
    if (!child.isMesh) return;
    child.renderOrder = 10010;
    child.castShadow = false;
    child.receiveShadow = false;
    child.userData = { ...child.userData, keepersLanternViewmodel: true };
  });
}

export class KeepersLanternViewmodel {
  constructor({ camera, equipmentRuntime, player = null } = {}) {
    this.camera = camera;
    this.equipmentRuntime = equipmentRuntime;
    this.player = player;
    this.elapsed = 0;
    this.walkAmount = 0;
    this.sway = new THREE.Euler(0, 0, 0, 'YXZ');
    this.previousCameraPosition = new THREE.Vector3();
    this.previousCameraQuaternion = new THREE.Quaternion();
    this.previousInverseQuaternion = new THREE.Quaternion();
    this.localVelocity = new THREE.Vector3();
    this.turnDelta = new THREE.Quaternion();
    this.turnEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.inverseCameraQuaternion = new THREE.Quaternion();
    this.hasPreviousPose = false;
    this.emitterWorldPosition = new THREE.Vector3();
    this.emitterWorldDirection = new THREE.Vector3(0, 0, -1);
    this.aim = { x: 0, y: 0 };

    this.root = new THREE.Group();
    this.root.name = 'keepers-lantern-first-person-viewmodel';
    this.root.position.set(REST_POSITION.x, REST_POSITION.y, REST_POSITION.z);
    this.root.visible = false;

    this.aimPivot = new THREE.Group();
    this.aimPivot.name = 'keepers-lantern-aim-pivot';
    this.root.add(this.aimPivot);

    this.handlePivot = new THREE.Group();
    this.handlePivot.name = 'keepers-lantern-handle-pivot';
    this.aimPivot.add(this.handlePivot);

    this.hangingBody = new THREE.Group();
    this.hangingBody.name = 'keepers-lantern-hanging-body';
    this.hangingBody.position.set(0, -0.19, 0);
    this.handlePivot.add(this.hangingBody);

    this.buildProceduralLantern();
    markViewmodel(this.root);

    // The meshes remain an overlay, while both shadowless lights illuminate the
    // world layer. Glyph visibility is still gated separately by the reveal runtime.
    this.coldLight.layers.set(0);
    this.coldRevealSpotLight.layers.set(0);
    this.camera?.add?.(this.root);
  }

  buildProceduralLantern() {
    const darkMetal = material(0x252b2c, 0.72, 0.58);
    const wornMetal = material(0x465153, 0.78, 0.38);
    const glass = material(0xa9ccca, 0.32, 0.08, 0x8fc7c5, 1.5);

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 14, Math.PI), darkMetal);
    handle.name = 'keepers-lantern-short-handle';
    handle.rotation.z = Math.PI;
    handle.position.y = 0.02;
    this.handlePivot.add(handle);

    for (let index = 0; index < 3; index += 1) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 5, 9), wornMetal);
      link.name = `keepers-lantern-chain-link-${index}`;
      link.rotation.y = index % 2 ? Math.PI / 2 : 0;
      link.position.y = 0.02 - index * 0.055;
      this.handlePivot.add(link);
    }

    addCylinder(this.hangingBody, 0.13, 0.15, 0.055, darkMetal, { x: 0, y: 0.12, z: 0 }, 'keepers-lantern-cage-top');
    addCylinder(this.hangingBody, 0.145, 0.17, 0.065, darkMetal, { x: 0, y: -0.16, z: 0 }, 'keepers-lantern-cage-base');
    addCylinder(this.hangingBody, 0.105, 0.125, 0.24, glass, { x: 0, y: -0.02, z: 0 }, 'keepers-lantern-clouded-glass', 12);

    [-1, 1].forEach((side) => {
      const rail = addCylinder(this.hangingBody, 0.012, 0.012, 0.29, wornMetal, { x: side * 0.12, y: -0.02, z: 0 }, `keepers-lantern-cage-rail-${side}`);
      rail.rotation.z = side * -0.08;
    });

    this.emitterTransform = new THREE.Object3D();
    this.emitterTransform.name = 'keepers-lantern-emitter-transform';
    this.emitterTransform.position.set(0, -0.015, -0.09);
    this.emitterTransform.rotation.y = Math.PI;
    this.hangingBody.add(this.emitterTransform);

    this.coldLight = new THREE.PointLight(
      KEEPERS_LANTERN_LIGHTING.point.color,
      KEEPERS_LANTERN_LIGHTING.point.intensity,
      KEEPERS_LANTERN_LIGHTING.point.distance,
      KEEPERS_LANTERN_LIGHTING.point.decay,
    );
    this.coldLight.name = 'keepers-lantern-cold-pale-light';
    this.coldLight.castShadow = false;
    this.emitterTransform.add(this.coldLight);

    this.coldRevealSpotLight = new THREE.SpotLight(
      KEEPERS_LANTERN_LIGHTING.wash.color,
      KEEPERS_LANTERN_LIGHTING.wash.intensity,
      KEEPERS_LANTERN_LIGHTING.wash.distance,
      KEEPERS_LANTERN_LIGHTING.wash.angle,
      KEEPERS_LANTERN_LIGHTING.wash.penumbra,
      KEEPERS_LANTERN_LIGHTING.wash.decay,
    );
    this.coldRevealSpotLight.name = 'keepers-lantern-focused-reveal-light';
    this.coldRevealSpotLight.castShadow = false;
    this.coldRevealSpotLight.target.position.set(0, 0, 2);
    this.emitterTransform.add(this.coldRevealSpotLight, this.coldRevealSpotLight.target);
  }

  rebind({ camera = this.camera, player = this.player } = {}) {
    if (camera !== this.camera) {
      this.camera?.remove?.(this.root);
      this.camera = camera;
      this.camera?.add?.(this.root);
      this.hasPreviousPose = false;
    }
    this.player = player;
  }

  isActive() {
    return this.equipmentRuntime?.getEquippedOffhandId?.() === KEEPERS_LANTERN_ITEM_ID;
  }

  setAimState(state = {}) {
    this.aim.x = Number(state.x) || 0;
    this.aim.y = Number(state.y) || 0;
  }

  update(deltaSeconds) {
    const active = this.isActive();
    this.root.visible = active;
    if (!active || !this.camera) {
      this.hasPreviousPose = false;
      return;
    }

    const dt = THREE.MathUtils.clamp(deltaSeconds, 0.001, 0.05);
    this.elapsed += dt;
    this.camera.updateMatrixWorld(true);
    this.camera.getWorldPosition(this.emitterWorldPosition);
    this.camera.getWorldQuaternion(this.turnDelta);

    if (!this.hasPreviousPose) {
      this.previousCameraPosition.copy(this.emitterWorldPosition);
      this.previousCameraQuaternion.copy(this.turnDelta);
      this.hasPreviousPose = true;
    }

    this.localVelocity.copy(this.emitterWorldPosition).sub(this.previousCameraPosition).divideScalar(dt);
    this.localVelocity.clampLength(0, 10);
    this.inverseCameraQuaternion.copy(this.turnDelta).invert();
    this.localVelocity.applyQuaternion(this.inverseCameraQuaternion);

    this.previousInverseQuaternion.copy(this.previousCameraQuaternion).invert();
    this.turnDelta.premultiply(this.previousInverseQuaternion);
    this.turnEuler.setFromQuaternion(this.turnDelta, 'YXZ');
    const turnRate = THREE.MathUtils.clamp(this.turnEuler.y / dt, -4, 4);
    const speed = Math.min(1, Math.hypot(this.localVelocity.x, this.localVelocity.z) / 2.6);
    this.walkAmount = THREE.MathUtils.lerp(this.walkAmount, speed, 1 - Math.exp(-7 * dt));

    const targetX = THREE.MathUtils.clamp(this.localVelocity.z * 0.018, -MAX_SWAY_X, MAX_SWAY_X);
    const targetY = THREE.MathUtils.clamp(-turnRate * 0.022, -MAX_SWAY_Y, MAX_SWAY_Y);
    const targetZ = THREE.MathUtils.clamp(-this.localVelocity.x * 0.024 - turnRate * 0.018, -MAX_SWAY_Z, MAX_SWAY_Z);
    const follow = 1 - Math.exp(-7.5 * dt);
    this.sway.x = THREE.MathUtils.lerp(this.sway.x, targetX, follow);
    this.sway.y = THREE.MathUtils.lerp(this.sway.y, targetY, follow);
    this.sway.z = THREE.MathUtils.lerp(this.sway.z, targetZ, follow);

    const bob = Math.sin(this.elapsed * 7.2) * 0.012 * this.walkAmount;
    this.root.position.set(REST_POSITION.x + this.aim.x * 0.13, REST_POSITION.y + bob + this.aim.y * 0.1, REST_POSITION.z);
    this.aimPivot.rotation.set(-this.aim.y * 0.23, -this.aim.x * 0.3, 0, 'YXZ');
    this.hangingBody.rotation.set(this.sway.x, this.sway.y, this.sway.z, 'YXZ');

    this.previousCameraPosition.copy(this.emitterWorldPosition);
    this.camera.getWorldQuaternion(this.previousCameraQuaternion);
    this.updateEmitterWorldTransform();
  }

  updateEmitterWorldTransform() {
    this.root.updateWorldMatrix(true, true);
    this.emitterTransform.getWorldPosition(this.emitterWorldPosition);
    this.emitterTransform.getWorldDirection(this.emitterWorldDirection).normalize();
  }

  getEmitterState({ worldPosition = new THREE.Vector3(), worldDirection = new THREE.Vector3() } = {}) {
    const active = this.isActive() && this.root.visible && Boolean(this.emitterTransform?.parent);
    if (active) this.updateEmitterWorldTransform();
    return {
      active,
      available: Boolean(this.emitterTransform?.parent),
      itemId: KEEPERS_LANTERN_ITEM_ID,
      worldPosition: worldPosition.copy(this.emitterWorldPosition),
      worldDirection: worldDirection.copy(this.emitterWorldDirection),
      coneAngleDegrees: KEEPERS_LANTERN_EMITTER.coneAngleDegrees,
      range: KEEPERS_LANTERN_EMITTER.range,
      source: 'keepers-lantern-emitter-transform',
    };
  }

  projectAimHit(clientX, clientY, viewport) {
    if (!this.isActive() || !this.root.visible || !viewport) return false;
    this.camera.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
    const rect = viewport.getBoundingClientRect();
    this.emitterTransform.getWorldPosition(screenPoint).project(this.camera);
    const x = (screenPoint.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-screenPoint.y * 0.5 + 0.5) * rect.height + rect.top;
    const radius = Math.max(70, Math.min(115, Math.min(rect.width, rect.height) * 0.18));
    return screenPoint.z >= -1 && screenPoint.z <= 1 && Math.hypot(clientX - x, clientY - y) <= radius;
  }

  dispose() {
    this.camera?.remove?.(this.root);
    this.root.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((entry) => entry?.dispose?.());
      else child.material?.dispose?.();
    });
    this.root.clear();
    this.root.visible = false;
    this.player = null;
    this.camera = null;
  }
}

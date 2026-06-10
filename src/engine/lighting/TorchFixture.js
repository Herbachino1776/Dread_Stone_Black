import * as THREE from 'three';
import { resolveTorchLightingProfile } from './TorchLightingProfile.js';

const GEOMETRIES = {
  wallPlate: new THREE.BoxGeometry(0.28, 0.34, 0.08),
  bracketArm: new THREE.BoxGeometry(0.12, 0.12, 0.38),
  shaft: new THREE.CylinderGeometry(0.045, 0.06, 0.62, 8),
  flameOuter: new THREE.SphereGeometry(0.18, 10, 8),
  flameInner: new THREE.SphereGeometry(0.1, 8, 6),
  glow: new THREE.SphereGeometry(0.42, 12, 8),
};

const MATERIALS = {
  bracket: new THREE.MeshStandardMaterial({
    color: 0x2a211b,
    roughness: 0.78,
    metalness: 0.48,
    emissive: 0x100a06,
    emissiveIntensity: 0.08,
  }),
  shaft: new THREE.MeshStandardMaterial({
    color: 0x5a3420,
    roughness: 0.92,
    metalness: 0.08,
    emissive: 0x160b05,
    emissiveIntensity: 0.1,
  }),
  flameOuter: new THREE.MeshBasicMaterial({
    color: 0xff8b35,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  }),
  flameInner: new THREE.MeshBasicMaterial({
    color: 0xffd58a,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  }),
};

function toVector3(value, fallbackY = 0) {
  if (value instanceof THREE.Vector3) return value.clone();
  return new THREE.Vector3(
    Number(value?.x ?? value?.[0] ?? 0),
    Number(value?.y ?? value?.[1] ?? fallbackY),
    Number(value?.z ?? value?.[2] ?? 0),
  );
}

function yawFromNormal(normal) {
  return Math.atan2(normal.x, normal.z);
}

export class TorchFixture {
  constructor(descriptor = {}) {
    this.descriptor = descriptor;
    this.profile = resolveTorchLightingProfile(descriptor.profile ?? descriptor.lightingProfile, descriptor.lighting ?? {});
    this.position = toVector3(descriptor.position, descriptor.height ?? 1.7);
    this.wallNormal = toVector3(descriptor.wallNormal ?? descriptor.normal ?? { x: 0, y: 0, z: 1 });
    this.wallNormal.y = 0;
    if (this.wallNormal.lengthSq() < 0.0001) this.wallNormal.set(0, 0, 1);
    this.wallNormal.normalize();
    this.yaw = Number.isFinite(descriptor.yaw) ? descriptor.yaw : yawFromNormal(this.wallNormal);
    this.group = this.buildGroup();
  }

  buildGroup() {
    const group = new THREE.Group();
    group.name = this.descriptor.id ?? 'torch-fixture';
    group.position.copy(this.position);
    group.rotation.y = this.yaw;
    group.userData = {
      ...group.userData,
      fixtureType: 'torch',
      torchFixtureId: this.descriptor.id,
      locationId: this.descriptor.locationId,
      roomId: this.descriptor.roomId,
      wallSide: this.descriptor.wallSide,
      wallNormal: { x: this.wallNormal.x, y: this.wallNormal.y, z: this.wallNormal.z },
      lightingProfile: this.profile.id,
      generatedBy: 'TorchFixture',
    };

    const wallPlate = new THREE.Mesh(GEOMETRIES.wallPlate, MATERIALS.bracket);
    wallPlate.name = `${group.name}-wall-plate`;
    wallPlate.position.set(0, 0, -0.035);
    group.add(wallPlate);

    const bracketArm = new THREE.Mesh(GEOMETRIES.bracketArm, MATERIALS.bracket);
    bracketArm.name = `${group.name}-bracket-arm`;
    bracketArm.position.set(0, -0.03, 0.18);
    group.add(bracketArm);

    const shaft = new THREE.Mesh(GEOMETRIES.shaft, MATERIALS.shaft);
    shaft.name = `${group.name}-short-shaft`;
    shaft.rotation.x = Math.PI / 2.85;
    shaft.position.set(0, -0.12, 0.43);
    group.add(shaft);

    const flame = new THREE.Group();
    flame.name = `${group.name}-flame`;
    flame.position.set(0, 0.14, 0.68);
    group.add(flame);

    const flameOuter = new THREE.Mesh(GEOMETRIES.flameOuter, MATERIALS.flameOuter.clone());
    flameOuter.name = `${group.name}-flame-outer`;
    flameOuter.scale.set(0.72, 1.25, 0.72);
    flame.add(flameOuter);

    const flameInner = new THREE.Mesh(GEOMETRIES.flameInner, MATERIALS.flameInner.clone());
    flameInner.name = `${group.name}-flame-inner`;
    flameInner.position.y = 0.04;
    flameInner.scale.set(0.74, 1.12, 0.74);
    flame.add(flameInner);

    let glowMesh = null;
    if ((this.profile.glowOpacity ?? 0) > 0) {
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: this.profile.color,
        transparent: true,
        opacity: this.profile.glowOpacity,
        depthWrite: false,
      });
      glowMesh = new THREE.Mesh(GEOMETRIES.glow, glowMaterial);
      glowMesh.name = `${group.name}-soft-glow`;
      glowMesh.position.copy(flame.position);
      glowMesh.scale.set(1, 0.82, 1);
      group.add(glowMesh);
    }

    const pointLight = new THREE.PointLight(
      this.profile.color,
      this.profile.intensity,
      this.profile.distance,
      this.profile.decay,
    );
    pointLight.name = `${group.name}-point-light`;
    pointLight.position.copy(flame.position);
    pointLight.castShadow = false;
    if (this.descriptor.lightEnabled === false) {
      pointLight.visible = false;
      pointLight.intensity = 0;
      pointLight.distance = 0;
    }
    group.add(pointLight);

    group.userData.torchFixture = {
      id: this.descriptor.id,
      pointLight,
      flame,
      flameOuter,
      flameInner,
      glowMesh,
      baseIntensity: pointLight.intensity,
      baseDistance: pointLight.distance,
      baseOuterOpacity: flameOuter.material.opacity,
      baseInnerOpacity: flameInner.material.opacity,
      baseGlowOpacity: glowMesh?.material?.opacity ?? 0,
      profile: this.profile,
      phase: this.descriptor.flickerPhase ?? 0,
      enabled: this.descriptor.lightEnabled !== false,
    };

    return group;
  }
}

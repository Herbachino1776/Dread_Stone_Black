import * as THREE from 'three';

export const OUTDOOR_SKY_TEXTURES = Object.freeze({
  day: './assets/textures/sky/sunny_noon_skybox_folsom_01.png',
  red: './assets/textures/sky/red_morning_skybox_folsom_retro_02.png',
  night: './assets/textures/sky/night_skybox_folsom_01.png',
});

function configure(texture, anisotropy = 1) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = Math.max(1, Math.min(2, anisotropy));
  return texture;
}

export class OutdoorSkyCycleRuntime {
  constructor({ scene, textureLoader, clock, radius = 700, anisotropy = 1 } = {}) {
    this.scene = scene; this.clock = clock;
    this.textures = {
      day: configure(textureLoader.load(OUTDOOR_SKY_TEXTURES.day), anisotropy),
      red: configure(textureLoader.load(OUTDOOR_SKY_TEXTURES.red), anisotropy),
      night: configure(textureLoader.load(OUTDOOR_SKY_TEXTURES.night), anisotropy),
    };
    this.uniforms = {
      dayMap: { value: this.textures.day }, redMap: { value: this.textures.red }, nightMap: { value: this.textures.night },
      skyWeights: { value: new THREE.Vector3(1, 0, 0) }, rotationOffset: { value: 0 }, redOrientation: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      name: 'outdoor-shared-three-texture-sky-cycle-material', side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: true,
      uniforms: this.uniforms,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D dayMap; uniform sampler2D redMap; uniform sampler2D nightMap; uniform vec3 skyWeights; uniform float rotationOffset; uniform float redOrientation; varying vec2 vUv;
        vec2 skyUv(float extra){ return vec2(fract(vUv.x + (rotationOffset + extra) / 6.28318530718), clamp(vUv.y, 0.001, 0.999)); }
        void main(){ vec3 day=texture2D(dayMap,skyUv(0.0)).rgb; vec3 red=texture2D(redMap,skyUv(redOrientation)).rgb; vec3 night=texture2D(nightMap,skyUv(0.0)).rgb; gl_FragColor=vec4(day*skyWeights.x+red*skyWeights.y+night*skyWeights.z,1.0); #include <tonemapping_fragment> #include <colorspace_fragment> }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 20), this.material);
    this.mesh.name = 'outdoor-shared-single-sky-cycle-sphere'; this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false; this.mesh.userData = { kind: 'outdoorSkyCycle', oneSkyMesh: true, followPlayerXZ: true, texturePaths: OUTDOOR_SKY_TEXTURES };
    scene.add(this.mesh); this.update();
  }

  update(player = null) {
    const state = this.clock.getSnapshot();
    this.uniforms.skyWeights.value.set(state.dayWeight, state.redWeight, state.nightWeight);
    this.uniforms.rotationOffset.value = state.skyRotation; this.uniforms.redOrientation.value = state.redOrientation;
    if (player?.position) this.mesh.position.set(player.position.x, 0, player.position.z);
    this.mesh.userData.clockState = state; return state;
  }

  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.material.dispose(); Object.values(this.textures).forEach((texture) => texture.dispose()); }
}

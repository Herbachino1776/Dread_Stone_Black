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
  constructor({ scene, textureLoader, clock, radius = 160, anisotropy = 1 } = {}) {
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
    this.material = new THREE.MeshBasicMaterial({name:'outdoor-shared-three-texture-sky-cycle-material',map:this.textures.day,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,toneMapped:true});
    this.material.onBeforeCompile=(shader)=>{Object.assign(shader.uniforms,this.uniforms);shader.vertexShader=`varying vec2 vSkyUv;\n${shader.vertexShader}`.replace('#include <uv_vertex>','#include <uv_vertex>\nvSkyUv=uv;');shader.fragmentShader=`uniform sampler2D redMap;uniform sampler2D nightMap;uniform vec3 skyWeights;uniform float rotationOffset;uniform float redOrientation;varying vec2 vSkyUv;\n${shader.fragmentShader}`.replace('#include <map_fragment>',`vec2 dayUv=vec2(fract(vSkyUv.x+rotationOffset/6.28318530718),clamp(vSkyUv.y,.001,.999));vec2 redUv=vec2(fract(vSkyUv.x+(rotationOffset+redOrientation)/6.28318530718),clamp(vSkyUv.y,.001,.999));vec4 sampledDiffuseColor=vec4(texture2D(map,dayUv).rgb*skyWeights.x+texture2D(redMap,redUv).rgb*skyWeights.y+texture2D(nightMap,dayUv).rgb*skyWeights.z,1.0);diffuseColor*=sampledDiffuseColor;`);this.material.userData.shader=shader;};
    this.material.customProgramCacheKey=()=> 'dsb-three-texture-sky-v2';
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 20), this.material);
    this.mesh.name = 'outdoor-shared-single-sky-cycle-sphere'; this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false; this.mesh.userData = { kind: 'outdoorSkyCycle', oneSkyMesh: true, followPlayerXZ: true, texturePaths: OUTDOOR_SKY_TEXTURES };
    scene.add(this.mesh); this.update();
  }

  update(player = null) {
    const state = this.clock.getSnapshot();
    this.uniforms.skyWeights.value.set(state.dayWeight, state.redWeight, state.nightWeight);
    this.uniforms.rotationOffset.value = state.skyRotation; this.uniforms.redOrientation.value = state.redOrientation;
    // The panorama remains readable independently of terrain illumination.
    const brightness = state.dayWeight + state.redWeight * 0.76 + state.nightWeight * 0.62;
    this.material.color.setScalar(THREE.MathUtils.clamp(brightness, 0.6, 1));
    if (player?.position) this.mesh.position.set(player.position.x, 0, player.position.z);
    this.mesh.userData.clockState = state; return state;
  }

  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.material.dispose(); Object.values(this.textures).forEach((texture) => texture.dispose()); }
}

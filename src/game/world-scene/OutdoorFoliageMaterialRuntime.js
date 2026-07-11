import * as THREE from 'three';

export function createOutdoorFoliageMaterial(map, { alphaTest = 0.48, name = 'outdoor-foliage' } = {}) {
  const material = new THREE.MeshLambertMaterial({
    name,
    map,
    color: 0xffffff,
    alphaTest,
    side: THREE.DoubleSide,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    fog: true,
    toneMapped: true,
  });
  material.userData = {
    outdoorFoliage: { baseColor: new THREE.Color(0xffffff) },
    authoredFoliageAlphaCutout: true,
    occludesTransparentWater: true,
  };
  return material;
}

export function updateOutdoorFoliageMaterial(material, lighting) {
  if (!material?.userData?.outdoorFoliage) return;
  const brightness = THREE.MathUtils.clamp(0.78 + lighting.hemi * 0.2 + lighting.keyIntensity * 0.03, 0.78, 1.02);
  material.color.setRGB(brightness, brightness, brightness).lerp(lighting.sky, 0.045);
}

export function createFoliageContactMaterial() {
  const material = new THREE.ShaderMaterial({
    name: 'outdoor-pooled-root-contact-material',
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    uniforms: { intensity: { value: 0.12 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float intensity; varying vec2 vUv; void main(){ float d=length(vUv-.5)*2.; float a=smoothstep(1.,.12,d)*intensity; gl_FragColor=vec4(.035,.028,.022,a); }',
  });
  material.userData = { outdoorFoliageContact: true };
  return material;
}

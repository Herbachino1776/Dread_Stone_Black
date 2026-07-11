import * as THREE from 'three';
import { updateOutdoorWaterMaterial } from './OutdoorWaterMaterialRuntime.js';
import { updateOutdoorFoliageMaterial } from './OutdoorFoliageMaterialRuntime.js';

export const OUTDOOR_LIGHTING_PROFILES = Object.freeze({
  noon: { sky: 0xb9d5ef, ground: 0x706b55, hemi: 0.9, key: 0xffe8be, keyIntensity: 1.12, moon: 0x9eb9df, moonIntensity: 0, fog: 0xb5c7cd, fogNear: 105, fogFar: 470, exposure: 1.0, elevation: 0.82 },
  dusk: { sky: 0xb06e62, ground: 0x4b3c36, hemi: 0.55, key: 0xffa06b, keyIntensity: 0.7, moon: 0xa9c8ed, moonIntensity: 0.08, fog: 0x9a6c62, fogNear: 90, fogFar: 410, exposure: 0.94, elevation: 0.22 },
  night: { sky: 0x344861, ground: 0x242a2d, hemi: 0.34, key: 0x9dbce5, keyIntensity: 0.02, moon: 0xa9c9f0, moonIntensity: 0.48, fog: 0x344652, fogNear: 86, fogFar: 390, exposure: 1.04, elevation: -0.18 },
  dawn: { sky: 0x9c7774, ground: 0x4b403a, hemi: 0.52, key: 0xffb77c, keyIntensity: 0.62, moon: 0xa9c8ed, moonIntensity: 0.12, fog: 0x927875, fogNear: 92, fogFar: 415, exposure: 0.97, elevation: 0.18 },
});

const KEYFRAMES = Object.freeze([[0, 'noon'], [0.3, 'noon'], [0.4, 'dusk'], [0.5, 'night'], [0.8, 'night'], [0.9, 'dawn'], [1, 'noon']]);
const smooth = (x) => { const t=Math.max(0,Math.min(1,x)); return t*t*(3-2*t); };
function blendProfile(a, b, t) {
  const result = {}; const u=smooth(t);
  ['hemi','keyIntensity','moonIntensity','fogNear','fogFar','exposure','elevation'].forEach((key)=>{ result[key]=THREE.MathUtils.lerp(a[key],b[key],u); });
  ['sky','ground','key','moon','fog'].forEach((key)=>{ result[key]=new THREE.Color(a[key]).lerp(new THREE.Color(b[key]),u); });
  return result;
}
export function resolveOutdoorLightingProfile(phase) {
  const p=((phase%1)+1)%1; let left=KEYFRAMES[0]; let right=KEYFRAMES.at(-1);
  for(let i=0;i<KEYFRAMES.length-1;i+=1) if(p>=KEYFRAMES[i][0]&&p<=KEYFRAMES[i+1][0]) { left=KEYFRAMES[i];right=KEYFRAMES[i+1];break; }
  return blendProfile(OUTDOOR_LIGHTING_PROFILES[left[1]],OUTDOOR_LIGHTING_PROFILES[right[1]],(p-left[0])/Math.max(0.0001,right[0]-left[0]));
}

export class OutdoorLightingDirector {
  constructor({ scene, clock, qualityTier = 'mobile-balanced' } = {}) {
    this.scene=scene; this.clock=clock; this.qualityTier=qualityTier;
    this.hemisphere=new THREE.HemisphereLight(); this.hemisphere.name='outdoor-cycle-hemisphere-light';
    this.key=new THREE.DirectionalLight(); this.key.name='outdoor-cycle-primary-directional-light'; this.key.castShadow=true;
    this.moon=new THREE.DirectionalLight(); this.moon.name='outdoor-cycle-moon-fill'; this.moon.castShadow=false;
    const high=qualityTier==='desktop-high'; this.shadowMapSize=high?2048:1024; this.shadowRadius=high?72:52;
    this.key.shadow.mapSize.set(this.shadowMapSize,this.shadowMapSize); this.key.shadow.camera.near=3; this.key.shadow.camera.far=210;
    this.key.shadow.bias=-0.00016; this.key.shadow.normalBias=0.035; this.key.shadow.radius=1.5;
    scene.add(this.hemisphere,this.key,this.key.target,this.moon,this.moon.target);
    if (!(scene.fog instanceof THREE.Fog)) scene.fog=new THREE.Fog(0xb5c7cd,105,470);
    scene.userData.outdoorLightingDirector={ qualityTier, shadowMapSize:this.shadowMapSize, primaryShadowCasters:1 };
    this.waterMaterials=[];this.foliageMaterials=[];this.contactMaterials=[];
    const debugTokens=new Set((globalThis.location?new URLSearchParams(globalThis.location.search).get('debug')??'':'').split(','));if(globalThis.document&&(debugTokens.has('outdoor-lighting')||debugTokens.has('outdoor-shadows'))){this.debugPanel=document.querySelector('[data-outdoor-presentation-debug]')??document.body.appendChild(document.createElement('pre'));this.debugPanel.dataset.outdoorPresentationDebug='true';this.debugPanel.style.cssText='position:fixed;left:8px;top:8px;z-index:9999;max-width:440px;padding:8px;background:#071018dd;color:#bfe8ff;font:11px/1.35 monospace;pointer-events:none;white-space:pre-wrap';}
  }
  bindSceneMaterials(){const water=new Set(),foliage=new Set(),contacts=new Set();this.scene.traverse(object=>{const materials=Array.isArray(object.material)?object.material:[object.material];materials.filter(Boolean).forEach(material=>{if(material.userData?.outdoorWater)water.add(material);if(material.userData?.outdoorFoliage)foliage.add(material);if(material.userData?.outdoorFoliageContact)contacts.add(material);});});this.waterMaterials=[...water];this.foliageMaterials=[...foliage];this.contactMaterials=[...contacts];Object.assign(this.scene.userData.outdoorLightingDirector,{waterMaterialCount:this.waterMaterials.length,foliageMaterialCount:this.foliageMaterials.length,contactMaterialCount:this.contactMaterials.length});}
  update(player=null) {
    const state=this.clock.getSnapshot(); const p=resolveOutdoorLightingProfile(state.phase);
    this.hemisphere.color.copy(p.sky); this.hemisphere.groundColor.copy(p.ground); this.hemisphere.intensity=p.hemi;
    this.key.color.copy(p.key); this.key.intensity=p.keyIntensity; this.moon.color.copy(p.moon); this.moon.intensity=p.moonIntensity;
    this.scene.fog.color.copy(p.fog); this.scene.fog.near=p.fogNear; this.scene.fog.far=p.fogFar; this.scene.background=p.fog.clone();
    const angle=state.skyRotation+state.phase*Math.PI*2; const center=player?.position ?? {x:0,y:0,z:0};
    const texel=(this.shadowRadius*2)/this.shadowMapSize; const cx=Math.round(center.x/texel)*texel; const cz=Math.round(center.z/texel)*texel;
    const horizontal=95*Math.cos(p.elevation); this.key.position.set(cx+Math.sin(angle)*horizontal,25+Math.max(0,p.elevation)*100,cz+Math.cos(angle)*horizontal);
    this.key.target.position.set(cx,center.y??0,cz); this.moon.position.set(cx-Math.sin(angle)*80,65,cz-Math.cos(angle)*80); this.moon.target.position.copy(this.key.target.position);
    const camera=this.key.shadow.camera; camera.left=camera.bottom=-this.shadowRadius; camera.right=camera.top=this.shadowRadius; camera.updateProjectionMatrix();
    this.key.target.updateMatrixWorld(); this.moon.target.updateMatrixWorld();
    this.waterMaterials.forEach(material=>updateOutdoorWaterMaterial(material,p,state));
    this.foliageMaterials.forEach(material=>updateOutdoorFoliageMaterial(material,p));this.contactMaterials.forEach(material=>{material.uniforms.intensity.value=.035+.105*Math.max(p.keyIntensity,p.moonIntensity*.45);});
    this.exposure=p.exposure; this.debug={...state, exposure:p.exposure, fogNear:p.fogNear, fogFar:p.fogFar, shadowMapSize:this.shadowMapSize, shadowRadius:this.shadowRadius, texelSize:texel, snappedCenter:{x:cx,z:cz},waterMaterialCount:this.waterMaterials.length};if(this.debugPanel)this.debugPanel.textContent=`OUTDOOR ${state.name.toUpperCase()} phase ${state.phase.toFixed(4)}\nsky d/r/n ${state.dayWeight.toFixed(2)} ${state.redWeight.toFixed(2)} ${state.nightWeight.toFixed(2)} rot ${state.skyRotation.toFixed(3)}\nkey ${p.keyIntensity.toFixed(2)} moon ${p.moonIntensity.toFixed(2)} hemi ${p.hemi.toFixed(2)}\nfog ${p.fogNear.toFixed(0)}–${p.fogFar.toFixed(0)} exposure ${p.exposure.toFixed(2)}\nshadow ${this.shadowMapSize}px radius ${this.shadowRadius} texel ${texel.toFixed(3)}\ncenter ${cx.toFixed(2)}, ${cz.toFixed(2)} casters 1\nwater mats ${this.waterMaterials.length} foliage mats ${this.foliageMaterials.length}`;return this.debug;
  }
}

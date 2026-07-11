import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFoliageContactMaterial, createOutdoorFoliageMaterial, updateOutdoorFoliageMaterial } from '../src/game/world-scene/OutdoorFoliageMaterialRuntime.js';

const map = new THREE.Texture();
const material = createOutdoorFoliageMaterial(map, { alphaTest: 0.48 });
assert.equal(material.map, map);
assert.equal(material.transparent, false);
assert.equal(material.depthWrite, true);
assert.equal(material.alphaTest, 0.48);
assert.equal(material.isMeshLambertMaterial, true, 'foliage must receive torch and moon lighting');
updateOutdoorFoliageMaterial(material, { sky: new THREE.Color(0x081018), hemi: 0.025, keyIntensity: 0 });
assert.ok(material.color.r > 0.7 && material.color.g > 0.7 && material.color.b > 0.7, 'material tint must preserve source color when a torch reaches it');
const contact = createFoliageContactMaterial();
assert.equal(contact.depthWrite, false);
assert.ok(contact.uniforms.intensity.value < 0.2);
console.log('Outdoor foliage material: source map, alpha cutout, torch-reactive lighting and pooled contact profile PASS');

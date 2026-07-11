import assert from 'node:assert/strict';
import * as THREE from 'three';
import { resolveOutdoorLightingProfile, OUTDOOR_LIGHTING_PROFILES } from '../src/game/world-scene/OutdoorLightingDirector.js';
for (const phase of [0,0.3,0.4,0.5,0.8,0.9,0.999]) { const p=resolveOutdoorLightingProfile(phase); assert.ok(p.fogNear<p.fogFar); assert.ok(p.exposure>=0.9&&p.exposure<=1.1); assert.ok(p.keyIntensity>=0&&p.moonIntensity>=0); ['sky','ground','key','moon','fog'].forEach((key)=>assert.ok(p[key] instanceof THREE.Color)); }
assert.ok(OUTDOOR_LIGHTING_PROFILES.night.hemi>=0.3); assert.ok(OUTDOOR_LIGHTING_PROFILES.night.moonIntensity>OUTDOOR_LIGHTING_PROFILES.noon.moonIntensity);
const before=resolveOutdoorLightingProfile(0.39999); const after=resolveOutdoorLightingProfile(0.40001); assert.ok(Math.hypot(before.fog.r-after.fog.r,before.fog.g-after.fog.g,before.fog.b-after.fog.b)<0.01);
console.log('Outdoor lighting: profiles, linear colors, readability, continuity and exposure PASS');

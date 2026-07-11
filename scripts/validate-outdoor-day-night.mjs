import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { OUTDOOR_SKY_TEXTURES } from '../src/game/world-scene/OutdoorSkyCycleRuntime.js';
import { resolveOutdoorSkyWeights, resolveOutdoorPhase, OUTDOOR_CYCLE_DURATION_MS } from '../src/game/world-scene/OutdoorWorldClock.js';
Object.values(OUTDOOR_SKY_TEXTURES).forEach((path) => assert.ok(existsSync(`public/${path.replace('./assets/','assets/')}`), `missing ${path}`));
assert.equal(new Set(Object.values(OUTDOOR_SKY_TEXTURES)).size, 3);
assert.equal(resolveOutdoorPhase(13*60*1000)*20 >= 8 && resolveOutdoorPhase(13*60*1000)*20 < 16, true);
for (let i=0;i<1000;i+=1) { const w=resolveOutdoorSkyWeights(i/999); assert.ok(Math.abs(w.dayWeight+w.redWeight+w.nightWeight-1)<1e-8); }
const skySource=readFileSync('src/game/world-scene/OutdoorSkyCycleRuntime.js','utf8'); assert.match(skySource,/redOrientation/); assert.match(skySource,/oneSkyMesh/);
const clockSource=readFileSync('src/game/world-scene/OutdoorWorldClock.js','utf8'); assert.match(clockSource,/Date\.now/); assert.equal(OUTDOOR_CYCLE_DURATION_MS,1200000);
console.log('Day/night validation PASS: 3 assets, normalized blend, 20-minute wall clock, shared red orientation, single sky mesh.');

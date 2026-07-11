import assert from 'node:assert/strict';
import { OutdoorWorldClock, OUTDOOR_CYCLE_DURATION_MS, OUTDOOR_CLOCK_STORAGE_KEY, OUTDOOR_SKY_ROTATION_DURATION_MS, resolveOutdoorSkyWeights } from '../src/game/world-scene/OutdoorWorldClock.js';

class Storage { constructor(){ this.data=new Map(); } getItem(k){ return this.data.get(k) ?? null; } setItem(k,v){ this.data.set(k,v); } }
const storage = new Storage(); let now = 100000;
const clock = new OutdoorWorldClock({ storage, now: () => now });
assert.equal(clock.getSnapshot().name, 'day', 'new clock starts at noon/day');
now += 6 * 60 * 1000; assert.equal(clock.getSnapshot().name, 'dusk');
now = 100000 + 13 * 60 * 1000; assert.equal(clock.getSnapshot().name, 'night');
now = 100000 + 19 * 60 * 1000; assert.equal(clock.getSnapshot().name, 'morning');
now = 100000 + OUTDOOR_CYCLE_DURATION_MS; assert.equal(clock.getSnapshot().phase, 0);
const reload = new OutdoorWorldClock({ storage, now: () => now }); assert.equal(reload.epochMs, 100000);
assert.ok(storage.getItem(OUTDOOR_CLOCK_STORAGE_KEY));
for (let i=0;i<=100;i+=1) { const w=resolveOutdoorSkyWeights(i/100); assert.ok(Object.values(w).every(Number.isFinite)); assert.ok(Math.abs(w.dayWeight+w.redWeight+w.nightWeight-1)<1e-9); }
const before = storage.getItem(OUTDOOR_CLOCK_STORAGE_KEY);
const debug = new OutdoorWorldClock({ storage, now: () => now, query: new URLSearchParams('timeOfDay=dawn&dayCycleSpeed=10'), development: true });
assert.equal(debug.getSnapshot().name, 'dawn'); assert.equal(storage.getItem(OUTDOOR_CLOCK_STORAGE_KEY), before);
const rotationStart=reload.getSnapshot(100000).skyRotation;const rotationAfterMinute=reload.getSnapshot(160000).skyRotation;assert.ok(rotationAfterMinute>rotationStart);assert.ok(Math.abs(rotationAfterMinute-rotationStart-(Math.PI*2*60000/OUTDOOR_SKY_ROTATION_DURATION_MS))<1e-9);assert.equal(OUTDOOR_SKY_ROTATION_DURATION_MS,20*60*1000);
console.log('Outdoor world clock: 14 focused contracts PASS');

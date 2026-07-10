import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NorthRoadRouteRuntime } from '../src/game/world-scene/NorthRoadRouteRuntime.js';
import { NORTH_ROAD_WORLD_KEYS } from '../src/game/GameState.js';

class MemoryWorldState {
  constructor(values = []) { this.values = new Set(values); }
  isWorldStateSet(key) { return this.values.has(key); }
  markWorldState(key) { if (this.values.has(key)) return false; this.values.add(key); return true; }
}
function collision() { return { blockerRects: [{ id: 'north_road_bent_road_blocker' }, { id: 'north_road_growth_gate_blocker' }], removed: [], removeBlocker(blocker) { this.removed.push(blocker.id); this.blockerRects = this.blockerRects.filter((candidate) => candidate !== blocker); } }; }
const state = new MemoryWorldState([NORTH_ROAD_WORLD_KEYS.hunterCampMarked, NORTH_ROAD_WORLD_KEYS.churchCampMarked, NORTH_ROAD_WORLD_KEYS.scoutCampMarked]);
const firstCollision = collision();
const runtime = new NorthRoadRouteRuntime({ scene: new THREE.Scene(), collision: firstCollision, gameState: state, terrainSampler: { sampleOutdoorY: () => 0 } });
const receiver = (callback) => callback;
const gestures = { cutGesture: {}, chopGesture: {}, receiver };

let targets = runtime.getPhysicalToolTargets(gestures);
assert.equal(targets.filter((target) => target.id.endsWith('_root')).length, 3);
assert.equal(targets.find((target) => target.id === 'north_road_hunter_root').acceptedToolId, 'wood_axe');
assert.equal(targets.find((target) => target.id === 'north_road_church_root').acceptedToolId, 'old_work_knife');
targets.find((target) => target.id === 'north_road_hunter_root').receivePhysicalToolEvent({});
assert.equal(state.isWorldStateSet(NORTH_ROAD_WORLD_KEYS.bentRoadCorrected), false, 'Bent Road cannot correct with one root.');
targets = runtime.getPhysicalToolTargets(gestures);
assert.equal(targets.find((target) => target.id === 'north_road_church_root').receivePhysicalToolEvent({}).completed, false, 'Church outer film exposes the cord without clearing early.');
assert.equal(runtime.getPhysicalToolTargets(gestures).find((target) => target.id === 'north_road_church_root').receivePhysicalToolEvent({}).completed, true);
assert.equal(state.isWorldStateSet(NORTH_ROAD_WORLD_KEYS.bentRoadCorrected), false, 'Bent Road cannot correct with two roots.');
runtime.getPhysicalToolTargets(gestures).find((target) => target.id === 'north_road_scout_root').receivePhysicalToolEvent({});
assert.equal(state.isWorldStateSet(NORTH_ROAD_WORLD_KEYS.bentRoadCorrected), true, 'All three roots correct Bent Road.');
assert.ok(firstCollision.removed.includes('north_road_bent_road_blocker'));

targets = runtime.getPhysicalToolTargets(gestures);
assert.ok(targets.some((target) => target.id === 'north_road_growth_gate_left_knot'));
assert.ok(targets.some((target) => target.id === 'north_road_growth_gate_right_cords'));
assert.equal(targets.some((target) => target.id === 'north_road_growth_gate_soft_mat'), false, 'Central mat remains protected by both hard stages.');
targets.find((target) => target.id === 'north_road_growth_gate_left_knot').receivePhysicalToolEvent({});
runtime.getPhysicalToolTargets(gestures).find((target) => target.id === 'north_road_growth_gate_right_cords').receivePhysicalToolEvent({});
targets = runtime.getPhysicalToolTargets(gestures);
assert.ok(targets.some((target) => target.id === 'north_road_growth_gate_soft_mat'));
targets.find((target) => target.id === 'north_road_growth_gate_soft_mat').receivePhysicalToolEvent({});
assert.equal(state.isWorldStateSet(NORTH_ROAD_WORLD_KEYS.growthGateOpen), true);
assert.ok(firstCollision.removed.includes('north_road_growth_gate_blocker'));
assert.ok(runtime.oilBursts.length > 0 && runtime.oilBursts.length <= 6, 'Physical clears emit bounded oil bursts.');
runtime.update(1);
assert.equal(runtime.oilBursts.length, 0, 'Short-lived oil effects are cleaned up.');

const reloadCollision = collision();
const restored = new NorthRoadRouteRuntime({ scene: new THREE.Scene(), collision: reloadCollision, gameState: state, terrainSampler: { sampleOutdoorY: () => 0 } });
assert.equal(restored.getPhysicalToolTargets(gestures).length, 0, 'Completed targets do not replay after reload.');
assert.deepEqual(reloadCollision.removed.sort(), ['north_road_bent_road_blocker', 'north_road_growth_gate_blocker']);
assert.equal(restored.oilBursts.length, 0, 'Restoration does not replay completion effects.');
console.log('North Road route-state tests passed: three feeder roots, tool contracts, Bent Road correction, staged Growth Gate, blocker removal, bounded effects, and persistence restoration.');

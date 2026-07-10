import * as THREE from 'three';
import { NORTH_ROAD_WORLD_KEYS } from '../GameState.js';

const ROOTS = Object.freeze({
  hunter: { key: NORTH_ROAD_WORLD_KEYS.hunterRootCleared, campKey: NORTH_ROAD_WORLD_KEYS.hunterCampMarked, position: [-58, 248], tool: 'wood_axe', action: 'chop', hits: 1, audio: 'audio_ch2_shrine_side_room_seal_axe_knot_crack_oneshot' },
  church: { key: NORTH_ROAD_WORLD_KEYS.churchRootCleared, campKey: NORTH_ROAD_WORLD_KEYS.churchCampMarked, position: [45, 278], tool: 'old_work_knife', action: 'cut', hits: 2, audio: 'audio_ch2_shrine_side_room_seal_knife_cords_cut_oneshot' },
  scout: { key: NORTH_ROAD_WORLD_KEYS.scoutRootCleared, campKey: NORTH_ROAD_WORLD_KEYS.scoutCampMarked, position: [1, 310], tool: 'old_work_knife', action: 'cut', hits: 1, audio: 'audio_ch2_shrine_side_room_seal_knife_cords_cut_oneshot' },
});

function cord(group, id, from, to, material, radius = 0.11) {
  const start = new THREE.Vector3(...from); const end = new THREE.Vector3(...to); const delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, delta.length(), 7, 1), material);
  mesh.name = id; mesh.position.copy(start).add(end).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); group.add(mesh); return mesh;
}

function growthMaterials(textureLoader) {
  const makeScab = (path, name) => {
    const map = textureLoader?.load?.(path) ?? null;
    if (map) { map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
    const material = new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : 0x17120e, roughness: 0.98, metalness: 0.02, transparent: Boolean(map), alphaTest: map ? 0.24 : 0, depthWrite: true, side: THREE.DoubleSide }); material.name = name; return material;
  };
  const cordMap = textureLoader?.load?.('./assets/textures/growth/black_growth_cord_surface_01.png') ?? null;
  if (cordMap) { cordMap.colorSpace = THREE.SRGBColorSpace; cordMap.wrapS = THREE.RepeatWrapping; cordMap.wrapT = THREE.RepeatWrapping; cordMap.repeat.set(2.4, 1); cordMap.needsUpdate = true; }
  return {
    intact: makeScab('./assets/textures/growth/black_growth_scab_intact_01.png', 'north-road-growth-intact-material'),
    damaged: makeScab('./assets/textures/growth/black_growth_scab_damaged_01.png', 'north-road-growth-damaged-material'),
    cord: new THREE.MeshStandardMaterial({ map: cordMap, color: cordMap ? 0xa59c90 : 0x29221b, roughness: 1, metalness: 0.03, emissive: 0x070503, emissiveIntensity: 0.05 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a4735, roughness: 0.97 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x5e5c57, roughness: 0.99 }),
  };
}

function rootVisual(id, definition, y, materials) {
  const group = new THREE.Group(); group.name = `north-road-${id}-feeder-root`; group.position.set(definition.position[0], y, definition.position[1]);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(id === 'church' ? 2.8 : 2.1, 1.65), materials.intact); mat.name = `${id}-root-oily-scab`; mat.position.set(0, 0.85, 0); mat.rotation.x = -Math.PI * 0.08; group.add(mat);
  if (id === 'hunter') { const knot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 1), materials.cord); knot.name = 'hunter-root-hard-knot-under-split-road-stone'; knot.position.set(0, 0.65, 0.05); knot.scale.set(1.4, 0.8, 0.72); group.add(knot); const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), materials.stone); stone.name = 'hunter-root-split-road-stone'; stone.position.set(0.45, 0.42, -0.15); stone.scale.set(1.2, 0.42, 0.9); group.add(stone); }
  for (let index = 0; index < (id === 'church' ? 6 : 4); index += 1) cord(group, `${id}-feeder-cord-${index}`, [-1.3 + index * 0.45, 0.1, -0.25], [-0.7 + index * 0.31, 1.4, 0.05], materials.cord, 0.07 + (index % 2) * 0.025);
  group.userData = { kind: 'northRoadFeederRoot', rootId: id, physicalOnly: true, noInteractFallback: true }; return group;
}

export class NorthRoadRouteRuntime {
  constructor({ scene, collision, gameState, terrainSampler, textureLoader = null, audioRuntime = null } = {}) {
    this.scene = scene; this.collision = collision; this.gameState = gameState; this.terrainSampler = terrainSampler; this.audioRuntime = audioRuntime;
    this.materials = growthMaterials(textureLoader); this.rootStages = new Map(); this.reactions = []; this.oilBursts = [];
    this.rootGroups = new Map(); this.buildRoots(); this.buildBentRoad(); this.buildGrowthGate(); this.syncFromState({ restoring: true });
    if (this.isDebugEnabled()) this.buildDebugOverlay();
  }

  y(x, z) { return this.terrainSampler?.sampleOutdoorY?.(x, z) ?? 0; }
  isDebugEnabled() { if (!import.meta.env?.DEV) return false; if (globalThis.__DSB_ROUTE_DEBUG__ === true) return true; if (typeof window === 'undefined') return false; const tokens = (new URLSearchParams(window.location.search).get('debug') ?? '').split(','); return tokens.includes('route') || tokens.includes('outdoors'); }
  state(key) { return this.gameState?.isWorldStateSet?.(key) === true; }
  mark(key) { return this.gameState?.markWorldState?.(key) === true; }
  blocker(id) { return this.collision?.blockerRects?.find?.((candidate) => candidate.id === id) ?? null; }
  removeBlocker(id) { const blocker = this.blocker(id); if (blocker) this.collision?.removeBlocker?.(blocker); return Boolean(blocker); }

  buildRoots() {
    Object.entries(ROOTS).forEach(([id, definition]) => { const group = rootVisual(id, definition, this.y(...definition.position), this.materials); this.scene?.add?.(group); this.rootGroups.set(id, group); });
  }

  buildBentRoad() {
    this.bentPreGroup = new THREE.Group(); this.bentPreGroup.name = 'north-road-bent-road-pre-correction-landmarks';
    [[-42, 258], [-7, 283], [32, 307]].forEach(([x, z], index) => { const y = this.y(x, z); const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.6, 0.45), this.materials.wood); post.name = `bent-road-repeated-sign-post-${index}`; post.position.set(x, y + 1.8, z); post.rotation.z = -0.12; const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), this.materials.stone); stone.name = `bent-road-repeated-stone-${index}`; stone.position.set(x + 2.2, y + 0.55, z - 1.4); stone.scale.y = 0.55; this.bentPreGroup.add(post, stone); });
    this.bentPostGroup = new THREE.Group(); this.bentPostGroup.name = 'north-road-bent-road-post-correction-marker'; const x = -2; const z = 324; const y = this.y(x, z); const sign = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 0.28), this.materials.wood); sign.name = 'bent-road-correct-fort-direction-sign'; sign.position.set(x, y + 2.4, z); sign.rotation.y = 0.18; this.bentPostGroup.add(sign);
    this.scene?.add?.(this.bentPreGroup, this.bentPostGroup);
  }

  buildGrowthGate() {
    this.gateGroup = new THREE.Group(); this.gateGroup.name = 'north-road-growth-gate-physical-sequence';
    const center = [25, 384]; const y = this.y(...center); this.gateGroup.position.set(center[0], y, center[1]);
    [-1, 1].forEach((side) => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.8, 0.7), this.materials.wood); post.name = `growth-gate-broken-timber-post-${side}`; post.position.set(side * 5.2, 2.4, 0); post.rotation.z = side * 0.11; this.gateGroup.add(post); });
    this.gateLeft = new THREE.Group(); this.gateLeft.name = 'growth-gate-left-hard-root-knot'; const knot = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 1), this.materials.cord); knot.scale.set(1.4, 1, 0.65); knot.position.set(-3.3, 1.45, 0); knot.rotation.set(0.18, 0.32, -0.14); knot.name = 'growth-gate-left-tarred-root-core'; this.gateLeft.add(knot); for (let index = 0; index < 5; index += 1) cord(this.gateLeft, `growth-gate-left-wrapped-cord-${index}`, [-4.45 + index * 0.24, 0.55, -0.34 + (index % 2) * 0.18], [-2.42 + index * 0.12, 2.38, 0.28 - (index % 2) * 0.14], this.materials.cord, 0.095 + (index % 2) * 0.02); this.gateGroup.add(this.gateLeft);
    this.gateRight = new THREE.Group(); this.gateRight.name = 'growth-gate-right-cord-cluster'; for (let index = 0; index < 7; index += 1) cord(this.gateRight, `growth-gate-right-cord-${index}`, [1.2 + index * 0.45, 0.15, -0.18], [2.2 + index * 0.25, 3.4, 0.04], this.materials.cord, 0.08); this.gateGroup.add(this.gateRight);
    this.gateMat = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 3.5), this.materials.intact); this.gateMat.name = 'growth-gate-central-soft-oily-mat'; this.gateMat.position.set(0, 1.8, -0.06); this.gateGroup.add(this.gateMat);
    this.scene?.add?.(this.gateGroup);
  }

  buildDebugOverlay() { const group = new THREE.Group(); group.name = 'north-road-route-state-debug-overlay'; const material = new THREE.MeshBasicMaterial({ color: 0xff33ff, wireframe: true }); [...Object.values(ROOTS).map((root) => root.position), [25, 384]].forEach(([x, z], index) => { const marker = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 6), material); marker.name = `route-debug-physical-target-${index}`; marker.position.set(x, this.y(x, z) + 1, z); group.add(marker); }); group.userData = { developmentOnly: true, legend: { magenta: 'physical-target-or-alternate-route-state' }, worldKeys: Object.values(NORTH_ROAD_WORLD_KEYS) }; this.scene?.add?.(group); this.debugGroup = group; }

  syncFromState({ restoring = false } = {}) {
    const reacting = (object) => this.reactions.some((reaction) => reaction.object === object && reaction.completed);
    Object.entries(ROOTS).forEach(([id, definition]) => { const object = this.rootGroups.get(id); object.visible = !this.state(definition.key) || reacting(object); });
    const allRoots = Object.values(ROOTS).every((definition) => this.state(definition.key));
    if (allRoots && !this.state(NORTH_ROAD_WORLD_KEYS.bentRoadCorrected)) this.mark(NORTH_ROAD_WORLD_KEYS.bentRoadCorrected);
    const corrected = this.state(NORTH_ROAD_WORLD_KEYS.bentRoadCorrected);
    this.bentPreGroup.visible = !corrected; this.bentPostGroup.visible = corrected; if (corrected) this.removeBlocker('north_road_bent_road_blocker');
    this.gateLeft.visible = !this.state(NORTH_ROAD_WORLD_KEYS.growthGateLeftKnotCleared) || reacting(this.gateLeft); this.gateRight.visible = !this.state(NORTH_ROAD_WORLD_KEYS.growthGateRightCordsCleared) || reacting(this.gateRight); this.gateMat.visible = !this.state(NORTH_ROAD_WORLD_KEYS.growthGateSoftMatCleared) || reacting(this.gateMat);
    const allGateStages = this.state(NORTH_ROAD_WORLD_KEYS.growthGateLeftKnotCleared) && this.state(NORTH_ROAD_WORLD_KEYS.growthGateRightCordsCleared) && this.state(NORTH_ROAD_WORLD_KEYS.growthGateSoftMatCleared);
    if (allGateStages && !this.state(NORTH_ROAD_WORLD_KEYS.growthGateOpen)) this.mark(NORTH_ROAD_WORLD_KEYS.growthGateOpen);
    const gateOpen = this.state(NORTH_ROAD_WORLD_KEYS.growthGateOpen); if (gateOpen) { this.removeBlocker('north_road_growth_gate_blocker'); this.gateGroup.userData.open = true; }
    if (!restoring && corrected) this.bentPostGroup.visible = true;
  }

  react(object, completed = false) { if (!object) return; object.scale.setScalar(completed ? 0.96 : 1.05); this.reactions.push({ object, elapsed: 0, duration: completed ? 0.45 : 0.24, completed }); }
  oilBurst(position) { const count = 18; const positions = new Float32Array(count * 3); const velocities = []; for (let index = 0; index < count; index += 1) { positions[index * 3] = (Math.random() - 0.5) * 0.45; positions[index * 3 + 1] = Math.random() * 0.35; positions[index * 3 + 2] = (Math.random() - 0.5) * 0.25; velocities.push(new THREE.Vector3((Math.random() - 0.5) * 2.1, 1.4 + Math.random() * 2, (Math.random() - 0.5) * 1.4)); } const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x120d09, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false })); points.name = 'north-road-bounded-black-oil-burst'; points.position.copy(position); this.scene?.add?.(points); this.oilBursts.push({ points, velocities, elapsed: 0, duration: 0.72 }); }
  play(cue, position) { this.audioRuntime?.play3D?.(cue, position); return Boolean(this.audioRuntime); }

  strikeRoot(id) {
    const definition = ROOTS[id]; if (!definition || this.state(definition.key)) return { accepted: false, changed: false, reason: 'complete' };
    const stage = (this.rootStages.get(id) ?? 0) + 1; this.rootStages.set(id, stage); const completed = stage >= definition.hits; const group = this.rootGroups.get(id); this.react(group, completed);
    if (!completed) { if (group.children[0]?.material) group.children[0].material = this.materials.damaged; return { accepted: true, changed: true, completed: false, stage, message: 'The outer film splits and exposes the inner cord.' }; }
    this.mark(definition.key); const target = new THREE.Vector3(definition.position[0], this.y(...definition.position) + 1, definition.position[1]); this.oilBurst(target); const audioAcceptedCuePlayed = this.play(definition.audio, target); this.syncFromState(); return { accepted: true, changed: true, completed: true, cleared: true, stage, message: `${id[0].toUpperCase()}${id.slice(1)} Root Cleared.`, audioAcceptedCuePlayed };
  }

  strikeGate(stageId) {
    const configs = {
      left: { key: NORTH_ROAD_WORLD_KEYS.growthGateLeftKnotCleared, object: this.gateLeft, cue: 'audio_ch2_shrine_side_room_seal_axe_knot_crack_oneshot' },
      right: { key: NORTH_ROAD_WORLD_KEYS.growthGateRightCordsCleared, object: this.gateRight, cue: 'audio_ch2_shrine_side_room_seal_knife_cords_cut_oneshot' },
      mat: { key: NORTH_ROAD_WORLD_KEYS.growthGateSoftMatCleared, object: this.gateMat, cue: 'audio_ch2_beneath_folsom_hidden_growth_gate_collapse_oneshot' },
    };
    const config = configs[stageId]; if (!config || this.state(config.key)) return { accepted: false, changed: false, reason: 'complete' };
    this.mark(config.key); this.react(config.object, true); const target = new THREE.Vector3(25, this.y(25, 384) + 1.5, 384); this.oilBurst(target); const audioAcceptedCuePlayed = this.play(config.cue, target); this.syncFromState(); const opened = this.state(NORTH_ROAD_WORLD_KEYS.growthGateOpen); return { accepted: true, changed: true, completed: true, cleared: true, opened, message: opened ? 'The Road Growth Gate collapses away.' : 'The growth tears free from the gate.', audioAcceptedCuePlayed };
  }

  getPhysicalToolTargets({ cutGesture, chopGesture, receiver }) {
    const targets = [];
    Object.entries(ROOTS).forEach(([id, definition]) => { if (this.state(definition.key)) return; const position = new THREE.Vector3(definition.position[0], this.y(...definition.position) + 1.05, definition.position[1]); targets.push({ id: `north_road_${id}_root`, target: position, range: 3.5, contactRadiusPx: id === 'hunter' ? 66 : 58, acceptedToolId: definition.tool, acceptedActionType: definition.action, requiredGesture: definition.action === 'chop' ? chopGesture : cutGesture, stage: this.rootStages.get(id) ?? 0, stageOrder: id === 'church' ? ['outer-film', 'inner-cord', 'cleared'] : ['intact', 'cleared'], available: this.state(definition.campKey), prerequisitesMet: () => this.state(definition.campKey), completionSaveKey: definition.key, failFeedback: { prerequisite: 'camp-clue-missing', wrongTool: 'hard-catch' }, receivePhysicalToolEvent: receiver(() => this.strikeRoot(id)) }); });
    const corrected = this.state(NORTH_ROAD_WORLD_KEYS.bentRoadCorrected);
    if (corrected && !this.state(NORTH_ROAD_WORLD_KEYS.growthGateLeftKnotCleared)) targets.push({ id: 'north_road_growth_gate_left_knot', target: new THREE.Vector3(21.7, this.y(25, 384) + 1.45, 384), range: 4, contactRadiusPx: 68, acceptedToolId: 'wood_axe', acceptedActionType: 'chop', requiredGesture: chopGesture, stage: 0, completionSaveKey: NORTH_ROAD_WORLD_KEYS.growthGateLeftKnotCleared, receivePhysicalToolEvent: receiver(() => this.strikeGate('left')) });
    if (corrected && !this.state(NORTH_ROAD_WORLD_KEYS.growthGateRightCordsCleared)) targets.push({ id: 'north_road_growth_gate_right_cords', target: new THREE.Vector3(28.2, this.y(25, 384) + 1.65, 384), range: 4, contactRadiusPx: 62, acceptedToolId: 'old_work_knife', acceptedActionType: 'cut', requiredGesture: cutGesture, stage: 0, completionSaveKey: NORTH_ROAD_WORLD_KEYS.growthGateRightCordsCleared, receivePhysicalToolEvent: receiver(() => this.strikeGate('right')) });
    const hardStagesClear = this.state(NORTH_ROAD_WORLD_KEYS.growthGateLeftKnotCleared) && this.state(NORTH_ROAD_WORLD_KEYS.growthGateRightCordsCleared);
    if (corrected && hardStagesClear && !this.state(NORTH_ROAD_WORLD_KEYS.growthGateSoftMatCleared)) targets.push({ id: 'north_road_growth_gate_soft_mat', target: new THREE.Vector3(25, this.y(25, 384) + 1.8, 384), range: 4, contactRadiusPx: 70, acceptedToolId: 'old_work_knife', acceptedActionType: 'cut', requiredGesture: cutGesture, stage: 0, completionSaveKey: NORTH_ROAD_WORLD_KEYS.growthGateSoftMatCleared, receivePhysicalToolEvent: receiver(() => this.strikeGate('mat')) });
    return targets;
  }

  update(deltaSeconds) {
    this.reactions = this.reactions.filter((reaction) => { reaction.elapsed += deltaSeconds; const t = Math.min(1, reaction.elapsed / reaction.duration); const pulse = Math.sin(t * Math.PI * 3) * (1 - t) * 0.09; reaction.object.scale.setScalar(reaction.completed ? Math.max(0.04, 1 - t * 0.96) : 1 + pulse); if (t >= 1 && reaction.completed) reaction.object.visible = false; return t < 1; });
    this.oilBursts = this.oilBursts.filter((burst) => { burst.elapsed += deltaSeconds; const position = burst.points.geometry.attributes.position; for (let index = 0; index < burst.velocities.length; index += 1) { const velocity = burst.velocities[index]; velocity.y -= 5.5 * deltaSeconds; position.setXYZ(index, position.getX(index) + velocity.x * deltaSeconds, position.getY(index) + velocity.y * deltaSeconds, position.getZ(index) + velocity.z * deltaSeconds); } position.needsUpdate = true; burst.points.material.opacity = Math.max(0, 1 - burst.elapsed / burst.duration); if (burst.elapsed < burst.duration) return true; this.scene?.remove?.(burst.points); burst.points.geometry.dispose(); burst.points.material.dispose(); return false; });
  }

  getDebugSummary() { return { roots: Object.fromEntries(Object.entries(ROOTS).map(([id, definition]) => [id, { cleared: this.state(definition.key), stage: this.rootStages.get(id) ?? 0, campMarked: this.state(definition.campKey) }])), bentRoadCorrected: this.state(NORTH_ROAD_WORLD_KEYS.bentRoadCorrected), growthGate: { left: this.state(NORTH_ROAD_WORLD_KEYS.growthGateLeftKnotCleared), right: this.state(NORTH_ROAD_WORLD_KEYS.growthGateRightCordsCleared), mat: this.state(NORTH_ROAD_WORLD_KEYS.growthGateSoftMatCleared), open: this.state(NORTH_ROAD_WORLD_KEYS.growthGateOpen) }, blockers: { bent: Boolean(this.blocker('north_road_bent_road_blocker')), growthGate: Boolean(this.blocker('north_road_growth_gate_blocker')) }, activeOilBursts: this.oilBursts.length }; }
}

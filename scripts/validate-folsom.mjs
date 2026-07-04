import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildDungeonCollision } from '../src/engine/dungeon-authoring/DungeonCollisionBuilder.js';
import { getLocationDefinition } from '../src/game/locations/locationRegistry.js';
import { GameState } from '../src/game/GameState.js';
import { Interactions } from '../src/game/Interactions.js';
import { BLACK_GROWTH_TEXTURES } from '../src/game/world-scene/BlackGrowthVisuals.js';
import { FOLSOM_CONNECTED_GROWTH_RULES, FolsomConnectedGrowthRuntime } from '../src/game/world-scene/FolsomConnectedGrowthRuntime.js';
import { FOLSOM_SHED_GROWTH_RULES, FOLSOM_SHED_GROWTH_TEXTURES } from '../src/game/world-scene/FolsomShedGrowthRuntime.js';

const folsom = getLocationDefinition('folsom');
assert.ok(folsom, 'Folsom definition is registered.');
assert.equal(folsom.id, 'folsom');
assert.equal((folsom.spawns ?? []).some((spawn) => ['enemy', 'npc'].includes(spawn.kind)), false, 'Folsom has no enemy or NPC spawns.');
assert.ok((folsom.waterBodies ?? []).some((water) => water.fishable), 'Folsom keeps fishable pond.');

const shedWalls = (folsom.wallSegments ?? []).filter((wall) => wall.tags?.includes('tool-shed'));
const shedDoorPanels = (folsom.architecturalPrimitives ?? []).filter((primitive) => primitive.tags?.includes('shed-door') && primitive.tags?.includes('closed-door'));
const shedDoorFrame = (folsom.architecturalPrimitives ?? []).find((primitive) => primitive.id === 'folsom_shed_door_frame');
const shedDoorSeam = (folsom.architecturalPrimitives ?? []).find((primitive) => primitive.id === 'folsom_shed_door_seam');
const shedRoof = (folsom.props ?? []).filter((prop) => prop.tags?.includes('pitched-roof'));
const shedRearShelf = (folsom.architecturalPrimitives ?? []).find((primitive) => primitive.tags?.includes('future-knife-hiding-area'));
const shedRewardSpace = (folsom.architecturalPrimitives ?? []).find((primitive) => primitive.tags?.includes('future-shed-reward-space'));
const axeChest = (folsom.outdoorChests ?? []).find((chest) => chest.itemId === 'wood_axe');
const torchChest = (folsom.outdoorChests ?? []).find((chest) => chest.itemId === 'torch');
const knifePickup = (folsom.outdoorPickups ?? []).find((pickup) => pickup.itemId === 'old_work_knife');
const underworksGate = (folsom.architecturalPrimitives ?? []).find((primitive) => primitive.id === 'folsom_cellar_gate');
const growthNetwork = folsom.connectedGrowthNetwork;
const shedCollision = buildDungeonCollision(folsom).blockerRects.filter((blocker) => blocker.id.includes('folsom_shed'));
const pointIsBlocked = ([x, z]) => shedCollision.some((blocker) => x >= blocker.minX && x <= blocker.maxX && z >= blocker.minZ && z <= blocker.maxZ);

assert.equal(shedWalls.length, 4, 'Folsom tool shed has four authored exterior walls.');
assert.equal(shedDoorPanels.length, 2, 'Folsom tool shed has a readable split-plank door.');
assert.ok(shedDoorFrame?.tags?.includes('future-growth-target'), 'Folsom tool shed door frame is tagged for the future growth pass.');
assert.ok(shedDoorSeam?.tags?.includes('future-growth-target'), 'Folsom tool shed door seam is tagged for the future growth pass.');
assert.equal(shedRoof.length, 2, 'Folsom tool shed has a two-slab pitched roof.');
assert.ok(shedRoof.every((slab) => slab.dimensions.width > 8 && slab.dimensions.depth > 11), 'Folsom tool shed roof has a broad overhang.');
assert.ok(shedRearShelf, 'Folsom tool shed has an authored rear knife hiding area.');
assert.ok(shedRewardSpace, 'Folsom tool shed has an authored interior reward space.');
assert.ok(axeChest?.tags?.includes('shed-reward') && axeChest.position.z > -35 && axeChest.position.z < -25, 'Wood Axe reward is inside the shed.');
assert.ok(torchChest?.tags?.includes('shed-reward') && torchChest.position.z > -35 && torchChest.position.z < -25, 'Torch reward is inside the shed.');
assert.ok(knifePickup?.tags?.includes('shed-back') && knifePickup.position.z > -25, 'Old Work Knife is hidden behind the shed.');
assert.equal(FOLSOM_SHED_GROWTH_RULES.requiredItemId, 'old_work_knife', 'Shed growth requires the Old Work Knife.');
assert.equal(FOLSOM_SHED_GROWTH_RULES.hitsRequired, 3, 'Shed growth clears after exactly three successful swipes.');
assert.deepEqual(FOLSOM_SHED_GROWTH_RULES.stateSequence, ['intact', 'damaged', 'cleared'], 'Shed growth uses the locked three-state sequence.');
assert.equal(FOLSOM_SHED_GROWTH_RULES.saveKey, 'folsom_tool_shed_open', 'Shed growth uses the locked world-state key.');
assert.deepEqual(FOLSOM_SHED_GROWTH_TEXTURES.intact, ['./assets/textures/growth/black_growth_scab_intact_01.png', './assets/textures/growth/black_growth_scab_intact_02.png']);
assert.deepEqual(FOLSOM_SHED_GROWTH_TEXTURES.damaged, ['./assets/textures/growth/black_growth_scab_damaged_01.png', './assets/textures/growth/black_growth_scab_damaged_02.png']);
assert.equal(FOLSOM_SHED_GROWTH_TEXTURES.cord, './assets/textures/growth/black_growth_cord_surface_01.png');
assert.equal(FOLSOM_SHED_GROWTH_TEXTURES.hit, './assets/sprites/effects/growth/black_growth_hit_decal_01.png');
assert.equal(FOLSOM_SHED_GROWTH_TEXTURES, BLACK_GROWTH_TEXTURES, 'Shed and connected growth share one locked asset contract.');
assert.ok(pointIsBlocked([-35.82, -35.34]) && pointIsBlocked([-34.18, -35.34]), 'Closed shed door panels have matching authored collision.');
[
  [-35, -37.2], [-44, -30], [-42.8, -22.2], [-35, -21.8], [-27.2, -22.2], [-26, -30], [-24.7, -31],
].forEach((point) => assert.equal(pointIsBlocked(point), false, `Tool shed approach clearance remains open at ${point.join(', ')}.`));
assert.ok((folsom.waterBodies ?? []).some((water) => water.fishable), 'Folsom keeps fishable pond after the shed rebuild.');

assert.equal(growthNetwork?.lock?.id, 'folsom_underworks_growth_lock', 'Folsom authors the larger Underworks growth lock.');
assert.ok(growthNetwork.lock.tags.includes('blocks-underworks') && growthNetwork.lock.tags.includes('connected-growth-root'), 'Underworks growth lock is tagged as the connected root obstruction.');
assert.equal(underworksGate?.state, 'locked', 'Folsom Underworks gate remains locked.');
assert.equal(underworksGate?.passable, false, 'Folsom Underworks gate remains unavailable.');
assert.equal((folsom.exits ?? []).some((exit) => /beneath|underworks/i.test(exit.toLocation ?? '')), false, 'No Beneath Folsom or Underworks exit is authored yet.');

const anchors = growthNetwork.anchors ?? [];
assert.deepEqual(anchors.map((anchor) => anchor.id).sort(), ['folsom_growth_anchor_fire', 'folsom_growth_anchor_pond', 'folsom_growth_anchor_shrine'], 'Folsom has exactly the three locked connected-growth anchors.');
assert.ok(anchors.every((anchor) => anchor.tags.includes('connected-growth-anchor') && anchor.tags.includes('not-collectible')), 'Growth anchors are physical world sources, not collectibles.');
assert.ok(anchors.every((anchor) => !('itemId' in anchor) && !('hitsRequired' in anchor)), 'Growth anchors add no inventory tokens or collectible hit counters.');
assert.equal(FOLSOM_CONNECTED_GROWTH_RULES.fire.saveKey, 'folsom_growth_anchor_fire_cleared');
assert.equal(FOLSOM_CONNECTED_GROWTH_RULES.pond.saveKey, 'folsom_growth_anchor_pond_cleared');
assert.equal(FOLSOM_CONNECTED_GROWTH_RULES.shrine.saveKey, 'folsom_growth_anchor_shrine_cleared');
assert.equal(FOLSOM_CONNECTED_GROWTH_RULES.underworks.saveKey, 'folsom_underworks_growth_unsealed');
const pondAnchor = anchors.find((anchor) => anchor.type === 'pond');
assert.ok(pondAnchor.position[0] > 6 && pondAnchor.position[1] > -50, 'Pond anchor stays east of the north-bank fishing lane and outside the water center.');

const feeds = growthNetwork.feeds ?? [];
assert.equal(feeds.length, 3, 'Folsom authors one visible growth feed for each anchor.');
assert.deepEqual(feeds.map((feed) => feed.anchorId).sort(), anchors.map((anchor) => anchor.id).sort(), 'Fire, pond, and shrine anchors each connect back to the Underworks root.');
assert.ok(feeds.every((feed) => feed.points.length >= 6 && feed.tags.includes('connected-growth-feed')), 'Each feed has a readable authored route across Folsom.');

const growthScene = new THREE.Scene();
const storageValues = new Map();
const storage = {
  get length() { return storageValues.size; },
  key: (index) => [...storageValues.keys()][index] ?? null,
  getItem: (key) => storageValues.has(key) ? storageValues.get(key) : null,
  setItem: (key, value) => storageValues.set(key, String(value)),
  removeItem: (key) => storageValues.delete(key),
};
const gameState = new GameState(storage);
const compiledGroup = new THREE.Group();
const underworksDoor = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.2), new THREE.MeshBasicMaterial());
underworksDoor.position.set(42, 1.8, 44);
underworksDoor.userData = { architecturalPrimitiveId: 'folsom_cellar_gate', doorwayPart: 'door' };
compiledGroup.add(underworksDoor);
const connectedGrowth = new FolsomConnectedGrowthRuntime({
  scene: growthScene,
  network: growthNetwork,
  textureLoader: { load: () => new THREE.Texture() },
  sampleSurfaceY: () => 0,
  gameState,
  compiledGroup,
});
const anchorGroups = anchors.map((anchor) => connectedGrowth.root.getObjectByName(anchor.id));
const feedMeshes = feeds.map((feed) => connectedGrowth.root.getObjectByName(`${feed.id}-cord-ribbon`));
const growthLock = connectedGrowth.root.getObjectByName(growthNetwork.lock.id);
const wrappedKnots = [];
const knotSkins = [];
connectedGrowth.root.traverse((object) => {
  if (object.userData?.wrappedHealthyGrowthTexture) wrappedKnots.push(object);
  if (object.name?.endsWith('-textured-scab-skin')) knotSkins.push(object);
});
assert.ok(anchorGroups.every((group) => group?.userData?.collectible === false), 'Runtime anchor groups remain explicitly non-collectible.');
assert.ok(feedMeshes.every((mesh) => mesh?.isMesh && mesh.geometry?.getAttribute('position')?.count > 24), 'Runtime builds three closely sampled terrain-following feed ribbons with valid geometry.');
assert.ok(growthLock?.children?.length >= 9 && growthLock.userData.blocksUnderworks, 'Runtime builds a substantial scab, cord, and knot mass over the Underworks gate.');
assert.ok(connectedGrowth.root.getObjectByName(`${growthNetwork.lock.id}-feed-root-collar`), 'Underworks lock has a textured ground collar where the three feeds visibly converge.');
assert.equal(knotSkins.length, 0, 'Knot texturing uses wrapped mesh materials rather than planar scab overlays.');
assert.ok(wrappedKnots.length >= 15 && wrappedKnots.every((mesh) => mesh.material?.map && mesh.material.map.wrapS === THREE.RepeatWrapping && mesh.material.map.wrapT === THREE.RepeatWrapping), 'Anchor, route, and Underworks knot geometry is wrapped in repeating healthy-growth textures like field boulders.');
assert.ok(wrappedKnots.every((mesh) => mesh.userData.growthTextureState === 'intact'), 'Every connected-growth knot uses the healthy undamaged texture state.');
assert.equal(typeof connectedGrowth.update, 'function', 'Connected growth updates only bounded clear animations and effects.');

const liveStorageValues = new Map();
const liveStorage = {
  get length() { return liveStorageValues.size; },
  key: (index) => [...liveStorageValues.keys()][index] ?? null,
  getItem: (key) => liveStorageValues.has(key) ? liveStorageValues.get(key) : null,
  setItem: (key, value) => liveStorageValues.set(key, String(value)),
  removeItem: (key) => liveStorageValues.delete(key),
};
const liveGameState = new GameState(liveStorage);
const liveGrowth = new FolsomConnectedGrowthRuntime({
  scene: new THREE.Scene(),
  network: growthNetwork,
  textureLoader: { load: () => new THREE.Texture() },
  sampleSurfaceY: () => 0,
  gameState: liveGameState,
  compiledGroup: new THREE.Group(),
});
const liveAnchorInteractions = liveGrowth.getAnchorInteractions();
assert.equal(liveAnchorInteractions.length, 3, 'All three uncleared anchors register live outdoor interactions.');
assert.deepEqual(liveAnchorInteractions.map((interaction) => interaction.id).sort(), anchors.map((anchor) => anchor.id).sort(), 'Live anchor interactions map one-to-one to authored anchors.');
assert.ok(liveAnchorInteractions.every((interaction) => interaction.target?.isVector3 && interaction.hint && interaction.failMessage && interaction.message && interaction.type === 'folsomGrowthAnchor' && interaction.anchorType), 'Every live anchor interaction has a target, hint, type, anchor identity, and non-silent success/failure feedback.');

const liveMessages = [];
const liveHints = [];
const ownedItems = new Set();
const livePlayer = { position: new THREE.Vector3() };
const competingCampfire = { id: 'validation_campfire', target: liveAnchorInteractions.find((interaction) => interaction.anchorType === 'fire').target.clone(), range: 4, hint: 'Campfire', message: 'Campfire', type: 'fieldCampfire' };
const competingShrineInspect = { id: 'validation_shrine_inspect', target: liveAnchorInteractions.find((interaction) => interaction.anchorType === 'shrine').target.clone(), range: 4, hint: 'Inspect shrine', message: 'Inspect shrine', type: 'outdoorInspect' };
const liveDungeon = {
  area: 'field',
  gameState: liveGameState,
  folsomConnectedGrowthRuntime: liveGrowth,
  outdoorInteractions: [...liveAnchorInteractions, competingCampfire, competingShrineInspect],
  inspectInteractions: [],
  getNearbyFieldHarvestableRedwood: () => null,
  getNearbyFishingZone: () => ({ id: 'folsom_starter_pond_fishing_zone' }),
  isOutdoorSurvivalArea: () => false,
  clearFolsomGrowthAnchor(anchorId) {
    const result = liveGrowth.clearAnchor(anchorId);
    const interaction = this.outdoorInteractions.find((candidate) => candidate.id === anchorId);
    if (result.cleared && interaction) interaction.collected = true;
    return result;
  },
};
const liveEquipment = {
  hasItem: (itemId) => ownedItems.has(itemId),
  getEquippedOffhandId: () => null,
  getEquippedWeaponProfile: () => ({ id: 'fishing_rod' }),
};
const liveInteractions = new Interactions({
  player: livePlayer,
  dungeon: liveDungeon,
  equipmentRuntime: liveEquipment,
  hud: { showHint: (message) => liveHints.push(message), showMessage: (message) => liveMessages.push(message), updateFieldKitStatus: () => {} },
  feedback: { shake: () => {} },
});

const exerciseLiveAnchor = (anchorType, itemId) => {
  const interaction = liveAnchorInteractions.find((candidate) => candidate.anchorType === anchorType);
  livePlayer.position.copy(interaction.target);
  assert.equal(liveInteractions.getNearbyOutdoorInteraction()?.id, interaction.id, `${anchorType} growth wins live interaction selection over overlapping campfire, fishing, or shrine interactions.`);
  assert.equal(liveInteractions.getNearbyInteraction()?.hint, interaction.hint, `${anchorType} exposes its minimal hint through the live player-facing interaction path.`);
  ownedItems.delete(itemId);
  liveInteractions.interact();
  assert.equal(liveMessages.at(-1), interaction.failMessage, `${anchorType} interact gives explicit feedback when its capability is missing.`);
  assert.equal(liveGameState.isFolsomGrowthAnchorCleared(anchorType), false, `${anchorType} remains uncleared after a failed live interaction.`);
  ownedItems.add(itemId);
  liveInteractions.interact();
  assert.equal(liveGameState.isFolsomGrowthAnchorCleared(anchorType), true, `${anchorType} clears through the live nearby-interact route.`);
  assert.ok(liveMessages.at(-1).includes(interaction.message), `${anchorType} live success feedback is shown.`);
};

exerciseLiveAnchor('fire', 'torch');
exerciseLiveAnchor('pond', 'old_work_knife');
exerciseLiveAnchor('shrine', 'old_work_knife');
assert.equal(liveGameState.isFolsomUnderworksGrowthUnsealed(), true, 'The live interaction route unseals Underworks after all three anchors.');

const fireResult = connectedGrowth.clearAnchor('folsom_growth_anchor_fire');
assert.equal(fireResult.cleared, true, 'The fire anchor clears through its physical world interaction.');
assert.equal(fireResult.unsealed, false, 'One cleared anchor does not unseal Underworks.');
connectedGrowth.update(1);
assert.equal(gameState.isFolsomGrowthAnchorCleared('fire'), true, 'Fire anchor progress is stored as world state.');
assert.equal(connectedGrowth.root.getObjectByName('folsom_growth_anchor_fire').visible, false, 'Cleared fire growth collapses away.');
assert.ok(connectedGrowth.root.getObjectByName('folsom_growth_feed_fire-cord-ribbon').material.opacity <= 0.12, 'The cleared fire feed remains visibly faded and broken.');
assert.equal(growthLock.visible, true, 'Underworks remains sealed after one anchor.');

const pondResult = connectedGrowth.clearAnchor('folsom_growth_anchor_pond');
assert.equal(pondResult.unsealed, false, 'Two cleared anchors still leave Underworks sealed.');
connectedGrowth.update(1);
assert.equal(gameState.isFolsomGrowthAnchorCleared('pond'), true, 'Pond anchor progress is stored as world state.');

const shrineResult = connectedGrowth.clearAnchor('folsom_growth_anchor_shrine');
assert.equal(shrineResult.unsealed, true, 'The third anchor unseals Underworks.');
connectedGrowth.update(1);
assert.equal(gameState.isFolsomGrowthAnchorCleared('shrine'), true, 'Shrine anchor progress is stored as world state.');
assert.equal(gameState.isFolsomUnderworksGrowthUnsealed(), true, 'Underworks unseal is stored as world state.');
assert.equal(growthLock.visible, false, 'The Underworks growth lock collapses after all three anchors clear.');
assert.ok(underworksDoor.position.y > 5, 'The above-ground Underworks gate visibly opens without authoring a dungeon exit.');

const reloadedScene = new THREE.Scene();
const reloadedDoor = underworksDoor.clone();
reloadedDoor.position.set(42, 1.8, 44);
reloadedDoor.userData = { architecturalPrimitiveId: 'folsom_cellar_gate', doorwayPart: 'door' };
const reloadedCompiledGroup = new THREE.Group();
reloadedCompiledGroup.add(reloadedDoor);
const reloadedGrowth = new FolsomConnectedGrowthRuntime({
  scene: reloadedScene,
  network: growthNetwork,
  textureLoader: { load: () => new THREE.Texture() },
  sampleSurfaceY: () => 0,
  gameState: new GameState(storage),
  compiledGroup: reloadedCompiledGroup,
});
assert.ok(anchors.every((anchor) => reloadedGrowth.root.getObjectByName(anchor.id).visible === false), 'Cleared anchors remain collapsed after reload.');
assert.equal(reloadedGrowth.root.getObjectByName(growthNetwork.lock.id).visible, false, 'Underworks growth remains cleared after reload.');
assert.ok(reloadedDoor.position.y > 5, 'The Underworks gate remains visibly open after reload.');

console.log('Folsom keeps its starter systems and shed proof loop while all three physical anchors persistently weaken their feeds and unseal Underworks.');

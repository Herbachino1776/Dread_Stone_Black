import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildDungeonCollision } from '../src/engine/dungeon-authoring/DungeonCollisionBuilder.js';
import { getLocationDefinition } from '../src/game/locations/locationRegistry.js';
import { BLACK_GROWTH_TEXTURES } from '../src/game/world-scene/BlackGrowthVisuals.js';
import { FolsomConnectedGrowthRuntime } from '../src/game/world-scene/FolsomConnectedGrowthRuntime.js';
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
assert.ok(anchors.every((anchor) => !('itemId' in anchor) && !('saveKey' in anchor) && !('hitsRequired' in anchor)), 'Growth anchors add no inventory, clearing, or save progression state.');
const pondAnchor = anchors.find((anchor) => anchor.type === 'pond');
assert.ok(pondAnchor.position[0] > 6 && pondAnchor.position[1] > -50, 'Pond anchor stays east of the north-bank fishing lane and outside the water center.');

const feeds = growthNetwork.feeds ?? [];
assert.equal(feeds.length, 3, 'Folsom authors one visible growth feed for each anchor.');
assert.deepEqual(feeds.map((feed) => feed.anchorId).sort(), anchors.map((anchor) => anchor.id).sort(), 'Fire, pond, and shrine anchors each connect back to the Underworks root.');
assert.ok(feeds.every((feed) => feed.points.length >= 6 && feed.tags.includes('connected-growth-feed')), 'Each feed has a readable authored route across Folsom.');

const growthScene = new THREE.Scene();
const connectedGrowth = new FolsomConnectedGrowthRuntime({
  scene: growthScene,
  network: growthNetwork,
  textureLoader: { load: () => new THREE.Texture() },
  sampleSurfaceY: () => 0,
});
const anchorGroups = anchors.map((anchor) => connectedGrowth.root.getObjectByName(anchor.id));
const feedMeshes = feeds.map((feed) => connectedGrowth.root.getObjectByName(`${feed.id}-cord-ribbon`));
const growthLock = connectedGrowth.root.getObjectByName(growthNetwork.lock.id);
const knotSkins = [];
connectedGrowth.root.traverse((object) => {
  if (object.name?.endsWith('-textured-scab-skin')) knotSkins.push(object);
});
assert.ok(anchorGroups.every((group) => group?.userData?.collectible === false), 'Runtime anchor groups remain explicitly non-collectible.');
assert.ok(feedMeshes.every((mesh) => mesh?.isMesh && mesh.geometry?.getAttribute('position')?.count > 24), 'Runtime builds three closely sampled terrain-following feed ribbons with valid geometry.');
assert.ok(growthLock?.children?.length >= 9 && growthLock.userData.blocksUnderworks, 'Runtime builds a substantial scab, cord, and knot mass over the Underworks gate.');
assert.ok(connectedGrowth.root.getObjectByName(`${growthNetwork.lock.id}-feed-root-collar`), 'Underworks lock has a textured ground collar where the three feeds visibly converge.');
assert.ok(knotSkins.length >= 15 && knotSkins.every((mesh) => mesh.material?.map), 'Anchor, route, and Underworks knots use locked textured scab skins rather than bare placeholder cores.');
assert.equal(typeof connectedGrowth.update, 'undefined', 'Connected growth V1 is static and adds no per-frame update cost.');

console.log('Folsom keeps its starter systems, shed proof loop, and static fire/pond/shrine growth network while Underworks remains sealed.');

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { EquipmentRuntime } from '../src/engine/equipment/EquipmentRuntime.js';
import { buildDungeonCollision } from '../src/engine/dungeon-authoring/DungeonCollisionBuilder.js';
import { compileDungeonLocation } from '../src/engine/dungeon-authoring/DungeonCompiler.js';
import { DungeonScene } from '../src/game/DungeonScene.js';
import { Game } from '../src/game/Game.js';
import { getLocationDefinition, hasLocationDefinition, loadLocationDefinition } from '../src/game/locations/locationRegistry.js';
import { GameState } from '../src/game/GameState.js';
import { SceneSessionHost } from '../src/game/hosts/SceneSessionHost.js';
import { KeepersLanternViewmodel, KEEPERS_LANTERN_EMITTER, KEEPERS_LANTERN_ITEM_ID, KEEPERS_LANTERN_LIGHTING } from '../src/game/viewmodels/KeepersLanternViewmodel.js';
import { Interactions } from '../src/game/Interactions.js';
import { equipmentRegistry } from '../src/game/equipment/equipmentRegistry.js';
import { SurvivalInventoryBridge } from '../src/game/equipment/SurvivalInventoryBridge.js';
import { BLACK_GROWTH_TEXTURES } from '../src/game/world-scene/BlackGrowthVisuals.js';
import { FOLSOM_CONNECTED_GROWTH_RULES, FolsomConnectedGrowthRuntime } from '../src/game/world-scene/FolsomConnectedGrowthRuntime.js';
import { FOLSOM_SHED_GROWTH_RULES, FOLSOM_SHED_GROWTH_TEXTURES, FolsomShedGrowthRuntime } from '../src/game/world-scene/FolsomShedGrowthRuntime.js';
import { FOLSOM_SHRINE_INVESTIGATION_RULES, FolsomShrineInvestigationRuntime } from '../src/game/world-scene/FolsomShrineInvestigationRuntime.js';
import { LanternConeRevealRuntime, LANTERN_REVEAL_DEFAULTS, isPointInsideLanternCone } from '../src/game/world-scene/LanternConeRevealRuntime.js';
import { BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_RULES } from '../src/game/world-scene/BeneathFolsomHiddenGrowthGateRuntime.js';
import { evaluatePhysicalToolGesture, PHYSICAL_TOOL_PROFILES } from '../src/game/physical-tools/PhysicalToolProfiles.js';
import { PhysicalToolTargetRegistry } from '../src/game/physical-tools/PhysicalToolTargetRegistry.js';
import { PhysicalToolViewmodel } from '../src/game/physical-tools/PhysicalToolViewmodel.js';
import { PhysicalToolActionController } from '../src/game/physical-tools/PhysicalToolActionController.js';
import { EquipmentPanel } from '../src/game/equipment/EquipmentPanel.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const revealedGlyphAssetRoot = path.join(repoRoot, 'public', 'assets', 'revealed_glyphs');
const revealedGlyphManifestPath = path.join(revealedGlyphAssetRoot, 'revealed_glyphs_manifest.json');
assert.equal(existsSync(revealedGlyphAssetRoot), true, 'Revealed glyph asset root exists.');
assert.equal(existsSync(revealedGlyphManifestPath), true, 'Revealed glyph manifest exists.');
const revealedGlyphManifest = JSON.parse(readFileSync(revealedGlyphManifestPath, 'utf8'));
assert.equal(revealedGlyphManifest.asset_root, 'public/assets/revealed_glyphs');
const collectAssetFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const entryPath = path.join(directory, entry);
  return statSync(entryPath).isDirectory() ? collectAssetFiles(entryPath) : [entryPath];
});
const revealedGlyphFiles = collectAssetFiles(revealedGlyphAssetRoot);
assert.equal(revealedGlyphFiles.some((assetPath) => assetPath.endsWith(`${path.sep}letters${path.sep}letter_001.png`)), true, 'The selected glyph PNG exists.');
assert.equal(revealedGlyphFiles.some((assetPath) => /keeper|ghiselian/i.test(path.basename(assetPath))), false, 'Revealed glyph filenames remain generic and lore-neutral.');

const knifeGesture = evaluatePhysicalToolGesture(PHYSICAL_TOOL_PROFILES.old_work_knife, { travelPx: 96, velocityPxPerSecond: 1180, smoothness: 0.72, angleRadians: Math.PI * 0.3 });
const reverseKnifeGesture = evaluatePhysicalToolGesture(PHYSICAL_TOOL_PROFILES.old_work_knife, { travelPx: 96, velocityPxPerSecond: 760, smoothness: 0.9, angleRadians: -Math.PI * 0.75 });
const crosswiseKnifeGesture = evaluatePhysicalToolGesture(PHYSICAL_TOOL_PROFILES.old_work_knife, { travelPx: 96, velocityPxPerSecond: 760, smoothness: 0.9, angleRadians: -Math.PI * 0.25 });
const axeGesture = evaluatePhysicalToolGesture(PHYSICAL_TOOL_PROFILES.wood_axe, { travelPx: 132, velocityPxPerSecond: 330, smoothness: 0.93, angleRadians: Math.PI * 0.5 });
const rushedAxeGesture = evaluatePhysicalToolGesture(PHYSICAL_TOOL_PROFILES.wood_axe, { travelPx: 150, velocityPxPerSecond: 1120, smoothness: 0.9, angleRadians: Math.PI * 0.5 });
const erraticAxeGesture = evaluatePhysicalToolGesture(PHYSICAL_TOOL_PROFILES.wood_axe, { travelPx: 170, velocityPxPerSecond: 350, smoothness: 0.28, angleRadians: Math.PI * 0.5 });
const pryGesture = evaluatePhysicalToolGesture(PHYSICAL_TOOL_PROFILES.iron_drain_bar, { travelPx: 145, velocityPxPerSecond: 170, smoothness: 0.91, angleRadians: -Math.PI * 0.5 });
assert.equal(knifeGesture.effective, true, 'The light Work Knife accepts a clean fast swipe.');
assert.equal(reverseKnifeGesture.effective, true, 'The Work Knife accepts the natural lower-right to upper-left cutting stroke as the reverse direction on its slash axis.');
assert.equal(crosswiseKnifeGesture.effective, false, 'The Work Knife still rejects a crosswise stroke outside its learned cutting axis.');
assert.equal(axeGesture.effective, true, 'The Wood Axe rewards a slower smooth committed chop.');
assert.equal(rushedAxeGesture.effective, false, 'An over-fast Axe swing remains visible input but is ineffective.');
assert.equal(erraticAxeGesture.effective, false, 'A squiggly Axe follow-through remains visible input but is ineffective.');
assert.equal(pryGesture.effective, true, 'The Drain Bar rewards a slow smooth lever direction.');
const toolEquipment = new EquipmentRuntime({
  weaponProfiles: equipmentRegistry.weapons,
  startingEquipment: { acquiredItemIds: ['unarmed', 'old_work_knife', 'wood_axe', 'iron_drain_bar'], equipped: { weapon: 'unarmed', tool: 'old_work_knife', offhand: null } },
});
const toolCamera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
const toolViewmodel = new PhysicalToolViewmodel({ camera: toolCamera, equipmentRuntime: toolEquipment });
toolViewmodel.update(1 / 60);
assert.ok(toolViewmodel.root.visible && toolViewmodel.toolGroups.get('old_work_knife').visible, 'Equipped Old Work Knife has a visible camera-local ready pose.');
const projectedVisibleFraction = (minimum, maximum) => Math.max(0, Math.min(1, maximum) - Math.max(-1, minimum)) / Math.max(0.001, maximum - minimum);
const assertPhysicalToolPlacement = (toolId, aspect, label) => {
  toolCamera.aspect = aspect;
  toolCamera.updateProjectionMatrix();
  if (toolId === 'wood_axe') {
    toolEquipment.equip('tool', null);
    toolEquipment.equip('weapon', 'wood_axe');
  } else {
    toolEquipment.equip('weapon', 'unarmed');
    toolEquipment.equip('tool', toolId);
  }
  toolViewmodel.update(1 / 60);
  const bounds = toolViewmodel.getProjectedBounds(toolId);
  assert.ok(bounds && bounds.minDepth < 1 && bounds.maxDepth > -1, `${label} placement is in front of the viewmodel camera.`);
  assert.ok(projectedVisibleFraction(bounds.minX, bounds.maxX) >= 0.9, `${label} keeps at least 90% of its width inside the camera frustum.`);
  assert.ok(projectedVisibleFraction(bounds.minY, bounds.maxY) >= 0.9, `${label} keeps at least 90% of its height inside the camera frustum.`);
};
for (const [aspect, viewportLabel] of [[16 / 9, 'desktop'], [390 / 702, 'portrait mobile']]) {
  assertPhysicalToolPlacement('old_work_knife', aspect, `${viewportLabel} Work Knife`);
  assertPhysicalToolPlacement('wood_axe', aspect, `${viewportLabel} Wood Axe`);
  assertPhysicalToolPlacement('iron_drain_bar', aspect, `${viewportLabel} Drain Bar`);
}
const controllerViewportRect = { left: 0, top: 0, width: 390, height: 702 };
const controllerViewport = {
  addEventListener() {}, removeEventListener() {}, setPointerCapture() {},
  getBoundingClientRect: () => controllerViewportRect,
  querySelector: () => null,
};
toolCamera.aspect = controllerViewportRect.width / controllerViewportRect.height;
toolCamera.updateProjectionMatrix();
toolEquipment.equip('weapon', 'unarmed');
toolEquipment.equip('tool', 'old_work_knife');
toolViewmodel.update(1 / 60);
const knifeGrab = toolViewmodel.getProjectedGrabPoint(controllerViewport);
assert.ok(knifeGrab, 'The portrait Work Knife exposes a visible physical grab/contact point.');
let controllerShedHits = 0;
const controllerTarget = {
  id: 'folsom_tool_shed_seam_growth', target: new THREE.Vector3(0, 0, -3), range: 3.25, contactRadiusPx: 62,
  acceptedToolId: 'old_work_knife', acceptedActionType: 'cut',
  requiredGesture: PHYSICAL_TOOL_PROFILES.old_work_knife,
  receivePhysicalToolEvent: () => { controllerShedHits += 1; return { accepted: true, changed: true, hit: true }; },
};
const toolController = new PhysicalToolActionController({
  app: controllerViewport, camera: toolCamera, player: { position: new THREE.Vector3(0, 0, 0) },
  dungeon: { getPhysicalToolTargets: () => [controllerTarget] }, equipmentRuntime: toolEquipment, viewmodel: toolViewmodel,
});
let simulatedToolTime = performance.now();
toolController.makeSample = (event) => ({ x: event.clientX, y: event.clientY, timeMs: (simulatedToolTime += 40) });
const toolPointerEvent = (x, y) => ({ clientX: x, clientY: y, pointerId: 7, preventDefault() {}, stopPropagation() {}, target: { closest: () => null } });
toolController.pointerDown(toolPointerEvent(knifeGrab.x, knifeGrab.y));
for (let step = 1; step <= 5; step += 1) {
  const progress = step / 5;
  toolController.pointerMove(toolPointerEvent(
    THREE.MathUtils.lerp(knifeGrab.x, controllerViewportRect.width * 0.5, progress),
    THREE.MathUtils.lerp(knifeGrab.y, controllerViewportRect.height * 0.5, progress),
  ));
}
toolController.pointerEnd(toolPointerEvent(controllerViewportRect.width * 0.5, controllerViewportRect.height * 0.5));
assert.equal(controllerShedHits, 1, 'A touch beginning on the visible portrait Knife and sweeping into centered shed growth produces a physical damage event.');
toolController.dispose();
toolEquipment.equip('tool', 'iron_drain_bar'); toolViewmodel.update(1 / 60);
assert.ok(toolViewmodel.toolGroups.get('iron_drain_bar').visible, 'Equipped Iron Drain Bar has a visible camera-local ready pose.');
toolEquipment.equip('weapon', 'wood_axe'); toolViewmodel.update(1 / 60);
assert.ok(toolViewmodel.toolGroups.get('wood_axe').visible, 'Selected Wood Axe has a visible camera-local ready pose.');
toolViewmodel.setGestureState({ active: true, deltaX: -90, deltaY: 130, travelPx: 158, planted: false });
toolViewmodel.update(1 / 30);
assert.ok(Math.abs(toolViewmodel.motionPivot.rotation.z) > 0.02, 'Visible held-tool motion follows the touch direction through a smoothed active pose.');
toolViewmodel.impact({ strength: 1 }); toolViewmodel.update(1 / 60);
assert.ok(toolViewmodel.recoilRemaining > 0, 'Physical tools enter impact recoil before returning to ready.');
toolViewmodel.dispose();
const rightHandEquipment = new EquipmentRuntime({
  weaponProfiles: equipmentRegistry.weapons,
  startingEquipment: { acquiredItemIds: ['unarmed', 'old_work_knife', 'wood_axe', 'iron_drain_bar'], equipped: { weapon: 'wood_axe', tool: 'old_work_knife' } },
});
const rightHandPanel = Object.assign(Object.create(EquipmentPanel.prototype), {
  equipmentRuntime: rightHandEquipment,
  survivalInventory: new SurvivalInventoryBridge({ equipmentRuntime: rightHandEquipment }),
  activePocket: 'weapons',
});
assert.equal(rightHandPanel.getRightHandDisplayName(), 'Wood Axe', 'Right-hand header reports the actually visible Axe when repairing an old conflicting save.');
const rightHandEntries = rightHandPanel.getPocketEntries(rightHandEquipment.getEquippedWeaponProfile());
assert.ok(rightHandEntries.some((entry) => entry.id === 'old_work_knife') && rightHandEntries.some((entry) => entry.id === 'iron_drain_bar'), 'Knife and Drain Bar are selectable in the Right Hand pocket.');
rightHandEntries.find((entry) => entry.id === 'old_work_knife').onActivate();
assert.equal(rightHandEquipment.getEquippedWeaponProfile().id, 'unarmed', 'Equipping the Knife clears an Axe/Rod from the same right hand.');
assert.equal(rightHandEquipment.getEquippedToolId(), 'old_work_knife', 'Right Hand selection equips the Knife into the physical tool slot.');
assert.equal(rightHandPanel.getRightHandDisplayName(), 'Old Work Knife', 'Right-hand header visibly confirms the equipped Work Knife.');
rightHandPanel.activePocket = 'keyItems';
assert.equal(rightHandPanel.getPocketEntries(rightHandEquipment.getEquippedWeaponProfile()).some((entry) => entry.id === 'old_work_knife'), false, 'The Work Knife is no longer mislabeled as a Key Item.');
const pickupEquipment = new EquipmentRuntime({
  weaponProfiles: equipmentRegistry.weapons,
  startingEquipment: { acquiredItemIds: ['unarmed', 'wood_axe'], equipped: { weapon: 'wood_axe', tool: null } },
});
const pickupInteractionRuntime = new Interactions({
  player: { position: new THREE.Vector3() },
  dungeon: { area: 'field', gameState: null, markInteractionCollected: () => true },
  equipmentRuntime: pickupEquipment,
  hud: { showHint: () => {}, showMessage: () => {}, updateFieldKitStatus: () => {} },
});
pickupInteractionRuntime.useEquipmentPickup({ id: 'knife-pickup-test', itemId: 'old_work_knife', acquiredMessage: 'Old Work Knife Acquired.' });
assert.equal(pickupEquipment.hasItem('old_work_knife'), true, 'Knife pickup still acquires the item.');
assert.equal(pickupEquipment.getEquippedWeaponProfile().id, 'wood_axe', 'Knife pickup does not replace the current right-hand weapon.');
assert.equal(pickupEquipment.getEquippedToolId(), null, 'Knife pickup does not auto-equip the physical tool slot.');

const interactionsSource = readFileSync(new URL('../src/game/Interactions.js', import.meta.url), 'utf8');
['strikeFolsomShedGrowth', 'strikeBeneathFolsomHiddenGrowthGate', 'clearFolsomGrowthAnchor', 'advanceFolsomShrineSideRoom', 'openFolsomShrineCrawlspace', 'pryBeneathFolsomDrainGrate', 'pryBeneathFolsomLowerShrineHatch', 'strikeBeneathFolsomWhiteScabLowerKnot', 'openUnderShrineLabyrinthEndHatch']
  .forEach((legacyDispatch) => assert.equal(interactionsSource.includes(legacyDispatch), false, `Interactions/A has no legacy blocker victory dispatch: ${legacyDispatch}.`));
const physicalRegistry = new PhysicalToolTargetRegistry();
const physicalGesture = { travelPx: 120, leverTravelPx: 110, velocityPxPerSecond: 280, smoothness: 0.94 };
const heavyPryGesture = { travelPx: 165, leverTravelPx: 148, velocityPxPerSecond: 185, smoothness: 0.92 };
const physicalContact = { screen: { x: 100, y: 100 } };

const folsom = getLocationDefinition('folsom');
assert.equal(hasLocationDefinition('beneath-folsom'), true, 'Beneath Folsom is registered.');
const beneathFolsom = await loadLocationDefinition('beneath-folsom');
const underShrineLabyrinth = await loadLocationDefinition('under-shrine-labyrinth');
const beneathFolsomRuntime = compileDungeonLocation(beneathFolsom, { logValidation: false });
const underShrineLabyrinthRuntime = compileDungeonLocation(underShrineLabyrinth, { logValidation: false });
assert.ok(folsom, 'Folsom definition is registered.');
assert.equal(folsom.id, 'folsom');
assert.equal((folsom.spawns ?? []).some((spawn) => ['enemy', 'npc'].includes(spawn.kind)), false, 'Folsom has no enemy or NPC spawns.');
assert.ok((folsom.waterBodies ?? []).some((water) => water.fishable), 'Folsom keeps fishable pond.');

const borderWalls = (folsom.wallSegments ?? []).filter((wall) => wall.tags?.includes('city-border-wall'));
const borderSeamPosts = (folsom.architecturalPrimitives ?? []).filter((primitive) => primitive.tags?.includes('city-border-wall-post'));
const borderValidation = folsom.validation?.cityBorderWoodenWall;
assert.equal(folsom.validation?.cityBorderWoodenWall?.continuousMembrane, true, 'Folsom border uses continuous membrane authoring.');
assert.equal(borderWalls.length, 17, 'Folsom border compiles to one wall run for every perimeter edge.');
assert.equal(borderSeamPosts.length, 0, 'Continuous Folsom wall does not stack decorative posts at every former panel seam.');
assert.ok(borderWalls.every((wall) => wall.y === 0 && wall.tags.includes('fixed-elevation') && wall.tags.includes('continuous-wall-membrane')), 'Every Folsom border run shares one flush elevation.');
assert.ok(borderWalls.every((wall) => wall.textureRepeat?.[0] >= 1 && wall.textureRepeat?.[1] === 1), 'Long wall runs preserve readable tiled wood texture scale.');
assert.equal(borderValidation.gateOpenings.length, 0, 'Folsom perimeter does not leave empty spans for inset or future gate props.');
assert.equal(borderValidation.generatedRuns.length, borderValidation.perimeter.length - 1, 'Every authored perimeter edge generates wall coverage.');
assert.ok(borderValidation.generatedRuns.every((run) => run.startT === 0 && run.endT === 1), 'Every perimeter edge is covered end to end without a cut interval.');
const folsomCollision = buildDungeonCollision(folsom);
assert.ok(folsomCollision.collisionWorld.getIntersectingBlockers(new THREE.Vector3(88, 1.55, 4)).some((blocker) => blocker.tags?.includes('city-border-wall')), 'The former east gate gap now has wooden wall collision.');
assert.ok(folsomCollision.collisionWorld.getIntersectingBlockers(new THREE.Vector3(0, 1.55, 96)).some((blocker) => blocker.tags?.includes('city-border-wall')), 'The former north road gap now has wooden wall collision.');

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
const underworksInteraction = (folsom.outdoorInteractions ?? []).find((interaction) => interaction.id === 'folsom_underworks_locked');
const underworksReturnSpawn = (folsom.spawns ?? []).find((spawn) => spawn.id === 'folsom_underworks_return');
const growthNetwork = folsom.connectedGrowthNetwork;
const shrineSideRoomFloor = (folsom.polygonFloors ?? []).find((floor) => floor.id === 'folsom_shrine_side_room_floor');
const shrineCrawlspaceFloor = (folsom.polygonFloors ?? []).find((floor) => floor.id === 'folsom_shrine_crawlspace_floor');
const shrineSideDoor = (folsom.architecturalPrimitives ?? []).find((primitive) => primitive.id === 'folsom_shrine_side_room_door');
const shrineCrawlspacePanel = (folsom.architecturalPrimitives ?? []).find((primitive) => primitive.id === 'folsom_shrine_crawlspace_panel');
const shrineCrawlspaceStop = (folsom.architecturalPrimitives ?? []).find((primitive) => primitive.id === 'folsom_shrine_crawlspace_terminal_slab');
const shrineSideSealInteraction = (folsom.outdoorInteractions ?? []).find((interaction) => interaction.type === 'folsomShrineSideRoomSeal');
const shrineCrawlspaceInteraction = (folsom.outdoorInteractions ?? []).find((interaction) => interaction.type === 'folsomShrineCrawlspacePanel');
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
assert.equal(underworksInteraction?.targetLocationId, 'beneath-folsom', 'The Underworks interaction targets Beneath Folsom.');
assert.equal(underworksInteraction?.destinationSpawnId, 'beneath_folsom_underworks_arrival', 'The Underworks interaction targets the safe underground arrival spawn.');
assert.equal(underworksInteraction?.requiredWorldState, 'folsom_underworks_growth_unsealed', 'The Underworks transition is gated by the existing unsealed world-state flag.');
assert.equal(underworksReturnSpawn?.userData?.returnFromLocation, 'beneath-folsom', 'Folsom authors a return spawn beside the opened Underworks gate.');
assert.ok(shrineSideRoomFloor?.tags?.includes('keeper-maintenance-space'), 'Folsom authors a physical shrine-keeper side-room floor.');
assert.ok(shrineCrawlspaceFloor?.tags?.includes('under-shrine-maintenance'), 'Folsom authors a physical under-shrine crawlspace floor.');
assert.ok(shrineSideDoor?.blocksPlayer && shrineSideDoor.tags?.includes('growth-sealed'), 'The shrine side room begins behind a physical growth-sealed door.');
assert.ok(shrineCrawlspacePanel?.blocksPlayer && shrineCrawlspacePanel.tags?.includes('lantern-readable-edge'), 'The crawlspace begins behind a physical Lantern-readable panel.');
assert.ok(shrineCrawlspaceStop?.blocksPlayer && shrineCrawlspaceStop.tags?.includes('no-route-bypass'), 'The crawlspace ends at a solid maintenance throat and cannot bypass Underworks.');
assert.equal(shrineSideSealInteraction?.type, 'folsomShrineSideRoomSeal', 'The side-room seal has a dedicated staged interaction.');
assert.equal(shrineCrawlspaceInteraction?.type, 'folsomShrineCrawlspacePanel', 'The crawlspace panel has a dedicated interaction.');
assert.equal(FOLSOM_SHRINE_INVESTIGATION_RULES.sideRoomSaveKey, 'folsom_shrine_side_room_open');
assert.equal(FOLSOM_SHRINE_INVESTIGATION_RULES.networkRevealSaveKey, 'folsom_under_shrine_network_revealed');
assert.equal(FOLSOM_SHRINE_INVESTIGATION_RULES.crawlspaceSaveKey, 'folsom_shrine_crawlspace_open');
assert.deepEqual(FOLSOM_SHRINE_INVESTIGATION_RULES.sideSealSequence, ['knife-cords', 'axe-knot', 'open']);
const folsomPhysicalTargets = folsom.physicalToolTargets ?? [];
assert.deepEqual(folsomPhysicalTargets.map((target) => target.id).sort(), [
  'folsom_growth_anchor_fire', 'folsom_growth_anchor_pond', 'folsom_growth_anchor_shrine',
  'folsom_shrine_crawlspace_panel', 'folsom_shrine_side_room_seal', 'folsom_tool_shed_seam_growth',
].sort(), 'Folsom authors every shed, shrine, and surface endpoint as a physical tool target.');
assert.equal(folsomPhysicalTargets.find((target) => target.id === 'folsom_tool_shed_seam_growth')?.completionSaveKey, 'folsom_tool_shed_open');
assert.equal(folsomPhysicalTargets.find((target) => target.id === 'folsom_growth_anchor_fire')?.acceptedToolId, 'wood_axe', 'The fire-hardened endpoint now uses a physical Axe chop, not an interaction/Torch token check.');
assert.ok(folsomPhysicalTargets.every((target) => target.completionSaveKey && target.failFeedback), 'Every Folsom physical target declares persistence and physical refusal feedback.');
const proofStorageValues = new Map();
const proofStorage = {
  get length() { return proofStorageValues.size; }, key: (index) => [...proofStorageValues.keys()][index] ?? null,
  getItem: (key) => proofStorageValues.get(key) ?? null, setItem: (key, value) => proofStorageValues.set(key, String(value)), removeItem: (key) => proofStorageValues.delete(key),
};
const proofState = new GameState(proofStorage);
const proofScene = new THREE.Scene();
const proofCollision = { blockerRects: [], removeBlocker() {} };
const proofTextureLoader = { load: () => new THREE.Texture() };
const proofShedRuntime = new FolsomShedGrowthRuntime({ scene: proofScene, collision: proofCollision, compiledGroup: new THREE.Group(), gameState: proofState, textureLoader: proofTextureLoader });
const proofShrineRuntime = new FolsomShrineInvestigationRuntime({ scene: proofScene, collision: proofCollision, compiledGroup: new THREE.Group(), gameState: proofState, textureLoader: proofTextureLoader, getEmitterState: () => null });
const folsomProofHarness = Object.assign(Object.create(DungeonScene.prototype), {
  folsomShedGrowthRuntime: proofShedRuntime,
  folsomShrineInvestigationRuntime: proofShrineRuntime,
  gameState: proofState,
  outdoorInteractions: [],
});
let shedPhysicalTarget = folsomProofHarness.getPhysicalToolTargets().find((target) => target.id === 'folsom_tool_shed_seam_growth');
assert.equal(physicalRegistry.evaluate(shedPhysicalTarget, { toolId: 'wood_axe', actionType: 'chop', gesture: physicalGesture, contact: physicalContact }).accepted, false, 'Shed seam rejects a cosmetic/wrong Axe swing.');
for (let hit = 1; hit <= 3; hit += 1) {
  shedPhysicalTarget = folsomProofHarness.getPhysicalToolTargets().find((target) => target.id === 'folsom_tool_shed_seam_growth');
  const result = physicalRegistry.evaluate(shedPhysicalTarget, { toolId: 'old_work_knife', actionType: 'cut', gesture: physicalGesture, contact: physicalContact });
  assert.equal(result.accepted, true, `Shed seam accepts physical knife cut ${hit}.`);
  assert.equal(result.completed, hit === 3, `Shed seam completion state is correct after cut ${hit}.`);
}
assert.equal(proofState.isFolsomToolShedOpen(), true, 'Exactly three physical cuts preserve folsom_tool_shed_open.');
let sideSealTarget = folsomProofHarness.getPhysicalToolTargets().find((target) => target.id === 'folsom_shrine_side_room_seal');
assert.equal(physicalRegistry.evaluate(sideSealTarget, { toolId: 'wood_axe', actionType: 'chop', gesture: physicalGesture, contact: physicalContact }).accepted, false, 'Axe cannot bypass the Shrine Side Room cord stage.');
assert.equal(physicalRegistry.evaluate(sideSealTarget, { toolId: 'old_work_knife', actionType: 'cut', gesture: physicalGesture, contact: physicalContact }).accepted, true, 'Knife physically cuts and slackens the side-room cords.');
sideSealTarget = folsomProofHarness.getPhysicalToolTargets().find((target) => target.id === 'folsom_shrine_side_room_seal');
assert.equal(sideSealTarget.acceptedToolId, 'wood_axe', 'The side-room target advances to the authored Axe knot stage.');
assert.equal(physicalRegistry.evaluate(sideSealTarget, { toolId: 'wood_axe', actionType: 'chop', gesture: physicalGesture, contact: physicalContact }).accepted, true, 'A physical Axe chop breaks the exposed hard knot.');
assert.equal(proofState.isFolsomShrineSideRoomOpen(), true, 'The physical staged seal preserves folsom_shrine_side_room_open.');
assert.equal(folsomProofHarness.getPhysicalToolTargets().find((target) => target.id === 'folsom_shrine_crawlspace_panel')?.available, false, 'Crawlspace has no actionable physical zone before Lantern network reveal.');
proofShrineRuntime.markNetworkRevealed();
const crawlspaceTarget = folsomProofHarness.getPhysicalToolTargets().find((target) => target.id === 'folsom_shrine_crawlspace_panel');
assert.equal(physicalRegistry.evaluate(crawlspaceTarget, { toolId: 'old_work_knife', actionType: 'cut', gesture: physicalGesture, contact: physicalContact }).accepted, true, 'Knife contact physically clears the revealed crawlspace cords.');
assert.equal(proofState.isFolsomShrineCrawlspaceOpen(), true, 'Physical crawlspace clear preserves folsom_shrine_crawlspace_open.');
const reloadedProofScene = new THREE.Scene();
const reloadedShed = new FolsomShedGrowthRuntime({ scene: reloadedProofScene, collision: proofCollision, compiledGroup: new THREE.Group(), gameState: new GameState(proofStorage), textureLoader: proofTextureLoader });
const reloadedShrine = new FolsomShrineInvestigationRuntime({ scene: reloadedProofScene, collision: proofCollision, compiledGroup: new THREE.Group(), gameState: new GameState(proofStorage), textureLoader: proofTextureLoader, getEmitterState: () => null });
assert.ok(reloadedShed.open && reloadedShed.growthGroup.visible === false, 'An old completed shed save loads open with no blocker replay.');
assert.ok(reloadedShrine.sideRoomOpen && reloadedShrine.crawlspaceOpen, 'Old completed shrine blocker saves load open without physical re-clearing.');
const labyrinthProofHarness = Object.assign(Object.create(DungeonScene.prototype), { gameState: proofState, scene: new THREE.Scene(), collision: underShrineLabyrinthRuntime.collisionWorld });
labyrinthProofHarness.configureUnderShrineLabyrinth(underShrineLabyrinthRuntime);
const endHatchTarget = labyrinthProofHarness.getPhysicalToolTargets().find((target) => target.id === 'under_shrine_labyrinth_end_hatch');
assert.equal(physicalRegistry.evaluate(endHatchTarget, { toolId: 'old_work_knife', actionType: 'cut', gesture: physicalGesture, contact: physicalContact }).accepted, false, 'Labyrinth hatch rejects a knife swing.');
assert.equal(physicalRegistry.evaluate(endHatchTarget, { toolId: 'iron_drain_bar', actionType: 'pry', gesture: heavyPryGesture, contact: physicalContact }).accepted, true, 'Labyrinth end hatch now requires a physical Drain Bar lever action.');
assert.equal(proofState.isUnderShrineLabyrinthEndHatchOpen(), true, 'Physical end-hatch pry preserves under_shrine_labyrinth_end_hatch_open.');
const reloadedLabyrinthRuntime = compileDungeonLocation(underShrineLabyrinth, { logValidation: false });
const reloadedLabyrinthHarness = Object.assign(Object.create(DungeonScene.prototype), { gameState: new GameState(proofStorage), scene: new THREE.Scene(), collision: reloadedLabyrinthRuntime.collisionWorld });
reloadedLabyrinthHarness.configureUnderShrineLabyrinth(reloadedLabyrinthRuntime);
assert.equal(reloadedLabyrinthRuntime.collisionWorld.blockerRects.some((blocker) => blocker.id === 'under_shrine_labyrinth_end_hatch_blocker'), false, 'An old completed end-hatch save removes its blocker without re-clearing.');
assert.equal(growthNetwork.revealStateKey, 'folsom_under_shrine_network_revealed', 'The connected network is explicitly owned by the Lantern reveal state.');
assert.equal(equipmentRegistry.items.keepers_lantern.source, 'folsom_shrine_side_room_keepers_lantern_pickup', 'The Shrine Side Room is the canonical Keeper\'s Lantern source.');

assert.equal(beneathFolsom.id, 'beneath-folsom');
assert.equal(beneathFolsom.displayName, 'Beneath Folsom');
assert.equal(beneathFolsom.fog?.color, beneathFolsom.lighting?.background, 'Beneath Folsom distance fog falls into the same dark murk as the scene background.');
assert.equal(beneathFolsomRuntime.validation.ok, true, `Beneath Folsom compiles cleanly: ${beneathFolsomRuntime.validation.errors.join('; ')}`);
const beneathArrival = beneathFolsomRuntime.spawnAnchors.find((spawn) => spawn.id === 'beneath_folsom_underworks_arrival' && spawn.kind === 'player');
assert.ok(beneathArrival, 'Beneath Folsom has a valid player arrival spawn.');
assert.equal(beneathFolsomRuntime.collisionWorld.canStandAt(beneathArrival.position), true, 'The Beneath Folsom arrival spawn is on navigable collision.');
assert.deepEqual(beneathFolsomRuntime.collisionWorld.getIntersectingBlockers(beneathArrival.position), [], 'The Beneath Folsom arrival spawn does not intersect a blocker.');
const beneathReturn = beneathFolsomRuntime.exits.find((exit) => exit.id === 'beneath_folsom_return_to_folsom');
const drainBarPickup = (beneathFolsom.interactions ?? []).find((interaction) => interaction.itemId === 'iron_drain_bar');
const drainGrateInteraction = (beneathFolsom.interactions ?? []).find((interaction) => interaction.type === 'beneathFolsomDrainGrate');
const drainGrateBlocker = beneathFolsomRuntime.blockerRects.find((blocker) => blocker.id === 'beneath_folsom_drain_grate_blocker');
const keepersLanternPickup = (beneathFolsom.interactions ?? []).find((interaction) => interaction.itemId === 'keepers_lantern');
const lanternRevealProps = (beneathFolsom.props ?? []).filter((prop) => prop.tags?.includes('keepers-lantern-revealed'));
const lanternGlyphDecals = (beneathFolsom.props ?? []).filter((prop) => prop.tags?.includes('lantern-reveal-decal'));
const lowerWallLanternGlyphDecals = lanternGlyphDecals.filter((prop) => prop.id.startsWith('beneath_folsom_lower_wall_glyph_cluster_'));
const hiddenGrowthGateBlocker = beneathFolsomRuntime.blockerRects.find((blocker) => blocker.id === 'beneath_folsom_hidden_growth_gate_blocker');
const blueHall = (beneathFolsom.rooms ?? []).find((room) => room.id === 'BF04');
assert.equal(beneathReturn?.toLocation, 'folsom', 'Beneath Folsom has a return route to Folsom.');
assert.equal(beneathReturn?.destinationSpawnId, 'folsom_underworks_return', 'The return route targets the Folsom Underworks return spawn.');
assert.equal((beneathFolsom.spawns ?? []).some((spawn) => ['enemy', 'npc'].includes(spawn.kind)), false, 'Beneath Folsom Entry V1 has no enemies or NPCs.');
assert.equal((beneathFolsom.encounterZones ?? []).length, 0, 'Beneath Folsom Entry V1 has no encounter zones.');
const beneathFolsomSource = JSON.stringify(beneathFolsom).toLowerCase();
['records ui', 'memory ui', 'pale gate', 'root-taken knight', 'white machinery', 'boss'].forEach((deferredFeature) => {
  assert.equal(beneathFolsomSource.includes(deferredFeature), false, `Beneath Folsom does not add deferred feature: ${deferredFeature}.`);
});
assert.equal(drainBarPickup?.itemId, 'iron_drain_bar', 'Beneath Folsom authors the Iron Drain Bar pickup.');
assert.equal(drainBarPickup?.type, 'equipmentPickup', 'Iron Drain Bar uses the persistent equipment pickup path.');
assert.ok(Math.hypot(drainBarPickup.target.x - beneathArrival.position.x, drainBarPickup.target.z - beneathArrival.position.z) > 8, 'Iron Drain Bar is not placed on the player spawn.');
assert.equal(drainGrateInteraction?.requiredItemId, 'iron_drain_bar', 'The jammed grate requires the Iron Drain Bar.');
assert.equal(drainGrateInteraction?.saveKey, 'beneath_folsom_drain_grate_pried', 'The grate maps to the locked world-state key.');
assert.equal(drainGrateBlocker?.userData?.saveKey, 'beneath_folsom_drain_grate_pried', 'The closed grate collision maps to persisted state.');
const beneathPhysicalTargets = beneathFolsom.physicalToolTargets ?? [];
assert.deepEqual(beneathPhysicalTargets.map((target) => target.id).sort(), [
  'beneath_folsom_drain_grate', 'beneath_folsom_hidden_growth_gate', 'beneath_folsom_lower_shrine_hatch', 'beneath_folsom_white_scab_lower_knot',
].sort(), 'Beneath Folsom authors every current growth/pry blocker as a physical target.');
assert.equal(beneathPhysicalTargets.find((target) => target.id === 'beneath_folsom_hidden_growth_gate')?.requiredHits, 5, 'Hidden gate preserves exactly five physical knife contacts.');
assert.deepEqual(beneathPhysicalTargets.find((target) => target.id === 'beneath_folsom_lower_shrine_hatch')?.prerequisites, ['beneath_folsom_hidden_growth_gate_cleared'], 'Lower hatch preserves the hidden-gate prerequisite.');
assert.equal(underShrineLabyrinth.physicalToolTargets?.[0]?.acceptedToolId, 'iron_drain_bar', 'The labyrinth end hatch no longer has an interaction-only opening path.');
assert.ok(drainGrateBlocker?.tags?.includes('blocks-deeper-access'), 'The intact grate explicitly blocks deeper access.');
assert.ok((beneathFolsom.rooms ?? []).some((room) => room.id === 'BF03' && room.tags?.includes('opened-threshold')), 'A small drain-throat alcove exists beyond the grate.');
assert.equal(beneathFolsomRuntime.collisionWorld.getIntersectingBlockers(new THREE.Vector3(0, 1.55, 13.5)).some((blocker) => blocker.id === drainGrateBlocker.id), true, 'Closed grate collision prevents crossing the threshold.');
assert.equal(keepersLanternPickup, undefined, "Beneath Folsom no longer duplicates the Keeper's Lantern pickup.");
assert.ok((beneathFolsom.props ?? []).some((prop) => prop.id === 'beneath_folsom_keeper_niche_empty_hook'), 'The retired BF03 Lantern niche remains as an empty environmental trace.');
assert.ok(lanternRevealProps.length >= 6 && lanternRevealProps.every((prop) => prop.userData?.hiddenByDefault && prop.userData?.revealItemId === 'keepers_lantern'), 'The bounded route-truth cluster is hidden under normal light and mapped only to the lantern.');
assert.ok(lowerWallLanternGlyphDecals.length >= 6, 'Beneath Folsom authors a multi-piece lantern-cone glyph cluster.');
assert.ok(lowerWallLanternGlyphDecals.every((prop) => prop.userData.revealMode === 'lanternCone' && prop.userData.hiddenOpacity === 0), 'Every glyph cluster decal defaults to true zero opacity and uses the lantern cone runtime.');
assert.ok(lowerWallLanternGlyphDecals.every((prop) => prop.userData.revealDistance === 4 && prop.userData.revealConeDegrees === 40
  && prop.userData.nearFieldRevealRadius >= 1.25 && prop.userData.nearFieldConeDegrees >= 70
  && prop.userData.exitConePaddingDegrees > 0 && prop.userData.exitDistancePadding > 0
  && prop.userData.revealLingerSeconds >= 0.15), 'The cluster authors a forgiving but bounded reveal wash with near-field grace, hysteresis, and short linger.');
assert.ok(lowerWallLanternGlyphDecals.every((prop) => prop.position.z > 21 && prop.tags.includes('blocked-future-route')), 'The cone-reveal cluster is surface-bound at the sealed lower wall.');
const clusterGlyphAssetPaths = [...new Set(lowerWallLanternGlyphDecals
  .map((prop) => beneathFolsom.textures[prop.material]?.path)
  .filter((assetPath) => assetPath?.startsWith('./assets/revealed_glyphs/')))];
assert.ok(clusterGlyphAssetPaths.length >= 2, 'The lower-wall cluster uses at least two committed revealed-glyph PNG assets.');
clusterGlyphAssetPaths.forEach((assetPath) => assert.equal(existsSync(path.join(repoRoot, 'public', assetPath.replace('./assets/', 'assets/'))), true, `Cluster glyph exists: ${assetPath}`));
['beneath_folsom_lantern_reveal_trace_01', 'beneath_folsom_lantern_reveal_trace_02', 'beneath_folsom_hidden_growth_pull', 'beneath_folsom_lantern_glyph_test_01'].forEach((oldPropId) => {
  assert.equal((beneathFolsom.props ?? []).some((prop) => prop.id === oldPropId), false, `Old strip/test prop is removed: ${oldPropId}.`);
});
assert.equal((beneathFolsom.interactions ?? []).some((interaction) => interaction.type === 'keepersLanternTrace'), false, 'The capstone has no inspect-based clue interaction or explanatory prompt.');
assert.equal(BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_RULES.hitsRequired, 5, 'Hidden growth requires exactly five successful hits.');
assert.equal(BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_RULES.revealItemId, 'keepers_lantern', 'Only the Keeper\'s Lantern reveals the hidden gate.');
assert.equal(BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_RULES.saveKey, 'beneath_folsom_hidden_growth_gate_cleared');
assert.equal(hiddenGrowthGateBlocker?.userData?.hitsRequired, 5, 'The authored gate blocker matches the five-hit runtime rule.');
assert.equal(beneathFolsomRuntime.collisionWorld.getIntersectingBlockers(new THREE.Vector3(0, 1.55, 21.7)).some((blocker) => blocker.id === hiddenGrowthGateBlocker.id), true, 'The intact hidden-growth wall physically blocks the blue hallway.');
assert.ok(blueHall && blueHall.maxZ - blueHall.minZ >= 36 && blueHall.tags.includes('chapter-3-seam'), 'The long blue-flame threshold hallway remains the Chapter 2-to-3 seam.');
assert.ok((beneathFolsom.props ?? []).filter((prop) => prop.tags?.includes('blue-flame-hallway')).length >= 15, 'The hallway has repeated architectural ribs guiding the eye forward.');
assert.deepEqual((beneathFolsom.rooms ?? []).filter((room) => /^BF0[5-9]$/.test(room.id)).map((room) => room.id), ['BF05', 'BF06', 'BF07', 'BF08', 'BF09'], 'The preserved Chapter 3 room skeleton remains authored after the blue hall.');
assert.equal(equipmentRegistry.items.keepers_lantern?.itemType, 'offhand', "Keeper's Lantern is registered as offhand equipment.");
assert.equal(equipmentRegistry.items.keepers_lantern?.slot, 'offhand', "Keeper's Lantern uses the shared offhand slot without changing its item id.");
assert.equal(KEEPERS_LANTERN_ITEM_ID, 'keepers_lantern', "Keeper's Lantern viewmodel keeps the existing persistent item id.");
assert.deepEqual(KEEPERS_LANTERN_EMITTER, { coneAngleDegrees: 40, range: 4 }, 'Lantern emitter authors a forgiving close/medium reveal wash.');
assert.equal(LANTERN_REVEAL_DEFAULTS.revealDistance, KEEPERS_LANTERN_EMITTER.range, 'Reveal runtime range matches the physical offhand emitter.');
assert.equal(LANTERN_REVEAL_DEFAULTS.revealConeDegrees, KEEPERS_LANTERN_EMITTER.coneAngleDegrees, 'Reveal runtime cone matches the physical offhand emitter.');
assert.ok(KEEPERS_LANTERN_LIGHTING.point.distance >= 18 && KEEPERS_LANTERN_LIGHTING.point.intensity >= 4.5, 'Keeper lantern has useful shadowless local fill beyond its glyph reveal range.');
assert.ok(KEEPERS_LANTERN_LIGHTING.wash.distance >= 28 && KEEPERS_LANTERN_LIGHTING.wash.angle >= 0.75 && KEEPERS_LANTERN_LIGHTING.wash.penumbra >= 0.8, 'Keeper lantern has a broad soft navigation wash rather than a tiny reveal beam.');
const lanternLightColor = new THREE.Color(KEEPERS_LANTERN_LIGHTING.wash.color);
assert.ok(lanternLightColor.g >= lanternLightColor.r && Math.abs(lanternLightColor.r - lanternLightColor.b) < 0.05, 'Keeper lantern illumination remains balanced pale green-white rather than Torch-warm.');
const lanternCamera = new THREE.PerspectiveCamera();
lanternCamera.position.set(4, 2, -3);
lanternCamera.rotation.set(0.08, 0.45, 0, 'YXZ');
let lanternEquippedOffhand = null;
const lanternViewmodel = new KeepersLanternViewmodel({
  camera: lanternCamera,
  equipmentRuntime: {
    hasItem: (itemId) => itemId === 'keepers_lantern',
    getEquippedOffhandId: () => lanternEquippedOffhand,
  },
});
lanternViewmodel.update(1 / 60);
assert.equal(lanternViewmodel.getEmitterState().active, false, 'Owning the lantern alone does not display the offhand viewmodel.');
lanternEquippedOffhand = 'keepers_lantern';
lanternViewmodel.update(1 / 60);
const lanternEmitterState = lanternViewmodel.getEmitterState();
assert.equal(lanternEmitterState.active, true, 'Equipped Keeper\'s Lantern activates its offhand viewmodel emitter.');
assert.equal(lanternEmitterState.itemId, 'keepers_lantern');
assert.ok(lanternEmitterState.worldPosition.isVector3 && lanternEmitterState.worldDirection.isVector3, 'Lantern emitter exposes world position and world direction vectors.');
assert.ok(lanternEmitterState.worldDirection.lengthSq() > 0.99 && lanternEmitterState.source === 'keepers-lantern-emitter-transform', 'Lantern direction comes from its hanging body emitter transform.');
assert.ok(lanternEmitterState.worldPosition.distanceTo(lanternCamera.position) > 0.4, 'Lantern emitter is physically offset from camera center.');
assert.ok(lanternCamera.worldToLocal(lanternEmitterState.worldPosition.clone()).x < 0, 'Lantern occupies the left/offhand side of the camera view.');
assert.equal(lanternViewmodel.coldLight.castShadow, false, 'Lantern light stays mobile-friendly and shadowless.');
assert.equal(lanternViewmodel.coldRevealSpotLight.castShadow, false, 'Broad lantern wash stays mobile-friendly and shadowless.');
assert.equal(lanternViewmodel.coldLight.distance, KEEPERS_LANTERN_LIGHTING.point.distance, 'Physical lantern body carries the authored local fill.');
assert.equal(lanternViewmodel.coldRevealSpotLight.distance, KEEPERS_LANTERN_LIGHTING.wash.distance, 'General illumination range is independent from the shorter glyph reveal range.');
assert.ok(lanternViewmodel.coldRevealSpotLight.distance > KEEPERS_LANTERN_EMITTER.range * 6, 'Lantern lights normal geometry well beyond its bounded hidden-glyph reveal distance.');
assert.ok(lanternViewmodel.coldRevealSpotLight.penumbra >= 0.8, 'Lantern navigation wash has a soft edge instead of a laser profile.');
assert.equal(lanternCamera.children.includes(lanternViewmodel.root), true, 'Lantern is a camera-attached held viewmodel.');
const emitterPositionBeforeMotion = lanternEmitterState.worldPosition.clone();
lanternCamera.position.x += 0.2;
lanternViewmodel.update(1 / 30);
assert.ok(lanternViewmodel.getEmitterState().worldPosition.distanceTo(emitterPositionBeforeMotion) > 0.1, 'Emitter world transform follows translation of the lantern viewmodel.');
lanternCamera.rotation.y += 0.12;
lanternViewmodel.update(1 / 30);
assert.ok(Math.abs(lanternViewmodel.hangingBody.rotation.x) <= THREE.MathUtils.degToRad(7.01)
  && Math.abs(lanternViewmodel.hangingBody.rotation.y) <= THREE.MathUtils.degToRad(5.01)
  && Math.abs(lanternViewmodel.hangingBody.rotation.z) <= THREE.MathUtils.degToRad(8.01), 'Lantern sway reacts to movement and turning but remains bounded.');
lanternViewmodel.dispose();
const lanternStorageValues = new Map();
const lanternStorage = {
  get length() { return lanternStorageValues.size; }, key: (index) => [...lanternStorageValues.keys()][index] ?? null,
  getItem: (key) => lanternStorageValues.get(key) ?? null, setItem: (key, value) => lanternStorageValues.set(key, String(value)), removeItem: (key) => lanternStorageValues.delete(key),
};
const lanternGameState = new GameState(lanternStorage);
const offhandRuntime = new EquipmentRuntime({
  weaponProfiles: equipmentRegistry.weapons,
  startingEquipment: { acquiredItemIds: ['unarmed', 'torch', 'keepers_lantern'], equipped: { weapon: 'unarmed', offhand: 'torch' } },
});
const offhandBridge = new SurvivalInventoryBridge({ equipmentRuntime: offhandRuntime, gameState: lanternGameState });
assert.equal(offhandBridge.equipOffhand('keepers_lantern'), true, 'Owned Keeper\'s Lantern can be equipped through the existing offhand bridge.');
assert.equal(offhandRuntime.getEquippedOffhandId(), 'keepers_lantern', 'Equipping the lantern replaces Torch in the shared offhand slot.');
lanternGameState.saveEquipmentSnapshot(offhandRuntime.getSnapshot());
assert.equal(new GameState(lanternStorage).getEquipmentSnapshot().equipped.offhand, 'keepers_lantern', 'Keeper\'s Lantern offhand selection persists through equipment save repair.');
assert.equal(offhandBridge.equipOffhand('torch'), true, 'Torch can be re-equipped after the lantern.');
assert.equal(offhandRuntime.getEquippedOffhandId(), 'torch', 'Re-equipping Torch cleanly deactivates the lantern slot state.');
const lanternSceneHarness = Object.assign(Object.create(DungeonScene.prototype), {
  inspectInteractions: (beneathFolsom.interactions ?? []).map((interaction) => ({ ...interaction, target: new THREE.Vector3(interaction.target.x, interaction.target.y, interaction.target.z) })),
  gameState: lanternGameState, collision: beneathFolsomRuntime.collisionWorld, beneathFolsomLanternRevealObjects: [],
  scene: new THREE.Scene(), textureLoader: { load: () => new THREE.Texture() },
});
lanternSceneHarness.configureBeneathFolsomDrainLoop(beneathFolsomRuntime);
const hiddenGateRuntime = lanternSceneHarness.beneathFolsomHiddenGrowthGateRuntime;
const initialBeneathPhysicalTargets = lanternSceneHarness.getPhysicalToolTargets();
const physicalDrainTarget = initialBeneathPhysicalTargets.find((target) => target.id === 'beneath_folsom_drain_grate');
const lockedLowerHatchTarget = initialBeneathPhysicalTargets.find((target) => target.id === 'beneath_folsom_lower_shrine_hatch');
assert.equal(physicalRegistry.evaluate(physicalDrainTarget, { toolId: 'old_work_knife', actionType: 'cut', gesture: physicalGesture, contact: physicalContact }).accepted, false, 'Knife contact cannot pry the drain grate.');
assert.equal(lanternGameState.isBeneathFolsomDrainGratePried(), false, 'Wrong drain-grate contact writes no state.');
assert.equal(physicalRegistry.evaluate(lockedLowerHatchTarget, { toolId: 'iron_drain_bar', actionType: 'pry', gesture: heavyPryGesture, contact: physicalContact }).accepted, false, 'Lower shrine hatch rejects the bar before hidden-gate clear.');
assert.equal(lanternGameState.isBeneathFolsomLowerShrineHatchOpen(), false, 'Premature lower-hatch pry writes no state.');
assert.equal(physicalRegistry.evaluate(physicalDrainTarget, { toolId: 'iron_drain_bar', actionType: 'pry', gesture: physicalGesture, contact: physicalContact }).accepted, true, 'A planted Drain Bar lever action pries the drain grate.');
assert.equal(lanternGameState.isBeneathFolsomDrainGratePried(), true, 'Physical grate pry preserves the existing save key.');
const hiddenGateRevealObjects = hiddenGateRuntime.getRevealObjects();
assert.ok(hiddenGateRevealObjects.length >= 14 && hiddenGateRuntime.cords.length >= 10, 'The hidden gate is a dense field of thick vertical growth cords and scabs.');
assert.equal(lanternSceneHarness.beneathFolsomLanternRevealObjects.length, lanternGlyphDecals.length + hiddenGateRevealObjects.length, 'The scene tracks both the glyph cluster and physical hidden-growth seal.');
assert.ok(lanternSceneHarness.beneathFolsomLanternRevealObjects.every((object) => object.visible === false), 'Lantern-only gate art does not render in the normal runtime view.');
assert.ok(lanternSceneHarness.lanternConeRevealRuntime instanceof LanternConeRevealRuntime, 'Beneath Folsom uses the explicit lantern cone reveal runtime.');
assert.equal(lanternSceneHarness.lanternConeRevealRuntime.entries.length, lanternGlyphDecals.length + hiddenGateRevealObjects.length, 'Active scene tracks the complete lantern-reveal target list.');
const liveGlyphEntry = lanternSceneHarness.lanternConeRevealRuntime.entries.find((entry) => entry.object.name === lanternGlyphDecals[0].id);
assert.equal(liveGlyphEntry.object.geometry.type, 'PlaneGeometry', 'Lantern reveal decal compiles as a transparent plane instead of a box.');
assert.ok(clusterGlyphAssetPaths.includes(liveGlyphEntry.object.material.userData.definitionProfile.path));
assert.ok(lanternSceneHarness.lanternConeRevealRuntime.entries.every((entry) => entry.config.hiddenOpacity === 0
  && entry.material.opacity === 0 && entry.material.transparent && entry.material.depthWrite === false
  && entry.material.alphaTest === 0 && entry.object.visible === false), 'Compiled glyph planes start fully non-rendered with zero-opacity transparency settings.');
const liveGlyphPoint = liveGlyphEntry.object.getWorldPosition(new THREE.Vector3());
let liveEmitterState = {
  active: false,
  itemId: 'keepers_lantern',
  worldPosition: liveGlyphPoint.clone().add(new THREE.Vector3(0, 0, -1)),
  worldDirection: new THREE.Vector3(0, 0, 1),
  coneAngleDegrees: KEEPERS_LANTERN_EMITTER.coneAngleDegrees,
  range: KEEPERS_LANTERN_EMITTER.range,
};
lanternSceneHarness.setLanternRevealEmitterProvider(() => liveEmitterState);
lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.equal(liveGlyphEntry.material.opacity, 0, 'Owned but inactive lantern emitter cannot reveal the glyph.');
assert.equal(liveGlyphEntry.object.visible, false, 'Inactive lantern leaves the decal mesh non-rendered.');
liveEmitterState = { ...liveEmitterState, active: true, itemId: 'torch' };
lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.equal(liveGlyphEntry.material.opacity, 0, 'An active regular Torch cannot reveal a lantern-only glyph.');
assert.equal(liveGlyphEntry.object.visible, false, 'Torch illumination cannot make a hidden glyph mesh render.');
liveEmitterState = { ...liveEmitterState, active: true };
liveEmitterState.itemId = 'keepers_lantern';
for (let index = 0; index < 12; index += 1) lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.ok(liveGlyphEntry.insideCone && liveGlyphEntry.object.visible && liveGlyphEntry.material.opacity > liveGlyphEntry.config.revealedOpacity * 0.9, 'Active lantern emitter aimed at the decal makes it visible and fades it into readability.');
const paddedEdgeAngle = THREE.MathUtils.degToRad(44);
liveEmitterState = { ...liveEmitterState, worldDirection: new THREE.Vector3(Math.sin(paddedEdgeAngle), 0, Math.cos(paddedEdgeAngle)) };
lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.ok(liveGlyphEntry.directHit && liveGlyphEntry.insideCone, 'Exit-cone hysteresis keeps a revealed glyph stable during small emitter sway at the wash edge.');
liveEmitterState = { ...liveEmitterState, worldDirection: new THREE.Vector3(0, 0, -1) };
lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.ok(!liveGlyphEntry.directHit && liveGlyphEntry.insideCone && liveGlyphEntry.lingerRemaining > 0, 'Short active-lantern linger prevents a one-frame dropout when the wash leaves a glyph.');
for (let index = 0; index < 16; index += 1) lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.ok(!liveGlyphEntry.insideCone && liveGlyphEntry.material.opacity === 0 && liveGlyphEntry.object.visible === false, 'Moving the physical emitter cone away fades the glyph to true invisibility and disables rendering.');
const nearFieldDirection = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(70)), 0, Math.cos(THREE.MathUtils.degToRad(70)));
const nearFieldEmitter = { ...liveEmitterState, worldPosition: liveGlyphPoint.clone().sub(nearFieldDirection.clone().multiplyScalar(0.8)), worldDirection: new THREE.Vector3(0, 0, 1) };
assert.equal(isPointInsideLanternCone(nearFieldEmitter, liveGlyphPoint, liveGlyphEntry.config), true, 'Close-range lantern wash remains valid at a broad angle instead of losing the glyph beside the wall.');
const scriptGlyphEntry = lanternSceneHarness.lanternConeRevealRuntime.entries.find((entry) => entry.object.name.endsWith('_script'));
const scriptGlyphCenter = scriptGlyphEntry.object.getWorldPosition(new THREE.Vector3());
liveEmitterState = { ...liveEmitterState, worldPosition: scriptGlyphCenter.clone().add(new THREE.Vector3(1, 0, -1)), worldDirection: new THREE.Vector3(0, 0, 1) };
assert.equal(isPointInsideLanternCone(liveEmitterState, scriptGlyphCenter, scriptGlyphEntry.config), false, 'A wide decal center can sit outside the normal reveal cone near an edge.');
lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.ok(scriptGlyphEntry.directHit && scriptGlyphEntry.object.visible, 'Nearest decal-surface sampling reveals the covered edge even when object-center math would fail.');
liveEmitterState = { ...liveEmitterState, worldPosition: scriptGlyphCenter.clone().add(new THREE.Vector3(0, 0, -5)), worldDirection: new THREE.Vector3(0, 0, 1) };
for (let index = 0; index < 16; index += 1) lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.ok(!scriptGlyphEntry.insideCone, 'Glyph reveal remains off beyond the bounded four-unit wash even when aimed directly at the decal.');
const gateEntry = lanternSceneHarness.lanternConeRevealRuntime.entries.find((entry) => entry.object.name === 'beneath-folsom-hidden-growth-cord-5');
const gatePoint = gateEntry.object.getWorldPosition(new THREE.Vector3());
liveEmitterState = { ...liveEmitterState, active: true, itemId: 'torch', worldPosition: gatePoint.clone().add(new THREE.Vector3(0, 0, -1)), worldDirection: new THREE.Vector3(0, 0, 1) };
for (let index = 0; index < 10; index += 1) lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.equal(gateEntry.object.visible, false, 'Ordinary Torch cannot reveal the hidden growth gate.');
assert.equal(hiddenGateRuntime.strike().hit, false, 'Growth cannot be damaged while it remains hidden.');
assert.equal(lanternSceneHarness.getPhysicalToolTargets().find((target) => target.id === 'beneath_folsom_hidden_growth_gate')?.available, false, 'Hidden growth has no actionable physical contact zone before Lantern reveal.');
liveEmitterState = { ...liveEmitterState, itemId: 'keepers_lantern' };
for (let index = 0; index < 12; index += 1) lanternSceneHarness.lanternConeRevealRuntime.update(0.05);
assert.ok(gateEntry.object.visible && hiddenGateRuntime.isRevealed(), 'Keeper\'s Lantern wash reveals the dense physical seal.');
const physicalHiddenGateTarget = lanternSceneHarness.getPhysicalToolTargets().find((target) => target.id === 'beneath_folsom_hidden_growth_gate');
assert.ok(physicalHiddenGateTarget, 'Lantern reveal enables the physical knife contact receiver.');
const wrongHiddenGateContact = physicalRegistry.evaluate(physicalHiddenGateTarget, { toolId: 'wood_axe', actionType: 'chop', gesture: physicalGesture, contact: physicalContact });
assert.equal(wrongHiddenGateContact.accepted, false, 'Wrong tool/action cannot increment the hidden gate.');
assert.equal(hiddenGateRuntime.hitCount, 0, 'Wrong hidden-gate contact writes no hit.');
const initialCordScale = hiddenGateRuntime.cords[0].scale.y;
for (let hit = 1; hit <= 4; hit += 1) {
  const contactResult = physicalRegistry.evaluate(physicalHiddenGateTarget, { toolId: 'old_work_knife', actionType: 'cut', gesture: physicalGesture, contact: physicalContact });
  assert.deepEqual({ accepted: contactResult.accepted, cleared: contactResult.cleared, hitCount: contactResult.hitCount }, { accepted: true, cleared: false, hitCount: hit }, `Physical knife contact ${hit} damages without clearing early.`);
  hiddenGateRuntime.update(0.05);
}
assert.ok(hiddenGateRuntime.cords[0].scale.y < initialCordScale && hiddenGateRuntime.scabs.every((mesh) => hiddenGateRuntime.damagedTextures.includes(mesh.material.map)), 'Hits progressively weaken cords and switch scabs to damaged textures.');
const finalResult = physicalRegistry.evaluate(physicalHiddenGateTarget, { toolId: 'old_work_knife', actionType: 'cut', gesture: physicalGesture, contact: physicalContact });
assert.deepEqual({ accepted: finalResult.accepted, cleared: finalResult.cleared, hitCount: finalResult.hitCount }, { accepted: true, cleared: true, hitCount: 5 }, 'Exactly the fifth physical knife contact clears the hidden growth gate.');
assert.ok(hiddenGateRuntime.effects.length >= 20, 'Final hit produces a substantially stronger bounded black-oil burst.');
assert.equal(hiddenGateRuntime.hallwayGroup.visible, false, 'Blue-flame fixtures remain concealed during the post-collapse beat.');
assert.equal(hiddenGateRuntime.blueFlames.length, 10, 'Five paired cold-blue torch rows lead through the hallway.');
assert.equal(lanternGameState.isBeneathFolsomHiddenGrowthGateCleared(), true, 'Gate clear writes the dedicated world-state flag.');
const wallOpacityBeforeBeat = hiddenGateRuntime.wall.material.opacity;
for (let index = 0; index < 10; index += 1) hiddenGateRuntime.update(0.05);
assert.equal(hiddenGateRuntime.wall.material.opacity, wallOpacityBeforeBeat, 'Sealed wall remains for a deliberate beat after the growth collapses.');
for (let index = 0; index < 70; index += 1) hiddenGateRuntime.update(0.05);
assert.equal(hiddenGateRuntime.growthGroup.visible, false, 'Cords snap, retract, and collapse away after the final hit.');
assert.equal(hiddenGateRuntime.wall.visible, false, 'The sealed wall slowly fades and withdraws after the beat.');
assert.equal(hiddenGateRuntime.hallwayGroup.visible, true, 'Cold-blue fixtures reveal as the wall begins fading away.');
assert.equal(lanternSceneHarness.collision.getIntersectingBlockers(new THREE.Vector3(0, 1.55, 21.7)).some((blocker) => blocker.id === hiddenGrowthGateBlocker.id), false, 'Cleared wall collision opens the bounded hallway threshold.');
assert.equal(new GameState(lanternStorage).isBeneathFolsomHiddenGrowthGateCleared(), true, 'Hidden growth gate remains cleared after GameState reload.');
const unlockedLowerHatchTarget = lanternSceneHarness.getPhysicalToolTargets().find((target) => target.id === 'beneath_folsom_lower_shrine_hatch');
assert.equal(physicalRegistry.evaluate(unlockedLowerHatchTarget, { toolId: 'iron_drain_bar', actionType: 'pry', gesture: heavyPryGesture, contact: physicalContact }).accepted, true, 'After hidden-gate clear, a heavier smooth bar lever opens the lower shrine hatch.');
assert.equal(lanternGameState.isBeneathFolsomLowerShrineHatchOpen(), true, 'Physical lower-hatch pry preserves the existing save key.');
const whiteKnotTarget = lanternSceneHarness.getPhysicalToolTargets().find((target) => target.id === 'beneath_folsom_white_scab_lower_knot');
assert.equal(physicalRegistry.evaluate(whiteKnotTarget, { toolId: 'wood_axe', actionType: 'chop', gesture: physicalGesture, contact: physicalContact }).accepted, false, 'The exposed White-Scab lower knot rejects the wrong tool.');
for (let hit = 1; hit <= 3; hit += 1) {
  const result = physicalRegistry.evaluate(whiteKnotTarget, { toolId: 'old_work_knife', actionType: 'cut', gesture: physicalGesture, contact: physicalContact });
  assert.equal(result.accepted, true, `White-Scab lower knot accepts physical knife cut ${hit}.`);
}
assert.equal(lanternGameState.isBeneathFolsomWhiteScabLowerKnotDestroyed(), true, 'White-Scab knot destruction preserves its save key.');
assert.equal(lanternGameState.isFolsomShrineCrawlspaceTerminalOpen(), true, 'Knot destruction still enables the remote shrine terminal route.');
assert.equal(lanternSceneHarness.collision.blockerRects.some((blocker) => blocker.id === 'beneath_folsom_white_scab_front_seal_blocker'), true, 'Destroying the lower knot still does not open the impossible front seal.');
assert.ok((beneathFolsom.props ?? []).some((prop) => prop.tags?.includes('black-growth') && prop.tags?.includes('atmospheric-only')), 'Other underground growth remains atmospheric dressing.');

const returnTransitions = [];
const returnRouteInteractions = new Interactions({
  player: { position: beneathReturn.position.clone(), getLookDirection: () => new THREE.Vector3(0, 0, -1) },
  dungeon: {
    area: 'beneath-folsom',
    indoorExitTarget: beneathReturn.position.clone(),
    compiledLocationRuntime: beneathFolsomRuntime,
    inspectInteractions: [],
  },
  hud: { showHint: () => {}, showMessage: () => {}, updateFieldKitStatus: () => {} },
  transitionToLocation: (locationId, options) => returnTransitions.push({ locationId, options }),
});
returnRouteInteractions.useIndoorExit();
assert.deepEqual(returnTransitions[0], {
  locationId: 'folsom',
  options: { areaParam: 'folsom', fromArea: null, destinationSpawnId: 'folsom_underworks_return', delayMs: 160 },
}, 'The live indoor-exit convention returns to the authored Folsom Underworks spawn.');

const sessionCreates = [];
const sessionChanges = [];
const historyEntries = [];
const previousWindow = globalThis.window;
globalThis.window = {
  location: { pathname: '/Dread_Stone_Black/' },
  history: { pushState: (state, unused, url) => historyEntries.push({ state, url }) },
  setTimeout,
};
try {
  const transitionHost = Object.create(SceneSessionHost.prototype);
  Object.assign(transitionHost, {
    transitionPromise: null,
    query: new URLSearchParams('area=folsom'),
    onSessionChanged: (session, summary) => sessionChanges.push({ session, summary }),
    createSession(options) {
      sessionCreates.push(options);
      this.dungeon = { area: options.area, spawnId: options.spawnId };
      this.locationId = options.area === 'field' ? 'reliquary-field' : options.area;
      return { area: options.area, locationId: this.locationId, spawnId: options.spawnId };
    },
  });

  const beneathSummary = await transitionHost.transitionToLocation('beneath-folsom', {
    destinationSpawnId: 'beneath_folsom_underworks_arrival',
  });
  assert.equal(beneathSummary.locationId, 'beneath-folsom', 'An in-game transition directly creates the active Beneath Folsom session.');
  assert.equal(transitionHost.dungeon.spawnId, 'beneath_folsom_underworks_arrival', 'The direct Beneath Folsom session honors its authored arrival spawn.');

  const folsomSummary = await transitionHost.transitionToLocation('folsom', {
    destinationSpawnId: 'folsom_underworks_return',
  });
  assert.equal(folsomSummary.locationId, 'folsom', 'An in-game return directly creates the active Folsom session.');
  assert.equal(transitionHost.dungeon.spawnId, 'folsom_underworks_return', 'The direct Folsom session honors its authored Underworks return spawn.');

  await transitionHost.transitionToLocation('reliquary-field', {
    areaParam: 'field',
    fromArea: 'field-keeper-house',
    destinationSpawnId: 'field_keeper_house_return',
  });
  assert.deepEqual(sessionCreates.map(({ area, spawnId }) => ({ area, spawnId })), [
    { area: 'beneath-folsom', spawnId: 'beneath_folsom_underworks_arrival' },
    { area: 'folsom', spawnId: 'folsom_underworks_return' },
    { area: 'field', spawnId: null },
  ], 'Direct transitions replace the session in memory and retain the legacy field area convention.');
  assert.equal(sessionCreates[2].fieldSpawn, 'fieldKeeperHouseExit', 'Legacy indoor returns still resolve the authored Reliquary Field runtime spawn.');
  assert.equal(sessionChanges.length, 3, 'Each direct transition notifies the running Game to rebind session-dependent systems.');
  assert.deepEqual(historyEntries.map(({ url }) => url), [
    '/Dread_Stone_Black/?area=beneath-folsom&spawn=beneath_folsom_underworks_arrival',
    '/Dread_Stone_Black/?area=folsom&spawn=folsom_underworks_return',
    '/Dread_Stone_Black/?area=field&from=field-keeper-house',
  ], 'Direct transitions update browser history without reloading the app.');

  const startupCreates = [];
  const startupHost = Object.create(SceneSessionHost.prototype);
  Object.assign(startupHost, {
    query: new URLSearchParams('area=beneath-folsom&spawn=beneath_folsom_underworks_arrival'),
    async preloadLocationForArea() {},
    createSession(options) { startupCreates.push(options); },
    getSessionSummary() { return { startup: true }; },
  });
  await startupHost.startInitialSession();
  assert.deepEqual(startupCreates[0], {
    area: 'beneath-folsom',
    fieldSpawn: 'start',
    spawnId: 'beneath_folsom_underworks_arrival',
  }, 'Fresh-page startup still honors area and spawn query parameters.');
} finally {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}

const reboundSystems = [];
const reboundSession = { player: { id: 'new-player' }, dungeon: { area: 'beneath-folsom' } };
Game.prototype.handleSceneSessionChanged.call({
  interactions: { initializeForSession: (session) => reboundSystems.push(['interactions', session]) },
  viewmodelHost: { rebindSession: (session) => reboundSystems.push(['viewmodel', session]) },
  survivalHost: { initializeForSession: (session) => reboundSystems.push(['survival', session]) },
  progressionHost: { handleLocationChanged: (session) => reboundSystems.push(['progression', session]) },
  hud: { showHint: () => reboundSystems.push(['hud']) },
  wasKeyboardInteractHeld: true,
}, reboundSession);
assert.equal(reboundSystems[0][0], 'interactions');
assert.equal(reboundSystems[0][1].player, reboundSession.player, 'Interactions rebind to the replacement player.');
assert.equal(reboundSystems[0][1].dungeon, reboundSession.dungeon, 'Interactions rebind to the replacement dungeon.');
assert.deepEqual(reboundSystems.slice(1, 4).map(([system, session]) => [system, session === reboundSession]), [
  ['viewmodel', true],
  ['survival', true],
  ['progression', true],
], 'The running Game rebinds viewmodel/fishing, survival, and progression to the replacement session.');

const sceneSessionSource = readFileSync(new URL('../src/game/hosts/SceneSessionHost.js', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
assert.equal(sceneSessionSource.includes('window.location.assign'), false, 'Normal SceneSessionHost transitions never call window.location.assign.');
assert.ok(sceneSessionSource.includes('history?.pushState') && sceneSessionSource.includes('createSession'), 'Normal transitions replace the active session and only update browser history.');
assert.ok(mainSource.includes('new TitleScreen()') && mainSource.includes('waitForSelection()'), 'Fresh app boot still owns the title-screen New Game / Continue flow.');

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
assert.equal(feeds.length, 3, 'Folsom authors one growth feed for each surface endpoint.');
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
assert.ok(feedMeshes.every((mesh) => mesh.visible === false), 'Fresh-save network feeds remain hidden before the Keeper\'s Lantern reveal.');
const blockedBeforeReveal = connectedGrowth.clearAnchor('folsom_growth_anchor_fire');
assert.equal(blockedBeforeReveal.networkHidden, true, 'Fresh saves cannot clear surface endpoints before revealing the under-shrine network.');
assert.equal(gameState.isFolsomGrowthAnchorCleared('fire'), false, 'A pre-reveal anchor attempt writes no progress.');
connectedGrowth.revealNetwork();
assert.equal(gameState.isFolsomUnderShrineNetworkRevealed(), true, 'Revealing the network persists additive world state.');
assert.ok(feedMeshes.every((mesh) => mesh.visible === true), 'Lantern discovery reveals all three surface feed routes.');

const liveStorageValues = new Map();
const liveStorage = {
  get length() { return liveStorageValues.size; },
  key: (index) => [...liveStorageValues.keys()][index] ?? null,
  getItem: (key) => liveStorageValues.has(key) ? liveStorageValues.get(key) : null,
  setItem: (key, value) => liveStorageValues.set(key, String(value)),
  removeItem: (key) => liveStorageValues.delete(key),
};
const liveGameState = new GameState(liveStorage);
const lockedUnderworksRuntimeInteraction = { ...underworksInteraction, functional: false };
DungeonScene.prototype.syncFolsomUnderworksInteraction.call({
  outdoorInteractions: [lockedUnderworksRuntimeInteraction],
  gameState: liveGameState,
});
assert.equal(lockedUnderworksRuntimeInteraction.functional, false, 'The Underworks transition is unavailable before the unsealed flag.');
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
assert.ok(liveAnchorInteractions.every((interaction) => interaction.requiresFolsomNetworkReveal), 'Every surface endpoint interaction is gated by the Lantern-first network reveal.');

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
const liveInteractions = new Interactions({
  player: livePlayer,
  dungeon: liveDungeon,
  equipmentRuntime: { hasItem: () => true, getEquippedOffhandId: () => 'keepers_lantern', getEquippedWeaponProfile: () => ({ id: 'unarmed' }) },
  hud: { showHint: () => {}, showMessage: () => {}, updateFieldKitStatus: () => {} },
  feedback: { shake: () => {} },
});
assert.equal(liveInteractions.isOutdoorInteractionAvailable(liveAnchorInteractions[0]), false, 'Fresh-save surface endpoint interactions stay unavailable before the reveal.');
liveGrowth.revealNetwork();
assert.equal(liveInteractions.isOutdoorInteractionAvailable(liveAnchorInteractions[0]), false, 'Revealed surface endpoints remain absent from Interact/A and wait for physical tool contact.');
livePlayer.position.copy(liveAnchorInteractions[0].target);
liveInteractions.interact();
liveInteractions.attack();
assert.equal(liveGameState.isFolsomGrowthAnchorCleared('fire'), false, 'Interact and attack-button input cannot clear a revealed endpoint.');

const exercisePhysicalAnchor = (anchorType, acceptedToolId, acceptedActionType) => {
  const anchor = liveGrowth.getAnchorTargets().find((candidate) => candidate.type === anchorType);
  const target = {
    id: anchor.id, target: anchor.target, acceptedToolId, acceptedActionType,
    requiredGesture: { minTravelPx: 40, minVelocityPxPerSecond: 80, minSmoothness: 0.5 },
    receivePhysicalToolEvent: () => {
      const result = liveDungeon.clearFolsomGrowthAnchor(anchor.id);
      return { accepted: result.cleared, changed: result.cleared, completed: result.cleared };
    },
  };
  const wrong = physicalRegistry.evaluate(target, { toolId: 'iron_drain_bar', actionType: 'pry', gesture: physicalGesture, contact: physicalContact });
  assert.equal(wrong.accepted, false, `${anchorType} rejects the wrong physical tool/action.`);
  assert.equal(liveGameState.isFolsomGrowthAnchorCleared(anchorType), false, `${anchorType} writes no state on wrong contact.`);
  const correct = physicalRegistry.evaluate(target, { toolId: acceptedToolId, actionType: acceptedActionType, gesture: physicalGesture, contact: physicalContact });
  assert.equal(correct.accepted, true, `${anchorType} clears from the authored physical tool contact.`);
};
exercisePhysicalAnchor('fire', 'wood_axe', 'chop');
exercisePhysicalAnchor('pond', 'old_work_knife', 'cut');
exercisePhysicalAnchor('shrine', 'old_work_knife', 'cut');
assert.equal(liveGameState.isFolsomUnderworksGrowthUnsealed(), true, 'Three correct physical endpoint actions unseal Underworks.');
DungeonScene.prototype.syncFolsomUnderworksInteraction.call({
  outdoorInteractions: [lockedUnderworksRuntimeInteraction],
  gameState: liveGameState,
});
assert.equal(lockedUnderworksRuntimeInteraction.functional, true, 'The Underworks transition becomes functional after the unsealed flag.');
assert.equal(lockedUnderworksRuntimeInteraction.targetLocationId, 'beneath-folsom', 'Unsealing preserves the authored Beneath Folsom destination.');
const splitStateUnderworksInteraction = { ...underworksInteraction, functional: false };
DungeonScene.prototype.syncFolsomUnderworksInteraction.call({
  outdoorInteractions: [splitStateUnderworksInteraction],
  folsomConnectedGrowthRuntime: { unsealed: true },
  gameState: { isFolsomUnderworksGrowthUnsealed: () => false, markFolsomUnderworksGrowthUnsealed: () => false },
});
assert.equal(splitStateUnderworksInteraction.functional, true, 'A visibly raised runtime gate remains enterable even if persistence is temporarily unavailable.');
assert.equal(splitStateUnderworksInteraction.hint, 'Descend into the Underworks', 'The raised gate cannot retain the stale sealed prompt.');

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
assert.equal(new GameState(liveStorage).isFolsomUnderworksGrowthUnsealed(), true, 'Beneath Folsom routing does not replace or reset the persisted Folsom gate state.');

const legacyStorageValues = new Map([['folsom_growth_anchor_pond_cleared', 'true']]);
const legacyStorage = {
  get length() { return legacyStorageValues.size; },
  key: (index) => [...legacyStorageValues.keys()][index] ?? null,
  getItem: (key) => legacyStorageValues.get(key) ?? null,
  setItem: (key, value) => legacyStorageValues.set(key, String(value)),
  removeItem: (key) => legacyStorageValues.delete(key),
};
const migratedLegacyState = new GameState(legacyStorage);
assert.equal(migratedLegacyState.isFolsomGrowthAnchorCleared('pond'), true, 'Migration preserves existing surface-anchor clears.');
assert.equal(migratedLegacyState.isFolsomUnderShrineNetworkRevealed(), true, 'Existing Chapter 2 progress migrates to the revealed network state without replay.');
const legacyChapter3StorageValues = new Map([['beneath_folsom_white_scab_lower_knot_destroyed', 'true'], ['folsom_shrine_crawlspace_terminal_open', 'true']]);
const legacyChapter3Storage = {
  get length() { return legacyChapter3StorageValues.size; }, key: (index) => [...legacyChapter3StorageValues.keys()][index] ?? null,
  getItem: (key) => legacyChapter3StorageValues.get(key) ?? null, setItem: (key, value) => legacyChapter3StorageValues.set(key, String(value)), removeItem: (key) => legacyChapter3StorageValues.delete(key),
};
const migratedChapter3State = new GameState(legacyChapter3Storage);
assert.equal(migratedChapter3State.isUnderShrineLabyrinthEndHatchOpen(), true, 'Existing Chapter 3 lead-in saves migrate past the newly physicalized end hatch and cannot softlock.');

console.log('Folsom keeps its starter loops, adds the Lantern-first shrine investigation, persistently unseals Underworks, and connects safely to Beneath Folsom.');

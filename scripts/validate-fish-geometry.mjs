import * as THREE from 'three';
import { buildDungeonGeometry } from '../src/engine/dungeon-authoring/DungeonGeometryBuilder.js';
import { kerovacDefinition } from '../src/game/locations/generated/kerovac.definition.js';
import { FISH_SPECIES_IDS, FISH_SPECS, FISH_TEXTURE_PROFILES, createFishMesh } from '../src/game/fishing/FishMeshFactory.js';
import { ACTIVE_GAMEPLAY_RODS, CANONICAL_GAMEPLAY_ROD_ID, KEROVAC_EXPO_ROD_A1_SOURCE, createRodA1Mesh } from '../src/game/fishing/FishingRodFactory.js';
import { FishingRodView } from '../src/game/fishing/FishingRodView.js';
import { LINE_MAX_LENGTH, LINE_MAX_SPOOL_OUT_PER_FRAME, LINE_MIN_LENGTH, LINE_START_LENGTH, ROD_ANGULAR_DAMPING, ROD_ANGULAR_SPRING, ROD_GRAB_DAMPING, ROD_GRAB_SPRING, ROD_MASS_FEEL, ROD_RELEASE_SNAP_SCALE, ROD_REST_POS, ROD_REST_ROT } from '../src/game/fishing/CastingTuning.js';
import { FishingLinePhysics } from '../src/game/fishing/FishingLinePhysics.js';
import { GameState } from '../src/game/GameState.js';

const testMaterialFactory = (profile = {}) => {
  const material = new THREE.MeshStandardMaterial({
    color: profile.color ?? 0xffffff,
    roughness: profile.roughness ?? 0.9,
    metalness: profile.metalness ?? 0,
    emissive: profile.emissive ?? 0x000000,
    emissiveIntensity: profile.emissiveIntensity ?? 0,
  });

  if (profile.path) {
    const map = new THREE.Texture();
    map.name = profile.path;
    map.userData = { path: profile.path, repeat: [...(profile.repeat ?? [1, 1])] };
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(...(profile.repeat ?? [1, 1]));
    material.map = map;
  }

  material.userData.definitionProfile = { ...profile };
  return material;
};

const fail = (message) => { throw new Error(message); };

const expectedSpecies = ['smallRiverFish', 'broadCarpFish', 'longEelFish', 'spineBackFish', 'flatMarshFish', 'jawHunterFish', 'sacredGlowFish'];
if (JSON.stringify(FISH_SPECIES_IDS) !== JSON.stringify(expectedSpecies)) fail(`Shared fish registry must expose the permanent species ids in Kerovac order.`);
expectedSpecies.forEach((species) => { if (!FISH_SPECS[species]) fail(`Shared FISH_SPECS missing ${species}.`); });



const rodA1Primitive = kerovacDefinition.architecturalPrimitives?.find((primitive) => primitive.kind === 'fishingRodDisplay' && primitive.userData?.displayPadId === 'A1');
if (!rodA1Primitive) fail('Fishing invalid: Kerovac Expo Rod A1 was not registered as canonical rodA1.');
if (rodA1Primitive.id !== KEROVAC_EXPO_ROD_A1_SOURCE.sourcePrimitiveId || rodA1Primitive.variant !== KEROVAC_EXPO_ROD_A1_SOURCE.sourceVariant) fail('Fishing invalid: Kerovac Expo Rod A1 source metadata does not match canonical rodA1.');
if (ACTIVE_GAMEPLAY_RODS.length !== 1 || ACTIVE_GAMEPLAY_RODS[0]?.id !== CANONICAL_GAMEPLAY_ROD_ID) fail('Fishing invalid: more than one active gameplay rod is exposed.');
const rodA1Mesh = createRodA1Mesh();

const validateFirstPersonRodA1RestPose = () => {
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 260);
  const gameState = new GameState({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  gameState.acquireFieldTool('fishing_rod');
  gameState.equipFieldTool('fishing_rod');
  const equipmentRuntime = { getEquippedWeaponProfile: () => ({ id: 'unarmed' }) };
  const rodView = new FishingRodView({ camera, equipmentRuntime, gameState });
  if (rodView.getVisibleStateReason() !== 'equipped via GameState field tool' || !rodView.isEquipped()) fail('Fishing invalid: Rod A1 is equipped but FishingRodView reports not equipped.');
  rodView.update(1 / 60, {});
  if (!rodView.root.visible) fail('Fishing invalid: Rod A1 is equipped but FishingRodView reports not equipped.');

  camera.updateMatrixWorld(true);
  rodView.root.updateMatrixWorld(true);
  const projected = [0, 0.5, 1].map((t) => {
    const point = rodView.getWorldPointAt(t);
    const ndc = point.clone().project(camera);
    return { t, ndc };
  });
  const insideOrNear = projected.filter(({ ndc }) => ndc.z >= -1 && ndc.z <= 1 && ndc.x >= -1.1 && ndc.x <= 1.1 && ndc.y >= -1.55 && ndc.y <= 1.1);
  if (insideOrNear.length !== projected.length) fail('Fishing invalid: Rod A1 rest pose projects outside the viewport.');
  const [handle, mid, tip] = projected;
  if (!(handle.ndc.y < mid.ndc.y && mid.ndc.y < tip.ndc.y && handle.ndc.x > 0.15)) fail('Fishing invalid: Rod A1 rest pose projects outside the viewport.');
  if (!(handle.ndc.x > 0.38 && handle.ndc.y < -0.7)) fail('Fishing invalid: Rod A1 rest handle must remain in the lower-right first-person grip region.');
  if (!(tip.ndc.x > 0.05 && tip.ndc.x < 0.32 && tip.ndc.y > 0.22 && tip.ndc.y < 0.52)) fail('Fishing invalid: Rod A1 rest tip must project toward the raised upper/mid-right-to-center viewport region.');

  const handleWorld = rodView.getWorldPointAt(0);
  const tipWorld = rodView.getWorldPointAt(1);
  const handleToTip = tipWorld.clone().sub(handleWorld).normalize();
  if (!(handleToTip.z < -0.72 && handleToTip.y > 0.28 && tipWorld.z < handleWorld.z)) fail('Fishing invalid: Rod A1 rest tip must point forward into the scene instead of backward/up over the shoulder.');
  if (!(tip.ndc.x < handle.ndc.x)) fail('Fishing invalid: Rod A1 rest tip must angle inward toward the center of the viewport.');

  const viewport = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
  const midX = (mid.ndc.x * 0.5 + 0.5) * 1280;
  const midY = (-mid.ndc.y * 0.5 + 0.5) * 720;
  if (!rodView.projectRodGrabHit(midX, midY, viewport)) fail('Fishing invalid: Rod A1 is visible but cannot be grabbed by touch hit detection.');
  const projectedReel = rodView.getProjectedReelCenter(viewport);
  if (!projectedReel?.projected || projectedReel.x < 760 || projectedReel.x > 940 || projectedReel.y < 620 || projectedReel.y > 720) fail('Fishing invalid: raised Rod A1 projected reel center must remain near the visible lower-right grip area.');

  gameState.equipFieldTool(null);
  rodView.update(1 / 60, {});
  if (rodView.root.visible || rodView.isEquipped()) fail('Fishing invalid: Rod A1 remained visible after being unequipped.');

  const weaponRodView = new FishingRodView({ camera: new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 260), equipmentRuntime: { getEquippedWeaponProfile: () => ({ id: 'fishing_rod' }) }, gameState: new GameState({ getItem: () => null, setItem: () => {}, removeItem: () => {} }) });
  if (weaponRodView.getVisibleStateReason() !== 'equipped via EquipmentRuntime weapon' || !weaponRodView.isEquipped()) fail('Fishing invalid: Rod A1 EquipmentRuntime weapon visibility path is not recognized.');
  if (!Number.isFinite(ROD_REST_POS.x + ROD_REST_POS.y + ROD_REST_POS.z + ROD_REST_ROT.x + ROD_REST_ROT.y + ROD_REST_ROT.z)) fail('Fishing invalid: Rod A1 root has non-finite rest pose constants.');
};

validateFirstPersonRodA1RestPose();

const validateRodA1SnappyLineUnspooling = () => {
  if (!(ROD_GRAB_SPRING >= 30 && ROD_ANGULAR_SPRING >= 26 && ROD_MASS_FEEL <= 0.9 && ROD_GRAB_DAMPING <= 8 && ROD_ANGULAR_DAMPING <= 6.2 && ROD_RELEASE_SNAP_SCALE >= 1.25)) fail('Fishing invalid: Rod A1 responsiveness is over-damped / too heavy.');
  if (!(LINE_START_LENGTH <= 0.72 && LINE_MIN_LENGTH <= 0.45)) fail('Fishing invalid: idle lure line length was not reduced.');

  const terrainSampler = { sampleOutdoorY: () => 0 };
  const physics = new FishingLinePhysics({ terrainSampler });
  const rodTip = new THREE.Vector3(0, 1.7, 0);
  physics.resetAtRodTip(rodTip);
  if (!(physics.currentLineLength === LINE_MIN_LENGTH && physics.lurePosition.distanceTo(rodTip) <= LINE_MIN_LENGTH + 0.01)) fail('Fishing invalid: fully reeled lure does not start on the minimum short line.');
  physics.launch(rodTip, new THREE.Vector3(0, 9, -20));
  const launchLength = physics.currentLineLength;
  if (!(launchLength === LINE_START_LENGTH && launchLength < LINE_MAX_LENGTH * 0.08)) fail('Fishing invalid: cast line starts too long / fully unspooled.');
  if (!(physics.activePoints <= 2 && physics.emittedLineLength === LINE_START_LENGTH)) fail('Fishing invalid: cast line starts too long / fully unspooled.');

  const firstFrameRodTip = rodTip.clone();
  physics.update(1 / 60, firstFrameRodTip, { rodHeld: false });
  if (!(physics.currentLineLength <= launchLength + LINE_MAX_SPOOL_OUT_PER_FRAME + 1e-6 && physics.currentLineLength < LINE_MAX_LENGTH * 0.14)) fail('Fishing invalid: cast line starts too long / fully unspooled.');
  const afterFirstFrameLength = physics.currentLineLength;
  const afterFirstFrameActivePoints = physics.activePoints;
  for (let i = 0; i < 12; i += 1) physics.update(1 / 60, firstFrameRodTip, { rodHeld: false });
  if (!(physics.currentLineLength > afterFirstFrameLength && physics.activePoints >= afterFirstFrameActivePoints)) fail('Fishing invalid: active/emitted line length does not grow progressively after cast.');
  if (!physics.linePoints.slice(1, -1).every((point) => point.y > 0.12)) fail('Fishing invalid: intermediate airborne line points are terrain-clamped.');
  const rodY = physics.linePoints[0].y; const lureY = physics.linePoints.at(-1).y; const minInteriorY = Math.min(...physics.linePoints.slice(1, -1).map((point) => point.y));
  if (minInteriorY < Math.min(rodY, lureY) - 0.45) fail('Fishing invalid: airborne cast line collapses into immediate U-shape.');

  const waterPhysics = new FishingLinePhysics({ terrainSampler });
  waterPhysics.resetAtRodTip(rodTip);
  waterPhysics.lurePosition.set(5, 0.35, -9);
  waterPhysics.enterWater(0.32);
  waterPhysics.update(1 / 60, rodTip, { rodHeld: false });
  const end = waterPhysics.linePoints.at(-1);
  const mid = waterPhysics.linePoints[Math.floor(waterPhysics.linePoints.length / 2)];
  if (!(Math.abs(end.x - rodTip.x) > 2 && Math.abs(mid.x - rodTip.x) > 0.6 && end.z < rodTip.z - 2)) fail('Fishing invalid: water-mode line still angles toward lure.');
};

validateRodA1SnappyLineUnspooling();

if (rodA1Mesh.userData?.visualSource !== 'KerovacExpoSlotA1' || rodA1Mesh.userData?.fallbackDebugGeometry !== false) fail('Fishing invalid: fallback/debug rod used instead of canonical Rod A1.');

const expectedKerovacFishPads = new Map([
  ['C1', 'smallRiverFish'],
  ['C2', 'broadCarpFish'],
  ['C3', 'longEelFish'],
  ['C4', 'spineBackFish'],
  ['D1', 'flatMarshFish'],
  ['D2', 'jawHunterFish'],
  ['D3', 'sacredGlowFish'],
]);

for (const [padId, species] of expectedKerovacFishPads) {
  const fish = kerovacDefinition.architecturalPrimitives?.find((primitive) => primitive.kind === 'fishDisplay' && primitive.userData?.displayPadId === padId);
  if (!fish) fail(`Kerovac fish mapping invalid: ${padId} display fish is missing.`);
  if (fish.variant !== species || fish.itemId !== species) fail(`Kerovac fish mapping invalid: ${padId} should be ${species}.`);
}

const textureProfileKeys = ['fishScaleSilver', 'fishScaleKoiCreamOrange', 'fishScaleEelSkinDark', 'fishScaleZebraOlive', 'fishScaleMottledDark', 'fishScaleIridescentTeal', 'fishFinAmber', 'fishFinDark', 'fishFinSpottedTeal'];
for (const key of textureProfileKeys) {
  const shared = FISH_TEXTURE_PROFILES[key];
  const kerovac = kerovacDefinition.textures?.[key];
  if (!shared?.path) fail(`Caught fish invalid: texture profile ${key} is missing from shared pickup profiles.`);
  if (shared.path !== kerovac?.path) fail(`Caught fish invalid: shared profile ${key} path ${shared.path} differs from Kerovac ${kerovac?.path ?? 'none'}.`);
}

const makePickupTestMaterial = (profile = {}, key = 'unknown') => {
  const material = testMaterialFactory(profile);
  material.userData.fishTextureProfileKey = key;
  material.userData.rawFishPickupMaterialResolver = 'KerovacFishTextureProfiles';
  return material;
};

for (const species of expectedSpecies) {
  const spec = FISH_SPECS[species];
  const resolvedSlots = [];
  const pickupRoot = createFishMesh(species, {
    id: `validate-raw-pickup-${species}`,
    materialResolver: (reference, fallback, { slot }) => {
      resolvedSlots.push(`${slot}:${reference}`);
      return makePickupTestMaterial(FISH_TEXTURE_PROFILES[reference] ?? fallback, reference);
    },
  });
  const body = pickupRoot.children.find((child) => child.userData?.fishPart === 'singleClosedEllipsoidBody');
  const fins = pickupRoot.children.filter((child) => ['closedAttachedTail', 'closedAttachedDorsalFin', 'closedMirroredPectoralFin'].includes(child.userData?.fishPart));
  if (!resolvedSlots.includes(`bodyMaterial:${spec.bodyMaterial}`)) fail(`Caught fish invalid: ${species} body material ${spec.bodyMaterial} was not resolved through the Kerovac texture resolver.`);
  if (!resolvedSlots.includes(`finMaterial:${spec.finMaterial}`)) fail(`Caught fish invalid: ${species} fin material ${spec.finMaterial} was not resolved through the Kerovac texture resolver.`);
  const bodyPath = body?.material?.map?.userData?.path ?? body?.material?.map?.name;
  const expectedBodyPath = FISH_TEXTURE_PROFILES[spec.bodyMaterial]?.path;
  if (bodyPath !== expectedBodyPath) fail(`Caught fish invalid: ${species} body material ${spec.bodyMaterial} resolved without a texture map.`);
  if (body.material.userData?.fishTextureProfileKey !== spec.bodyMaterial) fail(`Kerovac Expo fish and Pond Expo caught fish use different body material keys for ${species}.`);
  for (const fin of fins) {
    const finPath = fin.material?.map?.userData?.path ?? fin.material?.map?.name;
    const expectedFinPath = FISH_TEXTURE_PROFILES[spec.finMaterial]?.path;
    if (finPath !== expectedFinPath) fail(`Caught fish invalid: ${species} fin/tail material ${spec.finMaterial} resolved without a texture map.`);
    if (fin.material.userData?.fishTextureProfileKey !== spec.finMaterial) fail(`Kerovac Expo fish and Pond Expo caught fish use different fin material keys for ${species}.`);
  }
}

const { group } = buildDungeonGeometry(kerovacDefinition, { materialFactory: testMaterialFactory });
group.updateMatrixWorld(true);

const fishRoots = [];
group.traverse((child) => {
  if (child?.userData?.objectCategory === 'fish' && child?.userData?.fishConstruction === 'single-reusable-symmetrical-volumetric-template') fishRoots.push(child);
});

const nearly = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const localMeshBox = (mesh) => {
  mesh.updateMatrix();
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);
};

if (fishRoots.length !== 7) fail(`Expected 7 volumetric fish roots, found ${fishRoots.length}.`);
const kerovacSpecies = new Set(fishRoots.map((root) => root.userData?.fishSpecies));
expectedSpecies.forEach((species) => { if (!kerovacSpecies.has(species)) fail(`Kerovac fish display missing shared species ${species}.`); });

for (const root of fishRoots) {
  root.updateMatrixWorld(true);

  if (root.userData?.visualSource !== 'sharedKerovacFishSpeciesFactory') fail(`${root.name} was not created by the shared Kerovac fish factory.`);
  if (!FISH_SPECS[root.userData?.fishSpecies]) fail(`${root.name} uses a species outside the shared fish registry.`);
  if (!nearly(root.rotation.x, 0) || !nearly(root.rotation.z, 0)) fail(`${root.name} has non-Y display rotation.`);
  if (!root.children.every((child) => child.parent === root)) fail(`${root.name} has a child mesh parented outside the fish root.`);

  const body = root.children.find((child) => child.userData?.fishPart === 'singleClosedEllipsoidBody');
  const tail = root.children.find((child) => child.userData?.fishPart === 'closedAttachedTail');
  const dorsal = root.children.find((child) => child.userData?.fishPart === 'closedAttachedDorsalFin');
  const pectorals = root.children.filter((child) => child.userData?.fishPart === 'closedMirroredPectoralFin').sort((a, b) => a.position.z - b.position.z);
  const eyes = root.children.filter((child) => child.userData?.fishPart === 'tinyMirroredBlackEye').sort((a, b) => a.position.z - b.position.z);

  if (!body || !tail || !dorsal || pectorals.length !== 2 || eyes.length !== 2) fail(`${root.name} has an invalid fish-part set.`);

  const bodyLength = root.userData.fishSanity?.bodyLength;
  const bodyHeight = root.userData.fishSanity?.bodyHeight;
  const bodyWidth = root.userData.fishSanity?.bodyWidth;
  const tailEmbed = root.userData.fishSanity?.tailEmbed;
  if (![bodyLength, bodyHeight, bodyWidth, tailEmbed].every(Number.isFinite)) fail(`${root.name} is missing finite body sanity dimensions.`);
  if (!(tailEmbed >= bodyLength * 0.1 && tailEmbed <= bodyLength * 0.2)) fail(`${root.name} tail embed is outside the required 10-20% body-length range.`);

  root.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry?.type === 'PlaneGeometry' || child.type === 'Sprite' || child.isSprite) fail(`${root.name} uses forbidden ${child.geometry?.type || child.type}.`);
    ['x', 'y', 'z'].forEach((axis) => {
      if (!Number.isFinite(child.position[axis])) fail(`${child.name} has non-finite ${axis} position.`);
    });
    if (child.position.length() > 2.25) fail(`${child.name} is positioned too far from the fish body.`);
  });

  const [leftPectoral, rightPectoral] = pectorals;
  if (!nearly(leftPectoral.position.x, rightPectoral.position.x) || !nearly(leftPectoral.position.y, rightPectoral.position.y) || !nearly(leftPectoral.position.z, -rightPectoral.position.z)) fail(`${root.name} pectoral fins are not mirrored.`);
  if (!nearly(leftPectoral.rotation.y, -rightPectoral.rotation.y)) fail(`${root.name} pectoral fin rotations are not mirrored.`);

  const [leftEye, rightEye] = eyes;
  if (!nearly(leftEye.position.x, rightEye.position.x) || !nearly(leftEye.position.y, rightEye.position.y) || !nearly(leftEye.position.z, -rightEye.position.z)) fail(`${root.name} eyes are not mirrored.`);


  const expectedFinTexture = kerovacDefinition.textures[root.userData.materialSlots?.finMaterial]?.path;
  if (!expectedFinTexture) fail(`${root.name} is missing an expected fin texture profile.`);

  for (const fin of [tail, dorsal, ...pectorals]) {
    const mapPath = fin.material?.map?.userData?.path ?? fin.material?.map?.name;
    if (mapPath !== expectedFinTexture) fail(`${fin.name} does not use expected fin texture map ${expectedFinTexture}; found ${mapPath ?? 'none'}.`);
    if (fin.material?.map?.colorSpace !== THREE.SRGBColorSpace) fail(`${fin.name} fin texture map is not configured for sRGB color space.`);
    if (fin.material?.color?.getHex() !== 0xffffff) fail(`${fin.name} fin material color still tints/overrides the assigned texture.`);
    const uv = fin.geometry?.getAttribute('uv');
    const position = fin.geometry?.getAttribute('position');
    if (!uv || !position || uv.count !== position.count) fail(`${fin.name} is missing stable UVs for its fin texture.`);
    const uniqueUvs = new Set();
    for (let i = 0; i < uv.count; i += 1) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (!Number.isFinite(u) || !Number.isFinite(v)) fail(`${fin.name} has non-finite UV coordinates.`);
      uniqueUvs.add(`${u.toFixed(3)},${v.toFixed(3)}`);
    }
    if (uniqueUvs.size < 3) fail(`${fin.name} UVs collapse the assigned fin texture into a flat sample.`);
  }

  const bodyBounds = localMeshBox(body);
  const tailBounds = localMeshBox(tail);
  const tailRootDepth = tailBounds.max.x - bodyBounds.min.x;
  if (!(tailRootDepth >= bodyLength * 0.1 && tailRootDepth <= bodyLength * 0.22 && nearly(tail.position.y, 0) && nearly(tail.position.z, 0))) fail(`${root.name} tail root does not embed into the rear body volume on the fish centerline.`);
  if (!(dorsal.position.y < bodyHeight * 0.5 && nearly(dorsal.position.z, 0))) fail(`${root.name} dorsal fin does not attach at centered top body volume.`);
  for (const fin of pectorals) {
    if (!(Math.abs(fin.position.z) < bodyWidth * 0.5 && Math.abs(fin.position.x) < bodyLength * 0.35)) fail(`${root.name} pectoral fin is not attached to the body side.`);
  }

  const bodyBoundsWithEyeEpsilon = bodyBounds.clone().expandByScalar(Math.min(bodyHeight, bodyWidth) * 0.1);
  for (const attachment of [tail, dorsal, ...pectorals, ...eyes]) {
    if (!localMeshBox(attachment).intersectsBox(bodyBounds)) fail(`${attachment.name} is separated from the body by a visible gap.`);
  }
  for (const eye of eyes) {
    if (!bodyBoundsWithEyeEpsilon.containsPoint(eye.position)) fail(`${eye.name} is floating outside the body bounds.`);
  }
}


const dungeonSceneSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/DungeonScene.js', import.meta.url), 'utf8'));
if (dungeonSceneSource.includes('FIELD_FISH_SPECIES')) fail('Duplicate local FIELD_FISH_SPECIES registry returned; raw fish pickups must use shared Kerovac species.');
if (!dungeonSceneSource.includes("visualSource: 'sharedKerovacFishSpeciesFactory'")) fail('Raw fish pickup invalid: shared Kerovac fish factory visual source metadata is missing.');
if (!dungeonSceneSource.includes('pickupGroundOrientation')) fail('Raw fish pickup invalid: fish pickup root has no ground orientation transform metadata.');
if (!dungeonSceneSource.includes('animatedVisualChild: true') || !dungeonSceneSource.includes('flopAnimation')) fail('Raw fish pickup invalid: flopping animation metadata is missing for raw fish pickups.');
if (!dungeonSceneSource.includes('interactionTargetStable: true')) fail('Raw fish pickup invalid: pickup interaction target is not marked stable while visual child flops.');
if (!dungeonSceneSource.includes("zone?.shape === 'ellipse'") || !dungeonSceneSource.includes("rawFishLanding: 'pond-shoreline-edge'") || !dungeonSceneSource.includes('waterEdge')) fail('Pond Expo raw fish landing invalid: shoreline ellipse/water-edge landing logic is missing.');
if (!dungeonSceneSource.includes('this.getRawFishLandingPosition(player, zone)')) fail('Raw fish spawn invalid: active fishing zone is not passed into landing calculation.');
if (!dungeonSceneSource.includes('new THREE.Box3().setFromObject(object)') || !dungeonSceneSource.includes('groundedByBoundingBox')) fail('Fish pickup invalid: grounded placement does not account for mesh bounding box.');
if (!dungeonSceneSource.includes('sampleFishLandingSurfaceY')) fail('Fish pickup invalid: landing surface height is not sampled before grounding.');

const pondExpoDefinition = await import('../src/game/locations/oarbOutdoorExpo.definition.js').then((module) => module.oarbOutdoorExpoDefinition ?? module.default ?? module);
const waterBodies = pondExpoDefinition.waterBodies ?? pondExpoDefinition.ponds ?? [];
for (const pond of waterBodies.filter((body) => body.fishable)) {
  const [centerX, centerZ] = pond.center ?? [];
  const radiusX = pond.radiusX ?? pond.rx ?? pond.radius?.[0] ?? pond.size?.[0] * 0.5;
  const radiusZ = pond.radiusZ ?? pond.rz ?? pond.radius?.[1] ?? pond.size?.[1] * 0.5;
  if (![centerX, centerZ, radiusX, radiusZ].every(Number.isFinite)) continue;
  const outward = new THREE.Vector3(1, 0, 0).normalize();
  const edgeDistance = 1 / Math.sqrt((outward.x * outward.x) / (radiusX * radiusX) + (outward.z * outward.z) / (radiusZ * radiusZ));
  const landing = new THREE.Vector3(centerX, 0.24, centerZ).addScaledVector(outward, edgeDistance + 1.2);
  const normalized = ((landing.x - centerX) ** 2) / (radiusX ** 2) + ((landing.z - centerZ) ** 2) / (radiusZ ** 2);
  if (!(normalized > 1)) fail(`${pond.label ?? pond.id} invalid: raw fish landing point is inside water footprint.`);
  if (!(normalized < 2.5)) fail(`${pond.label ?? pond.id} invalid: raw fish landing point is not near the water edge.`);
}


const gameSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8'));
const interactionSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/Interactions.js', import.meta.url), 'utf8'));
const castingSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/fishing/CastingController.js', import.meta.url), 'utf8'));
const lureSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/fishing/LureProjectile.js', import.meta.url), 'utf8'));
const linePhysicsSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/fishing/FishingLinePhysics.js', import.meta.url), 'utf8'));
const physicalFishSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/fishing/PhysicalFishAngling.js', import.meta.url), 'utf8'));
const tuningSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/fishing/CastingTuning.js', import.meta.url), 'utf8'));
if (!gameSource.includes('gameState: this.gameState')) fail('Fishing invalid: FishingRodView does not receive GameState field tool equipment.');
if (!gameSource.includes('new FishingRodView') || !gameSource.includes('new CastingController')) fail('Fishing invalid: Rod A1 view exists when equipped and cast controller exists checks failed.');
if (interactionSource.includes("return this.startFishingTimedAction(interaction);")) fail('Fishing invalid: old proximity timer fishing remains primary while Rod A1 is equipped.');
if (castingSource.includes('spawnRawFishPickupFromCast') || /FISH ON/i.test(castingSource)) fail('Fishing invalid: cast landing bypasses the physical fish loop or restores forbidden hook text.');
if (!physicalFishSource.includes('spawnRawFishPickupAtPosition') || !physicalFishSource.includes("setState('reeledToShore')")) fail('Fishing invalid: physical shore landing does not own successful fish pickup creation.');

if (castingSource.includes('cast-zone') || castingSource.includes('Drag Rod')) fail('Fishing invalid: casting still depends on a dedicated cast button or cast zone.');
if (!castingSource.includes('projectRodGrabHit') || !castingSource.includes('pointerdown') || !castingSource.includes('grabT')) fail('Fishing invalid: rod cannot be directly grabbed by touching the visible rod.');
if (!castingSource.includes('CAST_GESTURE_HISTORY_MS') || !castingSource.includes('gestureHistory') || !castingSource.includes('computeReleaseVelocity')) fail('Fishing invalid: casting does not use gesture history.');
if (!castingSource.includes('getWorldTipPosition()') || !castingSource.includes('getWorldTipVelocity') || !castingSource.includes('tipVelocity') || !castingSource.includes('buildLaunchDirection')) fail('Fishing invalid: rod release does not use rod motion / rod-tip velocity.');
if (!castingSource.includes('CAST_MIN_DRAG_DISTANCE') || !castingSource.includes('CAST_MIN_RELEASE_SPEED') || !castingSource.includes('!castValid')) fail('Fishing invalid: weak tap launches lure.');
if (castingSource.includes('holdDuration') || castingSource.includes('setTimeout') || castingSource.includes('power bar')) fail('Fishing invalid: old proximity timer fishing returned as primary path.');
const rodViewSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/fishing/FishingRodView.js', import.meta.url), 'utf8'));
if (!rodViewSource.includes('equipped via EquipmentRuntime weapon') || !rodViewSource.includes('equipped via GameState field tool') || !rodViewSource.includes('not equipped')) fail('Fishing invalid: Rod A1 visible-state reason validation is missing.');
if (!rodViewSource.includes('getEquippedFieldTool') || !rodViewSource.includes('COMPATIBLE_FISHING_ROD_ITEM_ID')) fail('Fishing invalid: FishingRodView does not recognize GameState field tool equipment.');
if (!rodViewSource.includes('ROD_REST_POS') || !rodViewSource.includes('ROD_REST_ROT') || !rodViewSource.includes('raised-diagonal')) fail('Fishing invalid: rod rest pose is not the raised diagonal reference composition.');
if (!rodViewSource.includes('projectRodGrabHit') || !rodViewSource.includes('ROD_GRAB_HIT_RADIUS') || !rodViewSource.includes('grabT')) fail('Fishing invalid: rod cannot be directly grabbed by touching the visible rod.');
if (!rodViewSource.includes('includeLine: false') || rodViewSource.includes('first-person-rodA1-line') || rodViewSource.includes('first-person-rodA1-clean-dark-hook')) fail('Fishing invalid: first-person Rod A1 still contains baked fake line/hook geometry.');

function projectedRodTipForDrag(dx, dy) {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
  camera.lookAt(0, 0, -1);
  const rodView = new FishingRodView({ camera, equipmentRuntime: { getEquippedWeaponProfile: () => ({ id: 'fishing_rod' }) } });
  const rodYaw = -dx * 0.0095;
  const rodPitch = -dy * 0.0082;
  const rootOffsetX = dx * 0.0075;
  const rootOffsetY = -dy * 0.0048;
  const rootOffsetZ = -dy * 0.0032 + Math.abs(dx) * -0.0009;
  for (let i = 0; i < 18; i += 1) rodView.update(1 / 60, { dragging: true, rodYaw, rodPitch, rootOffsetX, rootOffsetY, rootOffsetZ });
  camera.updateMatrixWorld(true); rodView.root.updateMatrixWorld(true);
  const projected = rodView.getWorldTipPosition().project(camera);
  return { screenX: (projected.x * 0.5 + 0.5) * 1600, screenY: (-projected.y * 0.5 + 0.5) * 900 };
}
const rodTipCenter = projectedRodTipForDrag(0, 0);
const rodTipRight = projectedRodTipForDrag(40, 0);
const rodTipLeft = projectedRodTipForDrag(-40, 0);
const rodTipDown = projectedRodTipForDrag(0, 40);
const rodTipUp = projectedRodTipForDrag(0, -40);
if (!(rodTipRight.screenX > rodTipCenter.screenX && rodTipLeft.screenX < rodTipCenter.screenX && rodTipDown.screenY > rodTipCenter.screenY && rodTipUp.screenY < rodTipCenter.screenY)) fail('Fishing invalid: Rod A1 grab point moves opposite pointer drag.');
if (Math.hypot(rodTipRight.screenX - rodTipLeft.screenX, rodTipRight.screenY - rodTipLeft.screenY) < 180) fail('Fishing invalid: Rod A1 grab only applies tiny rotation; whole rod motion missing.');
if (!lureSource.includes('Number.isFinite(length)') && !lureSource.includes('this.velocity')) fail('Fishing invalid: lure projectile uses finite positions/velocities check failed.');
if (!lureSource.includes('replacesUglyFakeWorm: true')) fail('Fishing invalid: fake worm lure was not replaced.');
if (!lureSource.includes('weightedLureMass') || !linePhysicsSource.includes('lureMass') || !linePhysicsSource.includes('lureVelocity')) fail('Fishing invalid: advanced line physics missing weighted lure state.');
if (!linePhysicsSource.includes('linePoints') || !linePhysicsSource.includes('LINE_SEGMENT_ITERATIONS') || !linePhysicsSource.includes('solveRope')) fail('Fishing invalid: fishing line does not use dynamic spool length.');
if (!linePhysicsSource.includes('currentLineLength') || !linePhysicsSource.includes('maxLineLength') || !linePhysicsSource.includes('spoolOutSpeed')) fail('Fishing invalid: fishing line does not use dynamic spool length.');
if (!linePhysicsSource.includes('lineTension') || !linePhysicsSource.includes('LINE_TENSION_STIFFNESS') || !linePhysicsSource.includes('LINE_TENSION_DAMPING')) fail('Fishing invalid: line tension is not computed.');
if (!lureSource.includes('LINE_SLACK_OPACITY') || !lureSource.includes('LINE_TAUT_OPACITY') || !lureSource.includes('tensionOpacity')) fail('Fishing invalid: line opacity/visibility does not respond to tension.');
if (lureSource.includes('LineBasicMaterial') || lureSource.includes('new THREE.Line(') || !lureSource.includes('CylinderGeometry') || !lureSource.includes('meshBasedLineRenderer') || !lureSource.includes('visibleFromMultipleViewAngles')) fail('Fishing invalid: gameplay line renderer is too thin / angle-dependent for mobile use.');
if (!lureSource.includes('depthWrite: false') || !lureSource.includes('depthTest: true')) fail('Fishing invalid: gameplay fishing line visibility is unreliable across view angles.');
if (!linePhysicsSource.includes('enterWater') || !linePhysicsSource.includes('isLureOnWater') || !linePhysicsSource.includes('LURE_WATER_BOB_HEIGHT')) fail('Fishing invalid: lure has no water-surface mode.');
if (!castingSource.includes('rodHeld') || !castingSource.includes('reelBoost') || !linePhysicsSource.includes('LURE_SURFACE_PULL_SCALE')) fail('Fishing invalid: lure cannot be manipulated after landing on water.');
if (!linePhysicsSource.includes('LURE_HELICOPTER_TENSION_SCALE') || !linePhysicsSource.includes('isLureHeldNearRod')) fail('Fishing invalid: advanced line physics missing weighted lure state.');
if (!lureSource.includes('settleMs') || !lureSource.includes('FISH_BITE_SETTLE_MIN_MS')) fail('Fishing invalid: fish catch does not wait for a water-surface settle window.');
if (!tuningSource.includes('LINE_POINT_COUNT') || !tuningSource.includes('FISH_BITE_SETTLE_MAX_MS')) fail('Fishing invalid: advanced fishing tunable constants are missing.');

const slackOpacityMatch = tuningSource.match(/LINE_SLACK_OPACITY\s*=\s*([0-9.]+)/);
const tautOpacityMatch = tuningSource.match(/LINE_TAUT_OPACITY\s*=\s*([0-9.]+)/);
const idleLengthMatch = tuningSource.match(/LINE_START_LENGTH\s*=\s*([0-9.]+)/);
const minLengthMatch = tuningSource.match(/LINE_MIN_LENGTH\s*=\s*([0-9.]+)/);
const slackOpacity = Number(slackOpacityMatch?.[1]);
const tautOpacity = Number(tautOpacityMatch?.[1]);
const idleLineLength = Number(idleLengthMatch?.[1]);
const minLineLength = Number(minLengthMatch?.[1]);
if (!(slackOpacity >= 0.30 && slackOpacity <= 0.40 && tautOpacity >= 0.70 && tautOpacity <= 0.85 && tautOpacity > slackOpacity)) fail('Fishing invalid: line visibility below required threshold.');
if (!(idleLineLength <= 0.72 && minLineLength <= 0.45)) fail('Fishing invalid: idle lure line length was not reduced.');
if (!castingSource.includes('targetYaw = THREE.MathUtils.clamp(this.state.targetYaw - dx') || !castingSource.includes('targetPitch = THREE.MathUtils.clamp(this.state.targetPitch - dy') || !castingSource.includes('targetRootOffsetX = THREE.MathUtils.clamp(this.state.targetRootOffsetX + dx')) fail('Fishing invalid: Rod A1 grab point moves opposite pointer drag.');
if (!castingSource.includes('rootOffsetX') || !rodViewSource.includes('pose.rootOffset') || !rodViewSource.includes('this.root.position.x = ROD_REST_POS.x + this.pose.rootOffset.x')) fail('Fishing invalid: Rod A1 grab only applies tiny rotation; whole rod motion missing.');
if (!castingSource.includes('Screen-space sign convention')) fail('Fishing invalid: Rod A1 drag direction sign convention is undocumented.');
if (!linePhysicsSource.includes('sampleOutdoorY') || !linePhysicsSource.includes('LINE_GROUND_CLEARANCE') || !linePhysicsSource.includes('LURE_GROUND_CLEARANCE') || !linePhysicsSource.includes('clampLineToTerrain') || !linePhysicsSource.includes('clampLureToTerrain')) fail('Fishing invalid: line/lure passes below terrain.');
if (!linePhysicsSource.includes('constrainGroundedLureToTerrain') || !linePhysicsSource.includes("lureRecoveryState = 'deployedGround'")) fail('Fishing invalid: deployed ground lure does not remain terrain-owned before recovery.');
if (!linePhysicsSource.includes('allowedHorizontalDistance') || !linePhysicsSource.includes("lureRecoveryState = 'deployedWater'") || !linePhysicsSource.includes("lureRecoveryState = 'recoveringToTip'")) fail('Fishing invalid: water/ground contact does not drag horizontally before recovery lift.');
if (!linePhysicsSource.includes('activePoints') || !linePhysicsSource.includes('emittedLineLength') || !linePhysicsSource.includes('solveAirborneRope') || !linePhysicsSource.includes('collapseAtRodTip')) fail('Fishing invalid: active/emitted line length does not grow progressively after cast.');
if (!linePhysicsSource.includes('!this.isCasting') || !linePhysicsSource.includes('solveAirborneRope')) fail('Fishing invalid: airborne cast line is terrain-clamped before projectile landing ownership.');

if (!castingSource.includes("hud.showMessage('Cast Failed')")) fail('Fishing invalid: failed ground cast spawned a fish.');

console.log(`Fish geometry sanity check passed for ${fishRoots.length} continuous symmetrical volumetric fish and raw pickup presentation.`);

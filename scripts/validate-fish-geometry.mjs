import * as THREE from 'three';
import { buildDungeonGeometry } from '../src/engine/dungeon-authoring/DungeonGeometryBuilder.js';
import { kerovacDefinition } from '../src/game/locations/generated/kerovac.definition.js';
import { FISH_SPECIES_IDS, FISH_SPECS, FISH_TEXTURE_PROFILES, createFishMesh } from '../src/game/fishing/FishMeshFactory.js';
import { ACTIVE_GAMEPLAY_RODS, CANONICAL_GAMEPLAY_ROD_ID, KEROVAC_EXPO_ROD_A1_SOURCE, createRodA1Mesh } from '../src/game/fishing/FishingRodFactory.js';

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
if (!gameSource.includes('new FishingRodView') || !gameSource.includes('new CastingController')) fail('Fishing invalid: Rod A1 view exists when equipped and cast controller exists checks failed.');
if (interactionSource.includes("return this.startFishingTimedAction(interaction);")) fail('Fishing invalid: old proximity timer fishing remains primary while Rod A1 is equipped.');
if (!castingSource.includes('spawnRawFishPickupFromCast') || !castingSource.includes('Fish On')) fail('Fishing invalid: successful catch is not routed through cast landing.');

if (castingSource.includes('cast-zone') || castingSource.includes('Drag Rod')) fail('Fishing invalid: casting still depends on a dedicated cast button or cast zone.');
if (!castingSource.includes('projectRodGrabHit') || !castingSource.includes('pointerdown') || !castingSource.includes('grabT')) fail('Fishing invalid: rod cannot be directly grabbed by touching the visible rod.');
if (!castingSource.includes('CAST_GESTURE_HISTORY_MS') || !castingSource.includes('gestureHistory') || !castingSource.includes('computeReleaseVelocity')) fail('Fishing invalid: casting does not use gesture history.');
if (!castingSource.includes('getWorldTipPosition()') || !castingSource.includes('getWorldTipVelocity') || !castingSource.includes('tipVelocity') || !castingSource.includes('buildLaunchDirection')) fail('Fishing invalid: rod release does not use rod motion / rod-tip velocity.');
if (!castingSource.includes('CAST_MIN_DRAG_DISTANCE') || !castingSource.includes('CAST_MIN_RELEASE_SPEED') || !castingSource.includes('!castValid')) fail('Fishing invalid: weak tap launches lure.');
if (castingSource.includes('holdDuration') || castingSource.includes('setTimeout') || castingSource.includes('power bar')) fail('Fishing invalid: old proximity timer fishing returned as primary path.');
const rodViewSource = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/game/fishing/FishingRodView.js', import.meta.url), 'utf8'));
if (!rodViewSource.includes('ROD_REST_POS') || !rodViewSource.includes('ROD_REST_ROT') || !rodViewSource.includes('raised-diagonal')) fail('Fishing invalid: rod rest pose is not the raised diagonal reference composition.');
if (!rodViewSource.includes('projectRodGrabHit') || !rodViewSource.includes('ROD_GRAB_HIT_RADIUS') || !rodViewSource.includes('grabT')) fail('Fishing invalid: rod cannot be directly grabbed by touching the visible rod.');
if (!lureSource.includes('Number.isFinite(length)') && !lureSource.includes('this.velocity')) fail('Fishing invalid: lure projectile uses finite positions/velocities check failed.');
if (!lureSource.includes('replacesUglyFakeWorm: true')) fail('Fishing invalid: fake worm lure was not replaced.');
if (!castingSource.includes("hud.showMessage('Cast Failed')")) fail('Fishing invalid: failed ground cast spawned a fish.');

console.log(`Fish geometry sanity check passed for ${fishRoots.length} continuous symmetrical volumetric fish and raw pickup presentation.`);

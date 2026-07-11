import * as THREE from 'three';
import { sampleFoliageRootFootprint } from '../../engine/outdoor-authoring/OutdoorFoliageGrounding.js';
import { createOutdoorTerrainMesh } from '../../engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { createOutdoorTerrainComposition } from '../../engine/outdoor-authoring/OutdoorTerrainCompositionBuilder.js';
import { createOutdoorPathCorridorBridgeSurfaces, createOutdoorPathCorridorDebugGroup, createOutdoorPathCorridorMeshes, createOutdoorPathCorridorSurfaceSampler } from '../../engine/outdoor-authoring/OutdoorPathCorridorBuilder.js';
import { createPondCompositeGeometry, createPondOutlineDiscGeometry, createPondOutlineRingGeometry } from '../../engine/outdoor-authoring/PondCompositeBuilder.js';
import { createOutdoorSplinePathSupportSurfaces, createOutdoorSplineTrailEdgeMeshes, createOutdoorSplineTrailMeshes, createOutdoorSplineVisibleSurfaceSampler } from '../../engine/outdoor-authoring/OutdoorSplineBuilder.js';
import { createOutdoorCurvedBlockers } from '../../engine/outdoor-authoring/OutdoorBlockerBuilder.js';
import { createOutdoorPrimitiveMeshes } from '../../engine/outdoor-authoring/OutdoorPrimitiveBuilder.js';
import { createPondDecorGroups } from '../../engine/outdoor-authoring/PondDecorBuilder.js';
import { OUTDOOR_FOLIAGE_SPRITES, OUTDOOR_REDWOOD_FOLIAGE_SPRITES, OUTDOOR_SMALL_FOLIAGE_SPRITES, resolveOutdoorFoliageGrounding } from '../../engine/outdoor-authoring/OutdoorFoliageRegistry.js';
import { FISH_SPECS } from '../fishing/FishMeshFactory.js';
import { createOutdoorWaterwayDebugGroup, createOutdoorWaterwayMeshes } from '../../engine/outdoor-authoring/OutdoorWaterwayBuilder.js';
import { createOutdoorCrossingGroups } from '../world-kits/structures/OutdoorCrossingKit.js';
import { createOutdoorWildernessStructureGroups } from '../world-kits/structures/OutdoorWildernessStructureKit.js';
import { createOutdoorWorldDebugGroup, resolveOutdoorDebugFlags } from './OutdoorWorldDebug.js';
import { createOutdoorMaterialGallery } from './OutdoorMaterialGallery.js';
import { createOutdoorWaterMaterial } from './OutdoorWaterMaterialRuntime.js';

export { createOutdoorTerrainMesh } from '../../engine/outdoor-authoring/OutdoorTerrainBuilder.js';
export { createOutdoorTerrainSampler } from '../../engine/outdoor-authoring/OutdoorTerrainBuilder.js';
export { createOutdoorCurvedBlockers } from '../../engine/outdoor-authoring/OutdoorBlockerBuilder.js';
export { OUTDOOR_FOLIAGE_SPRITES, OUTDOOR_REDWOOD_FOLIAGE_SPRITES, OUTDOOR_SMALL_FOLIAGE_SPRITES } from '../../engine/outdoor-authoring/OutdoorFoliageRegistry.js';

const DEFAULT_FIELD_SIZE = 400;

function createOrganicPondDiscGeometry(segments = 80, wobble = 0.08) {
  const vertices = [0, 0, 0];
  const uvs = [0.5, 0.5];
  const indices = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const edge = 1 + Math.sin(angle * 3.0 + 0.45) * wobble + Math.sin(angle * 5.0 - 0.8) * wobble * 0.45;
    const x = Math.cos(angle) * edge;
    const z = Math.sin(angle) * edge;
    vertices.push(x, 0, z);
    uvs.push(0.5 + x * 0.5, 0.5 + z * 0.5);
    if (index > 0) indices.push(0, index, index + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createOrganicPondRingGeometry(segments = 80, wobble = 0.08, innerScaleX = 0.74, innerScaleZ = 0.74) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const edge = 1 + Math.sin(angle * 3.0 + 0.45) * wobble + Math.sin(angle * 5.0 - 0.8) * wobble * 0.45;
    vertices.push(Math.cos(angle) * edge * innerScaleX, 0, Math.sin(angle) * edge * innerScaleZ, Math.cos(angle) * edge, 0, Math.sin(angle) * edge);
    uvs.push(0.5, 0, 1, 1);
    if (index > 0) {
      const a = (index - 1) * 2;
      indices.push(a, a + 1, index * 2, index * 2, a + 1, index * 2 + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeRuntimeMaterial(makeTexturedMaterial, marker) {
  return (profile, metadata) => {
    const material = makeTexturedMaterial(profile);
    material.userData = { ...(material.userData ?? {}), [marker]: true, materialKey: metadata.materialKey, materialFallbackUsed: metadata.usedFallback, sourceProfile: metadata.profile };
    return material;
  };
}

function combinePathSurfaceSamplers(primary, fallback) {
  if (!primary) return fallback;
  if (!fallback) return primary;
  return {
    kind: 'oarbCompositePathSurfaceSampler',
    sampleOutdoorY(x, z) {
      const primaryY = primary.sampleOutdoorY(x, z);
      return Number.isFinite(primaryY) ? primaryY : fallback.sampleOutdoorY(x, z);
    },
    sampleSurface(x, z) {
      return primary.sampleSurface?.(x, z) ?? fallback.sampleSurface?.(x, z) ?? null;
    },
    userData: { primary: primary.kind, fallback: fallback.kind },
  };
}

export function createOutdoorFieldBlockers(definition, rectangularBlockers = []) {
  return [
    ...rectangularBlockers.filter((blocker) => blocker.blocksPlayer !== false).map(({ id, minX, maxX, minZ, maxZ, height, type, tags, userData }) => ({ id, minX, maxX, minZ, maxZ, height, type, tags, userData })),
    ...createOutdoorCurvedBlockers(definition?.curvedBlockers),
  ];
}

export function buildOutdoorFieldRuntime({ definition = {}, textureProfiles = {}, scene, collision = null, makeTexturedMaterial, loadFoliageTexture, registerAnimatedTextureFlipbook = null, createPondLabel = null, createHarvestable = null, gameState = null, constants = {} }) {
  const addedObjects = [];
  const add = (object) => { scene.add(object); addedObjects.push(object); return object; };
  const terrainDefinition = definition.terrain ?? { size: [DEFAULT_FIELD_SIZE, DEFAULT_FIELD_SIZE], segments: [1, 1], baseY: 0, material: 'fieldGrass', heightStamps: [] };
  const composition = createOutdoorTerrainComposition(terrainDefinition, {
    textures: textureProfiles,
    name: constants.terrainName ?? 'TERRAIN01-oarb-terrain-composition',
    makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbTerrainMaterial'),
    pathCorridors: definition.splineTrails,
    waterways: definition.waterways,
  });
  const terrain = composition?.group ?? createOutdoorTerrainMesh(terrainDefinition, {
    textures: textureProfiles,
    name: constants.terrainName ?? 'TERRAIN01-reliquary-field-oarb-heightfield-terrain',
    makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbTerrainMaterial'),
    pathCorridors: definition.splineTrails,
    waterways: definition.waterways,
  });
  terrain.userData = { ...terrain.userData, blueprint: 'docs/DARB_OUTDOOR_AUTHORING_RUNTIME_MILESTONE.md', legacyFieldBlueprint: 'docs/world/overworld/reliquary_field_v01.md', longTermBlueprintSize: 800, playerGroundingChanged: true };
  const terrainSampler = composition?.terrainSampler ?? terrain.userData.terrainSampler;
  add(terrain);

  const pathCorridorRuntime = terrainSampler.pathCorridorRuntime ?? null;
  const legacySplineTrails = (definition.splineTrails ?? []).filter((trail) => !trail?.surfaceMode);
  const corridorSurfaceSampler = createOutdoorPathCorridorSurfaceSampler(pathCorridorRuntime, { terrainSampler });
  const legacyPathSurfaceSampler = createOutdoorSplineVisibleSurfaceSampler(legacySplineTrails, { terrainSampler });
  const pathSurfaceSampler = combinePathSurfaceSamplers(corridorSurfaceSampler, legacyPathSurfaceSampler);
  const splineMaterialFactory = makeRuntimeMaterial(makeTexturedMaterial, 'oarbSplineTrailMaterial');
  createOutdoorPathCorridorMeshes(pathCorridorRuntime, { terrainSampler, textures: textureProfiles, makeMaterial: splineMaterialFactory }).forEach(add);
  createOutdoorSplineTrailMeshes(legacySplineTrails, { terrainSampler, textures: textureProfiles, makeMaterial: splineMaterialFactory }).forEach(add);
  createOutdoorSplineTrailEdgeMeshes(legacySplineTrails, { terrainSampler, textures: textureProfiles, makeMaterial: splineMaterialFactory }).forEach(add);
  const pathSupportSurfaces = [
    ...createOutdoorPathCorridorBridgeSurfaces(pathCorridorRuntime),
    ...createOutdoorSplinePathSupportSurfaces(legacySplineTrails, { terrainSampler }),
  ];
  if (collision) {
    collision.walkableSurfaces = [...(collision.walkableSurfaces ?? []), ...pathSupportSurfaces];
    collision.userData = { ...(collision.userData ?? {}), oarbSplinePathSupportSurfaces: pathSupportSurfaces.length };
  }

  const fishingZones = [];
  const waterwayRuntime = terrainSampler.waterwayRuntime ?? null;
  createOutdoorWaterwayMeshes(waterwayRuntime, { textures: textureProfiles, makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbWaterwayMaterial'), registerAnimatedTextureFlipbook }).forEach(add);
  const crossingGroups = createOutdoorCrossingGroups(definition.outdoorCrossings, { terrainSampler, waterwayRuntime, pathCorridorRuntime, textures: textureProfiles, makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbCrossingMaterial') });
  crossingGroups.forEach(add);
  const wildernessStructureGroups = createOutdoorWildernessStructureGroups(definition.outdoorStructureKits, { terrainSampler, textures: textureProfiles, makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbWildernessStructureMaterial') });
  wildernessStructureGroups.forEach(add);
  fishingZones.push(...(waterwayRuntime?.fishingZones ?? []));
  const pondMeshes = buildOutdoorPonds({ waterBodies: definition.waterBodies, textureProfiles, makeTexturedMaterial, registerAnimatedTextureFlipbook, createPondLabel, fishingZones });
  pondMeshes.forEach(add);
  createPondDecorGroups(definition.waterBodies, { terrainSampler, textures: textureProfiles, makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbPondDecorMaterial'), loadFoliageTexture }).forEach(add);

  const foliageBillboards = [];
  const foliageGroup = buildAuthoredFoliageGroup({ foliageBillboards: definition.foliageBillboards, foliageBillboardVariants: definition.foliageBillboardVariants, terrainSampler, pathCorridorRuntime, loadFoliageTexture, createHarvestable, gameState, visibleDistanceSq: constants.visibleDistanceSq, alphaTest: constants.alphaTest });
  if (foliageGroup) { foliageGroup.children.forEach((child) => foliageBillboards.push(child)); add(foliageGroup); }

  createOutdoorPrimitiveMeshes(definition.outdoorPrimitives, { terrainSampler, textures: textureProfiles, makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbOutdoorPrimitiveMaterial') }).forEach(add);

  const pathDebugGroup = createOutdoorPathCorridorDebugGroup(pathCorridorRuntime, { terrainSampler, enabled: Boolean(import.meta.env?.DEV && globalThis.__DSB_PATH_CORRIDOR_DEBUG__) });
  if (pathDebugGroup) add(pathDebugGroup);
  const waterwayDebugGroup = createOutdoorWaterwayDebugGroup(waterwayRuntime, { enabled: Boolean(import.meta.env?.DEV && globalThis.__DSB_WATERWAY_DEBUG__) });
  if (waterwayDebugGroup) add(waterwayDebugGroup);

  const debugFlags = import.meta.env?.DEV ? resolveOutdoorDebugFlags() : null;
  const outdoorDebugGroup = debugFlags ? createOutdoorWorldDebugGroup(definition, { terrainSampler, fishingZones, debug: { terrainChunkSummaries: composition?.summaries ?? null } }, debugFlags) : null;
  if (outdoorDebugGroup) add(outdoorDebugGroup);
  const materialGallery = debugFlags?.gallery && definition.development?.materialGallery
    ? createOutdoorMaterialGallery({ profiles: textureProfiles, makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbMaterialGallery'), loadTexture: loadFoliageTexture, origin: definition.development.materialGallery.origin, maxProfiles: definition.development.materialGallery.maxProfiles })
    : null;
  if (materialGallery) add(materialGallery);

  return {
    terrain,
    terrainSampler,
    pathCorridorRuntime,
    waterwayRuntime,
    pathSurfaceSampler,
    visibleSurfaceSampler: null,
    pathSupportSurfaces,
    fishingZones,
    foliageGroup,
    foliageBillboards,
    addedObjects,
    debug: {
      pondMeshCount: pondMeshes.length,
      primitiveCount: definition.outdoorPrimitives?.length ?? 0,
      pathCorridorAudit: pathCorridorRuntime?.audit ?? null,
      pathDebugOverlayEnabled: Boolean(pathDebugGroup),
      terrainChunkCount: composition?.chunks.length ?? 1,
      terrainChunkSummaries: composition?.summaries ?? null,
      waterwayAudit: waterwayRuntime?.audit ?? null,
      waterwayDebugOverlayEnabled: Boolean(waterwayDebugGroup),
      crossingMeshCount: crossingGroups.reduce((sum, group) => sum + group.children.length, 0),
      wildernessStructureMeshCount: wildernessStructureGroups.reduce((sum, group) => sum + group.children.length, 0),
      outdoorDebugOverlayEnabled: Boolean(outdoorDebugGroup),
      materialGalleryEnabled: Boolean(materialGallery),
    },
  };
}

export function buildOutdoorPonds({ waterBodies = [], textureProfiles = {}, makeTexturedMaterial, registerAnimatedTextureFlipbook, createPondLabel, fishingZones }) {
  const meshes = [];
  if (!Array.isArray(waterBodies)) return meshes;
  waterBodies.forEach((body) => {
    if (body?.kind !== 'pond') return;
    const [cx, cz] = Array.isArray(body.center) ? body.center : [];
    const [rx, rz] = Array.isArray(body.radius) ? body.radius : [body.radius, body.radius];
    const y = Number(body.y);
    if (![cx, cz, rx, rz, y].every(Number.isFinite) || rx <= 0 || rz <= 0) return;
    const shoreWidth = Number.isFinite(body.shoreWidth) ? Math.max(0, body.shoreWidth) : 0;
    const footprint = body.footprint ?? {};
    const waterOutline = Array.isArray(footprint.waterOutline) ? footprint.waterOutline : null;
    const mudBedOutline = Array.isArray(footprint.mudBedOutline) ? footprint.mudBedOutline : null;
    const outerShoreOutline = Array.isArray(footprint.outerShoreOutline) ? footprint.outerShoreOutline : null;
    const usesSharedComposite = ['radial-expansion-irregular-polygon', 'per-vertex-expansion-irregular-polygon'].includes(footprint.recipe) && waterOutline?.length >= 3 && mudBedOutline?.length >= 3;
    const composite = usesSharedComposite ? createPondCompositeGeometry(body) : null;
    const [bedRx, bedRz] = Array.isArray(body.bedRadius) ? body.bedRadius : [rx + shoreWidth, rz + shoreWidth];
    const [outerShoreRx, outerShoreRz] = Array.isArray(footprint.outerShoreRadius) ? footprint.outerShoreRadius : [rx + shoreWidth, rz + shoreWidth];
    const wobble = Number.isFinite(footprint.wobble) ? footprint.wobble : 0.075;
    if (body.bedMaterial && (mudBedOutline?.length >= 3 || (Number.isFinite(bedRx) && Number.isFinite(bedRz) && bedRx > rx && bedRz > rz))) {
      const bedMaterial = makeTexturedMaterial(textureProfiles[body.bedMaterial] ?? textureProfiles.mudChurnedWet ?? { color: 0xb58b5d, roughness: 1 });
      bedMaterial.name = `OARB-water-bed-material-${body.bedMaterial}`; bedMaterial.side = THREE.DoubleSide;
      const bed = new THREE.Mesh(composite?.mudBed.geometry ?? (mudBedOutline?.length >= 3 ? createPondOutlineDiscGeometry(mudBedOutline, [cx, cz]) : createOrganicPondDiscGeometry(88, wobble)), bedMaterial);
      bed.name = `OARB-water-bright-mud-bed-${body.id}`; bed.position.set(...(composite?.mudBed.position ?? [cx, y + 0.006, cz])); if (!mudBedOutline?.length) bed.scale.set(bedRx, 1, bedRz); bed.receiveShadow = true; bed.renderOrder = 11; bed.userData = { id: body.id, kind: 'pondMudBed', materialKey: body.bedMaterial, footprintRecipe: footprint.recipe, geometrySource: composite?.mudBed.source, coordinateBasis: composite?.coordinateBasis, collision: 'visual-only terrain-hugging bright mud bed' }; meshes.push(bed);
    }
    const shoreMaterial = makeTexturedMaterial(textureProfiles[body.shoreMaterial] ?? textureProfiles.mudWetDark ?? { color: 0x60462f, roughness: 1 });
    shoreMaterial.name = `OARB-water-shore-material-${body.shoreMaterial ?? 'mud'}`; shoreMaterial.side = THREE.DoubleSide;
    const shore = new THREE.Mesh(composite?.wetShore?.geometry ?? (mudBedOutline?.length >= 3 && outerShoreOutline?.length >= 3 ? createPondOutlineRingGeometry(mudBedOutline, outerShoreOutline, [cx, cz]) : createOrganicPondRingGeometry(88, wobble, Math.min(0.98, Math.max(0.05, rx / outerShoreRx)), Math.min(0.98, Math.max(0.05, rz / outerShoreRz)))), shoreMaterial);
    shore.name = `OARB-water-shore-${body.id}`; shore.position.set(...(composite?.wetShore?.position ?? [cx, y + 0.018, cz])); if (!(mudBedOutline?.length >= 3 && outerShoreOutline?.length >= 3)) shore.scale.set(outerShoreRx, 1, outerShoreRz); shore.receiveShadow = true; shore.renderOrder = 10; shore.userData = { id: body.id, kind: 'pondShore', materialKey: body.shoreMaterial, geometrySource: composite?.wetShore?.source, coordinateBasis: composite?.coordinateBasis, collision: 'visual-only muddy shoreline' }; meshes.push(shore);
    const profile = textureProfiles[body.material] ?? { color: 0x2d7f92, roughness: 0.5, metalness: 0, transparent: true, opacity: 0.78, emissive: 0x0b4858, emissiveIntensity: 0.34 };
    const waterMat = createOutdoorWaterMaterial(profile,{mode:'pond',name:`OARB-water-material-${body.material ?? 'pondWater'}`}); if (Array.isArray(profile.animatedFrames)) registerAnimatedTextureFlipbook?.(waterMat, profile);
    const water = new THREE.Mesh(composite?.water.geometry ?? (waterOutline?.length >= 3 ? createPondOutlineDiscGeometry(waterOutline, [cx, cz]) : createOrganicPondDiscGeometry(88, 0.075)), waterMat);
    water.name = `OARB-water-body-${body.id}`; water.position.set(...(composite?.water.position ?? [cx, y + 0.035, cz])); if (!waterOutline?.length) water.scale.set(rx, 1, rz); water.renderOrder = 12; water.userData = { id: body.id, kind: body.kind, tags: body.tags ?? [], fishable: Boolean(body.fishable), footprintRecipe: footprint.recipe, geometrySource: composite?.water.source, coordinateBasis: composite?.coordinateBasis, materialKey: body.material, collision: 'visual-only pond water; shore remains walkable' }; meshes.push(water);
    if (body.userData?.pondExpoId) createPondLabel?.(body, cx, composite?.water.position[1] ?? y, cz);
    if (body.fishable) {
      const fishableRadius = Number.isFinite(body.fishableRadius) ? body.fishableRadius : Math.max(rx, rz) + 4;
      fishingZones.push({ id: `${body.id}_fishing_zone`, name: body.userData?.name ?? body.id, debugName: `${body.userData?.name ?? body.id} casting water`, shape: waterOutline?.length >= 3 ? 'polygon' : 'ellipse', points: waterOutline?.length >= 3 ? waterOutline.map((point) => [...point]) : undefined, centerX: cx, centerZ: cz, radiusX: rx, radiusZ: rz, minX: cx - rx, maxX: cx + rx, minZ: cz - rz, maxZ: cz + rz, interactPadding: Math.max(0, fishableRadius - Math.max(rx, rz)), position: new THREE.Vector3(cx, y, cz), label: 'Pond Fishing', waterBodyId: body.id, fishSpeciesPool: (body.fishSpeciesPool ?? []).filter((species) => FISH_SPECS[species]), fishCatchSeed: body.fishCatchSeed ?? body.id, minimumDepth: body.userData?.depthMetersApprox ?? 0.3, castingBanks: body.fishingBanks ?? [], noFoliageLanes: body.fishingBanks?.map((bank) => ({ center: bank.position, radius: bank.noFoliageRadius })) ?? [], visualSpawnBounds: { minX: cx - rx * 0.82, maxX: cx + rx * 0.82, minZ: cz - rz * 0.82, maxZ: cz + rz * 0.82, maximumY: y - 0.08 }, shorelineProfileVersion: body.userData?.shorelineProfileVersion ?? 0 });
    }
  });
  return meshes;
}

function buildAuthoredFoliageGroup({ foliageBillboards = [], foliageBillboardVariants = [], terrainSampler, pathCorridorRuntime = null, loadFoliageTexture, createHarvestable, gameState, visibleDistanceSq = 67600, alphaTest = 0.48 }) {
  if (!Array.isArray(foliageBillboards) || foliageBillboards.length === 0 || !terrainSampler) return null;
  const variants = new Map((foliageBillboardVariants ?? []).map((variant) => [variant.id, variant]));
  const group = new THREE.Group();
  group.name = `OARB-authored-foliage-billboard-forest-${foliageBillboards.length}-instances`;
  group.userData = { kind: 'authoredFoliageBillboards', billboardCount: foliageBillboards.length, variantCount: variants.size, alphaCutoutDepthWrite: true, generatedPathCorridorExclusion: Boolean(pathCorridorRuntime) };
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.translate(0, 0.5, 0);
  const materials = new Map();
  const registryByPath=new Map(OUTDOOR_FOLIAGE_SPRITES.map(sprite=>[sprite.path,sprite])); const groundingReport=[];
  foliageBillboards.forEach((placement) => {
    const variant = variants.get(placement.variantId); const spritePath = placement.spritePath ?? variant?.path;
    if (!spritePath) throw new Error(`Folsom invalid: foliage sprite texture missing for ${placement.id}.`);
    if (!materials.has(spritePath)) {
      const material = new THREE.MeshBasicMaterial({ map: loadFoliageTexture(spritePath), alphaTest, depthTest: true, depthWrite: true, transparent: false, side: THREE.DoubleSide, toneMapped: false });
      material.name = `${placement.variantId}-authored-foliage-alpha-cutout-depth-billboard-material`; material.userData = { authoredFoliageAlphaCutout: true, occludesTransparentWater: true }; materials.set(spritePath, material);
    }
    const [x, authoredY, z] = placement.position ?? [];
    if (pathCorridorRuntime?.isPointInProtectedFootprint?.(x, z)) return;
    const height = placement.height ?? variant?.height ?? 5; const width = placement.width ?? variant?.width ?? 3;
    const mesh = new THREE.Mesh(geometry, materials.get(spritePath)); mesh.name = `OARB-${placement.id}-${placement.variantId}`;
    const metadata=resolveOutdoorFoliageGrounding(placement,variant,registryByPath.get(spritePath)); const grounding=sampleFoliageRootFootprint({terrainSampler,x,z,height,width,metadata}); const maxBillboardYawOffset = placement.maxBillboardYawOffset ?? (placement.tags?.includes('folsom-foliage-billboard') ? 0.18 : Infinity);
    mesh.position.set(x, grounding.positionY, z); mesh.scale.set(width, height, 1); mesh.rotation.y = placement.yawOffset ?? 0; mesh.visible=grounding.status!=='rejected';
    mesh.userData = { ...placement, authoredY, groundY:grounding.centerGroundY, ...metadata, ...grounding, groundingStatus:grounding.status, visualBaseGroundingOffset:grounding.appliedPaddingOffset, maxBillboardYawOffset, bottomAnchoredBillboard: true, billboard: true, alphaCutoutDepthWrite: true, collision: 'none', visibleDistanceSq }; groundingReport.push({id:placement.id,spriteId:metadata.id,...grounding});
    if (placement.layer === 'redwood' && placement.harvestable !== false) { const harvestable = createHarvestable?.({ ...placement, x, z, groundY, zone: placement.tags?.join(':') }, mesh); if (harvestable) mesh.userData.harvestableTreeId = harvestable.id; }
    if (mesh.userData.harvestableTreeId && gameState?.hasHarvestedFieldTree?.(mesh.userData.harvestableTreeId)) mesh.visible = false;
    group.add(mesh);
  });
  group.userData.groundingReport=groundingReport.sort((a,b)=>b.localGroundVariance-a.localGroundVariance); group.userData.groundingStatusCounts=Object.groupBy?Object.fromEntries(Object.entries(Object.groupBy(groundingReport,item=>item.status)).map(([k,v])=>[k,v.length])):{};
  const debugGrounding=import.meta.env?.DEV&&globalThis.location&&new URLSearchParams(globalThis.location.search).get('debug')==='foliage-grounding';
  if(debugGrounding){const debugGroup=new THREE.Group();debugGroup.name='debug-foliage-grounding-root-footprints';const colors={valid:0x35d45b,adjusted:0xf1cf3a,'slope-warning':0xff4a35,rejected:0xff2020,'missing-metadata':0xff2ad4};const order=[1,5,3,7,2,8,4,6];groundingReport.slice(0,120).forEach(report=>{const points=order.map(index=>new THREE.Vector3(report.samples[index].x,report.samples[index].y+.035,report.samples[index].z));const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:colors[report.status]??0x2a8cff,depthTest:false}));line.userData={...report,samples:undefined};debugGroup.add(line);});group.add(debugGroup);console.table(groundingReport.slice(0,20).map(({id,spriteId,status,localGroundVariance,localSlope,appliedBurial})=>({id,spriteId,status,localGroundVariance,localSlope,appliedBurial})));}
  return group;
}

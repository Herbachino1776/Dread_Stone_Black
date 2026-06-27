import * as THREE from 'three';
import { createOutdoorTerrainMesh } from '../../engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { createPondCompositeGeometry, createPondOutlineDiscGeometry, createPondOutlineRingGeometry } from '../../engine/outdoor-authoring/PondCompositeBuilder.js';
import { createOutdoorSplinePathSupportSurfaces, createOutdoorSplineTrailEdgeMeshes, createOutdoorSplineTrailMeshes, createOutdoorSplineVisibleSurfaceSampler } from '../../engine/outdoor-authoring/OutdoorSplineBuilder.js';
import { createOutdoorCurvedBlockers } from '../../engine/outdoor-authoring/OutdoorBlockerBuilder.js';
import { createOutdoorPrimitiveMeshes } from '../../engine/outdoor-authoring/OutdoorPrimitiveBuilder.js';
import { createPondDecorGroups } from '../../engine/outdoor-authoring/PondDecorBuilder.js';
import { OUTDOOR_FOLIAGE_SPRITES, OUTDOOR_REDWOOD_FOLIAGE_SPRITES, OUTDOOR_SMALL_FOLIAGE_SPRITES } from '../../engine/outdoor-authoring/OutdoorFoliageRegistry.js';
import { FISH_SPECS } from '../fishing/FishMeshFactory.js';

export { createOutdoorTerrainMesh } from '../../engine/outdoor-authoring/OutdoorTerrainBuilder.js';
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

export function createOutdoorFieldBlockers(definition, rectangularBlockers = []) {
  return [
    ...rectangularBlockers.filter((blocker) => blocker.blocksPlayer !== false).map(({ id, minX, maxX, minZ, maxZ, height, type, tags, userData }) => ({ id, minX, maxX, minZ, maxZ, height, type, tags, userData })),
    ...createOutdoorCurvedBlockers(definition?.curvedBlockers),
  ];
}

export function buildOutdoorFieldRuntime({ definition = {}, textureProfiles = {}, scene, collision = null, makeTexturedMaterial, loadFoliageTexture, registerAnimatedTextureFlipbook = null, createPondLabel = null, createHarvestable = null, gameState = null, constants = {} }) {
  const addedObjects = [];
  const add = (object) => { scene.add(object); addedObjects.push(object); return object; };
  const terrain = createOutdoorTerrainMesh(definition.terrain ?? { size: [DEFAULT_FIELD_SIZE, DEFAULT_FIELD_SIZE], segments: [1, 1], baseY: 0, material: 'fieldGrass', heightStamps: [] }, {
    textures: textureProfiles,
    name: constants.terrainName ?? 'TERRAIN01-reliquary-field-oarb-heightfield-terrain',
    makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbTerrainMaterial'),
  });
  terrain.userData = { ...terrain.userData, blueprint: 'docs/DARB_OUTDOOR_AUTHORING_RUNTIME_MILESTONE.md', legacyFieldBlueprint: 'docs/world/overworld/reliquary_field_v01.md', longTermBlueprintSize: 800, playerGroundingChanged: true };
  const terrainSampler = terrain.userData.terrainSampler;
  add(terrain);

  const pathSurfaceSampler = createOutdoorSplineVisibleSurfaceSampler(definition.splineTrails, { terrainSampler });
  const splineMaterialFactory = makeRuntimeMaterial(makeTexturedMaterial, 'oarbSplineTrailMaterial');
  createOutdoorSplineTrailMeshes(definition.splineTrails, { terrainSampler, textures: textureProfiles, makeMaterial: splineMaterialFactory }).forEach(add);
  createOutdoorSplineTrailEdgeMeshes(definition.splineTrails, { terrainSampler, textures: textureProfiles, makeMaterial: splineMaterialFactory }).forEach(add);
  const pathSupportSurfaces = createOutdoorSplinePathSupportSurfaces(definition.splineTrails, { terrainSampler });
  if (collision) {
    collision.walkableSurfaces = [...(collision.walkableSurfaces ?? []), ...pathSupportSurfaces];
    collision.userData = { ...(collision.userData ?? {}), oarbSplinePathSupportSurfaces: pathSupportSurfaces.length };
  }

  const fishingZones = [];
  const pondMeshes = buildOutdoorPonds({ waterBodies: definition.waterBodies, textureProfiles, makeTexturedMaterial, registerAnimatedTextureFlipbook, createPondLabel, fishingZones });
  pondMeshes.forEach(add);
  createPondDecorGroups(definition.waterBodies, { terrainSampler, textures: textureProfiles, makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbPondDecorMaterial'), loadFoliageTexture }).forEach(add);

  const foliageBillboards = [];
  const foliageGroup = buildAuthoredFoliageGroup({ foliageBillboards: definition.foliageBillboards, foliageBillboardVariants: definition.foliageBillboardVariants, terrainSampler, loadFoliageTexture, createHarvestable, gameState, visibleDistanceSq: constants.visibleDistanceSq, alphaTest: constants.alphaTest });
  if (foliageGroup) { foliageGroup.children.forEach((child) => foliageBillboards.push(child)); add(foliageGroup); }

  createOutdoorPrimitiveMeshes(definition.outdoorPrimitives, { terrainSampler, textures: textureProfiles, makeMaterial: makeRuntimeMaterial(makeTexturedMaterial, 'oarbOutdoorPrimitiveMaterial') }).forEach(add);

  return { terrain, terrainSampler, pathSurfaceSampler, visibleSurfaceSampler: null, pathSupportSurfaces, fishingZones, foliageGroup, foliageBillboards, addedObjects, debug: { pondMeshCount: pondMeshes.length, primitiveCount: definition.outdoorPrimitives?.length ?? 0 } };
}

function buildOutdoorPonds({ waterBodies = [], textureProfiles = {}, makeTexturedMaterial, registerAnimatedTextureFlipbook, createPondLabel, fishingZones }) {
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
    const waterMat = new THREE.MeshStandardMaterial({ color: profile.color ?? 0x2d7f92, roughness: profile.roughness ?? 0.5, metalness: profile.metalness ?? 0, transparent: profile.transparent ?? true, opacity: profile.opacity ?? 0.78, emissive: profile.emissive ?? 0x0b4858, emissiveIntensity: profile.emissiveIntensity ?? 0.34, depthWrite: false });
    waterMat.name = `OARB-water-material-${body.material ?? 'pondWater'}`; waterMat.side = THREE.DoubleSide; if (Array.isArray(profile.animatedFrames)) registerAnimatedTextureFlipbook?.(waterMat, profile);
    const water = new THREE.Mesh(composite?.water.geometry ?? (waterOutline?.length >= 3 ? createPondOutlineDiscGeometry(waterOutline, [cx, cz]) : createOrganicPondDiscGeometry(88, 0.075)), waterMat);
    water.name = `OARB-water-body-${body.id}`; water.position.set(...(composite?.water.position ?? [cx, y + 0.035, cz])); if (!waterOutline?.length) water.scale.set(rx, 1, rz); water.renderOrder = 12; water.userData = { id: body.id, kind: body.kind, tags: body.tags ?? [], fishable: Boolean(body.fishable), footprintRecipe: footprint.recipe, geometrySource: composite?.water.source, coordinateBasis: composite?.coordinateBasis, materialKey: body.material, collision: 'visual-only pond water; shore remains walkable' }; meshes.push(water);
    if (body.userData?.pondExpoId) createPondLabel?.(body, cx, composite?.water.position[1] ?? y, cz);
    if (body.fishable) {
      const fishableRadius = Number.isFinite(body.fishableRadius) ? body.fishableRadius : Math.max(rx, rz) + 4;
      fishingZones.push({ id: `${body.id}_fishing_zone`, name: body.id, shape: 'ellipse', centerX: cx, centerZ: cz, radiusX: rx, radiusZ: rz, minX: cx - rx, maxX: cx + rx, minZ: cz - rz, maxZ: cz + rz, interactPadding: Math.max(0, fishableRadius - Math.max(rx, rz)), position: new THREE.Vector3(cx, y, cz), label: 'Pond Fishing', fishSpeciesPool: (body.fishSpeciesPool ?? []).filter((species) => FISH_SPECS[species]), fishCatchSeed: body.fishCatchSeed ?? body.id });
    }
  });
  return meshes;
}

function buildAuthoredFoliageGroup({ foliageBillboards = [], foliageBillboardVariants = [], terrainSampler, loadFoliageTexture, createHarvestable, gameState, visibleDistanceSq = 67600, alphaTest = 0.48 }) {
  if (!Array.isArray(foliageBillboards) || foliageBillboards.length === 0 || !terrainSampler) return null;
  const variants = new Map((foliageBillboardVariants ?? []).map((variant) => [variant.id, variant]));
  const group = new THREE.Group();
  group.name = `OARB-authored-foliage-billboard-forest-${foliageBillboards.length}-instances`;
  group.userData = { kind: 'authoredFoliageBillboards', billboardCount: foliageBillboards.length, variantCount: variants.size, alphaCutoutDepthWrite: true };
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.translate(0, 0.5, 0);
  const materials = new Map();
  foliageBillboards.forEach((placement) => {
    const variant = variants.get(placement.variantId); const spritePath = placement.spritePath ?? variant?.path;
    if (!spritePath) throw new Error(`Folsom invalid: foliage sprite texture missing for ${placement.id}.`);
    if (!materials.has(spritePath)) {
      const material = new THREE.MeshBasicMaterial({ map: loadFoliageTexture(spritePath), alphaTest, depthTest: true, depthWrite: true, transparent: false, side: THREE.DoubleSide, toneMapped: false });
      material.name = `${placement.variantId}-authored-foliage-alpha-cutout-depth-billboard-material`; material.userData = { authoredFoliageAlphaCutout: true, occludesTransparentWater: true }; materials.set(spritePath, material);
    }
    const [x, authoredY, z] = placement.position ?? []; const groundY = terrainSampler.sampleOutdoorY(x, z);
    const height = placement.height ?? variant?.height ?? 5; const width = placement.width ?? variant?.width ?? 3;
    const mesh = new THREE.Mesh(geometry, materials.get(spritePath)); mesh.name = `OARB-${placement.id}-${placement.variantId}`;
    const sinkIntoGround = placement.sinkIntoGround ?? variant?.sinkIntoGround ?? 0.06; const bottomTransparentPaddingRatio = placement.bottomTransparentPaddingRatio ?? variant?.bottomTransparentPaddingRatio ?? 0; const rootOffsetY = placement.rootOffsetY ?? variant?.rootOffsetY ?? 0; const groundOffset = placement.groundOffset ?? variant?.groundOffset ?? 0; const visualBaseGroundingOffset = height * bottomTransparentPaddingRatio; const maxBillboardYawOffset = placement.maxBillboardYawOffset ?? (placement.tags?.includes('folsom-foliage-billboard') ? 0.18 : Infinity);
    mesh.position.set(x, groundY + groundOffset + rootOffsetY - sinkIntoGround - visualBaseGroundingOffset, z); mesh.scale.set(width, height, 1); mesh.rotation.y = placement.yawOffset ?? 0;
    mesh.userData = { ...placement, authoredY, groundY, sinkIntoGround, bottomTransparentPaddingRatio, rootOffsetY, groundOffset, visualBaseGroundingOffset, maxBillboardYawOffset, bottomAnchoredBillboard: true, billboard: true, alphaCutoutDepthWrite: true, collision: 'none', visibleDistanceSq };
    if (placement.layer === 'redwood' && placement.harvestable !== false) { const harvestable = createHarvestable?.({ ...placement, x, z, groundY, zone: placement.tags?.join(':') }, mesh); if (harvestable) mesh.userData.harvestableTreeId = harvestable.id; }
    if (mesh.userData.harvestableTreeId && gameState?.hasHarvestedFieldTree?.(mesh.userData.harvestableTreeId)) mesh.visible = false;
    group.add(mesh);
  });
  return group;
}

import * as THREE from 'three';

const DEFAULT_FISH_MATERIAL_COLORS = Object.freeze({
  fishScaleSilver: 0x9aaea8,
  fishScaleKoiCreamOrange: 0xd6a25e,
  fishScaleEelSkinDark: 0x27322e,
  fishScaleZebraOlive: 0x536b45,
  fishScaleMottledDark: 0x34413a,
  fishScaleIridescentTeal: 0x52b8ad,
  fishFinAmber: 0xc78d42,
  fishFinDark: 0x1a211f,
  fishFinSpottedTeal: 0x61d1c4,
  tinyBlackEye: 0x020202,
});

const FISH_TAIL_GEOMETRY_SCALE = 0.55;


export const FISH_TEXTURE_PROFILES = Object.freeze({
  fishScaleSilver: { path: './assets/textures/fish/fish_scale_silver_01.png', repeat: [2, 1], color: 0xaeb8b4, roughness: 0.78, metalness: 0.06, emissive: 0x101918, emissiveIntensity: 0.06 },
  fishScaleKoiCreamOrange: { path: './assets/textures/fish/fish_scale_koi_cream_orange_01.png', repeat: [2, 1], color: 0xd9b474, roughness: 0.84, metalness: 0.01, emissive: 0x331908, emissiveIntensity: 0.06 },
  fishScaleEelSkinDark: { path: './assets/textures/fish/fish_scale_eel_skin_dark_01.png', repeat: [2, 1], color: 0x293126, roughness: 0.88, metalness: 0.02, emissive: 0x040604, emissiveIntensity: 0.04 },
  fishScaleZebraOlive: { path: './assets/textures/fish/fish_scale_zebra_olive_01.png', repeat: [2, 1], color: 0x66704a, roughness: 0.86, metalness: 0.01, emissive: 0x0b0d07, emissiveIntensity: 0.05 },
  fishScaleMottledDark: { path: './assets/textures/fish/fish_scale_mottled_dark_01.png', repeat: [2, 1], color: 0x3d3a31, roughness: 0.9, metalness: 0.01, emissive: 0x050504, emissiveIntensity: 0.04 },
  fishScaleIridescentTeal: { path: './assets/textures/fish/fish_scale_iridescent_teal_01.png', repeat: [2, 1], color: 0x35b7aa, roughness: 0.74, metalness: 0.05, emissive: 0x16766f, emissiveIntensity: 0.28 },
  fishFinAmber: { path: './assets/textures/fish/fish_fin_membrane_amber_01.png', repeat: [1, 1], color: 0xd18a35, roughness: 0.82, metalness: 0, emissive: 0x2f1606, emissiveIntensity: 0.08 },
  fishFinDark: { path: './assets/textures/fish/fish_fin_membrane_dark_01.png', repeat: [1, 1], color: 0x242825, roughness: 0.86, metalness: 0, emissive: 0x050604, emissiveIntensity: 0.04 },
  fishFinSpottedTeal: { path: './assets/textures/fish/fish_fin_spotted_teal_01.png', repeat: [1, 1], color: 0x2a817c, roughness: 0.82, metalness: 0, emissive: 0x0b3d3a, emissiveIntensity: 0.12 },
  tinyBlackEye: { color: 0x020202, roughness: 0.28, metalness: 0.08 },
});

export const FISH_SPECS = {
  smallRiverFish: { bodyLength: 1.25, bodyHeight: 0.3, bodyWidth: 0.22, bodyMaterial: 'fishScaleSilver', finMaterial: 'fishFinAmber', tailScale: 0.92, dorsalScale: 0.82, pectoralScale: 0.86, headTaper: 1 },
  broadCarpFish: { bodyLength: 1.55, bodyHeight: 0.58, bodyWidth: 0.36, bodyMaterial: 'fishScaleKoiCreamOrange', finMaterial: 'fishFinAmber', tailScale: 1.18, dorsalScale: 1.06, pectoralScale: 1.0, headTaper: 1 },
  longEelFish: { bodyLength: 2.25, bodyHeight: 0.2, bodyWidth: 0.16, bodyMaterial: 'fishScaleEelSkinDark', finMaterial: 'fishFinDark', tailScale: 0.68, dorsalScale: 0.48, pectoralScale: 0.48, headTaper: 1 },
  spineBackFish: { bodyLength: 1.6, bodyHeight: 0.38, bodyWidth: 0.26, bodyMaterial: 'fishScaleZebraOlive', finMaterial: 'fishFinDark', tailScale: 1.0, dorsalScale: 1.38, pectoralScale: 0.84, headTaper: 1 },
  flatMarshFish: { bodyLength: 1.45, bodyHeight: 0.2, bodyWidth: 0.62, bodyMaterial: 'fishScaleMottledDark', finMaterial: 'fishFinSpottedTeal', tailScale: 0.86, dorsalScale: 0.52, pectoralScale: 1.22, headTaper: 1 },
  jawHunterFish: { bodyLength: 1.85, bodyHeight: 0.4, bodyWidth: 0.3, bodyMaterial: 'fishScaleMottledDark', finMaterial: 'fishFinDark', tailScale: 1.08, dorsalScale: 0.92, pectoralScale: 0.82, headTaper: 0.9 },
  sacredGlowFish: { bodyLength: 1.55, bodyHeight: 0.34, bodyWidth: 0.25, bodyMaterial: 'fishScaleIridescentTeal', finMaterial: 'fishFinSpottedTeal', tailScale: 1.0, dorsalScale: 0.88, pectoralScale: 0.82, headTaper: 1, glow: true },
};


function applyFishFinUvProjection(geometry, { length = 1, height = 1, pointDirection = -1 } = {}) {
  const position = geometry.getAttribute('position');
  const uv = new THREE.Float32BufferAttribute(position.count * 2, 2);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < position.count; i += 1) {
    const projectedX = pointDirection > 0 ? position.getX(i) : -position.getX(i);
    minX = Math.min(minX, projectedX);
    maxX = Math.max(maxX, projectedX);
    minY = Math.min(minY, position.getY(i));
    maxY = Math.max(maxY, position.getY(i));
  }

  const xSpan = Math.max(maxX - minX, length, Number.EPSILON);
  const ySpan = Math.max(maxY - minY, height, Number.EPSILON);

  for (let i = 0; i < position.count; i += 1) {
    const projectedX = pointDirection > 0 ? position.getX(i) : -position.getX(i);
    const u = (projectedX - minX) / xSpan;
    const v = (position.getY(i) - minY) / ySpan;
    uv.setXY(i, THREE.MathUtils.clamp(u, 0, 1), THREE.MathUtils.clamp(v, 0, 1));
  }

  geometry.setAttribute('uv', uv);
  geometry.userData.fishFinUvProjection = 'stable-local-x-y-0-to-1';
  return geometry;
}

function makeClosedWedgeGeometry({ length = 0.28, height = 0.16, width = 0.08, pointDirection = -1 } = {}) {
  const xBase = pointDirection > 0 ? -length / 2 : length / 2;
  const xTip = pointDirection > 0 ? length / 2 : -length / 2;
  const vertices = [
    xTip, 0, 0,
    xBase, height / 2, -width / 2,
    xBase, -height / 2, -width / 2,
    xBase, height / 2, width / 2,
    xBase, -height / 2, width / 2,
    xBase, 0, 0,
  ];
  const indices = [0, 1, 2, 0, 4, 3, 0, 3, 1, 0, 2, 4, 1, 3, 5, 2, 5, 4, 1, 5, 2, 3, 4, 5];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  applyFishFinUvProjection(geometry, { length, height, pointDirection });
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.closedVolumetricFishWedge = true;
  return geometry;
}

function makeTailDiamondGeometry({ length = 0.34, height = 0.34, width = 0.1 } = {}) {
  const frontX = length * 0.34;
  const rearX = -length * 0.66;
  const vertices = [
    frontX, 0, -width / 2, rearX, height / 2, -width / 2, rearX, -height / 2, -width / 2,
    frontX, 0, width / 2, rearX, height / 2, width / 2, rearX, -height / 2, width / 2,
  ];
  const indices = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 5, 3, 2, 3, 0, 1, 4, 5, 1, 5, 2];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  applyFishFinUvProjection(geometry, { length, height, pointDirection: -1 });
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.closedVolumetricFishTail = true;
  return geometry;
}

function addFishMesh(root, geometry, material, name, position, userData = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = userData;
  root.add(mesh);
  return mesh;
}

function buildSimpleFish({ id, bodyLength, bodyHeight, bodyWidth, bodyMaterial, finMaterial, eyeMaterial, tailScale = 1, dorsalScale = 1, pectoralScale = 1, headTaper = 1, baseUserData = {} }) {
  const root = new THREE.Group();
  root.name = `V25-fishDisplay-ROOT-${id}`;
  root.userData = { ...baseUserData, fishConstruction: 'single-reusable-symmetrical-volumetric-template', coordinateStandard: 'X=head-tail-positive-head,Y=vertical,Z=left-right', allowedDisplayRotation: 'Y-axis-only' };

  const body = addFishMesh(root, new THREE.SphereGeometry(0.5, 18, 12), bodyMaterial, `V25-fishDisplay-CLOSED-ELLIPSOID-BODY-${id}`, new THREE.Vector3(0, 0, 0), { ...baseUserData, fishPart: 'singleClosedEllipsoidBody', materialSlot: 'bodyMaterial', textureRole: 'scaleTexture', headTaper });
  body.scale.set(bodyLength * 0.5 * headTaper, bodyHeight * 0.5, bodyWidth * 0.5);
  const silhouetteBodyLength = bodyLength * 0.5 * headTaper;

  const tailLength = bodyLength * 0.24 * tailScale * FISH_TAIL_GEOMETRY_SCALE;
  const tailHeight = bodyHeight * 0.95 * tailScale * FISH_TAIL_GEOMETRY_SCALE;
  const tailWidth = bodyWidth * 0.38 * FISH_TAIL_GEOMETRY_SCALE;
  const tailEmbed = silhouetteBodyLength * 0.15;
  const tailFrontX = tailLength * 0.34;
  const tail = addFishMesh(root, makeTailDiamondGeometry({ length: tailLength, height: tailHeight, width: tailWidth }), finMaterial, `V25-fishDisplay-CLOSED-ATTACHED-TAIL-${id}`, new THREE.Vector3(-silhouetteBodyLength * 0.5 + tailEmbed - tailFrontX, 0, 0), { ...baseUserData, fishPart: 'closedAttachedTail', materialSlot: 'finMaterial', textureRole: 'finTexture', attachesToBody: true, bodyEmbed: tailEmbed });

  const dorsalHeight = bodyHeight * Math.min(0.34 * dorsalScale, 0.42);
  const dorsal = addFishMesh(root, makeClosedWedgeGeometry({ length: silhouetteBodyLength * 0.24, height: dorsalHeight, width: bodyWidth * 0.24, pointDirection: 1 }), finMaterial, `V25-fishDisplay-CLOSED-ATTACHED-DORSAL-FIN-${id}`, new THREE.Vector3(-silhouetteBodyLength * 0.04, bodyHeight * 0.3, 0), { ...baseUserData, fishPart: 'closedAttachedDorsalFin', materialSlot: 'finMaterial', textureRole: 'finTexture', attachesToBody: true, bodyEmbed: bodyHeight * 0.16 });

  [-1, 1].forEach((side) => {
    const pectoral = addFishMesh(root, makeClosedWedgeGeometry({ length: silhouetteBodyLength * 0.16 * pectoralScale, height: bodyHeight * 0.3 * pectoralScale, width: bodyWidth * 0.16, pointDirection: 1 }), finMaterial, `V25-fishDisplay-CLOSED-MIRRORED-PECTORAL-FIN-${id}-${side}`, new THREE.Vector3(silhouetteBodyLength * 0.12, -bodyHeight * 0.03, side * bodyWidth * 0.34), { ...baseUserData, fishPart: 'closedMirroredPectoralFin', mirrorSide: side, materialSlot: 'finMaterial', textureRole: 'finTexture', attachesToBody: true, bodyEmbed: bodyWidth * 0.16 });
    pectoral.rotation.y = side * 0.18;
  });

  const eyeRadius = Math.min(bodyHeight, bodyWidth) * 0.09;
  [-1, 1].forEach((side) => {
    addFishMesh(root, new THREE.SphereGeometry(eyeRadius, 8, 6), eyeMaterial, `V25-fishDisplay-TINY-MIRRORED-BLACK-EYE-${id}-${side}`, new THREE.Vector3(silhouetteBodyLength * 0.32, bodyHeight * 0.12, side * bodyWidth * 0.24), { ...baseUserData, fishPart: 'tinyMirroredBlackEye', mirrorSide: side, materialSlot: 'eyeMaterial', bodyEmbed: eyeRadius * 0.25 });
  });

  root.userData.fishSanity = { bodyLength: silhouetteBodyLength, authoredBodyLength: bodyLength, bodyHeight, bodyWidth, childCount: root.children.length, tailEmbed, tailOverlapsBody: tail.position.x + tailFrontX > -silhouetteBodyLength * 0.5, dorsalOverlapsBody: dorsal.position.y - dorsalHeight * 0.5 < bodyHeight * 0.5 };
  return root;
}


export const FISH_SPECIES_IDS = Object.freeze(Object.keys(FISH_SPECS));

function defaultMaterial(reference, fallback = {}) {
  return new THREE.MeshStandardMaterial({
    color: fallback.color ?? DEFAULT_FISH_MATERIAL_COLORS[reference] ?? 0xffffff,
    roughness: fallback.roughness ?? 0.84,
    metalness: fallback.metalness ?? 0.02,
    emissive: fallback.emissive ?? 0x000000,
    emissiveIntensity: fallback.emissiveIntensity ?? 0,
  });
}

function resolveFishMaterial(reference, fallback, options, slot) {
  const material = options.materialResolver
    ? options.materialResolver(reference, fallback, { slot, speciesId: options.speciesId })
    : defaultMaterial(reference, fallback);
  if (slot === 'finMaterial' && material?.map) {
    material.color?.setHex(0xffffff);
    material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.needsUpdate = true;
    material.needsUpdate = true;
    material.userData.fishFinTextureReadable = true;
  }
  return material;
}

export function createFishMesh(speciesId = 'smallRiverFish', options = {}) {
  const spec = FISH_SPECS[speciesId] ?? FISH_SPECS.smallRiverFish;
  const resolvedSpeciesId = FISH_SPECS[speciesId] ? speciesId : 'smallRiverFish';
  const resolverOptions = { ...options, speciesId: resolvedSpeciesId };
  const bodyMaterialRef = options.bodyMaterial ?? spec.bodyMaterial;
  const finMaterialRef = options.finMaterial ?? spec.finMaterial;
  const eyeMaterialRef = options.eyeMaterial ?? 'tinyBlackEye';
  const bodyMaterial = options.bodyMaterialObject ?? resolveFishMaterial(bodyMaterialRef, { color: DEFAULT_FISH_MATERIAL_COLORS[bodyMaterialRef], roughness: 0.84, metalness: 0.02, emissive: spec.glow ? 0x0f6b64 : 0x101413, emissiveIntensity: spec.glow ? 0.22 : 0.12 }, resolverOptions, 'bodyMaterial');
  const finMaterial = options.finMaterialObject ?? resolveFishMaterial(finMaterialRef, { color: DEFAULT_FISH_MATERIAL_COLORS[finMaterialRef], roughness: 0.88, metalness: 0.02, emissive: spec.glow ? 0x0a4b47 : 0x090d0c, emissiveIntensity: spec.glow ? 0.14 : 0.1 }, resolverOptions, 'finMaterial');
  const eyeMaterial = options.eyeMaterialObject ?? resolveFishMaterial(eyeMaterialRef, { color: 0x020202, roughness: 0.28, metalness: 0.08 }, resolverOptions, 'eyeMaterial');
  const baseUserData = {
    fishSpecies: resolvedSpeciesId,
    speciesId: resolvedSpeciesId,
    sharedFishSpeciesRegistry: 'KerovacExpoPermanentFishSpecies',
    visualSource: 'sharedKerovacFishSpeciesFactory',
    materialSlots: { bodyMaterial: bodyMaterialRef, finMaterial: finMaterialRef, eyeMaterial: eyeMaterialRef },
    ...(options.baseUserData ?? {}),
  };
  const mesh = buildSimpleFish({ id: options.id ?? resolvedSpeciesId, ...spec, bodyMaterial, finMaterial, eyeMaterial, baseUserData });
  mesh.userData.speciesId = resolvedSpeciesId;
  mesh.userData.fishSpecies = resolvedSpeciesId;
  mesh.userData.visualSource = 'sharedKerovacFishSpeciesFactory';
  return mesh;
}

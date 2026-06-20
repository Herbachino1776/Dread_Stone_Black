import * as THREE from 'three';

const EPSILON = 1e-6;

function roundWorld(value) {
  return Number(value.toFixed(3));
}

export function expandPondOutlineRadially(outline = [], center = [0, 0], distance = 0) {
  return outline.map(([x, z]) => {
    const dx = x - center[0];
    const dz = z - center[1];
    const length = Math.hypot(dx, dz);
    if (length <= EPSILON) return [roundWorld(x), roundWorld(z)];
    return [
      roundWorld(x + (dx / length) * distance),
      roundWorld(z + (dz / length) * distance),
    ];
  });
}

function upwardTriangle(indices, positions, a, b, c) {
  const ax = positions[a * 3];
  const az = positions[a * 3 + 2];
  const bx = positions[b * 3];
  const bz = positions[b * 3 + 2];
  const cx = positions[c * 3];
  const cz = positions[c * 3 + 2];
  const normalY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  if (normalY >= 0) indices.push(a, b, c);
  else indices.push(a, c, b);
}

export function createPondOutlineDiscGeometry(outline = [], center = [0, 0]) {
  const contour = outline.map(([x, z]) => new THREE.Vector2(x - center[0], z - center[1]));
  const vertices = contour.flatMap(({ x, y: z }) => [x, 0, z]);
  const uvs = contour.flatMap(({ x, y: z }) => [0.5 + x * 0.04, 0.5 + z * 0.04]);
  const indices = [];
  THREE.ShapeUtils.triangulateShape(contour, []).forEach(([a, b, c]) => upwardTriangle(indices, vertices, a, b, c));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = { pondGeometryKind: 'outlineDisc', outlineVertexCount: outline.length, coordinateBasis: [...center] };
  return geometry;
}

export function createPondOutlineRingGeometry(innerOutline = [], outerOutline = [], center = [0, 0]) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const count = Math.min(innerOutline.length, outerOutline.length);
  for (let index = 0; index < count; index += 1) {
    const inner = innerOutline[index];
    const outer = outerOutline[index];
    vertices.push(inner[0] - center[0], 0, inner[1] - center[1], outer[0] - center[0], 0, outer[1] - center[1]);
    uvs.push(0, 0, 1, 1);
  }
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const inner = index * 2;
    const outer = inner + 1;
    const nextInner = next * 2;
    const nextOuter = nextInner + 1;
    upwardTriangle(indices, vertices, inner, outer, nextInner);
    upwardTriangle(indices, vertices, nextInner, outer, nextOuter);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = { pondGeometryKind: 'outlineRing', innerVertexCount: count, outerVertexCount: count, coordinateBasis: [...center] };
  return geometry;
}

export function createPondCompositeGeometry(body = {}) {
  const footprint = body.footprint ?? {};
  const center = Array.isArray(body.center) ? body.center : [0, 0];
  const waterOutline = footprint.waterOutline ?? [];
  const mudBedOutline = footprint.mudBedOutline ?? [];
  const outerShoreOutline = footprint.outerShoreOutline ?? [];
  const heights = footprint.layerHeights ?? {};
  const waterY = Number.isFinite(heights.waterY) ? heights.waterY : Number(body.y) + 0.035;
  const mudBedY = Number.isFinite(heights.mudBedY) ? heights.mudBedY : Number(body.y) + 0.006;
  const wetShoreY = Number.isFinite(heights.wetShoreY) ? heights.wetShoreY : Number(body.y) + 0.018;
  return {
    recipe: footprint.recipe,
    coordinateBasis: [...center],
    water: {
      geometry: createPondOutlineDiscGeometry(waterOutline, center),
      outline: waterOutline,
      position: [center[0], waterY, center[1]],
      materialKey: body.material,
      source: 'waterOutline',
    },
    mudBed: {
      geometry: createPondOutlineDiscGeometry(mudBedOutline, center),
      outline: mudBedOutline,
      position: [center[0], mudBedY, center[1]],
      materialKey: body.bedMaterial,
      source: 'mudBedOutline',
    },
    wetShore: outerShoreOutline.length >= 3 ? {
      geometry: createPondOutlineRingGeometry(mudBedOutline, outerShoreOutline, center),
      innerOutline: mudBedOutline,
      outline: outerShoreOutline,
      position: [center[0], wetShoreY, center[1]],
      materialKey: body.shoreMaterial,
      source: 'outerShoreOutline',
    } : null,
  };
}

export function geometryWorldXZ(geometry, position = [0, 0, 0], vertexIndices = null) {
  const attribute = geometry?.attributes?.position;
  if (!attribute) return [];
  const indices = vertexIndices ?? Array.from({ length: attribute.count }, (_, index) => index);
  return indices.map((index) => [
    roundWorld(attribute.getX(index) + position[0]),
    roundWorld(attribute.getZ(index) + position[2]),
  ]);
}

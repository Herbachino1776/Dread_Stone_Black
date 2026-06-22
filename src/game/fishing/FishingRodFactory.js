import * as THREE from 'three';

export const CANONICAL_GAMEPLAY_ROD_ID = 'rodA1';
export const COMPATIBLE_FISHING_ROD_ITEM_ID = 'fishing_rod';

export const KEROVAC_EXPO_ROD_A1_SOURCE = Object.freeze({
  canonicalId: CANONICAL_GAMEPLAY_ROD_ID,
  compatibleItemId: COMPATIBLE_FISHING_ROD_ITEM_ID,
  displayName: 'Rod A1',
  sourceLocation: 'Kerovac Fish/Rod Expo',
  sourcePrimitiveId: 'K_expo_rod_A1_reed_pole',
  sourcePadId: 'A1',
  sourceVariant: 'reedPoleRod',
  visualSource: 'KerovacExpoSlotA1',
});

export const ROD_A1_SPEC = Object.freeze({
  len: 4.5,
  r: 0.035,
  curve: 0.2,
  wood: 0x8a7442,
  grip: 0x3d2617,
  metal: 0x7a5b2b,
  noReel: true,
  wraps: 5,
  hook: 'bone',
});

export const ACTIVE_GAMEPLAY_RODS = Object.freeze([Object.freeze({
  id: CANONICAL_GAMEPLAY_ROD_ID,
  displayName: 'Rod A1',
  compatibleItemId: COMPATIBLE_FISHING_ROD_ITEM_ID,
  source: KEROVAC_EXPO_ROD_A1_SOURCE,
})]);

function basicMat(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addCylinderBetween(group, from, to, radius, material, name, userData, segments = 10) {
  const direction = to.clone().sub(from);
  const length = direction.length();
  if (!Number.isFinite(length) || length <= 0) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.name = name;
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { ...userData };
  group.add(mesh);
  return mesh;
}

function localPoint(origin, yaw, x, y, z) {
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  return new THREE.Vector3(origin.x + x * c - z * sn, origin.y + y, origin.z + x * sn + z * c);
}

export function createRodA1Mesh({ id = 'rodA1-runtime', yaw = 0, origin = new THREE.Vector3(), includeLine = true } = {}) {
  const spec = ROD_A1_SPEC;
  const group = new THREE.Group();
  group.name = `${id}-canonical-Kerovac-A1-rod`;
  group.userData = {
    objectCategory: 'canonicalGameplayFishingRod',
    rodId: CANONICAL_GAMEPLAY_ROD_ID,
    displayName: 'Rod A1',
    compatibleItemId: COMPATIBLE_FISHING_ROD_ITEM_ID,
    visualSource: KEROVAC_EXPO_ROD_A1_SOURCE.visualSource,
    sourcePrimitiveId: KEROVAC_EXPO_ROD_A1_SOURCE.sourcePrimitiveId,
    sourcePadId: KEROVAC_EXPO_ROD_A1_SOURCE.sourcePadId,
    sourceVariant: KEROVAC_EXPO_ROD_A1_SOURCE.sourceVariant,
    fallbackDebugGeometry: false,
  };
  const wood = basicMat(spec.wood);
  const grip = basicMat(spec.grip);
  const cord = basicMat(0x1a130f);
  const bone = basicMat(0xd6caa3);
  const base = { ...group.userData, generatedBy: 'FishingRodFactory:createRodA1Mesh' };
  const p0 = localPoint(origin, yaw, -spec.len / 2, 0.16, 0);
  const p1 = localPoint(origin, yaw, -spec.len * 0.15, 0.22 + spec.curve * 0.12, spec.curve * 0.16);
  const p2 = localPoint(origin, yaw, spec.len * 0.25, 0.28 + spec.curve * 0.18, spec.curve * 0.25);
  const p3 = localPoint(origin, yaw, spec.len / 2, 0.34 + spec.curve * 0.28, spec.curve * 0.34);
  [[p0, p1], [p1, p2], [p2, p3]].forEach(([a, b], i) => addCylinderBetween(group, a, b, spec.r * (1 - i * 0.15), wood, `${id}-shaft-${i}`, base));
  addCylinderBetween(group, localPoint(origin, yaw, -spec.len / 2 - 0.15, 0.16, 0), localPoint(origin, yaw, -spec.len / 2 + 0.72, 0.17, 0), spec.r * 1.35, grip, `${id}-grip`, base, 8);
  for (let i = 0; i < spec.wraps; i += 1) addCylinderBetween(group, localPoint(origin, yaw, -spec.len / 2 + 0.08 + i * 0.13, 0.22, -0.16), localPoint(origin, yaw, -spec.len / 2 + 0.08 + i * 0.13, 0.22, 0.16), 0.018, cord, `${id}-wrap-${i}`, base, 6);
  const hookEnd = localPoint(origin, yaw, spec.len / 2 + 0.25, -0.26, spec.curve * 0.34 + 0.12);
  if (includeLine) {
    addCylinderBetween(group, p3, hookEnd, 0.008, basicMat(0x151515), `${id}-line`, base, 5);
    addCylinderBetween(group, hookEnd, localPoint(origin, yaw, spec.len / 2 + 0.36, -0.06, spec.curve * 0.34 + 0.16), 0.018, bone, `${id}-clean-dark-hook`, base, 6);
  }
  group.userData.handleLocalPosition = localPoint(origin, yaw, -spec.len / 2 - 0.15, 0.16, 0).clone();
  group.userData.tipLocalPosition = p3.clone();
  return group;
}

export function resolveGameplayRodForItem(itemId) {
  return itemId === COMPATIBLE_FISHING_ROD_ITEM_ID ? ACTIVE_GAMEPLAY_RODS[0] : null;
}

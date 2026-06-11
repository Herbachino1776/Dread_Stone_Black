import * as THREE from 'three';

function rectPlane(rect, color, y = 0.08, opacity = 0.2) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(rect.maxX - rect.minX, rect.maxZ - rect.minZ),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2);
  mesh.userData.devOnly = true;
  return mesh;
}

function rectBox(rect, color, y = 0.4, height = 0.2, opacity = 0.52) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(rect.maxX - rect.minX, height, rect.maxZ - rect.minZ),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  mesh.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2);
  mesh.userData.devOnly = true;
  return mesh;
}

function marker(position, color, size = 0.58) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86, depthWrite: false }),
  );
  mesh.position.set(position.x, position.y ?? 0.65, position.z);
  mesh.userData.devOnly = true;
  return mesh;
}

function openingRect(opening) {
  const thickness = 0.22;
  if (opening.axis === 'x') {
    return {
      minX: opening.coordinate - thickness,
      maxX: opening.coordinate + thickness,
      minZ: opening.start,
      maxZ: opening.end,
    };
  }

  return {
    minX: opening.start,
    maxX: opening.end,
    minZ: opening.coordinate - thickness,
    maxZ: opening.coordinate + thickness,
  };
}

function issueColor(issue) {
  if (issue.severity === 'error') return 0xff3030;
  if (issue.severity === 'warning') return 0xffcc33;
  return 0x7ed8ff;
}

export function addIntegrityDebugLayer({ runtime, group }) {
  const report = runtime?.integrityReport ?? runtime?.validation?.integrity;
  if (!report?.debug || !group) return;

  report.debug.wallSegments?.forEach((segment) => {
    const mesh = rectBox(segment, 0x52e06d, 0.18, 0.1, 0.32);
    mesh.userData = { ...mesh.userData, roomId: segment.roomId, wallId: segment.id };
    group.add(mesh);
  });

  report.debug.collisionSegments?.forEach((segment) => {
    const mesh = rectBox(segment, 0xff4d2f, 0.34, 0.12, 0.2);
    mesh.userData = { ...mesh.userData, blockerId: segment.id };
    group.add(mesh);
  });

  report.debug.openings?.forEach((opening) => {
    const mesh = rectBox(openingRect(opening), 0x4da2ff, 0.48, 0.12, 0.5);
    mesh.userData = { ...mesh.userData, roomId: opening.roomId, openingId: opening.openingId };
    group.add(mesh);
  });

  report.debug.facades?.forEach((facade) => {
    if (facade.bounds) group.add(rectPlane(facade.bounds, 0xa35cff, 0.07, 0.18));
    if (facade.approachZone) group.add(rectPlane(facade.approachZone, 0x3fe07e, 0.09, 0.18));
    if (facade.behindZone) group.add(rectPlane(facade.behindZone, 0xff3030, 0.1, 0.18));
  });

  report.issues?.forEach((issue) => {
    if (!issue.position) return;
    const mesh = marker(issue.position, issueColor(issue), issue.severity === 'error' ? 0.72 : 0.52);
    mesh.userData = { ...mesh.userData, issueCode: issue.code, issueMessage: issue.message };
    group.add(mesh);
  });
}

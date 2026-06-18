import * as THREE from 'three';
import { buildDungeonGeometry } from '../src/engine/dungeon-authoring/DungeonGeometryBuilder.js';
import { kerovacDefinition } from '../src/game/locations/generated/kerovac.definition.js';

const { group } = buildDungeonGeometry(kerovacDefinition);
group.updateMatrixWorld(true);

const fishRoots = [];
group.traverse((child) => {
  if (child?.userData?.objectCategory === 'fish' && child?.userData?.fishConstruction === 'single-reusable-symmetrical-volumetric-template') fishRoots.push(child);
});

const fail = (message) => { throw new Error(message); };
const nearly = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const localMeshBox = (mesh) => {
  mesh.updateMatrix();
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);
};

if (fishRoots.length !== 7) fail(`Expected 7 volumetric fish roots, found ${fishRoots.length}.`);

for (const root of fishRoots) {
  root.updateMatrixWorld(true);

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

console.log(`Fish geometry sanity check passed for ${fishRoots.length} continuous symmetrical volumetric fish.`);

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

function prepareMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = false;
    child.receiveShadow = true;

    if (!child.material) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0xa38a70,
        roughness: 0.88,
        metalness: 0.05,
        emissive: 0x24170f,
        emissiveIntensity: 0.26,
      });
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if ('roughness' in material && material.roughness === undefined) {
        material.roughness = 0.82;
      }

      if ('emissive' in material && material.emissive instanceof THREE.Color) {
        material.emissive.lerp(new THREE.Color(0x3a281b), 0.42);
        material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.22);
      }
    });
  });
}

function centerAndScale(root, { targetHeight = 1, maxWidth = 1.15 } = {}) {
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return { box, scale: 1 };

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const largestSide = Math.max(size.x, size.z, 0.001);
  const heightScale = targetHeight / Math.max(size.y, 0.001);
  const widthScale = maxWidth / largestSide;
  const scale = Math.min(heightScale, widthScale);

  root.position.sub(center.multiplyScalar(scale));
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);

  const centeredBox = new THREE.Box3().setFromObject(root);
  root.position.y -= centeredBox.min.y;

  return { box: centeredBox, scale };
}

export function loadDungeonModel({ url, targetHeight, maxWidth } = {}) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        const root = gltf.scene ?? gltf.scenes?.[0];

        if (!root) {
          reject(new Error(`GLB loaded without a scene: ${url}`));
          return;
        }

        prepareMaterials(root);
        const { scale } = centerAndScale(root, { targetHeight, maxWidth });
        resolve({ root, gltf, scale });
      },
      undefined,
      (error) => reject(error),
    );
  });
}

import * as THREE from 'three';
import { FORGE_ATTACHMENT_SOCKET_SCHEMA } from '../../contracts/ForgeRuntimeArmament.js';

function reciprocalScale(value) {
  return Math.abs(value) > 1e-8 ? 1 / value : 1;
}

export class RuntimeAttachmentSocketResolver {
  constructor({ visualAdapter } = {}) {
    if (!visualAdapter) throw new Error('Runtime attachment socket resolution requires a visual adapter');
    this.visualAdapter = visualAdapter;
    this.binding = null;
    this.disposed = false;
    this.lookupCount = 0;
  }

  resolve(socket) {
    if (this.disposed) throw new Error('Runtime attachment socket resolver is disposed');
    if (this.binding) throw new Error('Runtime attachment socket resolver already owns one binding');
    if (socket?.schema && socket.schema !== FORGE_ATTACHMENT_SOCKET_SCHEMA) throw new Error(`Unsupported attachment socket schema ${socket.schema}`);
    this.lookupCount += 1;
    const bone = this.visualAdapter.getRuntimeBone?.(socket.parentRuntimeBone)
      ?? this.visualAdapter.bones?.get?.(socket.parentRuntimeBone)
      ?? null;
    if (!bone?.isObject3D) throw new Error(`Runtime attachment socket ${socket.socketId} cannot resolve DSB_DAMAGE_RIG bone ${socket.parentRuntimeBone}`);
    const socketFrame = new THREE.Group();
    socketFrame.name = `DSB_RuntimeSocket_${socket.socketId}`;
    socketFrame.userData.socketId = socket.socketId;
    socketFrame.userData.semanticRole = socket.semanticRole;
    socketFrame.position.fromArray(socket.localPosition);
    socketFrame.quaternion.fromArray(socket.localQuaternion).normalize();
    bone.add(socketFrame);
    bone.updateWorldMatrix(true, true);

    const equipmentFrame = new THREE.Group();
    equipmentFrame.name = `DSB_RuntimeEquipmentFrame_${socket.socketId}`;
    socketFrame.add(equipmentFrame);
    const worldScale = socketFrame.getWorldScale(new THREE.Vector3());
    equipmentFrame.scale.set(
      reciprocalScale(worldScale.x),
      reciprocalScale(worldScale.y),
      reciprocalScale(worldScale.z),
    );
    socketFrame.updateWorldMatrix(true, true);
    this.binding = { socket, bone, socketFrame, equipmentFrame, weaponRoot: null };
    return this.binding;
  }

  attachWeapon(weaponRoot, gripTransform) {
    if (!this.binding) throw new Error('Resolve an attachment socket before attaching equipment');
    if (!weaponRoot?.isObject3D) throw new Error('NPC weapon visual must be an Object3D');
    if (this.binding.weaponRoot) throw new Error('An NPC weapon is already attached');
    weaponRoot.position.fromArray(gripTransform.position);
    weaponRoot.quaternion.fromArray(gripTransform.quaternion).normalize();
    this.binding.equipmentFrame.add(weaponRoot);
    this.binding.socketFrame.updateWorldMatrix(true, true);
    this.binding.weaponRoot = weaponRoot;
    return weaponRoot;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.binding?.socketFrame?.removeFromParent?.();
    this.binding = null;
    this.visualAdapter = null;
  }
}

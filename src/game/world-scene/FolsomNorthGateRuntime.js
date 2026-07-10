const GATE_PRIMITIVE_ID = 'folsom_north_gate';
const GATE_BLOCKER_ID = `V24-PRIMITIVE-BLOCKER-${GATE_PRIMITIVE_ID}-door`;

export class FolsomNorthGateRuntime {
  constructor({ collision, compiledGroup, gameState } = {}) {
    this.collision = collision;
    this.gameState = gameState;
    this.blocker = (collision?.blockerRects ?? []).find((candidate) => candidate.id === GATE_BLOCKER_ID) ?? null;
    this.leaves = [];
    compiledGroup?.traverse?.((object) => {
      if (object.userData?.architecturalPrimitiveId !== GATE_PRIMITIVE_ID || object.userData?.doorwayPart !== 'door') return;
      this.leaves.push({ object, closedPosition: object.position.clone(), closedRotation: object.rotation.clone() });
    });
    this.open = false;
    this.syncFromState();
  }

  syncFromState() {
    const open = this.gameState?.isFolsomNorthGateOpen?.()
      ?? this.gameState?.isWorldStateSet?.('folsom_north_gate_open')
      ?? false;
    this.open = open === true;
    if (this.open) this.applyOpenState();
    else this.applyLockedState();
    return this.open;
  }

  applyLockedState() {
    this.leaves.forEach(({ object, closedPosition, closedRotation }) => {
      object.position.copy(closedPosition);
      object.rotation.copy(closedRotation);
      object.visible = true;
    });
  }

  applyOpenState() {
    if (this.blocker) this.collision?.removeBlocker?.(this.blocker);
    this.leaves.forEach(({ object, closedPosition, closedRotation }, index) => {
      const side = index === 0 ? -1 : 1;
      object.position.copy(closedPosition);
      object.rotation.copy(closedRotation);
      object.position.x += side * 2.65;
      object.position.z += 1.65;
      object.rotation.y += side * 1.22;
      object.visible = true;
    });
  }
}

export const FOLSOM_NORTH_GATE_RUNTIME_IDS = Object.freeze({
  primitiveId: GATE_PRIMITIVE_ID,
  blockerId: GATE_BLOCKER_ID,
});

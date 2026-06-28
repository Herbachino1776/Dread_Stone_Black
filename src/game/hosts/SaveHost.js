import { GameState } from '../GameState.js';

export class SaveHost {
  constructor({ storage = window.localStorage } = {}) {
    this.storage = storage;
  }

  loadInitialState() {
    return new GameState(this.storage);
  }

  saveEquipmentState(gameState, equipmentRuntime) {
    gameState.saveEquipmentSnapshot(equipmentRuntime.getSnapshot());
  }

  saveObjectiveState(gameState, objectiveRuntime) {
    gameState.saveObjectiveSnapshot(objectiveRuntime.getSnapshot());
  }

  resetAllProgress() {
    return GameState.resetAllProgress(this.storage);
  }
}

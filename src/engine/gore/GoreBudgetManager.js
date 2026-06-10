export const DEFAULT_GORE_BUDGETS = Object.freeze({
  maxActiveParticles: 96,
  maxDecalsGlobal: 72,
  maxDecalsPerRoom: 18,
  maxWoundAttachmentsPerCreature: 4,
  maxCorpsesGlobal: 8,
  maxCorpsesPerRoom: 3,
  distanceCull: 58,
  lowPowerMode: false,
});

export class GoreBudgetManager {
  constructor(config = {}) {
    this.config = Object.freeze({ ...DEFAULT_GORE_BUDGETS, ...config });
    this.decalsByRoom = new Map();
    this.corpsesByRoom = new Map();
    this.woundsByCreature = new Map();
  }

  get particleLimit() {
    return this.config.lowPowerMode
      ? Math.max(24, Math.floor(this.config.maxActiveParticles * 0.55))
      : this.config.maxActiveParticles;
  }

  get decalGlobalLimit() {
    return this.config.lowPowerMode
      ? Math.max(24, Math.floor(this.config.maxDecalsGlobal * 0.58))
      : this.config.maxDecalsGlobal;
  }

  get decalRoomLimit() {
    return this.config.lowPowerMode
      ? Math.max(8, Math.floor(this.config.maxDecalsPerRoom * 0.65))
      : this.config.maxDecalsPerRoom;
  }

  get corpseGlobalLimit() {
    return this.config.lowPowerMode
      ? Math.max(3, Math.floor(this.config.maxCorpsesGlobal * 0.6))
      : this.config.maxCorpsesGlobal;
  }

  get corpseRoomLimit() {
    return this.config.lowPowerMode
      ? Math.max(1, Math.floor(this.config.maxCorpsesPerRoom * 0.75))
      : this.config.maxCorpsesPerRoom;
  }

  canAttachWound(creatureId) {
    return (this.woundsByCreature.get(creatureId) ?? 0) < this.config.maxWoundAttachmentsPerCreature;
  }

  trackWound(creatureId) {
    this.woundsByCreature.set(creatureId, (this.woundsByCreature.get(creatureId) ?? 0) + 1);
  }

  untrackWound(creatureId) {
    const next = Math.max(0, (this.woundsByCreature.get(creatureId) ?? 1) - 1);
    if (next === 0) this.woundsByCreature.delete(creatureId);
    else this.woundsByCreature.set(creatureId, next);
  }

  trackRoomCount(map, roomId) {
    const key = roomId ?? 'unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  untrackRoomCount(map, roomId) {
    const key = roomId ?? 'unknown';
    const next = Math.max(0, (map.get(key) ?? 1) - 1);
    if (next === 0) map.delete(key);
    else map.set(key, next);
  }

  trackDecal(roomId) {
    this.trackRoomCount(this.decalsByRoom, roomId);
  }

  untrackDecal(roomId) {
    this.untrackRoomCount(this.decalsByRoom, roomId);
  }

  trackCorpse(roomId) {
    this.trackRoomCount(this.corpsesByRoom, roomId);
  }

  untrackCorpse(roomId) {
    this.untrackRoomCount(this.corpsesByRoom, roomId);
  }

  getRoomDecalCount(roomId) {
    return this.decalsByRoom.get(roomId ?? 'unknown') ?? 0;
  }

  getRoomCorpseCount(roomId) {
    return this.corpsesByRoom.get(roomId ?? 'unknown') ?? 0;
  }

  reset() {
    this.decalsByRoom.clear();
    this.corpsesByRoom.clear();
    this.woundsByCreature.clear();
  }

  getSummary({ activeParticles = 0, decals = 0, corpses = 0, wounds = 0 } = {}) {
    return {
      activeParticles,
      maxActiveParticles: this.particleLimit,
      decals,
      maxDecalsGlobal: this.decalGlobalLimit,
      maxDecalsPerRoom: this.decalRoomLimit,
      corpses,
      maxCorpsesGlobal: this.corpseGlobalLimit,
      maxCorpsesPerRoom: this.corpseRoomLimit,
      wounds,
      maxWoundAttachmentsPerCreature: this.config.maxWoundAttachmentsPerCreature,
      lowPowerMode: this.config.lowPowerMode,
      roomDecals: Object.fromEntries(this.decalsByRoom),
      roomCorpses: Object.fromEntries(this.corpsesByRoom),
    };
  }
}


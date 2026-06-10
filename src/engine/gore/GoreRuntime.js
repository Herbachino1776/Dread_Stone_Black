import * as THREE from 'three';
import { BloodDecalSystem } from './BloodDecalSystem.js';
import { BloodParticlePool } from './BloodParticlePool.js';
import { CorpseManager } from './CorpseManager.js';
import { createGoreEvent, GORE_EVENT_TYPES } from './GoreEvent.js';
import { GoreBudgetManager } from './GoreBudgetManager.js';
import { GoreDebug } from './GoreDebug.js';
import { resolveGoreProfile } from './GoreProfiles.js';
import { WoundAttachmentSystem } from './WoundAttachmentSystem.js';

const FLOOR_NORMAL = new THREE.Vector3(0, 1, 0);

const GORE_RUNTIME_TUNING = Object.freeze({
  freshBloodColor: 0xb00016,
  wetHighlightColor: 0xe02028,
  pooledBloodColor: 0x65000b,
  driedBloodColor: 0x2a0004,
  deathPoolScale: [1.4, 2.2],
  deathPoolGrowSeconds: [1.5, 2.6],
});

export class GoreRuntime {
  constructor({
    scene,
    registry = {},
    budgets = {},
    locationId = 'unknown',
    getRoomIdForPosition = null,
    getFloorYForPosition = null,
  }) {
    this.scene = scene;
    this.registry = registry;
    this.locationId = locationId;
    this.getRoomIdForPosition = getRoomIdForPosition;
    this.getFloorYForPosition = getFloorYForPosition;
    this.budget = new GoreBudgetManager(budgets);
    this.particles = new BloodParticlePool({ scene, budget: this.budget });
    this.decals = new BloodDecalSystem({ scene, budget: this.budget });
    this.wounds = new WoundAttachmentSystem({ budget: this.budget });
    this.corpses = new CorpseManager({ budget: this.budget, decalSystem: this.decals });
    this.lastEvent = null;
    this.playerPosition = null;
    this.debug = new GoreDebug({
      runtime: this,
      onClear: () => this.clearAll(),
    });
  }

  normalizeEvent(event) {
    const normalized = createGoreEvent(event);
    const roomId = normalized.roomId ?? this.getRoomIdForPosition?.(normalized.position) ?? this.locationId;
    return { ...normalized, roomId };
  }

  resolveProfile(event) {
    return resolveGoreProfile({
      creatureId: event.creatureId ?? event.species,
      weaponId: event.weaponId ?? 'unarmed',
      registry: this.registry,
    });
  }

  getFloorY(position) {
    return this.getFloorYForPosition?.(position) ?? 0;
  }

  isNearPlayer(position) {
    if (!this.playerPosition) return true;
    return this.playerPosition.distanceTo(position) <= this.budget.config.distanceCull;
  }

  emitHitGore(eventData) {
    const event = this.normalizeEvent({ ...eventData, type: eventData.type ?? GORE_EVENT_TYPES.HIT });
    const profile = this.resolveProfile(event);
    const isHeavy = event.type === GORE_EVENT_TYPES.HEAVY_HIT || event.hitStrength > 1.35;
    const particleType = isHeavy ? profile.heavyBurstType : profile.particleBurstType;
    const count = Math.round((isHeavy ? profile.heavyParticleCount : profile.hitParticleCount) * event.hitStrength);
    const nearPlayer = this.isNearPlayer(event.position);
    if (nearPlayer) {
      this.particles.spawnBurst({
        position: event.position,
        direction: event.direction,
        profile,
        count,
        type: particleType,
        strength: event.hitStrength,
      });
    }

    const floorPosition = event.position.clone();
    floorPosition.addScaledVector(event.direction, 0.18);
    this.decals.addFloorDecal({
      position: floorPosition,
      roomId: event.roomId,
      profile,
      type: profile.decalType ?? 'splat',
      floorY: this.getFloorY(floorPosition),
      lifetimeSeconds: 38,
    });

    const satelliteDecals = isHeavy ? 2 : Math.random() < 0.45 ? 1 : 0;
    for (let i = 0; i < satelliteDecals; i += 1) {
      const offset = new THREE.Vector3((Math.random() - 0.5) * 0.72, 0, (Math.random() - 0.5) * 0.72);
      offset.addScaledVector(event.direction, 0.14 + Math.random() * 0.38);
      const satellitePosition = floorPosition.clone().add(offset);
      this.decals.addFloorDecal({
        position: satellitePosition,
        roomId: event.roomId,
        profile,
        type: Math.random() < 0.34 && profile.decalType === 'slash' ? 'smear' : 'splat',
        scaleRange: isHeavy ? [0.22, 0.46] : [0.14, 0.3],
        floorY: this.getFloorY(satellitePosition),
        lifetimeSeconds: isHeavy ? 40 : 28,
      });
    }

    if (event.surfaceType === 'wall' || event.tags.includes('wall_spray') || isHeavy) {
      const wallPosition = event.position.clone().addScaledVector(event.direction, 0.42);
      wallPosition.y += 0.24;
      this.decals.addWallDecal({
        position: wallPosition,
        normal: event.direction.clone().multiplyScalar(-1),
        roomId: event.roomId,
        profile,
        type: profile.wallDecalType ?? 'spray',
      });
    }

    if (nearPlayer) {
      this.wounds.attachWound({
        targetRoot: event.targetRoot,
        position: event.position,
        normal: event.direction.clone().multiplyScalar(-1),
        creatureId: event.targetId ?? event.creatureId,
        profile,
      });
    }
    this.lastEvent = event;
    return event;
  }

  emitDeathGore(eventData) {
    const event = this.normalizeEvent({ ...eventData, type: GORE_EVENT_TYPES.KILL, hitStrength: eventData.hitStrength ?? 1.6 });
    const profile = this.resolveProfile(event);
    if (this.isNearPlayer(event.position)) {
      this.particles.spawnBurst({
        position: event.position,
        direction: event.direction,
        profile,
        count: Math.round((profile.heavyParticleCount ?? 28) * 1.1),
        type: profile.heavyBurstType ?? 'chunky',
        strength: event.hitStrength,
      });
    }

    const bloodPoolId = this.decals.addFloorDecal({
      position: event.position,
      roomId: event.roomId,
      profile,
      type: 'pool',
      scaleRange: profile.deathPoolScale ?? GORE_RUNTIME_TUNING.deathPoolScale,
      floorY: this.getFloorY(event.position),
      lifetimeSeconds: 70,
    });

    const deathSplatPosition = event.position.clone().addScaledVector(event.direction, 0.4);
    this.decals.addFloorDecal({
      position: deathSplatPosition,
      roomId: event.roomId,
      profile,
      type: profile.decalType === 'slash' ? 'smear' : 'splat',
      floorY: this.getFloorY(deathSplatPosition),
      lifetimeSeconds: 46,
    });

    if (profile.decalType === 'slash' || event.tags.includes('long_slash_smears')) {
      const smearPosition = event.position.clone().addScaledVector(event.direction, 0.72);
      this.decals.addFloorDecal({
        position: smearPosition,
        roomId: event.roomId,
        profile,
        type: 'smear',
        scaleRange: [0.58, 1.06],
        floorY: this.getFloorY(smearPosition),
        lifetimeSeconds: 48,
      });
    }

    const corpseId = this.registerCorpse({
      creatureId: event.creatureId,
      species: event.species ?? event.creatureId,
      factionId: event.factionId,
      position: event.position,
      roomId: event.roomId,
      corpseRoot: event.targetRoot,
      bloodPoolIds: [bloodPoolId],
      tags: ['death_gore', ...event.tags],
      persistenceWeight: profile.corpsePersistenceWeight,
    });

    this.lastEvent = event;
    return { event, corpseId, bloodPoolId };
  }

  registerCorpse(corpseData) {
    return this.corpses.registerCorpse(corpseData);
  }

  update(deltaSeconds, context = {}) {
    this.playerPosition = context.playerPosition ?? this.playerPosition;
    this.particles.update(deltaSeconds);
    this.decals.update(deltaSeconds);
    this.wounds.update(deltaSeconds);
    this.corpses.update(deltaSeconds);
    this.debug.update(deltaSeconds);
  }

  clearRoom(roomId) {
    this.decals.clearRoom(roomId);
    this.corpses.clearRoom(roomId);
  }

  clearAll() {
    this.particles.clearAll();
    this.decals.clearAll();
    this.wounds.clearAll();
    this.corpses.clearAll();
    this.budget.reset();
  }

  setDebugEnabled(enabled) {
    this.debug.setEnabled(enabled);
  }

  getDebugSummary() {
    return {
      ...this.budget.getSummary({
        activeParticles: this.particles.activeCount,
        decals: this.decals.count,
        corpses: this.corpses.count,
        wounds: this.wounds.count,
      }),
      lastEventType: this.lastEvent?.type ?? null,
      lastEventRoom: this.lastEvent?.roomId ?? null,
      locationId: this.locationId,
    };
  }

  dispose() {
    this.debug.dispose();
    this.corpses.clearAll();
    this.wounds.dispose();
    this.decals.dispose();
    this.particles.dispose();
  }
}

export { FLOOR_NORMAL };

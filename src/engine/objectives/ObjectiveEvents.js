export const OBJECTIVE_EVENTS = Object.freeze({
  locationEntered: 'location_entered',
  locationExited: 'location_exited',
  roomEntered: 'room_entered',
  itemAcquired: 'item_acquired',
  equipmentAcquired: 'equipment_acquired',
  equipmentEquipped: 'equipment_equipped',
  interactionUsed: 'interaction_used',
  chestOpened: 'chest_opened',
  gateUnlocked: 'gate_unlocked',
  leverPulled: 'lever_pulled',
  altarActivated: 'altar_activated',
  encounterCleared: 'encounter_cleared',
  dungeonCompleted: 'dungeon_completed',
});

export function createObjectiveEvent(type, payload = {}) {
  return {
    type,
    locationId: payload.locationId ?? null,
    roomId: payload.roomId ?? null,
    interactionId: payload.interactionId ?? null,
    itemId: payload.itemId ?? null,
    equipmentId: payload.equipmentId ?? payload.itemId ?? null,
    weaponId: payload.weaponId ?? null,
    species: payload.species ?? null,
    sourceId: payload.sourceId ?? null,
    timestamp: payload.timestamp ?? Date.now(),
    tags: Object.freeze([...(payload.tags ?? [])]),
    metadata: Object.freeze({ ...(payload.metadata ?? {}) }),
  };
}

export function objectiveEventMatches(event, matcher = {}) {
  if (!event || !matcher) return false;
  if (matcher.type && matcher.type !== event.type) return false;

  const exactKeys = [
    'locationId',
    'roomId',
    'interactionId',
    'itemId',
    'equipmentId',
    'weaponId',
    'species',
    'sourceId',
    'targetId',
  ];

  for (const key of exactKeys) {
    if (matcher[key] !== undefined && matcher[key] !== event[key]) return false;
  }

  if (matcher.tags?.length) {
    const eventTags = new Set(event.tags ?? []);
    if (!matcher.tags.every((tag) => eventTags.has(tag))) return false;
  }

  return true;
}

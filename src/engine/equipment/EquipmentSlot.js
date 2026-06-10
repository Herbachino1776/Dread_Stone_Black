export const EQUIPMENT_SLOTS = Object.freeze({
  weapon: 'weapon',
  armor: 'armor',
  quickItem: 'quickItem',
});

export function isKnownEquipmentSlot(slotId) {
  return Object.values(EQUIPMENT_SLOTS).includes(slotId);
}

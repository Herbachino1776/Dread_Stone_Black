export const objectiveMessages = Object.freeze({
  bgt_arm_started: 'The temple notices your empty hand.',
  bgt_find_chest_complete: 'The offering room remembers your hand.',
  bgt_sword_taken: 'A rusted sword has been taken.',
  bgt_sword_equipped: 'Objective complete: Arm yourself.',
  bgt_blood_started: 'The blade asks for proof.',
  bgt_blood_complete: 'The rust drinks and wakes.',
  bgt_survive_started: 'The warring temple opens its throat.',
  bgt_survive_complete: 'The first grass tavern has been reached.',
  south_crypt_started: 'The crypt keeps count of every step.',
  south_crypt_reliquary_awake: 'The black reliquary wakes.',
});

export function resolveObjectiveMessage(messageId) {
  if (!messageId) return '';
  return objectiveMessages[messageId] ?? messageId;
}

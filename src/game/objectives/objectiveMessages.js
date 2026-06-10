export const objectiveMessages = Object.freeze({
  bgt_arm_started: 'The temple notices your empty hand.',
  bgt_find_chest_complete: 'A rusted blade answers from the offering chest.',
  bgt_sword_taken: 'The temple accepts armed hands.',
  bgt_sword_equipped: 'The rusted sword settles into your grip.',
  bgt_blood_started: 'Blood wakes the grass below.',
  bgt_blood_complete: 'The lower halls stir.',
  bgt_survive_started: 'The warring temple opens its throat.',
  bgt_survive_complete: 'The deeper grass hall has been reached.',
  bgt_altar_started: 'The black roots gather around the altar.',
  bgt_altar_silent: 'The altar remains silent.',
  south_crypt_started: 'The crypt keeps count of every step.',
  south_crypt_reliquary_awake: 'The black reliquary wakes.',
});

export function resolveObjectiveMessage(messageId) {
  if (!messageId) return '';
  return objectiveMessages[messageId] ?? messageId;
}

export const objectiveMessages = Object.freeze({
  south_crypt_started: 'The crypt keeps count of every step.',
  south_crypt_reliquary_awake: 'The black reliquary wakes.',
});

export function resolveObjectiveMessage(messageId) {
  if (!messageId) return '';
  return objectiveMessages[messageId] ?? messageId;
}

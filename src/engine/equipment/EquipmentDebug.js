export function logEquipmentDebug(message, payload = null) {
  if (!import.meta.env.DEV) return;

  if (payload) {
    console.info(`[Equipment] ${message}`, payload);
  } else {
    console.info(`[Equipment] ${message}`);
  }
}

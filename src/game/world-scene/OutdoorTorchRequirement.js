export const OUTDOOR_TORCH_WARNING_THRESHOLD = 0.25;

export function resolveOutdoorTorchWarning({ torchNeedLevel = 0, warningArmed = true, ownsTorch = false, equippedOffhandId = null } = {}) {
  if (!warningArmed || torchNeedLevel < OUTDOOR_TORCH_WARNING_THRESHOLD || equippedOffhandId === 'torch') return null;
  if (!ownsTorch) return 'Night is coming. Find a torch before traveling farther.';
  if (equippedOffhandId) return 'Night is coming. Equip a torch in your offhand.';
  return 'Night is coming. Equip a torch in your offhand.';
}

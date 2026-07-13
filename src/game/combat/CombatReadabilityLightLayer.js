export const COMBAT_READABILITY_LIGHT_LAYER = 2;

export function enableCombatReadabilityLightLayer(object) {
  object?.layers?.enable?.(0);
  object?.layers?.enable?.(COMBAT_READABILITY_LIGHT_LAYER);
  return object;
}

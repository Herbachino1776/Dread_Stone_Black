export const WEAPON_WORLD_LAYER = 0;
export const WEAPON_VIEWMODEL_LAYER = 3;

export function enableWeaponViewmodelLightLayer(light) {
  light?.layers?.enable?.(WEAPON_VIEWMODEL_LAYER);
  return light;
}

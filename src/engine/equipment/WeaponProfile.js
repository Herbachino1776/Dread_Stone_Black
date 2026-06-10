export function normalizeWeaponProfile(profile) {
  if (!profile?.id) {
    throw new Error('Weapon profile requires an id.');
  }

  return Object.freeze({
    id: profile.id,
    displayName: profile.displayName ?? profile.id,
    description: profile.description ?? '',
    weaponType: profile.weaponType ?? 'unarmed',
    damage: Number(profile.damage ?? 1),
    attackRange: Number(profile.attackRange ?? 1.8),
    attackCooldown: Number(profile.attackCooldown ?? 1),
    windupTime: Number(profile.windupTime ?? 0),
    recoveryTime: Number(profile.recoveryTime ?? 0),
    staminaCost: Number(profile.staminaCost ?? 0),
    fpvProfileId: profile.fpvProfileId ?? profile.id,
    goreProfileId: profile.goreProfileId ?? profile.id,
    hitReactionType: profile.hitReactionType ?? 'light',
    tags: Object.freeze([...(profile.tags ?? [])]),
  });
}

export function createWeaponProfileRegistry(profiles) {
  return Object.freeze(Object.fromEntries(
    profiles.map((profile) => {
      const normalized = normalizeWeaponProfile(profile);
      return [normalized.id, normalized];
    }),
  ));
}

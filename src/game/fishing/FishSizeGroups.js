export const FISH_SIZE_GROUPS = Object.freeze({
  small: Object.freeze({ id: 'small', label: 'Small Fish', scale: 0.72, hookEase: 1.25, fightStrength: 0.55, reelWeight: 0.75, hungerSeconds: 5 * 60 }),
  medium: Object.freeze({ id: 'medium', label: 'Medium Fish', scale: 1, hookEase: 1, fightStrength: 1, reelWeight: 1, hungerSeconds: 10 * 60 }),
  large: Object.freeze({ id: 'large', label: 'Large Fish', scale: 1.32, hookEase: 0.72, fightStrength: 1.65, reelWeight: 1.55, hungerSeconds: 20 * 60 }),
});

export function resolveFishSizeGroup(sizeGroup = 'medium') {
  return FISH_SIZE_GROUPS[sizeGroup] ?? FISH_SIZE_GROUPS.medium;
}

export function chooseFishSizeGroup(seed = Math.random()) {
  const roll = Math.abs(seed % 1);
  if (roll < 0.46) return 'small';
  if (roll < 0.84) return 'medium';
  return 'large';
}

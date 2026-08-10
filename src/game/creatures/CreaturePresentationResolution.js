export const HUMANOID_PRESENTATION_HEIGHT_RANGE = Object.freeze({ min: 0.5, max: 3.5, step: 0.05 });

export function validateHumanoidPresentationHeight(targetHeight) {
  return Number.isFinite(targetHeight)
    && targetHeight >= HUMANOID_PRESENTATION_HEIGHT_RANGE.min
    && targetHeight <= HUMANOID_PRESENTATION_HEIGHT_RANGE.max;
}

export function composeCreaturePresentationHeight(resolved, targetHeight, { source = 'Creature presentation' } = {}) {
  if (!resolved?.definition || !resolved?.pack || !resolved?.profile) {
    throw new Error(`${source} requires a resolved Creature Definition, Creature Pack, and runtime profile`);
  }
  if (!validateHumanoidPresentationHeight(targetHeight)) {
    throw new Error(`${source} target height must be ${HUMANOID_PRESENTATION_HEIGHT_RANGE.min}-${HUMANOID_PRESENTATION_HEIGHT_RANGE.max} meters`);
  }
  const profile = Object.freeze({ ...resolved.profile, targetHeight });
  return Object.freeze({ ...resolved, definition: resolved.definition, pack: resolved.pack, profile });
}

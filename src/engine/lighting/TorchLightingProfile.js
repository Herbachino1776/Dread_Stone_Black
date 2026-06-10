export const TORCH_LIGHTING_PROFILES = Object.freeze({
  dungeonTorch: Object.freeze({
    id: 'dungeonTorch',
    color: 0xffa45a,
    intensity: 2.45,
    distance: 8.2,
    decay: 1.35,
    flickerAmount: 0.12,
    flickerSpeed: 1,
    warmth: 0.92,
    glowOpacity: 0.26,
    mobileCostTier: 2,
    lightOffset: 0.38,
  }),
  weakTorch: Object.freeze({
    id: 'weakTorch',
    color: 0xf1934a,
    intensity: 1.45,
    distance: 5.8,
    decay: 1.45,
    flickerAmount: 0.09,
    flickerSpeed: 0.85,
    warmth: 0.82,
    glowOpacity: 0.18,
    mobileCostTier: 1,
    lightOffset: 0.34,
  }),
  strongTorch: Object.freeze({
    id: 'strongTorch',
    color: 0xffb36a,
    intensity: 3.15,
    distance: 10.5,
    decay: 1.28,
    flickerAmount: 0.13,
    flickerSpeed: 1.05,
    warmth: 0.95,
    glowOpacity: 0.3,
    mobileCostTier: 3,
    lightOffset: 0.42,
  }),
  ritualTorch: Object.freeze({
    id: 'ritualTorch',
    color: 0xff8f3f,
    intensity: 2.9,
    distance: 9.4,
    decay: 1.32,
    flickerAmount: 0.16,
    flickerSpeed: 0.72,
    warmth: 1,
    glowOpacity: 0.34,
    mobileCostTier: 3,
    lightOffset: 0.42,
  }),
  exteriorTorch: Object.freeze({
    id: 'exteriorTorch',
    color: 0xffaa62,
    intensity: 2.2,
    distance: 9.6,
    decay: 1.42,
    flickerAmount: 0.15,
    flickerSpeed: 1.15,
    warmth: 0.9,
    glowOpacity: 0.22,
    mobileCostTier: 2,
    lightOffset: 0.4,
  }),
});

export const TORCH_LIGHT_BUDGETS = Object.freeze({
  mobile: Object.freeze({
    maxActivePointLights: 12,
    maxCostTierPerRoom: 8,
    distantVisualOnly: true,
  }),
  desktop: Object.freeze({
    maxActivePointLights: 28,
    maxCostTierPerRoom: 18,
    distantVisualOnly: false,
  }),
});

export function resolveTorchLightingProfile(profile = 'dungeonTorch', overrides = {}) {
  const profileId = typeof profile === 'string' ? profile : profile?.id;
  const base = TORCH_LIGHTING_PROFILES[profileId] ?? TORCH_LIGHTING_PROFILES.dungeonTorch;
  return Object.freeze({
    ...base,
    ...(typeof profile === 'object' ? profile : {}),
    ...overrides,
    id: profileId ?? base.id,
  });
}

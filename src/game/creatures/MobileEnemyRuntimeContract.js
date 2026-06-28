export const MOBILE_ENEMY_LIFECYCLE_STATES = Object.freeze([
  'authored',
  'spawned',
  'pendingLoad',
  'loading',
  'loaded',
  'visible',
  'active',
  'sleeping',
  'failed',
  'disposed',
]);

export const FOLSOM_NECKMAN_MOBILE_ANIMATION_STATES = Object.freeze(['idle', 'walk', 'punch_right', 'die']);

export const MOBILE_ENEMY_BUDGETS = Object.freeze({
  normalMobileEnemy: Object.freeze({
    maxVisibleActorRootsPerEnemy: 1,
    maxActiveMixersPerAnimatedEnemy: 1,
    maxLoadedModelRootsPerEnemy: 1,
    allowAllAnimationPreload: false,
    requiresStagedLoading: true,
    aiTickSeconds: 0.1,
    maxBehaviorSlicesPerFrame: 1,
    frameBudgetMs: 0.85,
  }),
  folsomNeckmanBloodFeud: Object.freeze({
    species: 'neck_man',
    encounterMode: 'folsom_neckman_blood_feud',
    animationStates: FOLSOM_NECKMAN_MOBILE_ANIMATION_STATES,
    maxVisibleActorRootsPerEnemy: 1,
    maxActiveMixersPerAnimatedEnemy: 1,
    maxLoadedModelRootsPerEnemy: 1,
    allowAllAnimationPreload: false,
    requiresStagedLoading: true,
    loadQueueConcurrency: 1,
    loadStaggerMs: 260,
    aiTickSeconds: 0.1,
    maxBehaviorSlicesPerFrame: 1,
    frameBudgetMs: 0.85,
  }),
});

export function createMobileEnemyLifecycle(state = 'authored', extra = {}) {
  return {
    state,
    authoredAt: performance?.now?.() ?? Date.now(),
    spawnedAt: null,
    loadStartedAt: null,
    loadedAt: null,
    visibleAt: null,
    activeAt: null,
    failedAt: null,
    disposedAt: null,
    failure: null,
    loadedStates: [],
    ...extra,
  };
}

export function assertMobileEnemyBudget({ encounterMode, species, animationStates = [], stagedLoading = false } = {}) {
  if (encounterMode !== 'folsom_neckman_blood_feud' || species !== 'neck_man') return true;
  const expected = FOLSOM_NECKMAN_MOBILE_ANIMATION_STATES;
  const extra = animationStates.filter((state) => !expected.includes(state));
  if (extra.length) throw new Error(`Folsom Neckman mobile budget only allows ${expected.join(', ')}; found ${extra.join(', ')}.`);
  if (!stagedLoading) throw new Error('Folsom Neckman mobile budget requires staged loading.');
  return true;
}

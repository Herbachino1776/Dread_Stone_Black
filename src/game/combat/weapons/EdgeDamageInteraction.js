export const EDGE_DAMAGE_SCHEMA = 'dreadstone.edge-damage.v1';
export const EDGE_DAMAGE_MAX_SAMPLES = 96;

const vectorArray = (value) => value?.toArray?.() ?? [Number(value?.x) || 0, Number(value?.y) || 0, Number(value?.z) || 0];

export function createEdgeDamageInteraction({ weaponId, weaponFamily = 'sword', hit, classification, part, startedAt = 0 } = {}) {
  return {
    schema: EDGE_DAMAGE_SCHEMA,
    weaponId: weaponId ?? 'unknown_melee_weapon',
    weaponFamily,
    target: {
      actorId: hit?.actor?.id ?? hit?.actor?.root?.uuid ?? null,
      bodyId: hit?.bodyId ?? null,
      regionId: hit?.regionId ?? null,
    },
    classification: classification ?? 'cut',
    part: part ?? 'edge',
    samples: [],
    totalTravel: 0,
    maximumDepth: 0,
    accumulatedSeverity: 0,
    startedAt,
    completedAt: null,
    completed: false,
    interrupted: false,
    revision: 0,
  };
}

export function appendEdgeDamageSample(edgeDamage, {
  point,
  localPoint = null,
  normal,
  direction,
  travel = 0,
  depth = 0,
  severity = 0,
  edgeAlignment = 0,
  time = 0,
} = {}) {
  if (!edgeDamage || edgeDamage.completed) return null;
  const sample = {
    worldPoint: vectorArray(point),
    localPoint: vectorArray(localPoint ?? point),
    worldNormal: vectorArray(normal),
    worldDirection: vectorArray(direction),
    travel: Math.max(0, Number(travel) || 0),
    depth: Math.max(0, Number(depth) || 0),
    severity: Math.max(0, Number(severity) || 0),
    edgeAlignment: Math.max(0, Math.min(1, Number(edgeAlignment) || 0)),
    time: Math.max(0, Number(time) || 0),
  };
  if (edgeDamage.samples.length >= EDGE_DAMAGE_MAX_SAMPLES) edgeDamage.samples.shift();
  edgeDamage.samples.push(sample);
  edgeDamage.totalTravel += sample.travel;
  edgeDamage.maximumDepth = Math.max(edgeDamage.maximumDepth, sample.depth);
  edgeDamage.accumulatedSeverity += sample.severity;
  edgeDamage.revision += 1;
  return sample;
}

export function finishEdgeDamageInteraction(edgeDamage, { interrupted = false, completedAt = 0 } = {}) {
  if (!edgeDamage || edgeDamage.completed) return edgeDamage ?? null;
  edgeDamage.completed = true;
  edgeDamage.interrupted = Boolean(interrupted);
  edgeDamage.completedAt = Math.max(0, Number(completedAt) || 0);
  edgeDamage.revision += 1;
  return edgeDamage;
}

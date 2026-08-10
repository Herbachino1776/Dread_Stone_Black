export const FORGE_ATTACHMENT_SOCKET_SCHEMA = 'dreadstone.attachment_sockets.v1';
export const FORGE_OFFENSIVE_ACTION_SCHEMA = 'dreadstone.offensive_action.v1';
export const FORGE_RUNTIME_ANIMATION_SCHEMA = 'dreadstone.runtime_animations.v1';

export const FORGE_SOCKET_ROLES = Object.freeze(['MAIN_HAND_R', 'MAIN_HAND_L']);
export const FORGE_WEAPON_CLASSES = Object.freeze([
  'ONE_HAND_BLADE',
  'ONE_HAND_BLUNT',
  'TWO_HAND_BLADE',
  'TWO_HAND_BLUNT',
  'POLEARM',
]);

const STABLE_ID = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;
const EPSILON = 1e-6;

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finiteVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function requireCondition(errors, condition, path, message) {
  if (!condition) errors.push(`${path} ${message}`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function normalizedQuaternion(value) {
  if (!finiteVector(value, 4)) return false;
  return Math.abs(Math.hypot(...value) - 1) <= 1e-4;
}

function unavailableAttachmentCapability(runtimeArmature = null, runtimeBoneCount = 0) {
  return {
    schema: FORGE_ATTACHMENT_SOCKET_SCHEMA,
    available: false,
    runtimeArmature,
    runtimeBoneCount,
    sockets: [],
  };
}

function unavailableOffensiveCapability() {
  return {
    schema: FORGE_OFFENSIVE_ACTION_SCHEMA,
    available: false,
    actions: [],
  };
}

export function validateAttachmentSocketCapability(capability, { supportedBones = null } = {}) {
  const errors = [];
  requireCondition(errors, isRecord(capability), 'attachmentSockets', 'must be an object');
  if (!isRecord(capability)) return { valid: false, errors };
  requireCondition(errors, capability.schema === FORGE_ATTACHMENT_SOCKET_SCHEMA, 'attachmentSockets.schema', `must be ${FORGE_ATTACHMENT_SOCKET_SCHEMA}`);
  requireCondition(errors, typeof capability.available === 'boolean', 'attachmentSockets.available', 'must be boolean');
  requireCondition(errors, capability.runtimeArmature == null || capability.runtimeArmature === 'DSB_DAMAGE_RIG', 'attachmentSockets.runtimeArmature', 'must be DSB_DAMAGE_RIG or null');
  requireCondition(errors, Number.isInteger(capability.runtimeBoneCount) && capability.runtimeBoneCount >= 0, 'attachmentSockets.runtimeBoneCount', 'must be a non-negative integer');
  requireCondition(errors, Array.isArray(capability.sockets), 'attachmentSockets.sockets', 'must be an array');
  if (!Array.isArray(capability.sockets)) return { valid: false, errors };
  requireCondition(errors, capability.available === (capability.sockets.length > 0), 'attachmentSockets.available', 'must reflect whether sockets are present');
  const boneSet = supportedBones ? new Set(supportedBones) : null;
  const ids = [];
  const roles = [];
  capability.sockets.forEach((socket, index) => {
    const path = `attachmentSockets.sockets[${index}]`;
    requireCondition(errors, isRecord(socket), path, 'must be an object');
    if (!isRecord(socket)) return;
    requireCondition(errors, typeof socket.socketId === 'string' && STABLE_ID.test(socket.socketId), `${path}.socketId`, 'must be a stable lowercase identifier');
    requireCondition(errors, FORGE_SOCKET_ROLES.includes(socket.semanticRole), `${path}.semanticRole`, 'is unsupported');
    requireCondition(errors, typeof socket.parentRuntimeBone === 'string' && socket.parentRuntimeBone.length > 0, `${path}.parentRuntimeBone`, 'must be a non-empty string');
    if (boneSet) requireCondition(errors, boneSet.has(socket.parentRuntimeBone), `${path}.parentRuntimeBone`, 'is absent from the runtime skeleton');
    requireCondition(errors, finiteVector(socket.localPosition, 3), `${path}.localPosition`, 'must be a finite 3-vector');
    requireCondition(errors, normalizedQuaternion(socket.localQuaternion), `${path}.localQuaternion`, 'must be a finite normalized [x,y,z,w] quaternion');
    ids.push(socket.socketId);
    roles.push(socket.semanticRole);
  });
  requireCondition(errors, new Set(ids).size === ids.length, 'attachmentSockets.sockets', 'must not contain duplicate socket IDs');
  requireCondition(errors, new Set(roles).size === roles.length, 'attachmentSockets.sockets', 'must not contain duplicate semantic roles');
  return { valid: errors.length === 0, errors };
}

export function validateOffensiveActionRecord(action, {
  approvedClips = null,
  availableSocketRoles = null,
} = {}) {
  const errors = [];
  requireCondition(errors, isRecord(action), 'offensiveAction', 'must be an object');
  if (!isRecord(action)) return { valid: false, errors };
  requireCondition(errors, action.schema === FORGE_OFFENSIVE_ACTION_SCHEMA, 'offensiveAction.schema', `must be ${FORGE_OFFENSIVE_ACTION_SCHEMA}`);
  requireCondition(errors, typeof action.actionName === 'string' && action.actionName.length > 0, 'offensiveAction.actionName', 'must name an approved runtime clip');
  requireCondition(errors, typeof action.combatActionId === 'string' && STABLE_ID.test(action.combatActionId), 'offensiveAction.combatActionId', 'must be a stable lowercase identifier');
  requireCondition(errors, typeof action.attackFamily === 'string' && action.attackFamily.length > 0, 'offensiveAction.attackFamily', 'must be a non-empty string');
  requireCondition(errors, FORGE_SOCKET_ROLES.includes(action.socketRole), 'offensiveAction.socketRole', 'is unsupported');
  if (action.secondarySocketRole != null) requireCondition(errors, FORGE_SOCKET_ROLES.includes(action.secondarySocketRole), 'offensiveAction.secondarySocketRole', 'is unsupported');
  const classes = action.compatibleWeaponClasses;
  requireCondition(errors, Array.isArray(classes) && classes.length > 0 && classes.every((entry) => FORGE_WEAPON_CLASSES.includes(entry)) && new Set(classes).size === classes.length, 'offensiveAction.compatibleWeaponClasses', 'must contain supported unique weapon classes');
  requireCondition(errors, action.attackSourceRole === 'EQUIPPED_MAIN_HAND', 'offensiveAction.attackSourceRole', 'must be EQUIPPED_MAIN_HAND');
  requireCondition(errors, ['IN_PLACE', 'AUTHORED_ROOT_MOTION'].includes(action.rootMotionPolicy), 'offensiveAction.rootMotionPolicy', 'is unsupported');
  requireCondition(errors, Number.isFinite(action.clipDurationSeconds) && action.clipDurationSeconds > 0, 'offensiveAction.clipDurationSeconds', 'must be finite and positive');

  const bounds = {};
  for (const phaseName of ['windup', 'active', 'recovery']) {
    const phase = action.phases?.[phaseName];
    requireCondition(errors, isRecord(phase), `offensiveAction.phases.${phaseName}`, 'must be an object');
    if (!isRecord(phase)) continue;
    requireCondition(errors, Number.isFinite(phase.startSeconds) && Number.isFinite(phase.endSeconds), `offensiveAction.phases.${phaseName}`, 'must use finite seconds');
    if (Number.isFinite(phase.startSeconds) && Number.isFinite(phase.endSeconds)) bounds[phaseName] = [phase.startSeconds, phase.endSeconds];
  }
  if (Object.keys(bounds).length === 3) {
    const [windup, active, recovery] = [bounds.windup, bounds.active, bounds.recovery];
    requireCondition(errors, Math.abs(windup[0]) <= EPSILON && windup[1] >= windup[0], 'offensiveAction.phases.windup', 'must begin at zero and not reverse');
    requireCondition(errors, active[1] > active[0], 'offensiveAction.phases.active', 'must have positive duration');
    requireCondition(errors, recovery[1] >= recovery[0], 'offensiveAction.phases.recovery', 'must not reverse');
    requireCondition(errors, Math.abs(windup[1] - active[0]) <= EPSILON && Math.abs(active[1] - recovery[0]) <= EPSILON, 'offensiveAction.phases', 'must be contiguous and non-overlapping');
    requireCondition(errors, Math.abs(recovery[1] - action.clipDurationSeconds) <= 1e-4, 'offensiveAction.phases.recovery', 'must end at clipDurationSeconds');
    requireCondition(errors, [windup, active, recovery].flat().every((value) => value >= -EPSILON && value <= action.clipDurationSeconds + EPSILON), 'offensiveAction.phases', 'must remain inside the clip');
  }
  if (action.commitment != null) {
    requireCondition(errors, isRecord(action.commitment), 'offensiveAction.commitment', 'must be an object');
    if (isRecord(action.commitment)) {
      requireCondition(errors, Number.isFinite(action.commitment.timeSeconds) && action.commitment.timeSeconds >= 0 && action.commitment.timeSeconds <= action.clipDurationSeconds, 'offensiveAction.commitment.timeSeconds', 'must lie inside the clip');
      requireCondition(errors, typeof action.commitment.lockOrientationThroughActive === 'boolean', 'offensiveAction.commitment.lockOrientationThroughActive', 'must be boolean');
    }
  }
  if (approvedClips) {
    const approved = approvedClips.find((clip) => clip.name === action.actionName);
    requireCondition(errors, Boolean(approved), 'offensiveAction.actionName', 'does not exist in approved animation capability');
    if (approved) requireCondition(errors, Math.abs(Number(approved.durationSeconds) - action.clipDurationSeconds) <= 1e-4, 'offensiveAction.clipDurationSeconds', 'does not match the approved runtime clip');
  }
  if (availableSocketRoles) {
    const roles = new Set(availableSocketRoles);
    requireCondition(errors, roles.has(action.socketRole), 'offensiveAction.socketRole', 'cannot be resolved by this Creature Pack');
    if (action.secondarySocketRole != null) requireCondition(errors, roles.has(action.secondarySocketRole), 'offensiveAction.secondarySocketRole', 'cannot be resolved by this Creature Pack');
  }
  return { valid: errors.length === 0, errors };
}

export function validateOffensiveActionCapability(capability, options = {}) {
  const errors = [];
  requireCondition(errors, isRecord(capability), 'offensiveActions', 'must be an object');
  if (!isRecord(capability)) return { valid: false, errors };
  requireCondition(errors, capability.schema === FORGE_OFFENSIVE_ACTION_SCHEMA, 'offensiveActions.schema', `must be ${FORGE_OFFENSIVE_ACTION_SCHEMA}`);
  requireCondition(errors, typeof capability.available === 'boolean', 'offensiveActions.available', 'must be boolean');
  requireCondition(errors, Array.isArray(capability.actions), 'offensiveActions.actions', 'must be an array');
  if (!Array.isArray(capability.actions)) return { valid: false, errors };
  requireCondition(errors, capability.available === (capability.actions.length > 0), 'offensiveActions.available', 'must reflect whether Actions are present');
  const names = [];
  const ids = [];
  capability.actions.forEach((action, index) => {
    const result = validateOffensiveActionRecord(action, options);
    result.errors.forEach((error) => errors.push(`offensiveActions.actions[${index}]: ${error}`));
    names.push(action?.actionName);
    ids.push(action?.combatActionId);
  });
  requireCondition(errors, new Set(names).size === names.length, 'offensiveActions.actions', 'must not contain duplicate Action names');
  requireCondition(errors, new Set(ids).size === ids.length, 'offensiveActions.actions', 'must not contain duplicate combat Action IDs');
  return { valid: errors.length === 0, errors };
}

export function extractForgeRuntimeArmamentCapabilities(manifest, {
  approvedClips = [],
  supportedBones = manifest?.runtimeSkeleton?.requiredBones ?? [],
} = {}) {
  const runtimeArmature = manifest?.runtimeSkeleton?.armature ?? null;
  const runtimeBoneCount = Array.isArray(supportedBones) ? supportedBones.length : 0;
  const rawSockets = manifest?.runtimeAttachmentSockets;
  const attachmentSockets = rawSockets == null
    ? unavailableAttachmentCapability(runtimeArmature, runtimeBoneCount)
    : {
        schema: rawSockets.schema,
        available: Array.isArray(rawSockets.sockets) && rawSockets.sockets.length > 0,
        runtimeArmature: rawSockets.runtimeArmature,
        runtimeBoneCount: rawSockets.runtimeBoneCount,
        sockets: Array.isArray(rawSockets.sockets) ? rawSockets.sockets.map((socket) => ({
          socketId: socket.socketId,
          semanticRole: socket.semanticRole,
          parentRuntimeBone: socket.parentRuntimeBone,
          localPosition: [...(socket.localPosition ?? [])],
          localQuaternion: [...(socket.localQuaternion ?? [])],
        })) : rawSockets.sockets,
      };
  const socketValidation = validateAttachmentSocketCapability(attachmentSockets, { supportedBones });
  if (!socketValidation.valid) throw new Error(`Invalid Forge attachment socket capability: ${socketValidation.errors.join('; ')}`);
  if (rawSockets != null) {
    if (rawSockets.socketCount !== attachmentSockets.sockets.length) throw new Error('Invalid Forge attachment socket capability: socketCount does not match sockets');
    if (rawSockets.runtimeBoneCount !== runtimeBoneCount) throw new Error('Invalid Forge attachment socket capability: runtimeBoneCount does not match runtime skeleton');
    if (rawSockets.runtimeArmature !== runtimeArmature) throw new Error('Invalid Forge attachment socket capability: runtimeArmature does not match runtime skeleton');
    if (rawSockets.sockets.some((socket) => socket?.enabled !== true || socket?.exportable !== true)) throw new Error('Invalid Forge attachment socket capability: exported sockets must be enabled and exportable');
  }

  const runtimeAnimations = manifest?.runtimeAnimations;
  if (runtimeAnimations == null) return { attachmentSockets, offensiveActions: unavailableOffensiveCapability() };
  if (runtimeAnimations.schema !== FORGE_RUNTIME_ANIMATION_SCHEMA) throw new Error(`Invalid Forge runtime animation schema: expected ${FORGE_RUNTIME_ANIMATION_SCHEMA}`);
  if (runtimeAnimations.status !== 'PASS') throw new Error('Invalid Forge runtime animation capability: status must be PASS');
  if (runtimeAnimations.runtimeArmature !== runtimeArmature) throw new Error('Invalid Forge runtime animation capability: runtimeArmature does not match runtime skeleton');
  if (!Array.isArray(runtimeAnimations.clips)) throw new Error('Invalid Forge runtime animation capability: clips must be an array');
  if (runtimeAnimations.exportedCount !== runtimeAnimations.clips.length) throw new Error('Invalid Forge runtime animation capability: exportedCount does not match clips');
  const clips = runtimeAnimations.clips;
  const offensiveClips = clips.filter((clip) => clip?.offensiveAction != null);
  const records = runtimeAnimations.offensiveActions;
  if (records == null) {
    if (offensiveClips.length > 0) throw new Error('Invalid Forge offensive Action capability: clip metadata exists without offensiveActions list metadata');
    return { attachmentSockets, offensiveActions: unavailableOffensiveCapability() };
  }
  if (runtimeAnimations.offensiveActionSchema !== FORGE_OFFENSIVE_ACTION_SCHEMA) throw new Error(`Invalid Forge offensive Action schema: expected ${FORGE_OFFENSIVE_ACTION_SCHEMA}`);
  if (!Array.isArray(records)) throw new Error('Invalid Forge offensive Action capability: offensiveActions must be an array');
  const actions = records.map((record) => ({ ...record }));
  if (offensiveClips.length !== actions.length) throw new Error('Invalid Forge offensive Action capability: clip/list metadata counts differ');
  for (const action of actions) {
    const clip = clips.find((entry) => entry.name === action.actionName);
    if (!clip) throw new Error(`Invalid Forge offensive Action capability: ${action.actionName} has no runtime clip record`);
    if (clip.offensiveAction == null) throw new Error(`Invalid Forge offensive Action capability: ${action.actionName} runtime clip has no offensive metadata`);
    const withoutName = Object.fromEntries(Object.entries(action).filter(([key]) => key !== 'actionName'));
    if (canonicalJson(clip.offensiveAction) !== canonicalJson(withoutName)) throw new Error(`Invalid Forge offensive Action capability: ${action.actionName} clip/list metadata differ`);
    if (Math.abs(Number(clip.clipDurationSeconds) - Number(action.clipDurationSeconds)) > 1e-4) throw new Error(`Invalid Forge offensive Action capability: ${action.actionName} runtime duration differs`);
    const approved = approvedClips.find((entry) => entry.name === action.actionName);
    if (approved && approved.kind !== clip.approvedKind) throw new Error(`Invalid Forge offensive Action capability: ${action.actionName} approved kind differs`);
  }
  for (const clip of offensiveClips) {
    if (!actions.some((action) => action.actionName === clip.name)) throw new Error(`Invalid Forge offensive Action capability: ${clip.name} clip metadata has no list record`);
  }
  const offensiveActions = {
    schema: FORGE_OFFENSIVE_ACTION_SCHEMA,
    available: actions.length > 0,
    actions,
  };
  const validation = validateOffensiveActionCapability(offensiveActions, {
    approvedClips,
    availableSocketRoles: attachmentSockets.sockets.map((socket) => socket.semanticRole),
  });
  if (!validation.valid) throw new Error(`Invalid Forge offensive Action capability: ${validation.errors.join('; ')}`);
  return { attachmentSockets, offensiveActions };
}

export function offensivePhaseAtTime(action, clipTimeSeconds) {
  const time = Math.max(0, Number(clipTimeSeconds) || 0);
  if (!action || time >= action.clipDurationSeconds - EPSILON) return 'COMPLETE';
  if (time < action.phases.windup.endSeconds) return 'WINDUP';
  if (time < action.phases.active.endSeconds) return 'ACTIVE';
  return 'RECOVERY';
}

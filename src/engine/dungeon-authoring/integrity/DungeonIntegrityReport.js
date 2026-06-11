import { INTEGRITY_SEVERITY } from './DungeonIntegrityTypes.js';

function normalizeRelatedIds(relatedIds) {
  if (!relatedIds) return [];
  return Array.isArray(relatedIds) ? relatedIds.filter(Boolean) : [relatedIds];
}

function clonePosition(position) {
  if (!position) return null;
  return {
    x: Number(position.x ?? 0),
    y: Number(position.y ?? 0),
    z: Number(position.z ?? 0),
  };
}

export class DungeonIntegrityReport {
  constructor({ locationId }) {
    this.locationId = locationId;
    this.issues = [];
    this.debug = {
      wallSegments: [],
      collisionSegments: [],
      roomEdges: [],
      openings: [],
      leakMarkers: [],
      facades: [],
    };
  }

  addIssue({
    severity = INTEGRITY_SEVERITY.WARNING,
    code,
    message,
    category = 'authoring',
    roomId = null,
    objectId = null,
    wallId = null,
    blockerId = null,
    facadeId = null,
    position = null,
    suggestedFix = '',
    relatedIds = [],
  }) {
    this.issues.push({
      severity,
      code,
      message,
      locationId: this.locationId,
      roomId,
      objectId,
      wallId,
      blockerId,
      facadeId,
      position: clonePosition(position),
      suggestedFix,
      relatedIds: normalizeRelatedIds(relatedIds),
      category,
    });
  }

  error(issue) {
    this.addIssue({ ...issue, severity: INTEGRITY_SEVERITY.ERROR });
  }

  warning(issue) {
    this.addIssue({ ...issue, severity: INTEGRITY_SEVERITY.WARNING });
  }

  info(issue) {
    this.addIssue({ ...issue, severity: INTEGRITY_SEVERITY.INFO });
  }

  get errors() {
    return this.issues.filter((issue) => issue.severity === INTEGRITY_SEVERITY.ERROR);
  }

  get warnings() {
    return this.issues.filter((issue) => issue.severity === INTEGRITY_SEVERITY.WARNING);
  }

  get infos() {
    return this.issues.filter((issue) => issue.severity === INTEGRITY_SEVERITY.INFO);
  }

  get ok() {
    return this.errors.length === 0;
  }

  toJSON() {
    return {
      locationId: this.locationId,
      ok: this.ok,
      errors: this.errors,
      warnings: this.warnings,
      infos: this.infos,
      issues: this.issues,
      debug: this.debug,
    };
  }
}

export function formatIntegrityIssue(issue) {
  const scope = [
    issue.locationId,
    issue.roomId,
    issue.facadeId,
    issue.wallId,
    issue.blockerId,
    issue.objectId,
  ].filter(Boolean).join('/');
  const prefix = `${issue.severity ?? 'warning'} ${issue.code ?? 'UNKNOWN_INTEGRITY_ISSUE'}`;
  return `${prefix}${scope ? ` [${scope}]` : ''}: ${issue.message}`;
}

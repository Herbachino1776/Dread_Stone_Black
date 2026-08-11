import { canonicalizeEncounterDefinition } from '../../../contracts/EncounterDefinition.js';

export const ENCOUNTER_AUTHORING_DRAFT_NAMESPACE = 'dreadstone.encounter_authoring.draft.v1';
export const ENCOUNTER_AUTHORING_DRAFT_STORAGE_SCHEMA = 'dreadstone.encounter_authoring.draft_storage.v1';

function draftKey(locationId, encounterId) {
  return `${ENCOUNTER_AUTHORING_DRAFT_NAMESPACE}.${locationId}.${encounterId}`;
}

function lastKey(locationId) {
  return `${ENCOUNTER_AUTHORING_DRAFT_NAMESPACE}.last.${locationId}`;
}

function safeEditorState(editor = {}) {
  return {
    selectedSpawnId: typeof editor.selectedSpawnId === 'string' ? editor.selectedSpawnId : null,
    tab: ['encounter', 'bank', 'selected', 'save'].includes(editor.tab) ? editor.tab : 'encounter',
  };
}

export class EncounterAuthoringDraftStore {
  constructor({ storage = globalThis.localStorage, now = () => Date.now() } = {}) {
    this.storage = storage;
    this.now = now;
    this.lastError = null;
  }

  save(draft, editor = {}) {
    const canonical = canonicalizeEncounterDefinition(draft);
    const record = {
      schema: ENCOUNTER_AUTHORING_DRAFT_STORAGE_SCHEMA,
      savedAt: this.now(),
      locationId: canonical.locationId,
      encounterId: canonical.encounterId,
      encounter: canonical,
      editor: safeEditorState(editor),
    };
    this.storage?.setItem?.(draftKey(canonical.locationId, canonical.encounterId), JSON.stringify(record));
    this.storage?.setItem?.(lastKey(canonical.locationId), canonical.encounterId);
    this.lastError = null;
    return structuredClone(record);
  }

  load(locationId, encounterId) {
    const serialized = this.storage?.getItem?.(draftKey(locationId, encounterId));
    if (!serialized) return null;
    try {
      const record = JSON.parse(serialized);
      if (record?.schema !== ENCOUNTER_AUTHORING_DRAFT_STORAGE_SCHEMA) throw new Error('unsupported local draft storage schema');
      if (record.locationId !== locationId || record.encounterId !== encounterId) throw new Error('local draft scope does not match its storage key');
      const encounter = canonicalizeEncounterDefinition(record.encounter);
      if (encounter.locationId !== locationId || encounter.encounterId !== encounterId) throw new Error('canonical encounter identity does not match local draft scope');
      this.lastError = null;
      return {
        ...record,
        encounter,
        editor: safeEditorState(record.editor),
      };
    } catch (error) {
      this.lastError = error.message;
      return null;
    }
  }

  loadLast(locationId) {
    const encounterId = this.storage?.getItem?.(lastKey(locationId));
    return encounterId ? this.load(locationId, encounterId) : null;
  }

  list(locationId) {
    const prefix = `${ENCOUNTER_AUTHORING_DRAFT_NAMESPACE}.${locationId}.`;
    const records = [];
    const length = Number(this.storage?.length) || 0;
    for (let index = 0; index < length; index += 1) {
      const key = this.storage?.key?.(index);
      if (!key?.startsWith(prefix)) continue;
      const encounterId = key.slice(prefix.length);
      if (!encounterId || encounterId === 'last') continue;
      const record = this.load(locationId, encounterId);
      if (record) records.push(record);
    }
    return records.sort((first, second) => second.savedAt - first.savedAt || first.encounterId.localeCompare(second.encounterId));
  }

  remove(locationId, encounterId) {
    this.storage?.removeItem?.(draftKey(locationId, encounterId));
    if (this.storage?.getItem?.(lastKey(locationId)) === encounterId) this.storage?.removeItem?.(lastKey(locationId));
  }
}

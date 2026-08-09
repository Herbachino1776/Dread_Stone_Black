import {
  assertValidCreaturePack,
  validateCreaturePackRegistry,
} from '../../contracts/CreaturePack.js';

const DEFAULT_REGISTRY_PATH = 'generated/creature-packs/index.json';

function resolveDocumentBaseUrl() {
  return globalThis.document?.baseURI
    ?? globalThis.location?.href
    ?? 'http://localhost/';
}

export function resolveCreaturePackPublicBaseUrl(explicitBaseUrl = null) {
  if (explicitBaseUrl) return new URL(explicitBaseUrl, resolveDocumentBaseUrl());
  const viteBase = import.meta.env?.BASE_URL ?? './';
  return new URL(viteBase, resolveDocumentBaseUrl());
}

export class CreaturePackRegistryError extends Error {
  constructor(code, message, options = {}) {
    super(`[Creature Pack Registry:${code}] ${message}`, options);
    this.name = 'CreaturePackRegistryError';
    this.code = code;
  }
}

export class CreaturePackRegistry {
  constructor({
    baseUrl = null,
    registryPath = DEFAULT_REGISTRY_PATH,
    fetchImplementation = globalThis.fetch?.bind?.(globalThis),
  } = {}) {
    if (typeof fetchImplementation !== 'function') {
      throw new CreaturePackRegistryError('FETCH_UNAVAILABLE', 'A browser-compatible fetch implementation is required.');
    }
    this.baseUrl = resolveCreaturePackPublicBaseUrl(baseUrl);
    this.registryPath = registryPath;
    this.fetchImplementation = fetchImplementation;
    this.indexPromise = null;
    this.descriptorPromises = new Map();
  }

  resolvePublicUrl(path) {
    if (typeof path !== 'string' || !path.trim()) {
      throw new CreaturePackRegistryError('INVALID_PATH', 'A non-empty public asset path is required.');
    }
    return new URL(path.replace(/^\.\//, ''), this.baseUrl).href;
  }

  async fetchJson(path, label) {
    const url = this.resolvePublicUrl(path);
    let response;
    try {
      response = await this.fetchImplementation(url, { cache: 'no-cache' });
    } catch (error) {
      throw new CreaturePackRegistryError('REQUEST_FAILED', `${label} request failed: ${url}`, { cause: error });
    }
    if (!response?.ok) {
      throw new CreaturePackRegistryError('HTTP_ERROR', `${label} request returned ${response?.status ?? 'an unknown status'}: ${url}`);
    }
    try {
      return await response.json();
    } catch (error) {
      throw new CreaturePackRegistryError('INVALID_JSON', `${label} is not valid JSON: ${url}`, { cause: error });
    }
  }

  async loadIndex() {
    if (!this.indexPromise) {
      this.indexPromise = this.fetchJson(this.registryPath, 'Creature Pack registry').then((registry) => {
        const validation = validateCreaturePackRegistry(registry);
        if (!validation.valid) {
          throw new CreaturePackRegistryError('INVALID_REGISTRY', validation.errors.join('; '));
        }
        return registry;
      }).catch((error) => {
        this.indexPromise = null;
        throw error;
      });
    }
    return this.indexPromise;
  }

  async listPacks() {
    const registry = await this.loadIndex();
    return registry.packs.map((entry) => ({
      ...entry,
      capabilities: { ...entry.capabilities },
    }));
  }

  async hasPack(packId) {
    return Boolean((await this.loadIndex()).packs.some((entry) => entry.packId === packId));
  }

  async getPackSummary(packId) {
    const entry = (await this.loadIndex()).packs.find((candidate) => candidate.packId === packId);
    if (!entry) throw new CreaturePackRegistryError('UNKNOWN_PACK', `No registered Creature Pack has packId "${packId}".`);
    return { ...entry, capabilities: { ...entry.capabilities } };
  }

  async loadPack(packId) {
    if (this.descriptorPromises.has(packId)) return this.descriptorPromises.get(packId);
    const promise = this.getPackSummary(packId).then(async (summary) => {
      const descriptor = await this.fetchJson(summary.descriptorPath, `Creature Pack ${packId}`);
      try {
        assertValidCreaturePack(descriptor);
      } catch (error) {
        throw new CreaturePackRegistryError('INVALID_DESCRIPTOR', `${packId}: ${error.message}`, { cause: error });
      }
      if (descriptor.packId !== packId) {
        throw new CreaturePackRegistryError('PACK_ID_MISMATCH', `Descriptor ${summary.descriptorPath} declares ${descriptor.packId}, expected ${packId}.`);
      }
      if (descriptor.displayName !== summary.displayName) {
        throw new CreaturePackRegistryError('DISPLAY_NAME_MISMATCH', `Descriptor ${packId} display name does not match the generated registry.`);
      }
      return descriptor;
    }).catch((error) => {
      this.descriptorPromises.delete(packId);
      throw error;
    });
    this.descriptorPromises.set(packId, promise);
    return promise;
  }

  clearCache() {
    this.indexPromise = null;
    this.descriptorPromises.clear();
  }
}

export const creaturePackRegistry = new CreaturePackRegistry();

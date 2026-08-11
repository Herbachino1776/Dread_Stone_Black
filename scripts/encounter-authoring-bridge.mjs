import { installEncounterDefinition } from './encounter-installer-lib.mjs';

export const ENCOUNTER_AUTHORING_BRIDGE_PATH = '/__dreadstone/encounter-authoring';
export const ENCOUNTER_AUTHORING_MAX_REQUEST_BYTES = 128 * 1024;

function respond(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader?.('Content-Type', 'application/json; charset=utf-8');
  response.setHeader?.('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function normalizedRequestPath(url = '') {
  try { return new URL(url, 'http://localhost').pathname.replace(/^\/Dread_Stone_Black/, ''); }
  catch { return ''; }
}

export function createEncounterAuthoringMiddleware({
  development = true,
  install = installEncounterDefinition,
  maximumBytes = ENCOUNTER_AUTHORING_MAX_REQUEST_BYTES,
} = {}) {
  if (!development) return null;
  return async function encounterAuthoringMiddleware(request, response, next = () => {}) {
    if (normalizedRequestPath(request.url) !== ENCOUNTER_AUTHORING_BRIDGE_PATH) return next();
    if (request.method !== 'POST') {
      respond(response, 405, { ok: false, error: 'METHOD_NOT_ALLOWED', message: 'Encounter authoring bridge accepts POST only.' });
      return;
    }
    const contentLength = Number(request.headers?.['content-length']);
    if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
      respond(response, 413, { ok: false, error: 'REQUEST_TOO_LARGE', message: `Encounter request exceeds ${maximumBytes} bytes.` });
      return;
    }
    let size = 0;
    const chunks = [];
    try {
      for await (const chunk of request) {
        size += chunk.length;
        if (size > maximumBytes) {
          respond(response, 413, { ok: false, error: 'REQUEST_TOO_LARGE', message: `Encounter request exceeds ${maximumBytes} bytes.` });
          return;
        }
        chunks.push(chunk);
      }
      const serialized = Buffer.concat(chunks).toString('utf8');
      if (!serialized.trim()) throw new Error('Request body must contain one canonical Encounter Definition JSON record.');
      const result = await install(serialized);
      respond(response, 200, {
        ok: true,
        encounterId: result.encounterId,
        locationId: result.locationId,
        spawnCount: result.spawnCount,
        relativePath: result.relativePath,
      });
    } catch (error) {
      respond(response, 400, {
        ok: false,
        error: error.code ?? 'INVALID_ENCOUNTER_REQUEST',
        message: error.message,
      });
    }
  };
}

export function encounterAuthoringVitePlugin() {
  return {
    name: 'dreadstone-encounter-authoring-bridge',
    apply: 'serve',
    configureServer(server) {
      const middleware = createEncounterAuthoringMiddleware({ development: true });
      server.middlewares.use(middleware);
    },
  };
}

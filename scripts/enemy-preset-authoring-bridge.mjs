import { installEnemyPreset } from './enemy-preset-installer-lib.mjs';

export const ENEMY_PRESET_AUTHORING_BRIDGE_PATH = '/__dreadstone/enemy-preset-authoring';
const MAX_BYTES = 64 * 1024;

function respond(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader?.('Content-Type', 'application/json; charset=utf-8');
  response.setHeader?.('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function requestPath(url = '') {
  try { return new URL(url, 'http://localhost').pathname.replace(/^\/Dread_Stone_Black/, ''); } catch { return ''; }
}

export function createEnemyPresetAuthoringMiddleware({ development = true, install = installEnemyPreset } = {}) {
  if (!development) return null;
  return async function enemyPresetAuthoringMiddleware(request, response, next = () => {}) {
    if (requestPath(request.url) !== ENEMY_PRESET_AUTHORING_BRIDGE_PATH) return next();
    if (request.method !== 'POST') return respond(response, 405, { ok: false, message: 'Enemy Preset bridge accepts POST only.' });
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BYTES) return respond(response, 413, { ok: false, message: 'Enemy Preset request is too large.' });
        chunks.push(chunk);
      }
      const result = await install(Buffer.concat(chunks).toString('utf8'));
      return respond(response, 200, { ok: true, presetId: result.presetId, relativePath: result.relativePath });
    } catch (error) {
      return respond(response, 400, { ok: false, error: error.code ?? 'INVALID_PRESET_REQUEST', message: error.message });
    }
  };
}

export function enemyPresetAuthoringVitePlugin() {
  return {
    name: 'dreadstone-enemy-preset-authoring-bridge',
    apply: 'serve',
    configureServer(server) { server.middlewares.use(createEnemyPresetAuthoringMiddleware()); },
  };
}

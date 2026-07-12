export function getNewGameStartupUrl(location = window.location) {
  const pathname = location?.pathname || '/';
  const query = new URLSearchParams(location?.search ?? '');
  return query.get('modelIdleCombatTest') === '1' ? `${pathname}?modelIdleCombatTest=1` : pathname;
}

export function replaceWithNewGameStartupRoute({
  location = window.location,
  history = window.history,
} = {}) {
  const startupUrl = getNewGameStartupUrl(location);
  history?.replaceState?.({ area: 'folsom', spawnId: null, newGame: true }, '', startupUrl);
  return startupUrl;
}

export function reloadToNewGameStartupRoute({
  location = window.location,
} = {}) {
  const startupUrl = getNewGameStartupUrl(location);
  if (typeof location?.replace === 'function') {
    location.replace(startupUrl);
  } else {
    location.href = startupUrl;
  }
  return startupUrl;
}

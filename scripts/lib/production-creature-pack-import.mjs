import { importCreaturePack } from './creature-pack-importer.mjs';
import {
  DEFAULT_CATALOG_PATH,
  loadProductionCreaturePackCatalog,
} from './creature-pack-catalog.mjs';

export async function importProductionCreaturePacks({
  catalogPath = DEFAULT_CATALOG_PATH,
  repositoryRoot,
  importer = importCreaturePack,
} = {}) {
  const catalog = await loadProductionCreaturePackCatalog(catalogPath);
  const imported = [];
  for (const entry of catalog.creatures) {
    imported.push(await importer({ ...entry, repositoryRoot }));
  }
  return imported;
}

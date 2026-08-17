import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertValidCreatureDefinition,
  CREATURE_DEFINITION_SCHEMA,
  CREATURE_DEFINITION_VERSION,
} from '../../src/contracts/CreatureDefinition.js';
import { PRODUCTION_CREATURE_DEFINITIONS } from '../../src/game/creatures/CreatureDefinitionRegistry.js';
import { DEFAULT_REPOSITORY_ROOT } from './creature-pack-importer.mjs';

export const DEFAULT_CREATURE_DEFINITION_DIRECTORY = path.join(DEFAULT_REPOSITORY_ROOT, 'src', 'game', 'creatures', 'data');

async function isFile(filePath) {
  try { return (await stat(filePath)).isFile(); } catch { return false; }
}

export function createCreatureLabDefaultDefinition(pack, { definitionId, displayName } = {}) {
  const approvedClips = pack?.animations?.approvedClips ?? [];
  const definition = {
    schema: CREATURE_DEFINITION_SCHEMA,
    version: CREATURE_DEFINITION_VERSION,
    definitionId,
    displayName,
    creaturePackId: pack.packId,
    voiceProfile: 'male_human',
    collisionProfileId: 'dreadstone.humanoid.current_collision.v1',
    presentation: {
      targetHeight: pack.presentation.rawHeight,
      groundClearance: 0.02,
      rootYaw: Math.PI,
      rootOffset: [0, 0, 0],
      colliderFitNotes: 'Auto-generated Creature Lab starter definition. Review presentation and gameplay tuning before encounter production.',
    },
    movement: { walkReferenceSpeed: 0.72 },
    animation: {
      animationAuthoritative: true,
      restPoseAuthoritative: false,
      authoredAnimationPack: approvedClips.length > 0,
      authoredDeathAnimations: approvedClips.some((clip) => clip.kind === 'DEATH'),
      ignoreEmbeddedAnimations: false,
      holdingPoseMode: 'exported_rest_pose',
      fadeSeconds: 0.12,
      runtimeKinds: [...new Set(approvedClips.map((clip) => clip.kind))],
      selectedAnimationNames: approvedClips.map((clip) => clip.name),
      ignoredEmbeddedAnimationNames: null,
      requireEmbeddedApprovalMetadata: true,
    },
    damage: {
      supportedSegmentIds: [...pack.damage.activeRuntimeSegmentIds],
      compatibilityProgressiveSiteProfileId: null,
      progressiveHitsPerStage: 1,
      maceImpactBlood: false,
    },
    mortality: { terminalProgressiveDamageFatal: false },
    durability: { multiplier: 1, piercingLethalityMultiplier: 1 },
  };
  return assertValidCreatureDefinition(definition);
}

export async function loadFileCreatureDefinitions(definitionDirectory = DEFAULT_CREATURE_DEFINITION_DIRECTORY) {
  let entries = [];
  try { entries = await readdir(definitionDirectory, { withFileTypes: true }); } catch { return []; }
  const definitions = [];
  for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
    const filePath = path.join(definitionDirectory, entry.name);
    const definition = JSON.parse(await readFile(filePath, 'utf8'));
    assertValidCreatureDefinition(definition);
    definitions.push({ filePath, definition });
  }
  return definitions;
}

export async function ensureCreatureLabDefinition(pack, {
  definitionId,
  displayName,
  definitionDirectory = DEFAULT_CREATURE_DEFINITION_DIRECTORY,
  check = false,
} = {}) {
  const explicit = PRODUCTION_CREATURE_DEFINITIONS.find((definition) => definition.creaturePackId === pack.packId);
  if (explicit) return { status: 'EXISTING', definition: explicit, filePath: null, created: false };
  const installed = await loadFileCreatureDefinitions(definitionDirectory);
  const existing = installed.find((entry) => entry.definition.creaturePackId === pack.packId);
  if (existing) return { status: 'EXISTING', ...existing, created: false };
  if (check) throw new Error(`Creature Pack ${pack.packId} has no Creature Lab definition`);

  const definition = createCreatureLabDefaultDefinition(pack, { definitionId, displayName });
  const filePath = path.join(definitionDirectory, `${definition.definitionId}.json`);
  if (await isFile(filePath)) throw new Error(`Creature Definition path already belongs to another pack: ${filePath}`);
  await mkdir(definitionDirectory, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(definition, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
  return { status: 'CREATED', definition, filePath, created: true };
}

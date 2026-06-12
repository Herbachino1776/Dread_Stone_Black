import { buildDungeonCollision } from '../src/engine/dungeon-authoring/DungeonCollisionBuilder.js';
import { validateDungeonDefinition } from '../src/engine/dungeon-authoring/DungeonValidation.js';
import { validateDungeonIntegrity } from '../src/engine/dungeon-authoring/integrity/DungeonIntegrityValidator.js';
import { formatIntegrityIssue } from '../src/engine/dungeon-authoring/integrity/DungeonIntegrityReport.js';
import { buildLightObjectRegistry } from '../src/engine/lighting/LightObjectRegistry.js';
import { validateTorchPlacements } from '../src/engine/lighting/TorchPlacementValidator.js';
import { listLocationDefinitions } from '../src/game/locations/locationRegistry.js';

const definitions = listLocationDefinitions();
const spawnIdsByLocation = new Map(definitions.map((definition) => [
  definition.id,
  new Set((definition.spawns ?? []).map((spawn) => spawn.id)),
]));

function destinationSpawnIdsFor(definition) {
  return new Set((definition.exits ?? [])
    .filter((exit) => exit.toLocation && exit.toLocation !== definition.id)
    .flatMap((exit) => [...(spawnIdsByLocation.get(exit.toLocation) ?? [])]));
}

const targets = definitions
  .filter((definition) => definition.type !== 'field' || definition.integrity?.facades?.length)
  .map((definition) => ({
    label: definition.type === 'field' ? `${definition.displayName} exterior facades` : definition.displayName,
    definition,
  }));

let totalErrors = 0;
let totalWarnings = 0;

console.log('Dungeon integrity validation');

targets.forEach(({ label, definition }) => {
  const baseReport = validateDungeonDefinition(definition, { destinationSpawnIds: destinationSpawnIdsFor(definition) });
  const integrityReport = validateDungeonIntegrity(definition);
  const lightRegistry = buildLightObjectRegistry(definition);
  const torchReport = validateTorchPlacements(definition, lightRegistry.torchFixtures);
  const collision = buildDungeonCollision(definition);
  const compiledWallBlockers = collision.blockerRects.filter((blocker) => blocker.tags?.includes('compiled-wall'));

  const errors = [...baseReport.errors, ...integrityReport.errors, ...torchReport.errors];
  const warnings = [...baseReport.warnings, ...integrityReport.warnings, ...torchReport.warnings];
  totalErrors += errors.length;
  totalWarnings += warnings.length;

  console.log(`\n${label}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Info: ${integrityReport.infos.length}`);
  console.log(`Wall segments: ${integrityReport.debug.wallSegments.length}`);
  console.log(`Declared openings: ${integrityReport.debug.openings.length}`);
  console.log(`Facades: ${integrityReport.debug.facades.length}`);
  console.log(`Compiled wall blockers: ${compiledWallBlockers.length}`);
  console.log(`Torch fixtures: ${lightRegistry.torchFixtures.length}`);

  [...errors, ...warnings].forEach((issue) => {
    const formatted = issue.source ? formatIntegrityIssue(issue) : `${issue.severity ?? 'issue'}: ${issue.id ? `${issue.id}: ` : ''}${issue.message}`;
    console.log(`- ${formatted}`);
    if (issue.suggestedFix) console.log(`  suggested fix: ${issue.suggestedFix}`);
  });
});

console.log(`\nTotal integrity errors: ${totalErrors}`);
console.log(`Total integrity warnings: ${totalWarnings}`);

if (totalErrors) {
  process.exitCode = 1;
}

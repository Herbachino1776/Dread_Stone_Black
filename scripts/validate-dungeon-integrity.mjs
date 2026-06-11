import { validateDungeonIntegrity } from '../src/engine/dungeon-authoring/integrity/DungeonIntegrityValidator.js';
import { formatIntegrityIssue } from '../src/engine/dungeon-authoring/integrity/DungeonIntegrityReport.js';
import { blackGrassTempleDefinition } from '../src/game/locations/blackGrassTemple.definition.js';
import { reliquaryFieldDefinition } from '../src/game/locations/reliquaryField.definition.js';

const targets = [
  { label: 'Black Grass Temple', definition: blackGrassTempleDefinition },
  { label: 'Reliquary Field exterior facades', definition: reliquaryFieldDefinition },
];

let totalErrors = 0;
let totalWarnings = 0;

console.log('Dungeon integrity validation');

targets.forEach(({ label, definition }) => {
  const report = validateDungeonIntegrity(definition);
  totalErrors += report.errors.length;
  totalWarnings += report.warnings.length;

  console.log(`\n${label}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  console.log(`Info: ${report.infos.length}`);
  console.log(`Wall segments: ${report.debug.wallSegments.length}`);
  console.log(`Declared openings: ${report.debug.openings.length}`);
  console.log(`Facades: ${report.debug.facades.length}`);

  [...report.errors, ...report.warnings].forEach((issue) => {
    console.log(`- ${formatIntegrityIssue(issue)}`);
    if (issue.suggestedFix) console.log(`  suggested fix: ${issue.suggestedFix}`);
  });
});

console.log(`\nTotal integrity errors: ${totalErrors}`);
console.log(`Total integrity warnings: ${totalWarnings}`);

if (totalErrors) {
  process.exitCode = 1;
}

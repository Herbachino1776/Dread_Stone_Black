import { validateDungeonDefinition } from '../src/engine/dungeon-authoring/DungeonValidation.js';
import { buildLightObjectRegistry } from '../src/engine/lighting/LightObjectRegistry.js';
import { validateTorchPlacements } from '../src/engine/lighting/TorchPlacementValidator.js';
import { validateObjectiveDefinitions } from '../src/engine/objectives/ObjectiveDefinition.js';
import { blackGrassTempleDefinition } from '../src/game/locations/blackGrassTemple.definition.js';
import { blackGrassTempleObjectives } from '../src/game/objectives/blackGrassTempleObjectives.js';
import { objectiveMessages } from '../src/game/objectives/objectiveMessages.js';
import { equipmentRegistry } from '../src/game/equipment/equipmentRegistry.js';

const rooms = new Set(blackGrassTempleDefinition.rooms.map((room) => room.id));
const interactions = new Set((blackGrassTempleDefinition.interactions ?? []).map((interaction) => interaction.id));
const items = new Set(Object.keys(equipmentRegistry.items ?? {}));
const messages = new Set(Object.keys(objectiveMessages));
const props = new Set((blackGrassTempleDefinition.props ?? []).map((prop) => prop.id));
const spawns = blackGrassTempleDefinition.spawns ?? [];

const destinationSpawnIds = new Set(['field_black_grass_temple_return']);
const dungeonValidation = validateDungeonDefinition(blackGrassTempleDefinition, { destinationSpawnIds });
const lightRegistry = buildLightObjectRegistry(blackGrassTempleDefinition);
const torchValidation = validateTorchPlacements(blackGrassTempleDefinition, lightRegistry.torchFixtures);
const objectiveValidation = validateObjectiveDefinitions(blackGrassTempleObjectives, {
  knownInteractionIds: interactions,
  knownItemIds: items,
  knownMessageIds: messages,
  knownRoomIds: rooms,
});

const errors = [
  ...dungeonValidation.errors,
  ...torchValidation.errors,
  ...objectiveValidation.errors,
];
const warnings = [
  ...dungeonValidation.warnings,
  ...torchValidation.warnings,
  ...objectiveValidation.warnings,
];

const requiredChecks = [
  {
    ok: interactions.has('BGT_INT_RUSTED_SWORD_CHEST'),
    message: 'missing rusted sword chest interaction BGT_INT_RUSTED_SWORD_CHEST',
  },
  {
    ok: props.has('BGT-P16-rusted-sword-chest-placeholder'),
    message: 'missing rusted sword chest prop BGT-P16-rusted-sword-chest-placeholder',
  },
  {
    ok: items.has('rusted_sword'),
    message: 'missing rusted_sword item in equipment registry',
  },
  {
    ok: spawns.some((spawn) => spawn.kind === 'player' && spawn.roomId === 'R01'),
    message: 'missing BGT player spawn in entry room R01',
  },
  {
    ok: (blackGrassTempleDefinition.exits ?? []).some((exit) => exit.id === 'bgt_exit_to_reliquary_field'),
    message: 'missing BGT return exit to Reliquary Field',
  },
  {
    ok: (blackGrassTempleDefinition.encounterZones ?? []).every((zone) => (zone.roomIds ?? []).every((roomId) => rooms.has(roomId))),
    message: 'one or more encounter zones reference missing rooms',
  },
  {
    ok: blackGrassTempleObjectives.every((objective) => objective.silent === true && objective.visible === false),
    message: 'BGT objectives must remain silent and hidden in normal gameplay',
  },
  {
    ok: blackGrassTempleObjectives.every((objective) => [
      ...(objective.actionsOnStart ?? []),
      ...(objective.actionsOnComplete ?? []),
      ...(objective.steps ?? []).flatMap((step) => [...(step.actionsOnStart ?? []), ...(step.actionsOnComplete ?? [])]),
    ].every((action) => !['showToast', 'showLocationMessage', 'markObjectiveVisible'].includes(action.type))),
    message: 'BGT objectives must not include production-facing objective text actions',
  },
  {
    ok: (blackGrassTempleDefinition.interactions ?? []).every((interaction) => (
      !interaction.id.startsWith('BGT_')
      || [interaction.hint, interaction.message, interaction.acquiredMessage, interaction.repeatHint, interaction.repeatMessage]
        .every((value) => value === undefined || value === null || value === '')
    )),
    message: 'BGT interactions must not author visible hint/message copy',
  },
  {
    ok: (blackGrassTempleDefinition.interactions ?? []).find((interaction) => interaction.id === 'BGT_INT_RUSTED_SWORD_CHEST')?.autoEquip === true,
    message: 'rusted sword chest should silently auto-equip for non-text feedback',
  },
];

requiredChecks.forEach((check) => {
  if (!check.ok) errors.push({ severity: 'error', message: check.message, id: 'bgt-required-check' });
});

function printIssues(label, issues) {
  if (!issues.length) {
    console.log(`${label}: 0`);
    return;
  }
  console.log(`${label}: ${issues.length}`);
  issues.forEach((issue) => {
    console.log(`- ${issue.severity ?? label.toLowerCase()}: ${issue.id ? `${issue.id}: ` : ''}${issue.message}`);
  });
}

console.log('Black Grass Temple validation');
printIssues('Errors', errors);
printIssues('Warnings', warnings);
console.log(`Rooms: ${rooms.size}`);
console.log(`Torch fixtures: ${lightRegistry.torchFixtures.length}`);
console.log(`Objective definitions: ${blackGrassTempleObjectives.length}`);

if (errors.length) {
  process.exitCode = 1;
}

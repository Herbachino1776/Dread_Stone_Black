import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertValidCreatureDefinition,
  CREATURE_DEFINITION_SCHEMA,
  CREATURE_DEFINITION_TECHNICAL_FIELDS,
  validateCreatureDefinition,
} from '../src/contracts/CreatureDefinition.js';
import {
  CHEZWICK_CREATURE_DEFINITION,
  CreatureDefinitionRegistry,
  CreatureDefinitionRegistryError,
  DREADGUARD_CREATURE_DEFINITION,
  DREAD_RAM_GOD_CREATURE_DEFINITION,
  DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES,
} from '../src/game/creatures/CreatureDefinitionRegistry.js';
import { CreatureFactory, CreatureFactoryError } from '../src/game/creatures/CreatureFactory.js';

const descriptorPaths = new Map([
  ['chezwick_damage_v001', new URL('../public/generated/creature-packs/chezwick_damage_v001.json', import.meta.url)],
  ['dreadguard_damage_v001', new URL('../public/generated/creature-packs/dreadguard_damage_v001.json', import.meta.url)],
  ['dread_ram_god_damage_v001', new URL('../public/generated/creature-packs/dread_ram_god_damage_v001.json', import.meta.url)],
]);

async function loadProductionPacks() {
  return new Map(await Promise.all([...descriptorPaths].map(async ([packId, url]) => [
    packId,
    JSON.parse(await readFile(url, 'utf8')),
  ])));
}

function packRegistryFrom(packs) {
  return {
    async loadPack(packId) {
      if (!packs.has(packId)) {
        const error = new Error(`No registered Creature Pack has packId "${packId}".`);
        error.code = 'UNKNOWN_PACK';
        throw error;
      }
      return packs.get(packId);
    },
  };
}

function collectFieldNames(value, result = new Set()) {
  if (Array.isArray(value)) value.forEach((entry) => collectFieldNames(entry, result));
  else if (value != null && typeof value === 'object') Object.entries(value).forEach(([key, entry]) => {
    result.add(key);
    collectFieldNames(entry, result);
  });
  return result;
}

test('dreadstone.creature_definition.v1 validates production definitions and rejects malformed gameplay policy', () => {
  for (const definition of [CHEZWICK_CREATURE_DEFINITION, DREADGUARD_CREATURE_DEFINITION, DREAD_RAM_GOD_CREATURE_DEFINITION]) {
    assert.equal(definition.schema, CREATURE_DEFINITION_SCHEMA);
    assert.equal(validateCreatureDefinition(definition).valid, true);
    assert.equal(assertValidCreatureDefinition(definition), definition);
  }

  const invalid = structuredClone(CHEZWICK_CREATURE_DEFINITION);
  invalid.definitionId = 'Chezwick Definition';
  invalid.presentation.targetHeight = -1;
  invalid.assetPath = './must-not-live-here.glb';
  const validation = validateCreatureDefinition(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.startsWith('definitionId')));
  assert.ok(validation.errors.some((error) => error.startsWith('presentation.targetHeight')));
  assert.ok(validation.errors.some((error) => error.includes('assetPath')));
  assert.throws(() => assertValidCreatureDefinition(invalid), /Invalid dreadstone\.creature_definition\.v1/);
});

test('definition registry validates entries, resolves stable IDs, and fails missing definitions', () => {
  const registry = new CreatureDefinitionRegistry();
  assert.deepEqual(registry.listDefinitions().map((definition) => definition.definitionId), ['chezwick', 'dreadguard', 'dread_ram_god']);
  assert.equal(registry.getDefinition('chezwick').creaturePackId, 'chezwick_damage_v001');
  assert.equal(registry.hasDefinition('dread_ram_god'), true);
  assert.throws(
    () => registry.getDefinition('missing_definition'),
    (error) => error instanceof CreatureDefinitionRegistryError && error.code === 'UNKNOWN_DEFINITION',
  );

  const invalid = structuredClone(CHEZWICK_CREATURE_DEFINITION);
  invalid.animation.selectedAnimationNames = ['duplicate', 'duplicate'];
  assert.throws(
    () => new CreatureDefinitionRegistry({ definitions: [invalid] }),
    (error) => error instanceof CreatureDefinitionRegistryError && error.code === 'INVALID_DEFINITION',
  );
});

test('definitions reference pack truth without copying Forge technical fields', () => {
  for (const definition of new CreatureDefinitionRegistry().listDefinitions()) {
    const fieldNames = collectFieldNames(definition);
    CREATURE_DEFINITION_TECHNICAL_FIELDS.forEach((field) => {
      assert.equal(fieldNames.has(field), false, `${definition.definitionId} must not own ${field}`);
    });
    assert.ok(definition.creaturePackId.endsWith('_v001'));
    assert.ok(definition.damage.supportedSegmentIds.length > 0);
    assert.ok(definition.animation.selectedAnimationNames.length > 0);
  }
});

test('Creature Factory reports missing definitions and missing packs before actor construction', async () => {
  const packs = await loadProductionPacks();
  const factory = new CreatureFactory({
    creaturePackRegistry: packRegistryFrom(packs),
    actorConstructor: class TestActor {},
  });
  await assert.rejects(
    factory.resolve('missing_definition'),
    (error) => error instanceof CreatureFactoryError && error.code === 'UNKNOWN_DEFINITION',
  );

  const missingPackDefinition = structuredClone(CHEZWICK_CREATURE_DEFINITION);
  missingPackDefinition.definitionId = 'missing_pack_fixture';
  missingPackDefinition.displayName = 'Missing Pack Fixture';
  missingPackDefinition.creaturePackId = 'missing_pack_v001';
  const missingPackFactory = new CreatureFactory({
    definitionRegistry: new CreatureDefinitionRegistry({ definitions: [missingPackDefinition] }),
    creaturePackRegistry: packRegistryFrom(packs),
    actorConstructor: class TestActor {},
  });
  await assert.rejects(
    missingPackFactory.resolve('missing_pack_fixture'),
    (error) => error instanceof CreatureFactoryError && error.code === 'MISSING_PACK' && /missing_pack_v001/.test(error.message),
  );
});

test('Creature Factory composes and constructs all three definitions through the current actor profile shape', async () => {
  const packs = await loadProductionPacks();
  class TestActor {
    constructor(options) { this.options = options; this.visualProfile = options.visualProfile; }
  }
  const factory = new CreatureFactory({
    creaturePackRegistry: packRegistryFrom(packs),
    actorConstructor: TestActor,
  });

  for (const definition of new CreatureDefinitionRegistry().listDefinitions()) {
    const resolved = await factory.resolve(definition.definitionId);
    assert.equal(resolved.definition.definitionId, definition.definitionId);
    assert.equal(resolved.pack.packId, definition.creaturePackId);
    assert.equal(resolved.profile.creatureDefinitionId, definition.definitionId);
    assert.equal(resolved.profile.creaturePackId, definition.creaturePackId);
    assert.equal(resolved.profile.assetPath, resolved.pack.assets.glb);
    assert.equal(resolved.profile.damageManifestPath, resolved.pack.assets.damageManifest);
    assert.equal(resolved.profile.rawHeight, resolved.pack.presentation.rawHeight);
    assert.equal(resolved.profile.targetHeight, definition.presentation.targetHeight);
    assert.deepEqual(resolved.profile.activeDamageSegmentIds, definition.damage.supportedSegmentIds);
    const created = factory.createActorFromResolved(resolved, { fixture: definition.definitionId });
    assert.ok(created.actor instanceof TestActor);
    assert.equal(created.actor.options.fixture, definition.definitionId);
    assert.equal(created.actor.visualProfile, resolved.profile);
  }
});

test('generic factory and core combat actor contain no production creature branching', async () => {
  const sources = await Promise.all([
    readFile(new URL('../src/game/creatures/CreatureFactory.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/game/combat/HumanoidCombatActor.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/game/combat/HumanoidCombatActorBase.js', import.meta.url), 'utf8'),
  ]);
  const [factorySource, actorSource, actorBaseSource] = sources.map((source) => source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, ''));
  for (const identity of ['chezwick', 'dreadguard', 'dread_ram_god']) {
    assert.equal(factorySource.toLowerCase().includes(identity), false, `factory must not branch on ${identity}`);
    assert.equal(actorSource.toLowerCase().includes(identity), false, `actor must not branch on ${identity}`);
    assert.equal(actorBaseSource.toLowerCase().includes(identity), false, `actor base must not branch on ${identity}`);
  }
});

test('Dread Ram God definition preserves animation and progressive-damage policy at 1.7 meters', async () => {
  const packs = await loadProductionPacks();
  const factory = new CreatureFactory({
    creaturePackRegistry: packRegistryFrom(packs),
    actorConstructor: class TestActor {},
  });
  const { definition, pack, profile } = await factory.resolve('dread_ram_god');
  assert.equal(definition.presentation.targetHeight, 1.7);
  assert.equal(profile.targetHeight, 1.7);
  assert.deepEqual(definition.animation.selectedAnimationNames, DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES);
  assert.deepEqual(definition.animation.runtimeKinds, ['IDLE', 'WALK', 'HURT_LEFT', 'HURT_RIGHT', 'DEATH']);
  assert.equal(definition.animation.runtimeKinds.some((kind) => kind.startsWith('MACE_GUARD_')), false);
  assert.equal(pack.damage.progressiveDamageSiteIds.length, 4);
  assert.equal(profile.progressiveDamageSiteFallbacks.length, 0);
  assert.equal(profile.progressiveDamageHitsPerStage, 1);
  assert.equal(profile.terminalProgressiveDamageFatal, false);
  assert.deepEqual(profile.activeDamageSegmentIds, ['head_neck', 'left_elbow', 'right_elbow']);
  assert.equal(pack.damage.availableSegmentIds.includes('lower_spine'), true);
  assert.equal(profile.activeDamageSegmentIds.includes('lower_spine'), false);
});

test('one Creature Pack can resolve through multiple definitions without changing technical body truth', async () => {
  const packs = await loadProductionPacks();
  const alternate = structuredClone(CHEZWICK_CREATURE_DEFINITION);
  alternate.definitionId = 'chezwick_tall_fixture';
  alternate.displayName = 'Chezwick Tall Fixture';
  alternate.presentation.targetHeight = 1.8;
  alternate.damage.progressiveHitsPerStage = 1;
  const factory = new CreatureFactory({
    definitionRegistry: new CreatureDefinitionRegistry({ definitions: [CHEZWICK_CREATURE_DEFINITION, alternate] }),
    creaturePackRegistry: packRegistryFrom(packs),
    actorConstructor: class TestActor {},
  });
  const baseline = await factory.resolve('chezwick');
  const variant = await factory.resolve('chezwick_tall_fixture');
  assert.equal(baseline.pack, variant.pack);
  assert.equal(baseline.definition.creaturePackId, variant.definition.creaturePackId);
  assert.equal(baseline.profile.assetPath, variant.profile.assetPath);
  assert.equal(baseline.profile.damageManifestPath, variant.profile.damageManifestPath);
  assert.equal(baseline.profile.rawHeight, variant.profile.rawHeight);
  assert.equal(baseline.profile.targetHeight, 1.5);
  assert.equal(variant.profile.targetHeight, 1.8);
  assert.equal(baseline.profile.progressiveDamageHitsPerStage, 2);
  assert.equal(variant.profile.progressiveDamageHitsPerStage, 1);
});

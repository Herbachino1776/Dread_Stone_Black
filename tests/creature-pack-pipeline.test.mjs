import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertValidCreaturePack,
  CREATURE_PACK_SCHEMA,
  validateCreaturePack,
  validateCreaturePackRegistry,
} from '../src/contracts/CreaturePack.js';
import {
  createCreaturePackRegistry,
  DEFAULT_GENERATED_DIRECTORY,
  DEFAULT_REPOSITORY_ROOT,
  importCreaturePack,
  serializeGeneratedJson,
} from '../scripts/lib/creature-pack-importer.mjs';
import { loadProductionCreaturePackCatalog } from '../scripts/lib/creature-pack-catalog.mjs';
import {
  CHEZWICK_DAMAGE_COMBAT_PROFILE,
  DREADGUARD_DAMAGE_COMBAT_PROFILE,
} from '../src/game/combat/HumanoidModelProfiles.js';
import {
  CREATURE_PACK_TECHNICAL_PROFILE_FIELDS,
  assessCreaturePackRuntimeSupport,
  composeHumanoidCreatureRuntimeProfile,
} from '../src/game/creatures/CreatureRuntimePolicies.js';
import {
  DREAD_RAM_GOD_CREATURE_DEFINITION,
  DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES,
} from '../src/game/creatures/CreatureDefinitionRegistry.js';

const dreadguardSource = path.join(DEFAULT_REPOSITORY_ROOT, 'public/assets/enemies/dreadguard/damage');
const chezwickSource = path.join(DEFAULT_REPOSITORY_ROOT, 'public/assets/enemies/chezwick/damage');
const dreadguardManifestPath = path.join(dreadguardSource, 'dreadguard_damage_v001.json');
const dreadguardGlbPath = path.join(dreadguardSource, 'dreadguard_damage_v001.glb');
const dreadguardReportPath = path.join(dreadguardSource, 'dreadguard_damage_v001_validation.json');
const chezwickManifestPath = path.join(chezwickSource, 'chezwick_v001.json');
const chezwickGlbPath = path.join(chezwickSource, 'chezwick_v001.glb');
const chezwickReportPath = path.join(chezwickSource, 'chezwick_v001_validation.json');
const dreadRamGodSource = path.join(DEFAULT_REPOSITORY_ROOT, 'public/assets/enemies/dread_ram_god/damage');
const dreadRamGodManifestPath = path.join(dreadRamGodSource, 'Dread_Ram_God.json');
const dreadRamGodGlbPath = path.join(dreadRamGodSource, 'Dread_Ram_God.glb');
const dreadRamGodReportPath = path.join(dreadRamGodSource, 'Dread_Ram_God_validation.json');
const DREAD_RAM_GOD_OFFENSIVE_ACTION_NAME = 'DSB_Attack_Overhead_OneHand_v001';

let productionPacksPromise = null;
function loadProductionPacks() {
  productionPacksPromise ??= loadProductionCreaturePackCatalog().then((catalog) => Promise.all(catalog.creatures.map((fixture) => importCreaturePack({
    ...fixture,
    repositoryRoot: DEFAULT_REPOSITORY_ROOT,
  }))));
  return productionPacksPromise;
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'dreadstone-creature-pack-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('dreadstone.creature_pack.v1 schema accepts generated packs and rejects malformed descriptors', async () => {
  const [chezwick] = await loadProductionPacks();
  assert.equal(chezwick.schema, CREATURE_PACK_SCHEMA);
  assert.equal(validateCreaturePack(chezwick).valid, true);
  assert.equal(assertValidCreaturePack(chezwick), chezwick);

  const invalid = structuredClone(chezwick);
  invalid.packId = 'Chezwick Damage';
  invalid.presentation.rawBounds.size = [1, Number.NaN, 1];
  invalid.capabilities.gore = 'yes';
  const result = validateCreaturePack(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('packId')));
  assert.ok(result.errors.some((error) => error.startsWith('presentation.rawBounds.size')));
  assert.ok(result.errors.some((error) => error.startsWith('capabilities.gore')));
  assert.throws(() => assertValidCreaturePack(invalid), /Invalid dreadstone\.creature_pack\.v1/);

  const driftedCapability = structuredClone(chezwick);
  driftedCapability.capabilities.attachmentSockets = true;
  const driftResult = validateCreaturePack(driftedCapability);
  assert.ok(driftResult.errors.some((error) => error === 'capabilities.attachmentSockets must match attachmentSockets.available'));
});

test('Dreadguard production bundle imports through Forge and runtime validators', async () => {
  const packs = await loadProductionPacks();
  const pack = packs.find((entry) => entry.packId === 'dreadguard_damage_v001');
  assert.ok(pack);
  assert.equal(pack.assets.glb, './assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb');
  assert.equal(pack.assets.animationManifest, './assets/enemies/dreadguard/animations/dreadguard_animpack_v003.json');
  assert.equal(pack.capabilities.progressiveDamage, false, 'disabled Forge draft sites are not promoted into native pack truth');
  assert.equal(pack.capabilities.separatelyValidatedAnimations, true);
  assert.equal(pack.cost.glbFileBytes, 10907460);
  assert.equal(pack.cost.deformationKeyCount, 3);
  assert.equal(pack.cost.generatedGoreMeshCount, 10);
  assert.equal(pack.cost.stainMeshCount, 6);
  assert.equal(pack.cost.approvedAnimationCount, 7);
  assert.deepEqual(pack.damage.activeRuntimeSegmentIds, ['head_neck', 'left_elbow', 'right_elbow']);
  assert.ok(pack.importDiagnostics.some((entry) => entry.code === 'FORGE_PROGRESSIVE_SITES_NOT_EXPORTED'));
});

test('Chezwick production bundle imports native right-face truth without copying the left compatibility site', async () => {
  const packs = await loadProductionPacks();
  const pack = packs.find((entry) => entry.packId === 'chezwick_damage_v001');
  assert.ok(pack);
  assert.equal(pack.assets.glb, './assets/enemies/chezwick/damage/chezwick_v001.glb');
  assert.equal(pack.assets.animationManifest, null);
  assert.equal(pack.capabilities.progressiveDamage, true);
  assert.equal(pack.capabilities.separatelyValidatedAnimations, false);
  assert.deepEqual(pack.damage.progressiveDamageSiteIds, ['damage_site_face_right']);
  assert.equal(pack.cost.animationCount, 12);
  assert.equal(pack.cost.approvedAnimationCount, 7);
  assert.equal(pack.animations.unapprovedClipCount, 5);
  assert.ok(pack.importDiagnostics.some((entry) => entry.code === 'CASE_INSENSITIVE_GLB_NAME_MATCH'));
  assert.ok(!serializeGeneratedJson(pack).includes('damage_site_face_left_compatibility'));
});

test('legacy production packs remain valid without Forge M6 armament capabilities', async () => {
  const packs = await loadProductionPacks();
  for (const packId of ['chezwick_damage_v001', 'dreadguard_damage_v001']) {
    const pack = packs.find((entry) => entry.packId === packId);
    assert.ok(pack, `${packId} must remain registered`);
    assert.equal(validateCreaturePack(pack).valid, true);
    assert.equal(pack.capabilities.attachmentSockets, false);
    assert.equal(pack.capabilities.offensiveActions, false);
    assert.equal(pack.attachmentSockets.available, false);
    assert.equal(pack.offensiveActions.available, false);
    const diagnosticCodes = pack.importDiagnostics.map((entry) => entry.code);
    assert.ok(diagnosticCodes.includes('FORGE_ATTACHMENT_SOCKETS_UNAVAILABLE'));
    assert.ok(diagnosticCodes.includes('FORGE_OFFENSIVE_ACTIONS_UNAVAILABLE'));
  }
});

test('Dread Ram God production bundle imports all Forge-authored technical truth', async () => {
  const packs = await loadProductionPacks();
  const pack = packs.find((entry) => entry.packId === 'dread_ram_god_damage_v001');
  assert.ok(pack);
  assert.equal(pack.displayName, 'Dread Ram God');
  assert.equal(pack.assets.glb, './assets/enemies/dread_ram_god/damage/Dread_Ram_God.glb');
  assert.equal(pack.assets.damageManifest, './assets/enemies/dread_ram_god/damage/Dread_Ram_God.json');
  assert.equal(pack.assets.damageValidationReport, './assets/enemies/dread_ram_god/damage/Dread_Ram_God_validation.json');
  assert.equal(pack.assets.animationManifest, null);
  assert.equal(pack.presentation.skeletonFamilyId, 'DSB_HUMANOID_V1');
  assert.deepEqual(pack.presentation.runtimeSkeleton, {
    schema: 'dreadstone.runtime_skeleton.v1',
    armature: 'DSB_DAMAGE_RIG',
    skeletonCount: 1,
    skinCount: 1,
    requiredBoneCount: 21,
  });
  assert.equal(pack.cost.progressiveSiteCount, 4);
  assert.equal(pack.cost.deformationKeyCount, 12);
  assert.equal(pack.cost.generatedGoreMeshCount, 15);
  assert.equal(pack.cost.stainMeshCount, 12);
  assert.deepEqual(pack.damage.availableSegmentIds, ['head_neck', 'left_elbow', 'lower_spine', 'right_elbow']);
  assert.deepEqual(pack.damage.activeRuntimeSegmentIds, ['head_neck', 'left_elbow', 'right_elbow']);
  assert.deepEqual(pack.damage.progressiveDamageSiteIds, [
    'damage_site',
    'damage_site_left_body',
    'damage_site_left_body_2',
    'damage_site_left_face',
  ]);
  assert.equal(pack.animations.delivery, 'embedded');
  assert.equal(pack.animations.manifestValidated, false);
  assert.equal(pack.cost.animationCount, 7);
  assert.equal(pack.cost.approvedAnimationCount, 7);
  assert.equal(pack.animations.approvedClips.length, 7);
  assert.equal(pack.animations.unapprovedClipCount, 0, 'source-only animations are absent');
  const approvedNames = new Set(pack.animations.approvedClips.map((clip) => clip.name));
  assert.ok(DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES.every((name) => approvedNames.has(name)), 'every Creature Definition-selected animation remains approved');
  assert.deepEqual(
    [...approvedNames].filter((name) => !DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES.includes(name)),
    [DREAD_RAM_GOD_OFFENSIVE_ACTION_NAME],
    'the only additional approved clip is the Forge offensive Action',
  );
  assert.equal(pack.capabilities.attachmentSockets, true);
  assert.equal(pack.capabilities.offensiveActions, true);
  assert.equal(pack.attachmentSockets.available, true);
  assert.equal(pack.attachmentSockets.sockets.length, 2);
  const socketsByRole = new Map(pack.attachmentSockets.sockets.map((socket) => [socket.semanticRole, socket]));
  assert.equal(socketsByRole.get('MAIN_HAND_R')?.parentRuntimeBone, 'arm_right_hand');
  assert.equal(socketsByRole.get('MAIN_HAND_L')?.parentRuntimeBone, 'arm_left_hand');
  assert.equal(pack.offensiveActions.available, true);
  assert.equal(pack.offensiveActions.actions.length, 1);
  const [overheadAction] = pack.offensiveActions.actions;
  assert.equal(overheadAction.actionName, DREAD_RAM_GOD_OFFENSIVE_ACTION_NAME);
  assert.equal(overheadAction.combatActionId, 'humanoid_one_hand_overhead');
  assert.equal(overheadAction.socketRole, 'MAIN_HAND_R');
  assert.deepEqual(overheadAction.compatibleWeaponClasses, ['ONE_HAND_BLADE', 'ONE_HAND_BLUNT']);
  assert.equal(overheadAction.clipDurationSeconds, 1.958333);
  assert.deepEqual(overheadAction.phases, {
    active: { endSeconds: 1.625, startSeconds: 1.5 },
    recovery: { endSeconds: 1.958333, startSeconds: 1.625 },
    windup: { endSeconds: 1.5, startSeconds: 0 },
  });
  const diagnosticCodes = pack.importDiagnostics.map((entry) => entry.code);
  assert.equal(diagnosticCodes.includes('FORGE_ATTACHMENT_SOCKETS_UNAVAILABLE'), false);
  assert.equal(diagnosticCodes.includes('FORGE_OFFENSIVE_ACTIONS_UNAVAILABLE'), false);

  const repeated = await importCreaturePack({
    packId: 'dread_ram_god_damage_v001',
    displayName: 'Dread Ram God',
    sourceDir: dreadRamGodSource,
    repositoryRoot: DEFAULT_REPOSITORY_ROOT,
  });
  assert.equal(serializeGeneratedJson(repeated), serializeGeneratedJson(pack));
});

test('Dread Ram God definition composes without duplicating Forge truth', async () => {
  const pack = (await loadProductionPacks()).find((entry) => entry.packId === 'dread_ram_god_damage_v001');
  const definition = DREAD_RAM_GOD_CREATURE_DEFINITION;
  const support = assessCreaturePackRuntimeSupport(pack, definition);
  assert.deepEqual(support, { supported: true, reason: null, code: 'SUPPORTED' });
  assert.equal(definition.damage.compatibilityProgressiveSiteProfileId, null);
  assert.equal(definition.damage.progressiveHitsPerStage, 1);
  assert.equal(definition.mortality.terminalProgressiveDamageFatal, false);
  assert.deepEqual(definition.damage.supportedSegmentIds, ['head_neck', 'left_elbow', 'right_elbow']);
  assert.equal(pack.damage.availableSegmentIds.includes('lower_spine'), true);
  assert.equal(definition.damage.supportedSegmentIds.includes('lower_spine'), false);
  assert.deepEqual(definition.animation.runtimeKinds, ['IDLE', 'WALK', 'HURT_LEFT', 'HURT_RIGHT', 'DEATH']);
  assert.deepEqual(definition.animation.selectedAnimationNames, DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES);
  assert.equal(definition.animation.selectedAnimationNames.includes(DREAD_RAM_GOD_OFFENSIVE_ACTION_NAME), false);
  assert.equal(pack.offensiveActions.actions.some((action) => action.actionName === DREAD_RAM_GOD_OFFENSIVE_ACTION_NAME), true);
  CREATURE_PACK_TECHNICAL_PROFILE_FIELDS.forEach((field) => assert.equal(field in definition, false, `${field} must remain descriptor-owned`));
  const profile = composeHumanoidCreatureRuntimeProfile(pack, definition);
  assert.equal(profile.embeddedAnimationPack, true);
  assert.deepEqual(profile.embeddedAnimationNames, [
    ...DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES,
    DREAD_RAM_GOD_OFFENSIVE_ACTION_NAME,
  ]);
  assert.equal(profile.animationRuntimeKinds.includes('ATTACK_OVERHEAD_ONE_HAND'), true);
  assert.deepEqual(profile.progressiveDamageSiteFallbacks, []);
});

test('import rejects a missing GLB with an actionable bundle error', async (t) => {
  const directory = await temporaryDirectory(t);
  const manifest = JSON.parse(await readFile(dreadguardManifestPath, 'utf8'));
  manifest.glb = 'missing_damage.glb';
  await writeFile(path.join(directory, 'fixture.json'), JSON.stringify(manifest), 'utf8');
  await assert.rejects(
    importCreaturePack({ packId: 'missing_glb_fixture', sourceDir: directory }),
    /damage GLB is missing.*missing_damage\.glb/,
  );
});

test('import rejects a missing damage manifest before attempting GLB parsing', async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFile(path.join(directory, 'orphan.glb'), 'not-a-real-glb', 'utf8');
  await assert.rejects(
    importCreaturePack({ packId: 'missing_manifest_fixture', sourceDir: directory }),
    /damage manifest is missing.*dreadstone\.damage_authoring\.v1/,
  );
});

test('import rejects a Forge validation report whose status is FAIL', async (t) => {
  const directory = await temporaryDirectory(t);
  const report = JSON.parse(await readFile(dreadguardReportPath, 'utf8'));
  report.status = 'FAIL';
  report.errors = ['fixture failure'];
  const reportPath = path.join(directory, 'failed_validation.json');
  await writeFile(reportPath, JSON.stringify(report), 'utf8');
  await assert.rejects(
    importCreaturePack({
      packId: 'failed_report_fixture',
      sourceDir: dreadguardSource,
      glbPath: dreadguardGlbPath,
      manifestPath: dreadguardManifestPath,
      validationReportPath: reportPath,
    }),
    /validation report status must be PASS, received FAIL/,
  );
});

test('import rejects mismatched source identity and fingerprints', async (t) => {
  const directory = await temporaryDirectory(t);
  const report = JSON.parse(await readFile(dreadguardReportPath, 'utf8'));
  report.source_topology_sha256 = '0'.repeat(64);
  const reportPath = path.join(directory, 'mismatched_validation.json');
  await writeFile(reportPath, JSON.stringify(report), 'utf8');
  await assert.rejects(
    importCreaturePack({
      packId: 'mismatched_fingerprint_fixture',
      sourceDir: dreadguardSource,
      glbPath: dreadguardGlbPath,
      manifestPath: dreadguardManifestPath,
      validationReportPath: reportPath,
    }),
    /source topology fingerprint does not match/,
  );
});

test('import rejects a Forge runtime-skeleton count that disagrees with the manifest', async (t) => {
  const directory = await temporaryDirectory(t);
  const report = JSON.parse(await readFile(dreadRamGodReportPath, 'utf8'));
  report.runtimeSkeleton.skeletonCount = 2;
  const reportPath = path.join(directory, 'mismatched_runtime_skeleton_validation.json');
  await writeFile(reportPath, JSON.stringify(report), 'utf8');
  await assert.rejects(
    importCreaturePack({
      packId: 'mismatched_runtime_skeleton_fixture',
      sourceDir: dreadRamGodSource,
      glbPath: dreadRamGodGlbPath,
      manifestPath: dreadRamGodManifestPath,
      validationReportPath: reportPath,
    }),
    /runtime skeleton count does not match/,
  );
});

test('import rejects malformed progressive site records without fixing the Forge export', async (t) => {
  const directory = await temporaryDirectory(t);
  const manifest = JSON.parse(await readFile(chezwickManifestPath, 'utf8'));
  manifest.deformations.progressiveDamageSites[0].severityAnchors.medium = 0.2;
  const manifestPath = path.join(directory, 'malformed_progressive.json');
  await writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
  await assert.rejects(
    importCreaturePack({
      packId: 'malformed_progressive_fixture',
      sourceDir: chezwickSource,
      glbPath: chezwickGlbPath,
      manifestPath,
      validationReportPath: chezwickReportPath,
    }),
    /stage MEDIUM has invalid severity anchor/,
  );
});

test('registry and descriptor output are deterministic and match committed generated files', async () => {
  const normalizeLineEndings = (value) => value.replace(/\r\n/g, '\n');
  const packs = await loadProductionPacks();
  const first = createCreaturePackRegistry(packs, { repositoryRoot: DEFAULT_REPOSITORY_ROOT, generatedDirectory: DEFAULT_GENERATED_DIRECTORY });
  const second = createCreaturePackRegistry([...packs].reverse(), { repositoryRoot: DEFAULT_REPOSITORY_ROOT, generatedDirectory: DEFAULT_GENERATED_DIRECTORY });
  assert.equal(serializeGeneratedJson(first), serializeGeneratedJson(second));
  assert.equal(validateCreaturePackRegistry(first).valid, true);
  assert.deepEqual(first.packs.map((entry) => entry.packId), ['chezwick_damage_v001', 'dread_ram_god_damage_v001', 'dreadguard_damage_v001']);
  assert.equal(normalizeLineEndings(await readFile(path.join(DEFAULT_GENERATED_DIRECTORY, 'index.json'), 'utf8')), serializeGeneratedJson(first));
  for (const pack of packs) {
    assert.equal(normalizeLineEndings(await readFile(path.join(DEFAULT_GENERATED_DIRECTORY, `${pack.packId}.json`), 'utf8')), serializeGeneratedJson(pack));
  }

  const catalog = await loadProductionCreaturePackCatalog();
  const repeated = await importCreaturePack({
    ...catalog.creatures.find((entry) => entry.packId === 'dreadguard_damage_v001'),
    repositoryRoot: DEFAULT_REPOSITORY_ROOT,
  });
  const original = packs.find((entry) => entry.packId === repeated.packId);
  assert.equal(serializeGeneratedJson(repeated), serializeGeneratedJson(original));
});

test('generated packs agree with legacy profiles on shared export truth while gameplay tuning remains hand-authored', async () => {
  const packs = await loadProductionPacks();
  const cases = [
    [packs.find((entry) => entry.packId === 'dreadguard_damage_v001'), DREADGUARD_DAMAGE_COMBAT_PROFILE],
    [packs.find((entry) => entry.packId === 'chezwick_damage_v001'), CHEZWICK_DAMAGE_COMBAT_PROFILE],
  ];
  for (const [pack, profile] of cases) {
    assert.equal(pack.assets.glb, profile.assetPath);
    assert.equal(pack.assets.damageManifest, profile.damageManifestPath);
    assert.equal(pack.assets.damageValidationReport, profile.damageValidationReportPath);
    assert.equal(pack.assets.animationManifest, profile.animationManifestPath);
    assert.equal(pack.assets.animationValidationReport, profile.animationValidationReportPath);
    assert.equal(pack.source.topologyFingerprint, profile.damageTopologyFingerprint);
    assert.equal(pack.source.weightFingerprint, profile.damageWeightFingerprint);
    assert.equal(pack.authoring.damageVersion, profile.damageAuthoringVersion);
    assert.equal(pack.authoring.damageBuildId, profile.damageAuthoringBuildId);
    assert.ok(Math.abs(pack.presentation.rawHeight - profile.rawHeight) < 0.000001);
    assert.equal(pack.presentation.authoredForwardAxis, profile.authoredForwardAxis);
    assert.deepEqual(pack.damage.activeRuntimeSegmentIds, [...profile.activeDamageSegmentIds].sort());
    const approvedNames = new Set(pack.animations.approvedClips.map((clip) => clip.name));
    assert.ok(profile.damageExpectedAnimationNames.every((name) => approvedNames.has(name)));
  }

  for (const forbidden of ['hostility', 'faction', 'health', 'damageMultipliers', 'ai', 'morale', 'loot', 'dialogue', 'questState', 'persistenceState']) {
    assert.ok(packs.every((pack) => !(forbidden in pack)), `${forbidden} remains outside the Creature Pack contract`);
  }
  const dreadguard = cases[0][0];
  const chezwick = cases[1][0];
  assert.equal(dreadguard.capabilities.progressiveDamage, false);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.progressiveDamageSiteFallbacks.length, 1);
  assert.deepEqual(chezwick.damage.progressiveDamageSiteIds, ['damage_site_face_right']);
  assert.equal(CHEZWICK_DAMAGE_COMBAT_PROFILE.progressiveDamageSiteFallbacks.length, 1);
});

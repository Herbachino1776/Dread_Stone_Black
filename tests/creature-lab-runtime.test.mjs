import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CollisionWorld } from '../src/game/Collision.js';
import { FolsomCombatEncounter } from '../src/game/combat/FolsomCombatEncounter.js';
import { validateDamageAsset } from '../src/game/combat/HumanoidDamageSegmentRuntime.js';
import { validateForgeDamageDeformationAsset } from '../src/game/combat/ForgeDamageDeformationRuntime.js';
import { ProgressiveDamageSiteTargeting } from '../src/game/combat/ProgressiveDamageSiteTargeting.js';
import { BLUNT_IMPACT_CLASSIFICATIONS, BLUNT_IMPACT_SCHEMA } from '../src/game/combat/weapons/BluntImpactInteraction.js';
import { createEmbeddedAnimationPackManifest, resolveAnimationPackManifest } from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import { CHEZWICK_DAMAGE_COMBAT_PROFILE } from '../src/game/combat/HumanoidModelProfiles.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';
import { createCreatureLabReadOnlyStorage, CreatureLabController, resolveCreatureLabMode } from '../src/game/creatures/CreatureLabController.js';
import {
  CREATURE_LAB_TOUCH_TARGET_PX,
  getCreatureLabAnimationPanelActions,
  getCreatureLabBodyStateActions,
  getCreatureLabDamagePanelActions,
  getCreatureLabDetachmentPanelActions,
  getCreatureLabPackActions,
  getCreatureLabPrimaryActions,
} from '../src/game/creatures/CreatureLabPanel.js';
import { CreaturePackRegistry } from '../src/game/creatures/CreaturePackRegistry.js';
import {
  CREATURE_PACK_TECHNICAL_PROFILE_FIELDS,
  assessCreaturePackRuntimeSupport,
  composeHumanoidCreatureRuntimeProfile,
  getCreatureRuntimePolicy,
} from '../src/game/creatures/CreatureRuntimePolicies.js';

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
};
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
const fixtureBaseUrl = 'https://example.test/Dread_Stone_Black/';
const fixtureBasePath = new URL(fixtureBaseUrl).pathname;

installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(
  new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url),
  'utf8',
)));

function createPublicFetch({ transform = null } = {}) {
  const requests = [];
  const fetchImplementation = async (input) => {
    const url = new URL(input);
    requests.push(url.href);
    if (!url.pathname.startsWith(fixtureBasePath)) return { ok: false, status: 404, json: async () => null };
    const relativePath = decodeURIComponent(url.pathname.slice(fixtureBasePath.length));
    try {
      const text = await readFile(path.join(publicDirectory, relativePath), 'utf8');
      const parsed = JSON.parse(text);
      return { ok: true, status: 200, json: async () => transform?.(relativePath, parsed) ?? parsed };
    } catch {
      return { ok: false, status: 404, json: async () => null };
    }
  };
  return { requests, fetchImplementation };
}

function createRegistry(options = {}) {
  const fixture = createPublicFetch(options);
  return {
    ...fixture,
    registry: new CreaturePackRegistry({ baseUrl: fixtureBaseUrl, fetchImplementation: fixture.fetchImplementation }),
  };
}

function browserAssetDescriptor(relativePath, value) {
  if (!relativePath.startsWith('generated/creature-packs/') || relativePath.endsWith('/index.json')) return value;
  return {
    ...value,
    assets: Object.fromEntries(Object.entries(value.assets).map(([key, assetPath]) => [
      key,
      assetPath ? new URL(assetPath.replace(/^\.\//, ''), fixtureBaseUrl).href : null,
    ])),
  };
}

function installBrowserAssetRuntime(t) {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  globalThis.window = globalThis;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!url.pathname.startsWith(fixtureBasePath)) return previousFetch(input, init);
    const relativePath = decodeURIComponent(url.pathname.slice(fixtureBasePath.length));
    try {
      const bytes = await readFile(path.join(publicDirectory, relativePath));
      const contentType = relativePath.endsWith('.json') ? 'application/json' : 'model/gltf-binary';
      return new Response(bytes, { status: 200, headers: { 'content-type': contentType } });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  });
}

async function loadDamageFixture(pack, profile) {
  const glbPath = path.join(publicDirectory, pack.assets.glb.replace(/^\.\//, ''));
  const glbBytes = readFileSync(glbPath);
  const gltf = await new GLTFLoader().parseAsync(
    glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength),
    new URL(pack.assets.glb.replace(/^\.\//, ''), fixtureBaseUrl).href,
  );
  const manifest = JSON.parse(await readFile(path.join(publicDirectory, pack.assets.damageManifest.replace(/^\.\//, '')), 'utf8'));
  const animationManifest = pack.assets.animationManifest
    ? JSON.parse(await readFile(path.join(publicDirectory, pack.assets.animationManifest.replace(/^\.\//, '')), 'utf8'))
    : createEmbeddedAnimationPackManifest(gltf.animations, profile);
  return { gltf, manifest, animationManifest };
}

function createFolsomFixture() {
  const scene = new THREE.Scene();
  const collision = new CollisionWorld({
    walkableRects: [{ minX: -18, maxX: 22, minZ: -20, maxZ: 18 }],
    blockerRects: [],
    defaultFloorY: 0.16,
    outdoorTerrainSampler: { sampleOutdoorY: () => 0.16 },
    sourceLocationId: 'folsom',
  });
  const player = { position: new THREE.Vector3(-2, 1.71, -4), yaw: 0 };
  const dungeon = { scene, collision, isPositionInFishingWater: () => false };
  return { scene, collision, player, dungeon };
}

test('browser registry resolves the generated index and descriptors through the configured public base with caching', async () => {
  const { registry, requests } = createRegistry();
  assert.equal(registry.resolvePublicUrl('./generated/creature-packs/index.json'), `${fixtureBaseUrl}generated/creature-packs/index.json`);
  assert.deepEqual((await registry.listPacks()).map((entry) => entry.packId), ['chezwick_damage_v001', 'dread_ram_god_damage_v001', 'dreadguard_damage_v001']);
  assert.equal(await registry.hasPack('chezwick_damage_v001'), true);
  assert.equal((await registry.getPackSummary('dreadguard_damage_v001')).displayName, 'Dreadguard');
  const first = await registry.loadPack('chezwick_damage_v001');
  const second = await registry.loadPack('chezwick_damage_v001');
  assert.equal(first, second);
  assert.equal(requests.filter((url) => url.endsWith('/index.json')).length, 1);
  assert.equal(requests.filter((url) => url.endsWith('/chezwick_damage_v001.json')).length, 1);
  registry.clearCache();
  await registry.loadIndex();
  assert.equal(requests.filter((url) => url.endsWith('/index.json')).length, 2);
});

test('runtime registry reports unknown packs and malformed descriptors cleanly', async () => {
  const { registry } = createRegistry();
  await assert.rejects(registry.loadPack('not_registered'), (error) => error.code === 'UNKNOWN_PACK' && /not_registered/.test(error.message));

  const malformed = createRegistry({
    transform: (relativePath, descriptor) => relativePath.endsWith('/chezwick_damage_v001.json')
      ? { ...descriptor, presentation: { ...descriptor.presentation, rawHeight: -1 } }
      : descriptor,
  }).registry;
  await assert.rejects(malformed.loadPack('chezwick_damage_v001'), (error) => error.code === 'INVALID_DESCRIPTOR' && /rawHeight/.test(error.message));
});

test('all three production packs compose descriptor truth with separate game-authored policy', async () => {
  const { registry } = createRegistry();
  for (const packId of ['chezwick_damage_v001', 'dreadguard_damage_v001', 'dread_ram_god_damage_v001']) {
    const pack = await registry.loadPack(packId);
    const policy = getCreatureRuntimePolicy(packId);
    const profile = composeHumanoidCreatureRuntimeProfile(pack, policy);
    assert.equal(assessCreaturePackRuntimeSupport(pack, policy).supported, true);
    assert.equal(profile.assetPath, pack.assets.glb);
    assert.equal(profile.damageManifestPath, pack.assets.damageManifest);
    assert.equal(profile.damageValidationReportPath, pack.assets.damageValidationReport);
    assert.equal(profile.animationManifestPath, pack.assets.animationManifest);
    assert.equal(profile.rawHeight, pack.presentation.rawHeight);
    assert.equal(profile.damageTopologyFingerprint, pack.source.topologyFingerprint);
    assert.equal(profile.damageWeightFingerprint, pack.source.weightFingerprint);
    assert.equal(profile.damageAuthoringVersion, pack.authoring.damageVersion);
    assert.equal(profile.damageAuthoringBuildId, pack.authoring.damageBuildId);
    assert.equal(profile.targetHeight, policy.targetHeight);
    assert.equal(profile.rootYaw, policy.rootYaw);
    assert.equal(profile.walkReferenceSpeed, policy.walkReferenceSpeed);
    assert.equal(profile.durabilityMultiplier, policy.durabilityMultiplier);
    assert.deepEqual(profile.activeDamageSegmentIds, policy.activeDamageSegmentIds);
    CREATURE_PACK_TECHNICAL_PROFILE_FIELDS.forEach((field) => assert.equal(field in policy, false, `${field} must remain descriptor-owned`));
  }

  const chezwickPack = await registry.loadPack('chezwick_damage_v001');
  const dreadguardPack = await registry.loadPack('dreadguard_damage_v001');
  const dreadRamGodPack = await registry.loadPack('dread_ram_god_damage_v001');
  assert.deepEqual(chezwickPack.damage.progressiveDamageSiteIds, ['damage_site_face_right']);
  assert.deepEqual(getCreatureRuntimePolicy(chezwickPack.packId).progressiveDamageSiteFallbacks.map((site) => site.siteId), ['damage_site_face_left_compatibility']);
  assert.deepEqual(dreadguardPack.damage.progressiveDamageSiteIds, []);
  assert.deepEqual(getCreatureRuntimePolicy(dreadguardPack.packId).progressiveDamageSiteFallbacks.map((site) => site.siteId), ['damage_site']);
  assert.equal(dreadRamGodPack.damage.progressiveDamageSiteIds.length, 4);
  assert.deepEqual(getCreatureRuntimePolicy(dreadRamGodPack.packId).progressiveDamageSiteFallbacks, []);
});

test('all composed effective profiles pass the current damage and deformation validators', async () => {
  const { registry } = createRegistry();
  for (const packId of ['chezwick_damage_v001', 'dreadguard_damage_v001', 'dread_ram_god_damage_v001']) {
    const pack = await registry.loadPack(packId);
    const profile = composeHumanoidCreatureRuntimeProfile(pack);
    const { gltf, manifest, animationManifest } = await loadDamageFixture(pack, profile);
    assert.doesNotThrow(() => validateDamageAsset({
      manifest,
      root: gltf.scene,
      profile,
      clips: gltf.animations,
      animationManifest,
    }));
    const animationPack = resolveAnimationPackManifest(animationManifest, gltf.animations, profile.name, {
      allowedKinds: profile.animationRuntimeKinds,
      expectedIgnoredNames: profile.ignoredEmbeddedAnimationNames,
      requireEmbeddedApprovalMetadata: profile.requireEmbeddedAnimationApprovalMetadata,
    });
    assert.deepEqual([...animationPack.entriesByName.keys()].sort(), [...profile.damageExpectedAnimationNames].sort());
    const deformation = validateForgeDamageDeformationAsset({
      manifest,
      root: gltf.scene,
      progressiveDamageSiteFallbacks: profile.progressiveDamageSiteFallbacks,
    });
    const nativeSiteCount = pack.damage.progressiveDamageSiteIds.length;
    assert.equal([...deformation.progressiveSites.values()].filter((site) => site.authority === 'NATIVE').length, nativeSiteCount);
    assert.equal([...deformation.progressiveSites.values()].filter((site) => site.authority === 'COMPATIBILITY').length, profile.progressiveDamageSiteFallbacks.length);
  }
});

test('unsupported skeleton families are registered but rejected by the current humanoid runtime', async () => {
  const pack = await createRegistry().registry.loadPack('chezwick_damage_v001');
  const unsupported = structuredClone(pack);
  unsupported.presentation.skeletonFamilyId = 'DSB_QUADRUPED_V1';
  const support = assessCreaturePackRuntimeSupport(unsupported, getCreatureRuntimePolicy(pack.packId));
  assert.equal(support.supported, false);
  assert.equal(support.code, 'UNSUPPORTED_SKELETON_FAMILY');
  assert.match(support.reason, /DSB_QUADRUPED_V1/);
});

test('Creature Lab mode is explicitly query-gated in development and deployed builds', () => {
  assert.equal(resolveCreatureLabMode(new URLSearchParams('creatureLab=1'), { development: true }), true);
  assert.equal(resolveCreatureLabMode(new URLSearchParams('creatureLab=1'), { development: false }), true);
  assert.equal(resolveCreatureLabMode(new URLSearchParams('creatureLab=0'), { development: true }), false);
  assert.equal(resolveCreatureLabMode(new URLSearchParams('creatureLab=0'), { development: false }), false);
  assert.equal(resolveCreatureLabMode(new URLSearchParams(), { development: true }), false);
  assert.equal(resolveCreatureLabMode(new URLSearchParams(), { development: false }), false);
  const gameSource = readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  assert.match(gameSource, /this\.creatureLabEnabled = resolveCreatureLabMode\(query\)/);
  assert.match(gameSource, /this\.combatLabEnabled \|\| this\.creatureLabEnabled/);
  assert.match(gameSource, /this\.creatureLabEnabled \? \['dreadstone_mace'\]/);
});

test('Creature Lab storage reads the current save but discards every lab-mode write', () => {
  const values = new Map([['existing', 'kept']]);
  let writes = 0;
  const storage = {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { writes += 1; values.set(key, value); },
    removeItem: (key) => { writes += 1; values.delete(key); },
    clear: () => { writes += 1; values.clear(); },
  };
  const readOnly = createCreatureLabReadOnlyStorage(storage);
  assert.equal(readOnly.getItem('existing'), 'kept');
  readOnly.setItem('new', 'value');
  readOnly.removeItem('existing');
  readOnly.clear();
  assert.equal(writes, 0);
  assert.equal(readOnly.getItem('existing'), 'kept');
  assert.equal(readOnly.getItem('new'), null);
});

test('Folsom Creature Lab switches through Dread Ram God, Chezwick, Dreadguard, and back without stale actors, routes, or blockers', async (t) => {
  installBrowserAssetRuntime(t);
  const { registry } = createRegistry({ transform: browserAssetDescriptor });
  const { collision, player, dungeon } = createFolsomFixture();
  const encounter = await FolsomCombatEncounter.create({
    dungeon,
    player,
    creatureLabEnabled: true,
    creaturePackRegistry: registry,
  });
  const lab = encounter.creatureLabController;
  const blockerCount = () => collision.blockerRects.filter((entry) => entry.type === 'combatActor').length;
  assert.ok(lab instanceof CreatureLabController);
  assert.equal(encounter.getWalkerControllers().length, 1);
  assert.equal(encounter.showcaseExtras, null);
  assert.equal(lab.selectedPack.packId, 'chezwick_damage_v001');
  assert.equal(encounter.actor.visualProfile.creaturePackId, 'chezwick_damage_v001');
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 1);
  assert.equal(blockerCount(), 1);
  const initialActor = encounter.actor;
  const initialCollider = initialActor.colliders.get('upper_chest');
  assert.equal((await lab.selectPack('dread_ram_god_damage_v001')).accepted, true);
  assert.equal(initialActor.disposed, true);
  assert.equal(encounter.combatRouter.resolveCollider(initialCollider, new THREE.Vector3()), null);
  assert.equal(encounter.actor.visualProfile.creaturePackId, 'dread_ram_god_damage_v001');
  assert.equal(lab.getDiagnostics().nativeSiteCount, 4);
  assert.equal(lab.getDiagnostics().compatibilitySiteCount, 0);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 1);
  assert.equal(blockerCount(), 1);

  const ramSites = lab.getProgressiveSites();
  assert.equal(ramSites.length, 4);
  assert.ok(ramSites.every((site) => site.authority === 'NATIVE' && site.radius > 0));
  assert.ok(ramSites.every((site) => site.bindingMode === 'SKINNED_SURFACE'));
  assert.equal(lab.toggleSiteMarkers().enabled, true);
  assert.equal(lab.siteMarkerRenderer.markers.visible, true);
  assert.equal(lab.siteMarkerRenderer.markers.count, 4);
  for (const site of ramSites) {
    assert.equal(lab.selectSite(site.siteId).accepted, true);
    const center = lab.strikeSelectedSite('center');
    assert.equal(center.actualSiteId, site.siteId, `${site.siteId} center probe must select itself`);
    assert.equal(lab.resetDamage().accepted, true);
    const edge = lab.strikeSelectedSite('edge');
    assert.equal(edge.actualSiteId, site.siteId, `${site.siteId} edge probe must select itself`);
    assert.equal(lab.resetDamage().accepted, true);
    const outside = lab.strikeSelectedSite('outside');
    assert.equal(outside.actualSiteId, null, `${site.siteId} outside probe must not select a neighboring site`);
    assert.equal(lab.resetDamage().accepted, true);
  }

  const hitTargets = ramSites.slice(0, 3);
  for (let siteIndex = 0; siteIndex < hitTargets.length; siteIndex += 1) {
    const site = hitTargets[siteIndex];
    assert.equal(lab.selectSite(site.siteId).accepted, true);
    for (let hitIndex = 0; hitIndex <= siteIndex; hitIndex += 1) {
      assert.equal(lab.strikeSelectedSite('center').actualSiteId, site.siteId);
    }
  }
  let ramDiagnostics = lab.getDiagnostics();
  assert.deepEqual(hitTargets.map((site) => ramDiagnostics.progressiveSites[site.siteId].currentStage), ['LIGHT', 'MEDIUM', 'HEAVY']);
  assert.deepEqual(hitTargets.map((site) => ramDiagnostics.progressiveSites[site.siteId].acceptedHitCount), [1, 2, 3]);
  assert.equal(ramDiagnostics.progressiveSites[ramSites[3].siteId].currentStage, null);
  assert.equal(ramDiagnostics.progressiveSites[ramSites[3].siteId].acceptedHitCount, 0);
  assert.ok(ramDiagnostics.activeGoreCount > 0);
  assert.ok(ramDiagnostics.activeStainCount > 0);
  assert.equal(encounter.actor.lifeState, 'alive', 'one Heavy progressive site must not globally kill Dread Ram God');
  assert.equal(lab.siteMarkerRenderer.markers.count, 4);

  const physicalSite = ramSites[3];
  const physicalTarget = lab.getSiteTargeting().getRecord(physicalSite.siteId, { refresh: true });
  const physicalBodyId = lab.resolveSiteStrikeBodyId(physicalSite);
  const physicalHit = encounter.actor.resolveHit(encounter.actor.colliders.get(physicalBodyId), physicalTarget.currentWorldCenter.clone());
  const physicalDirection = physicalTarget.currentWorldPreferredDirection.clone().normalize();
  const physicalImpact = encounter.actor.applyBluntImpact({
    hit: physicalHit,
    impact: {
      schema: BLUNT_IMPACT_SCHEMA,
      interactionId: 'dread-ram-god-real-mace-path',
      primitive: 'mace_head',
      classification: BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt,
      worldPoint: physicalTarget.currentWorldCenter.clone(),
      worldNormal: physicalDirection.clone().negate(),
      impactDirection: physicalDirection,
      normalImpactSpeed: 4,
      tangentialSpeed: 0.3,
      estimatedImpulse: 21.6,
      estimatedEnergy: 43.2,
      loadProgress: 0.76,
      gesturePower: 0.7,
      impactRadiusEstimate: 0.11,
    },
  });
  assert.equal(physicalImpact.accepted, true);
  assert.equal(physicalImpact.deformationApplied, true);
  ramDiagnostics = lab.getDiagnostics();
  assert.equal(ramDiagnostics.progressiveTargeting.lastPhysicalTargetingDecision.source, 'physical');
  assert.equal(ramDiagnostics.progressiveTargeting.lastPhysicalTargetingDecision.selectedSiteId, physicalSite.siteId);
  assert.equal(ramDiagnostics.progressiveSites[physicalSite.siteId].acceptedHitCount, 1);

  assert.equal(lab.detachSegment('left_elbow').accepted, true);
  assert.equal(lab.detachSegment('right_elbow').accepted, true);
  assert.equal(lab.detachSegment('lower_spine').accepted, false);
  assert.equal(encounter.actor.lifeState, 'alive');
  assert.equal(lab.detachSegment('head_neck').accepted, true);
  assert.equal(encounter.actor.lifeState, 'dying');
  const damagedRamActor = encounter.actor;
  const damagedRamTargeting = lab.getSiteTargeting();
  const damagedRamMarkers = lab.siteMarkerRenderer;
  assert.equal((await lab.respawn()).accepted, true);
  assert.equal(damagedRamActor.disposed, true);
  assert.equal(damagedRamTargeting.disposed, true);
  assert.equal(damagedRamMarkers.disposed, true);
  assert.equal(encounter.actor.lifeState, 'alive');
  assert.equal(lab.getDiagnostics().activeGoreCount, 0);
  assert.equal(lab.getDiagnostics().activeStainCount, 0);

  const firstActor = encounter.actor;
  const firstCollider = firstActor.colliders.get('upper_chest');
  const firstTargeting = lab.getSiteTargeting();
  const firstMarkers = lab.siteMarkerRenderer;
  assert.equal((await lab.selectPack('chezwick_damage_v001')).accepted, true);
  assert.equal(firstActor.disposed, true);
  assert.equal(firstTargeting.disposed, true);
  assert.equal(firstMarkers.disposed, true);
  assert.equal(encounter.combatRouter.resolveCollider(firstCollider, new THREE.Vector3()), null);
  assert.equal(encounter.actor.visualProfile.creaturePackId, 'chezwick_damage_v001');
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 1);
  assert.equal(blockerCount(), 1);

  const secondActor = encounter.actor;
  const secondCollider = secondActor.colliders.get('upper_chest');
  assert.equal((await lab.selectPack('dreadguard_damage_v001')).accepted, true);
  assert.equal(secondActor.disposed, true);
  assert.equal(encounter.combatRouter.resolveCollider(secondCollider, new THREE.Vector3()), null);
  assert.equal(encounter.actor.visualProfile.creaturePackId, 'dreadguard_damage_v001');
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 1);
  assert.equal(blockerCount(), 1);

  const thirdActor = encounter.actor;
  const thirdCollider = thirdActor.colliders.get('upper_chest');
  assert.equal((await lab.selectPack('dread_ram_god_damage_v001')).accepted, true);
  assert.equal(thirdActor.disposed, true);
  assert.equal(encounter.combatRouter.resolveCollider(thirdCollider, new THREE.Vector3()), null);
  assert.equal(encounter.actor.visualProfile.creaturePackId, 'dread_ram_god_damage_v001');
  assert.equal(lab.getDiagnostics().nativeSiteCount, 4);
  assert.equal(lab.getDiagnostics().activeGoreCount, 0);
  assert.equal(lab.getDiagnostics().activeStainCount, 0);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 1);
  assert.equal(blockerCount(), 1);

  const fourthActor = encounter.actor;
  assert.equal(lab.kill().accepted, true);
  assert.equal(fourthActor.lifeState, 'dying');
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 1, 'the authored falling body remains contactable until grounded');
  assert.equal((await lab.respawn()).accepted, true);
  assert.equal(fourthActor.disposed, true);
  assert.equal(encounter.actor.lifeState, 'alive');
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 1);
  assert.equal(blockerCount(), 1);

  encounter.dispose();
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 0);
  assert.equal(blockerCount(), 0);
});

test('default Folsom remains the legacy four-Chezwick wave outside explicit lab mode', async () => {
  const { player, dungeon } = createFolsomFixture();
  const encounter = await FolsomCombatEncounter.create({ dungeon, player, creatureLabEnabled: false });
  assert.equal(encounter.creatureLabController, null);
  assert.equal(encounter.getWalkerControllers().length, 4);
  assert.ok(encounter.getWalkerControllers().every((controller) => controller.actor.visualProfile === CHEZWICK_DAMAGE_COMBAT_PROFILE));
  encounter.dispose();
});

test('touch-first panel actions invoke controller operations without console access', async () => {
  const calls = [];
  const controller = {
    selectPack: async (packId) => { calls.push(`selectPack:${packId}`); },
    respawn: async () => { calls.push('respawn'); },
    resetDamage: () => { calls.push('resetDamage'); },
    playAnimation: (actionId) => { calls.push(`playAnimation:${actionId}`); },
    setSelectedSiteStage: (stage) => { calls.push(`setStage:${stage}`); },
    advanceSelectedSite: () => { calls.push('advanceSite'); },
    resetSelectedSite: () => { calls.push('resetSite'); },
    selectRelativeSite: (offset) => { calls.push(`selectRelative:${offset}`); },
    toggleSiteMarkers: () => { calls.push('toggleSites'); },
    toggleSelectedRadius: () => { calls.push('toggleRadius'); },
    strikeSelectedSite: (probe) => { calls.push(`strikeSite:${probe}`); },
    detachSegment: (segmentId) => { calls.push(`detach:${segmentId}`); },
    kill: () => { calls.push('kill'); },
    ragdoll: () => { calls.push('ragdoll'); },
  };
  const state = {
    packs: [{ packId: 'future_pack', displayName: 'Future Pack', supported: true }],
    animationActions: [{ id: 'walk', label: 'Walk' }],
    detachmentActions: [{ segmentId: 'head_neck', label: 'Head / Neck', supportedByRuntime: true }],
    ragdollAvailable: true,
    showSites: false,
    showSelectedRadius: false,
  };
  const actions = [
    ...getCreatureLabPrimaryActions(controller),
    ...getCreatureLabPackActions(controller, state),
    ...getCreatureLabAnimationPanelActions(controller, state),
    ...getCreatureLabDamagePanelActions(controller, state),
    ...getCreatureLabDetachmentPanelActions(controller, state),
    ...getCreatureLabBodyStateActions(controller, state),
  ];
  assert.ok(CREATURE_LAB_TOUCH_TARGET_PX >= 44);
  for (const action of actions) await action.run();
  assert.deepEqual(calls, [
    'respawn', 'resetDamage', 'selectPack:future_pack', 'playAnimation:walk',
    'selectRelative:-1', 'selectRelative:1', 'toggleSites', 'toggleRadius',
    'setStage:LIGHT', 'setStage:MEDIUM', 'setStage:HEAVY', 'advanceSite', 'resetSite',
    'strikeSite:center', 'strikeSite:edge', 'strikeSite:outside',
    'detach:head_neck', 'kill', 'ragdoll', 'respawn',
  ]);
});

test('center, edge, and outside lab probes route through actor blunt impact without injecting site identity', () => {
  const targeting = new ProgressiveDamageSiteTargeting({ sites: [{
    siteId: 'face_probe', displayName: 'Face Probe', authority: 'NATIVE', regionId: 'body_core', structuralGroup: 'head', radius: 0.1,
    preferredDirectionLocal: [1, 0, 0], stageOrder: ['LIGHT'], stages: [{ stage: 'LIGHT', measurements: { captureCenterLocal: [0, 0, 1] } }],
  }] });
  const seenImpacts = [];
  const adapter = {
    getProgressiveDamageSiteTargeting: () => targeting,
    getProgressiveDamageSiteTarget: (siteId, options) => targeting.getRecord(siteId, options),
    listProgressiveDamageSites: () => [{
      siteId: 'face_probe', displayName: 'Face Probe', authority: 'NATIVE', regionId: 'body_core', structuralGroup: 'head', radius: 0.1,
    }],
  };
  const actor = {
    visualAdapter: adapter,
    colliders: new Map([['head', { handle: 1 }]]),
    resolveHit: (_collider, worldPoint) => ({ regionId: 'head', region: { id: 'head' }, collisionPointWorld: worldPoint }),
    applyBluntImpact: ({ hit, impact }) => {
      seenImpacts.push(impact);
      const selected = targeting.select({ impactRegion: hit.regionId, impactWorld: impact.worldPoint, impactDirection: impact.impactDirection, source: impact.targetingSource });
      return { applied: selected.record != null, siteId: selected.record?.siteId ?? null };
    },
  };
  const controller = new CreatureLabController({ walkerController: { actor, disposeWalker: () => {} } });
  controller.selectedSiteId = 'face_probe';
  assert.equal(controller.strikeSelectedSite('center').actualSiteId, 'face_probe');
  assert.equal(controller.strikeSelectedSite('edge').actualSiteId, 'face_probe');
  assert.equal(controller.strikeSelectedSite('outside').actualSiteId, null);
  assert.ok(seenImpacts.every((impact) => impact.targetingSource === 'creature_lab_probe' && !Object.hasOwn(impact, 'siteId')));
  controller.dispose();
  targeting.dispose();
});

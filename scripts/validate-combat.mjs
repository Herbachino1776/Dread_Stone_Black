import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCombatConfiguration } from '../src/game/combat/CombatConfig.js';
import { validateCombatStage2Configuration } from '../src/game/combat/CombatStage2Config.js';
import { HUMANOID_ANATOMY_REGIONS } from '../src/game/combat/CombatConfig.js';
import { DREADGUARD_DAMAGE_COMBAT_PROFILE } from '../src/game/combat/HumanoidModelProfiles.js';

const result = validateCombatConfiguration();
const stage2 = validateCombatStage2Configuration(HUMANOID_ANATOMY_REGIONS.map((region) => region.id));
assert.equal(result.bodyCount, 18);
assert.equal(result.jointCount, 17);
assert.ok(result.regionCount >= 20);

const [gameSource, sceneHostSource, viewmodelHostSource, knifeSource, directorSource, presentationSource, cameraFeedbackSource, intentSource, oldViewmodelSource, actorSource, adapterSource, profileSource, woundSource, animationControllerSource, surfaceBindingSource, physiologySource, bloodSource, feedbackSource, folsomEncounterSource, combatLabSource, combatLabPanelSource, mortalitySource, controlSource, configSource, stage2ConfigSource, collisionSource, packageSource, docsSource, directorDocsSource, glbBuffer, dreadguardGlbBuffer, dreadguardManifestSource, dreadguardValidationSource, dreadguardAnimationManifestSource, dreadguardAnimationValidationSource] = await Promise.all([
  readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/hosts/SceneSessionHost.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/hosts/FirstPersonViewmodelHost.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/WorldKnifeCombatController.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatDirector.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatPresentation.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/Feedback.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/MeleeIntentWeapon.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/physical-tools/PhysicalToolViewmodel.js', import.meta.url), 'utf8'),
  Promise.all([
    readFile(new URL('../src/game/combat/HumanoidCombatActor.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/game/combat/HumanoidCombatActorBase.js', import.meta.url), 'utf8'),
  ]).then((sources) => sources.join('\n')),
  readFile(new URL('../src/game/combat/HumanoidGlbVisualAdapter.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/HumanoidModelProfiles.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatWoundSystem.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/HumanoidAnimationPackController.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/SkinnedSurfaceBinding.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatPhysiology.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatBloodEffects.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatFeedbackSystem.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/FolsomCombatEncounter.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatLabScene.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatLabDebugPanel.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatMortality.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/KnifeControlState.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatConfig.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatStage2Config.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/Collision.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../docs/architecture/PHYSICAL_HUMANOID_COMBAT_FOUNDATION.md', import.meta.url), 'utf8').catch(() => ''),
  readFile(new URL('../docs/architecture/COMBAT_DIRECTOR.md', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/models/npc/human/human_retro_256.glb', import.meta.url)),
  readFile(new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb', import.meta.url)),
  readFile(new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.json', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001_validation.json', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/enemies/dreadguard/animations/dreadguard_animpack_v003.json', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/enemies/dreadguard/animations/dreadguard_animpack_v003_validation.json', import.meta.url), 'utf8'),
]);
const [decalLibrarySource, outdoorLightingSource, woundManifestSource, walkerSource, actorRouterSource, bloodMaterialSource, weaponPoseSource, weaponGestureSource, weaponContactRouterSource, sweptCuttingEdgeSource, weaponVisualAssetSource, weaponContactScratchSource, swordControllerSource, edgeDamageSource] = await Promise.all([
  readFile(new URL('../src/game/combat/KnifeWoundDecalLibrary.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/world-scene/OutdoorLightingDirector.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatLabWalkerController.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatActorRouter.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/BloodChromaMaterial.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/weapons/WeaponPoseWorkspace.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/weapons/WeaponGestureOwnership.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/weapons/WeaponContactRouter.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/weapons/SweptCuttingEdge.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/weapons/WeaponVisualAsset.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/weapons/WeaponContactScratch.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/weapons/SwordWorldWeaponController.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/weapons/EdgeDamageInteraction.js', import.meta.url), 'utf8'),
]);
const dungeonSceneSource = await readFile(new URL('../src/game/DungeonScene.js', import.meta.url), 'utf8');
const [knifeGlbBuffer, swordGlbBuffer] = await Promise.all([
  readFile(new URL('../public/assets/weapons/melee/old_work_knife_v004.glb', import.meta.url)),
  readFile(new URL('../public/assets/weapons/melee/dreadstone_sword_v002.glb', import.meta.url)),
]);
const woundManifest = JSON.parse(woundManifestSource);

function parseGlbJson(buffer) {
  assert.equal(buffer.subarray(0, 4).toString(), 'glTF', 'asset is a valid binary glTF');
  let offset = 12;
  let json = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString());
    offset += 8 + length;
  }
  assert.ok(json, 'GLB JSON chunk loads');
  return json;
}

assert.equal(glbBuffer.subarray(0, 4).toString(), 'glTF', 'humanoid asset is a valid binary glTF');
let glbOffset = 12;
let glbJson = null;
while (glbOffset < glbBuffer.length) {
  const length = glbBuffer.readUInt32LE(glbOffset);
  const type = glbBuffer.readUInt32LE(glbOffset + 4);
  if (type === 0x4e4f534a) glbJson = JSON.parse(glbBuffer.subarray(glbOffset + 8, glbOffset + 8 + length).toString());
  glbOffset += 8 + length;
}
assert.ok(glbJson, 'humanoid GLB JSON chunk loads');
const skinnedPrimitives = glbJson.meshes.flatMap((mesh) => mesh.primitives).filter((primitive) => primitive.attributes.JOINTS_0 != null && primitive.attributes.WEIGHTS_0 != null);
assert.ok(skinnedPrimitives.length >= 1, 'humanoid GLB contains skin weights');
assert.ok(glbJson.skins?.[0]?.joints?.length >= 18, 'humanoid GLB contains a coherent skeleton');
assert.ok(glbJson.images?.every((image) => image.bufferView != null), 'humanoid textures are embedded');
const nodeNames = new Set(glbJson.nodes.map((node) => node.name));
['body', 'body_top0', 'body_top1', 'body_top2', 'neck', 'head', 'arm_left_top', 'arm_left_bot', 'arm_left_hand', 'arm_right_top', 'arm_right_bot', 'arm_right_hand', 'leg_left_top', 'leg_left_bot', 'leg_left_foot', 'leg_right_top', 'leg_right_bot', 'leg_right_foot'].forEach((name) => assert.ok(nodeNames.has(name), `required mapped GLB bone exists: ${name}`));
const dreadguardGlbJson = parseGlbJson(dreadguardGlbBuffer);
const dreadguardManifest = JSON.parse(dreadguardManifestSource);
const dreadguardValidation = JSON.parse(dreadguardValidationSource);
const dreadguardAnimationManifest = JSON.parse(dreadguardAnimationManifestSource);
const dreadguardAnimationValidation = JSON.parse(dreadguardAnimationValidationSource);
const dreadguardRuntimeAnimationNames = [
  'DSB_Death_KneesFirst_RIGHT_v001',
  'DSB_Hurt_LEFT_Flank_v001',
  'DSB_Hurt_RIGHT_Flank_v001',
  'DSB_Walk_NORMAL_v001',
];
const ignoredDreadguardGuardAnimationNames = [
  'DSB_Mace_Brace_Head_LeftArm_v001',
  'DSB_Mace_Brace_Head_RightArm_v001',
  'DSB_Mace_Brace_Head_TwoArm_v001',
];
assert.equal(dreadguardManifest.schema, 'dreadstone.damage_authoring.v1');
assert.equal(dreadguardManifest.glb, 'dreadguard_damage_v001.glb');
assert.equal(dreadguardValidation.status, 'PASS');
assert.deepEqual(dreadguardValidation.errors, []);
assert.deepEqual(dreadguardValidation.warnings, ["Draft site 'Left Head' is omitted from export (FAILED)."]);
assert.equal(dreadguardValidation.source_topology_sha256, dreadguardManifest.source.topologyFingerprint);
assert.equal(dreadguardValidation.source_weight_sha256, dreadguardManifest.source.weightFingerprint);
assert.equal(dreadguardValidation.deformation.progressiveDamageSites.siteCount, 1);
assert.equal(dreadguardValidation.deformation.progressiveDamageSites.exportEnabledSiteCount, 0);
assert.equal(dreadguardValidation.finalGlb.surfaceStains.status, 'PASS');
assert.equal(dreadguardValidation.finalGlb.surfaceStains.bindingCount, 6);
assert.equal(dreadguardAnimationManifest.schema, 'dreadstone.animation_pack.v1');
assert.equal(dreadguardAnimationManifest.asset, 'dreadguard_animpack_v003.glb');
assert.equal(dreadguardAnimationManifest.approved_animation_count, 7);
assert.equal(dreadguardAnimationValidation.status, 'PASS');
assert.equal(dreadguardAnimationValidation.animation_count, 7);
const dreadguardAnimationNames = dreadguardAnimationManifest.animations.map((entry) => entry.name);
assert.deepEqual(
  dreadguardAnimationManifest.animations
    .filter((entry) => ['WALK', 'HURT_LEFT', 'HURT_RIGHT', 'DEATH'].includes(entry.approved_kind))
    .map((entry) => entry.name)
    .sort(),
  [...dreadguardRuntimeAnimationNames].sort(),
);
assert.deepEqual(
  dreadguardAnimationManifest.animations
    .filter((entry) => entry.approved_kind.startsWith('MACE_GUARD_'))
    .map((entry) => entry.name)
    .sort(),
  [...ignoredDreadguardGuardAnimationNames].sort(),
);
assert.deepEqual(dreadguardAnimationValidation.exported_animation_names, dreadguardAnimationNames);
assert.deepEqual(
  dreadguardGlbJson.animations.map((animation) => animation.name).sort(),
  [...dreadguardAnimationNames].sort(),
  'combined damage GLB carries the exact approved pack v003 clips',
);
assert.ok(dreadguardGlbJson.meshes?.length >= 1, 'Dreadguard damage GLB contains meshes');
assert.ok(dreadguardGlbJson.skins?.length >= 1, 'Dreadguard damage GLB contains a skin');
assert.ok(dreadguardGlbJson.meshes.flatMap((mesh) => mesh.primitives).some((primitive) => primitive.attributes.JOINTS_0 != null && primitive.attributes.WEIGHTS_0 != null), 'Dreadguard damage GLB contains a SkinnedMesh primitive');
assert.ok(dreadguardGlbJson.images?.every((image) => image.bufferView != null), 'Dreadguard textures are embedded');
const dreadguardNodeNames = new Set(dreadguardGlbJson.nodes.map((node) => node.name));
['body', 'body_top0', 'body_top1', 'body_top2', 'neck', 'head', 'arm_left_top', 'arm_left_bot', 'arm_left_hand', 'arm_right_top', 'arm_right_bot', 'arm_right_hand', 'leg_left_top', 'leg_left_bot', 'leg_left_foot', 'leg_right_top', 'leg_right_bot', 'leg_right_foot'].forEach((name) => assert.ok(dreadguardNodeNames.has(name), `required mapped Dreadguard bone exists: ${name}`));
dreadguardManifest.deformations.generatedGoreMeshes.forEach(({ nodeName }) => assert.ok(dreadguardNodeNames.has(nodeName), `manifest gore node exists: ${nodeName}`));
const progressiveSite = dreadguardManifest.deformations.progressiveDamageSites[0]
  ?? DREADGUARD_DAMAGE_COMBAT_PROFILE.progressiveDamageSiteFallbacks[0];
assert.equal(dreadguardManifest.deformations.progressiveDamageSiteSchema, 'dreadstone.progressive_damage_sites.v1');
assert.deepEqual(progressiveSite.stageOrder, ['LIGHT', 'MEDIUM', 'HEAVY']);
assert.deepEqual(Object.fromEntries(progressiveSite.stages.map((stage) => [stage.stage, stage.deformationKeyName])), {
  LIGHT: 'Left_Head_Impact_v003_v001',
  MEDIUM: 'Left_Head_Impact_v002',
  HEAVY: 'Left_Head_Impact_v001',
});
const attachedHeadNode = dreadguardGlbJson.nodes.find((node) => node.name === progressiveSite.stages[0].attachedObject);
const detachedHeadNode = dreadguardGlbJson.nodes.find((node) => node.name === progressiveSite.stages[0].detachedObject);
assert.deepEqual(dreadguardGlbJson.meshes[attachedHeadNode.mesh].extras.targetNames, ['Left_Head_Impact_v001', 'Left_Head_Impact_v002', 'Left_Head_Impact_v003_v001']);
assert.deepEqual(dreadguardGlbJson.meshes[detachedHeadNode.mesh].extras.targetNames, ['Left_Head_Impact_v001', 'Left_Head_Impact_v002', 'Left_Head_Impact_v003_v001']);
assert.equal(dreadguardManifest.deformations.surfaceStainBindingSchema, 'dreadstone.surface_stain_binding.v1');
assert.equal(dreadguardManifest.deformations.surfaceStainMeshes.length, 6);
dreadguardManifest.deformations.surfaceStainMeshes.forEach((binding) => {
  const node = dreadguardGlbJson.nodes.find((entry) => entry.name === binding.nodeName);
  assert.ok(node, `manifest surface stain node exists: ${binding.nodeName}`);
  const primitive = dreadguardGlbJson.meshes[node.mesh].primitives[0];
  assert.ok(primitive.attributes.COLOR_0 != null, `${binding.nodeName} contains portable COLOR_0`);
  assert.equal(dreadguardGlbJson.accessors[primitive.attributes.COLOR_0].type, 'VEC4');
  assert.equal(dreadguardGlbJson.materials[primitive.material].name, binding.materialName);
  assert.equal(dreadguardGlbJson.materials[primitive.material].alphaMode, 'BLEND');
  assert.deepEqual(dreadguardGlbJson.meshes[node.mesh].extras.targetNames, [binding.morphTarget]);
  assert.equal(binding.portableArtifactIncluded, true);
});

assert.match(sceneHostSource, /combatLab/);
assert.match(sceneHostSource, /FolsomCombatEncounter/);
assert.match(gameSource, /combatLabEnabled/);
assert.match(gameSource, /creatureLabEnabled/);
assert.match(gameSource, /if \(this\.combatLabEnabled \|\| this\.creatureLabEnabled\) return;/);
assert.match(knifeSource, /castWeaponTip/);
assert.match(knifeSource, /resolveSweptEdgeContact/);
assert.match(knifeSource, /classifySlashContact/);
assert.match(knifeSource, /activeSlash/);
assert.match(knifeSource, /desiredGrip/);
assert.match(knifeSource, /actualGrip/);
assert.match(knifeSource, /penetrationDepth/);
assert.match(knifeSource, /target-invalid/);
assert.match(knifeSource, /weapon-unequipped/);
assert.doesNotMatch(knifeSource, /targetTorso|torsoCenter|screenCenter/);
assert.doesNotMatch(oldViewmodelSource, /old-work-knife-held|old-work-knife-short-rusted-blade/);
assert.doesNotMatch(oldViewmodelSource, /addTool\('old_work_knife'/);
assert.match(knifeSource, /old-work-knife-authoritative-world-weapon/);
assert.match(knifeSource, /COMBAT_KNIFE_VIEWMODEL_LAYER = WEAPON_VIEWMODEL_LAYER/);
assert.match(knifeSource, /createCachedWeaponGlbLoader/);
assert.match(weaponVisualAssetSource, /GLTFLoader/);
assert.match(knifeSource, /\.\/assets\/weapons\/melee\/old_work_knife_v004\.glb/);
assert.doesNotMatch(knifeSource, /dreadstone_sword_v002\.glb/);
assert.match(knifeSource, /const layer = this\.entry \? COMBAT_KNIFE_WORLD_LAYER : COMBAT_KNIFE_VIEWMODEL_LAYER/);
assert.match(knifeSource, /applyWeaponRenderLayer/);
assert.match(weaponVisualAssetSource, /object\.layers\.set\(layer\)/);
assert.doesNotMatch(knifeSource, /minFilter|magFilter/);
assert.match(weaponVisualAssetSource, /object\.castShadow = false/);
assert.match(weaponVisualAssetSource, /object\.frustumCulled = false/);
assert.match(knifeSource, /createWeaponPoseWorkspace/);
assert.match(weaponPoseSource, /rebaseWorldWeaponPoseToCamera/);
assert.match(knifeSource, /WeaponGestureOwnership/);
assert.match(weaponGestureSource, /deliberateVelocity/);
assert.match(knifeSource, /WeaponContactRouter/);
assert.match(weaponContactRouterSource, /resolveTarget/);
assert.match(knifeSource, /sweepCuttingEdge/);
assert.match(sweptCuttingEdgeSource, /sampleCuttingEdgeLocal/);
assert.match(knifeSource, /disposeOwnedWeaponVisual/);
assert.match(weaponContactScratchSource, /createWeaponContactScratch/);
['WeaponPoseWorkspace', 'WeaponGestureOwnership', 'WeaponContactRouter', 'SweptCuttingEdge', 'WeaponVisualAsset', 'WeaponContactScratch'].forEach((moduleName) => assert.match(swordControllerSource, new RegExp(moduleName)));
assert.match(swordControllerSource, /dreadstone_sword_v002\.glb/);
assert.match(swordControllerSource, /DREADSTONE_SWORD_DIMENSIONS/);
assert.match(swordControllerSource, /tip: Object\.freeze/);
assert.match(swordControllerSource, /leftEdge: Object\.freeze/);
assert.match(swordControllerSource, /rightEdge: Object\.freeze/);
assert.match(swordControllerSource, /flat: Object\.freeze/);
assert.match(swordControllerSource, /spine: Object\.freeze/);
assert.match(swordControllerSource, /guard: Object\.freeze/);
assert.match(swordControllerSource, /grip: Object\.freeze/);
assert.match(swordControllerSource, /SWORD_EDGE_MAX_SAMPLE_COUNT = 17/);
assert.match(swordControllerSource, /beginEdgeDamage/);
assert.doesNotMatch(swordControllerSource, /beginSlash|applySlashWound|KnifeWound|slash-decal|broadsword/i);
assert.match(edgeDamageSource, /dreadstone\.edge-damage\.v1/);
assert.match(edgeDamageSource, /worldPoint/);
assert.match(edgeDamageSource, /localPoint/);
assert.match(directorSource, /beginEdgeDamage/);
assert.match(actorSource, /applyEdgeDamage/);
assert.match(viewmodelHostSource, /new SwordWorldWeaponController/);
assert.match(knifeSource, /getProjectedActivePoint/);
assert.match(knifeSource, /contactActivationProvider/);
assert.match(knifeSource, /deliberateInputVelocity/);
assert.match(knifeSource, /offensiveVelocity/);
assert.match(knifeSource, /contactDamageReason/);
assert.match(knifeSource, /gripPointerId/);
assert.match(knifeSource, /releaseGrip/);
assert.match(knifeSource, /plantedHold/);
assert.match(knifeSource, /syncVisualDepthMode/);
assert.match(knifeSource, /COMBAT_KNIFE_WORLD_LAYER = WEAPON_WORLD_LAYER/);
assert.match(knifeSource, /non-damaging:no-pointer-owner/);
assert.match(knifeSource, /MeleeIntentWeapon/);
assert.match(knifeSource, /weaponLayers/);
assert.match(knifeSource, /targetDirector\.beginPuncture/);
assert.match(knifeSource, /slash\.director\.beginSlash/);
assert.match(knifeSource, /entry\.director\.advancePenetration/);
assert.match(knifeSource, /entry\.director\.beginWithdrawal/);
assert.match(knifeSource, /combatRouter/);
assert.match(actorRouterSource, /entriesByColliderHandle/);
assert.match(actorRouterSource, /resolveCollider/);
assert.match(actorRouterSource, /unregister/);
parseGlbJson(knifeGlbBuffer);
parseGlbJson(swordGlbBuffer);
['SPAWNING', 'BLENDING_TO_WALK', 'APPROACHING', 'BLENDING_TO_IDLE', 'NEAR_PLAYER', 'HIT_REACTING', 'LOSING_CONSCIOUSNESS', 'GROUNDED', 'DISPOSED', 'RESPAWNING'].forEach((state) => assert.match(walkerSource, new RegExp(state)));
assert.doesNotMatch(walkerSource, /SETTLING_TO_GROUND|advanceGroundCollapse|groundCollapseSeconds/);
assert.doesNotMatch(walkerSource, /Math\.random/);
assert.doesNotMatch(walkerSource, /forceRagdoll|activateRagdoll/);
assert.match(walkerSource, /deathCollapseSeconds: 5\.4/);
assert.match(walkerSource, /shouldHoldFinalPose/);
assert.match(walkerSource, /WalkerVitalStabPolicy/);
assert.match(walkerSource, /setMovementState/);
assert.match(walkerSource, /playDeathAnimation/);
assert.doesNotMatch(walkerSource, /ProceduralHumanoidLocomotionLayer|ProceduralConsciousnessLossLayer|applyAfterMixer|applyAfterLocomotion/);
assert.doesNotMatch(knifeSource, /this\.actor\.(beginPunctureWound|applyPenetration|applySlashWound|onWeaponExtracted)/);
assert.doesNotMatch(knifeSource, /this\.feedbackSystem\?\.emit|this\.bloodEffects\?\.emit|this\.feedback\?\.shake/);
assert.ok(knifeSource.indexOf('this.actualGrip.copy(this.desiredGrip)') >= 0, 'free collision pose follows the desired hand without artificial latency');
assert.doesNotMatch(knifeSource, /getAttackControlState/);
assert.match(viewmodelHostSource, /createToolInputViewmodel/);
assert.match(viewmodelHostSource, /combatRuntime\?\.scene \?\? this\.dungeon\?\.scene/);
assert.match(viewmodelHostSource, /if \(!this\.combatRuntime\)/);
assert.match(viewmodelHostSource, /bindPointerInput: this\.dungeon\?\.isCombatLab === true/);
assert.doesNotMatch(viewmodelHostSource, /setCombatKnifeActive/);
assert.match(viewmodelHostSource, /combatEncounter/);
assert.match(viewmodelHostSource, /combatDirector: combatRuntime\?\.combatDirector/);
assert.match(directorSource, /PENETRATION_STAGES/);
['approach', 'surface_contact', 'surface_compression', 'surface_rupture', 'soft_tissue', 'hard_tissue', 'embedded', 'withdrawal', 'exit', 'recovery'].forEach((stage) => assert.match(directorSource, new RegExp(stage)));
['lifecycle', 'tissue', 'wound', 'reaction', 'blood', 'audio', 'camera', 'haptic', 'resistance', 'recovery'].forEach((event) => assert.match(directorSource, new RegExp(`${event}: '${event}'`)));
assert.match(directorSource, /queued\.time < event\.time/);
assert.match(directorSource, /this\.eventPool\.pop\(\)/);
assert.match(directorSource, /releaseEvent\(event\)/);
assert.match(directorSource, /beginPuncture/);
assert.match(directorSource, /beginSlash/);
assert.match(directorSource, /advancePenetration/);
assert.match(directorSource, /beginWithdrawal/);
assert.match(directorSource, /completeWithdrawal/);
assert.match(directorSource, /resolveMeleeTimeline/);
assert.match(presentationSource, /sampleTissueResistanceCurve/);
assert.match(presentationSource, /resolveWeaponMicroResponse/);
assert.match(presentationSource, /resolveMeleeSpacingEnvelope/);
assert.match(presentationSource, /minimumLoadClearance/);
assert.doesNotMatch(cameraFeedbackSource, /Math\.random/);
assert.match(cameraFeedbackSource, /shakeDirection/);
assert.match(cameraFeedbackSource, /damping/);
assert.match(intentSource, /stab: 'stab'/);
assert.match(intentSource, /slash: 'slash'/);
assert.match(intentSource, /withdraw: 'withdraw'/);
assert.match(intentSource, /ownerId != null/);
assert.match(actorSource, /CombatWoundSystem/);
assert.match(actorSource, /CombatPhysiology/);
assert.match(actorSource, /HumanoidGlbVisualAdapter/);
assert.match(adapterSource, /SkeletonUtils/);
assert.match(adapterSource, /HUMANOID_GLB_BONE_MAP/);
assert.match(adapterSource, /LinearMipmapLinearFilter/);
assert.match(adapterSource, /NearestFilter/);
assert.match(adapterSource, /material\.map\.magFilter = THREE\.NearestFilter/);
assert.match(adapterSource, /material\.normalMap\.magFilter = THREE\.LinearFilter/);
assert.match(adapterSource, /material\.normalMap\.colorSpace = THREE\.NoColorSpace/);
assert.match(adapterSource, /normalSignX \* 0\.55/);
assert.match(adapterSource, /normalSignY \* 0\.55/);
assert.match(adapterSource, /material\.metalness = 0/);
assert.match(adapterSource, /material\.roughness, 0\.9/);
assert.doesNotMatch(adapterSource, /material\.normalMap\.magFilter = THREE\.NearestFilter/);
assert.match(adapterSource, /no-cast-shadow|no-receive-shadow|no-normal-map|no-directional-shadow|tight-shadow-frustum/);
assert.match(adapterSource, /cachedAssetPromises = new Map/);
assert.match(adapterSource, /loadCachedAsset\(this\.profile\.assetPath\)/);
assert.match(profileSource, /dreadguard_damage_v001_animpack_v003/);
assert.match(profileSource, /\.\/assets\/enemies\/dreadguard\/damage\/dreadguard_damage_v001\.glb/);
assert.match(profileSource, /\.\/assets\/enemies\/dreadguard\/damage\/dreadguard_damage_v001\.json/);
assert.match(profileSource, /\.\/assets\/enemies\/dreadguard\/animations\/dreadguard_animpack_v003\.json/);
assert.match(profileSource, /animationAuthoritative: true/);
assert.match(profileSource, /restPoseAuthoritative: false/);
assert.match(profileSource, /holdingPoseMode: 'exported_rest_pose'/);
assert.match(profileSource, /ignoredEmbeddedAnimationNames: DREADGUARD_IGNORED_GUARD_ANIMATION_NAMES/);
assert.match(profileSource, /targetHeight: 1\.5/);
assert.match(profileSource, /proxyFit/);
assert.match(adapterSource, /measureVisibleSkinnedBounds/);
assert.match(adapterSource, /AnimationMixer/);
assert.ok(adapterSource.indexOf('this.animationController.update(dt)') < adapterSource.indexOf('this.actor.woundSystem?.update?.(dt)'), 'authored animation resolves before skinned wounds');
assert.ok(adapterSource.indexOf('this.actor.woundSystem?.update?.(dt)') < adapterSource.indexOf('this.actor.syncAnimationProxyBodies(this)'), 'semantic proxies sync after the completed authored pose');
assert.match(animationControllerSource, /HURT_LEFT/);
assert.match(animationControllerSource, /HURT_RIGHT/);
assert.match(animationControllerSource, /at least one DEATH clip/);
assert.match(animationControllerSource, /createExportedRestPoseClip/);
assert.match(animationControllerSource, /THREE\.LoopRepeat/);
assert.match(animationControllerSource, /THREE\.LoopOnce/);
assert.match(animationControllerSource, /return_to_previous_state/);
assert.match(animationControllerSource, /hold_final_pose/);
assert.doesNotMatch(animationControllerSource, /Math\.random|Rapier|RigidBody/);
assert.doesNotMatch(adapterSource, /ProceduralPainReaction|applyAfterMixer|mixerAuthoredScales/);
assert.match(actorSource, /if \(this\.visualProfile\.authoredDeathAnimations\) return false;/);
assert.doesNotMatch(combatLabPanelSource, /RAGDOLL Z|forceRagdoll/);
assert.doesNotMatch(actorSource, /throttled_depth_escalation|hardReactionTriggered/);
assert.match(adapterSource, /beginRagdoll/);
assert.match(adapterSource, /updateRagdoll/);
assert.match(adapterSource, /captureRotationOnlyRagdollBinding/);
assert.match(adapterSource, /capturedLocalPosition/);
assert.match(adapterSource, /capturedLocalScale/);
assert.match(actorSource, /setBodyType\(RAPIER\.RigidBodyType\.Dynamic/);
assert.match(actorSource, /rebuildJointsForCurrentAnimatedPose/);
assert.match(actorSource, /maximumJointAnchorSeparation/);
assert.match(actorSource, /!this\.ragdollActive\) this\.visualAdapter\?\.updateAnimationAuthority/);
assert.match(knifeSource, /resolveSlashLeadingPart/);
assert.match(knifeSource, /computeBladeSurfaceCorrection/);
assert.match(collisionSource, /addBlocker/);
assert.match(collisionSource, /circleIntersectsCapsule/);
assert.match(adapterSource, /if \(this\.profile\.animationAuthoritative\) \{/);
assert.match(adapterSource, /this\.initializeAnimationAuthoritative/);
assert.match(adapterSource, /this\.actor\.syncAnimationProxyBodies/);
assert.match(actorSource, /if \(!isHumanoidPoseAuthoritative\(this\.visualProfile\)\) this\.visualAdapter\?\.update/);
assert.doesNotMatch(actorSource, /weathered-angry-male-head|patched-wool-tunic|square-toed-boot|rough-moustache|short-unkempt-beard/);
assert.match(actorSource, /chest_fold|neck_failure|neurological|leg_failure|blood_loss/);
assert.match(woundSource, /vesselInvolvement/);
assert.match(woundSource, /maximumWounds/);
assert.match(woundSource, /pooled-skinned-surface-visual/);
assert.match(woundSource, /slashSamples/);
assert.match(woundSource, /MAX_SLASH_SURFACE_SAMPLES/);
assert.doesNotMatch(woundSource, /new THREE\.PlaneGeometry/);
assert.doesNotMatch(woundSource, /makeWoundTexture|THREE\.DataTexture/);
assert.match(woundSource, /entryMajorMeters/);
assert.match(woundSource, /entryMinorMeters/);
assert.match(woundSource, /entryAreaMetersSquared/);
assert.match(woundSource, /entryTangent/);
assert.match(woundSource, /entryObliqueness/);
assert.match(woundSource, /visualMajorMeters/);
assert.match(woundSource, /visualMinorMeters/);
assert.match(woundSource, /getAlphaBoundUv/);
assert.match(decalLibrarySource, /KNIFE_WOUND_MANIFEST_URL/);
assert.match(decalLibrarySource, /texturesById = new Map/);
assert.match(decalLibrarySource, /materialsById = new Map/);
assert.match(decalLibrarySource, /LinearMipmapLinearFilter/);
assert.match(decalLibrarySource, /ClampToEdgeWrapping/);
assert.match(decalLibrarySource, /alphaTest: 0\.065/);
assert.match(decalLibrarySource, /color: 0xffffff/);
assert.equal(woundManifest.variants.length, 13);
assert.equal(new Set(woundManifest.variants.map((variant) => variant.id)).size, 13);
assert.ok(woundManifest.variants.some((variant) => variant.family === 'puncture'));
assert.ok(woundManifest.variants.some((variant) => variant.family === 'slash'));
assert.match(folsomEncounterSource, /preloadKnifeWoundDecalLibrary/);
assert.match(combatLabSource, /preloadKnifeWoundDecalLibrary/);
assert.match(outdoorLightingSource, /this\.explorationShadowRadius = high \? 72 : 52/);
assert.match(outdoorLightingSource, /this\.combatShadowRadius = high \? 22 : 18/);
assert.match(outdoorLightingSource, /combatFocusEnterDistance = 10/);
assert.match(outdoorLightingSource, /combatFocusExitDistance = 13/);
assert.match(outdoorLightingSource, /Math\.round\(center\.x \/ texel\) \* texel/);
assert.match(outdoorLightingSource, /texel \* 0\.0016/);
assert.match(outdoorLightingSource, /texel \* 0\.32/);
assert.match(outdoorLightingSource, /this\.moon\.castShadow = false/);
assert.match(dungeonSceneSource, /sunrise\.castShadow = false/);
assert.match(surfaceBindingSource, /getVertexPosition/);
assert.match(surfaceBindingSource, /barycentric/);
assert.match(surfaceBindingSource, /triangleIndices/);
assert.match(surfaceBindingSource, /WOUND_SURFACE_BIAS = 0\.0008/);
assert.match(combatLabPanelSource, /ANCHORS A/);
assert.match(combatLabPanelSource, /director\.activeInteractions/);
assert.match(combatLabPanelSource, /weapon\.intent/);
assert.match(combatLabPanelSource, /minimumCenterDistance/);
assert.match(physiologySource, /bloodReserve/);
assert.match(physiologySource, /consciousness/);
assert.match(physiologySource, /interruptBreathing/);
assert.match(bloodSource, /InstancedMesh/);
assert.match(bloodSource, /maximumDecals/);
assert.match(stage2ConfigSource, /fresh: 0xc41222/);
assert.match(stage2ConfigSource, /spray: 0xd41424/);
assert.match(stage2ConfigSource, /arterial: 0xe0182d/);
assert.match(stage2ConfigSource, /slashArterial: 0xf01b32/);
assert.match(folsomEncounterSource, /CHEZWICK_DAMAGE_COMBAT_PROFILE/);
assert.match(folsomEncounterSource, /groundedRespawnSeconds: 15/);
assert.match(folsomEncounterSource, /__DSB_CHEZWICK_DAMAGE__/);
assert.match(folsomEncounterSource, /new FolsomShowcaseCombatExtras/);
assert.match(folsomEncounterSource, /new CombatDirector/);
assert.match(folsomEncounterSource, /applyMeleeSpacingEnvelope/);
assert.match(folsomEncounterSource, /new CombatActorRouter/);
assert.match(folsomEncounterSource, /new CombatLabWalkerController/);
assert.match(folsomEncounterSource, /getPriorityCombatActor/);
assert.match(folsomEncounterSource, /folsomWalker/);
assert.match(folsomEncounterSource, /this\.physics\.step\(deltaSeconds/);
assert.match(folsomEncounterSource, /fadeStarted: false/);
assert.match(folsomEncounterSource, /slot\.elapsed < fadeStart/);
assert.match(folsomEncounterSource, /this\.beginCorpseFade\(actor, bloodEffects\)/);
assert.match(folsomEncounterSource, /setCorpseFadeOpacity/);
assert.match(folsomEncounterSource, /resetCorpseFade/);
assert.doesNotMatch(folsomEncounterSource, /setCorpseOpacity|\.setOpacity\?\./);
assert.match(adapterSource, /setFadeOpacity/);
assert.match(woundSource, /setFadeOpacity/);
assert.match(bloodSource, /setFadeOpacity/);
assert.match(adapterSource, /FULLY_OPAQUE_THRESHOLD/);
assert.match(woundSource, /FULLY_OPAQUE_THRESHOLD/);
assert.match(bloodSource, /FULLY_OPAQUE_THRESHOLD/);
assert.match(combatLabPanelSource, /CUT TEST 6/);
assert.match(stage2ConfigSource, /pooled: 0x850810/);
assert.match(stage2ConfigSource, /olderPool: 0x58050a/);
assert.match(stage2ConfigSource, /dried: 0x2b0205/);
assert.doesNotMatch(woundSource, /emissive\s*:/);
assert.doesNotMatch(bloodSource, /emissive\s*:/);
assert.match(bloodSource, /createBloodChromaMaterial/);
assert.match(decalLibrarySource, /createBloodChromaMaterial/);
assert.match(bloodMaterialSource, /customProgramCacheKey/);
assert.match(bloodMaterialSource, /bloodDiffuseEnergy/);
assert.match(bloodMaterialSource, /bloodMaximumBrightness/);
assert.match(bloodMaterialSource, /toneMapped = false/);
assert.match(bloodMaterialSource, /emissiveIntensity = 0/);
assert.doesNotMatch(bloodMaterialSource, /AdditiveBlending|MeshBasicMaterial/);
assert.match(sceneHostSource, /warmBloodChromaMaterials/);
assert.match(combatLabSource, /blood-lighting/);
assert.match(packageSource, /blood-chroma-material\.test\.mjs/);
assert.match(feedbackSource, /navigator\?\.vibrate/);
assert.match(feedbackSource, /maximumVoices/);
assert.match(folsomEncounterSource, /FOLSOM_DREADGUARD_SPAWN_XZ/);
assert.match(folsomEncounterSource, /resolveCombatMortalityMode/);
assert.match(folsomEncounterSource, /CHEZWICK_DAMAGE_COMBAT_PROFILE/);
assert.doesNotMatch(folsomEncounterSource, /FolsomModelIdleRawReference|modelIdleCombatTest|rawModelReference/);
assert.match(combatLabSource, /DREADGUARD_DAMAGE_COMBAT_PROFILE/);
assert.match(combatLabSource, /new CombatDirector/);
assert.match(combatLabSource, /this\.combatDirector\.beginSlash/);
assert.match(folsomEncounterSource, /__DSB_CHEZWICK_DAMAGE__/);
assert.match(folsomEncounterSource, /Light.*Medium.*Heavy/s);
assert.match(combatLabSource, /resolveCombatMortalityMode/);
assert.match(combatLabSource, /toggleMortalityMode/);
assert.match(combatLabPanelSource, /MORTALITY X/);
assert.match(mortalitySource, /immortal_reactive/);
assert.match(mortalitySource, /combatMortality/);
assert.match(controlSource, /canKnifeCreateOffensiveContact/);
assert.match(controlSource, /withdrawing/);
assert.match(knifeSource, /rebaseFreeWeaponToCamera/);
assert.match(configSource, /bladeLength: 0\.24/);
assert.match(configSource, /handleLength: 0\.13/);
assert.match(configSource, /overallLength: 0\.37/);
assert.match(configSource, /freeSeconds: 0\.15/);
assert.match(configSource, /failedContactSeconds: 0\.19/);
assert.match(packageSource, /@dimforge\/rapier3d-compat/);
assert.match(packageSource, /tests\/combat-walker\.test\.mjs/);
assert.match(packageSource, /tests\/folsom-combat-walker\.test\.mjs/);
assert.match(docsSource, /\?combatLab=1/);
assert.match(docsSource, /Folsom/);
assert.match(docsSource, /Combat Director/);
assert.match(directorDocsSource, /sole orchestration authority/);
assert.match(directorDocsSource, /visual weapon/);
assert.match(directorDocsSource, /collision weapon/);
assert.match(directorDocsSource, /intent weapon/);
assert.match(directorDocsSource, /Adding a future melee weapon/);
assert.match(directorDocsSource, /Melee spacing contract/);
assert.match(directorDocsSource, /ready weapon must still have at least 6 cm/);
assert.match(directorDocsSource, /axe normally uses its ready head reach/);
assert.equal(stage2.woundLimit, 24);

console.log(`Combat vertical slice configuration and integration are valid (${result.bodyCount} bodies, ${result.jointCount} joints, ${result.regionCount} semantic regions, ${stage2.vesselCount} vessel zones, ${stage2.woundLimit} pooled wounds).`);

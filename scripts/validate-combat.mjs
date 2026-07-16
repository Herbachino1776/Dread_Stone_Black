import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCombatConfiguration } from '../src/game/combat/CombatConfig.js';
import { validateCombatStage2Configuration } from '../src/game/combat/CombatStage2Config.js';
import { HUMANOID_ANATOMY_REGIONS } from '../src/game/combat/CombatConfig.js';

const result = validateCombatConfiguration();
const stage2 = validateCombatStage2Configuration(HUMANOID_ANATOMY_REGIONS.map((region) => region.id));
assert.equal(result.bodyCount, 18);
assert.equal(result.jointCount, 17);
assert.ok(result.regionCount >= 20);

const [gameSource, sceneHostSource, viewmodelHostSource, knifeSource, directorSource, presentationSource, cameraFeedbackSource, intentSource, oldViewmodelSource, actorSource, adapterSource, profileSource, woundSource, animationControllerSource, surfaceBindingSource, physiologySource, bloodSource, feedbackSource, folsomEncounterSource, combatLabSource, combatLabPanelSource, mortalitySource, controlSource, configSource, stage2ConfigSource, collisionSource, packageSource, docsSource, directorDocsSource, diagnosticDocsSource, glbBuffer, testmanGlbBuffer, testmanManifestSource, testmanValidationSource] = await Promise.all([
  readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/hosts/SceneSessionHost.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/hosts/FirstPersonViewmodelHost.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/WorldKnifeCombatController.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatDirector.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatPresentation.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/Feedback.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/MeleeIntentWeapon.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/physical-tools/PhysicalToolViewmodel.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/HumanoidCombatActor.js', import.meta.url), 'utf8'),
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
  readFile(new URL('../docs/testman_animpack_v002_diagnostic.md', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/models/npc/human/human_retro_256.glb', import.meta.url)),
  readFile(new URL('../public/assets/enemies/testman/testman_animpack_v002.glb', import.meta.url)),
  readFile(new URL('../public/assets/enemies/testman/testman_animpack_v002.json', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/enemies/testman/testman_animpack_v002_validation.json', import.meta.url), 'utf8'),
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
const testmanGlbJson = parseGlbJson(testmanGlbBuffer);
const testmanManifest = JSON.parse(testmanManifestSource);
const testmanValidation = JSON.parse(testmanValidationSource);
const manifestAnimationNames = testmanManifest.animations.map((animation) => animation.name);
const exportedAnimationNames = testmanGlbJson.animations?.map((animation) => animation.name) ?? [];
assert.equal(testmanManifest.schema, 'dreadstone.animation_pack.v1');
assert.equal(testmanManifest.asset, 'testman_animpack_v002.glb');
assert.equal(testmanManifest.approved_animation_count, 5);
assert.equal(testmanManifest.animations.length, testmanManifest.approved_animation_count);
assert.equal(new Set(manifestAnimationNames).size, manifestAnimationNames.length, 'Testman manifest animation names are unique');
assert.deepEqual(exportedAnimationNames, manifestAnimationNames, 'every manifest animation is discoverable in the v002 GLB');
assert.ok(testmanGlbJson.meshes?.length >= 1, 'Testman v002 GLB contains a mesh');
assert.ok(testmanGlbJson.skins?.length >= 1, 'Testman v002 GLB contains a skin');
assert.ok(testmanGlbJson.meshes.flatMap((mesh) => mesh.primitives).some((primitive) => primitive.attributes.JOINTS_0 != null && primitive.attributes.WEIGHTS_0 != null), 'Testman v002 GLB contains a SkinnedMesh primitive');
assert.ok(testmanGlbJson.animations?.every((animation) => animation.channels.length > 0), 'every Testman v002 animation contains channels');
assert.ok(testmanGlbJson.images?.every((image) => image.bufferView != null), 'Testman v002 textures are embedded');
const testmanNodeNames = new Set(testmanGlbJson.nodes.map((node) => node.name));
['body', 'body_top0', 'body_top1', 'body_top2', 'neck', 'head', 'arm_left_top', 'arm_left_bot', 'arm_left_hand', 'arm_right_top', 'arm_right_bot', 'arm_right_hand', 'leg_left_top', 'leg_left_bot', 'leg_left_foot', 'leg_right_top', 'leg_right_bot', 'leg_right_foot'].forEach((name) => assert.ok(testmanNodeNames.has(name), `required mapped Testman v002 bone exists: ${name}`));
const animationsByKind = testmanManifest.animations.reduce((groups, animation) => {
  if (!groups.has(animation.approved_kind)) groups.set(animation.approved_kind, []);
  groups.get(animation.approved_kind).push(animation);
  return groups;
}, new Map());
assert.equal(animationsByKind.get('WALK')?.length, 1);
assert.ok(animationsByKind.get('WALK').every((animation) => animation.loop && !animation.play_once && !animation.hold_final_pose));
assert.equal(animationsByKind.get('HURT_LEFT')?.length, 1);
assert.equal(animationsByKind.get('HURT_RIGHT')?.length, 1);
assert.ok([...animationsByKind.get('HURT_LEFT'), ...animationsByKind.get('HURT_RIGHT')].every((animation) => !animation.loop && animation.play_once && !animation.hold_final_pose && animation.return_to_previous_state));
assert.equal(animationsByKind.get('DEATH')?.length, 2);
assert.ok(animationsByKind.get('DEATH').every((animation) => !animation.loop && animation.play_once && animation.hold_final_pose && !animation.return_to_previous_state));
testmanManifest.animations.forEach((metadata, index) => {
  const animation = testmanGlbJson.animations[index];
  const bounds = animation.samplers.map((sampler) => testmanGlbJson.accessors[sampler.input]).filter(Boolean);
  const start = Math.min(...bounds.map((accessor) => accessor.min?.[0]).filter(Number.isFinite));
  const end = Math.max(...bounds.map((accessor) => accessor.max?.[0]).filter(Number.isFinite));
  assert.ok(Math.abs((end - start) - metadata.duration_seconds) < 1e-5, `${metadata.name} duration matches its manifest metadata`);
});
assert.equal(testmanValidation.status, 'PASS');
assert.equal(testmanValidation.file_size_bytes, testmanGlbBuffer.length);
assert.deepEqual(testmanValidation.expected_animation_names, manifestAnimationNames);
assert.deepEqual(testmanValidation.exported_animation_names, manifestAnimationNames);
assert.deepEqual(testmanValidation.missing_animations, []);
assert.deepEqual(testmanValidation.unexpected_animations, []);
assert.deepEqual(testmanValidation.duplicate_animation_names, []);
assert.equal(testmanValidation.preview_floor_exported, false);

assert.match(sceneHostSource, /combatLab/);
assert.match(sceneHostSource, /FolsomCombatEncounter/);
assert.match(gameSource, /combatLabEnabled/);
assert.match(gameSource, /if \(this\.combatLabEnabled\) return;/);
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
assert.match(profileSource, /testman_animpack_v002_animation_authoritative/);
assert.match(profileSource, /\.\/assets\/enemies\/testman\/testman_animpack_v002\.glb/);
assert.match(profileSource, /\.\/assets\/enemies\/testman\/testman_animpack_v002\.json/);
assert.match(profileSource, /animationAuthoritative: true/);
assert.match(profileSource, /targetHeight: 1\.82/);
assert.match(profileSource, /proxyFit/);
assert.match(adapterSource, /measureVisibleSkinnedBounds/);
assert.match(adapterSource, /AnimationMixer/);
assert.ok(adapterSource.indexOf('this.animationController.update(dt)') < adapterSource.indexOf('this.actor.woundSystem?.update?.(dt)'), 'authored animation resolves before skinned wounds');
assert.ok(adapterSource.indexOf('this.actor.woundSystem?.update?.(dt)') < adapterSource.indexOf('this.actor.syncAnimationProxyBodies(this)'), 'semantic proxies sync after the completed authored pose');
assert.match(animationControllerSource, /HURT_LEFT/);
assert.match(animationControllerSource, /HURT_RIGHT/);
assert.match(animationControllerSource, /exactly two DEATH clips/);
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
assert.match(actorSource, /if \(!this\.visualProfile\.animationAuthoritative\) this\.visualAdapter\?\.update/);
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
assert.match(folsomEncounterSource, /folsom-testman-stationary-blocker-/);
assert.match(folsomEncounterSource, /TESTMAN_DAMAGE_COMBAT_PROFILE/);
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
assert.match(folsomEncounterSource, /folsom-testman-stationary-/);
assert.match(folsomEncounterSource, /FOLSOM_TESTMAN_SPAWN_XZ/);
assert.match(folsomEncounterSource, /resolveCombatMortalityMode/);
assert.match(folsomEncounterSource, /TESTMAN_DAMAGE_COMBAT_PROFILE/);
assert.doesNotMatch(folsomEncounterSource, /FolsomModelIdleRawReference|modelIdleCombatTest|rawModelReference/);
assert.match(combatLabSource, /TESTMAN_DAMAGE_COMBAT_PROFILE/);
assert.match(combatLabSource, /new CombatDirector/);
assert.match(combatLabSource, /this\.combatDirector\.beginSlash/);
assert.match(diagnosticDocsSource, /testman_animpack_v002\.json.*source of truth/);
assert.match(diagnosticDocsSource, /never drives? the GLB bones/);
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

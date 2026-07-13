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

const [gameSource, sceneHostSource, viewmodelHostSource, knifeSource, directorSource, presentationSource, cameraFeedbackSource, intentSource, oldViewmodelSource, actorSource, adapterSource, profileSource, woundSource, reactionSource, surfaceBindingSource, physiologySource, bloodSource, feedbackSource, folsomEncounterSource, combatLabSource, combatLabPanelSource, mortalitySource, controlSource, configSource, stage2ConfigSource, collisionSource, packageSource, docsSource, directorDocsSource, diagnosticDocsSource, glbBuffer, modelIdleGlbBuffer] = await Promise.all([
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
  readFile(new URL('../src/game/combat/ProceduralPainReaction.js', import.meta.url), 'utf8'),
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
  readFile(new URL('../docs/model_idle_ab_diagnostic.md', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/models/npc/human/human_retro_256.glb', import.meta.url)),
  readFile(new URL('../public/assets/models/npc/human/model_idle.glb', import.meta.url)),
]);
const [decalLibrarySource, outdoorLightingSource, woundManifestSource, walkerSource, actorRouterSource] = await Promise.all([
  readFile(new URL('../src/game/combat/KnifeWoundDecalLibrary.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/world-scene/OutdoorLightingDirector.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatLabWalkerController.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatActorRouter.js', import.meta.url), 'utf8'),
]);
const dungeonSceneSource = await readFile(new URL('../src/game/DungeonScene.js', import.meta.url), 'utf8');
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
const modelIdleGlbJson = parseGlbJson(modelIdleGlbBuffer);
assert.ok(modelIdleGlbJson.meshes?.length >= 1, 'model_idle.glb contains a mesh');
assert.ok(modelIdleGlbJson.skins?.length >= 1, 'model_idle.glb contains a skin');
assert.ok(modelIdleGlbJson.meshes.flatMap((mesh) => mesh.primitives).some((primitive) => primitive.attributes.JOINTS_0 != null && primitive.attributes.WEIGHTS_0 != null), 'model_idle.glb contains a SkinnedMesh primitive');
assert.ok(modelIdleGlbJson.animations?.some((animation) => animation.channels.length > 0), 'model_idle.glb animation metadata is inspected');
assert.ok(modelIdleGlbJson.images?.every((image) => image.bufferView != null), 'model_idle.glb textures are embedded');

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
assert.match(knifeSource, /getProjectedActivePoint/);
assert.match(knifeSource, /contactActivationProvider/);
assert.match(knifeSource, /deliberateInputVelocity/);
assert.match(knifeSource, /offensiveVelocity/);
assert.match(knifeSource, /contactDamageReason/);
assert.match(knifeSource, /gripPointerId/);
assert.match(knifeSource, /releaseGrip/);
assert.match(knifeSource, /assistedWithdrawalRate/);
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
['SPAWNING', 'BLENDING_TO_WALK', 'APPROACHING', 'BLENDING_TO_IDLE', 'NEAR_PLAYER', 'HIT_REACTING', 'LOSING_CONSCIOUSNESS', 'RAGDOLL_HANDOFF', 'RAGDOLL', 'FADING', 'DISPOSED', 'RESPAWNING'].forEach((state) => assert.match(walkerSource, new RegExp(state)));
assert.doesNotMatch(walkerSource, /Math\.random/);
assert.match(walkerSource, /corpseHoldSeconds: 3/);
assert.match(walkerSource, /consciousnessLossSeconds: 2\.8/);
assert.match(walkerSource, /WalkerVitalStabPolicy/);
assert.match(walkerSource, /ProceduralHumanoidLocomotionLayer/);
assert.match(walkerSource, /ProceduralConsciousnessLossLayer/);
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
assert.match(profileSource, /model_idle_animation_authoritative/);
assert.match(profileSource, /\.\/assets\/models\/npc\/human\/model_idle\.glb/);
assert.match(profileSource, /animationAuthoritative: true/);
assert.match(profileSource, /targetHeight: 1\.82/);
assert.match(profileSource, /proxyFit/);
assert.match(adapterSource, /measureVisibleSkinnedBounds/);
assert.match(adapterSource, /AnimationMixer/);
assert.ok(adapterSource.indexOf('this.mixer.update(dt)') < adapterSource.indexOf('this.reactionController?.applyAfterMixer(dt)'), 'AnimationMixer writes the fresh authored pose before additive pain reactions');
assert.ok(adapterSource.indexOf('this.reactionController?.applyAfterMixer(dt)') < adapterSource.indexOf('this.actor.syncAnimationProxyBodies(this)'), 'semantic proxies sync after additive reaction bones and skeleton update');
assert.match(adapterSource, /this\.mixerAuthoredScales/);
assert.doesNotMatch(reactionSource, /\.scale\.(set|copy)|inverseBindMatrices|boneInverses/);
assert.doesNotMatch(reactionSource, /Rapier|RigidBody|translation\(\)|rotation\(\)/);
assert.match(reactionSource, /impact/);
assert.match(reactionSource, /pain_hold/);
assert.match(reactionSource, /recovery/);
assert.match(reactionSource, /maximumBoneAngle/);
assert.match(reactionSource, /embeddedTension/);
assert.match(reactionSource, /embeddedTensionTarget/);
assert.match(reactionSource, /impactMemory/);
assert.match(reactionSource, /variation/);
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
assert.match(surfaceBindingSource, /WOUND_SURFACE_BIAS = 0\.002/);
assert.match(combatLabPanelSource, /ANCHORS A/);
assert.match(combatLabPanelSource, /director\.activeInteractions/);
assert.match(combatLabPanelSource, /weapon\.intent/);
assert.match(combatLabPanelSource, /minimumCenterDistance/);
assert.match(physiologySource, /bloodReserve/);
assert.match(physiologySource, /consciousness/);
assert.match(physiologySource, /interruptBreathing/);
assert.match(bloodSource, /InstancedMesh/);
assert.match(bloodSource, /maximumDecals/);
assert.match(stage2ConfigSource, /fresh: 0x981218/);
assert.match(stage2ConfigSource, /spray: 0xb31b22/);
assert.match(stage2ConfigSource, /arterial: 0xc3242b/);
assert.match(stage2ConfigSource, /slashArterial: 0xff4050/);
assert.match(folsomEncounterSource, /folsom-model-idle-combat-player-blocker/);
assert.match(folsomEncounterSource, /new CombatDirector/);
assert.match(folsomEncounterSource, /applyMeleeSpacingEnvelope/);
assert.match(folsomEncounterSource, /new CombatActorRouter/);
assert.match(folsomEncounterSource, /new ProceduralWalkerController/);
assert.match(folsomEncounterSource, /getPriorityCombatActor/);
assert.match(folsomEncounterSource, /folsomWalker/);
assert.match(folsomEncounterSource, /this\.physics\.step\(deltaSeconds/);
assert.match(combatLabPanelSource, /RAGDOLL Z/);
assert.match(combatLabPanelSource, /CUT TEST 6/);
assert.match(stage2ConfigSource, /dried: 0x2b0305/);
assert.doesNotMatch(woundSource, /emissive\s*:/);
assert.doesNotMatch(bloodSource, /emissive\s*:/);
assert.match(feedbackSource, /navigator\?\.vibrate/);
assert.match(feedbackSource, /maximumVoices/);
assert.match(folsomEncounterSource, /folsom-model-idle-combat-subject/);
assert.match(folsomEncounterSource, /FOLSOM_MODEL_IDLE_SPAWN_XZ/);
assert.match(folsomEncounterSource, /resolveCombatMortalityMode/);
assert.match(folsomEncounterSource, /MODEL_IDLE_COMBAT_PROFILE/);
assert.doesNotMatch(folsomEncounterSource, /FolsomModelIdleRawReference|modelIdleCombatTest|rawModelReference/);
assert.match(combatLabSource, /MODEL_IDLE_COMBAT_PROFILE/);
assert.match(combatLabSource, /new CombatDirector/);
assert.match(combatLabSource, /this\.combatDirector\.beginSlash/);
assert.match(diagnosticDocsSource, /exported idle animation is authoritative/);
assert.match(diagnosticDocsSource, /never drive the GLB bones/);
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
assert.match(configSource, /embeddedMinimumSeconds: 0\.25/);
assert.match(configSource, /embeddedMaximumSeconds: 0\.4/);
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

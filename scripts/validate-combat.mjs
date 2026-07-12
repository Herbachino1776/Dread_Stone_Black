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

const [gameSource, sceneHostSource, viewmodelHostSource, knifeSource, oldViewmodelSource, actorSource, adapterSource, woundSource, physiologySource, bloodSource, feedbackSource, folsomEncounterSource, combatLabSource, combatLabPanelSource, mortalitySource, controlSource, configSource, packageSource, docsSource, glbBuffer] = await Promise.all([
  readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/hosts/SceneSessionHost.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/hosts/FirstPersonViewmodelHost.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/WorldKnifeCombatController.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/physical-tools/PhysicalToolViewmodel.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/HumanoidCombatActor.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/HumanoidGlbVisualAdapter.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatWoundSystem.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatPhysiology.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatBloodEffects.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatFeedbackSystem.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/FolsomCombatEncounter.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatLabScene.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatLabDebugPanel.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatMortality.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/KnifeControlState.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatConfig.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../docs/architecture/PHYSICAL_HUMANOID_COMBAT_FOUNDATION.md', import.meta.url), 'utf8').catch(() => ''),
  readFile(new URL('../public/assets/models/npc/human/human_retro_256.glb', import.meta.url)),
]);

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
assert.doesNotMatch(knifeSource, /getAttackControlState/);
assert.match(viewmodelHostSource, /createToolInputViewmodel/);
assert.match(viewmodelHostSource, /combatRuntime\?\.scene \?\? this\.dungeon\?\.scene/);
assert.match(viewmodelHostSource, /if \(!this\.combatRuntime\)/);
assert.match(viewmodelHostSource, /bindPointerInput: this\.dungeon\?\.isCombatLab === true/);
assert.doesNotMatch(viewmodelHostSource, /setCombatKnifeActive/);
assert.match(viewmodelHostSource, /combatEncounter/);
assert.match(actorSource, /CombatWoundSystem/);
assert.match(actorSource, /CombatPhysiology/);
assert.match(actorSource, /HumanoidGlbVisualAdapter/);
assert.match(adapterSource, /SkeletonUtils/);
assert.match(adapterSource, /HUMANOID_GLB_BONE_MAP/);
assert.match(adapterSource, /LinearMipmapLinearFilter/);
assert.match(adapterSource, /NearestFilter/);
assert.doesNotMatch(actorSource, /weathered-angry-male-head|patched-wool-tunic|square-toed-boot|rough-moustache|short-unkempt-beard/);
assert.match(actorSource, /chest_fold|neck_failure|neurological|leg_failure|blood_loss/);
assert.match(woundSource, /vesselInvolvement/);
assert.match(woundSource, /maximumWounds/);
assert.match(physiologySource, /bloodReserve/);
assert.match(physiologySource, /consciousness/);
assert.match(bloodSource, /InstancedMesh/);
assert.match(bloodSource, /maximumDecals/);
assert.match(feedbackSource, /navigator\?\.vibrate/);
assert.match(feedbackSource, /maximumVoices/);
assert.match(folsomEncounterSource, /folsom-starter-humanoid-combat-subject/);
assert.match(folsomEncounterSource, /new THREE\.Vector3\(-2, 0, 0\)/);
assert.match(folsomEncounterSource, /resolveCombatMortalityMode/);
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
assert.match(docsSource, /\?combatLab=1/);
assert.match(docsSource, /Folsom/);
assert.equal(stage2.woundLimit, 24);

console.log(`Combat vertical slice configuration and integration are valid (${result.bodyCount} bodies, ${result.jointCount} joints, ${result.regionCount} semantic regions, ${stage2.vesselCount} vessel zones, ${stage2.woundLimit} pooled wounds).`);

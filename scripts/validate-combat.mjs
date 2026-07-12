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

const [gameSource, sceneHostSource, viewmodelHostSource, knifeSource, oldViewmodelSource, actorSource, woundSource, physiologySource, bloodSource, feedbackSource, folsomEncounterSource, packageSource, docsSource] = await Promise.all([
  readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/hosts/SceneSessionHost.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/hosts/FirstPersonViewmodelHost.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/WorldKnifeCombatController.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/physical-tools/PhysicalToolViewmodel.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/HumanoidCombatActor.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatWoundSystem.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatPhysiology.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatBloodEffects.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/CombatFeedbackSystem.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/game/combat/FolsomCombatEncounter.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../docs/architecture/PHYSICAL_HUMANOID_COMBAT_FOUNDATION.md', import.meta.url), 'utf8').catch(() => ''),
]);

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
assert.match(oldViewmodelSource, /combatKnifeActive/);
assert.match(viewmodelHostSource, /combatEncounter/);
assert.match(actorSource, /CombatWoundSystem/);
assert.match(actorSource, /CombatPhysiology/);
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
assert.match(packageSource, /@dimforge\/rapier3d-compat/);
assert.match(docsSource, /\?combatLab=1/);
assert.match(docsSource, /Folsom/);
assert.equal(stage2.woundLimit, 24);

console.log(`Combat vertical slice configuration and integration are valid (${result.bodyCount} bodies, ${result.jointCount} joints, ${result.regionCount} semantic regions, ${stage2.vesselCount} vessel zones, ${stage2.woundLimit} pooled wounds).`);

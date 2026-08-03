import { HumanoidCombatActor as HumanoidCombatActorBase } from './HumanoidCombatActorBase.js';

export { RAGDOLL_HANDOFF_LIMITS } from './HumanoidCombatActorBase.js';

// Keep the established actor implementation intact while enforcing the profile-level
// terminal Progressive Damage Site contract. Chezwick's facial sites are authored on
// body_core, so the collider can report a torso region even though the selected Forge
// site is semantically a fatal head site.
export class HumanoidCombatActor extends HumanoidCombatActorBase {
  applyBluntImpact(args = {}) {
    const result = super.applyBluntImpact(args);
    const forgeDamage = result?.forgeDamage;
    const terminalProgressiveDamage = result?.accepted === true
      && forgeDamage?.progressiveSite === true
      && forgeDamage?.terminalStageReached === true
      && this.visualProfile?.terminalProgressiveDamageFatal === true;

    if (
      !terminalProgressiveDamage
      || result.fatalHeadHitTriggered === true
      || this.lifeState === 'dying'
      || this.lifeState === 'dead'
    ) return result;

    const fatalHeadHitTriggered = this.requestFatalMaceHeadImpact({
      hit: args.hit,
      impact: args.impact,
      damageApplied: result.damageApplied,
      forgeDamage,
    });

    return {
      ...result,
      fatalHeadHitTriggered,
      collapseRequested: result.collapseRequested === true || fatalHeadHitTriggered,
    };
  }
}

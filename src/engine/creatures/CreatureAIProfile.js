export class CreatureAIProfile {
  constructor(profile = {}) {
    this.profile = profile;
    this.behaviorType = profile.behaviorType ?? 'passive';
  }
}

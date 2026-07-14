export class WeaponContactRouter {
  constructor({ combatRouter = null, fallbackActor = null, fallbackDirector = null, cameraFeedback = null } = {}) {
    this.combatRouter = combatRouter;
    this.fallbackActor = fallbackActor;
    this.fallbackDirector = fallbackDirector;
    this.cameraFeedback = cameraFeedback;
  }

  ownsCollider(collider) {
    return this.combatRouter?.ownsCollider?.(collider)
      ?? this.fallbackActor?.colliderRegions?.has?.(collider?.handle)
      ?? false;
  }

  resolveTarget(collider, worldPoint) {
    const routed = this.combatRouter?.resolveCollider?.(collider, worldPoint);
    if (routed) {
      if (this.cameraFeedback) routed.director.setCameraFeedback?.(this.cameraFeedback);
      return routed;
    }
    const hit = this.fallbackActor?.resolveHit?.(collider, worldPoint);
    return hit ? { actor: this.fallbackActor, director: this.fallbackDirector, hit } : null;
  }
}

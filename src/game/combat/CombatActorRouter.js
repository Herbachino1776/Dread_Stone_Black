export class CombatActorRouter {
  constructor() {
    this.entriesByActor = new Map();
    this.entriesByColliderHandle = new Map();
  }

  register(actor, director) {
    if (!actor || !director) throw new Error('Combat actor routing requires an actor and director.');
    this.unregister(actor);
    const entry = { actor, director, colliderHandles: new Set() };
    actor.colliders?.forEach?.((collider) => {
      if (!Number.isFinite(collider?.handle)) return;
      entry.colliderHandles.add(collider.handle);
      this.entriesByColliderHandle.set(collider.handle, entry);
    });
    this.entriesByActor.set(actor, entry);
    return entry;
  }

  refresh(actor) {
    const director = this.entriesByActor.get(actor)?.director;
    return director ? this.register(actor, director) : null;
  }

  unregister(actor) {
    const entry = this.entriesByActor.get(actor);
    if (!entry) return false;
    entry.colliderHandles.forEach((handle) => {
      if (this.entriesByColliderHandle.get(handle) === entry) this.entriesByColliderHandle.delete(handle);
    });
    entry.colliderHandles.clear();
    this.entriesByActor.delete(actor);
    return true;
  }

  ownsCollider(collider) {
    const entry = this.entriesByColliderHandle.get(collider?.handle);
    return Boolean(entry && !entry.actor?.disposed && entry.actor?.colliderRegions?.has?.(collider.handle));
  }

  resolveCollider(collider, worldPoint) {
    const entry = this.entriesByColliderHandle.get(collider?.handle);
    if (!entry || entry.actor?.disposed || !entry.actor?.colliderRegions?.has?.(collider.handle)) return null;
    const hit = entry.actor.resolveHit(collider, worldPoint);
    return hit ? { actor: entry.actor, director: entry.director, hit } : null;
  }

  getDirector(actor) {
    return this.entriesByActor.get(actor)?.director ?? null;
  }

  getDiagnostics() {
    return {
      actorCount: this.entriesByActor.size,
      colliderCount: this.entriesByColliderHandle.size,
      actors: [...this.entriesByActor.keys()].map((actor) => actor.instanceId ?? actor.root?.name ?? 'unknown'),
    };
  }

  dispose() {
    this.entriesByActor.clear();
    this.entriesByColliderHandle.clear();
  }
}

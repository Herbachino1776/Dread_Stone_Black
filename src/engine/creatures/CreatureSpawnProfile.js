export class CreatureSpawnProfile {
  constructor(profile = {}) {
    this.profile = profile;
  }

  applyToGroup(group, { position = null, yaw = null } = {}) {
    const spawn = this.profile;
    if (position) group.position.copy(position);
    if (spawn.position && !position) group.position.set(spawn.position.x ?? 0, spawn.position.y ?? 0, spawn.position.z ?? 0);
    group.rotation.y = yaw ?? spawn.yaw ?? group.rotation.y;
  }
}

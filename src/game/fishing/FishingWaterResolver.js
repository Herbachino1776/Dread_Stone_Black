export class FishingWaterResolver {
  constructor({ dungeon }) { this.dungeon = dungeon; }
  resolveFishableWater(position) {
    const zones = this.dungeon?.fieldFishingZones ?? [];
    return zones.find((zone) => {
      if (zone.shape === 'ellipse') {
        const dx = position.x - zone.centerX; const dz = position.z - zone.centerZ;
        return ((dx * dx) / (zone.radiusX * zone.radiusX)) + ((dz * dz) / (zone.radiusZ * zone.radiusZ)) <= 1;
      }
      return position.x >= zone.minX && position.x <= zone.maxX && position.z >= zone.minZ && position.z <= zone.maxZ;
    }) ?? null;
  }
}

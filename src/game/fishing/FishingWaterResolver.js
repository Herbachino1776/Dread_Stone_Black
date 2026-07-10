import { isPointInFishingZone } from './FishingZoneGeometry.js';

export class FishingWaterResolver {
  constructor({ dungeon }) { this.dungeon = dungeon; }
  resolveFishableWater(position) {
    const zones = this.dungeon?.fieldFishingZones ?? [];
    return zones.find((zone) => isPointInFishingZone(position, zone)) ?? null;
  }
}

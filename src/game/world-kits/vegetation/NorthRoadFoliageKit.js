import { OUTDOOR_FOLIAGE_SPRITES } from '../../../engine/outdoor-authoring/OutdoorFoliageRegistry.js';
import { buildOutdoorForestStamp, createForestStampRandom } from '../../../engine/outdoor-authoring/OutdoorForestStampBuilder.js';

function hash(value) { let state = 2166136261; for (const char of String(value)) { state ^= char.charCodeAt(0); state = Math.imul(state, 16777619); } return state >>> 0; }
function randomFactory(seed) { let state = hash(seed); return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }
function distanceToSegment(x, z, from, to) { const dx = to[0] - from[0]; const dz = to[1] - from[1]; const lengthSq = dx * dx + dz * dz; const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / lengthSq)) : 0; return Math.hypot(x - (from[0] + dx * t), z - (from[1] + dz * t)); }
function inZone(x, z, zone, margin=0) {
  if (zone.kind === 'corridor') return zone.points?.slice(0, -1).some((point, index) => distanceToSegment(x, z, point, zone.points[index + 1]) <= (zone.width ?? 4) * 0.5+margin) ?? false;
  if (Number.isFinite(zone.radius)) return Math.hypot(x - zone.center[0], z - zone.center[1]) <= zone.radius+margin;
  if (Number.isFinite(zone.radiusX) && Number.isFinite(zone.radiusZ)) return ((x - zone.center[0]) ** 2) / ((zone.radiusX+margin) ** 2) + ((z - zone.center[1]) ** 2) / ((zone.radiusZ+margin) ** 2) <= 1;
  return Number.isFinite(zone.minX) && x >= zone.minX-margin && x <= zone.maxX+margin && z >= zone.minZ-margin && z <= zone.maxZ+margin;
}

const spriteById = new Map(OUTDOOR_FOLIAGE_SPRITES.map((sprite) => [sprite.id, sprite]));
const sizeFor = (id, random) => {
  if (id.includes('bush')) return { height: 1.25 + random() * 1.3, widthRatio: 0.9 };
  if (id.includes('redwood')) return { height: 17 + random() * 10, widthRatio: spriteById.get(id)?.width ?? 0.7 };
  if (id.includes('dark_grove')) return { height: 10 + random() * 7, widthRatio: spriteById.get(id)?.width ?? 0.75 };
  return { height: 6 + random() * 7, widthRatio: spriteById.get(id)?.width ?? 0.82 };
};

export const NORTH_ROAD_FOLIAGE_COMMUNITIES = Object.freeze({
  redwoodUpland: Object.freeze(['billboard_tree_redwood_cathedral_01', 'billboard_tree_redwood_tiered_sacred_01', 'billboard_tree_redwood_moss_draped_01', 'billboard_tree_redwood_umbrella_crown_01', 'billboard_tree_redwood_ancient_carved_01', 'billboard_bush_dead_scrub_01', 'billboard_bush_dark_bramble_01']),
  creekLowland: Object.freeze(['billboard_tree_pale_ashen_willow_01', 'billboard_bush_ritual_seedpod_01', 'billboard_bush_dark_bramble_01', 'billboard_bush_dead_scrub_01']),
  churchGrove: Object.freeze(['billboard_tree_black_cypress_01', 'billboard_tree_gnarled_ritual_01', 'billboard_tree_thorn_crowned_01', 'folsom_dark_grove_tree_05_mossy_roots', 'folsom_dark_grove_tree_06_twisted_deadwood', 'billboard_bush_dark_bramble_01']),
  scoutRidge: Object.freeze(['billboard_tree_windswept_field_01', 'billboard_tree_thorn_crowned_01', 'billboard_bush_dead_scrub_01']),
  hunterHollow: Object.freeze(['billboard_tree_redwood_moss_draped_01', 'billboard_tree_redwood_umbrella_crown_01', 'billboard_tree_pale_ashen_willow_01', 'billboard_bush_dead_scrub_01', 'billboard_bush_dark_bramble_01']),
  bentRoad: Object.freeze(['folsom_dark_grove_tree_02_tall_spire', 'folsom_dark_grove_tree_06_twisted_deadwood', 'folsom_dark_grove_tree_07_haunted_sentinel', 'billboard_tree_gnarled_ritual_01', 'billboard_bush_dark_bramble_01']),
  fortApproach: Object.freeze(['billboard_tree_windswept_field_01', 'billboard_bush_dead_scrub_01', 'billboard_tree_redwood_umbrella_crown_01']),
});

export function createNorthRoadFoliage({ communities = [], avoidZones = [], bounds = { minX: -245, maxX: 245, minZ: -595, maxZ: 595 } } = {}) {
  const usedVariantIds = new Set(); const placements = []; const summaries = []; const rejected = [];
  communities.forEach((community) => {
    const random = createForestStampRandom(community.seed ?? community.id);
    const pool = NORTH_ROAD_FOLIAGE_COMMUNITIES[community.preset] ?? NORTH_ROAD_FOLIAGE_COMMUNITIES.redwoodUpland;
    const canopyPool=pool.filter(id=>!id.includes('bush')),understoryPool=pool.filter(id=>id.includes('bush'));const understoryCount=Math.round(community.count*(community.preset==='scoutRidge'?.34:.27));
    const stamp=buildOutdoorForestStamp({id:community.id,preset:community.preset,seed:community.seed,shape:{kind:'ellipse',center:community.center,radiusX:community.radiusX,radiusZ:community.radiusZ},canopy:{count:community.count-understoryCount,minimumSpacing:community.preset==='scoutRidge'?3.6:2.55,clusterCount:community.clusterCount,clusterRadius:community.clusterRadius},understory:{count:understoryCount,minimumSpacing:1.2},terrain:{maximumSlope:community.maximumSlope??.48},composition:{clearingCount:community.clearingCount??(community.id.includes('church')?2:1),clearingRadius:community.clearingRadius??(community.id.includes('fort')?12:8)}},{isExcluded:(x,z)=>x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ||avoidZones.some(zone=>inZone(x,z,zone,2.5))});
    stamp.placements.forEach((candidate)=>{
      const layerPool=candidate.layer==='understory'&&understoryPool.length?understoryPool:canopyPool.length?canopyPool:pool;const variantId=layerPool[Math.floor(random()*layerPool.length)]; const sprite = spriteById.get(variantId);
      if (!sprite) return;
      usedVariantIds.add(variantId); const size = sizeFor(variantId, random);
      placements.push(Object.freeze({ id:candidate.id, communityId: community.id,forestStampId:community.id,clusterIndex:candidate.clusterIndex,stampLayer:candidate.layer, variantId, spritePath: sprite.path, position: [Number(candidate.x.toFixed(3)), 0, Number(candidate.z.toFixed(3))], height: Number(size.height.toFixed(3)), width: Number((size.height * size.widthRatio).toFixed(3)), yawOffset: Number(((random() - 0.5) * 0.22).toFixed(3)), groundOffset: sprite.groundOffset, rootOffsetY: sprite.rootOffsetY, bottomTransparentPaddingRatio: sprite.bottomTransparentPaddingRatio ?? 0, sinkIntoGround:sprite.sinkIntoGround,rootFootprintRadius:sprite.rootFootprintRadius,maximumPlacementSlope:sprite.maximumPlacementSlope,placementCategory:sprite.placementCategory, harvestable: false, layer: variantId.includes('redwood') ? 'redwood' : 'ecological', tags: ['north-road-foliage','forest-stamp', `community:${community.id}`, community.preset] }));
    });
    rejected.push(...stamp.debug.rejected.slice(0,Math.max(0,240-rejected.length)).map(item=>({...item,communityId:community.id})));summaries.push(Object.freeze({ id: community.id, preset: community.preset, requested: community.count, accepted:stamp.debug.accepted,attempts:stamp.debug.attempts,rejectedByExclusion:stamp.debug.rejected.filter(r=>r.reason==='exclusion').length,rejectedByBounds:0,bounds: { center: [...community.center], radiusX: community.radiusX, radiusZ: community.radiusZ },clusterCenters:stamp.debug.clusters,glades:stamp.debug.glades,layers:stamp.debug.layers }));
  });
  const variants = [...usedVariantIds].map((id) => Object.freeze({ id, ...spriteById.get(id) }));
  return Object.freeze({ variants: Object.freeze(variants), placements: Object.freeze(placements), summaries: Object.freeze(summaries), rejected: Object.freeze(rejected), debug: Object.freeze({ forestStampCount:summaries.length,communityCount: summaries.length, acceptedCount: placements.length,gladeCount:summaries.reduce((n,s)=>n+s.glades.length,0),clusterCount:summaries.reduce((n,s)=>n+s.clusterCenters.length,0), rejectedSampleCount: rejected.length, deterministic: true, exclusions: avoidZones.length }) });
}

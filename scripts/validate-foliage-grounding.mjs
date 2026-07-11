import assert from 'node:assert/strict';
import { OUTDOOR_FOLIAGE_SPRITES } from '../src/engine/outdoor-authoring/OutdoorFoliageRegistry.js';
const fields=['groundOffset','rootOffsetY','bottomTransparentPaddingRatio','sinkIntoGround','rootFootprintRadius','maximumPlacementSlope','placementCategory'];
OUTDOOR_FOLIAGE_SPRITES.forEach(sprite=>fields.forEach(field=>assert.ok(sprite[field]!==undefined,`${sprite.id} missing ${field}`)));
assert.ok(OUTDOOR_FOLIAGE_SPRITES.filter(s=>s.type==='redwood').every(s=>s.rootFootprintRadius>=.16));
console.log(`Foliage grounding validation PASS: ${OUTDOOR_FOLIAGE_SPRITES.length} registry sprites have complete calibrated metadata.`);

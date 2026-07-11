import assert from 'node:assert/strict';
import { sampleFoliageRootFootprint } from '../src/engine/outdoor-authoring/OutdoorFoliageGrounding.js';
const metadata={rootFootprintRadius:.2,maximumPlacementSlope:.45,sinkIntoGround:.12,bottomTransparentPaddingRatio:.05,groundOffset:0,rootOffsetY:-.04};
const flat=sampleFoliageRootFootprint({terrainSampler:{sampleOutdoorY:()=>2},x:0,z:0,height:10,width:6,metadata});assert.equal(flat.status,'valid');assert.equal(flat.centerGroundY,2);assert.ok(Math.abs((flat.positionY+flat.appliedPaddingOffset)-1.84)<1e-8);
const slope=sampleFoliageRootFootprint({terrainSampler:{sampleOutdoorY:(x)=>2+x*.2},x:0,z:0,height:10,width:6,metadata});assert.equal(slope.status,'adjusted');assert.ok(slope.positionY<=slope.centerGroundY-flat.appliedPaddingOffset);
const steep=sampleFoliageRootFootprint({terrainSampler:{sampleOutdoorY:(x)=>2+x*2},x:0,z:0,height:10,width:6,metadata});assert.equal(steep.status,'rejected');
console.log('Foliage root-footprint grounding: flat, slope adjustment and steep rejection PASS');

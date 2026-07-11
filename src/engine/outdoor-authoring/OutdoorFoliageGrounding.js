const SAMPLE_DIRECTIONS=Object.freeze([[0,0],[0,-1],[0,1],[1,0],[-1,0],[.707,-.707],[-.707,-.707],[.707,.707],[-.707,.707]]);
export function sampleFoliageRootFootprint({terrainSampler,x,z,height,width,metadata}){
  const radius=Math.max(.08,(metadata.rootFootprintRadius??.14)*Math.min(width,height));
  const samples=SAMPLE_DIRECTIONS.map(([dx,dz])=>({x:x+dx*radius,z:z+dz*radius,y:terrainSampler.sampleOutdoorY(x+dx*radius,z+dz*radius)}));
  if(samples.some(s=>!Number.isFinite(s.y)))return{status:'missing-metadata',samples,radius};
  const centerGroundY=samples[0].y,rootSampleMinY=Math.min(...samples.map(s=>s.y)),rootSampleMaxY=Math.max(...samples.map(s=>s.y));
  const localGroundVariance=rootSampleMaxY-rootSampleMinY,localSlope=localGroundVariance/(radius*2);
  const limit=metadata.maximumPlacementSlope??.45;const status=localSlope>limit*1.25?'rejected':localSlope>limit?'slope-warning':localGroundVariance>.08?'adjusted':'valid';
  const appliedRootOffset=(metadata.groundOffset??0)+(metadata.rootOffsetY??0);
  const maximumBurial=metadata.placementCategory?.includes('bush') ? .18 : .35;
  const requestedBurial=(metadata.sinkIntoGround??.1)+(status==='adjusted'?Math.min(.05,localGroundVariance*.18):0);
  const appliedBurial=Math.max(0,Math.min(requestedBurial,maximumBurial+appliedRootOffset));
  const appliedPaddingOffset=height*(metadata.bottomTransparentPaddingRatio??0);
  const positionY=rootSampleMinY+appliedRootOffset-appliedBurial-appliedPaddingOffset;
  return{centerGroundY,rootSampleMinY,rootSampleMaxY,localGroundVariance,localSlope,appliedRootOffset,appliedPaddingOffset,appliedBurial,positionY,radius,samples,status};
}

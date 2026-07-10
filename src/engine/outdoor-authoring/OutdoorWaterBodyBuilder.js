const round = (value) => Number(value.toFixed(4));

export function pointInOutdoorWaterOutline(x, z, outline = []) {
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index, index += 1) {
    const [xi, zi] = outline[index]; const [xj, zj] = outline[previous];
    if (((zi > z) !== (zj > z)) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function radialDistance(center, point) {
  return Math.hypot(point[0] - center[0], point[1] - center[1]);
}

export function createOutdoorWaterBodyShorelineProfile({ id, center, footprint, layers, bands = {} }) {
  const waterOutline = footprint.waterOutline ?? [];
  const mudBedOutline = footprint.mudBedOutline ?? [];
  const outerShoreOutline = footprint.outerShoreOutline ?? [];
  if (waterOutline.length < 3 || mudBedOutline.length !== waterOutline.length || outerShoreOutline.length !== waterOutline.length) throw new Error(`Water body ${id} needs matching water, mud, and outer-shore outlines.`);
  const nestingErrors = waterOutline.reduce((count, waterPoint, index) => {
    const waterRadius = radialDistance(center, waterPoint);
    const mudRadius = radialDistance(center, mudBedOutline[index]);
    const shoreRadius = radialDistance(center, outerShoreOutline[index]);
    return count + (waterRadius > mudRadius + 0.001 || mudRadius > shoreRadius + 0.001 ? 1 : 0);
  }, 0);
  const profile = {
    id, kind: 'closed-water-body-shoreline', sourceOutline: 'single-irregular-water-footprint',
    layers: Object.freeze([
      { id: 'deep-basin', y: layers.waterFloorY, outline: waterOutline },
      { id: 'submerged-floor', y: layers.innerMudY, outline: waterOutline },
      { id: 'submerged-shelf', y: layers.waterY - (layers.visibleShelfDepth ?? 0.05), outline: waterOutline },
      { id: 'waterline', y: layers.waterY, outline: footprint.visualWaterOutline ?? waterOutline },
      { id: 'exposed-mud-shelf', y: layers.mudBedY, outline: mudBedOutline },
      { id: 'wet-bank', y: layers.wetShoreY, outline: outerShoreOutline },
      { id: 'dry-transition-bank', y: layers.outerBankY, outline: footprint.terrainSupportOutline ?? outerShoreOutline },
    ]),
    bands: Object.freeze({ submergedShelfWidth: bands.submergedShelfWidth ?? 0.5, exposedMudWidth: bands.exposedMudWidth ?? footprint.mudOffset, wetBankWidth: bands.wetBankWidth ?? footprint.outerShoreOffset, dryTransitionWidth: bands.dryTransitionWidth ?? footprint.terrainSafetyMargin }),
    validation: Object.freeze({ nestingErrors, outlineVertexCount: waterOutline.length, waterBelowMud: layers.waterY < layers.mudBedY, mudBelowWetBank: layers.mudBedY <= layers.wetShoreY, terrainSafetyGap: round(layers.terrainMaxY - layers.wetShoreY), oneSourceOutline: true }),
  };
  return Object.freeze(profile);
}

export function auditOutdoorWaterBodyTerrain(body, terrainSampler) {
  const footprint = body?.footprint ?? {};
  const waterOutline = footprint.waterOutline ?? [];
  const outerOutline = footprint.outerShoreOutline ?? [];
  if (!waterOutline.length || typeof terrainSampler?.sampleOutdoorY !== 'function') return Object.freeze({ ok: false, errors: ['missing-outline-or-sampler'] });
  let maximumWaterBedError = 0;
  let dryWaterSamples = 0;
  const center = body.center;
  const samples = [center, ...waterOutline.map(([x, z]) => [(x + center[0]) * 0.5, (z + center[1]) * 0.5])];
  samples.forEach(([x, z]) => {
    const terrainY = terrainSampler.sampleOutdoorY(x, z);
    maximumWaterBedError = Math.max(maximumWaterBedError, Math.max(0, terrainY - (body.y - 0.025)));
    if (terrainY >= body.y) dryWaterSamples += 1;
  });
  const bankSamples = outerOutline.map(([x, z]) => terrainSampler.sampleOutdoorY(x, z));
  const maximumBankStep = bankSamples.length ? Math.max(...bankSamples) - Math.min(...bankSamples) : 0;
  return Object.freeze({ ok: dryWaterSamples === 0 && body.shorelineProfile?.validation?.nestingErrors === 0, waterSampleCount: samples.length, dryWaterSamples, maximumWaterBedError: round(maximumWaterBedError), maximumBankStep: round(maximumBankStep), shorelineLayers: body.shorelineProfile?.layers?.length ?? 0 });
}

export function createOutdoorFishingBankMetadata(body, lanes = []) {
  const [rx, rz] = body.radius;
  return Object.freeze(lanes.map((lane, index) => {
    const angle = lane.angle ?? 0;
    const edge = 1 / Math.sqrt((Math.cos(angle) ** 2) / (rx ** 2) + (Math.sin(angle) ** 2) / (rz ** 2));
    const standingDistance = edge + body.shoreWidth + 1.1;
    return Object.freeze({ id: `${body.id}_casting_bank_${index + 1}`, position: [round(body.center[0] + Math.cos(angle) * standingDistance), round(body.center[1] + Math.sin(angle) * standingDistance)], angle, laneWidth: lane.width ?? 0.65, reason: lane.reason ?? 'authored casting bank', stableStandingSurface: true, noFoliageRadius: Math.max(4, body.shoreWidth + 2.5) });
  }));
}

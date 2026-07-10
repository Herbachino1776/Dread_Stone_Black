function distanceToSegment(point, from, to) {
  const dx = to[0] - from[0]; const dz = to[1] - from[1]; const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((point.x - from[0]) * dx + (point.z - from[1]) * dz) / lengthSq)) : 0;
  return { distance: Math.hypot(point.x - (from[0] + dx * t), point.z - (from[1] + dz * t)), t };
}

export function isPointInFishingZone(position, zone, margin = 0) {
  if (!position || !zone) return false;
  if (zone.shape === 'ellipse') {
    const dx = position.x - zone.centerX; const dz = position.z - zone.centerZ; const rx = zone.radiusX + margin; const rz = zone.radiusZ + margin;
    return rx > 0 && rz > 0 && ((dx * dx) / (rx * rx)) + ((dz * dz) / (rz * rz)) <= 1;
  }
  if (zone.shape === 'corridor' && zone.points?.length >= 2) {
    return zone.points.slice(0, -1).some((from, index) => {
      const result = distanceToSegment(position, from, zone.points[index + 1]);
      const width = (zone.widths?.[index] ?? 1) + ((zone.widths?.[index + 1] ?? zone.widths?.[index] ?? 1) - (zone.widths?.[index] ?? 1)) * result.t;
      return result.distance <= Math.max(0, width + margin);
    });
  }
  if (zone.shape === 'polygon' && zone.points?.length >= 3) {
    let inside = false;
    for (let index = 0, previous = zone.points.length - 1; index < zone.points.length; previous = index, index += 1) {
      const [xi, zi] = zone.points[index]; const [xj, zj] = zone.points[previous];
      if (((zi > position.z) !== (zj > position.z)) && position.x < ((xj - xi) * (position.z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    if (inside || margin <= 0) return inside;
    return zone.points.some(([x, z]) => Math.hypot(position.x - x, position.z - z) <= margin);
  }
  return position.x >= zone.minX - margin && position.x <= zone.maxX + margin && position.z >= zone.minZ - margin && position.z <= zone.maxZ + margin;
}

export function sampleFishingZoneWaterY(position, zone) {
  if (!position || !zone?.waterProfile?.length) return zone?.position?.y;
  let nearest = null;
  for (let index = 0; index < zone.waterProfile.length - 1; index += 1) {
    const from = zone.waterProfile[index]; const to = zone.waterProfile[index + 1];
    const result = distanceToSegment(position, [from.x, from.z], [to.x, to.z]);
    if (!nearest || result.distance < nearest.distance) nearest = { distance: result.distance, y: from.y + (to.y - from.y) * result.t };
  }
  return nearest?.y ?? zone.waterProfile[0].y ?? zone.position?.y;
}

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const FRAME_PATHS = [1, 2, 3, 4, 5, 6].map((frame) => `public/assets/sprites/fire/campfire_flame_billboard_${String(frame).padStart(2, '0')}.png`);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BYTES_PER_PIXEL = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]);
const COLOR_TYPE_LABELS = new Map([[0, 'grayscale'], [2, 'rgb'], [3, 'indexed'], [4, 'grayscale-alpha'], [6, 'rgba']]);

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

function decodePng(filePath) {
  const source = fs.readFileSync(filePath);
  if (!source.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${filePath} is not a PNG file.`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.subarray(offset + 4, offset + 8).toString('ascii');
    const chunk = source.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
    } else if (type === 'IDAT') {
      idat.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (bitDepth !== 8) throw new Error(`${filePath} uses unsupported ${bitDepth}-bit PNG channels.`);
  if (!BYTES_PER_PIXEL.has(colorType)) throw new Error(`${filePath} uses unsupported PNG color type ${colorType}.`);

  const bytesPerPixel = BYTES_PER_PIXEL.get(colorType);
  const stride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const rows = [];
  let readOffset = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[readOffset];
    readOffset += 1;
    const scanline = inflated.subarray(readOffset, readOffset + stride);
    readOffset += stride;
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`${filePath} uses unsupported PNG filter ${filter}.`);
      row[x] = (scanline[x] + predictor) & 0xff;
    }
    rows.push(row);
    previous = row;
  }
  return { width, height, colorType, colorTypeLabel: COLOR_TYPE_LABELS.get(colorType), bytesPerPixel, rows };
}

function alphaAt(png, x, y) {
  if (png.colorType === 6) return png.rows[y][x * png.bytesPerPixel + 3];
  if (png.colorType === 4) return png.rows[y][x * png.bytesPerPixel + 1];
  return 255;
}

function audit(filePath) {
  const png = decodePng(filePath);
  let alpha0 = 0;
  let alphaMid = 0;
  let alpha255 = 0;
  let transparentEdgePixels = 0;
  let edgePixels = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = alphaAt(png, x, y);
      if (alpha === 0) alpha0 += 1;
      else if (alpha === 255) alpha255 += 1;
      else alphaMid += 1;
      if (x === 0 || y === 0 || x === png.width - 1 || y === png.height - 1) {
        edgePixels += 1;
        if (alpha === 0) transparentEdgePixels += 1;
      }
    }
  }
  const corners = [alphaAt(png, 0, 0), alphaAt(png, png.width - 1, 0), alphaAt(png, 0, png.height - 1), alphaAt(png, png.width - 1, png.height - 1)];
  const hasAlpha = png.colorType === 4 || png.colorType === 6;
  const effectivelyOpaque = !hasAlpha || (alpha0 === 0 && alphaMid === 0) || alpha255 / (png.width * png.height) > 0.985;
  return { file: filePath, width: png.width, height: png.height, colorType: png.colorTypeLabel, hasAlpha, alpha0, alpha1To254: alphaMid, alpha255, transparentCorners: corners.every((alpha) => alpha === 0), transparentEdgePixels, edgePixels, effectivelyOpaque };
}

const results = FRAME_PATHS.map((framePath) => audit(path.resolve(framePath)));
for (const result of results) {
  console.log(`${path.relative(process.cwd(), result.file)}: ${result.width}x${result.height}, ${result.colorType}, hasAlpha=${result.hasAlpha}, alpha0=${result.alpha0}, alpha1-254=${result.alpha1To254}, alpha255=${result.alpha255}, transparentCorners=${result.transparentCorners}, transparentEdge=${result.transparentEdgePixels}/${result.edgePixels}, effectivelyOpaque=${result.effectivelyOpaque}`);
}

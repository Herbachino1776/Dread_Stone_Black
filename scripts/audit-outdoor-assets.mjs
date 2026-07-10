import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ASSET_ROOT = path.join(ROOT, 'public', 'assets');
const SOURCE_ROOTS = ['src', 'scripts', 'tests', 'docs'];
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const OUTDOOR_HINT = /(terrain|outdoor|dirt|mud|grass|rock|cliff|stone|masonry|ruin|wood|roof|wall|gate|metal|cloth|water|foliage|decal|growth)/i;

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(absolute) : [absolute];
    });
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function readPngMetadata(file) {
  if (path.extname(file).toLowerCase() !== '.png') return { dimensions: 'unknown', alpha: 'unknown' };
  const bytes = fs.readFileSync(file);
  if (bytes.length < 26 || bytes.toString('ascii', 1, 4) !== 'PNG') return { dimensions: 'invalid', alpha: 'unknown' };
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colorType = bytes[25];
  return { dimensions: `${width}x${height}`, alpha: [4, 6].includes(colorType) || bytes.includes(Buffer.from('tRNS')) ? 'yes' : 'no' };
}

function categoryFor(assetPath) {
  const value = assetPath.toLowerCase();
  if (value.includes('/water/')) return 'water';
  if (value.includes('/foliage/') || value.includes('grass') || value.includes('bush') || value.includes('tree')) return 'foliage';
  if (/(dirt|mud|terrain|field_)/.test(value)) return 'terrain';
  if (/(rock|cliff|stone|masonry|ruin)/.test(value)) return 'structure';
  if (/(wood|roof|wall|gate|metal|cloth)/.test(value)) return 'structure';
  if (/(decal|growth|effect)/.test(value)) return 'utility';
  return 'other';
}

const sourceFiles = SOURCE_ROOTS.flatMap((root) => walk(path.join(ROOT, root)))
  .filter((file) => /\.(?:js|mjs|ts|md|json)$/.test(file));
const sourceText = sourceFiles.map((file) => [relative(file), fs.readFileSync(file, 'utf8')]);
const assets = walk(ASSET_ROOT)
  .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
  .filter((file) => OUTDOOR_HINT.test(relative(file)))
  .map((file) => {
    const assetPath = relative(file);
    const publicPath = assetPath.replace(/^public\//, './');
    const basename = path.basename(file);
    const references = sourceText.filter(([, text]) => text.includes(publicPath) || text.includes(basename)).map(([name]) => name);
    const registryReferences = references.filter((name) => /Registry|Profiles|definition/.test(name));
    const runtimeConsumers = references.filter((name) => name.startsWith('src/') && !registryReferences.includes(name));
    return {
      path: assetPath,
      ...readPngMetadata(file),
      category: categoryFor(assetPath),
      registered: registryReferences.length ? 'yes' : 'no',
      registryReferences: registryReferences.join(',') || '-',
      runtimeConsumers: runtimeConsumers.join(',') || '-',
    };
  });

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ generatedFrom: 'repository-scan', assetCount: assets.length, assets }, null, 2)}\n`);
} else {
  process.stdout.write('path\tdimensions\talpha\tcategory\tregistered\tregistryReferences\truntimeConsumers\n');
  assets.forEach((asset) => process.stdout.write(`${asset.path}\t${asset.dimensions}\t${asset.alpha}\t${asset.category}\t${asset.registered}\t${asset.registryReferences}\t${asset.runtimeConsumers}\n`));
  const summary = Object.groupBy(assets, (asset) => asset.category);
  process.stderr.write(`Outdoor asset audit: ${assets.length} images; ${Object.entries(summary).map(([key, rows]) => `${key}=${rows.length}`).join(', ')}\n`);
}

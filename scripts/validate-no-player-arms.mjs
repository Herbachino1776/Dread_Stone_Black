import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkedRoots = ['src', 'public'].map((entry) => path.join(repoRoot, entry));
const bannedPathFragments = [
  'assets/player/arms',
  'FirstPersonArmsOverlay',
  'fpv/FPVEquipmentRenderer',
  'fpv/fpvWeaponProfiles',
];
const bannedRuntimePatterns = [
  /FirstPersonArmsOverlay/,
  /FPVEquipmentRenderer/,
  /fpvWeaponProfiles/,
  /fpvProfileId/,
  /armsOverlay/,
  /data-arms-/,
  /data-arms=/,
  /data-fpv-/,
  /first-person-arms/,
  /first-person-weapon/,
  /first-person-offhand/,
  /player\/arms/,
  /arms_base_idle_strip_01/,
];
const textExtensions = new Set(['.js', '.mjs', '.ts', '.tsx', '.jsx', '.css', '.html', '.json']);
const failures = [];

function walk(currentPath) {
  const stats = fs.statSync(currentPath);
  const relativePath = path.relative(repoRoot, currentPath).replaceAll(path.sep, '/');

  if (bannedPathFragments.some((fragment) => relativePath.includes(fragment))) {
    failures.push(`player arm asset/code path remains: ${relativePath}`);
  }

  if (stats.isDirectory()) {
    for (const entry of fs.readdirSync(currentPath)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(path.join(currentPath, entry));
    }
    return;
  }

  if (!textExtensions.has(path.extname(currentPath))) return;
  const source = fs.readFileSync(currentPath, 'utf8');
  for (const pattern of bannedRuntimePatterns) {
    if (pattern.test(source)) failures.push(`${relativePath} still matches ${pattern}`);
  }
}

for (const root of checkedRoots) {
  if (fs.existsSync(root)) walk(root);
}

if (failures.length) {
  console.error('Player arm sprite removal invalid:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Player arm sprite removal validation passed. No viewport arm/hand sprite assets or runtime references remain.');

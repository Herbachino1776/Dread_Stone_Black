import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const runtimeRoots = ['src/game', 'src/engine'].map((path) => join(root, path));
const ignoredPathParts = new Set(['fishing', 'locations/generated']);
const ignoredFiles = new Set([
  'src/game/GameState.js', // save repair intentionally strips pre-purge rusted_sword snapshots
]);

const bannedPatterns = [
  [/Broadsword|broadsword/, 'broadsword viewmodel/combat runtime'],
  [/GiantRam|RamMan|ramMan|ensureGiantRamManFieldManifestation/, 'Ram Man manifestation runtime'],
  [/spawnEnemy|spawnNpc/, 'enemy/NPC spawn runtime'],
  [/\bhostile\b/i, 'hostile AI runtime'],
  [/\bfaction\b/i, 'faction/warring runtime'],
  [/\bgore\b/i, 'gore runtime'],
  [/attackResolved|emitAttack/, 'equipment attack event runtime'],
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) yield* walk(path);
    else if (/\.(js|mjs|ts)$/.test(entry)) yield path;
  }
}

const failures = [];
for (const base of runtimeRoots) {
  for (const file of walk(base)) {
    const rel = relative(root, file).replaceAll('\\\\', '/');
    if (ignoredFiles.has(rel)) continue;
    if ([...ignoredPathParts].some((part) => rel.includes(`/${part}/`))) continue;
    const text = readFileSync(file, 'utf8');
    for (const [pattern, label] of bannedPatterns) {
      if (pattern.test(text)) failures.push(`${rel}: ${label} (${pattern})`);
    }
  }
}

assert.equal(failures.length, 0, `Player + Fish baseline contains removed runtime residue:\n${failures.join('\n')}`);
console.log('Player + Fish baseline has no banned enemy/NPC/gore/faction/broadsword runtime residue.');

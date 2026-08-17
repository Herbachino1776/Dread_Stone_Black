import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { FORGE_WEAPON_CLASSES } from '../src/contracts/ForgeRuntimeArmament.js';
import { importWeaponGlb } from './weapon-import-lib.mjs';

const args = process.argv.slice(2);
const files = args.filter((arg) => !arg.startsWith('--'));
const classArg = args.find((arg) => arg.startsWith('--class='))?.slice('--class='.length)?.toUpperCase();
if (!files.length) {
  console.error('Drag one or more weapon GLB files onto IMPORT_WEAPON.cmd.');
  process.exitCode = 1;
} else {
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    for (const filename of files) {
      let weaponClass = classArg;
      if (!FORGE_WEAPON_CLASSES.includes(weaponClass)) {
        stdout.write(`\n${filename}\n`);
        FORGE_WEAPON_CLASSES.forEach((entry, index) => stdout.write(`  ${index + 1}. ${entry}\n`));
        const answer = await terminal.question('Weapon class number: ');
        weaponClass = FORGE_WEAPON_CLASSES[Number(answer) - 1];
      }
      const result = await importWeaponGlb(filename, { weaponClass });
      stdout.write(`Imported ${result.definition.displayName}\n`);
      stdout.write(`  Creature Lab weapon: ${result.definition.weaponId}\n`);
      stdout.write(`  Generated loadout: ${result.loadout.loadoutId}\n`);
      stdout.write('  Tune scale, grip, and capsule in Creature Lab, then save an Enemy Preset.\n');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally { terminal.close(); }
}

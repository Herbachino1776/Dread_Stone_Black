import { sheepDemonGoreProfile } from './sheepDemonGore.config.js';
import { neckManGoreProfile } from './neckManGore.config.js';
import { weaponGoreProfiles } from './weaponGoreProfiles.js';

export function createGameGoreRegistry() {
  return Object.freeze({
    creatures: Object.freeze({
      default: Object.freeze({
        bloodColor: 0x210005,
        bloodSecondaryColor: 0x040000,
      }),
      sheep_demon: sheepDemonGoreProfile,
      neck_man: neckManGoreProfile,
    }),
    weapons: weaponGoreProfiles,
    assetSlots: Object.freeze({
      particles: './assets/gore/particles/',
      decals: './assets/gore/decals/',
      wounds: './assets/gore/wounds/',
      props: './assets/gore/props/',
    }),
  });
}


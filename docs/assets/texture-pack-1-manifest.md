# Texture Pack 1 Manifest

## Overview

Texture Pack 1 contains 26 named PNG textures for Dread Stone Black environment materials, props, and lore panels.

- **Texture count:** 26 named PNG textures
- **Expected size:** 512×512 pixels per texture
- **Installed path:** `public/assets/textures/pack1/`

## Categories

### Core dungeon / stone

- `wall_black_stone_01.png`
- `wall_ritual_stone_01.png`
- `floor_worn_stone_01.png`
- `ceiling_dark_stone_01.png`
- `altar_stone_dark_01.png`

### Sunlit Sumerian / city materials

- `stone_limestone_block_01.png`
- `wall_sandstone_ritual_01.png`
- `wall_pyramid_face_01.png`
- `floor_limestone_temple_01.png`
- `wood_oak_bright_01.png`
- `metal_bronze_ritual_01.png`

### Exterior / invasive vegetation

- `field_dead_grass_01.png`
- `floor_black_grass_stone_01.png`
- `grass_black_invasive_01.png`

### Dark aged support

- `wood_dark_aged_01.png`
- `metal_blackened_iron_01.png`
- `metal_gate_rusted_01.png`
- `metal_chest_band_iron_01.png`

### Lore panels / warning slabs

- `panel_astral_gateway_warning_01.png`
- `panel_celestial_map_01.png`
- `panel_extradimensional_threat_01.png`
- `panel_hieroglyph_warning_01.png`
- `panel_hieroglyph_warning_02.png`
- `panel_priesthood_rite_01.png`
- `panel_sumerian_warning_01.png`
- `panel_watcher_face_01.png`

## Suggested DSB texture profile names

- `pack1MudWall`
- `pack1LimestoneWall`
- `pack1SandstoneRitualWall`
- `pack1PyramidFaceWall`
- `pack1LimestoneFloor`
- `pack1BronzeMetal`
- `pack1OakBright`
- `pack1DarkWood`
- `pack1BlackIron`
- `pack1RustedGate`
- `pack1WarningPanel`
- `pack1CelestialPanel`
- `pack1ThreatPanel`
- `pack1WatcherPanel`

## Example texture profile snippet for future generated locations

```js
textures: {
  pack1MudWall: {
    path: './assets/textures/pack1/wall_sandstone_ritual_01.png',
    repeat: [4, 1.5],
    color: 0xd6b982,
    roughness: 0.96,
    metalness: 0,
    emissive: 0x2c1b0d,
    emissiveIntensity: 0.12,
  },
  pack1LimestoneFloor: {
    path: './assets/textures/pack1/floor_limestone_temple_01.png',
    repeat: [4, 4],
    color: 0xe1c98f,
    roughness: 0.98,
    metalness: 0,
    emissive: 0x2a2112,
    emissiveIntensity: 0.14,
  },
}
```

## Usage notes

- Use pack1 sunlit materials for bright Sumerian city/palace maps.
- Use lore panels as thin wall props or non-blocking mural slabs.
- Use dark materials for gates, chests, shrines, undercrofts, and occult areas.
- Future generated definitions should reference these exact paths.

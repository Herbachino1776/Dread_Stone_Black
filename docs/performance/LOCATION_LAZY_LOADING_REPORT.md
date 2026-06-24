# Location Lazy Loading Report

## Purpose

This change replaces the static all-locations registry with an on-demand location-definition loader so the default Folsom startup path does not eagerly import legacy, generated, test, and non-current location definitions.

## Before: static imports

`src/game/locations/locationRegistry.js` previously statically imported every registered definition:

- Black Grass Temple
- Field Keeper House
- Folsom
- generated level-1
- generated Balthazan
- generated Sumerian City Block V0
- generated Sumerian Sun Palace District V1
- generated Sumerian Canal Market District V2
- generated Kerovac
- OARB Feature Yard
- OARB Outdoor Expo
- Reliquary Field
- South Reliquary Crypt
- V2 Test Shrine

Because those imports were all top-level static imports, the initial module graph for Folsom could include definitions that are not needed to construct Folsom.

## After: eager/static imports

Folsom remains the only eager/static location definition import in the registry. This preserves synchronous default/root startup behavior for the current starter area.

## After: lazy dynamic locations

The following definitions are now loaded via dynamic `import()` only when requested and are cached after first load:

- `black-grass-temple`
- `field-keeper-house`
- `level-1`
- `balthazan`
- `sumerian-city-block-v0`
- `sumerian-sun-palace-district-v1`
- `sumerian-canal-market-district-v2`
- `kerovac`
- `oarbFeatureYard`
- `oarbOutdoorExpo`
- `south-reliquary-crypt`
- `reliquary-field`
- `v2-test-shrine`

## Folsom behavior

Folsom remains eager/static. `getLocationDefinition('folsom')` continues to return synchronously during startup, so the default root location does not wait for a dynamic import.

## Reliquary Field behavior

Reliquary Field is no longer bundled through the static registry path. It is lazy-loaded before entering the legacy `field` route or when the Folsom Rusted Field Door routes to `reliquary-field`. If the dynamic import fails, transition code shows a safe “Location unavailable. The way is sealed for now.” message instead of navigating into a missing definition.

## Kerovac runtime fixes

Kerovac's Expo entrance blocker and low-profile overlay z-fighting runtime fixes are preserved. The normalization now runs after the Kerovac definition module is dynamically imported and before the definition is cached.

## Expected benefit

The Folsom initial module graph should avoid parsing and evaluating old/generated/test location definition modules until a route transition or direct startup route asks for them. This should reduce initial JavaScript work for the current default location and allow Vite/Rollup to split non-Folsom definitions into separate chunks.

## Risks and follow-up

- Direct startup into a non-Folsom location now requires the async preload step to complete before `DungeonScene` construction.
- Any future synchronous registry consumers must either use Folsom/cached definitions only or await `loadLocationDefinition()`/`preloadLocationDefinition()` first.
- Objective validation intentionally uses cached definitions only; if validation needs all locations in the future, it should await `listLocationDefinitions()` outside the startup-critical path.

## Build-output verification

Run:

```sh
npm run build
```

Then inspect the Vite/Rollup output for separate chunks named after non-Folsom definition modules, such as `reliquaryField.definition`, `kerovac.definition`, `balthazan.definition`, and generated Sumerian/level modules. Folsom should remain in the main startup graph because it is still statically imported.


## Build chunk notes (2026-06-24)

`npm run build` produced separate definition chunks for the lazy locations, including `southReliquaryCrypt.definition`, `v2TestShrine.definition`, `oarbFeatureYard.definition`, `level1.definition`, `fieldKeeperHouse.definition`, `sumerianCanalMarketDistrictV2.definition`, `sumerianCityBlockV0.definition`, `blackGrassTemple.definition`, `oarbOutdoorExpo.definition`, `reliquaryField.definition`, `sumerianSunPalaceDistrictV1.definition`, `balthazan.definition`, and `kerovac.definition`.

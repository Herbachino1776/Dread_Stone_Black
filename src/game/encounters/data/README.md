# Production encounter data

Each installed file in this directory is one canonical
`dreadstone.encounter_definition.v1` record. The runtime catalog is Vite's
eager, build-time JSON import glob in `EncounterRegistry.js`; adding a valid
`*.json` file is sufficient for the next normal development or production
session to discover it. Do not place editor metadata or dev proof fixtures here.

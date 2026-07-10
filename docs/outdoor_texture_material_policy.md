# Outdoor Texture and Material Policy

Outdoor definitions reference logical material keys. Source images remain unchanged under `public/assets`; runtime profiles apply restrained color, roughness, emissive balance, opacity, and world-scale repetition.

North Road assigns materials by land use and drainage: packed earth for the military road, dry cracked track on exposed ridge paths, churned mud at the ford, wet dark banks at channels, aged wood at constructed spans, rusted iron at hardware, and pale worn military stone at the fort approach.

Generated texture policy:

- do not overwrite source textures
- preserve PNG alpha and avoid baked backgrounds or white fringes
- prefer existing accepted assets before creating variants
- generated images require a clear logical key, stable path, and audit entry
- do not use a generated texture to conceal missing geometry or surface mismatch

Animated pond frames may be reused by several logical water materials. Meshes with the same waterway material key share one material and flipbook registration. Ponds retain distinct tints/material keys where identity matters.

The development material gallery shows a raw source beside the runtime result and is guarded by `import.meta.env.DEV`. It is an inspection tool, not production content.

Run `npm run audit:outdoor-assets` for the deterministic inventory and `npm run validate:north-road` for missing logical material and sprite references.

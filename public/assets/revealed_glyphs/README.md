# Revealed Glyphs Clean Pack V1

Game-facing asset names are generic and lowercase. No lore/personal names are used in PNG filenames.

Recommended destination in repo:

`public/assets/revealed_glyphs/`

Categories are based on the actual uploaded asset batch:

- `letters/` — small alphabet/rune marks
- `faces/` — carved face decals/masks
- `symbols/` — reusable symbolic glyph panels
- `murals/` — large wall/mural decals
- `gate_murals/` — explicit gate mural decals
- `scripts/` — horizontal script strips

Use `revealed_glyphs_manifest.json` for runtime loading or recipe authoring.
Use `rename_map.csv` to trace cleaned filenames back to source names.

Runtime rule: combine these assets through authored or seeded reveal recipes. Do not choose fully random assets every frame or every reload.

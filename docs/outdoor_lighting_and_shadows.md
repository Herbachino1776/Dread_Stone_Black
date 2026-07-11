# Outdoor lighting and shadows

`OutdoorLightingDirector` interpolates linear `THREE.Color` keyframes for hemisphere fill, sun/key, moon, fog, and restrained exposure. Authored point lights remain independent. Indoor sessions restore the renderer's baseline exposure.

Night intentionally uses near-black fog (`2.5–32 m`), a black fallback background, hemisphere intensity `0.025`, moon intensity `0.085`, and exposure `0.92`. The night panorama remains visible at reduced brightness, but terrain and foliage are deliberately torch-dependent. The held torch's existing 32 m point light and 44 m forward wash provide the intended traversal cone without globally amplifying local lights.

One PCF-soft directional caster follows the player on a light-space texel grid. Mobile-balanced uses a 1024 map and 52 m radius; desktop-high uses 2048 and 72 m. Terrain receives shadows, authored structures retain their existing caster flags, foliage does not cast full dynamic alpha shadows, and a maximum 128 pooled root-contact patches adds one draw object.

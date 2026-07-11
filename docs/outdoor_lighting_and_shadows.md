# Outdoor lighting and shadows

`OutdoorLightingDirector` interpolates linear `THREE.Color` keyframes for hemisphere fill, sun/key, moon, fog, and restrained exposure. Authored point lights remain independent. Indoor sessions restore the renderer's baseline exposure.

One PCF-soft directional caster follows the player on a light-space texel grid. Mobile-balanced uses a 1024 map and 52 m radius; desktop-high uses 2048 and 72 m. Terrain receives shadows, authored structures retain their existing caster flags, foliage does not cast full dynamic alpha shadows, and a maximum 128 pooled root-contact patches adds one draw object.

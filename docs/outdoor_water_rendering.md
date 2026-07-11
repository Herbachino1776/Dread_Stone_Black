# Outdoor water rendering

Ponds and waterways share a lightweight standard-lighting shader extension with animated source frames, restrained sky/sun/moon fresnel, fog, tone mapping, transparent fish visibility, pond ripple mode, and flow mode. It has no screen-space reflection or emissive boost.

Waterway meshes carry `waterDepth01`, `edgeDistance01`, `flowDistance`, and `flowDirection` from the same downhill cross-section used by deformation and fishing. Ponds retain the single seven-layer shoreline profile: basin, floor, submerged shelf, waterline, exposed mud, wet bank, dry transition.

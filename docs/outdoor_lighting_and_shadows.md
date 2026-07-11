# Outdoor lighting and shadows

`OutdoorLightingDirector` now resolves one authoritative presentation state from the shared absolute outdoor clock. Sky weights, sun elevation/intensity, moon fill, hemisphere fill, fog, exposure, ordinary emissive scale, water response, shadow state, and torch-need level therefore reach full night together at cycle phase `0.4`.

Full night uses sun intensity `0`, sun shadows disabled, moon intensity `0.005` with no moon shadows, hemisphere intensity `0.006` (0.67% of noon), near-black cool fog from `1.25-11 m`, exposure `0.78`, and zero ordinary outdoor emissive scale. The independently rendered night panorama remains visible at 62% source brightness. Late dusk disables the directional shadow caster when sunlight or elevation crosses the sunset cutoff, so stale long shadows are not applied or updated.

The held torch is active only while the owned torch is equipped in the offhand and its viewmodel lit state is true. It uses a warm 7.5 m point source, a 3.6 m local fill, and a 10 m forward spotlight with inverse-square falloff. Only the forward spotlight casts shadows, using one bounded 512 px shadow map with a `0.2-10.5 m` camera range. The existing equipment UX is preserved: dusk warns once, never replaces an occupied offhand, and direct-entry development loadouts include the torch.

The outdoor sun retains player-centered texel snapping. Mobile-balanced uses a 1024 map and 52 m radius; desktop-high uses 2048 and 72 m. Terrain and authored structures retain their caster/receiver flags, foliage does not cast full dynamic alpha shadows, and at most 128 pooled root-contact patches remain one draw object. Indoor and title lighting are not bound to the outdoor director.

Development readouts are available with `?debug=outdoor-lighting`, `?debug=outdoor-shadows`, or `?debug=torch-lighting`. Add `&debugTorch=on` or `&debugTorch=off` for a non-persistent natural-night/torch comparison.

# Audio Asset Ingestion Report

Accepted audio library v024 was installed from:

- `public/audio/incoming/dreadstone_accepted_audio_library_v024.zip`

The zip was extracted to a temp folder, `README.md` and `accepted_audio_manifest_v024.json` were read, accepted runtime WAVs were copied into organized runtime folders, PREVIEW files were ignored, and the committed zip was removed from the repo tree with `git rm`.

## Preserved source docs

- `docs/audio/accepted_audio_library_v024_README.md`
- `docs/audio/accepted_audio_manifest_v024.json`

## Final folder structure

- `public/audio/ambience/`
- `public/audio/growth/`
- `public/audio/tools/`
- `public/audio/prybar/`
- `public/audio/lantern/`
- `public/audio/transitions/`
- `public/audio/pickups/`
- `public/audio/footsteps/`

## Runtime files installed

- `public/audio/ambience/audio_ch2_blue_flame_hall_ambience_layer_a_loop.wav`
- `public/audio/ambience/audio_ch2_blue_flame_hall_ambience_layer_b_loop.wav`
- `public/audio/ambience/audio_ch2_blue_flame_hall_ambience_loop.wav`
- `public/audio/ambience/audio_ch2_lower_shrine_landing_ambience_loop.wav`
- `public/audio/footsteps/audio_system_footsteps_grass_walk_loop.wav`
- `public/audio/footsteps/audio_system_footsteps_temple_stone_walk_loop.wav`
- `public/audio/growth/audio_ch1_folsom_shed_growth_knife_final_clear_oneshot.wav`
- `public/audio/growth/audio_ch1_folsom_shed_growth_knife_first_bite_oneshot.wav`
- `public/audio/growth/audio_ch1_folsom_shed_growth_knife_second_damage_oneshot.wav`
- `public/audio/growth/audio_ch1_folsom_shed_growth_tension_loop.wav`
- `public/audio/growth/audio_ch2_beneath_folsom_hidden_growth_gate_axe_hit_01_oneshot.wav`
- `public/audio/growth/audio_ch2_beneath_folsom_hidden_growth_gate_axe_hit_02_oneshot.wav`
- `public/audio/growth/audio_ch2_beneath_folsom_hidden_growth_gate_collapse_oneshot.wav`
- `public/audio/growth/audio_ch2_shrine_side_room_seal_axe_knot_crack_oneshot.wav`
- `public/audio/growth/audio_ch2_shrine_side_room_seal_knife_cords_cut_oneshot.wav`
- `public/audio/growth/audio_ch2_surface_anchor_clear_oneshot.wav`
- `public/audio/growth/audio_ch2_underworks_gate_ambient_tension_stinger_oneshot.wav`
- `public/audio/lantern/audio_ch2_keepers_lantern_network_reveal_oneshot.wav`
- `public/audio/lantern/audio_ch2_keepers_lantern_pickup_reveal_oneshot.wav`
- `public/audio/pickups/audio_ch1_folsom_shed_torch_pickup_oneshot.wav`
- `public/audio/pickups/audio_ch1_folsom_shed_wood_axe_pickup_oneshot.wav`
- `public/audio/pickups/audio_ch2_beneath_folsom_iron_drain_bar_pickup_oneshot.wav`
- `public/audio/prybar/audio_ch2_beneath_folsom_drain_grate_bar_socket_oneshot.wav`
- `public/audio/prybar/audio_ch2_beneath_folsom_drain_grate_pry_open_oneshot.wav`
- `public/audio/prybar/audio_ch2_lower_shrine_hatch_final_pry_oneshot.wav`
- `public/audio/transitions/audio_ch1_folsom_shed_door_open_oneshot.wav`
- `public/audio/transitions/audio_ch2_beneath_folsom_entry_stinger_oneshot.wav`
- `public/audio/transitions/audio_ch2_lower_shrine_landing_reveal_stinger_oneshot.wav`
- `public/audio/transitions/audio_ch2_shrine_crawlspace_panel_open_oneshot.wav`
- `public/audio/transitions/audio_ch2_underworks_gate_unseal_oneshot.wav`

## PREVIEW files ignored

The following pack files were not copied to runtime folders and are not referenced by runtime code:

- `PREVIEW_grass_short_source_then_12s_long_loop.wav`
- `PREVIEW_temple_stone_source_then_12s_loop.wav`
- `PREVIEW_grass_to_temple_stone_surface_swap.wav`
- `PREVIEW_grass_12s_loop_seam_last1_first1.wav`
- `PREVIEW_temple_stone_12s_loop_seam_last1_first1.wav`
- `PREVIEW_grass_walk_20s_loop_mockup.wav`
- `PREVIEW_temple_stone_walk_20s_loop_mockup.wav`

## Cues present but not wired

None. Every accepted runtime WAV in v024 is represented in `src/game/audio/audioCueManifest.js` and has a runtime placement.

## Requested route-critical cues missing from v024

These requested optional Chapter 3 cues are not present in `accepted_audio_manifest_v024.json` and were not substituted:

- `audio_ch3_white_scab_lower_knot_final_tear_oneshot`
- `audio_ch3_under_shrine_labyrinth_void_bed_loop`
- `audio_ch3_under_shrine_end_hatch_open_oneshot`

No accepted Old Work Knife pickup cue is present in v024, so no runtime substitute was added for that pickup.

## Validation

- `npm.cmd run validate:folsom` passed.
- `npm.cmd run build` passed.

PowerShell blocked `npm.ps1`, so validation and build were run through `npm.cmd`.

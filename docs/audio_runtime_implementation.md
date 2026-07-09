# Audio Runtime Implementation

Accepted audio library v024 is installed and wired through `src/game/audio/GameAudioRuntime.js` and `src/game/audio/audioCueManifest.js`.

## Runtime shape

- Browser/mobile unlock is centralized around a shared WebAudio context in `src/game/audio/sharedAudioContext.js`. The title wake and title menu selection both attempt to create/resume this context directly inside the user's touch/click/key gesture, then `GameAudioRuntime` reuses the same context.
- `GameAudioRuntime` also listens for `pointerdown`, `touchstart`, `touchend`, `keydown`, and `click` as fallback wake events. The runtime tracks `locked`, `unlocking`, and `unlocked` readiness, the current `AudioContext.state`, and dev-only unlock attempt counts.
- `Game.startUnsafe()` still asks the runtime to unlock during startup, but startup is no longer the first place the context is created on iPhone Safari.
- Runtime playback supports 2D one-shots, 3D one-shots, 2D loops, 3D loops, fade in/out, loop cleanup, pause/resume, mute, listener updates, distance attenuation, and pitch/volume variation.
- Buses are lightweight WebAudio gain nodes: `master`, `ambience`, `sfx`, `ui`, `tools`, `growth`, `machinery`, `footsteps`, plus `prybar` for accepted prybar-folder assets.
- Missing cue warnings are dev-only and one-time per cue ID.
- Dev-only logging reports audio context creation, unlock attempts, unlock success/failure, cue load failures, deferred loop resume, and deferred one-shot playback/drop decisions.
- No PREVIEW files are referenced by runtime code.

## Unlock and deferred playback

The Old Work Knife is not an audio unlock dependency. The first real title wake, title start, viewport, movement touch, pointer, touch, or keyboard gesture should unlock the shared game audio context. If the browser does not allow the title/start attempt, the next in-game gesture retries through capture-phase listeners on `window`, `document`, and the app root.

For iPhone Safari, the title wake path performs a silent one-frame WebAudio tick while resuming the shared context. This gives the game an already-created context to attach accepted cues to before the player ever picks up the Old Work Knife.

Loop requests made while audio is locked are remembered by loop key and cue ID. If the player stops moving or leaves the relevant zone before unlock, the pending loop is removed. If the loop is still desired when unlock succeeds, it starts with the original fade and placement options.

Important one-shot route, pickup, reveal, and open cues requested while locked are deferred briefly, de-duplicated by cue and position, and played after unlock if still fresh. Stale deferred one-shots are dropped instead of replaying late route audio.

## Cue manifest

Runtime cue manifest:

- `src/game/audio/audioCueManifest.js`

Production runtime service:

- `src/game/audio/GameAudioRuntime.js`

## Wired placement

| Cue ID | Runtime placement | Trigger |
| --- | --- | --- |
| `audio_ch1_folsom_shed_growth_tension_loop` | 3D loop at `folsom_tool_shed_seam_growth` / shed seam growth target | Proximity fade while near intact/damaged shed growth; stops after `folsom_tool_shed_open`. |
| `audio_ch1_folsom_shed_growth_knife_first_bite_oneshot` | 3D at shed seam growth | First successful Old Work Knife swipe only. |
| `audio_ch1_folsom_shed_growth_knife_second_damage_oneshot` | 3D at shed seam growth | Second successful Old Work Knife swipe only. |
| `audio_ch1_folsom_shed_growth_knife_final_clear_oneshot` | 3D at shed seam growth | Third successful Old Work Knife swipe only. |
| `audio_ch1_folsom_shed_door_open_oneshot` | 3D at shed door/seam frame | Shed opens after final clear; no replay on restored open saves. |
| `audio_ch1_folsom_shed_wood_axe_pickup_oneshot` | 2D pickup confirmation | First Wood Axe acquisition. |
| `audio_ch1_folsom_shed_torch_pickup_oneshot` | 2D pickup confirmation | First Torch acquisition. |
| `audio_ch2_shrine_side_room_seal_knife_cords_cut_oneshot` | 3D at `folsom_shrine_side_room_seal` | Knife stage success only. |
| `audio_ch2_shrine_side_room_seal_axe_knot_crack_oneshot` | 3D at `folsom_shrine_side_room_seal` | Axe stage success only. |
| `audio_ch2_keepers_lantern_pickup_reveal_oneshot` | 2D pickup confirmation | First Keeper's Lantern acquisition. |
| `audio_ch2_keepers_lantern_network_reveal_oneshot` | 3D at primary under-shrine convergence mark | First successful Lantern network reveal. |
| `audio_ch2_shrine_crawlspace_panel_open_oneshot` | 3D at crawlspace panel target | Successful revealed panel open. |
| `audio_ch2_surface_anchor_clear_oneshot` | 3D at fire, pond, or shrine anchor target | Successful physical anchor clear. |
| `audio_ch2_underworks_gate_ambient_tension_stinger_oneshot` | 3D at Underworks growth lock/gate | One non-spammy proximity stinger after network reveal while still sealed. |
| `audio_ch2_underworks_gate_unseal_oneshot` | 3D at Underworks growth lock | Plays when all anchors unseal the gate; no replay on restored saves. |
| `audio_ch2_beneath_folsom_entry_stinger_oneshot` | 2D transition stinger | In-game transition into `beneath-folsom`. |
| `audio_ch2_beneath_folsom_iron_drain_bar_pickup_oneshot` | 2D pickup confirmation | First Iron Drain Bar acquisition. |
| `audio_ch2_beneath_folsom_drain_grate_bar_socket_oneshot` | 3D at drain grate socket | Iron Drain Bar seats in the drain grate socket. |
| `audio_ch2_beneath_folsom_drain_grate_pry_open_oneshot` | 3D at drain grate | Successful drain grate pry completion. |
| `audio_ch2_beneath_folsom_hidden_growth_gate_axe_hit_01_oneshot` | 3D at hidden growth gate | Alternating non-final successful hidden gate hit. |
| `audio_ch2_beneath_folsom_hidden_growth_gate_axe_hit_02_oneshot` | 3D at hidden growth gate | Alternating non-final successful hidden gate hit. |
| `audio_ch2_beneath_folsom_hidden_growth_gate_collapse_oneshot` | 3D at hidden growth gate | Final hidden gate clear. |
| `audio_ch2_blue_flame_hall_ambience_loop` | 3D BF04 blue-flame hallway center | Fades in after hidden gate clear while player is in/near BF04. |
| `audio_ch2_blue_flame_hall_ambience_layer_a_loop` | 3D near left BF04 fixture band | Fades with BF04 hallway state. |
| `audio_ch2_blue_flame_hall_ambience_layer_b_loop` | 3D near right BF04 fixture band | Fades with BF04 hallway state. |
| `audio_ch2_lower_shrine_hatch_final_pry_oneshot` | 3D at lower shrine hatch/socket | Successful lower hatch pry completion. |
| `audio_ch2_lower_shrine_landing_ambience_loop` | 2D BF05 ambience bed | Fades in while in Lower Shrine landing/stair zone. |
| `audio_ch2_lower_shrine_landing_reveal_stinger_oneshot` | 2D reveal stinger | Plays when crossing into BF05 during a session, not on direct reload in BF05. |
| `audio_system_footsteps_grass_walk_loop` | 2D player movement loop | Folsom outdoor movement only; fades out when standing still. |
| `audio_system_footsteps_temple_stone_walk_loop` | 2D player movement loop | `beneath-folsom` and `under-shrine-labyrinth` movement only; fades out when standing still. |

## Procedural audio policy

Accepted assets are now primary for route-critical physical successes. The previous hidden growth procedural hit sound and lower hatch procedural strain sound were removed from their runtimes. `PhysicalToolActionController.playContactSound()` is disabled whenever the production audio runtime exists, so placeholder oscillator success/failure sounds do not leak into the accepted audio pass.

## Persistence policy

Route-open and reveal cues are fired from state-change methods, not constructors or persisted-state restoration. Already-open save states restore visuals, blockers, and loops silently.

## Known limitations

- Footsteps are conservative location-based loops, not full material dispatch.
- Lower Shrine landing reveal is session-crossing based because there is no dedicated persisted audio-only reveal flag.
- No broad White-Scab Hall mechanics were added.
- No reverb/occlusion snapshot system was added.

## Manual startup audio test

1. Hard refresh.
2. Tap or touch the title wake/start flow on iPhone Safari.
3. Walk before picking up any item.
4. Confirm footsteps are audible while moving and silent while standing still.
5. Approach the shed and confirm the growth tension loop is audible.
6. Pick up the Old Work Knife and confirm audio was already active before pickup.

## Recommended next audio pass

- Add explicit floor/material tagging for footsteps.
- Add optional 3D pickup sweeteners at pickup objects while keeping first-person confirmations 2D.
- Add room-zone authored ambience metadata so beds do not rely on coordinate ranges.
- Add future accepted Chapter 3 cues when they exist.

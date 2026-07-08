# Chapter 1-3 AAA Audio Requirements

## 1. Audit scope

Inspected baseline: `e496a3d` (`yee`), current `main` after `git fetch --prune origin`, `git switch main`, and `git reset --hard origin/main`.

Chapters covered:

- Chapter 1: current Folsom starter proof and implemented starter systems.
- Chapter 2: current Folsom shrine, surface network, Underworks, Beneath Folsom, hidden gate, blue-flame hall, and lower shrine hatch route.
- Chapter 3: current authored lead-in only: Lower Shrine Stair, impossible White-Scab front threshold, lower knot, Folsom terminal, `under-shrine-labyrinth`, backside threshold, and authored skeleton/future blockers through Crypt Access Stair.

Locations covered:

- `folsom`
- `beneath-folsom`
- `under-shrine-labyrinth`
- Current starter-adjacent systems that remain active in Folsom: inventory/equipment, field chests, campfire/survival, fishing, Torch, Keeper's Lantern, physical tools, saves, transitions.

Systems covered:

- `DungeonScene` location/runtime assembly, physical tool target registration, pry strain, growth strikes, location transitions, Folsom outdoor systems, Beneath Folsom runtimes, Chapter 3 lead-in runtimes.
- `Interactions` pickup, chest, survival, campfire, fishing, raw/cooked fish, area transition, and timed-action paths.
- `GameState` route flags and equipment persistence.
- Physical tool profiles/viewmodels/action controller.
- Torch and Keeper's Lantern viewmodels and Lantern cone reveal runtime.
- Existing audio-related files and procedural WebAudio blocks.

Intentionally excluded:

- No proposed implementation code.
- No audio files or placeholder assets.
- No unrelated locations beyond route-adjacent current systems.
- No PR/Pages/build checks.
- No enemy/combat/boss audio, because current Chapters 1-3 inspected route has no enemies or character combat.
- No Records/Memory/map audio as implemented systems, because those domains are not currently landed for these beats.

Presence on inspected main:

| System | Status on inspected main |
| --- | --- |
| Physical tools | Present. `old_work_knife`, `wood_axe`, and `iron_drain_bar` have lower-right camera-local viewmodels, gesture validation, contact targets, haptics, screen shake, and some temporary procedural contact sounds. |
| Socketed prybar | Present. Drain grate, lower shrine hatch, and labyrinth end hatch are authored pry targets with socket positions, volumes, lever arcs, release behavior, and completion save keys. |
| Under-Shrine Labyrinth | Present. `under-shrine-labyrinth` is a separate lazy-loaded compiled location with ten rooms, two squeeze segments, breathing pocket, pressure moment, end hatch, and exit to `beneath-folsom`. |
| White-Scab systems | Partially present. The impossible front seal and a 3-hit lower knot are present. White-Scab Hall reveal/clear, Pale Panel activation, Shrine Mechanism Room mechanics, and crypt-root clear are not present on inspected main. |

## 2. Current audio implementation inventory

Existing audio assets:

- No `.mp3`, `.wav`, `.ogg`, `.m4a`, or `.flac` files were found under `public`.
- Existing visual-only sprite/texture assets include fire sprites, water frames, revealed glyphs, and black-growth textures, but these are not audio assets.

Existing audio systems:

- `src/game/audio/TitleAmbience.js` exists, but `DEFAULT_TITLE_AMBIENCE_SRC` is `null`; no title ambience asset is loaded by default.
- `src/game/title/TitleScreen.js` attempts to unlock title audio on wake through `TitleAmbience`, but with `src = null` this currently does nothing.
- `PhysicalToolActionController.playContactSound(kind)` creates short oscillator tones for `plant`, `skid`, `pry`, `final-strain`, `cut/chop/pry`, and `final`. These are temporary procedural WebAudio feedback, not an asset-backed AAA sound system.
- `BeneathFolsomHiddenGrowthGateRuntime.playWetGrowthHit(finalHit)` creates procedural noise for hidden gate hits.
- `BeneathFolsomLowerShrineHatchRuntime.playStrain()` creates a procedural scrape/groan for the lower shrine hatch final open.

Current sound events/hooks:

- Title wake calls `TitleAmbience.unlockAndPlay()`, but no source is configured.
- Physical tool controller calls `playContactSound()` on pry seating, skid, pry strain stages, final strain, valid contact, final contact, and wrong/refused contact.
- Hidden growth gate calls `playWetGrowthHit()` on every successful hit.
- Lower shrine hatch calls `playStrain()` on successful pry completion.
- No authored cue IDs, event bus, mixer, spatial emitter registry, loop manager, reverb zones, or asset loader exist.

Missing systems:

- Asset-backed SFX/music/ambience manager.
- 2D/3D cue routing.
- Loop start/stop/crossfade.
- Location ambience state machine.
- Per-room reverb/occlusion/low-pass.
- Distance attenuation and emitter-follow behavior.
- Event naming convention in code.
- Volume categories, mute, pause/resume, mobile unlock handling beyond title/procedural snippets.
- Save-state restore audio policy.
- Audio debug overlay.
- Pooling for one-shots.

Missing event hooks:

- Location enter/exit ambience transitions.
- Field ambience and pond/campfire loops.
- Pickup/chest/equipment/UI sounds.
- Tool equip/unequip/ready/move/windup/miss/hit/stage/final events.
- Growth stage change/collapse/cord snap/oil burst events.
- Lantern reveal enter/hold/persist events.
- Pry socket seat/strain/release/final open events per target.
- Blue-flame hallway loops.
- Chapter 3 hard-boundary and deferred-blocker refusal sounds.
- Fishing cast/lure/water/fish/reel events.
- Survival timed action loops and completion sounds.

Naming conventions already present:

- Game object/state naming uses lowercase snake case, e.g. `folsom_tool_shed_open`, `beneath_folsom_hidden_growth_gate_cleared`, `under_shrine_labyrinth_end_hatch_open`.
- This doc proposes matching audio cue IDs as `audio_ch{chapter}_{location_or_system}_{object_or_beat}_{action}_{type}`.

Runtime limitations:

- Procedural WebAudio calls are destination-only and not spatialized.
- Procedural sounds are not mixed, categorized, localized to emitters, pooled, or synchronized with room acoustics.
- Browser audio unlock is not centralized.
- Current reload behavior silently applies saved visual state; there are no restore cues.
- Some state exists but is not reliably written: `beneath_folsom_keepers_lantern_reveal_seen` is declared but not currently called by inspected runtime.

## 3. Chapter 1 audio requirements

Current Chapter 1 truth: the player starts at `folsom_player_start` in the Folsom courtyard. Wake road, outside Folsom, west-gate entry, Chapter 1 map update, pond clue record, and optional First Night Road are not present on inspected main.

| Beat | Required sound | Priority | Hook/source |
| --- | --- | --- | --- |
| Wake road / outside Folsom / west gate | Not present on inspected main. Do not implement route-specific audio yet. Future bed would be road wind, distant timber wall, gate timbers, and entry stinger. | Future/deferred | No current route object or state. |
| Folsom exterior ambience | Outdoor bed with redwood wind, dry grass, distant wall creak, low town hush, light insect/air sweeteners, and rare far timber knock. Must support current bright/noon visual without becoming cheerful. | Critical | Location enter `folsom`; lights `folsom_noon_ambient`, `folsom_noon_sun`; spawn `folsom_player_start`. |
| Folsom exterior material foley | Dirt/grass/wood/stone movement sweeteners for future footsteps. Current runtime has movement but no footstep material dispatch. | High | Requires future movement/material hook. |
| Common fire / choked fire | Current object `folsom_courtyard_campfire` exists as campfire visual/survival object. Need small fire loop, ember snaps, soft heat roar, and black-growth suppression layer when `folsom_growth_anchor_fire` is uncleared/revealed. | Critical | `folsom_courtyard_campfire`; anchor `folsom_growth_anchor_fire`; state `folsom_growth_anchor_fire_cleared`. |
| Pond path | Wind thins, reeds, wet mud foot proximity, soft water lap, low frog/insect one-shots if naturalistic. No magical pond tone. | High | Water body `folsom_starter_pond`; validation route `pond`; fishing zone generated from pond. |
| Tool shed exterior | Dry planks, roof settling, close trapped-air creak, black-growth wet fiber tension near door. | Critical | Structure pad `tool-shed`; `folsom_tool_shed_floor`; growth group `folsom-tool-shed-seam-growth`. |
| Old Work Knife discovery | Small rusted metal/wood pickup, no heroic sting. Add short tactile reveal tick only when picked up, not while simply seen. | Critical | Pickup `folsom_shed_rear_knife_pickup`; equipment item `old_work_knife`. |
| Shed seam physical clear | Three successful knife swipes need separate contact variants: wet blade catch, taut cord slice, oily scab tear. Hit 2 adds damaged-state tendon slack. Hit 3 adds cord snaps, black oil burst, growth collapse, door release, and screen-shake accent. Wrong tool/miss should scrape/refuse without progress. | Critical | Physical target `folsom_tool_shed_seam_growth`; state `folsom_tool_shed_open`; runtime `FolsomShedGrowthRuntime.strike()` / `clearGrowth()`. |
| Shed door/open payoff | Heavy aged-wood double door groan, hinge scrape, frame dust, interior air exhale. On reload with `folsom_tool_shed_open`, do not replay victory; use open-state ambience only. | Critical | Door parts `folsom_shed_door_left/right`; blockers removed by `folsom_tool_shed_open`. |
| Wood Axe pickup | Heavier chest/pickup cue with dull iron head weight and wood handle. No fantasy weapon flourish. | Critical | Chest `folsom_wood_axe_chest`; item `wood_axe`. |
| Torch pickup/use | Chest/pickup cue plus later equip ignition/cloth flame loop when equipped. Torch use needs warm flame loop and movement sway sweeteners. | Critical | Chest `folsom_torch_chest`; item/offhand `torch`; `TorchViewmodel`. |
| Restored/common fire | The guide's separate Chapter 1 restoration state is not present. Current fire endpoint belongs to Chapter 2 surface anchor. Audio should treat it as current fire + Chapter 2 anchor, not as a completed Chapter 1 restored-fire route state. | Current-as-Ch2 | `folsom_growth_anchor_fire_cleared`; no `Common Fire Restored` key. |
| Pond marker clue | Not present on inspected main. Pond exists, but no marker clue/Records/map state exists. | Future/deferred | No current object/state. |
| Old Shrine approach | Open-ceiling stone ruin bed: wind through broken stone, pale cold tint, old timber/stone groans, subdued black-cord tension once side seal is present. | High | `folsom_shrine_floor`, `folsom_shrine_altar`, `folsom_shrine_side_room_door`, `folsom_shrine_altar_inspect`. |
| Optional First Night Road | Not present on inspected main. North Road marker exists as future road inspect only. | Future/deferred | `folsom_future_road`, `folsom_north_road_marker_left/right`; no route. |

Persistence/reload policy for Chapter 1:

- `folsom_tool_shed_open`: suppress locked-growth loop, suppress final clear stinger, keep open shed ambience/interior availability.
- `folsom_growth_anchor_fire_cleared`, `folsom_growth_anchor_pond_cleared`, `folsom_growth_anchor_shrine_cleared`: suppress corresponding endpoint active-tension layers after reload.
- Equipment ownership: suppress pickup cue on already owned/collected pickups; no pickup replay on load.

## 4. Chapter 2 audio requirements

| Beat | Exact required sounds | Priority | Hook/source |
| --- | --- | --- | --- |
| Old Shrine Exterior | Exterior wind narrows, stone cold layer, distant black cords tightening around side room. Add low non-musical "buried network" pressure only after Lantern reveal. | Critical | `folsom_shrine_floor`, `folsom_shrine_side_room_seal`, `folsom_shrine_altar_inspect`. |
| Shrine Side Room seal | Stage 0 Knife: taut cord cuts, wet fiber split, small oil flecks. Stage 1 Axe: heavy dull chop, hard knot crack, wood/stone door give, larger oil/fragments. Wrong tool must refuse physically. | Critical | Physical target `folsom_shrine_side_room_seal`; `FolsomShrineInvestigationRuntime.advanceSideRoom()`; state `folsom_shrine_side_room_open`. |
| Side door/seal opening | Sliding old side door: wood drag on stone, growth slack falling, stale room air release. | Critical | Object `folsom_shrine_side_room_door`; blocker removed by `folsom_shrine_side_room_open`. |
| Shrine Side Room ambience | Tight buried maintenance room bed: close stone air, wood shelf creaks, cold metal grate resonance, faint Lantern-glass hum once Lantern is visible/owned. | High | `folsom_shrine_side_room_floor`, `folsom_shrine_keeper_workbench`, shelves, grate. |
| Canonical Keeper's Lantern pickup | Soft metal handle lift, glass tick, cold wick/contained pale tone, short non-diegetic confirmation sting. No duplicate BF03 pickup cue. | Critical | `folsom_shrine_side_room_keepers_lantern_pickup`; item `keepers_lantern`; BF03 niche is no-pickup dressing. |
| Lantern reveal of under-shrine network | Focused reveal layer: pale breath, ceramic/glass shimmer, black cords becoming audible under light, spatial focus on `folsom-under-shrine-convergence-mark`. Persisted reveal should not replay full discovery on reload. | Critical | `FolsomShrineInvestigationRuntime.markNetworkRevealed()`; state `folsom_under_shrine_network_revealed`; reveal marks/cords. |
| Crawlspace panel | Hidden/no-edge refusal before reveal; after reveal, Knife cord split, low stone panel sinking/dragging down, dust, close air change. | Critical | Physical target `folsom_shrine_crawlspace_panel`; state `folsom_shrine_crawlspace_open`; object `folsom_shrine_crawlspace_panel`. |
| Crawlspace interior | Low-ceiling muffled movement layer, close timber flex, cloth/gear brushing stone, reduced exterior wind, pressured root creaks. | High | `folsom_shrine_crawlspace_floor`, frames, buried slabs; low-view zone `folsom_shrine_crawlspace_low_view`. |
| Crawlspace terminal throat | Solid barred throat before Chapter 3: cold exhale behind metal/stone, black pressure hold. After lower knot state, terminal cracks open with stone drop, bar bend, breathing darkness loop. | Critical | `folsom_shrine_crawlspace_terminal_slab`, bars; state `folsom_shrine_crawlspace_terminal_open`. |
| Surface fire endpoint | Revealed endpoint tension, Axe windup/contact, burnt knot split, ember suck-in, feed slackening. Must differentiate from ordinary campfire. | Critical | Physical target `folsom_growth_anchor_fire`; state `folsom_growth_anchor_fire_cleared`; required tool `wood_axe`. |
| Surface pond endpoint | Wet root knot blade cut, mud suction, waterline ripple, black cord recoil into waterbed. | Critical | Physical target `folsom_growth_anchor_pond`; state `folsom_growth_anchor_pond_cleared`; required tool `old_work_knife`. |
| Surface shrine endpoint | Knife on cords over stone, pale stone scrape, cord slack, altar pressure release. | Critical | Physical target `folsom_growth_anchor_shrine`; state `folsom_growth_anchor_shrine_cleared`. |
| Underworks gate | On all three anchors cleared: underworks lock oil burst, cords collapsing, rusted gate lift/drag, cold air route-open payoff. Persisted reload should start with unsealed/open gate and no payoff replay. | Critical | `folsom_underworks_growth_lock`, `folsom_cellar_gate`; state `folsom_underworks_growth_unsealed`. |
| Beneath Folsom entrance | Transition stinger from outdoor to underground: wind shuts behind, stone damp opens, low-pressure descent. | Critical | Interaction `folsom_underworks_locked`; destination `beneath_folsom_underworks_arrival`. |
| Underworks Entry Stair BF01 | Damp stone bed, close timber supports, overhead dirt pressure, soft water drip. | Critical | Room `BF01`; light `beneath_folsom_entry_cold_fill`; exit return to Folsom. |
| Iron Drain Bar pickup | Heavy iron lift/scrape, rust grit, short tool-ready thud. | Critical | Interaction `beneath_folsom_iron_drain_bar_pickup`; prop `beneath_folsom_drain_bar_visual`; item `iron_drain_bar`. |
| Drain grate pry | Socket seek skid, seated clunk, short forgiving lever strain, rusted bars shriek, bars fold/drop, root grate slack. | Critical | Physical target `beneath_folsom_drain_grate`; state `beneath_folsom_drain_grate_pried`; socket props and blocker. |
| Drain throat / lower wall glyph | Muffled low-water/metal alcove bed, Lantern reveal tracing glyphs piece by piece, hidden wall "under pressure" tone when reveal hits. | Critical | BF03 decals `beneath_folsom_lower_wall_glyph_cluster_*`; `LanternConeRevealRuntime`. |
| Hidden five-hit growth gate | Five Knife contacts: wet hidden reveal catch, progressive cord weakening, scab damage, increasing oil bursts. Hit 5: tendon snaps, growth collapse, wall fade, blue hall air enters. | Critical | Physical target `beneath_folsom_hidden_growth_gate`; state `beneath_folsom_hidden_growth_gate_cleared`. |
| Blue-flame hallway | Cold blue flame loop, hard stone resonance, narrowed long hallway wind, no warm torch crackle. Add entering threshold sting after wall fade. | High | `beneath-folsom-blue-flame-chapter-end-hallway`; room `BF04`; blue flame fixtures. |
| Lower shrine hatch | Heavier than drain grate: socket seat in stone/iron notch, early stone dust, mid groan, final 20% creak/strain spike, hatch tears down/in, route opens. | Critical | Physical target `beneath_folsom_lower_shrine_hatch`; state `beneath_folsom_lower_shrine_hatch_open`. |
| Lower Shrine Stair handoff | Transition from blue hall to pale lower shrine: blue flame drops behind, pale stone tone rises, deeper reverb, no victory fanfare. | Critical | Door `beneath_folsom_blue_hall_to_lower_shrine_stair`; room `BF05`. |

Save-state restore behavior:

- Never replay route-open stingers just because a save loaded.
- For cleared blockers, set ambience/loops to post-clear state silently or with a very short environmental settle only after location load.
- `beneath_folsom_keepers_lantern_reveal_seen` should not be used as reliable audio state until runtime writes it.

## 5. Chapter 3 audio requirements

Current Chapter 3 truth: the playable lead-in is Lower Shrine Stair -> impossible front seal/lower knot -> Folsom terminal -> Under-Shrine Labyrinth -> end hatch -> backside threshold hard boundary. BF07-BF09 are authored skeleton/future-blocked spaces in `beneath-folsom`, but progression into White-Scab Hall mechanics is deferred.

| Area/beat | Required sound | Priority | Hook/source |
| --- | --- | --- | --- |
| Lower Shrine Stair BF05 | Cold pale stair ambience, longer reverb tail than Underworks, low stone memory tone, footstep/material future hooks for pale floor. | Critical | Room `BF05`; light `beneath_folsom_lower_shrine_cold_light`. |
| White-Scab approach/front seal BF06 | Massive impossible pressure bed, black scab creak, pale seams under compression, root plates shifting but never opening. Wrong attacks on broad seal should sound futile if future hook exists. | Critical | `beneath_folsom_white_scab_front_seal`; blocker `beneath_folsom_white_scab_front_seal_blocker`. |
| Lower knot | Three Knife hits: hard catch, cord twist, split/pull downward, final cords tear backward into earth. Final cue must clearly say "elsewhere opened," not "front seal opened." | Critical | Physical target/interact `beneath_folsom_white_scab_lower_knot`; state `beneath_folsom_white_scab_lower_knot_destroyed`; also writes `folsom_shrine_crawlspace_terminal_open`. |
| Folsom terminal after lower knot | Remote structural response: terminal slab cracks/sinks, bars bend, black pressure exhales, darkness breathes. | Critical | `folsom_shrine_crawlspace_terminal_slab`, terminal bars; state `folsom_shrine_crawlspace_terminal_open`. |
| Under-Shrine Labyrinth entry | Transition from shrine crawlspace into pitch-black old route: close stone scrape, breath stop, exterior sound seals off. | Critical | Interaction `folsom_shrine_crawlspace_terminal_entrance`; spawn `under_shrine_labyrinth_shrine_terminal_arrival`. |
| Labyrinth spiral/descent | Ten-room claustrophobic bed: near silence, close cloth/stone, low root tension, occasional dirt tick, no music-forward loop. | Critical | Rooms `USL01`-`USL10`; ambient `under_shrine_labyrinth_dark_ambient`. |
| North Squeeze / Stone Squeeze | Low-pass, body compression, shoulder/gear scrape, reduced movement-air, breath proximity layer. | High | Rooms `USL03`, `USL07`; tags `tight-squeeze`. |
| Breathing Pocket | Slightly wider air, pale slab resonance, one restrained inhale/exhale sweetener, lower tension for contrast. | High | Room `USL06`; prop `under_shrine_labyrinth_breathing_pocket_slab`. |
| Impossible pressure moment | Root/stone compression groan, pale stone strain, overhead threat, no interactive success cue. | High | Props `under_shrine_labyrinth_impossible_pressure_root`, `under_shrine_labyrinth_impossible_pressure_stone`. |
| End hatch | Buried iron hatch socket seat, metal-stone skid, constrained pry strain, final inward tear, route-open air suction. | Critical | Physical target `under_shrine_labyrinth_end_hatch`; state `under_shrine_labyrinth_end_hatch_open`; exit `under_shrine_labyrinth_end_hatch_exit`. |
| White-Scab threshold backside | Arrival behind denied threshold: pale chamber pressure, hard production boundary, front seal heard as mass behind player. | Critical | Spawn `beneath_folsom_white_scab_threshold_backside`; prop `beneath_folsom_white_scab_backside_deferred_wall`; blocker `beneath_folsom_white_scab_backside_chapter_boundary`. |
| White-Scab Hall placeholder/mechanic | Skeleton room exists, but White-Scab Hall reveal/clear mechanic is not present on inspected main. Audio is ambience/blocker-only for now. | Future/deferred | Room `BF06`; future blocker state not implemented. |
| Shrine Mechanism Room skeleton | Authored skeleton exists beyond hard boundary/future route, with noninteractive central block. Treat as future ambience design only until route opens. | Future/deferred | Room `BF07`; `beneath_folsom_shrine_mechanism_central_block`; future mechanics absent. |
| Pale Panel area | Visual silhouette/scab exists; activation not present. No active panel cue yet. | Future/deferred | `beneath_folsom_pale_panel_silhouette`, `beneath_folsom_pale_panel_scab`; planned key `beneath_folsom_pale_panel_activated`. |
| Buried White Chamber skeleton | Authored skeleton/collapse exists; no active mechanism. | Future/deferred | Room `BF08`; collapsed blocks. |
| Crypt Access Stair skeleton | Authored endpoint/future stop exists; root-mat clear not implemented. | Future/deferred | Room `BF09`; `beneath_folsom_first_crypt_future_stop`; planned key `beneath_folsom_crypt_access_stair_open`. |

## 6. Physical tool audio standard

The physical tool system exists on inspected main. It is implemented by `PhysicalToolViewmodel`, `PhysicalToolActionController`, `PhysicalToolTargetRegistry`, and authored `physicalToolTargets`.

Required standard:

- Ready/equip: small hand/tool settle per tool. No UI victory sound.
- Move/windup: very quiet tool-specific air/handle movement tied to captured grip motion; avoid constant whoosh spam.
- Miss: near-field air plus material-specific scrape only if active part crosses a target candidate without acceptance.
- Wrong tool: short refusal using target material, not generic buzzer.
- Valid contact: layered tool impact plus target material response.
- Stage change: distinct enough to teach progress without text.
- Final clear/open: tool impact, target death/opening, route-space response, and screen-shake accent.

Old Work Knife:

- Short rusted blade scrape, wet cord slice, dull handle recoil.
- Use fast transients and small oily tails.
- Must not sound like a sword, dagger, katana, or clean combat blade.

Wood Axe:

- Heavy wooden handle movement, dull iron head, committed chop, hard knot/wood/char impact.
- Longer recoil and lower pitch than Knife.
- Wrong-tool or too-fast/squiggly motion should thud/skid without satisfying cut.

Iron Drain Bar:

- Socket seek: metal/stone skid variants.
- Seat: clear planted clunk with small haptic.
- Lever strain: loop or staged one-shots for early/mid/final strain.
- Release before completion: unseat scrape/relax.
- Final: forced metal/stone tear, blocker movement, dust, low structural groan.

Mobile/touch:

- Sounds must compensate for small speakers with midrange material detail, not sub-only pressure.
- Haptics already exist in the controller; audio should line up with haptic pulses.
- Tool blockers must not use Interact/A success audio. Interact can inspect or transition only after the blocker is open.

## 7. Black growth audio language

Black growth should sound physical, wet, fibrous, oily, and pressurized.

| Manifestation | Should sound like | Should not sound like |
| --- | --- | --- |
| Thin cords | Taut plant fiber, wet twine, tendon tension, small snap under blade. | Rubber band cartoon, harp string, magic chime. |
| Oily film | Sticky tar smear, blade dragging through wet soot, small suction. | Bubble slime, comedy squelch. |
| Hard knots | Burnt root burl, dense scab shell, dull cracking core. | Bone gore, candy shell, wooden crate only. |
| Black scab | Layered tarred bark and dry-wet crust tearing. | Generic gore splat, red blood splash. |
| Root pressure | Low fiber strain, buried wood under load, slow wall stress. | Monster voice, sci-fi generator. |
| Wet tendon | Close elastic fiber, sticky recoil, short snap tail. | Cartoon stretch, whip crack only. |
| Burnt mycelium | Char, ash, brittle wet underside, ember-suck when fire-adjacent. | Fireball magic, purple corruption shimmer. |
| Collapse | Cords losing tension, tar falling, scab folding inward. | Explosion, loot burst. |
| Recoil | Shrink/grow pulse, wet slap back into seam, root pulling through dirt. | UI error beep. |
| Lantern reveal | Hidden wet texture becomes audible under pale light: filtered cord tension and glass-pale resonance. | Sci-fi scan zap, purple magic sparkle. |
| Wrong-tool refusal | Material-specific skid, dull catch, failed bite. | Negative UI buzz. |
| Completed-clear death | Tension release, final snaps, oil spit, route-air change. | Victory jingle. |

Hard exclusions: no cartoon slime, no generic gore splat, no purple magic shimmer, no sci-fi UI zap.

## 8. White machinery / Ghiselian / Lantern audio language

Keeper's Lantern:

- Diegetic metal/glass object with cold contained light.
- Base loop when equipped should be very quiet: glass tick, faint pale wick/filament, hanging chain micro movement.
- Reveal layer should bloom when hidden marks/growth are inside the cone, but remain spatially focused and restrained.

Hidden Ghiselian marks:

- Pale ceramic/stone resonance, dry etched-line presence, nonverbal "readability" tone.
- Avoid UI scanner bleeps. The marks are old material becoming legible, not a HUD overlay.

Pale containment arcs / white machinery:

- White marble, ceramic, old pressure, impossible mechanical alignment.
- Use bowed glass, stone harmonics, low air displacement, and subtle non-musical tones.
- Movement should feel sacred and ancient, not servo-driven sci-fi.

Blue-flame threshold:

- Cold flame, gasless pale combustion, faint suction, glassy flicker.
- It is threshold atmosphere, not a music cue and not a replacement for the lower hatch payoff.

Musical/non-musical boundary:

- Diegetic: Lantern object, reveal wash, machinery movement, flame, growth, stone/metal.
- Non-diegetic allowed: very short discovery/route-open stingers, chapter handoff tones, and hard-stop tension, all under one second unless a route transition needs a longer tail.

## 9. Ambience and music layering

| Location/layer | Base bed | Sweeteners/random one-shots | Tension/reveal layers | Loop requirement |
| --- | --- | --- | --- | --- |
| Folsom exterior | Redwood wind, dry grass, distant town timber, soft air. | Fence creak, far bird/insect, dry leaf ticks. | Growth tension near active anchors/shed/underworks. | 60-120s loop, random one-shots every 8-25s. |
| Folsom day/night | Only current Folsom noon is implemented. Night-specific route is not present. | None yet. | Future only. | Future/deferred. |
| Pond | Water laps, reeds, mud suction, occasional fish surface tick. | Small splash/ripple. | Wet growth pressure when pond anchor revealed/uncleared. | 45-90s loop plus event one-shots. |
| Shrine exterior | Open stone wind, cold pale undertone, broken ruin resonance. | Pebble ticks, timber groan. | Side seal/under-shrine network reveal layer. | 60-120s loop. |
| Shrine side room | Close stone room tone, wood shelf creaks, metal grate resonance. | Dust ticks, old wood pops. | Lantern object/reveal layer. | 45-90s loop. |
| Crawlspace | Muffled close air, low ceiling pressure, fabric scrape potential. | Dirt trickle, root creak. | Terminal breathing darkness after opened. | 45-75s loop. |
| Underworks/Beneath Folsom | Damp stone, water drip, timber pressure, low underground air. | Metal tick, mud shift. | Hidden gate/glyph pressure under Lantern. | 60-120s loop. |
| Blue-flame hall | Cold flame bed, narrow stone resonance. | Flame flicker ticks, distant hollow pulse. | Lower hatch tension when nearby/locked. | 30-60s loop; phase randomization. |
| Lower Shrine Stair | Pale stone resonance, deep quiet, longer reverb. | Rare stone settling. | White-Scab pressure rising toward BF06. | 60-120s loop. |
| Under-Shrine Labyrinth | Near silence, breathless stone/dirt/root pressure. | Dirt ticks, root fiber creaks, timber header groans. | Squeeze low-pass, pressure moment, end hatch tension. | 90-180s sparse loop, one-shots every 12-40s. |
| White-Scab/white machinery areas | Pale stone/machine tone and black scab pressure. | Marble tick, glassy harmonic, scab creak. | Future reveal/activation layers clearly deferred. | 60-120s future loop. |
| Future crypt boundary | Hard stop, cold downward void. | Very rare distant stone fall. | Boundary refusal/blocked route tone. | Future/deferred. |

Silence use:

- Labyrinth should use near-silence as a feature, with sparse close detail.
- Route-open payoffs should briefly clear ambience before the new space bed enters.
- Avoid constant musical drone that masks tool-contact readability.

## 10. Reverb, occlusion, and spatialization requirements

AAA expectation:

- Outdoor Folsom: low reflection, wide stereo wind, close mono/3D object detail, no long dungeon reverb.
- Shrine exterior: outdoor tail plus short stone reflections near walls/altar.
- Shrine side room: small stone/wood room impulse, muffled exterior wind.
- Crawlspace: low-pass, close early reflections, reduced stereo width, body-proximity foley.
- Beneath Folsom: damp stone reverb with low-pass on distant events, drips and metal resonance spatialized.
- Blue-flame hall: narrow corridor reflections, cold flame emitters as 3D loops.
- Lower Shrine/White-Scab: longer pale stone tail, less wetness, more hard high-mid resonance.
- Under-Shrine Labyrinth: heavy occlusion, short claustrophobic reflections, low-pass in squeeze rooms, strong close detail.

Positional needs:

- Growth contact sounds should originate at target world position, with first-person tool layer blended in.
- Pry socket seat/strain must be spatialized at socket/object, not just UI center.
- Lantern reveal should spatially bias toward revealed object/mark, while the Lantern object loop remains attached to the offhand viewmodel.
- Distant structural groans should use room/zone emitters and be constrained so they do not imply false routes.

Mobile/headphones:

- Mobile speaker mix must carry material identity in 250 Hz-5 kHz, not rely on sub-bass.
- Keep simultaneous loops limited; prioritize tool hits and route-state transitions over bed density.
- Later headphone mode can add binaural wideners for outdoor wind and labyrinth close-wall pressure, but base mix must work in stereo.

## 11. UI/equipment/survival/fishing audio

Current systems:

- Inventory/equipment panel exists; equipment events are `itemAcquired` and `equippedChanged`.
- Field chests open/loot via `useFieldSurvivalChest`.
- Equipment pickups use `useEquipmentPickup`.
- Torch and Keeper's Lantern are offhand viewmodels.
- Physical work tools are selected through equipment state.
- Survival includes wood, raw fish, cooked fish, hunger/starvation, campfire build/cook/eat.
- Fishing includes Rod A1, lure/cast/fish fight/raw fish landing.

Required audio:

| System | Required sounds | Priority | Hook/source |
| --- | --- | --- | --- |
| Inventory/equipment select | Quiet tab/select, equip/unequip per slot, blocked equip. | High | `EquipmentRuntime.equip()`, `EquipmentPanel`. |
| Pickups | Tool/material pickup by item type; no fanfare. | Critical | `Interactions.useEquipmentPickup()`, `useFieldSurvivalChest()`. |
| Torch equip/use | Ignite/equip, cloth flame loop, aim/move flame sway sweeteners, extinguish/unequip. | Critical | `TorchViewmodel`, offhand `torch`. |
| Lantern equip/use | Metal/glass lift, cold light loop, reveal bloom when hitting hidden marks. | Critical | `KeepersLanternViewmodel`, `LanternConeRevealRuntime`. |
| Tool equip/unequip | Knife small scrape, Axe weight, Drain Bar heavy iron settle. | High | `EquipmentRuntime.equip()` for `tool`/`weapon`. |
| Survival state | Hunger damage warning, eating cooked fish timed loop/completion, campfire build/cook/cooked pickup. | Medium | `GameState.updateHunger()`, `Interactions` timed actions. |
| Fishing | Rod ready, line zip, lure splash, bobber/water idle, fish breach/strike/fight/escape/landing/raw pickup. | High | Fishing runtimes; current docs mark audio as future planned. |
| Transitions | Location enter/exit stingers and ambience crossfades. | Critical | `Interactions.transitionToLocation()`, exits/interactions. |
| Save/load/restored-state | No victory replay. Optional subtle restored-world settle after load. | Medium | `SaveHost`, `GameState` route flags. |

## 12. Master cue list

| cue id | category | chapter | location/room | object/system | description | trigger/event | state key if any | loop/one-shot | 2D/3D | priority | implementation notes | dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| audio_ch1_folsom_exterior_wind_bed_loop | ambience | 1 | Folsom exterior | location `folsom` | Redwood/dry-grass exterior bed. | Location enter Folsom. | none | loop | 2D | critical | Crossfade per location. | Audio manager. |
| audio_ch1_folsom_exterior_timber_creak_oneshot | ambience | 1 | Folsom exterior | border wall/trees | Sparse distant timber creaks. | Random exterior sweetener. | none | one-shot | 3D | medium | Randomized emitters. | Ambience scheduler. |
| audio_ch1_folsom_common_fire_small_loop | ambience | 1 | Folsom courtyard | `folsom_courtyard_campfire` | Small active fire loop. | Campfire present/active. | field survival campfires | loop | 3D | critical | Also used by built campfires. | Loop emitters. |
| audio_ch1_folsom_common_fire_black_growth_pressure_loop | growth | 1/2 | Folsom courtyard | `folsom_growth_anchor_fire` | Burnt knot suppressing fire. | Anchor visible/revealed and uncleared. | `folsom_growth_anchor_fire_cleared` | loop | 3D | high | Stop after clear. | Growth state hooks. |
| audio_ch1_folsom_pond_water_bed_loop | ambience | 1 | Pond | `folsom_starter_pond` | Reeds/water/mud pond bed. | Near pond/pond zone active. | none | loop | 3D | high | Distance blend. | Zone ambience. |
| audio_ch1_folsom_pond_reed_sweetener_oneshot | ambience | 1 | Pond | pond foliage | Reed ticks and small water laps. | Random pond sweetener. | none | one-shot | 3D | medium | Randomized. | Ambience scheduler. |
| audio_ch1_folsom_shed_wood_settle_loop | ambience | 1 | Tool shed | `tool-shed` | Dry shed plank/roof settling. | Near shed. | none | loop | 3D | high | Low-density loop. | Proximity zones. |
| audio_ch1_folsom_shed_growth_tension_loop | growth | 1 | Tool shed | `folsom-tool-shed-seam-growth` | Wet cord tension sealing door seam. | Shed growth intact/damaged. | `folsom_tool_shed_open` | loop | 3D | critical | Stop after open. | Growth state hooks. |
| audio_ch1_folsom_old_work_knife_pickup_oneshot | pickup | 1 | Tool shed rear | `folsom_shed_rear_knife_pickup` | Rusted blade/wood handle pickup. | Equipment pickup success. | equipment ownership | one-shot | 2D | critical | Suppress if already owned. | Pickup hook. |
| audio_ch1_folsom_knife_equip_oneshot | equipment | 1 | global | `old_work_knife` | Short tool settle/equip. | Equip tool slot. | equipment snapshot | one-shot | 2D | high | No heroic sting. | Equipment hook. |
| audio_ch1_folsom_shed_knife_hit1_wet_cut_oneshot | tool_contact | 1 | Tool shed | `folsom_tool_shed_seam_growth` | First wet cord/scab cut. | Physical hit count 1. | `folsom_tool_shed_open` | one-shot | 3D+2D | critical | Layer target + viewmodel. | Physical target hook. |
| audio_ch1_folsom_shed_knife_hit2_damage_oneshot | growth | 1 | Tool shed | `folsom_tool_shed_seam_growth` | Damaged-stage tendon slack/oil. | Physical hit count 2. | `folsom_tool_shed_open` | one-shot | 3D | critical | Stage change. | Physical target hook. |
| audio_ch1_folsom_shed_knife_hit3_final_clear_oneshot | growth | 1 | Tool shed | `folsom_tool_shed_seam_growth` | Final slice, cord snaps, oil burst. | Physical hit count 3. | `folsom_tool_shed_open` | one-shot | 3D+2D | critical | Must align with shake. | Physical target hook. |
| audio_ch1_folsom_shed_growth_oil_splash_oneshot | growth | 1 | Tool shed | oil flecks | Black oil splash flecks. | `spawnOilImpact()`. | none | one-shot | 3D | high | Variations by strength. | Effect event hook. |
| audio_ch1_folsom_shed_door_open_groan_oneshot | route_open | 1 | Tool shed | shed doors | Aged double door opening. | Door open animation starts. | `folsom_tool_shed_open` | one-shot | 3D | critical | No replay on reload. | Door animation hook. |
| audio_ch1_folsom_shed_interior_air_oneshot | route_open | 1 | Tool shed | opened shed | Stale shed air release. | Final clear/open. | `folsom_tool_shed_open` | one-shot | 3D | high | Blend into shed ambience. | Route-open hook. |
| audio_ch1_folsom_wood_axe_chest_open_oneshot | pickup | 1 | Tool shed | `folsom_wood_axe_chest` | Chest lid/strap opening. | First chest open. | field opened/looted chest | one-shot | 3D | critical | Shared chest open layer. | Chest hook. |
| audio_ch1_folsom_wood_axe_pickup_oneshot | pickup | 1 | Tool shed | `wood_axe` | Heavy axe pickup. | Loot chest. | equipment ownership | one-shot | 2D | critical | Weighty, dull iron. | Pickup hook. |
| audio_ch1_folsom_wood_axe_equip_oneshot | equipment | 1 | global | `wood_axe` | Axe equip weight/handle. | Equip weapon slot. | equipment snapshot | one-shot | 2D | high | Low-pitched. | Equipment hook. |
| audio_ch1_folsom_torch_chest_open_oneshot | pickup | 1 | Tool shed | `folsom_torch_chest` | Chest lid/strap opening. | First chest open. | field opened/looted chest | one-shot | 3D | critical | Shared with chest system. | Chest hook. |
| audio_ch1_folsom_torch_pickup_oneshot | pickup | 1 | Tool shed | `torch` | Torch pickup/cloth wood. | Loot chest. | equipment ownership | one-shot | 2D | critical | No ignition unless equipped. | Pickup hook. |
| audio_ch1_folsom_torch_equip_ignite_oneshot | equipment | 1 | global | `TorchViewmodel` | Offhand torch ignition/equip. | Equip offhand `torch`. | equipment snapshot | one-shot | 2D | critical | Pair with loop start. | Offhand hook. |
| audio_ch1_folsom_torch_flame_loop | equipment | 1 | global | `TorchViewmodel` | Held torch flame loop. | Torch active. | equipment snapshot | loop | 2D | critical | Quiet enough for tools. | Offhand loop. |
| audio_ch1_folsom_fishing_rod_chest_open_oneshot | pickup | 1 | Pond | `folsom_fishing_rod_chest` | Pond chest open. | First chest open. | field opened/looted chest | one-shot | 3D | medium | Starter system. | Chest hook. |
| audio_ch1_folsom_fishing_rod_pickup_oneshot | pickup | 1 | Pond | `fishing_rod` | Rod A1 pickup. | Loot chest. | equipment ownership | one-shot | 2D | medium | Current fishing support. | Pickup hook. |
| audio_ch1_folsom_flint_pickup_oneshot | pickup | 1 | Work yard | `folsom_flint_stick_chest` | Flint stick pickup. | Loot chest. | field key item | one-shot | 2D | medium | Survival support. | Pickup hook. |
| audio_ch1_folsom_shrine_exterior_bed_loop | ambience | 1/2 | Old Shrine | shrine exterior | Cold open-stone ruin bed. | Near shrine. | none | loop | 3D | high | Layer under side room. | Zone ambience. |
| audio_ch1_folsom_north_road_future_inspect_oneshot | inspect | 1 | North Road | `folsom_future_road` | Subtle future-road look cue. | Inspect future road. | none | one-shot | 2D | polish | Current inspect only. | Inspect hook. |
| audio_ch2_shrine_side_seal_cord_tension_loop | growth | 2 | Shrine exterior | `folsom_shrine_side_room_seal` | Cords binding side door. | Seal uncleared. | `folsom_shrine_side_room_open` | loop | 3D | critical | Stop after open. | Growth loop hook. |
| audio_ch2_shrine_side_seal_knife_cords_cut_oneshot | tool_contact | 2 | Shrine exterior | side seal stage 0 | Knife cuts side-room cords. | Stage 0 physical success. | `folsom_shrine_side_room_open` | one-shot | 3D+2D | critical | Stage 0 only. | Physical target hook. |
| audio_ch2_shrine_side_seal_axe_knot_crack_oneshot | tool_contact | 2 | Shrine exterior | side seal stage 1 | Axe cracks hard knot. | Stage 1 physical success. | `folsom_shrine_side_room_open` | one-shot | 3D+2D | critical | Bigger response. | Physical target hook. |
| audio_ch2_shrine_side_door_slide_open_oneshot | route_open | 2 | Shrine exterior | `folsom_shrine_side_room_door` | Old door drags open. | Door progress starts. | `folsom_shrine_side_room_open` | one-shot | 3D | critical | No replay on reload. | Door hook. |
| audio_ch2_shrine_side_room_bed_loop | ambience | 2 | Shrine Side Room | side room | Close buried maintenance room bed. | Enter/near side room. | none | loop | 3D | high | Small-room reverb. | Zone ambience. |
| audio_ch2_shrine_lantern_pickup_oneshot | pickup | 2 | Shrine Side Room | `folsom_shrine_side_room_keepers_lantern_pickup` | Metal/glass Lantern pickup. | Equipment pickup success. | equipment ownership | one-shot | 2D | critical | Canonical pickup. | Pickup hook. |
| audio_ch2_shrine_lantern_equip_oneshot | equipment | 2 | global | `KeepersLanternViewmodel` | Lantern lift/chain/glass. | Equip offhand `keepers_lantern`. | equipment snapshot | one-shot | 2D | critical | Pair with loop. | Offhand hook. |
| audio_ch2_shrine_lantern_cold_object_loop | equipment | 2 | global | `KeepersLanternViewmodel` | Quiet cold Lantern object loop. | Lantern active. | equipment snapshot | loop | 2D | high | Not magical shimmer. | Offhand loop. |
| audio_ch2_shrine_lantern_reveal_network_stinger | reveal | 2 | Shrine Side Room/Crawlspace | convergence marks | First network reveal bloom. | `markNetworkRevealed()`. | `folsom_under_shrine_network_revealed` | one-shot | 3D+2D | critical | No replay on reload. | Reveal hook. |
| audio_ch2_shrine_lantern_reveal_mark_focus_loop | reveal | 2 | Shrine/Crawlspace | reveal marks | Focused reveal layer under cone. | Mark inside Lantern cone. | none | loop | 3D | high | Object-local. | Reveal enter/exit hook. |
| audio_ch2_shrine_crawlspace_panel_hidden_refuse_oneshot | refusal | 2 | Shrine Side Room | panel | Hidden/no-edge refusal. | Try before reveal. | `folsom_under_shrine_network_revealed` | one-shot | 3D | high | Physical refusal. | Target prereq hook. |
| audio_ch2_shrine_crawlspace_panel_knife_cut_oneshot | tool_contact | 2 | Shrine Side Room | `folsom_shrine_crawlspace_panel` | Knife cuts revealed panel cords. | Physical success. | `folsom_shrine_crawlspace_open` | one-shot | 3D+2D | critical | Route-critical. | Physical target hook. |
| audio_ch2_shrine_crawlspace_panel_sink_oneshot | route_open | 2 | Shrine Side Room | panel | Stone panel sinks aside. | Open animation starts. | `folsom_shrine_crawlspace_open` | one-shot | 3D | critical | No replay. | Panel animation hook. |
| audio_ch2_shrine_crawlspace_muffled_bed_loop | ambience | 2 | Crawlspace | crawlspace | Low ceiling/muffled crawlspace bed. | In crawlspace low-view zone. | none | loop | 2D/3D | high | Low-pass bus. | Zone/eye-height hook. |
| audio_ch2_shrine_crawlspace_terminal_pressure_loop | ambience | 2 | Crawlspace terminal | terminal throat | Barred throat cold pressure. | Terminal shut. | `folsom_shrine_crawlspace_terminal_open` | loop | 3D | high | Stop after terminal open. | State loop hook. |
| audio_ch2_shrine_terminal_crack_open_oneshot | route_open | 2/3 | Crawlspace terminal | terminal slab/bars | Remote crack/open from lower knot. | Terminal state becomes open. | `folsom_shrine_crawlspace_terminal_open` | one-shot | 3D | critical | Trigger may happen elsewhere. | State change hook. |
| audio_ch2_fire_anchor_revealed_loop | growth | 2 | Folsom fire endpoint | `folsom_growth_anchor_fire` | Revealed burnt endpoint tension. | Network revealed and uncleared. | `folsom_growth_anchor_fire_cleared` | loop | 3D | high | Stop on clear. | Anchor hook. |
| audio_ch2_fire_anchor_axe_chop_oneshot | tool_contact | 2 | Folsom fire endpoint | fire anchor | Axe splits fire-hardened knot. | Physical success. | `folsom_growth_anchor_fire_cleared` | one-shot | 3D+2D | critical | Burnt/char layer. | Physical target hook. |
| audio_ch2_fire_anchor_feed_slacken_oneshot | growth | 2 | Folsom feed | `folsom_growth_feed_fire` | Feed slackens after clear. | Anchor clear. | `folsom_growth_anchor_fire_cleared` | one-shot | 3D | high | Along feed path. | Anchor clear hook. |
| audio_ch2_pond_anchor_revealed_loop | growth | 2 | Pond endpoint | `folsom_growth_anchor_pond` | Wet root endpoint tension. | Network revealed and uncleared. | `folsom_growth_anchor_pond_cleared` | loop | 3D | high | Stop on clear. | Anchor hook. |
| audio_ch2_pond_anchor_knife_cut_oneshot | tool_contact | 2 | Pond endpoint | pond anchor | Knife cuts wet root knot. | Physical success. | `folsom_growth_anchor_pond_cleared` | one-shot | 3D+2D | critical | Mud/water layer. | Physical target hook. |
| audio_ch2_pond_anchor_feed_slurp_oneshot | growth | 2 | Pond feed | `folsom_growth_feed_pond` | Wet feed pulls/slackens. | Anchor clear. | `folsom_growth_anchor_pond_cleared` | one-shot | 3D | high | Waterline. | Anchor clear hook. |
| audio_ch2_shrine_anchor_revealed_loop | growth | 2 | Shrine endpoint | `folsom_growth_anchor_shrine` | Shrine cord tension on stone. | Network revealed and uncleared. | `folsom_growth_anchor_shrine_cleared` | loop | 3D | high | Stop on clear. | Anchor hook. |
| audio_ch2_shrine_anchor_knife_cut_oneshot | tool_contact | 2 | Shrine endpoint | shrine anchor | Knife cuts shrine-bound cords. | Physical success. | `folsom_growth_anchor_shrine_cleared` | one-shot | 3D+2D | critical | Stone scrape layer. | Physical target hook. |
| audio_ch2_shrine_anchor_feed_slacken_oneshot | growth | 2 | Shrine feed | `folsom_growth_feed_shrine` | Feed slackens across stone. | Anchor clear. | `folsom_growth_anchor_shrine_cleared` | one-shot | 3D | high | Along feed path. | Anchor clear hook. |
| audio_ch2_underworks_lock_tension_loop | growth | 2 | Folsom Underworks gate | `folsom_underworks_growth_lock` | Main lock root pressure. | Underworks sealed. | `folsom_underworks_growth_unsealed` | loop | 3D | critical | Stop on unseal. | State loop hook. |
| audio_ch2_underworks_lock_unseal_burst_oneshot | route_open | 2 | Folsom Underworks gate | growth lock | Oil burst/cord collapse. | All anchors cleared. | `folsom_underworks_growth_unsealed` | one-shot | 3D | critical | Route payoff. | `unsealUnderworks()`. |
| audio_ch2_underworks_gate_rise_oneshot | route_open | 2 | Folsom Underworks gate | `folsom_cellar_gate` | Rusted gate rises/opens. | Gate open progress. | `folsom_underworks_growth_unsealed` | one-shot | 3D | critical | Sync animation. | Gate hook. |
| audio_ch2_folsom_to_beneath_transition_stinger | transition | 2 | Folsom->BF01 | `folsom_underworks_locked` | Outdoor-to-underground handoff. | Transition to `beneath-folsom`. | `folsom_underworks_growth_unsealed` | one-shot | 2D | critical | Crossfade ambience. | Transition hook. |
| audio_ch2_beneath_entry_stair_bed_loop | ambience | 2 | BF01 | Underworks Entry Stair | Damp entry stair bed. | Location enter BF01. | none | loop | 2D | critical | Interior bus. | Location ambience. |
| audio_ch2_beneath_damp_drip_sweetener_oneshot | ambience | 2 | BF01-BF03 | Underworks | Random damp drips/ticks. | Interior ambience scheduler. | none | one-shot | 3D | medium | Sparse. | Scheduler. |
| audio_ch2_beneath_iron_drain_bar_pickup_oneshot | pickup | 2 | BF02 | `beneath_folsom_iron_drain_bar_pickup` | Heavy iron bar pickup. | Equipment pickup success. | equipment ownership | one-shot | 2D | critical | Persistent local pry tool. | Pickup hook. |
| audio_ch2_beneath_iron_drain_bar_equip_oneshot | equipment | 2 | global | `iron_drain_bar` | Heavy iron equip settle. | Equip tool slot. | equipment snapshot | one-shot | 2D | high | Longer than Knife. | Equipment hook. |
| audio_ch2_beneath_drain_grate_socket_skid_oneshot | pry | 2 | BF02 | drain grate socket | Tip skids near socket. | Socket seek wrong contact. | none | one-shot | 3D+2D | high | Replaces generic skid. | Pry hook. |
| audio_ch2_beneath_drain_grate_socket_seat_oneshot | pry | 2 | BF02 | drain grate socket | Bar seats in bent rusted socket. | `socketState` seated. | none | one-shot | 3D+2D | critical | Haptic aligned. | Pry seat hook. |
| audio_ch2_beneath_drain_grate_pry_strain_loop | pry | 2 | BF02 | drain grate | Rust/metal short strain. | Seated strain > early. | none | loop | 3D | critical | Stop on release/open. | Pry strain hook. |
| audio_ch2_beneath_drain_grate_open_shriek_oneshot | route_open | 2 | BF02 | `beneath_folsom_drain_grate` | Old drain bars shriek open. | Pry completion. | `beneath_folsom_drain_grate_pried` | one-shot | 3D | critical | Current message says shriek. | Completion hook. |
| audio_ch2_beneath_lower_wall_glyph_reveal_loop | reveal | 2 | BF03 | glyph cluster | Lantern reveals lower-wall glyphs. | Decal in Lantern cone. | `beneath_folsom_keepers_lantern_reveal_seen` intended only | loop | 3D | critical | Do not rely on state yet. | Reveal hook. |
| audio_ch2_beneath_hidden_growth_gate_pressure_loop | growth | 2 | BF03 | hidden gate | Hidden wall pressure under reveal. | Gate revealed and uncleared. | `beneath_folsom_hidden_growth_gate_cleared` | loop | 3D | critical | Stop after clear. | Reveal/growth hook. |
| audio_ch2_beneath_hidden_growth_gate_hit1_oneshot | tool_contact | 2 | BF03 | hidden gate | First wet hidden cut. | Hit count 1. | none | one-shot | 3D+2D | critical | Partial hits not persisted. | Physical target hook. |
| audio_ch2_beneath_hidden_growth_gate_hit2_oneshot | tool_contact | 2 | BF03 | hidden gate | Second cut/cord weakening. | Hit count 2. | none | one-shot | 3D+2D | critical | Variant. | Physical target hook. |
| audio_ch2_beneath_hidden_growth_gate_hit3_oneshot | tool_contact | 2 | BF03 | hidden gate | Third cut/scab damage. | Hit count 3. | none | one-shot | 3D+2D | critical | Variant. | Physical target hook. |
| audio_ch2_beneath_hidden_growth_gate_hit4_oneshot | tool_contact | 2 | BF03 | hidden gate | Fourth cut/pre-collapse. | Hit count 4. | none | one-shot | 3D+2D | critical | Variant. | Physical target hook. |
| audio_ch2_beneath_hidden_growth_gate_final_collapse_oneshot | route_open | 2 | BF03/BF04 | hidden gate | Final collapse and wall fade. | Hit count 5. | `beneath_folsom_hidden_growth_gate_cleared` | one-shot | 3D | critical | Route-open. | Completion hook. |
| audio_ch2_beneath_blue_flame_hall_loop | ambience | 2 | BF04 | blue flame fixtures | Cold blue flame corridor loop. | Hall visible/entered. | `beneath_folsom_hidden_growth_gate_cleared` | loop | 3D | high | Multiple emitters budgeted. | Loop emitters. |
| audio_ch2_beneath_blue_hall_reveal_stinger | transition | 2 | BF04 | blue hall | Cold threshold reveal after wall fade. | Hall first visible. | `beneath_folsom_hidden_growth_gate_cleared` | one-shot | 2D | high | No replay on reload. | State change hook. |
| audio_ch2_beneath_lower_hatch_socket_skid_oneshot | pry | 2 | BF04 | lower hatch socket | Stone/iron socket skid. | Socket seek wrong contact. | none | one-shot | 3D+2D | high | Heavier than grate. | Pry hook. |
| audio_ch2_beneath_lower_hatch_socket_seat_oneshot | pry | 2 | BF04 | lower hatch socket | Bar seats in stone-bound notch. | `socketState` seated. | none | one-shot | 3D+2D | critical | Haptic aligned. | Pry seat hook. |
| audio_ch2_beneath_lower_hatch_strain_early_oneshot | pry | 2 | BF04 | lower hatch | Early stone dust/strain. | Strain stage early. | none | one-shot | 3D | critical | Stage event. | Pry strain hook. |
| audio_ch2_beneath_lower_hatch_strain_mid_oneshot | pry | 2 | BF04 | lower hatch | Mid groan/iron flex. | Strain stage mid. | none | one-shot | 3D | critical | Stage event. | Pry strain hook. |
| audio_ch2_beneath_lower_hatch_final_tear_oneshot | route_open | 2 | BF04/BF05 | lower hatch | Hatch tears open. | Pry completion. | `beneath_folsom_lower_shrine_hatch_open` | one-shot | 3D+2D | critical | Longer/heavier. | Completion hook. |
| audio_ch2_lower_shrine_handoff_stinger | transition | 2/3 | BF05 | lower shrine stair | Blue hall to pale stair handoff. | Enter BF05 after hatch open. | `beneath_folsom_lower_shrine_hatch_open` | one-shot | 2D | critical | Chapter handoff. | Zone enter hook. |
| audio_ch3_lower_shrine_stair_bed_loop | ambience | 3 | BF05 | Lower Shrine Stair | Pale cold stair ambience. | In BF05. | none | loop | 2D | critical | Longer reverb. | Zone ambience. |
| audio_ch3_white_scab_front_seal_pressure_loop | ambience | 3 | BF06 | `beneath_folsom_white_scab_front_seal` | Massive impossible pressure. | Near front seal. | none | loop | 3D | critical | Never opens locally. | Proximity loop. |
| audio_ch3_white_scab_broad_seal_refuse_oneshot | refusal | 3 | BF06 | front seal | Futile broad-seal refusal. | Future wrong target/inspect. | none | one-shot | 3D | high | No clear success. | Future hook. |
| audio_ch3_white_scab_lower_knot_hit1_oneshot | tool_contact | 3 | BF06 | lower knot | First hard catch/twist. | Hit count 1. | none | one-shot | 3D+2D | critical | Stage 1. | Physical target hook. |
| audio_ch3_white_scab_lower_knot_hit2_split_oneshot | tool_contact | 3 | BF06 | lower knot | Cord nest splits/pulls down. | Hit count 2. | none | one-shot | 3D+2D | critical | Stage 2. | Physical target hook. |
| audio_ch3_white_scab_lower_knot_final_tear_oneshot | route_open | 3 | BF06 | lower knot | Cords tear backward into earth. | Hit count 3. | `beneath_folsom_white_scab_lower_knot_destroyed` | one-shot | 3D | critical | Must not imply seal opens. | Completion hook. |
| audio_ch3_white_scab_terminal_remote_answer_oneshot | route_open | 3 | Folsom crawlspace | terminal throat | Remote terminal answer/open. | Lower knot completion writes terminal state. | `folsom_shrine_crawlspace_terminal_open` | one-shot | 3D/2D | critical | May need delayed remote cue. | State event hook. |
| audio_ch3_folsom_terminal_darkness_breath_loop | ambience | 3 | Folsom crawlspace | terminal darkness | Open terminal breathing darkness. | Terminal open. | `folsom_shrine_crawlspace_terminal_open` | loop | 3D | high | Stop outside proximity. | State loop hook. |
| audio_ch3_under_shrine_entry_transition_stinger | transition | 3 | Folsom->USL01 | terminal entrance | Enter pitch-black labyrinth. | Transition to `under-shrine-labyrinth`. | `folsom_shrine_crawlspace_terminal_open` | one-shot | 2D | critical | Crossfade. | Transition hook. |
| audio_ch3_under_shrine_labyrinth_void_bed_loop | ambience | 3 | USL01-USL10 | labyrinth | Near-silent claustrophobic bed. | In labyrinth. | none | loop | 2D | critical | Sparse. | Location ambience. |
| audio_ch3_under_shrine_labyrinth_root_creak_oneshot | ambience | 3 | USL route | root bands | Random root pressure creaks. | Random sweetener. | none | one-shot | 3D | high | Sparse. | Scheduler. |
| audio_ch3_under_shrine_labyrinth_timber_overhead_oneshot | ambience | 3 | USL route | timber headers | Low overhead timber groan. | Random/near timber. | none | one-shot | 3D | medium | Not too frequent. | Scheduler. |
| audio_ch3_under_shrine_labyrinth_squeeze_lowpass_snapshot | mix | 3 | USL03/USL07 | squeeze rooms | Muffled squeeze acoustics. | Enter tight squeeze room. | none | loop/snapshot | 2D | high | Bus snapshot. | Reverb zones. |
| audio_ch3_under_shrine_breathing_pocket_air_loop | ambience | 3 | USL06 | breathing pocket | Slightly wider air/pale slab. | In USL06. | none | loop | 2D/3D | high | Contrast layer. | Zone ambience. |
| audio_ch3_under_shrine_pressure_root_groan_oneshot | ambience | 3 | USL05 | pressure root/stone | Impossible pressure groan. | Near/first view. | none | one-shot | 3D | high | No interact success. | Proximity/view hook. |
| audio_ch3_under_shrine_end_hatch_pressure_loop | ambience | 3 | USL10 | end hatch | Buried hatch pressure. | Hatch closed/near. | `under_shrine_labyrinth_end_hatch_open` | loop | 3D | high | Stop after open. | State loop hook. |
| audio_ch3_under_shrine_end_hatch_socket_skid_oneshot | pry | 3 | USL10 | end hatch socket | Metal-stone skid. | Socket seek wrong contact. | none | one-shot | 3D+2D | high | Target-specific. | Pry hook. |
| audio_ch3_under_shrine_end_hatch_socket_seat_oneshot | pry | 3 | USL10 | end hatch socket | Bar seats in buried fulcrum. | `socketState` seated. | none | one-shot | 3D+2D | critical | Haptic aligned. | Pry hook. |
| audio_ch3_under_shrine_end_hatch_pry_strain_loop | pry | 3 | USL10 | end hatch | Buried hatch strain. | Seated strain. | none | loop | 3D | critical | Stop release/open. | Pry hook. |
| audio_ch3_under_shrine_end_hatch_open_oneshot | route_open | 3 | USL10 | end hatch | Hatch tears inward. | Pry completion. | `under_shrine_labyrinth_end_hatch_open` | one-shot | 3D | critical | Route exit opens. | Completion hook. |
| audio_ch3_threshold_backside_arrival_stinger | transition | 3 | BF07 backside | backside spawn | Arrival behind denied threshold. | Transition to BF07 backside. | `under_shrine_labyrinth_end_hatch_open` | one-shot | 2D | critical | Crossfade back to BF ambience. | Transition hook. |
| audio_ch3_threshold_backside_boundary_loop | ambience | 3 | BF07 | hard boundary | Production boundary pressure. | Near backside boundary. | none | loop | 3D | high | Current hard stop. | Proximity loop. |
| audio_ch3_threshold_backside_boundary_refuse_oneshot | refusal | 3 | BF07 | hard boundary | Blocked future route refusal. | Interact/approach boundary if hooked. | none | one-shot | 3D | medium | Future hook. | Boundary hook. |
| audio_ch3_mechanism_room_pale_dormant_loop | ambience | 3 | BF07 | mechanism skeleton | Dormant white machinery tone. | Future accessible area. | none | loop | 3D | future | Authored skeleton only. | Future route. |
| audio_ch3_pale_panel_dormant_loop | ambience | 3 | BF07 | pale panel | Dormant panel/scab pressure. | Future accessible area. | `beneath_folsom_pale_panel_activated` planned | loop | 3D | future | Mechanic absent. | Future route. |
| audio_ch3_buried_white_chamber_dormant_loop | ambience | 3 | BF08 | buried chamber | White chamber dormant bed. | Future accessible area. | none | loop | 3D | future | Skeleton only. | Future route. |
| audio_ch3_crypt_root_mat_future_pressure_loop | ambience | 3 | BF08 | crypt root mat | Future root mat pressure. | Future accessible area. | `beneath_folsom_crypt_access_stair_open` planned | loop | 3D | future | Mechanic absent. | Future route. |
| audio_ch3_crypt_access_future_stop_loop | ambience | 3 | BF09 | first crypt boundary | Hard no-Chapter-4 boundary. | Future accessible endpoint. | none | loop | 3D | future | Skeleton only. | Future route. |
| audio_ui_inventory_open_oneshot | ui | all | global | inventory UI | Inventory/equipment open. | Panel opens. | none | one-shot | 2D | high | Quiet. | UI hook. |
| audio_ui_inventory_select_oneshot | ui | all | global | inventory UI | Select/tab click. | UI selection. | none | one-shot | 2D | high | Short. | UI hook. |
| audio_ui_equip_blocked_oneshot | ui | all | global | equipment | Blocked/missing equip. | Equip fails. | none | one-shot | 2D | medium | Non-annoying. | Equipment hook. |
| audio_survival_campfire_build_loop | survival | 1 | Folsom field | campfire build | Building campfire timed loop. | Timed action active. | field campfire state | loop | 2D/3D | medium | Stop on cancel/complete. | Timed-action hook. |
| audio_survival_campfire_build_complete_oneshot | survival | 1 | Folsom field | campfire build | Campfire built completion. | Timed action complete. | field campfire state | one-shot | 3D | medium | Route-adjacent. | Timed-action hook. |
| audio_survival_fish_cook_loop | survival | 1 | campfire | cooking | Cooking fish loop. | Cook timed action active. | raw/cooked fish | loop | 3D | medium | Fire + sizzle. | Timed-action hook. |
| audio_survival_fish_cooked_pickup_oneshot | pickup | 1 | campfire | cooked fish | Cooked fish pickup. | Pickup cooked fish. | inventory count | one-shot | 2D | medium | Survival. | Pickup hook. |
| audio_survival_eat_cooked_fish_loop | survival | 1 | global | eating | Eating timed loop. | `audioPhase: eatingCookedFish`. | inventory count | loop | 2D | medium | Existing named future hook. | Timed-action audio. |
| audio_survival_hunger_damage_oneshot | survival | all | global | hunger | Starvation damage warning. | Hunger damage tick. | survival state | one-shot | 2D | medium | Avoid overuse. | Survival hook. |
| audio_fishing_rod_cast_windup_oneshot | fishing | 1 | Pond | Rod A1 | Rod cast windup. | Cast gesture. | none | one-shot | 2D | high | Current fishing. | Fishing hook. |
| audio_fishing_line_release_zip_oneshot | fishing | 1 | Pond | Rod A1 line | Line release. | Lure launched. | none | one-shot | 2D | high | Current fishing. | Fishing hook. |
| audio_fishing_lure_water_splash_oneshot | fishing | 1 | Pond | lure | Lure lands in water. | Lure water contact. | none | one-shot | 3D | high | Position at water. | Fishing hook. |
| audio_fishing_fish_breach_oneshot | fishing | 1 | Pond | fish actor | Fish breach/splash. | Fish breach. | none | one-shot | 3D | high | Docs request future. | Fishing hook. |
| audio_fishing_fish_strike_oneshot | fishing | 1 | Pond | fish actor | Bite/strike. | Fish strikes lure. | none | one-shot | 2D/3D | high | Haptic aligned. | Fishing hook. |
| audio_fishing_reel_tension_loop | fishing | 1 | Pond | reel/line | Reel/line tension loop. | Hooked fight/reel. | none | loop | 2D | high | Pitch by tension. | Fishing hook. |
| audio_fishing_fish_escape_oneshot | fishing | 1 | Pond | fish actor | Escape splash/slack. | Hooked fish escapes. | none | one-shot | 3D | medium | Future planned. | Fishing hook. |
| audio_fishing_fish_landing_oneshot | fishing | 1 | Pond | raw fish | Fish lands on shore. | Raw fish pickup spawned. | raw fish pickup | one-shot | 3D | high | Current landing state. | Fishing hook. |
| audio_transition_location_enter_generic_oneshot | transition | all | global | location routing | Short location-enter settle. | Any location transition. | none | one-shot | 2D | high | Specific stingers override. | Transition hook. |
| audio_save_restore_world_settle_oneshot | save | all | global | save/load | Subtle restored-state settle. | Continue/load complete. | many | one-shot | 2D | polish | No victory replay. | Save hook. |

## 13. Missing implementation hooks

| File/function/object | Event needed | State key involved | Why it matters | Priority |
| --- | --- | --- | --- | --- |
| `src/game/audio` | Asset-backed audio manager/mixer | all | Required before replacing procedural sounds. | Critical |
| `TitleAmbience` / title startup | Configurable title/menu ambience source | none | Existing title audio path is inert. | Medium |
| `DungeonScene.loadCompiledLocation()` / outdoor setup | Location ambience enter/exit | location id | Starts/stops Folsom/Beneath/Labyrinth beds. | Critical |
| `Interactions.transitionToLocation()` | Transition stinger/crossfade event | route states | Makes route changes readable. | Critical |
| `EquipmentRuntime.acquireItem()` | Pickup/equipment-acquired cue event | equipment snapshot | All tool pickup cues. | Critical |
| `EquipmentRuntime.equip()` | Equip/unequip cue event by slot/item | equipment snapshot | Torch/Lantern/tool readiness. | High |
| `Interactions.useFieldSurvivalChest()` | Chest open vs loot events | field chest state | Current chests are visually opened but silent. | High |
| `FolsomShedGrowthRuntime.strike()` | Hit count/stage/final cue event | `folsom_tool_shed_open` | Chapter 1 proof loop readability. | Critical |
| `FolsomShedGrowthRuntime.clearGrowth()` | Cord snap/oil/door release event | `folsom_tool_shed_open` | Final clear payoff. | Critical |
| `FolsomShrineInvestigationRuntime.advanceSideRoom()` | Knife-cord/Axe-knot stage events | `folsom_shrine_side_room_open` | Chapter 2 side seal. | Critical |
| `FolsomShrineInvestigationRuntime.markNetworkRevealed()` | Network reveal stinger/loop event | `folsom_under_shrine_network_revealed` | Lantern proof. | Critical |
| `FolsomShrineInvestigationRuntime.openCrawlspace()` | Panel cut/sink/open event | `folsom_shrine_crawlspace_open` | Crawlspace route clarity. | Critical |
| `FolsomShrineInvestigationRuntime.updateTerminal()` | Terminal open/breath loop event | `folsom_shrine_crawlspace_terminal_open` | Chapter 3 bypass clarity. | Critical |
| `FolsomConnectedGrowthRuntime.clearAnchor()` | Anchor clear event by type | anchor clear keys | Fire/pond/shrine endpoint feedback. | Critical |
| `FolsomConnectedGrowthRuntime.unsealUnderworks()` | Underworks route-open event | `folsom_underworks_growth_unsealed` | Chapter 2 surface payoff. | Critical |
| `PhysicalToolActionController` | Tool ready/move/windup/miss/wrong/valid/final events | target completion keys | Replace oscillator placeholders with routed cues. | Critical |
| `PhysicalToolActionController.updateSocketedPry()` | Socket seat/strain stage/release events | pry target keys | Drain/hatch/end hatch audio. | Critical |
| `BeneathFolsomHiddenGrowthGateRuntime.strike()` | Five hit stage events | `beneath_folsom_hidden_growth_gate_cleared` | Hidden gate progression. | Critical |
| `BeneathFolsomHiddenGrowthGateRuntime.clear()` / `updateWall()` | Collapse/wall fade/blue hall reveal | `beneath_folsom_hidden_growth_gate_cleared` | Chapter 2 capstone. | Critical |
| `DungeonScene.pryBeneathFolsomDrainGrate()` | Drain grate final open | `beneath_folsom_drain_grate_pried` | Current message says shriek, needs sound. | Critical |
| `BeneathFolsomLowerShrineHatchRuntime.pry()` | Lower hatch final open | `beneath_folsom_lower_shrine_hatch_open` | Chapter 2 endpoint. | Critical |
| `BeneathFolsomWhiteScabRuntime.strike()` | Lower knot 3-hit stages/final remote answer | `beneath_folsom_white_scab_lower_knot_destroyed` | Chapter 3 lead-in. | Critical |
| `UnderShrineLabyrinthEndHatchRuntime.openHatch()` | End hatch final open | `under_shrine_labyrinth_end_hatch_open` | Labyrinth exit. | Critical |
| `LanternConeRevealRuntime.update()` | Reveal enter/hold/exit per object | reveal-state varies | Needed for reveal layers. | High |
| `GameState.markBeneathFolsomKeepersLanternRevealSeen()` | Wire actual call or stop using for audio | `beneath_folsom_keepers_lantern_reveal_seen` | Current state is unreliable. | High |
| `Interactions` timed actions | Loop start/stop/complete/cancel audio | survival state | Campfire/cook/eat audio. | Medium |
| Fishing runtimes | Cast/water/fish/reel events | fish pickup/inventory | Current fishing has no audio hooks. | High |

## 14. Asset production shopping list

| Session group | Approx count | Variations | Loop/one-shot | Priority | Implementation risk |
| --- | ---: | ---: | --- | --- | --- |
| Field ambience | 8-12 loops | 3-6 sweeteners per zone | loops + one-shots | Critical | Needs ambience system first. |
| Pond/water/reed ambience | 4-6 loops, 12 one-shots | 6-10 water variations | both | High | Needs zone proximity. |
| Wood/stone/iron foley | 60-90 one-shots | 6-12 per material/action | one-shot | Critical | Can start once one-shot routing exists. |
| Wet organic growth | 70-100 one-shots, 8 loops | 8-16 cut/snap/oil variants | both | Critical | Needs target/stage hooks. |
| Tool impacts | 45-70 one-shots | Knife/Axe/Bar separate sets | one-shot | Critical | Must layer 2D/3D. |
| Prybar strain | 9-12 loops, 20 one-shots | 3 targets x early/mid/final | both | Critical | Needs loop lifecycle. |
| Lantern/reveal design | 6-10 loops, 20 one-shots | reveal enter/hold/stinger variants | both | Critical | Needs reveal enter/exit events. |
| White machinery design | 8-12 loops, 20 one-shots | dormant/move/activate future | both | Future | Do not overbuild before mechanics. |
| UI/equipment | 25-40 one-shots | 3-6 variants | one-shot | High | Low risk once UI hooks exist. |
| Survival/fishing | 40-70 one-shots, 8 loops | fish sizes, water, reel tension | both | High | Many hooks absent. |
| Transition stingers | 12-18 one-shots | route-specific | one-shot | Critical | Needs transition hook. |
| Chapter-specific beds | 10-16 loops | location/room snapshots | loops | Critical | Needs ambience/reverb zones. |

## 15. First implementation milestone recommendation

Smallest first audio implementation pass after this doc:

1. Build a lightweight audio manager that supports mobile unlock, 2D one-shots, 3D one-shots, 3D/2D loops, categories, mute, and safe cleanup.
2. Wire route-critical hooks only for Chapter 1 shed, Chapter 2 shrine/network/Underworks/Beneath route, and Chapter 3 lead-in blockers. Do not build future White-Scab Hall/Pale Panel mechanics.
3. Implement a narrow cue pack with placeholder-free final-ish authored assets for the first playable spine.

First cue IDs to implement:

- `audio_ch1_folsom_exterior_wind_bed_loop`
- `audio_ch1_folsom_shed_growth_tension_loop`
- `audio_ch1_folsom_old_work_knife_pickup_oneshot`
- `audio_ch1_folsom_shed_knife_hit1_wet_cut_oneshot`
- `audio_ch1_folsom_shed_knife_hit2_damage_oneshot`
- `audio_ch1_folsom_shed_knife_hit3_final_clear_oneshot`
- `audio_ch1_folsom_shed_door_open_groan_oneshot`
- `audio_ch1_folsom_wood_axe_pickup_oneshot`
- `audio_ch1_folsom_torch_pickup_oneshot`
- `audio_ch2_shrine_side_seal_knife_cords_cut_oneshot`
- `audio_ch2_shrine_side_seal_axe_knot_crack_oneshot`
- `audio_ch2_shrine_lantern_pickup_oneshot`
- `audio_ch2_shrine_lantern_reveal_network_stinger`
- `audio_ch2_shrine_crawlspace_panel_knife_cut_oneshot`
- `audio_ch2_fire_anchor_axe_chop_oneshot`
- `audio_ch2_pond_anchor_knife_cut_oneshot`
- `audio_ch2_shrine_anchor_knife_cut_oneshot`
- `audio_ch2_underworks_lock_unseal_burst_oneshot`
- `audio_ch2_underworks_gate_rise_oneshot`
- `audio_ch2_beneath_entry_stair_bed_loop`
- `audio_ch2_beneath_iron_drain_bar_pickup_oneshot`
- `audio_ch2_beneath_drain_grate_socket_seat_oneshot`
- `audio_ch2_beneath_drain_grate_open_shriek_oneshot`
- `audio_ch2_beneath_lower_wall_glyph_reveal_loop`
- `audio_ch2_beneath_hidden_growth_gate_final_collapse_oneshot`
- `audio_ch2_beneath_blue_flame_hall_loop`
- `audio_ch2_beneath_lower_hatch_final_tear_oneshot`
- `audio_ch3_lower_shrine_stair_bed_loop`
- `audio_ch3_white_scab_lower_knot_final_tear_oneshot`
- `audio_ch3_under_shrine_labyrinth_void_bed_loop`
- `audio_ch3_under_shrine_end_hatch_open_oneshot`

## 16. Open questions

- Should `beneath_folsom_keepers_lantern_reveal_seen` be wired as a reliable persisted discovery flag, or should audio treat Lantern reveal as purely session/runtime without persistence?
- Should the first audio implementation include material footsteps, or should footsteps wait until object/terrain material dispatch is explicit?
- Should Chapter 1's non-present wake road/west gate be ignored until authored, or should Folsom exterior ambience reserve a future intro variant?
- Does the project want retro OST support in the first pipeline milestone, or should music wait until ambience/SFX routing is stable?

# DSB Design-Locked Guide Asset Gap Audit

Audit date: 2026-07-02  
Guide sources: `dread_stone_black_strategy_guide_DESIGN_LOCKED_MASTER_01-19.md` and `dsb_strategy_guide_stage_4e_assembly_summary.txt`  
Repository basis: the checked-out source and assets in `Herbachino1776/Dread_Stone_Black`; source code is treated as authoritative when older architecture notes disagree with it.

## 1. Executive Summary

The current repository can support a focused prototype of the guide's first physical loop, but it cannot yet support the guide as a 19-chapter game. Its strongest foundations are Folsom, data-driven indoor/outdoor location authoring, collision, interactions and prompts, objective facts/actions, local save persistence, survival inventory/equipment, mobile controls, procedural world props, pond/fishing, foliage, lighting, and a cached GLB loader. Those systems provide a credible place to build and persist a Folsom growth-cover prototype.

The content gap is much larger than the raw file count suggests. `public/assets/` currently contains 112 PNGs, one SVG, and one GLB. Most PNGs are environment surfaces, fish skins, foliage billboards, sky panoramas, water frames, or campfire frames. There are no committed growth-specific textures or models, no enemy/NPC assets, no tool models except a procedural Rod A1 and procedural world props, no Records/Memory/network UI art, no church mechanism kit, no white-system kit, no royal contamination kit, no living-architecture kit, and no shipped audio directory. The title runtime references an absent `/assets/audio/title_drone_loop.mp3` and intentionally continues silently when it cannot load.

The runtime gap is also fundamental. Current source has no active player attack runtime, damageable world-object contract, creature actor runtime, enemy AI, body-growth mechanic, gore/effect runtime, Records or Memory interface, map/network state model, Keeper's Lantern reveal pass, white-system node runtime, or ending evaluator. Weapon profiles retain damage/range metadata and objective facts can represent damaged/killed species, but those are dormant data hooks, not playable combat. Older documents describing Ram Man, Sheep Demon, Neck Man, `CreatureWorldRuntime`, faction AI, and gore refer to files and assets that are no longer present in this checkout and must not be counted as current capability.

The guide's correct implementation seam is:

`authored growth cover -> damageable staged visual -> linked reveal target -> objective/route fact -> saved world state`

The single best next asset request is therefore a small **black growth v1 + reveal targets** pack for one Folsom tool-shed latch, one chest cover, and one pale-panel test target. It should not be a full-game asset dump.

## 2. Current Repo Reality

### Playable areas and routing

- `src/game/locationRouting.js` makes `folsom` the default startup location.
- `src/game/locations/folsom.definition.js` authors a mobile-sized outdoor starter town with terrain, paths, a pond, palisade wall kit, dense billboard foliage, tool shed, shrine, house, Underworks placeholder, north-road marker, Rusted Reliquary exit, four survival chests, and a campfire.
- Folsom currently exits to `reliquary-field`; the legacy field connects to South Reliquary Crypt and numerous test/expo entrances.
- The location registry also exposes Black Grass Temple, Field Keeper House, Level 1/DD+, Balthazan, Kerovac, Sumerian test districts, OARB Feature Yard, OARB Outdoor Expo, South Reliquary Crypt, Reliquary Field, and a v2 test shrine. These are authored/test spaces, not the guide's 19 implemented chapters.
- `src/engine/dungeon-authoring/` is the DARB-style definition/compiler/geometry/collision/navigation/spawn/validation stack. `src/engine/outdoor-authoring/` plus outdoor fields in location definitions form the OARB-style terrain, spline, pond, foliage, blocker, and primitive foundation. Generated definitions under `src/game/locations/generated/` demonstrate DD+/Expo-style geometry breadth.

### Asset reality

- The committed asset inventory is predominantly lightweight raster art: 512x512 environment textures, 256x256 fish textures, foliage sprites, three sky panoramas, six 512x512 pond animation frames, and six 512x512 campfire frames.
- `public/assets/models/weapons/weapon_broadsword_ritual_01.glb` is the only committed GLB. Current source does not register or instantiate it; documentation describing a `rusted_sword` compatibility path is stale relative to the current Player + Fish baseline, whose save repair strips `rusted_sword`.
- `public/assets/ui/` and `public/assets/weapons/` contain only `.gitkeep` files.
- `public/assets/audio/`, `public/assets/enemies/`, `public/assets/npcs/`, and `public/assets/gore/` do not exist.
- Several extensionless files (`gh`, `io`, `ty`, `ye`, and `2`) appear to be stray placeholders and are not usable assets.

### Runtime systems that exist

- `src/game/Game.js` is a coordinator over renderer, input, save, progression, survival, scene-session, HUD, and first-person viewmodel hosts.
- `src/game/DungeonScene.js` remains a large world-scene orchestrator. It compiles authored locations and also owns legacy/procedural outdoor chests, campfires, shrine props, foliage, entrance markers, indoor keys/gates/levers, and scene material loading.
- `src/game/Interactions.js` supports proximity/facing prompts, inspect interactions, pickups, chests, harvesting, fishing, cooking, campfire construction, keys, gates, shortcuts, secret walls, levers, exits, and timed/hold actions.
- `src/engine/objectives/` supports registered objectives, steps, persistent facts, events, flags, interaction/gate unlock actions, item grants, and UI messages. It is the nearest current foundation for route-state facts, but it has no typed map/Records/Memory/network domains.
- `src/engine/equipment/` and `src/game/equipment/` provide item acquisition, slots, weapon profile metadata, save snapshots, an equipment panel, and a bridge to survival inventory.
- `src/game/GameState.js` persists equipment, objective snapshots, hunger, field items, chests, harvested trees, campfires, and a small Reliquary progression flag through `localStorage`.
- `src/game/fishing/` and `src/game/world-scene/FishingWorldRuntime.js` implement physical rod-touch casting, lure/line behavior, fish species/geometry, fish pickups, and fishing-zone resolution.
- `src/engine/outdoor-authoring/` implements terrain sampling, paths, ponds, water presentation, foliage registries, primitives, and blockers. This is useful for marsh/causeway prototyping later, but it is not a water-node or sluice simulation.
- `src/game/MobileControls.js`, `Hud.js`, CSS, and host layers support portrait touch movement/look, interact/attack affordances, stats, hunger, prompts, timed-action progress, pause/reset, and safe-area-aware presentation.
- `src/game/ModelLoader.js` provides cached GLTF loading, SkeletonUtils cloning, normalization, grounding offsets, and material preparation. It is a useful model foundation, not an asset registry or streaming/LOD policy.
- Torch fixture/light runtimes and the player offhand torch light exist. The Keeper's Lantern reveal behavior does not.

### Runtime systems that do not currently exist

- `Game.js` explicitly consumes and discards queued attack input because the current Player + Fish build has no attack runtime.
- There is no damageable-target interface, hit raycast, weapon swing state machine, hit impact router, destructible growth state, staged mesh/material swapping, or linked reveal target.
- There are no current creature, faction, enemy AI, combat, gore, corpse, or animation-runtime source folders. Authored `spawns` and `encounterZones` compile metadata but do not create guide enemies.
- There is no NPC dialogue runtime. Folsom's current authored interactions are static messages.
- There is no map screen, Records menu, Memory interface, Pale Gate Network layer, or ending-state UI/runtime.

### Current guide overlap

Folsom already supplies the correct physical setting and adjacent survival loop: tool shed, axe chest, torch chest, pond/Rod A1, campfire/cooking, shrine, north-road hook, and rusty gate/return route. However, guide Chapter 1 is not implemented as written: the player starts in the courtyard rather than outside the west gate; there is no gate guard; the common fire is already present rather than growth-choked; the axe is obtained from a chest rather than a growth-revealed shed; there is no Old Work Knife; and there is no growth, latch, reveal, map update, or persistent town transformation.

## 3. Existing Assets That Can Be Reused

Reuse below means "appropriate as supporting or placeholder art." It does not mean the asset already fulfills the guide requirement.

| Existing asset path | Current use | Guide use | Confidence | Notes |
| --- | --- | --- | --- | --- |
| `public/assets/textures/pack1/grass_black_invasive_01.png` | Balthazan/pack material | Temporary color/material reference for black-growth contamination | Medium | Flat invasive-grass surface; not a physical scab, cord, knot, shell, or damage-stage asset. |
| `public/assets/textures/pack1/floor_black_grass_stone_01.png` | Dark contaminated floor | Background surface beneath growth in crypt/church tests | Medium | Supports mood only; must not substitute for removable growth geometry. |
| `public/assets/textures/wall_black_stone_01.png` | Common dark wall material | Human crypt, shell-wall placeholder, black architecture blockout | High | Good structural placeholder; lacks tissue/shell detail and breach-state variants. |
| `public/assets/textures/pack1/wall_ritual_stone_01.png` | Ritual interiors | Shrine, crypt, church, procession route foundations | High | Useful human/church substrate underneath removable growth. |
| `public/assets/textures/pack1/altar_stone_dark_01.png` | Altar surfaces | Root altar, chapel altar, shrine reveal substrate | High | Reusable substrate, not an altar mechanism kit. |
| `public/assets/textures/pack1/metal_gate_rusted_01.png` | Rusted metal material | Fort gates, gate bars, revealed latch/hinge substrate | High | A good revealed-target metal surface; no dedicated latch/bar models exist. |
| `public/assets/textures/pack1/metal_chest_band_iron_01.png` | Chest banding | Revealed chest hardware under growth | High | Existing procedural chest builder can use it; covered/damaged variants are missing. |
| `public/assets/textures/pack1/metal_blackened_iron_01.png` | Dark metal | Fort Blade, shield, halberd, church hardware material placeholder | Medium | Surface reference only; weapon meshes and FPV/world variants remain missing. |
| `public/assets/textures/pack1/metal_bronze_ritual_01.png` | Kerovac/Sumerian ritual trim | Church bells, route plates, altar mechanisms | Medium | Color/material placeholder; dedicated bell/plate geometry and state art are missing. |
| `public/assets/textures/pack1/panel_celestial_map_01.png` | Authored warning/decorative panel | Temporary map/route panel or white-machine screen content | Medium | Visual language is Sumerian/celestial, not design-locked white-system art. |
| `public/assets/textures/pack1/panel_extradimensional_threat_01.png` | Authored warning panel | Temporary First White Door/royal warning dressing | Low | Could confuse the guide's restrained white-system language; blockout only. |
| `public/assets/textures/pack2/panel_ritual_glyph_column_01.png` | Kerovac Expo trim | Church route plate or procession marker blockout | Medium | Useful composition reference, not a restored/unrestored state set. |
| `public/assets/textures/pack2/column_limestone_carved_01.png` | DARB Expo architecture | Pale door, node chamber, chapel/white ruin support material | Medium | Warm carved limestone is not the final pale machine surface. |
| `public/assets/textures/pack2/column_turquoise_inlay_01.png` | DARB Expo column trim | White-system active-line color/material placeholder | Medium | Can prototype emissive routing; needs a canonical pale-line palette and inactive/active states. |
| `public/assets/models/weapons/weapon_broadsword_ritual_01.glb` | Currently unreferenced by source | Fort Blade prototype/world weapon reference | Medium | Only GLB in the repo; audit topology, scale, animation/viewmodel framing, and mobile cost before reuse. |
| `public/assets/sprites/fire/campfire_flame_billboard_01.png` through `_06.png` | Animated Folsom campfire | Common Fire restoration, torch/burning-growth effect base | High | Existing six-frame alpha sequence is useful, though torch and growth ignition need separate scaled effects. |
| `public/assets/textures/water/pond/pond_water_anim_01.png` through `_06.png` | Animated pond/OARB water | Drowned Shrine and water-node surface prototype | High | Suitable surface foundation; no underwater cords, sluice foam, flood shell, or node effects. |
| `public/assets/textures/outdoor/mud_wet_dark_01.png` and `mud_churned_wet_03.png` | OARB pond/mud surfaces | Marsh route, Sluice House, Drowned Shrine ground | High | Directly reusable supporting terrain. |
| `public/assets/sprites/foliage/billboard_bush_dark_bramble_01.png` | Outdoor foliage | Dead-road/church/contamination set dressing | Medium | Must not stand in for reactive growth; billboard has no damage/reveal state. |
| `public/assets/sprites/foliage/folsom_dark_grove_tree_05_mossy_roots.png` | Folsom tree billboard | Root-heavy Folsom mood and anchor sightline framing | Medium | Background art only; roots are baked into the tree sprite and cannot be targeted. |
| `public/assets/sprites/foliage/folsom_dark_grove_tree_06_twisted_deadwood.png` | Folsom tree billboard | Dead Hero Road/black-growth silhouette support | Medium | Appropriate distant dressing; no collision or independent roots. |
| `public/assets/textures/sky/night_skybox_folsom_01.png` | Available Folsom sky panorama | Chapter 1 first-night road and ominous Folsom lighting | High | Current Folsom definition uses the sunny-noon panorama; switching state needs runtime work. |
| `public/assets/textures/sky/red_morning_skybox_folsom_retro_02.png` | Available Folsom sky panorama | Ending/Quiet Folsom Return epilogue palette option | Medium | A possible mood variant, not an ending asset by itself. |
| `public/assets/textures/wall/wooden/city_border_wooden_wall_01.png` through `_06.png` | Folsom palisade kit | West/north gate, growth-covered fence posts, village perimeter | High | Strong Chapter 1 substrate. Growth must be separate geometry/decal layers. |
| `public/assets/textures/fish/*` and procedural fish meshes | Fishing species/pickups | Preserve starter survival loop; possible marsh ecology | High | Not directly a guide progression asset; should remain untouched by growth-v1 work. |

Existing procedural builders are also reusable even though they are code rather than art: the Folsom chest group, torch fixture, campfire group, gates, altars/stelae/wall panels, architectural primitives, water/pond builders, and foliage billboards can block out many targets. Final guide objects still need authored silhouettes and state variants.

## 4. Missing Asset Families

Priority meanings: **Blocker** means the phase's core loop cannot read correctly without it; **Important** means a placeholder could prove behavior but production quality needs it; **Optional** means defer until the loop is validated. Suggested texture sizes are source targets; ship compressed/mobile variants after visual validation.

### Phase 1: Required for physical black growth v1 in Folsom

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Soft black scab: clean/intact, nicked, frayed, broken-edge variants | `public/assets/textures/growth/` | Tiling RGBA PNG, 512x512 each; optional packed roughness/normal at 512 | `grass_black_invasive_01.png` only as palette reference | **Blocker** |
| Thin surface cords in straight, curved, forked, and wrapped forms | `public/assets/models/growth/` and `textures/growth/` | Low-poly GLB set with shared 512 texture; alternatively 512x512 alpha strips for the first prototype | No reactive equivalent | **Blocker** |
| Hard root knots: small latch knot and medium anchor knot | `public/assets/models/growth/` | GLB, 0.15-0.6 m variants, shared 512 material | Dark rocks can block out scale only | **Blocker** |
| Damage stages for cords/scab/knot | Same family folders | Mesh variants or one GLB with named stage nodes; RGBA damage overlays 512 | None | **Blocker** |
| Growth-covered latch, chest-band cover, and pale-panel cover fit pieces | `public/assets/models/growth/reveal_targets/` | Low-poly GLB pieces with pivots/origins documented | Existing latch/chest/panel substrate materials only | **Blocker** |
| Hit chips, black flecks, smear/decal, and break puff | `public/assets/sprites/effects/growth/` | Transparent PNGs, 256x256 or 512x512; 4-8 frame sheet only if needed | Campfire sprites are not suitable | **Important** |
| Knife/axe impact and growth break audio | `public/assets/audio/sfx/growth/` | Mono OGG preferred, 44.1/48 kHz, short tails | No audio assets shipped | **Important** |

### Phase 2: Early tools and weapons

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Old Work Knife FPV/world/icon set | `models/tools/`, `models/items/`, `ui/items/` | GLB FPV + lower-cost world GLB; 256x256 transparent icon | None | **Blocker** for knife identity |
| Wood Axe FPV/world/icon set | Same | GLB + 256 icon; animation-ready pivot and grip marker | Current axe is procedural/metadata only | **Blocker** for hit-quality phase |
| Torch FPV/world/icon and flame socket | Same | GLB + 256 icon; named flame/light anchor | Procedural torch geometry and light can prototype | **Important** |
| Keeper's Lantern closed/lit/reveal states | `models/tools/keepers_lantern/` | GLB with named lens/light anchors; 512 material; 256 icon | Torch lighting only | **Blocker** for reveal phase |
| Iron Drain Bar FPV/world/icon | `models/tools/iron_drain_bar/` | GLB + 256 icon | Blackened/rusted metal texture reference | **Important** |
| Fort Blade FPV/world/icon | `models/weapons/fort_blade/` | GLB + 512 material + 256 icon | Ritual broadsword GLB may prototype after audit | **Important** |
| Old Soldier Shield, Guard Halberd, Road Crossbow | `models/weapons/<name>/` | FPV/world GLBs; 512-1024 shared materials; 256 icons | Metal/wood textures only | **Optional** until melee loop works; shield becomes important for Chapter 4 |
| Swing/impact/equip audio families | `audio/sfx/tools/`, `audio/sfx/weapons/` | Mono OGG, 3-5 restrained variants per action | None | **Important** |

### Phase 3: Records, map, route-state, and Memory UI

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Records menu frame, category marks, unread/read markers | `public/assets/ui/records/` | SVG or transparent PNG; icons at 128/256; nine-slice frame source 512 | Current HUD is CSS/DOM and can provide first prototype | **Important** |
| Local-map parchment/stone style, route markers, locked/open/restored symbols | `public/assets/ui/map/` | SVG preferred; PNG map backplates sized for portrait 1024x2048 source | Celestial panel can inspire, not ship as map UI | **Blocker** once map foundation begins |
| Pale Gate Network nodes, echoes, damaged links, stable links | `public/assets/ui/network/` | SVG icons/lines preferred for resolution independence | Turquoise inlay is a palette reference | **Important** later |
| Memory Shard frame, recovered/unrecovered glyph, playback/inspection state | `public/assets/ui/memory/` | SVG/PNG, 256 icons and portrait layout elements | None | **Important**, but full shard illustration set is deferred |
| World map boards, route stones, record pages/tablets | `models/props/records/` and `textures/records/` | Low-poly GLB props, 512 page/panel atlases | Existing stela/wall-panel primitives can block out | **Important** |

### Phase 4: Early enemies and body-growth

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Threaded Corpse body plus exposed/cut/reconnected cord states | `public/assets/enemies/threaded_corpse/` | Mobile-budget GLB; idle/walk/hit/death clips only as required; shared 1024 atlas max | No enemy assets exist | **Blocker** for body-growth prototype |
| Black-Root Crawler | `public/assets/enemies/black_root_crawler/` | GLB with idle/lunge/hit/death or cheap mesh-state animation | No creature equivalent | **Important** |
| Faceless Soldier and military variants | `public/assets/enemies/faceless_soldier/` | Shared skeleton/material GLBs; modular weapon attachment points | Fort materials only | **Important** |
| Root-Taken Knight | `public/assets/enemies/root_taken_knight/` | Boss GLB, body/root hit zones and altar-cord anchors | No creature equivalent | **Blocker** for Chapter 4 boss, not for v1 |
| Captain Without a Face, Headless Champion | `public/assets/enemies/<boss>/` | Boss GLBs sharing humanoid rig where practical | Broadsword can become held prop only | **Important** later |
| Corpse-thread cords, armor-root sockets, throat/back-cord weak points | `models/growth/body/` | Shared low-poly GLB attachments and 512 atlas | Phase 1 cords may be adapted | **Blocker** for the mechanic |
| Blood/black-fluid impacts, corpse marks, death sounds | `sprites/effects/combat/`, `audio/sfx/enemies/` | 256/512 alpha sprites; mono OGG | No gore/effects/audio directories | **Important**; keep pooled/mobile-safe |

The guide later names Chapel Crawler, Black-Robed Penitent, Choir Husk, Prayer Husk, White-Shell Crawler, Reed Husk, Marsh Crawler, Wagon Husk, Royal Survey Husk, March Husk, Standing Armor, Bastion Husk, Black-Robed Shell Priest, Shell Husk Champion, Tissue Crawler, Nerve Husk, and Name Husk. They should be derived from proven shared rigs/material families, not requested as unrelated one-off models.

### Phase 5: White machinery

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Pale panel clean/scabbed/damaged/active states | `textures/white_system/` and `models/white_system/panels/` | 512 tiling/trim textures plus low-poly GLB panel modules | Existing panel textures are visual placeholders | **Blocker** |
| Node rings, calibration sockets, route-line trim, marker posts | `models/white_system/` | Modular GLB kit; shared 512-1024 atlas; emissive mask | DARB ring/column primitives can block out | **Blocker** |
| White scab panel covers and black node shell | `models/growth/white_system/` | GLB stage sets sharing Phase 1 material | Phase 1 scab can be adapted | **Blocker** |
| Pale Calibration Rod, White Interface I/II visual states | `models/tools/white_system/`, `ui/white_system/` | GLB tool + 256 icons/overlays | None | **Important** |
| Levitating slab, gravity-walk, memory basin, node-core kit | `models/white_system/ruin/` | Modular GLBs and 512-1024 shared materials | Pale stone and turquoise trim are placeholders | **Important** |
| Calibration/activation/node audio | `audio/sfx/white_system/` | Mono/stereo OGG loops and one-shots, short/mobile-conscious | None | **Important** |

### Phase 6: Church and procession systems

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Old Procession Bell and Chapel Clapper upgrade states | `models/tools/procession_bell/` | FPV/world GLB, named clapper/strike nodes, 512 material, 256 icon | Bronze texture can support material | **Blocker** for church-route identity |
| Route plates: Fountain, Market, Bell Road, Grave, Understreet | `models/church/route_plates/` | Modular GLBs with black-covered/clean/active states; 512 atlas | Panel/stela primitives can prototype | **Blocker** |
| Bell House bell, cracked chapel bell, gallery hardware | `models/church/bells/` | Static/animated GLBs sharing metal material | No bell geometry | **Important** |
| Split Altar, Black Altar Engine, lens socket, reliquary cage | `models/church/altar_system/` | Modular GLBs and stage nodes | Existing altar/gate primitives are blockouts | **Important** |
| Archive shelves/index wheel/lever, record props | `models/church/archive/` | Modular low-poly GLBs; 512 trim/page atlas | Procedural boxes can block out | **Important** |
| Chapel Custodian and Procession Warden | `enemies/chapel_custodian/`, `enemies/procession_warden/` | Boss GLBs with bell/route connection anchors | No enemy assets | **Important** later |
| Bell tones and counter-command response set | `audio/sfx/church/` | OGG, tuned variants with controlled reverb tails | None | **Blocker** for readable bell behavior |

### Phase 7: Water-node systems

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Black reed growth, reed cords, mud knots, flooded scab | `models/growth/water/`, `textures/growth/water/` | Low-poly GLBs/alpha cards; 512 atlas and stage variants | Existing bramble and mud only support background | **Blocker** |
| Sluice gate, handle, ring, causeway post and raised/sunken slabs | `models/water_node/sluice/` | Modular GLB kit, moving pivots named; 512 material | Water/stone primitives can block out | **Blocker** |
| Drowned Shrine node, water-linked lens/socket, black flood shell | `models/water_node/` | GLBs with dry/wet, scabbed/clean, inactive/active states | Pond animation supplies surface only | **Blocker** |
| Water-Linked Lens and Sluice Handle pickups | `models/items/water_node/` | World GLBs + 256 icons | None | **Important** |
| Reed Husk, Drowned Sentinel, optional Marsh Crawler | `enemies/<name>/` | Mobile-budget GLBs; wet/root material family | No enemy assets | **Important** later |
| Sluice flow, submerged pulse, reed break, flood-shell audio/VFX | `audio/sfx/water_node/`, `sprites/effects/water_node/` | OGG + 256/512 alpha sheets | Pond frames can support water surface only | **Important** |

### Phase 8: Pale Gate Network

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Echo point, gate-frame, hub-ring, transit-line modules | `models/pale_gate/` | Modular GLBs, 512-1024 shared atlas and emissive masks | White-system kit should be extended | **Blocker** for network world layer |
| Broken/stable route lines and gate states | `textures/pale_gate/` | 512 trims/decals and SVG UI equivalents | Turquoise inlay is a temporary palette | **Blocker** |
| Gate Stabilizer FPV/world/icon | `models/tools/gate_stabilizer/` | GLB + 256 icon; named install/beam origin | None | **Blocker** |
| Folsom Shrine Echo and Church Understreet Echo variants | `models/pale_gate/echoes/` | Shared base GLB with authored local dressing | Existing shrine/route substrates only | **Important** |
| Gate Parasite | `enemies/gate_parasite/` | GLB with line-attachment anchors and reconnect states | Node growth family may be reused | **Important** |
| Network UI node/link/lock/error states | `ui/network/` | SVG preferred | Phase 3 UI foundation | **Blocker** for readable network layer |

### Phase 9: Royal contamination

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Lead plates, sealed wagon panels, sample crates/containers | `models/royal_contamination/props/` | Modular GLBs with 512 shared metal/wood atlas | Current wood/rusted metal textures can support blockout | **Blocker** for chapter identity |
| Burned, pressure, and blood sample stations | `models/royal_contamination/stations/` | GLBs with intact/contaminated/cleared states | Existing altar/table primitives only | **Blocker** |
| Black Sample Shard container, loose shard, secured/kept states | `models/items/black_sample_shard/` | GLB(s), 512 material/emissive mask, 256 UI icon | None | **Blocker** for ending-risk object |
| White Gate Fragment and wreck repair states | `models/white_system/gate_wreck/` | Modular GLB stages | White-system kit can be extended | **Important** |
| Royal markers, command seal, lead-sealed keys, ledger pages | `models/royal_contamination/records/` and `ui/records/` | GLBs + 512 page atlas + 256 icons where carried | Existing panel textures are placeholders | **Important** |
| Last Road Commander and royal husk family | `enemies/royal_*` | Shared humanoid rig/material; boss variant | Early humanoid family should be reused | **Important** |

### Phase 10: Black Cathedral, living architecture, and finale

| Required assets | Suggested folder | Format / dimensions | Existing reuse | Need |
| --- | --- | --- | --- | --- |
| Black cathedral shell walls, gates, towers, ribs, shell trims | `models/living_architecture/shell/`, `textures/living_architecture/` | Modular GLB kit; 1024 shared atlases, trim sheets, emissive masks | Black stone can only block out silhouette | **Blocker** for late-game space |
| White breach lines, trapped white sockets, White Breach Lens | `models/white_system/breach/`, `models/tools/white_breach_lens/` | GLBs + 512 masks + 256 icon | White-system kit provides base language | **Blocker** |
| Tissue walls, breathing hall surfaces, bone-growth, organs | `models/living_architecture/tissue/` | Modular deforming/static GLBs; 1024 atlas; very limited animation | No equivalent | **Blocker** |
| White nerves, Nerve Bridge, memory well, Organ Gate | `models/living_architecture/white_nerves/` | GLBs with inactive/damaged/stable states | Route-line kit may be extended | **Blocker** |
| Root-Wound Lens and root-connection reveal overlays | `models/tools/root_wound_lens/`, `sprites/effects/reveal/` | GLB + 256 icon + 512 alpha/emissive overlays | Lantern reveal foundation may be extended | **Blocker** |
| Final seal ring, black obelisk door, lock array, gate-wound arteries, four core posts, Open Anchor | `models/finale/` | Modular GLBs with explicit state nodes and 1024 shared atlases | Node/gate kits can provide technical base | **Blocker** for finale |
| Harvested Champion, Harvested Choir, Dreadstone Avatar, Name Husk | `enemies/<name>/` | Boss/chamber GLBs and carefully budgeted animations/audio | Earlier rigs/patterns should be recombined | **Blocker** only when finale production starts |
| Memory Shard VII-IX presentation, final record, ending/epilogue panels | `ui/memory/`, `ui/endings/` | SVG/PNG portrait UI; optional stills 1024x2048 | Folsom skies may support epilogue backdrop | **Important** |
| Living ambience, organ/breath/nerve sounds, final-core layers | `audio/ambience/living_architecture/`, `audio/sfx/finale/` | Streamed OGG loops and mono one-shots with strict memory budget | No audio library exists | **Important** |

## 5. Runtime Gaps Blocking Guide Implementation

| Runtime gap | Current related files | Needed behavior | Priority | Recommended first PR |
| --- | --- | --- | --- | --- |
| Player tool/weapon strike runtime | `MobileControls.js`, `InputHost.js`, `FirstPersonViewmodelHost.js`, `weaponProfiles.js`; `Game.js` currently discards attack | Mobile/keyboard attack intent, windup/recovery/cooldown, camera/FPV motion, ray/sweep query, hit result, no fishing regression | P0 | **Tool strike foundation** behind an authored Folsom test target; preserve Rod A1 touch casting |
| Damageable growth cover | No current damageable-object runtime; `DungeonScene.js` builds props/interactions | Stable authored id, HP/material response, permitted tools/damage types, stage thresholds, hit effects, destroy/clear event, pooling/disposal | P0 | **Destructible Growth Runtime v1** with scab/cord/knot adapters |
| Growth damage stages | Material/texture loaders exist in `DungeonScene.js` | Deterministic intact -> nicked -> frayed/cracked -> broken visuals without per-hit asset creation; reload restores stage | P0 | Same growth-runtime PR, limited to three target classes |
| Linked reveal target system | `Interactions.js`, location definitions, objective actions `unlockInteraction`/`unlockGate` | Hide/disable a real latch/chest/panel while cover remains; reveal/enable it when linked covers clear; prevent invisible blocker mismatch | P0 | **Growth Reveal Link v1** using definition ids and objective facts |
| Persistent world/route state | `ObjectiveRuntime`, `ObjectiveState`, `ObjectivePersistence`, `GameState` | Namespaced, versioned flags and authored state reducers for latch/fire/anchor/gate/node states; state applies before first frame | P0 | **World State Facts v1** rather than putting route tokens in inventory |
| Growth authoring schema and validation | Location definitions, `DungeonDefinitionTypes.js`, `DungeonValidation.js`, compiler/builders | `growthCovers`, target ids, stages, tools, reveal links, collision policy, asset references; validator catches orphan/duplicate links | P0 | Add schema as part of growth-v1 implementation, with Folsom-only authored data |
| Reveal-state visual/collision synchronization | `DungeonCollisionBuilder.js`, `CollisionWorld`, scene builders | Change target interaction and blocker state atomically; never leave invisible collision after clearing | P0 | Include in Growth Reveal Link v1 |
| Axe/knife hit quality | Axe metadata exists; no knife, attacks, or impact feedback | FPV/world presentation, readable reach, material-specific feedback, restrained shake, hit-stop/audio, mobile responsiveness | P1 | **Axe + Old Work Knife quality pass** after functional growth damage |
| Keeper's Lantern reveal | Offhand torch/light exists in `FirstPersonViewmodelHost.js`; lighting registries exist | Equipable lantern, cone/range query, hidden-cord reveal materials, readable pulse, persistence rules, mobile draw-call budget | P1 | **Lantern Reveal v1** on existing Folsom anchors only |
| Anchor graph / connected growth | Objective facts can hold flags; no dependency graph | Multiple covers/anchors feed a blocker; feedback identifies remaining connections; clear event opens hatch/route | P1 | **Folsom Three-Anchor Blocker** after reveal state and lantern |
| Records/map/route-state foundation | Objective panel and CSS HUD only | Separate typed domains: Records entries, map discovery, route/world states; save migrations; portrait UI; no inventory duplication | P1 | **Progression Codex v1** with one Folsom record, map update, and route state |
| Records and Memory interfaces | `EquipmentPanel.js`, `ObjectivePanel.js` are possible UI patterns | Records categories/reading, Memory Shard gallery/playback, recovered/unrecovered state, accessibility and portrait layout | P2 | Records first; defer full Memory UI until White Door content |
| Body-growth enemy cord mechanic | No creature/combat runtime in current source | Creature health/AI plus separate cord weak point, sever/reconnect/revive rules, target prioritization, grounding and cleanup | P2 | **Threaded Corpse vertical slice** only after simple humanoid actor + combat exists |
| Creature actor/model/animation runtime | `ModelLoader.js`, compiled spawn metadata | Cached mobile GLB loading, skeleton cloning, active-only mixers, grounding, scale vs collision, lifecycle, visibility and disposal | P2 | Re-establish a minimal **Creature Actor v1** from current source reality; do not assume stale docs' files exist |
| Enemy combat/AI/factions | Weapon metadata and dormant objective species facts only | Targeting, navigation/local avoidance, attack telegraph/range, damage, death, respawn, encounter budgets and player fallback | P2 | **Simple Humanoid Enemy v1** before any boss |
| Combat effects/corpses | `Feedback.js` only; no gore runtime | Pooled impacts/decals, strict caps, corpse cleanup, optional persistent evidence, mobile diagnostics | P2 | Add only effects required by Threaded Corpse; avoid a broad gore system first |
| White scab/panel activation | DARB wall panels/stelae and objective gates can block out | Clear scab, expose socket/line, interact/calibrate, activate panel, persist state, emit route action | P2 | **One White Panel Prototype** after Records/route foundation |
| White node restoration | No node runtime | Socket dependencies, calibration, parasite interruption, active/inactive state, installed components, map/network output | P3 | **White Ruin Node v1** from reusable node components |
| Church bell/procession route | No sound-driven tool or route plate runtime | Bell use action, response radius/targeting, upgraded tool state, ordered/unordered plate restoration, audio feedback | P3 | **Bell + Single Route Plate** prototype before town-wide route |
| Water-node/sluice runtime | Pond and terrain sampling exist | Movable sluice parts, water/causeway state, water-root dependencies, safe collision updates, node install state | P3 | **Sluice Ring v1** using existing pond visuals |
| Pale Gate Network layer | Location registry/routing and objectives exist | Persistent graph of known/unknown/restored/unstable nodes, world echoes, safe destinations, transition validation, network UI | P4 | Data model and debug view first; no fast-travel menu until two restored nodes exist |
| Dangerous Black Sample state | Inventory and objective flags exist | Major-object custody/installation/destruction state distinct from ordinary inventory; ending-risk history and UI warning | P4 | **Special Object State v1** in royal contamination phase |
| Living architecture runtime | Static builders/animated texture flipbooks exist | Bounded pulsing/deforming surfaces, organs/root dependencies, false/revealed surfaces, audio zones, aggressive mobile budgets | P5 | One breathing-wall test room only after white/growth systems are stable |
| Ending-state evaluation | Objective facts and flags exist | Deterministic evaluation of containment, network, memories, sample handling, releases, anchor choice; epilogue variant selection and migration-safe save | P5 | Pure-data evaluator with tests before finale content; UI/scene comes later |

The objective runtime is the best near-term persistence seam, but route/network state should gain explicit typed APIs rather than becoming an unstructured pile of objective flags. Inventory must remain limited to equipable, usable, installable, consumable, or dangerous carried objects as locked by the guide.

## 6. Asset Naming and Folder Convention

Use lowercase snake_case, semantic families, explicit state suffixes, and two-digit variant numbers. Keep final public paths beneath `public/assets/` so Vite/GitHub Pages handling remains consistent. Runtime URLs should remain Vite-base-aware rather than hard-coding root URLs.

Recommended pattern:

```text
public/assets/<type>/<family>/<asset>_<role-or-state>_<variant>.<ext>
```

State vocabulary should be small and consistent:

```text
intact, damaged_01, damaged_02, broken
covered, revealed
inactive, active, unstable, restored
world, fpv, pickup
idle, walk, attack, hit, death
```

Concrete examples:

```text
public/assets/textures/growth/black_growth_scab_intact_01.png
public/assets/textures/growth/black_growth_scab_damaged_01.png
public/assets/textures/growth/black_growth_cord_01.png
public/assets/models/growth/root_knot_small_01.glb
public/assets/models/growth/reveal_targets/tool_shed_latch_cover_01.glb
public/assets/models/tools/wood_axe/wood_axe_fpv.glb
public/assets/models/tools/wood_axe/wood_axe_world.glb
public/assets/models/tools/old_work_knife/old_work_knife_fpv.glb
public/assets/models/tools/keepers_lantern/keepers_lantern_lit.glb
public/assets/textures/white_system/pale_panel_scabbed_01.png
public/assets/models/white_system/node_ring/node_ring_inactive_01.glb
public/assets/ui/records/records_category_local.svg
public/assets/ui/network/network_node_restored.svg
public/assets/audio/sfx/growth/growth_cord_break_01.ogg
```

Conventions:

- Put weapon/tool models under `models/tools/<tool>/` or `models/weapons/<weapon>/`; do not use the currently empty top-level `public/assets/weapons/` for new content.
- Use separate `_fpv`, `_world`, and `_pickup` meshes only when budgets/framing differ. Otherwise use one GLB with documented named nodes and a lower-cost runtime clone.
- Use one shared material atlas per related kit where practical. A growth family should not introduce a unique 1024 texture for every knot.
- Use RGBA PNG for sprites/decals that require alpha. Preserve transparent borders and preflight for white matte fringes.
- Use SVG for crisp UI symbols and network lines when the existing DOM/CSS renderer can consume them; use PNG for painterly frames or shard imagery.
- Prefer OGG for shipped web audio and short mono files for positional SFX. Keep music/ambience stereo only where spatialization is unnecessary.
- Give GLB nodes semantic names such as `hit_zone_soft`, `hit_zone_hard`, `reveal_target`, `fx_origin`, `grip_r`, `light_origin`, and `stage_damaged_01`; document meter scale and forward axis.
- Never encode gameplay ids only in filenames. Stable authored ids belong in location definitions and saves; assets remain swappable presentation.
- Add asset registries/manifests only when runtime use begins. This report does not create folders, assets, or registries.

## 7. First Asset Request Package

Milestone: **Physical destructible black growth v1 in Folsom**.

Scope the pack to one tool-shed latch lesson plus reusable chest and pale-panel reveal tests. The pack must prove soft cord, surface scab, hard knot, staged damage, break feedback, and a clean underlying target. It does not include enemies, roots covering whole buildings, white-node machinery, bosses, Records UI, or late-game growth.

### Required 2D assets

| Filename | Folder path | Purpose | Dimensions / format | Alpha / tiling | Creation notes |
| --- | --- | --- | --- | --- | --- |
| `black_growth_scab_intact_01.png` | `public/assets/textures/growth/` | Base soft film/scab on wood, stone, and metal | 512x512 RGBA PNG | Seamless tile; alpha edge variant should feather minimally | AI image generation: orthographic material study, oily charcoal-black biological crust, restrained fibrous grain, no object/background/light source. Derive a seamless material and manually clean seams. |
| `black_growth_scab_intact_02.png` | Same | Break visible repetition | 512x512 RGBA PNG | Seamless tile | Same material family; denser ridges, not a different species or color. |
| `black_growth_scab_damaged_01.png` | Same | Nicks/scrapes after first hits | 512x512 RGBA PNG | Seamless or overlay-safe alpha | Derive from intact source so landmarks line up; expose narrow transparent scratches. |
| `black_growth_scab_damaged_02.png` | Same | Frayed/cracked near-clear stage | 512x512 RGBA PNG | Overlay-safe alpha, larger transparent gaps | Preserve remaining edge mass so state change reads in portrait view. |
| `black_growth_cord_surface_01.png` | Same | Thin cord alpha strip for cheap curved/flat applications | 512x128 RGBA PNG | Transparent background; horizontally tileable; 16 px safe padding | Dark wet cord with subtle ridges; no glow, no cast shadow baked in. |
| `black_growth_cord_surface_damaged_01.png` | Same | Frayed cord state | 512x128 RGBA PNG | Same UV layout as intact | Ends should split and lighten slightly at exposed fibers, without bright gore. |
| `black_growth_hit_decal_01.png` | `public/assets/sprites/effects/growth/` | Brief black smear/chip impact | 256x256 RGBA PNG | Transparent; no white fringe | Radial but directional scrape, readable at small screen size. |
| `black_growth_hit_flecks_01.png` | Same | Pooled impact particle cards | 256x256 RGBA PNG atlas, 4x4 cells | Fully transparent cell gutters | Irregular black flakes, no smoke background, consistent lighting-neutral values. |
| `black_growth_break_puff_01.png` | Same | Final clear effect | 512x512 RGBA PNG or 4x2 sheet | Transparent, soft alpha; no premultiplied white matte | Dry black fiber/dust puff, short-lived and restrained. Avoid opaque fog that hides the reveal target. |

Optional packed material maps after the base color is approved:

```text
black_growth_scab_normal_01.png       512x512, tileable
black_growth_scab_roughness_01.png    512x512, tileable grayscale
black_growth_scab_orm_01.png          512x512, packed only if runtime adopts a documented channel contract
```

### Required 3D assets

| Filename | Folder path | Purpose | Format / budget | Alpha / tiling | Blender creation notes |
| --- | --- | --- | --- | --- | --- |
| `black_growth_cord_set_01.glb` | `public/assets/models/growth/` | Straight, curved, forked, and latch-wrap cords | GLB; four named pieces; target under 1.5k triangles total; shared 512 material | No alpha required if geometry has thickness | Meter scale; origins at attachment start; consistent forward axis; UVs share cord texture; include `intact`, `damaged_01`, and `broken_ends` named nodes or sibling meshes. |
| `root_knot_small_01.glb` | Same | Hard knot on tool-shed latch/hinge | GLB; target under 1.2k triangles; shared growth material | Opaque | Approx. 0.18-0.28 m; readable silhouette; origin against mounting surface; named hard hit zone; no baked substrate. |
| `root_knot_small_damaged_01.glb` | Same | Cracked hard-knot stage | GLB using same scale/pivot/material | Opaque | Large readable notch; should swap without position jump. |
| `root_knot_small_broken_01.glb` | Same | Optional brief fragments before removal | GLB; 3-5 simple fragment meshes | Opaque | Named fragments for pooled burst; no runtime rigid-body requirement. |
| `tool_shed_latch_cover_01.glb` | `public/assets/models/growth/reveal_targets/` | Growth fitted around the existing Folsom shed latch lesson | GLB; target under 2k triangles; shared growth material | Mixed scab alpha only if necessary | Must not contain the latch itself. Supply a simple fit proxy/dimensions and expose separate cord, film, and knot nodes for damage classes. |
| `chest_band_cover_01.glb` | Same | Reusable chest strap/lid growth cover test | GLB; target under 1.5k triangles | Same shared material | Fit current procedural chest proportions or include exact bounding dimensions; cover must not require replacing the chest. |
| `pale_panel_cover_01.glb` | Same | Forward-compatible white-panel reveal test | GLB; target under 1.5k triangles | Same shared material | A flat modular cover around a 1.0 x 1.4 m test panel; no white-system art baked into growth. |

The revealed objects themselves should initially reuse procedural geometry and current materials: rusted metal for latch/chest hardware and a simple pale DARB wall panel for the panel target. Request dedicated latch/panel art only after the reveal behavior reads correctly.

### Optional audio list

| Filename | Folder | Purpose | Format | Notes |
| --- | --- | --- | --- | --- |
| `growth_soft_hit_01.ogg` to `_03.ogg` | `public/assets/audio/sfx/growth/` | Knife/axe on soft scab | Mono OGG, 48 kHz, <0.6 s | Wet-fibrous scrape, little low-end, no cinematic boom. |
| `growth_cord_cut_01.ogg` to `_03.ogg` | Same | Cord damage/break | Mono OGG, <0.8 s | Taut fiber snap plus dry residue; variants prevent repetition. |
| `growth_knot_hit_01.ogg` to `_03.ogg` | Same | Axe on hard knot | Mono OGG, <0.7 s | Dense woody/mineral impact, distinct from ordinary tree chopping. |
| `growth_cover_break_01.ogg` to `_02.ogg` | Same | Final removal/reveal | Mono OGG, <1.2 s | End quickly enough that latch interaction remains clear. |

### Acceptance criteria for the asset delivery

- Assets read at iPhone portrait scale and under Folsom daylight, night, and torch lighting.
- The growth is black but retains silhouette/roughness detail; it does not collapse into featureless RGB zero.
- Damage stages share pivots/UV intent and do not pop spatially.
- Scab/cord assets remain separate from latch/chest/panel substrates.
- Transparent files retain clean alpha without white borders.
- GLBs use meter scale, documented axes, named nodes, shared materials, and mobile-conscious triangle/material counts.
- The delivery includes one contact sheet or Blender turntable for review, but no extra unrequested full-game concepts.

## 8. Recommended PR Roadmap

1. **Asset request pack for black growth v1.** Acquire and review only the Phase 1 package above against Folsom lighting and mobile framing.
2. **Implement destructible growth cover.** Add an authored growth schema, validation, staged damage runtime, save restoration, and one Folsom latch target. Keep it location-gated.
3. **Axe/knife hit quality.** Add Old Work Knife and improve Wood Axe strike timing, reach, view feedback, impact material routing, and touch behavior without affecting Rod A1 casting.
4. **Reveal state system.** Link multiple covers to latch/chest/panel interactions and collision; persist `Tool Shed Latch Revealed` as world state rather than inventory.
5. **Records/map/route-state foundation.** Create typed, versioned progression domains and a minimal portrait UI: one Folsom map update, one Record, and one route state.
6. **Keeper's Lantern reveal.** Add a dedicated lantern tool/reveal query and use it on a small Folsom cord/anchor set.
7. **Threaded Corpse prototype.** Rebuild only the minimum creature/combat actor foundation needed for one body-growth enemy and its severable cord.
8. **White scab/panel prototype.** Reuse growth stages on one pale panel, then expose/calibrate/activate it through the route-state foundation.

Each PR should preserve fresh-load Folsom, pond/Rod A1 physical casting, axe/wood, torch, raw/cooked fish, hunger, campfire cooking, inventory, mobile HUD, Rusted Reliquary exit/return, and GitHub Pages build behavior. The first four PRs should use a Folsom-specific debug or authored config gate until save migrations and mobile performance are proven.

## 9. Do-Not-Build-Yet List

- The full boss ladder or boss-specific animation library.
- The full enemy roster, enemy variants, or unrelated NPC population.
- The full Pale Gate Network, fast-travel presentation, or all echo destinations.
- The final Dreadstone core, Dreadstone Avatar, Open Anchor, or ending scenes.
- All nine Memory Shard illustrations, full Memory playback UI, or final memory cinematics.
- Living architecture kit, breathing halls, organ systems, Harvested Choir, and tissue animation.
- Late-game lenses, White Interface Level II, and Gate Stabilizer before one white panel/node works.
- A complete church town/procession kit before a single bell/route plate proves the interaction.
- Full water-node simulation before one sluice/causeway state is validated.
- All royal wagons, samples, and commander assets before special-object state exists.
- A generic crafting system, growth loot currency, growth shards, route tokens, inventory seals, or collectible map items. These contradict the guide locks.
- High-cost skinned enemy batches, full attack/hurt/death animation sets, unique materials per creature, or unbounded particle/gore libraries.
- A broad rewrite of `DungeonScene.js` solely to prepare hypothetical late-game content. Extract ownership only when the first concrete runtime requires it.

## 10. Final Recommendation

Commission and validate one small **black growth v1 + reveal targets** asset pack for Folsom, centered on the tool-shed latch and reusable chest/pale-panel covers. Then implement the smallest persistent loop that proves the design lock:

`see growth -> strike growth -> growth reacts -> real object is revealed -> world state changes`

Do not request the full game's assets. The repo already has the location, interaction, objective, persistence, mobile, and rendering foundations needed to learn from this slice; it does not yet have the combat, damageable-object, creature, route-domain, or white-system foundations that would make a large asset delivery usable.

Validation for this documentation change: `npm.cmd run build` passed, including `validate:reliquary-startup`, `validate:objectives`, `validate:player-fish-baseline`, TypeScript, and the Vite production build. The package defines no `test` script. Vite reported its existing warning that two generated chunks exceed 500 kB; this audit makes no runtime or bundle changes.

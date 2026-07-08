# Chapter 2 Closure and Chapter 3 Readiness Audit

> **Superseded verdict (2026-07-07):** The later reconciliation is now implemented. The Lantern-first Shrine Side Room/crawlspace, explicit lower shrine hatch, and persisted Iron Drain Bar handoff are complete. The blue-flame hallway is threshold atmosphere, not hatch replacement. Chapter 2 structural reconciliation is complete; White-Scab Hall remains the next paused Chapter 3 mechanic. See [`chapter_1_2_strategy_reconciliation.md`](chapter_1_2_strategy_reconciliation.md).

Audit date: 2026-07-07  
Audited baseline: `e091e8e` (`Overhaul HUD and equipment UI`)

## Verdict

This audit's original qualified verdict is superseded. The runtime now contains a continuous, persisted Chapter 2 route from the Folsom tool proof through the hidden-growth capstone, blue-flame threshold atmosphere, explicit lower shrine hatch, and into the Lower Shrine Stair.

This is a static code and authored-data verdict, not a claim that a fresh-save end-to-end manual test was performed during this docs-only pass.

The implementation is an adaptation of the design-locked strategy guide, not a literal build of its Chapter 2 room list. The three connected anchors remain above ground and the Underworks gate remains the major route unlock. The later reconciliation adds the guide-correct Shrine Side Room, crawlspace investigation, and lower shrine hatch around that adaptation. Beneath Folsom now ends Chapter 2 with the hidden five-hit growth gate, blue-flame threshold atmosphere, and explicit hatch pry into the Lower Shrine Stair.

## Chapter 2 implemented spine

| Spine element | Runtime evidence | Audit result |
| --- | --- | --- |
| Folsom tool loop | `folsom.definition.js` places the Old Work Knife behind the shed and the Wood Axe/Torch rewards inside. `FolsomShedGrowthRuntime.js` requires three hits and saves `folsom_tool_shed_open`. | Implemented |
| Connected anchors | `FOLSOM_CONNECTED_GROWTH_NETWORK` authors fire, pond, and shrine anchors and their feeds. `Interactions.js` assigns Torch capability to fire and the knife path to pond/shrine. `GameState.js` persists all three clears. | Implemented |
| Underworks gate | The Folsom area entrance requires `folsom_underworks_growth_unsealed` and targets `beneath-folsom`. The connected-growth runtime unseals after all anchors clear. | Implemented |
| Beneath Folsom entry | `beneathFolsom.definition.js` registers the location, arrival spawn, return exit, entry stair, and first landing. | Implemented |
| Iron Drain Bar | A persistent equipment pickup is placed on the landing. The drain grate rejects bare hands, accepts the bar, animates open, removes collision, and saves `beneath_folsom_drain_grate_pried`. | Implemented |
| Keeper's Lantern | A persistent pickup exists beyond the grate. Shared equipment supports it as an offhand, while its cold light and bounded reveal emitter drive hidden decals independently of Torch. | Implemented |
| Hidden glyph/growth gate | The lower-wall glyph cluster and gate growth are hidden by default and tied to the Keeper's Lantern reveal cone. Attack handling also requires the Old Work Knife. | Implemented |
| Five-hit clear | Both authored blocker data and `BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_RULES` require five hits. Successful hits require active reveal; the final clear persists `beneath_folsom_hidden_growth_gate_cleared`. | Implemented |
| Clear feedback and opening | Hits damage and weaken the growth, pulse it, emit bounded oil flecks, play wet feedback, and shake the view. Final clear snaps/collapses cords, fades the wall, and removes the blocker. | Implemented |
| Blue-flame hallway | A 40-unit Chapter 2 capstone hall, cold blue fixtures, and animated flames become visible after the hidden gate clears. | Implemented |
| Lower shrine hatch | `beneath_folsom_lower_shrine_hatch` and its blocker close BF04/BF05 until the hidden gate is clear and the Iron Drain Bar forces it open. The open state persists and legacy/Chapter 3-progress saves migrate safely. | Implemented |
| Chapter 3 room boundary | BF05-BF09 provide the preserved room skeleton through the bounded First Crypt stop; Chapter 3 mechanics remain deferred. | Implemented |

## Persistence and state separation

The route uses world-state flags rather than permanent junk inventory:

- `folsom_tool_shed_open`
- `folsom_growth_anchor_fire_cleared`
- `folsom_growth_anchor_pond_cleared`
- `folsom_growth_anchor_shrine_cleared`
- `folsom_underworks_growth_unsealed`
- `beneath_folsom_drain_grate_pried`
- `beneath_folsom_keepers_lantern_reveal_seen`
- `beneath_folsom_hidden_growth_gate_cleared`
- `beneath_folsom_lower_shrine_hatch_open`

Reconciliation correction: `beneath_folsom_keepers_lantern_reveal_seen` is declared in state/authored data, but the inspected runtime does not call the method that writes it. Treat it as intended state, not verified persistence.

The Old Work Knife, Wood Axe, Torch, Iron Drain Bar, and Keeper's Lantern remain equipment/inventory capabilities. That separation is consistent with the locked design direction.

## Blocking versus polish issues

### Blocking issues for Chapter 2 closure

The original audit found no blockers against the adapted playable spine. The reconciliation later identified and resolved strategy-structure debt: the Shrine Side Room/crawlspace, Lantern-first network order, and explicit lower shrine hatch are now backfilled. The underground anchor pockets remain an approved surface-endpoint adaptation. No Chapter 2 structural blocker remains.

Manual verification is still required before treating the closure as release-tested. A fresh-save run should verify the entire sequence, and a reload after the hidden gate clear should verify that the blocker stays removed and the hallway remains visible.

### Polish-only or verification issues

- The milestone has evolved through several focused passes without a new end-to-end play report in this audit. Interaction reach, facing thresholds, equipment switching, and phone-scale readability need a final smoke test.
- The blue-flame hallway uses lightweight procedural cone flames and point lights. It is sufficient as a threshold, but visual tuning and mobile light-cost measurement remain polish.
- The hidden gate's per-hit count is session-local until the fifth hit; only the cleared result persists. This does not block the designed five-hit encounter, but reloading mid-clear resets partial damage.
- `beneathFolsomDefinition.notes` and some older tags still describe an entry slice/first drain loop. They are harmless metadata but can be refreshed when Chapter 3 changes the location boundary.
- The long strategy guide's literal Chapter 2 checklist is not implemented room-for-room. That is a documentation/history distinction, not a missing requirement under the current lock.

## Chapter 3 comparison and feature gaps

The locked Chapter 3 route calls for: Lower Shrine Stair, White-Scab Hall, Shrine Mechanism Room, Pale Panel, Buried White Chamber, and Crypt Access Stair. Its core interaction is `black scab -> exposed pale mechanism -> panel activation -> route opening`.

### Resolved spaces and route contracts

- Chapter 3 extends `beneath-folsom` through the preserved BF05-BF09 skeleton.
- The blue hallway is explicitly threshold atmosphere leading to the persisted lower shrine hatch.
- BF05 is the Lower Shrine Stair, and the authored chain continues through the Crypt Access Stair to a bounded First Crypt stop.
- White-Scab Hall remains the next paused mechanic; these spaces do not claim Chapter 3 interaction completion.

### Missing interaction/state features

- There is no focused white-scab floor-line target that combines Keeper's Lantern reveal with staged Wood Axe/Old Work Knife clearing.
- There are no locked Chapter 3 world-state keys for white mechanism exposure, pale panel activation, or crypt access.
- There is no pale panel interaction or narrow activation sequence.
- There is no central-block movement/opening behavior, root-mat clear, or Iron Drain Bar stair-door pry.
- Map updates and the First White Record are design requirements but have no chapter-specific implementation. They must remain separate from equipment and route flags.

### Reusable foundations already present

- Keeper's Lantern offhand selection, emitter sampling, hidden decal fading, hysteresis, and persisted discovery can support the first pale-line reveal.
- Shed and hidden-gate growth runtimes already provide staged textures, physical hit response, oil effects, cleanup, blocker removal, and persistent final state.
- Existing Wood Axe, Old Work Knife, Iron Drain Bar, equipment, interaction, collision, location, and save paths cover the required tool vocabulary.
- The blue hallway already provides a clear Chapter 2/3 seam and a safe place for a future transition.

## What not to build yet

- Enemies, including the optional Black-Root Crawler.
- Records UI or Memory UI. A later pass may emit/store a narrow First White Record event only after its data ownership is designed.
- Pale Gates or a reusable network/gate progression framework.
- A general white-machinery system or full white-system art kit before one pale-line/panel proof establishes scale and language.
- Bosses, combat expansion, church systems, town quest markers, or unrelated routes.
- A broad Folsom, Underworks, HUD, inventory, or equipment rewrite.
- The First Crypt itself. Chapter 3 should end at a readable Crypt Access Stair threshold.

## Superseded next-pass plan

The former three-pass recommendation below was superseded on 2026-07-07 by the Chapter 3 location-truth pass. The production decision is now locked: Chapter 3 extends `beneath-folsom`, and the complete guide-authoritative room skeleton is authored through the bounded Crypt Access Stair. See [`chapter_3_location_flow_map.md`](chapter_3_location_flow_map.md) and [`chapter_3_location_contract.md`](chapter_3_location_contract.md).

This audit formerly recommended the focused White-Scab Hall reveal/clear proof next. The reconciliation supersedes that recommendation; Chapter 2 structural backfill now comes first. Pale Panel activation, Records ownership, crypt-root clearing, and stair-door pry remain deferred.

## Risks and dependencies

- **Route ownership is resolved.** Chapter 3 extends `beneath-folsom`; future work must preserve the continuous blue-hall handoff and existing return route.
- **Tool sequencing needs an explicit interaction contract.** Current growth attacks mostly test capability ownership, while Chapter 3 describes Axe-then-Knife stages. Implement this narrowly on the white-scab target before considering a generic multi-tool framework.
- **Reveal and attack input compete for offhand/tool readability.** The Keeper's Lantern must stay equipped while axe/knife actions occur. Mobile HUD and equipment switching need direct testing.
- **White-system visual language is not established.** Start with simple white-marble/pale inlay geometry and one panel. Avoid generic sci-fi controls and avoid commissioning a broad kit before the proof reads correctly.
- **Records/map ownership is unresolved.** Route state can proceed independently, but map update and First White Record should not be faked as inventory items or coupled to the panel mesh.
- **Performance needs measurement.** Reuse bounded decals/effects, limit transparent layers and dynamic lights, and measure the combined lantern plus blue-hall cost on a mobile target.
- **Legacy-guide terminology can cause scope drift.** Prompts should reference the current blue-hall handoff and explicitly state which guide beats are being adapted.

## Historical validation note

The validation recommendation in the original audit applied before the strategy reconciliation. Existing functional validation remains evidence for the adapted spine, but it does not establish guide completeness or settle the required backfill.

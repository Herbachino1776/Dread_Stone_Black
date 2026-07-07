# Chapter 2 Closure and Chapter 3 Readiness Audit

> **Reconciliation status (2026-07-07):** This audit's functional-completeness verdict is qualified and its Chapter 3 mechanics recommendation is superseded by [`chapter_1_2_strategy_reconciliation.md`](chapter_1_2_strategy_reconciliation.md). The playable spine remains valid, but Chapter 2 is structurally incomplete against the guide. White-Scab Hall mechanics should remain paused pending the Lantern-first shrine/crawlspace and lower-hatch decisions.

Audit date: 2026-07-07  
Audited baseline: `e091e8e` (`Overhaul HUD and equipment UI`)

## Verdict

Chapter 2 is functionally complete enough to pause against the current production lock and the requested playable spine. The runtime contains a continuous, persisted route from the Folsom tool proof through the Beneath Folsom hidden-growth capstone to a bounded blue-flame future threshold.

This is a static code and authored-data verdict, not a claim that a fresh-save end-to-end manual test was performed during this docs-only pass.

The implementation is an adaptation of the design-locked strategy guide, not a literal build of its Chapter 2 room list. The guide describes an Old Shrine side room, crawlspace, underground anchor split, and lower shrine hatch. The current production lock instead places the three connected anchors above ground, uses the Underworks gate as the major route unlock, and ends Beneath Folsom at a hidden five-hit growth gate and blue-flame hallway. Current milestone locks override the older layout. The guide's connected-growth lesson, tool roles, persistent route change, Keeper's Lantern investigation role, and descent toward older buried construction are preserved.

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
| Placeholder/future threshold | `beneath_folsom_chapter_end_stop` closes the far end and is tagged `future-boundary` and `no-chapter-3`. | Implemented |

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

Reconciliation correction: `beneath_folsom_keepers_lantern_reveal_seen` is declared in state/authored data, but the inspected runtime does not call the method that writes it. Treat it as intended state, not verified persistence.

The Old Work Knife, Wood Axe, Torch, Iron Drain Bar, and Keeper's Lantern remain equipment/inventory capabilities. That separation is consistent with the locked design direction.

## Blocking versus polish issues

### Blocking issues for Chapter 2 closure

The original audit found no blockers against the adapted playable spine. The reconciliation later identified strategy-structure blockers: the missing Shrine Side Room/crawlspace, Keeper's Lantern acquisition after the drain grate and all three surface anchors, absent underground anchor pockets, and absent lower shrine hatch. See the reconciliation for the controlling classification.

Manual verification is still required before treating the closure as release-tested. A fresh-save run should verify the entire sequence, and a reload after the hidden gate clear should verify that the blocker stays removed and the hallway remains visible.

### Polish-only or verification issues

- The milestone has evolved through several focused passes without a new end-to-end play report in this audit. Interaction reach, facing thresholds, equipment switching, and phone-scale readability need a final smoke test.
- The blue-flame hallway uses lightweight procedural cone flames and point lights. It is sufficient as a threshold, but visual tuning and mobile light-cost measurement remain polish.
- The hidden gate's per-hit count is session-local until the fifth hit; only the cleared result persists. This does not block the designed five-hit encounter, but reloading mid-clear resets partial damage.
- `beneathFolsomDefinition.notes` and some older tags still describe an entry slice/first drain loop. They are harmless metadata but can be refreshed when Chapter 3 changes the location boundary.
- The long strategy guide's literal Chapter 2 checklist is not implemented room-for-room. That is a documentation/history distinction, not a missing requirement under the current lock.

## Chapter 3 comparison and feature gaps

The locked Chapter 3 route calls for: Lower Shrine Stair, White-Scab Hall, Shrine Mechanism Room, Pale Panel, Buried White Chamber, and Crypt Access Stair. Its core interaction is `black scab -> exposed pale mechanism -> panel activation -> route opening`.

### Missing spaces and route contracts

- No Lower Shrine Stair or Chapter 3 rooms are authored beyond the `beneath_folsom_chapter_end_stop`.
- The runtime has no locked decision for whether Chapter 3 extends `beneath-folsom` or transitions to a new compiled location.
- The current blue hallway must be mapped explicitly to the guide's lower-shrine descent. Without that contract, room coordinates, spawn/return behavior, persistence ownership, and collision boundaries are unstable.
- No Crypt Access Stair or bounded end-of-chapter threshold exists.

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

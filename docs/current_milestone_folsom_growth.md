# Current Milestone: Chapter 3 Under-Shrine Labyrinth Lead-In

This is the current Dread Stone Black production lock. It overrides older strategy, roadmap, audit, and blueprint language where they conflict.

## Current status

Chapter 2 remains complete through the blue-flame hallway, Iron Drain Bar lower-hatch pry, and BF05 Lower Shrine Stair. The active Chapter 3 lead-in now ends that approach at an impossible White-Scab front seal. Cutting its exposed lower knot does not open the seal; it opens the old Folsom shrine crawlspace terminal elsewhere. That throat enters the separate compiled `under-shrine-labyrinth` location, whose twisting dark descent exits behind the denied threshold in `beneath-folsom`.

The implemented spine remains valuable production truth:

1. Find the Old Work Knife behind the Folsom tool shed.
2. Equip the visible Old Work Knife, grab its lower-right handle zone, and clear the shed seam growth with exactly three blade-contacting swipes before recovering the Wood Axe and Torch.
3. Physically cut the Shrine Side Room cords with the Knife, then use a slower smooth Axe chop to break the exposed knot and persist the opened room.
4. Recover the Keeper's Lantern in the side room and reveal the under-shrine convergence marks and three surface feeds.
5. Cut open the low maintenance panel and inspect the bounded crawlspace ending at the blocked maintenance throat.
6. Physically chop the fire-hardened endpoint with the Axe and cut the pond/shrine endpoints with the Knife, weakening their revealed feeds and unsealing the Underworks gate.
7. Enter `beneath-folsom`, recover the visible Iron Drain Bar, guide its tip into the grate's bent rusted socket, feel it seat, and pull the grip through the short constrained lever arc.
8. Use the Lantern's bounded reveal wash to expose the hidden glyph/growth gate.
9. Clear that hidden growth in exactly five successful knife hits while it is revealed.
10. Cross the blue-flame threshold hallway, pry open the explicit lower shrine hatch with the Iron Drain Bar, and expose the Lower Shrine Stair.

Reliably written route state also includes `beneath_folsom_white_scab_lower_knot_destroyed`, `folsom_shrine_crawlspace_terminal_open`, and `under_shrine_labyrinth_end_hatch_open`.

The physical-tool migration is additive: completed blockers remain complete, and saves that had already reached the Chapter 3 terminal/lower-knot state migrate the newly physicalized labyrinth end hatch open to prevent a route softlock.

This spine is an explicit adaptation, not the guide's complete Chapter 2 room list. The surface anchors serve as revealed endpoints of the under-shrine network instead of three underground pockets. The guide-correct lower shrine hatch now closes the BF04/BF05 seam and resolves the remaining structural debt. The Chapter 3 room skeleton remains preserved in [`chapter_3_location_flow_map.md`](chapter_3_location_flow_map.md) and [`chapter_3_location_contract.md`](chapter_3_location_contract.md).

## Completed-loop locks

- Black growth remains a physical obstruction: wet black plant fiber, oily scab, tarred root, and burnt mycelium. It is not currency, purple corruption, red gore, cartoon slime, magic smoke, or a generic black blob.
- The shed target is growth sealing the door seam/frame, not a tiny latch blob.
- The Old Work Knife is a short, worn work tool behind the shed, never a sword or fantasy dagger.
- Growth and pry blockers never advance from Interact/A. Interact remains for pickups, inspections, and non-tool transitions. Every tool-authored blocker advances only from the correct held tool, gesture quality, swept/pry contact, stage, and prerequisite state.
- Old Work Knife, Wood Axe, and Iron Drain Bar are camera-local visible held tools with ready, active, impact-recoil, cooldown, and return poses. Their motion follows the touch path; bad motion is shown but is not effective contact.
- Every right-hand ready pose originates in the camera's lower-right. The handle/grip is nearest and lowest; the active blade, head, or tip rests above it and crosses center only during the appropriate action arc.
- Touch begins only in the generous invisible grip/handle zone. That pointer remains captured until release and drives the tool. The blade, axe head, and pry tip are physical contact surfaces, never touch-start surfaces.
- Left-side movement remains untouched. Right-side look and offhand aim remain normal unless a touch begins inside the held-tool grip zone. Torch/Lantern coexistence and Lantern reveal behavior remain unchanged.
- Knife uses a fast cut/slash. Its handle starts lower-right, its blade angles upward, and only the moving blade owns thin cord, film, seam, and exposed-knot contact.
- Axe uses a heavy chop. Its handle starts lower-right, its head rests above/right, and only the head crosses the target during a slower, smooth committed stroke; over-fast or squiggly follow-through does not advance heavy targets.
- Iron Drain Bar uses socketed lever prying only. Its lower-right grip remains the touch point while the tip must already be near an authored visible socket/fulcrum before a short physical settle can seat it. Once seated, the tip stays anchored and the handle follows the target's constrained lever arc. It is not a sword or chop tool.
- Pry targets author socket geometry and volume, accepted tool/action, lever direction and arc, tension threshold, blocker id, completion save key, and visual strain stages. The drain grate has the shortest and most forgiving seat; the lower shrine hatch has a smaller notch, longer arc, and heavier strain.
- Early and mid lever travel visibly widen or lift the blocker. The final 20% adds escalating shake, creak, and metal/stone strain before completion. Releasing early unseats or partially relaxes according to the target; no progress occurs from unseated motion.
- Interact/A has no growth or pry victory fallback. Misses and wrong-tool contacts may animate and refuse physically, but they never advance target state.
- The shed clear remains exactly three successful physical Knife contacts with hit reaction, cord snap, black-oil feedback, collapse, screen shake, and persisted opening.
- The shed reward remains Wood Axe + Torch.
- The Shrine Side Room seal remains a Knife-cords then Axe-knot sequence and persists `folsom_shrine_side_room_open`. The Knife visibly severs and drops the cord halves; the Axe fractures the damaged hard knot with the stronger door-opening response.
- The Keeper's Lantern canonical pickup remains inside the Shrine Side Room. BF03 retains only an empty bracketed hook/niche with a removed-object dust shadow; existing Lantern ownership is never duplicated.
- Fresh saves reveal the network with the Keeper's Lantern before surface endpoint interactions become available. Existing anchor/Underworks progress migrates to revealed state without replay.
- The reveal reads as an under-shrine convergence: three rough pale branch marks and black cords lead from room seams into the crawlspace and connect to the retained surface feeds. Only the Keeper's Lantern reveal emitter can expose the hidden state; Torch and ambient light cannot.
- The maintenance crawlspace terminal remains solid through Chapter 2 and cannot bypass the Underworks gate. Only destruction of the Chapter 3 lower knot cracks it open as the entrance to `under-shrine-labyrinth`.
- The crawlspace lowers the first-person eye height on entry and restores it on exit so the player view remains below its authored roof.
- The fire-hardened endpoint uses a physical Wood Axe chop; pond and shrine use physical Old Work Knife cuts. Cleared anchors and their feeds remain world state, not inventory tokens.
- The Underworks transition remains gated by `folsom_underworks_growth_unsealed`, with a reliable return route to Folsom.
- The Iron Drain Bar remains a persistent local pry tool for the drain grate. Its tip seats in the obvious bent/rusted socket; the grip drives a short forgiving arc, and completion persists `beneath_folsom_drain_grate_pried`.
- The Keeper's Lantern remains an offhand light with a separate bounded reveal test. Torch and ambient light do not reveal hidden glyph art.
- `beneath_folsom_keepers_lantern_reveal_seen` is intended to record discovery without making glyphs permanently visible, but the current inspected runtime does not reliably write it. Do not claim this state as complete until it is wired or removed.
- The hidden lower growth gate requires the Keeper's Lantern reveal, the Old Work Knife, and exactly five successful hits. Its final clear persists and opens the blue-flame threshold.
- The blue-flame hallway is threshold atmosphere, not a replacement for the lower shrine hatch.
- The explicit BF04/BF05 hatch requires the hidden gate clear and Iron Drain Bar, rejects bare-hand and unseated attempts, and uses a heavy stone/iron notch with a longer arc and stronger final tension than the drain grate. It persists `beneath_folsom_lower_shrine_hatch_open`.
- `beneath_folsom_lower_shrine_hatch_open` is the canonical Chapter 2 completion state and resolves the physical Folsom north gate as `folsom_north_gate_open`. This opens the route to `north-road` without granting Chapter 3–5 progress or requiring Road Warden proof.
- Use environmental teaching. Do not add tutorial prose to these loops.
- Enemy combat remains intentionally deferred. The reusable physical target receiver can accept future hit receivers, but this milestone adds no enemies, AI, character damage, bosses, or arenas.

## Active Chapter 3 lead-in lock

The front seal `beneath_folsom_white_scab_front_seal` remains impossible from the Lower Shrine Stair side. The lower knot `beneath_folsom_white_scab_lower_knot` is a physical knife target whose death recoils cords away from the seal and enables the Folsom terminal; it never clears the seal locally.

The Folsom terminal physically cracks open into `under-shrine-labyrinth`. That separate authored location provides a pitch-black, ten-segment twisting descent, two squeeze sections, a breathing pocket, an impossible pressure moment, and a persistent end hatch. It exits at `beneath_folsom_white_scab_threshold_backside`, where a hard production boundary prevents entry into deferred content.

White-Scab Hall reveal/clear and all Pale Panel/Shrine Mechanism Room mechanics remain deferred. Do not implement White-Scab Hall until the lower-right viewmodels, grip capture, look/movement coexistence, and active-part contact ergonomics are stable.

## Validation posture

Validate the integrated Folsom route, fresh-save reveal gate, legacy anchor migration, Lantern ownership deduplication, return route, and production build. Preserve movement, mobile controls, HUD, equipment, survival, fishing, saves, location loading, the completed shed loop, hidden five-hit gate, blue hall, and Chapter 3 skeleton.

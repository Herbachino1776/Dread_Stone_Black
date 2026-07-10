# Outdoor Procedural Structure Kits

Outdoor structure kits are small named geometry builders for repeated physical grammar. They are not a general building generator. Final grounding uses the shared terrain sampler and collision intent is explicit.

`OutdoorWildernessStructureKit.js` provides distinct hunter, church, and scout camps, retaining walls, broken military road markers, the Empty Fort exterior silhouette, and its intentional boundary gate.

Camp identity comes from physical props: hunter shelter/skinning rack/deer stand, church prayer posts and devotional marker, and scout windbreak/lookout/observation post. Camp clue surfaces save route state but do not create inventory junk.

`OutdoorCrossingKit.js` provides a visible shallow ford on shared terrain, a timber bridge with deck planks/rails/grounded abutments on an explicit bridge path, and a military culvert with visible inlet/outlet and continuous water profile.

Logical material keys must exist in the location texture registry. Generated meshes must have finite geometry and stay modest in count. North Road currently reports 163 crossing/structure meshes.

The Empty Fort is exterior-only. West wall, central gate, and east wall blockers cover the full 500-meter approach; the interior is deliberately absent and cannot be bypassed at the terrain edges.

Known limitation: camp props and fort silhouette are scale/flow proof geometry. Final bespoke art can replace individual kits while retaining IDs, footprints, collision, and state contracts.

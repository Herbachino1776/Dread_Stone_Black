# Foliage grounding and forest stamps

The deterministic alpha audit measures all 22 registered source PNGs without modifying them. Grounding precedence is placement override, variant override, registry metadata, then conservative type default. Every registered sprite must now provide an audited alpha baseline before the registry will load; future trees cannot silently inherit a zero-padding baseline.

North Road's redwood source art has 52 transparent bottom rows out of 1024 (`0.0508`). Omitting that baseline lifted visible roots by `0.864-1.372 m` at the authored `17-27 m` heights. Willow and thorn sprites had the same missing-metadata failure. The calibrated registry values are passed into all forest-stamp placements and the runtime subtracts the scaled padding before applying conservative burial.

Nine root-footprint samples produce center/min/max height, variance, slope, offsets, burial, and status. Steep placements are rejected; upright billboards are never slope-rotated. Validation resolves all 712 North Road placements against final terrain, requires visible root gap at most `0.08 m`, tree burial at most `0.35 m`, finite sampling, and a bounded deterministic steep-placement rejection count.

North Road retains eight deterministic ecological stamps totaling 712 placements and 9 glades. Clustered canopy and understory passes preserve road, water, fishing, camp, gate, and fort exclusions. `?debug=foliage-grounding` shows root rings and reports worst cases; `?debug=forest-stamps` shows bounds, clusters, glades, accepted samples, and rejects.

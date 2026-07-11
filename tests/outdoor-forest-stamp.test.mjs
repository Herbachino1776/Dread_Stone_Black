import assert from 'node:assert/strict';
import { buildOutdoorForestStamp } from '../src/engine/outdoor-authoring/OutdoorForestStampBuilder.js';
const definition={id:'test-grove',seed:44,preset:'redwoodUpland',shape:{kind:'ellipse',center:[0,0],radiusX:50,radiusZ:30},canopy:{count:70,minimumSpacing:2.5,clusterCount:4,clusterRadius:12},understory:{count:30,minimumSpacing:1.1},composition:{clearingCount:2,clearingRadius:6}};
const a=buildOutdoorForestStamp(definition),b=buildOutdoorForestStamp(definition);assert.deepEqual(a.placements,b.placements);assert.equal(a.placements.length,100);assert.equal(a.debug.glades.length,2);a.placements.forEach(p=>a.debug.glades.forEach(g=>assert.ok(Math.hypot(p.x-g.x,p.z-g.z)>=g.radius)));assert.ok(a.debug.layers.canopy===70&&a.debug.layers.understory===30);assert.ok(new Set(a.placements.map(p=>p.clusterIndex)).size>=3);
console.log('Outdoor forest stamp: determinism, clustered layers, spacing and glades PASS');

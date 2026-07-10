import * as THREE from 'three';
import { sampleOutdoorWaterway } from '../../../engine/outdoor-authoring/OutdoorWaterwayBuilder.js';

function makeMaterial(key, textures, factory, fallback) {
  const profile = textures[key] ?? fallback;
  return factory?.(profile, { materialKey: key, profile, usedFallback: !textures[key] }) ?? new THREE.MeshStandardMaterial({ color: profile.color ?? 0x777777, roughness: profile.roughness ?? 0.95, metalness: profile.metalness ?? 0 });
}

function box(group, name, size, position, material, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name; mesh.position.set(...position); mesh.rotation.y = rotationY; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}

function createBridge(crossing, options) {
  const corridor = options.pathCorridorRuntime?.corridors?.find((candidate) => candidate.id === crossing.pathId);
  if (!corridor) throw new Error(`Outdoor bridge ${crossing.id} is missing constructed path ${crossing.pathId}.`);
  const group = new THREE.Group(); group.name = `OutdoorTimberBridgeKit-${crossing.id}`;
  const wood = makeMaterial(crossing.material ?? 'agedWood', options.textures, options.makeMaterial, { color: 0x66513e, roughness: 0.96 });
  const metal = makeMaterial(crossing.hardwareMaterial ?? 'rustedIron', options.textures, options.makeMaterial, { color: 0x55463c, roughness: 0.88, metalness: 0.3 });
  const spacing = Math.max(0.55, crossing.plankSpacing ?? 0.72);
  const planks = corridor.samples.filter((sample, index) => index === 0 || index === corridor.samples.length - 1 || sample.distance - corridor.samples[Math.max(0, index - 1)].distance >= spacing * 0.7);
  planks.forEach((sample, index) => {
    const yaw = Math.atan2(sample.tangent.x, sample.tangent.z);
    box(group, `${crossing.id}-deck-plank-${String(index).padStart(3, '0')}`, [crossing.width ?? corridor.width, 0.18, spacing * 0.92], [sample.x, sample.profileY + 0.12, sample.z], wood, yaw);
  });
  [corridor.samples[0], corridor.samples.at(-1)].forEach((sample, index) => {
    const yaw = Math.atan2(sample.tangent.x, sample.tangent.z);
    box(group, `${crossing.id}-stone-abutment-${index}`, [(crossing.width ?? corridor.width) + 1.2, 0.8, 1.2], [sample.x, sample.profileY - 0.26, sample.z], options.stoneMaterial, yaw);
  });
  const railSamples = corridor.samples.filter((_, index) => index % 7 === 0 || index === corridor.samples.length - 1);
  railSamples.forEach((sample, index) => [-1, 1].forEach((side) => {
    const x = sample.x + sample.normal.x * ((crossing.width ?? corridor.width) * 0.5 - 0.2) * side;
    const z = sample.z + sample.normal.z * ((crossing.width ?? corridor.width) * 0.5 - 0.2) * side;
    box(group, `${crossing.id}-rail-post-${side}-${index}`, [0.16, 1.1, 0.16], [x, sample.profileY + 0.66, z], metal);
  }));
  group.userData = { id: crossing.id, kind: 'proceduralTimberBridge', pathId: crossing.pathId, visibleDeck: true, groundedAbutments: true, collision: 'explicit bridge path support surface', generatedBy: 'OutdoorTimberBridgeKit', meshCount: group.children.length };
  return group;
}

function createFord(crossing, options) {
  const group = new THREE.Group(); group.name = `OutdoorFordInterface-${crossing.id}`;
  const mud = makeMaterial(crossing.material ?? 'northRoadWetTrack', options.textures, options.makeMaterial, { color: 0x5b4632, roughness: 1 });
  const stone = options.stoneMaterial;
  const [x, z] = crossing.center;
  const water = sampleOutdoorWaterway(options.waterwayRuntime, x, z);
  const y = options.terrainSampler.sampleOutdoorY(x, z);
  box(group, `${crossing.id}-churned-visible-road-bed`, [crossing.width ?? 9, 0.08, crossing.length ?? 14], [x, y + 0.045, z], mud, crossing.rotationY ?? 0);
  for (let index = 0; index < 8; index += 1) {
    const side = index % 2 ? 1 : -1; const along = (Math.floor(index / 2) - 1.5) * 3.2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 + (index % 3) * 0.1, 0), stone);
    rock.name = `${crossing.id}-ford-marker-stone-${index}`; rock.position.set(x + side * ((crossing.width ?? 9) * 0.55), (water?.sample.waterY ?? y) + 0.12, z + along); rock.scale.y = 0.65; rock.rotation.y = index * 0.71; rock.receiveShadow = true; group.add(rock);
  }
  group.userData = { id: crossing.id, kind: 'fordInterface', waterwayId: water?.waterway.id, visibleShallowBed: true, collision: 'shared final terrain', generatedBy: 'OutdoorFordInterface', meshCount: group.children.length };
  return group;
}

function createCulvert(crossing, options) {
  const group = new THREE.Group(); group.name = `OutdoorRoadCulvertKit-${crossing.id}`;
  const [x, z] = crossing.center;
  const sampled = sampleOutdoorWaterway(options.waterwayRuntime, x, z);
  const waterY = sampled?.sample.waterY ?? options.terrainSampler.sampleOutdoorY(x, z) - 0.4;
  const yaw = crossing.rotationY ?? Math.atan2(sampled?.sample.tangent.x ?? 1, sampled?.sample.tangent.z ?? 0);
  const pipeMaterial = makeMaterial(crossing.hardwareMaterial ?? 'rustedIron', options.textures, options.makeMaterial, { color: 0x55483d, roughness: 0.9, metalness: 0.25 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, crossing.length ?? 11, 12, 1, true), pipeMaterial);
  pipe.name = `${crossing.id}-visible-drainage-barrel`; pipe.rotation.z = Math.PI / 2; pipe.rotation.y = yaw; pipe.position.set(x, waterY + 0.18, z); pipe.receiveShadow = true; group.add(pipe);
  const tangent = sampled?.sample.tangent ?? { x: 1, z: 0 };
  [-1, 1].forEach((side) => {
    const hx = x + tangent.x * (crossing.length ?? 11) * 0.5 * side; const hz = z + tangent.z * (crossing.length ?? 11) * 0.5 * side;
    box(group, `${crossing.id}-${side < 0 ? 'inlet' : 'outlet'}-headwall`, [4.8, 1.9, 0.7], [hx, waterY + 0.6, hz], options.stoneMaterial, yaw);
  });
  group.userData = { id: crossing.id, kind: 'militaryRoadCulvert', waterwayId: sampled?.waterway.id, inletVisible: true, outletVisible: true, continuousWaterProfile: true, collision: 'road terrain remains authoritative', generatedBy: 'OutdoorRoadCulvertKit', meshCount: group.children.length };
  return group;
}

export function createOutdoorCrossingGroups(definitions = [], options = {}) {
  const stoneMaterial = makeMaterial('militaryStone', options.textures ?? {}, options.makeMaterial, { color: 0x77736a, roughness: 0.98 });
  const resolved = { ...options, textures: options.textures ?? {}, stoneMaterial };
  return definitions.map((crossing) => crossing.kind === 'bridge' ? createBridge(crossing, resolved) : crossing.kind === 'ford' ? createFord(crossing, resolved) : crossing.kind === 'culvert' ? createCulvert(crossing, resolved) : null).filter(Boolean);
}

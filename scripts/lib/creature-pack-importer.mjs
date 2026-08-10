import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  assertValidCreaturePack,
  CREATURE_PACK_REGISTRY_SCHEMA,
  CREATURE_PACK_VERSION,
  validateCreaturePack,
  validateCreaturePackRegistry,
} from '../../src/contracts/CreaturePack.js';
import { DREADGUARD_BONE_MAP } from '../../src/game/combat/HumanoidModelProfiles.js';
import { measureVisibleSkinnedBounds, resolveAnimationPackManifest } from '../../src/game/combat/HumanoidGlbVisualAdapter.js';
import {
  ACTIVE_DAMAGE_SEGMENT_CONTRACTS,
  DAMAGE_MANIFEST_SCHEMA,
  validateDamageAsset,
} from '../../src/game/combat/HumanoidDamageSegmentRuntime.js';
import {
  FORGE_PROGRESSIVE_DAMAGE_SITE_SCHEMA,
  validateForgeDamageDeformationAsset,
} from '../../src/game/combat/ForgeDamageDeformationRuntime.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPOSITORY_ROOT = path.resolve(moduleDirectory, '..', '..');
export const DEFAULT_GENERATED_DIRECTORY = path.join(DEFAULT_REPOSITORY_ROOT, 'public', 'generated', 'creature-packs');

export const DEFAULT_PRODUCTION_CREATURE_PACKS = Object.freeze([
  Object.freeze({
    packId: 'chezwick_damage_v001',
    displayName: 'Chezwick',
    sourceDir: 'public/assets/enemies/chezwick/damage',
  }),
  Object.freeze({
    packId: 'dreadguard_damage_v001',
    displayName: 'Dreadguard',
    sourceDir: 'public/assets/enemies/dreadguard/damage',
  }),
  Object.freeze({
    packId: 'dread_ram_god_damage_v001',
    displayName: 'Dread Ram God',
    sourceDir: 'public/assets/enemies/dread_ram_god/damage',
  }),
]);

const KNOWN_HUMANOID_BONES = Object.freeze([...new Set(Object.values(DREADGUARD_BONE_MAP))]);
const CURRENT_HUMANOID_SKELETON_FAMILY = 'DSB_HUMANOID_V1';
const CURRENT_HUMANOID_BONE_MAP_PROFILE = 'dreadstone.humanoid.current_bone_map.v1';

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
};
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

function actionableError(message, cause = null) {
  return new Error(`[Creature Pack] ${message}`, cause ? { cause } : undefined);
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(directoryPath) {
  try {
    return (await stat(directoryPath)).isDirectory();
  } catch {
    return false;
  }
}

async function requireFile(filePath, label) {
  if (!(await isFile(filePath))) throw actionableError(`${label} is missing: ${filePath}`);
  return filePath;
}

async function readJson(filePath, label) {
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    throw actionableError(`${label} could not be read: ${filePath}`, error);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw actionableError(`${label} is not valid JSON: ${filePath}`, error);
  }
}

function normalizeExplicitPath(value, repositoryRoot) {
  if (!value) return null;
  return path.resolve(repositoryRoot, value);
}

async function findDamageManifest(sourceDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json' || /_validation\.json$/i.test(entry.name)) continue;
    const candidatePath = path.join(sourceDir, entry.name);
    let value;
    try {
      value = JSON.parse(await readFile(candidatePath, 'utf8'));
    } catch {
      continue;
    }
    if (value?.schema === DAMAGE_MANIFEST_SCHEMA) candidates.push(candidatePath);
  }
  if (!candidates.length) throw actionableError(`damage manifest is missing in ${sourceDir}; expected one ${DAMAGE_MANIFEST_SCHEMA} JSON file`);
  if (candidates.length > 1) throw actionableError(`multiple damage manifests were found in ${sourceDir}: ${candidates.map(path.basename).join(', ')}`);
  return candidates[0];
}

async function resolveManifestGlb(sourceDir, manifest, explicitGlbPath = null) {
  if (explicitGlbPath) return requireFile(explicitGlbPath, 'damage GLB');
  const manifestName = path.basename(String(manifest?.glb ?? ''));
  if (!manifestName) throw actionableError('damage manifest has no glb identity');
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const matches = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase() === manifestName.toLowerCase());
  if (!matches.length) throw actionableError(`damage GLB is missing in ${sourceDir}; manifest requires ${manifestName}`);
  if (matches.length > 1) throw actionableError(`damage GLB identity ${manifestName} is ambiguous in ${sourceDir}`);
  return path.join(sourceDir, matches[0].name);
}

async function discoverAnimationSidecar(sourceDir) {
  const animationDirectory = path.resolve(sourceDir, '..', 'animations');
  if (!(await isDirectory(animationDirectory))) return { animationManifestPath: null, animationValidationReportPath: null };
  const entries = await readdir(animationDirectory, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json' || /_validation\.json$/i.test(entry.name)) continue;
    const candidatePath = path.join(animationDirectory, entry.name);
    let value;
    try {
      value = JSON.parse(await readFile(candidatePath, 'utf8'));
    } catch {
      continue;
    }
    if (value?.schema === 'dreadstone.animation_pack.v1') candidates.push(candidatePath);
  }
  if (candidates.length > 1) throw actionableError(`multiple animation manifests were found beside ${sourceDir}; pass --animation-manifest explicitly`);
  if (!candidates.length) return { animationManifestPath: null, animationValidationReportPath: null };
  const animationManifestPath = candidates[0];
  const animationValidationReportPath = animationManifestPath.replace(/\.json$/i, '_validation.json');
  await requireFile(animationValidationReportPath, 'animation validation report');
  return { animationManifestPath, animationValidationReportPath };
}

export async function discoverDamageBundle({
  sourceDir,
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  glbPath = null,
  manifestPath = null,
  validationReportPath = null,
  animationManifestPath = null,
  animationValidationReportPath = null,
} = {}) {
  const resolvedSourceDir = path.resolve(repositoryRoot, sourceDir ?? path.dirname(manifestPath ?? glbPath ?? '.'));
  if (!(await isDirectory(resolvedSourceDir))) throw actionableError(`source directory is missing: ${resolvedSourceDir}`);

  const resolvedManifestPath = normalizeExplicitPath(manifestPath, repositoryRoot) ?? await findDamageManifest(resolvedSourceDir);
  await requireFile(resolvedManifestPath, 'damage manifest');
  const manifest = await readJson(resolvedManifestPath, 'damage manifest');
  const resolvedGlbPath = await resolveManifestGlb(resolvedSourceDir, manifest, normalizeExplicitPath(glbPath, repositoryRoot));
  const resolvedValidationPath = normalizeExplicitPath(validationReportPath, repositoryRoot)
    ?? resolvedManifestPath.replace(/\.json$/i, '_validation.json');
  await requireFile(resolvedValidationPath, 'damage validation report');

  let resolvedAnimationManifestPath = normalizeExplicitPath(animationManifestPath, repositoryRoot);
  let resolvedAnimationValidationPath = normalizeExplicitPath(animationValidationReportPath, repositoryRoot);
  if (!resolvedAnimationManifestPath && !resolvedAnimationValidationPath) {
    const sidecar = await discoverAnimationSidecar(resolvedSourceDir);
    resolvedAnimationManifestPath = sidecar.animationManifestPath;
    resolvedAnimationValidationPath = sidecar.animationValidationReportPath;
  }
  if (Boolean(resolvedAnimationManifestPath) !== Boolean(resolvedAnimationValidationPath)) {
    throw actionableError('animation manifest and animation validation report must be supplied together');
  }
  if (resolvedAnimationManifestPath) {
    await requireFile(resolvedAnimationManifestPath, 'animation manifest');
    await requireFile(resolvedAnimationValidationPath, 'animation validation report');
  }

  return {
    sourceDir: resolvedSourceDir,
    glbPath: resolvedGlbPath,
    manifestPath: resolvedManifestPath,
    validationReportPath: resolvedValidationPath,
    animationManifestPath: resolvedAnimationManifestPath,
    animationValidationReportPath: resolvedAnimationValidationPath,
    manifest,
  };
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw actionableError(`${label} is missing or invalid`);
  return value;
}

function requirePass(value, label) {
  if (value !== 'PASS') throw actionableError(`${label} must be PASS, received ${value ?? 'missing'}`);
}

function requireEmptyErrors(value, label) {
  if (!Array.isArray(value)) throw actionableError(`${label} errors must be an array`);
  if (value.length) throw actionableError(`${label} contains errors: ${value.join('; ')}`);
}

function validateDamageManifestShape(manifest) {
  if (manifest?.schema !== DAMAGE_MANIFEST_SCHEMA) throw actionableError(`damage manifest schema must be ${DAMAGE_MANIFEST_SCHEMA}`);
  requireString(manifest.authoringVersion, 'damage manifest authoringVersion');
  requireString(manifest.authoringBuildId, 'damage manifest authoringBuildId');
  requireString(manifest.glb, 'damage manifest glb');
  requireString(manifest.source?.object, 'damage manifest source.object');
  requireString(manifest.source?.armature, 'damage manifest source.armature');
  requireString(manifest.source?.topologyFingerprint, 'damage manifest source.topologyFingerprint');
  requireString(manifest.source?.weightFingerprint, 'damage manifest source.weightFingerprint');
  if (!Array.isArray(manifest.segments)) throw actionableError('damage manifest segments must be an array');
  if (!manifest.deformations || typeof manifest.deformations !== 'object') throw actionableError('damage manifest deformations are missing');
  if (!Array.isArray(manifest.deformations.registeredRegions)) throw actionableError('damage manifest deformation regions must be an array');
  if (!Array.isArray(manifest.deformations.generatedGoreMeshes)) throw actionableError('damage manifest generated gore meshes must be an array');
  if (manifest.runtimeSkeleton != null) {
    if (manifest.runtimeSkeleton.schema !== 'dreadstone.runtime_skeleton.v1') throw actionableError('runtime skeleton schema must be dreadstone.runtime_skeleton.v1');
    requireString(manifest.runtimeSkeleton.armature, 'runtime skeleton armature');
    if (!Number.isInteger(manifest.runtimeSkeleton.skeletonCount) || manifest.runtimeSkeleton.skeletonCount < 1) {
      throw actionableError('runtime skeleton count must be a positive integer');
    }
    if (!Array.isArray(manifest.runtimeSkeleton.requiredBones) || !manifest.runtimeSkeleton.requiredBones.every((name) => typeof name === 'string' && name.trim())) {
      throw actionableError('runtime skeleton requiredBones must be an array of non-empty strings');
    }
  }
}

export function validateProgressiveSiteRecords(manifest) {
  const deformation = manifest?.deformations;
  const sites = deformation?.progressiveDamageSites;
  if (!Array.isArray(sites)) throw actionableError('progressive damage sites must be an array');
  if (sites.length && deformation.progressiveDamageSiteSchema !== FORGE_PROGRESSIVE_DAMAGE_SITE_SCHEMA) {
    throw actionableError(`progressive damage site schema must be ${FORGE_PROGRESSIVE_DAMAGE_SITE_SCHEMA}`);
  }
  const siteIds = new Set();
  for (const site of sites) {
    if (site?.schema !== FORGE_PROGRESSIVE_DAMAGE_SITE_SCHEMA) throw actionableError(`progressive site ${site?.siteId ?? 'missing'} has an invalid schema`);
    const siteId = requireString(site.siteId, 'progressive damage siteId');
    if (siteIds.has(siteId)) throw actionableError(`progressive damage site ${siteId} is duplicated`);
    siteIds.add(siteId);
    if (!Array.isArray(site.stageOrder) || !site.stageOrder.length || new Set(site.stageOrder).size !== site.stageOrder.length) {
      throw actionableError(`progressive damage site ${siteId} has an invalid stageOrder`);
    }
    if (!Array.isArray(site.stages)) throw actionableError(`progressive damage site ${siteId} stages must be an array`);
    const stages = new Map();
    for (const stage of site.stages) {
      const stageName = requireString(stage?.stage, `${siteId} stage name`);
      if (stages.has(stageName)) throw actionableError(`${siteId} stage ${stageName} is duplicated`);
      requireString(stage.stageId, `${siteId} ${stageName} stageId`);
      requireString(stage.deformationKeyName, `${siteId} ${stageName} deformationKeyName`);
      stages.set(stageName, stage);
    }
    let previousAnchor = 0;
    for (const stageName of site.stageOrder) {
      const stage = stages.get(stageName);
      if (!stage) throw actionableError(`${siteId} stageOrder references missing stage ${stageName}`);
      const namedAnchor = Number(site.severityAnchors?.[stageName.toLowerCase()]);
      const recommendedAnchor = Number(stage.recommendedSeverity);
      const anchor = Number.isFinite(namedAnchor) ? namedAnchor : recommendedAnchor;
      if (!(anchor > previousAnchor && anchor <= 1)) throw actionableError(`${siteId} stage ${stageName} has invalid severity anchor ${anchor}`);
      previousAnchor = anchor;
    }
  }
  return sites;
}

export function validateForgeReportIdentity(manifest, report) {
  requirePass(report?.status, 'Forge damage validation report status');
  requireEmptyErrors(report?.errors, 'Forge damage validation report');
  if (report.authoring_version !== manifest.authoringVersion) throw actionableError('Forge report authoring version does not match the damage manifest');
  if (report.authoring_build_id !== manifest.authoringBuildId) throw actionableError('Forge report authoring build does not match the damage manifest');
  if (report.source_topology_sha256 !== manifest.source.topologyFingerprint) throw actionableError('Forge report source topology fingerprint does not match the damage manifest');
  if (report.source_weight_sha256 !== manifest.source.weightFingerprint) throw actionableError('Forge report source weight fingerprint does not match the damage manifest');
  requirePass(report.source_readiness?.status, 'Forge source readiness status');
  if (report.source_readiness?.contract_schema !== manifest.source.readinessContractSchema) throw actionableError('Forge report source readiness schema does not match the damage manifest');
  requirePass(report.deformation?.status, 'Forge deformation validation status');
  requireEmptyErrors(report.deformation?.errors, 'Forge deformation validation');
  if (report.deformation?.schema !== manifest.deformations.schema) throw actionableError('Forge report deformation schema does not match the damage manifest');
  if (report.deformation?.authoringVersion !== manifest.deformations.authoringVersion) throw actionableError('Forge report deformation authoring version does not match the damage manifest');
  if (report.deformation?.authoringBuildId !== manifest.deformations.authoringBuildId) throw actionableError('Forge report deformation authoring build does not match the damage manifest');
  requirePass(report.finalGlb?.status, 'Forge final GLB validation status');
  requireEmptyErrors(report.finalGlb?.errors, 'Forge final GLB validation');
  if ((manifest.deformations.surfaceStainMeshes?.length ?? 0) > 0) requirePass(report.finalGlb?.surfaceStains?.status, 'Forge final GLB surface stain validation status');
  if ((manifest.deformations.generatedGoreMeshes?.length ?? 0) > 0) requirePass(report.finalGlb?.raisedGoreGeometry?.status, 'Forge final GLB raised gore validation status');
  if (manifest.runtimeSkeleton) {
    const runtimeSkeleton = report.runtimeSkeleton;
    requirePass(runtimeSkeleton?.status, 'Forge runtime skeleton validation status');
    requireEmptyErrors(runtimeSkeleton?.errors, 'Forge runtime skeleton validation');
    if (runtimeSkeleton.armature !== manifest.runtimeSkeleton.armature) throw actionableError('Forge report runtime skeleton armature does not match the damage manifest');
    if (runtimeSkeleton.skeletonCount !== manifest.runtimeSkeleton.skeletonCount) throw actionableError('Forge report runtime skeleton count does not match the damage manifest');
    if (runtimeSkeleton.requiredBoneCount !== manifest.runtimeSkeleton.requiredBones.length) throw actionableError('Forge report runtime skeleton required-bone count does not match the damage manifest');
    requireEmptyErrors(runtimeSkeleton.missingBones, 'Forge runtime skeleton missing bones');
  }
  if (!isDeepStrictEqual(manifest.validation, report)) throw actionableError('embedded manifest validation and sidecar validation report differ; the Forge export is stale or incomplete');
  return report;
}

export function parseGlbJsonChunk(buffer) {
  if (buffer.length < 20 || buffer.subarray(0, 4).toString('ascii') !== 'glTF') throw actionableError('damage GLB has an invalid binary glTF header');
  if (buffer.readUInt32LE(4) !== 2) throw actionableError(`damage GLB version ${buffer.readUInt32LE(4)} is unsupported; expected 2`);
  if (buffer.readUInt32LE(8) !== buffer.length) throw actionableError('damage GLB declared byte length does not match the file');
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    if (offset + 8 + chunkLength > buffer.length) throw actionableError('damage GLB contains a truncated chunk');
    if (chunkType === 0x4e4f534a) {
      try {
        return JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8').replace(/\u0000+$/, ''));
      } catch (error) {
        throw actionableError('damage GLB JSON chunk is malformed', error);
      }
    }
    offset += 8 + chunkLength;
  }
  throw actionableError('damage GLB has no JSON chunk');
}

async function loadGlb(glbPath) {
  const bytes = await readFile(glbPath);
  const json = parseGlbJsonChunk(bytes);
  let gltf;
  try {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    gltf = await new GLTFLoader().parseAsync(arrayBuffer, pathToFileURL(`${path.dirname(glbPath)}${path.sep}`).href);
  } catch (error) {
    throw actionableError(`GLTFLoader could not parse ${glbPath}: ${error.message}`, error);
  }
  return { bytes, json, gltf };
}

function approvedClipMetadata(clip) {
  const metadata = clip?.userData ?? {};
  if (metadata.dsb_approved !== true) return null;
  if (metadata.dsb_draft !== false) throw actionableError(`embedded animation ${clip.name} is approved but not explicitly non-draft`);
  if (metadata.dsb_animation_clip_schema !== 'dreadstone.animation_clip.v1') throw actionableError(`embedded animation ${clip.name} has an invalid approval schema`);
  requireString(metadata.dsb_approved_kind, `embedded animation ${clip.name} approved kind`);
  if (!Number.isFinite(Number(metadata.dsb_approved_frame_start)) || !Number.isFinite(Number(metadata.dsb_approved_frame_end))) {
    throw actionableError(`embedded animation ${clip.name} has invalid approved frame bounds`);
  }
  return {
    name: clip.name,
    kind: metadata.dsb_approved_kind,
    frameStart: Number(metadata.dsb_approved_frame_start),
    frameEnd: Number(metadata.dsb_approved_frame_end),
    durationSeconds: clip.duration,
  };
}

function createEmbeddedApprovalManifest(approvedClips) {
  return {
    schema: 'dreadstone.animation_pack.v1',
    approved_animation_count: approvedClips.length,
    animations: approvedClips.map((clip) => ({
      name: clip.name,
      approved_kind: clip.kind,
      frame_start: clip.frameStart,
      frame_end: clip.frameEnd,
      duration_seconds: clip.durationSeconds,
    })),
  };
}

function validateAnimationReport(manifest, report) {
  requirePass(report?.status, 'animation validation report status');
  const names = manifest.animations.map((entry) => entry.name);
  if (report.animation_count !== manifest.approved_animation_count) throw actionableError('animation report count does not match the animation manifest');
  if (!isDeepStrictEqual(report.exported_animation_names, names)) throw actionableError('animation report exported names do not match the animation manifest');
  if (Array.isArray(report.expected_animation_names) && !isDeepStrictEqual(report.expected_animation_names, names)) throw actionableError('animation report expected names do not match the animation manifest');
  requireEmptyErrors(report.missing_animations ?? [], 'animation validation missing animations');
  requireEmptyErrors(report.unexpected_animations ?? [], 'animation validation unexpected animations');
  requireEmptyErrors(report.duplicate_animation_names ?? [], 'animation validation duplicate names');
  const reportAsset = path.basename(String(report.glb_path ?? '')).toLowerCase();
  if (reportAsset && reportAsset !== String(manifest.asset ?? '').toLowerCase()) throw actionableError('animation report GLB identity does not match the animation manifest');
}

async function validateAnimations({ gltf, animationManifestPath, animationValidationReportPath, packId }) {
  const approved = gltf.animations.map(approvedClipMetadata).filter(Boolean);
  const approvedNames = new Set(approved.map((clip) => clip.name));
  if (approvedNames.size !== approved.length) throw actionableError('embedded approved animation names are duplicated');
  let animationManifest = null;
  let animationReport = null;
  if (animationManifestPath) {
    animationManifest = await readJson(animationManifestPath, 'animation manifest');
    animationReport = await readJson(animationValidationReportPath, 'animation validation report');
    if (animationManifest.schema !== 'dreadstone.animation_pack.v1') throw actionableError('animation manifest has an invalid schema');
    if (!Array.isArray(animationManifest.animations) || animationManifest.animations.length !== animationManifest.approved_animation_count) {
      throw actionableError('animation manifest approved count is invalid');
    }
    validateAnimationReport(animationManifest, animationReport);
    const manifestNames = animationManifest.animations.map((entry) => entry.name);
    if (manifestNames.some((name) => !approvedNames.has(name)) || approved.some((clip) => !manifestNames.includes(clip.name))) {
      throw actionableError('approved embedded animation set does not exactly match the animation manifest');
    }
  } else if (approved.length) {
    animationManifest = createEmbeddedApprovalManifest(approved);
  }

  if (animationManifest) {
    const allowedKinds = [...new Set(animationManifest.animations.map((entry) => entry.approved_kind))];
    resolveAnimationPackManifest(animationManifest, gltf.animations, packId, {
      allowedKinds,
      requireEmbeddedApprovalMetadata: true,
    });
  }
  return {
    manifest: animationManifest,
    report: animationReport,
    approvedClips: approved.sort((left, right) => left.name.localeCompare(right.name)),
    unapprovedClipCount: gltf.animations.length - approved.length,
  };
}

function applyForgeDefaultVisibility(root) {
  root.traverse((object) => {
    if (
      object.userData?.dsb_default_visible === false
      || object.userData?.dsb_gore_default_visible === false
      || object.userData?.dsb_stain_default_visible === false
      || object.name?.startsWith('DSB_GORE_')
      || object.name?.startsWith('DSB_STAIN_')
    ) object.visible = false;
  });
}

function applySingleApprovedIdlePose(root, gltf, animationValidation) {
  const idleEntries = animationValidation.approvedClips.filter((entry) => entry.kind === 'IDLE');
  if (idleEntries.length !== 1) return false;
  const idleEntry = idleEntries[0];
  const sourceClip = gltf.animations.find((clip) => clip.name === idleEntry.name);
  if (!sourceClip) return false;
  const clip = sourceClip.clone();
  const fps = Math.max(1, Number(animationValidation.manifest?.fps) || 24);
  clip.tracks.forEach((track) => track.shift(-idleEntry.frameStart / fps));
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.update(0);
  root.updateMatrixWorld(true);
  root.traverse((object) => object.skeleton?.update?.());
  return true;
}

function isEffectivelyVisible(object, root) {
  for (let current = object; current; current = current.parent) {
    if (!current.visible) return false;
    if (current === root) break;
  }
  return true;
}

function roundNumber(value) {
  return Number(Number(value).toFixed(9));
}

function roundedVector(vector) {
  return vector.toArray().map(roundNumber);
}

function collectAssetStatistics({ root, gltf, glbJson, fileBytes, manifest, activeSegmentIds, approvedClipCount }) {
  let meshCount = 0;
  let visibleMeshCount = 0;
  let skinnedMeshCount = 0;
  let visibleSkinnedMeshCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  let morphTargetCount = 0;
  const uniqueMorphNames = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshCount += 1;
    const visible = isEffectivelyVisible(object, root);
    if (visible) visibleMeshCount += 1;
    if (object.isSkinnedMesh) {
      skinnedMeshCount += 1;
      if (visible) visibleSkinnedMeshCount += 1;
    }
    const position = object.geometry?.attributes?.position;
    vertexCount += position?.count ?? 0;
    triangleCount += object.geometry?.index
      ? Math.floor(object.geometry.index.count / 3)
      : Math.floor((position?.count ?? 0) / 3);
    const morphNames = Object.keys(object.morphTargetDictionary ?? {});
    morphTargetCount += morphNames.length;
    morphNames.forEach((name) => uniqueMorphNames.add(name));
  });
  const deformationKeys = new Set((manifest.deformations.registeredRegions ?? []).flatMap((region) => (region.keys ?? []).map((key) => key.name)));
  return {
    glbFileBytes: fileBytes,
    glbMeshDefinitionCount: glbJson.meshes?.length ?? 0,
    meshCount,
    visibleMeshCount,
    skinnedMeshCount,
    visibleSkinnedMeshCount,
    vertexCount,
    triangleCount,
    morphTargetCount,
    uniqueMorphTargetNameCount: uniqueMorphNames.size,
    progressiveSiteCount: manifest.deformations.progressiveDamageSites.length,
    deformationKeyCount: deformationKeys.size,
    generatedGoreMeshCount: manifest.deformations.generatedGoreMeshes.length,
    stainMeshCount: manifest.deformations.surfaceStainMeshes?.length ?? 0,
    detachableSegmentCount: manifest.segments.length,
    activeDetachableSegmentCount: activeSegmentIds.length,
    animationCount: gltf.animations.length,
    approvedAnimationCount: approvedClipCount,
    imageCount: glbJson.images?.length ?? 0,
    textureCount: glbJson.textures?.length ?? 0,
    materialCount: glbJson.materials?.length ?? 0,
  };
}

function parseAnimationFacing(clips) {
  for (const clip of clips) {
    const value = clip.userData?.dsb_animation_settings_json;
    if (typeof value !== 'string') continue;
    try {
      const facing = JSON.parse(value)?.facing;
      if (facing === 'POS_Y') return '+Y';
      if (facing === 'NEG_Y') return '-Y';
      if (facing === 'POS_X') return '+X';
      if (facing === 'NEG_X') return '-X';
    } catch {
      // The runtime approval validator owns malformed animation extras.
    }
  }
  return null;
}

function inferPresentationContract(manifest, root, clips) {
  const boneNames = new Set();
  root.traverse((object) => { if (object.isBone && object.name) boneNames.add(object.name); });
  const knownHumanoid = KNOWN_HUMANOID_BONES.every((name) => boneNames.has(name));
  const anatomy = manifest.anatomy ?? null;
  if (!anatomy && !knownHumanoid) throw actionableError('skeleton/anatomy family cannot be derived; export an anatomy profile or add an explicit supported importer profile');
  const skeletonFamilyId = anatomy?.profileId ?? CURRENT_HUMANOID_SKELETON_FAMILY;
  const boneMapProfileId = knownHumanoid ? CURRENT_HUMANOID_BONE_MAP_PROFILE : anatomy?.rigProfileId;
  requireString(skeletonFamilyId, 'skeleton family identifier');
  requireString(boneMapProfileId, 'bone-map profile identifier');
  return {
    authoredForwardAxis: anatomy?.orientation?.forwardAxis ?? parseAnimationFacing(clips),
    upAxis: anatomy?.orientation?.upAxis ?? (knownHumanoid ? '+Z' : null),
    unitScaleMeters: Number(anatomy?.unitScaleMeters) || 1,
    skeletonFamilyId,
    boneMapProfileId,
    anatomyProfileNative: Boolean(anatomy),
  };
}

function validateRuntimeSkeletonContract(manifest, report, root, glbJson) {
  if (!manifest.runtimeSkeleton) return null;
  const skeletons = new Set();
  root.traverse((object) => {
    if (object.isSkinnedMesh && object.skeleton) skeletons.add(object.skeleton);
  });
  const skeletonCount = skeletons.size;
  const skinCount = glbJson.skins?.length ?? 0;
  const runtimeArmature = root.getObjectByName(manifest.runtimeSkeleton.armature);
  if (!runtimeArmature) throw actionableError(`runtime skeleton armature ${manifest.runtimeSkeleton.armature} is missing from the damage GLB`);
  if (skeletonCount !== manifest.runtimeSkeleton.skeletonCount) {
    throw actionableError(`damage GLB runtime skeleton count ${skeletonCount} does not match manifest count ${manifest.runtimeSkeleton.skeletonCount}`);
  }
  if (skinCount !== report.runtimeSkeleton.skinCount) {
    throw actionableError(`damage GLB skin count ${skinCount} does not match Forge report count ${report.runtimeSkeleton.skinCount}`);
  }
  const boneNames = new Set([...skeletons].flatMap((skeleton) => skeleton.bones.map((bone) => bone.name)));
  const missingBones = manifest.runtimeSkeleton.requiredBones.filter((name) => !boneNames.has(name));
  if (missingBones.length) throw actionableError(`damage GLB runtime skeleton is missing required bone(s): ${missingBones.join(', ')}`);
  return {
    schema: manifest.runtimeSkeleton.schema,
    armature: manifest.runtimeSkeleton.armature,
    skeletonCount,
    skinCount,
    requiredBoneCount: manifest.runtimeSkeleton.requiredBones.length,
  };
}

function toPublicUrl(repositoryRoot, filePath) {
  const publicRoot = path.resolve(repositoryRoot, 'public');
  const relative = path.relative(publicRoot, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw actionableError(`generated pack asset is outside public/: ${filePath}`);
  return `./${relative.split(path.sep).join('/')}`;
}

function defaultDisplayName(packId) {
  return packId
    .replace(/_damage_v\d+$/i, '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function collectImportDiagnostics({ manifest, report, glbPath, presentation, animations }) {
  const diagnostics = [];
  if (path.basename(glbPath) !== manifest.glb) diagnostics.push({
    level: 'warning',
    code: 'CASE_INSENSITIVE_GLB_NAME_MATCH',
    message: `Manifest GLB identity ${manifest.glb} differs in case from repository file ${path.basename(glbPath)}.`,
  });
  for (const warning of report.warnings ?? []) diagnostics.push({ level: 'warning', code: 'FORGE_WARNING', message: String(warning) });
  const reportedSiteCount = Number(report.deformation?.progressiveDamageSites?.siteCount) || 0;
  const exportedSiteCount = manifest.deformations.progressiveDamageSites.length;
  if (reportedSiteCount > exportedSiteCount) diagnostics.push({
    level: 'warning',
    code: 'FORGE_PROGRESSIVE_SITES_NOT_EXPORTED',
    message: `${reportedSiteCount - exportedSiteCount} authored progressive site(s) were not exported; Creature Pack capabilities include native exported sites only.`,
  });
  if (!presentation.anatomyProfileNative) diagnostics.push({
    level: 'info',
    code: 'LEGACY_SKELETON_FAMILY_INFERRED',
    message: 'No Forge anatomy profile was exported; the current humanoid bone signature supplied the skeleton and bone-map profile identifiers.',
  });
  if (animations.unapprovedClipCount > 0) diagnostics.push({
    level: 'info',
    code: 'UNAPPROVED_EMBEDDED_ANIMATIONS_IGNORED',
    message: `${animations.unapprovedClipCount} embedded clip(s) are not approved Forge animation capabilities.`,
  });
  if (!presentation.authoredForwardAxis) diagnostics.push({
    level: 'warning',
    code: 'AUTHORED_FORWARD_AXIS_NOT_DERIVED',
    message: 'The Forge anatomy and approved animation metadata do not declare an authored forward axis.',
  });
  return diagnostics;
}

export async function importCreaturePack({
  packId,
  displayName = null,
  sourceDir,
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  glbPath = null,
  manifestPath = null,
  validationReportPath = null,
  animationManifestPath = null,
  animationValidationReportPath = null,
} = {}) {
  requireString(packId, 'packId');
  const bundle = await discoverDamageBundle({
    sourceDir,
    repositoryRoot,
    glbPath,
    manifestPath,
    validationReportPath,
    animationManifestPath,
    animationValidationReportPath,
  });
  const manifest = bundle.manifest;
  validateDamageManifestShape(manifest);
  validateProgressiveSiteRecords(manifest);
  const report = await readJson(bundle.validationReportPath, 'damage validation report');
  validateForgeReportIdentity(manifest, report);

  const { bytes, json: glbJson, gltf } = await loadGlb(bundle.glbPath);
  const animationValidation = await validateAnimations({
    gltf,
    animationManifestPath: bundle.animationManifestPath,
    animationValidationReportPath: bundle.animationValidationReportPath,
    packId,
  });
  const availableSegmentIds = manifest.segments.map((segment) => segment.segmentId);
  const activeRuntimeSegmentIds = availableSegmentIds.filter((segmentId) => ACTIVE_DAMAGE_SEGMENT_CONTRACTS[segmentId]);
  const validationAnimationManifest = animationValidation.manifest ?? { schema: 'dreadstone.animation_pack.v1', approved_animation_count: 0, animations: [] };
  const validationProfile = {
    name: packId,
    assetPath: path.basename(bundle.glbPath),
    damageAuthoringVersion: manifest.authoringVersion,
    damageAuthoringBuildId: manifest.authoringBuildId,
    damageTopologyFingerprint: manifest.source.topologyFingerprint,
    damageWeightFingerprint: manifest.source.weightFingerprint,
    activeDamageSegmentIds: activeRuntimeSegmentIds,
    damageExpectedAnimationNames: validationAnimationManifest.animations.map((entry) => entry.name),
    animationRuntimeKinds: [...new Set(validationAnimationManifest.animations.map((entry) => entry.approved_kind))],
  };
  try {
    validateDamageAsset({
      manifest,
      root: gltf.scene,
      profile: validationProfile,
      clips: gltf.animations,
      animationManifest: validationAnimationManifest,
    });
    validateForgeDamageDeformationAsset({ manifest, root: gltf.scene, progressiveDamageSiteFallbacks: [] });
  } catch (error) {
    throw actionableError(`runtime asset validation rejected ${packId}: ${error.message}`, error);
  }

  applyForgeDefaultVisibility(gltf.scene);
  applySingleApprovedIdlePose(gltf.scene, gltf, animationValidation);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => object.skeleton?.update?.());
  const rawBounds = measureVisibleSkinnedBounds(gltf.scene);
  if (rawBounds.isEmpty()) throw actionableError(`${packId} has no visible skinned bounds`);
  const rawSize = rawBounds.getSize(new THREE.Vector3());
  if (!(rawSize.y > 0)) throw actionableError(`${packId} has an invalid measured height`);
  const presentationInference = inferPresentationContract(manifest, gltf.scene, gltf.animations);
  const runtimeSkeleton = validateRuntimeSkeletonContract(manifest, report, gltf.scene, glbJson);
  const presentation = {
    rawBounds: {
      min: roundedVector(rawBounds.min),
      max: roundedVector(rawBounds.max),
      size: roundedVector(rawSize),
    },
    rawHeight: roundNumber(rawSize.y),
    authoredForwardAxis: presentationInference.authoredForwardAxis,
    upAxis: presentationInference.upAxis,
    unitScaleMeters: presentationInference.unitScaleMeters,
    skeletonFamilyId: presentationInference.skeletonFamilyId,
    boneMapProfileId: presentationInference.boneMapProfileId,
    ...(runtimeSkeleton ? { runtimeSkeleton } : {}),
  };
  const cost = collectAssetStatistics({
    root: gltf.scene,
    gltf,
    glbJson,
    fileBytes: bytes.length,
    manifest,
    activeSegmentIds: activeRuntimeSegmentIds,
    approvedClipCount: animationValidation.approvedClips.length,
  });
  const nativeProgressiveSiteIds = manifest.deformations.progressiveDamageSites.map((site) => site.siteId).sort();
  const deformationRegionIds = manifest.deformations.registeredRegions.map((region) => region.regionId).sort();
  const pairedSegments = manifest.segments.filter((segment) => Boolean(segment.detachedObject) && Boolean(segment.attachedObject ?? segment.proximalSegmentObject));

  const pack = {
    schema: 'dreadstone.creature_pack.v1',
    version: CREATURE_PACK_VERSION,
    packId,
    displayName: displayName ?? defaultDisplayName(packId),
    assets: {
      glb: toPublicUrl(repositoryRoot, bundle.glbPath),
      damageManifest: toPublicUrl(repositoryRoot, bundle.manifestPath),
      damageValidationReport: toPublicUrl(repositoryRoot, bundle.validationReportPath),
      animationManifest: bundle.animationManifestPath ? toPublicUrl(repositoryRoot, bundle.animationManifestPath) : null,
      animationValidationReport: bundle.animationValidationReportPath ? toPublicUrl(repositoryRoot, bundle.animationValidationReportPath) : null,
    },
    source: {
      object: manifest.source.object,
      armature: manifest.source.armature,
      readinessContractSchema: manifest.source.readinessContractSchema,
      objectId: manifest.source.objectId ?? null,
      meshDataId: manifest.source.meshDataId ?? null,
      armatureObjectId: manifest.source.armatureObjectId ?? null,
      armatureDataId: manifest.source.armatureDataId ?? null,
      topologyFingerprint: manifest.source.topologyFingerprint,
      weightFingerprint: manifest.source.weightFingerprint,
      readinessAnalyzerRevision: manifest.source.readinessAnalyzerRevision ?? null,
      readinessAnalyzerBuildId: manifest.source.readinessAnalyzerBuildId ?? null,
      exportGeneratedAtUtc: manifest.generatedAtUtc ?? null,
    },
    authoring: {
      damageVersion: manifest.authoringVersion,
      damageBuildId: manifest.authoringBuildId,
      deformationVersion: manifest.deformations.authoringVersion,
      deformationBuildId: manifest.deformations.authoringBuildId,
    },
    presentation,
    capabilities: {
      progressiveDamage: nativeProgressiveSiteIds.length > 0,
      deformations: cost.deformationKeyCount > 0,
      gore: cost.generatedGoreMeshCount > 0,
      surfaceStains: cost.stainMeshCount > 0,
      pairedDetachableSegments: pairedSegments.length > 0,
      embeddedAnimations: cost.approvedAnimationCount > 0,
      separatelyValidatedAnimations: Boolean(bundle.animationManifestPath),
    },
    damage: {
      availableSegmentIds: [...availableSegmentIds].sort(),
      activeRuntimeSegmentIds: [...activeRuntimeSegmentIds].sort(),
      deformationRegionIds,
      progressiveDamageSiteIds: nativeProgressiveSiteIds,
    },
    animations: {
      delivery: animationValidation.approvedClips.length ? 'embedded' : 'none',
      manifestValidated: Boolean(bundle.animationManifestPath),
      approvedClips: animationValidation.approvedClips.map(({ name, kind }) => ({ name, kind })),
      unapprovedClipCount: animationValidation.unapprovedClipCount,
    },
    importDiagnostics: collectImportDiagnostics({
      manifest,
      report,
      glbPath: bundle.glbPath,
      presentation: presentationInference,
      animations: animationValidation,
    }),
    cost,
  };
  return assertValidCreaturePack(pack);
}

export function serializeGeneratedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function createCreaturePackRegistry(packs, { repositoryRoot = DEFAULT_REPOSITORY_ROOT, generatedDirectory = DEFAULT_GENERATED_DIRECTORY } = {}) {
  const entries = [...packs]
    .sort((left, right) => left.packId.localeCompare(right.packId))
    .map((pack) => ({
      packId: pack.packId,
      displayName: pack.displayName,
      descriptorPath: toPublicUrl(repositoryRoot, path.join(generatedDirectory, `${pack.packId}.json`)),
      assetPath: pack.assets.glb,
      sourceTopologyFingerprint: pack.source.topologyFingerprint,
      capabilities: { ...pack.capabilities },
    }));
  const registry = {
    schema: CREATURE_PACK_REGISTRY_SCHEMA,
    version: CREATURE_PACK_VERSION,
    packs: entries,
  };
  const validation = validateCreaturePackRegistry(registry);
  if (!validation.valid) throw actionableError(`generated registry is invalid: ${validation.errors.join('; ')}`);
  return registry;
}

export async function loadGeneratedCreaturePacks(generatedDirectory = DEFAULT_GENERATED_DIRECTORY) {
  if (!(await isDirectory(generatedDirectory))) return [];
  const entries = await readdir(generatedDirectory, { withFileTypes: true });
  const packs = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name === 'index.json' || path.extname(entry.name).toLowerCase() !== '.json') continue;
    const value = await readJson(path.join(generatedDirectory, entry.name), 'generated Creature Pack');
    const validation = validateCreaturePack(value);
    if (!validation.valid) throw actionableError(`generated descriptor ${entry.name} is invalid: ${validation.errors.join('; ')}`);
    packs.push(value);
  }
  return packs.sort((left, right) => left.packId.localeCompare(right.packId));
}

async function compareGeneratedFile(filePath, expected) {
  let actual;
  try {
    actual = await readFile(filePath, 'utf8');
  } catch {
    throw actionableError(`generated output is missing: ${filePath}`);
  }
  if (actual !== expected) throw actionableError(`generated output is stale: ${filePath}; rerun the importer without --check`);
}

export async function emitCreaturePacks(packs, {
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  generatedDirectory = DEFAULT_GENERATED_DIRECTORY,
  check = false,
} = {}) {
  const unique = new Map();
  for (const pack of packs) {
    assertValidCreaturePack(pack);
    if (unique.has(pack.packId)) throw actionableError(`duplicate generated pack ID ${pack.packId}`);
    unique.set(pack.packId, pack);
  }
  const ordered = [...unique.values()].sort((left, right) => left.packId.localeCompare(right.packId));
  const registry = createCreaturePackRegistry(ordered, { repositoryRoot, generatedDirectory });
  if (!check) await mkdir(generatedDirectory, { recursive: true });
  for (const pack of ordered) {
    const filePath = path.join(generatedDirectory, `${pack.packId}.json`);
    const source = serializeGeneratedJson(pack);
    if (check) await compareGeneratedFile(filePath, source);
    else await writeFile(filePath, source, 'utf8');
  }
  const registryPath = path.join(generatedDirectory, 'index.json');
  const registrySource = serializeGeneratedJson(registry);
  if (check) await compareGeneratedFile(registryPath, registrySource);
  else await writeFile(registryPath, registrySource, 'utf8');
  return { packs: ordered, registry, generatedDirectory, check };
}

export class CombatLabDebugPanel {
  constructor({ app, dungeon, equipmentRuntime } = {}) {
    this.app = app;
    this.dungeon = dungeon;
    this.equipmentRuntime = equipmentRuntime;
    this.debugVisible = false;
    this.woundAnchorsVisible = false;
    this.slow = false;
    this.frozen = false;
    this.lightingMode = 0;
    this.consciousnessMode = 0;
    this.bloodMode = 0;
    this.lastTextUpdate = 0;
    this.disposers = [];
    this.build();
    this.bindKeyboard();
  }

  build() {
    this.panel = document.createElement('aside');
    this.panel.dataset.combatLabPanel = 'true';
    this.panel.style.cssText = 'position:fixed;z-index:1400;top:calc(env(safe-area-inset-top) + 6px);right:calc(env(safe-area-inset-right) + 6px);width:min(46vw,360px);max-height:58vh;overflow:auto;padding:7px;border:1px solid #685b4d;background:#0a0a0bd9;color:#d9d2c7;font:10px/1.32 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:auto;';
    const title = document.createElement('div');
    title.textContent = 'PHYSICAL COMBAT LAB';
    title.style.cssText = 'font-weight:700;letter-spacing:.12em;margin-bottom:6px;color:#e1b98a';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px';
    const definitions = [
      ['RESET R', () => this.reset()],
      ['EQUIP KNIFE', () => this.restoreKnife()],
      ['EQUIP SWORD', () => this.equipWeapon('dreadstone_sword')],
      ['EQUIP MACE', () => this.equipWeapon('dreadstone_mace')],
      ['UNARMED', () => this.equipWeapon('unarmed')],
      ['DEBUG B', () => this.toggleDebug()],
      ['ANCHORS A', () => this.toggleWoundAnchors()],
      ['FREEZE P', () => this.toggleFreeze()],
      ['SLOW O', () => this.toggleSlow()],
      ['DAY/NIGHT N', () => this.toggleNight()],
      ['PANEL M', () => this.togglePanel()],
      ['PUSH I', () => this.dungeon?.weaponController?.nudgeExtension?.(0.1)],
      ['PULL U', () => this.dungeon?.weaponController?.nudgeExtension?.(-0.1)],
      ['SLASH <', () => this.dungeon?.weaponController?.nudgeAim?.(-0.22, 0)],
      ['SLASH >', () => this.dungeon?.weaponController?.nudgeAim?.(0.22, 0)],
      ['STEP .', () => this.dungeon?.stepPhysics?.()],
      ['WOUNDS C', () => this.dungeon?.clearWounds?.()],
      ['BLOOD V', () => this.dungeon?.clearBlood?.()],
      ['HAPTIC H', () => this.toggleHaptics()],
      ['MUTE Q', () => this.toggleMute()],
      ['CONSC Y', () => this.cycleConsciousness()],
      ['RESERVE G', () => this.cycleBloodReserve()],
      ['MORTALITY X', () => this.toggleMortality()],
      ['DECAPITATE J', () => this.dungeon?.debugDecapitate?.()],
      ['LEFT FOREARM K', () => this.dungeon?.debugDetachLeftForearm?.()],
      ['RIGHT FOREARM L', () => this.dungeon?.debugDetachRightForearm?.()],
      ['DAMAGE LIGHT', () => this.dungeon?.debugDamageLight?.()],
      ['DAMAGE MEDIUM', () => this.dungeon?.debugDamageMedium?.()],
      ['DAMAGE HEAVY', () => this.dungeon?.debugDamageHeavy?.()],
      ['DAMAGE RESET', () => this.dungeon?.debugResetForgeDamage?.()],
      ['CUT TEST 6', () => this.dungeon?.createDebugSlash?.()],
      ['WALK PAUSE 7', () => this.dungeon?.toggleWalkerLocomotion?.()],
      ['WALK STAB 8', () => this.dungeon?.forceWalkerQualifyingStab?.()],
      ['WALK RESPAWN 9', () => this.dungeon?.forceWalkerRespawn?.()],
      ['CHEST 1', () => this.triggerCollapse('chest_fold', false)],
      ['NECK 2', () => this.triggerCollapse('neck_failure', true)],
      ['HEAD 3', () => this.triggerCollapse('neurological', true)],
      ['LEG 4', () => this.triggerCollapse('leg_failure', false)],
      ['LOSS 5', () => this.triggerCollapse('blood_loss', true)],
      ['TORCH T', () => this.equipLight('torch')],
      ['LANTERN', () => this.equipLight('keepers_lantern')],
    ];
    if (this.dungeon?.bloodLightingDebugEnabled) definitions.push(['BLOOD LIGHT', () => this.dungeon.cycleBloodLightingDebugMode?.()]);
    definitions.forEach(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = 'padding:4px 6px;border:1px solid #746657;background:#26211d;color:#e7ddd0;font:10px monospace;touch-action:manipulation';
      button.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); action(); });
      controls.append(button);
    });
    this.readout = document.createElement('pre');
    this.readout.dataset.combatLabDiagnostics = 'true';
    this.readout.style.cssText = 'margin:0;white-space:pre-wrap;color:#b9d7ce;user-select:text';
    this.panel.append(title, controls, this.readout);
    this.app.append(this.panel);
  }

  bindKeyboard() {
    const keydown = (event) => {
      if (this.dungeon?.disposed || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target?.matches?.('input,textarea,select') || event.target?.isContentEditable) return;
      if (event.code === 'KeyR') this.reset();
      if (event.code === 'KeyK') this.dungeon?.debugDetachLeftForearm?.();
      if (event.code === 'KeyB') this.toggleDebug();
      if (event.code === 'KeyA') this.toggleWoundAnchors();
      if (event.code === 'KeyP') this.toggleFreeze();
      if (event.code === 'KeyO') this.toggleSlow();
      if (event.code === 'KeyN') this.toggleNight();
      if (event.code === 'KeyM') this.togglePanel();
      if (event.code === 'KeyI') this.dungeon?.weaponController?.nudgeExtension?.(0.1);
      if (event.code === 'KeyU') this.dungeon?.weaponController?.nudgeExtension?.(-0.1);
      if (event.code === 'KeyJ') this.dungeon?.debugDecapitate?.();
      if (event.code === 'KeyL') this.dungeon?.debugDetachRightForearm?.();
      if (event.code === 'Semicolon') this.dungeon?.weaponController?.nudgeAim?.(0.22, 0);
      if (event.code === 'Period') this.dungeon?.stepPhysics?.();
      if (event.code === 'KeyC') this.dungeon?.clearWounds?.();
      if (event.code === 'KeyV') this.dungeon?.clearBlood?.();
      if (event.code === 'KeyH') this.toggleHaptics();
      if (event.code === 'KeyQ') this.toggleMute();
      if (event.code === 'KeyY') this.cycleConsciousness();
      if (event.code === 'KeyG') this.cycleBloodReserve();
      if (event.code === 'KeyX') this.toggleMortality();
      if (event.code === 'Digit6') this.dungeon?.createDebugSlash?.();
      if (event.code === 'Digit7') this.dungeon?.toggleWalkerLocomotion?.();
      if (event.code === 'Digit8') this.dungeon?.forceWalkerQualifyingStab?.();
      if (event.code === 'Digit9') this.dungeon?.forceWalkerRespawn?.();
      if (event.code === 'Digit1') this.triggerCollapse('chest_fold', false);
      if (event.code === 'Digit2') this.triggerCollapse('neck_failure', true);
      if (event.code === 'Digit3') this.triggerCollapse('neurological', true);
      if (event.code === 'Digit4') this.triggerCollapse('leg_failure', false);
      if (event.code === 'Digit5') this.triggerCollapse('blood_loss', true);
      if (event.code === 'KeyT') this.equipLight('torch');
    };
    window.addEventListener('keydown', keydown);
    this.disposers.push(() => window.removeEventListener('keydown', keydown));
  }

  reset() { this.dungeon?.resetActor?.(); }
  restoreKnife() {
    if (!this.equipmentRuntime?.hasItem?.('old_work_knife')) this.equipmentRuntime?.acquireItem?.('old_work_knife', { source: 'combat_lab_ephemeral' });
    this.equipmentRuntime?.equip?.('tool', 'old_work_knife');
  }
  equipWeapon(itemId) {
    if (!this.equipmentRuntime?.hasItem?.(itemId)) this.equipmentRuntime?.acquireItem?.(itemId, { source: 'combat_lab_ephemeral' });
    this.equipmentRuntime?.equip?.('weapon', itemId);
  }
  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.dungeon?.actor?.setDebugVisible?.(this.debugVisible);
    this.dungeon?.walkerController?.actor?.setDebugVisible?.(this.debugVisible);
    this.dungeon?.weaponController?.setDebugVisible?.(this.debugVisible);
  }
  toggleWoundAnchors() {
    this.woundAnchorsVisible = !this.woundAnchorsVisible;
    this.dungeon?.actor?.setWoundSurfaceDebugVisible?.(this.woundAnchorsVisible);
    this.dungeon?.walkerController?.actor?.setWoundSurfaceDebugVisible?.(this.woundAnchorsVisible);
  }
  toggleFreeze() { this.frozen = !this.frozen; this.dungeon?.setPhysicsPaused?.(this.frozen); }
  toggleSlow() { this.slow = !this.slow; this.dungeon?.setPhysicsSlow?.(this.slow); }
  toggleNight() {
    this.lightingMode = (this.lightingMode + 1) % 5;
    this.dungeon?.setLightingMode?.(['day', 'dusk', 'night-dark', 'night-torch', 'night-lantern'][this.lightingMode]);
  }
  toggleHaptics() { this.dungeon.feedbackSystem.setHapticsEnabled(!this.dungeon.feedbackSystem.hapticsEnabled); }
  toggleMute() { this.dungeon.feedbackSystem.setMuted(!this.dungeon.feedbackSystem.muted); }
  cycleConsciousness() { const values = [1, 0.5, 0.15]; this.consciousnessMode = (this.consciousnessMode + 1) % values.length; this.dungeon.actor.physiology.setConsciousness(values[this.consciousnessMode]); }
  cycleBloodReserve() { const values = [1, 0.45, 0.12]; this.bloodMode = (this.bloodMode + 1) % values.length; this.dungeon.actor.physiology.setBloodReserve(values[this.bloodMode]); }
  toggleMortality() { this.dungeon?.toggleMortalityMode?.(); }
  triggerCollapse(family, lethal) { this.dungeon.actor.requestCollapse(family, { immediate: family === 'neurological' || family === 'neck_failure', lethal }); }
  equipLight(itemId) {
    if (!this.equipmentRuntime.hasItem(itemId)) this.equipmentRuntime.acquireItem(itemId, { source: 'combat_lab_ephemeral' });
    this.equipmentRuntime.equip('offhand', itemId);
    this.lightingMode = itemId === 'torch' ? 3 : 4;
    this.dungeon.setLightingMode(itemId === 'torch' ? 'night-torch' : 'night-lantern');
  }
  togglePanel() {
    this.readout.hidden = !this.readout.hidden;
    this.panel.style.width = this.readout.hidden ? 'auto' : 'min(46vw,360px)';
  }

  update(now = performance.now(), frameTimeMs = 0) {
    if (now - this.lastTextUpdate < 80) return;
    this.lastTextUpdate = now;
    const diagnostics = this.dungeon?.getDiagnostics?.() ?? {};
    const physics = diagnostics.physics ?? {};
    const actor = diagnostics.actor ?? {};
    const damageAsset = actor.damageAsset ?? {};
    const dismemberment = actor.dismemberment ?? {};
    const forgeDamage = damageAsset.deformation ?? dismemberment.deformation ?? {};
    const walker = diagnostics.walker ?? {};
    const playerCollision = diagnostics.playerCollision ?? {};
    const routing = diagnostics.combatRouting ?? {};
    const weaponSelection = diagnostics.weapon ?? {};
    const activeWeapon = weaponSelection.active ?? weaponSelection;
    const mace = weaponSelection.mace ?? (activeWeapon.itemId === 'dreadstone_mace' ? activeWeapon : {});
    const sword = weaponSelection.sword ?? (activeWeapon.itemId === 'dreadstone_sword' ? activeWeapon : {});
    const maceDirect = mace.maceDirectControl ?? {};
    const weapon = weaponSelection.knife ?? activeWeapon;
    const director = diagnostics.director ?? {};
    const spacing = diagnostics.meleeSpacing ?? {};
    const blood = diagnostics.blood ?? {};
    const bloodMaterial = blood.particleMaterial ?? {};
    const woundBloodMaterial = blood.authoredWoundMaterial ?? {};
    const bloodFactory = blood.materialFactory ?? {};
    const feedback = diagnostics.feedback ?? {};
    const acceptedAudio = diagnostics.acceptedCombatAudio ?? {};
    const physiology = actor.physiology ?? {};
    const wounds = actor.wounds ?? {};
    const reaction = actor.visualAdapter?.reaction ?? {};
    this.readout.textContent = [
      `frame ${frameTimeMs.toFixed?.(2) ?? frameTimeMs}ms  physics ${(physics.physicsStepMs ?? 0).toFixed(2)}ms x${physics.substeps ?? 0}`,
      `bodies ${physics.rigidBodies ?? 0}  constraints ${physics.constraints ?? 0}  contacts ${physics.activeContacts ?? 0}  sweeps ${physics.weaponSweeps ?? 0}`,
      `time ${this.frozen ? 'FROZEN' : this.slow ? '20%' : '100%'}  light ${['DAY', 'DUSK', 'NIGHT-DARK', 'TORCH', 'LANTERN'][this.lightingMode]}  resets ${physics.resetCount ?? 0}`,
      '',
      `actor ${actor.state ?? 'unknown'}  mortality ${actor.mortalityMode ?? 'unknown'}  motor ${(actor.motorStrength ?? 0).toFixed(2)}`,
      `balance ${(actor.balanceImpairment ?? 0).toFixed(2)}  consciousness ${(actor.consciousnessImpairment ?? 0).toFixed(2)}  wounds ${actor.activeWounds ?? 0}`,
      `blood ${(physiology.bloodReserve ?? 1).toFixed(3)}  loss/s ${(physiology.bloodLossRate ?? 0).toFixed(4)}  shock ${(physiology.shock ?? 0).toFixed(2)}  conscious ${(physiology.consciousness ?? 1).toFixed(2)}`,
      `breathing ${physiology.breathingState ?? '-'}  interrupt ${(physiology.breathInterruption ?? 0).toFixed(2)}  collapse ${actor.collapseFamily ?? '-'}  ragdoll ${actor.ragdollActive ? 'ACTIVE' : 'OFF'}  sleep ${actor.corpseSleeping ? 'YES' : 'NO'}`,
      `wound ${JSON.stringify(wounds.selected ?? null)}`,
      `reaction ${reaction.reactionKind ?? '-'} / ${reaction.source ?? '-'}  ${reaction.region ?? '-'}  severity ${(reaction.severity ?? 0).toFixed(2)}  phase ${reaction.phase ?? 'idle'}  remaining ${(reaction.timeRemaining ?? 0).toFixed(3)}s`,
      `timing ${JSON.stringify(reaction.timingProfile ?? null)}  target ${(reaction.targetPoseAmplitudeDegrees ?? 0).toFixed(2)}deg  current ${(reaction.maximumCurrentAdditiveAngleDegrees ?? 0).toFixed(2)}deg  root ${(reaction.rootRecoilDistance ?? 0).toFixed(4)}m`,
      `reaction bones ${JSON.stringify(reaction.affectedBones ?? [])}`,
      `additive deg ${JSON.stringify(reaction.additiveAngles ?? {})}`,
      `decal ${wounds.selected?.decalFamily ?? '-'} / ${wounds.selected?.decalPhysicalCategory ?? '-'}  ${wounds.selected?.decalSelectionState ?? '-'}  ${wounds.selected?.decalVariantId ?? '-'}  rev ${wounds.selected?.decalSelectionRevisionCount ?? 0}`,
      `eligible ${JSON.stringify(wounds.selected?.decalEligibleCandidateIds ?? [])}  recent ${JSON.stringify(wounds.selected?.recentSameFamilyVariantHistory ?? [])}`,
      `binding ${wounds.selected?.surfaceBindingStatus ?? '-'}  reason ${wounds.selected?.fallbackReason ?? '-'}  mesh ${wounds.selected?.meshName ?? '-'}  tri ${JSON.stringify(wounds.selected?.triangleIndices ?? null)}`,
      `bary ${JSON.stringify(wounds.selected?.barycentric ?? null)}  anchor ${(wounds.selected?.semanticAnchorDistance ?? 0).toFixed(4)}m  surface ${(wounds.selected?.surfaceDistance ?? 0).toFixed(4)}m  slash ${wounds.selected?.renderedSegmentCount ?? 0}/${wounds.selected?.slashSampleCount ?? 0}  material ${wounds.selected?.materialAvailable === false ? 'MISSING' : 'READY'}`,
      `gash ${wounds.latestSlash?.selectedSlitVariant ?? '-'}  path ${(wounds.latestSlash?.renderedPathLength ?? 0).toFixed(3)}/${(wounds.latestSlash?.physicalCutLength ?? 0).toFixed(3)}m  fragments ${wounds.latestSlash?.fragmentCount ?? 0}/${wounds.latestSlash?.fragmentLimit ?? 0}  spacing ${(wounds.latestSlash?.averageCenterSpacing ?? 0).toFixed(4)}m`,
      `continuity overlap ${((wounds.latestSlash?.minimumVisibleOverlapRatio ?? 0) * 100).toFixed(1)}%  gap ${(wounds.latestSlash?.maximumUncoveredGap ?? 0).toExponential(2)}m <= ${(wounds.latestSlash?.continuityTolerance ?? 0).toExponential(2)}m  curve ${(wounds.latestSlash?.maximumPathCurvature ?? 0).toFixed(3)}rad`,
      `gash fallback ${wounds.latestSlash?.fallbackUsage ? 'YES' : 'NO'}  endpoint ${(wounds.latestSlash?.endpointScale ?? 0).toFixed(2)}  materials/draws ${wounds.latestSlash?.materialCount ?? 0}/${wounds.latestSlash?.drawCallCount ?? 0}  geometry rev ${wounds.latestSlash?.visualGeometryRevision ?? 0}`,
      `projection failures ${wounds.failedProjectionCount ?? 0}  fallback ${wounds.fallbackAnchorUsage ?? 0}  anchors ${this.woundAnchorsVisible ? 'ON' : 'OFF'}`,
      `blood fx ${blood.particles ?? 0}/${blood.particleLimit ?? 0}  decals ${blood.decals ?? 0}/${blood.decalLimit ?? 0}`,
      ...(blood.debugEnabled ? [
        `blood lighting ${bloodMaterial.debugMode ?? '-'}  ${bloodMaterial.materialType ?? '-'} / ${bloodMaterial.response ?? '-'}  program ${bloodMaterial.programCacheKey ?? '-'}`,
        `blood source ${formatRgb(bloodMaterial.sourceRgb)}  illumination luma ${(bloodMaterial.illuminationLuminance ?? 0).toFixed(4)}  final ${formatRgb(bloodMaterial.finalRgb)}`,
        `blood saturation ${(bloodMaterial.finalSaturation ?? 0).toFixed(4)}  red dominance ${(bloodMaterial.redDominance ?? 0).toFixed(4)}  cap ${(bloodMaterial.brightnessCap ?? 0).toFixed(2)}`,
        `blood toneMapped ${bloodMaterial.toneMapped ? 'YES' : 'NO'}  emissive ${(bloodMaterial.emissiveIntensity ?? 0).toFixed(2)}  readability layer ${blood.readabilityLayerMembership ? 'YES' : 'NO'}`,
        `wound material ${woundBloodMaterial.materialType ?? '-'} / ${woundBloodMaterial.response ?? '-'}  texture ${woundBloodMaterial.textureAttached ? 'YES' : 'NO'}  neutral tint ${woundBloodMaterial.neutralTint ? 'YES' : 'NO'}`,
        `blood materials ${bloodFactory.materialCount ?? 0}  renderer programs ${blood.rendererProgramCount ?? 0}  shader hooks ${bloodFactory.shaderPatchCount ?? 0}`,
        `blood warmups ${bloodFactory.warmupCount ?? 0}  warmup programs +${bloodFactory.lastWarmupProgramDelta ?? 0}`,
      ] : []),
      `audio ${feedback.activeVoices ?? 0} voices  haptic ${feedback.activeHapticEvents ?? 0}  event ${feedback.lastEvent ?? '-'}  mute ${feedback.muted ? 'YES' : 'NO'}`,
      `accepted stab ${acceptedAudio.stabEmissionCount ?? 0}  cue ${acceptedAudio.stabLastCueId ?? '-'}  armed ${acceptedAudio.penetrationAudioArmed == null ? '-' : acceptedAudio.penetrationAudioArmed ? 'YES' : 'NO'}  rearms ${acceptedAudio.penetrationAudioRearmCount ?? 0}`,
      `death sigh ${acceptedAudio.deathSighEmissionCount ?? 0}/${acceptedAudio.deathSighScheduledCount ?? 0}  pending ${acceptedAudio.pendingDelayedCueCount ?? 0}  actor ${acceptedAudio.deathSighLastActorId ?? '-'}  profile ${acceptedAudio.voiceProfile ?? '-'}`,
      `trauma ${JSON.stringify(actor.regionalTrauma ?? {})}`,
      `pose ${JSON.stringify(actor.bodyPositions ?? {})}`,
      `ragdoll bones ${JSON.stringify(actor.visualAdapter?.ragdollBonePositions ?? {})}  bindings ${actor.visualAdapter?.ragdollBindingCount ?? 0}`,
      `damage asset ${damageAsset.enabled ? 'READY' : 'OFF'}  ${damageAsset.manifestSchema ?? '-'}  author ${damageAsset.authoringVersion ?? '-'} / ${damageAsset.authoringBuildId ?? '-'}`,
      `segments ${(dismemberment.detachedSegments ?? []).join(',') || 'INTACT'}  requests ${dismemberment.requestedCount ?? 0}/${dismemberment.acceptedCount ?? 0}  bodies ${dismemberment.detachedRigidBodyCount ?? 0}  colliders ${dismemberment.detachedColliderCount ?? 0}`,
      `spawn error ${(dismemberment.spawnPositionError ?? 0).toFixed(5)}m / ${(dismemberment.spawnRotationErrorDegrees ?? 0).toFixed(2)}deg  collider ${dismemberment.colliderTypeUsed ?? '-'}`,
      `detach mortality/blood ${dismemberment.mortalityActivationCount ?? 0}/${dismemberment.bloodActivationCount ?? 0}  wound transfer ${dismemberment.detachedWoundTransferImplemented ? 'READY' : 'LATER'}`,
      `forge morphs ${JSON.stringify(forgeDamage.morphWeights ?? {})}`,
      `forge raised nodes ${JSON.stringify(forgeDamage.visibleGoreNodes ?? [])}  ownership overlap ${forgeDamage.headOwnershipOverlap ? 'ERROR' : 'NONE'}`,
      `forge last ${JSON.stringify(forgeDamage.lastActivation ?? null)}`,
      '',
      `walker ${walker.enabled ? walker.state ?? 'waiting' : 'DISABLED'}  id ${walker.actorInstanceId ?? '-'}  generation ${walker.respawnGeneration ?? 0}  live ${walker.liveWalkers ?? 0}`,
      `walker pos ${JSON.stringify(walker.worldPosition ?? [])}  distance ${(walker.distanceToPlayer ?? 0).toFixed(2)}m  speed ${(walker.currentSpeed ?? 0).toFixed(2)}/${(walker.desiredSpeed ?? 0).toFixed(2)}/${(walker.maximumSpeed ?? 0).toFixed(2)}`,
      `yaw ${(walker.currentYaw ?? 0).toFixed(2)} -> ${(walker.desiredYaw ?? 0).toFixed(2)}  error ${(walker.turnError ?? 0).toFixed(2)}  paused ${walker.paused ? 'YES' : 'NO'}`,
      `range ${walker.closeRangeMode ?? '-'}  minimum ${(walker.minimumPlayerDistance ?? 0).toFixed(3)}m  overlap ${(walker.playerOverlapDepth ?? 0).toFixed(3)}m  separation ${walker.separationActive ? 'ACTIVE' : 'OFF'}`,
      `player collision r=${(playerCollision.playerRadius ?? 0).toFixed(3)}  nearest ${playerCollision.nearestEnemyId ?? '-'} ${(playerCollision.nearestEnemyCenterDistance ?? 0).toFixed(3)}/${(playerCollision.requiredMinimumCenterDistance ?? 0).toFixed(3)}m  nearby ${playerCollision.nearbyBlockingActorCount ?? 0}`,
      `player move ${JSON.stringify(playerCollision.movementRequested ?? [])} -> ${JSON.stringify(playerCollision.movementAccepted ?? [])}  inward ${JSON.stringify(playerCollision.blockedInwardComponent ?? [])}  slide ${JSON.stringify(playerCollision.tangentialSlideComponent ?? [])}`,
      `recovery ${playerCollision.depenetrationActive ? 'ACTIVE' : 'OFF'}  player ${JSON.stringify(playerCollision.correctionVector ?? [])}  enemy ${JSON.stringify(playerCollision.enemyCorrectionVector ?? [])}  reason ${playerCollision.lastMovementBlockReason ?? '-'}`,
      `authored ${walker.activeAnimation ?? '-'}  walk loop ${walker.walkLooping ? 'YES' : 'NO'}`,
      `vital stabs ${walker.criticalStabCount ?? 0}/2  impaired ${walker.firstStabImpaired ? 'YES' : 'NO'}  wounds ${JSON.stringify(walker.qualifyingWoundIds ?? [])}  last ${walker.lastQualifyingRegion ?? '-'} ${(walker.lastQualifyingDepth ?? 0).toFixed(3)}m`,
      `death ${walker.deathAnimation ?? '-'}  progress ${(walker.deathProgress ?? 0).toFixed(2)}  ${walker.ragdollActive ? 'RAGDOLL ERROR' : walker.finalPoseHeld ? 'FINAL POSE HELD' : 'AUTHORED'}`,
      `owned body/collider/joint ${walker.ownedRigidBodyCount ?? 0}/${walker.ownedColliderCount ?? 0}/${walker.ownedJointCount ?? 0}  materials ${walker.materialCloneCount ?? 0}  wounds ${walker.activeWoundCount ?? 0}  subscriptions ${walker.remainingEventSubscriptions ?? 0}`,
      `routing actors/colliders ${routing.actorCount ?? 0}/${routing.colliderCount ?? 0}  disposed ${JSON.stringify(walker.lastDisposalSummary ?? null)}`,
      '',
      `director ${(director.time ?? 0).toFixed(3)}s  active ${director.activeInteractions ?? 0}  queued ${director.queuedEvents ?? 0}  pool ${director.pooledEvents ?? 0}`,
      `impact memory ${JSON.stringify(director.impactMemory ?? {})}`,
      `extraction reaction attempted ${director.extractionReactionAttempted || reaction.extractionAttemptedToTrigger ? 'YES' : 'NO'}`,
      `spacing center ${(spacing.minimumCenterDistance ?? 0).toFixed(3)}m  load ${(spacing.loadingClearance ?? 0).toFixed(3)}m  full depth ${(spacing.fullGestureDepth ?? 0).toFixed(3)}m`,
      `directed event ${JSON.stringify(director.lastEvent ?? null)}`,
      '',
      `sword ${sword.equipped ? 'EQUIPPED' : 'HOLSTERED'}  impalement ${sword.impalementState ?? 'unavailable'}  target ${sword.embeddedTargetId ?? '-'} (${sword.embeddedTargetLifeState ?? '-'})  knife-parity ${sword.depthInputMode === 'knife-parity-body-axis-projection' ? 'YES' : 'NO'}`,
      `sword depth ${(sword.penetrationDepth ?? 0).toFixed(3)}m  entry resistance ${sword.entryResistanceActive ? 'YES' : 'NO'}  extraction ${sword.extractionDetected ? 'YES' : 'NO'}  same-target suppression ${sword.sameTargetCollisionSuppressionActive ? 'YES' : 'NO'}`,
      `sword embedded tracking ${(sword.directControlTrackingErrorWhileEmbedded ?? 0).toFixed(5)}m  cleanup ${sword.lastImpalementCleanupReason ?? '-'}  cleanups ${sword.impalementCleanupCount ?? 0}`,
      '',
      `mace ${mace.maceEquipped ? 'EQUIPPED' : 'HOLSTERED'}  state ${mace.gestureState ?? 'unavailable'}  load ${((mace.loadProgress ?? 0) * 100).toFixed(1)}%`,
      `mace travel up/down ${(maceDirect.accumulatedUpwardTravel ?? 0).toFixed(4)}/${(maceDirect.accumulatedDownwardTravel ?? 0).toFixed(4)}m  speed up/down ${(maceDirect.upwardHeadSpeed ?? 0).toFixed(3)}/${(maceDirect.downwardHeadSpeed ?? 0).toFixed(3)}m/s`,
      `mace strike ${maceDirect.activeStrikeId ?? '-'}  qualified ${maceDirect.strikeQualified ? 'YES' : 'NO'}  power ${(mace.swingPower ?? 0).toFixed(3)}  resistance ${maceDirect.resistanceActive ? 'YES' : 'NO'}`,
      `mace unity pos/rot/head ${(maceDirect.positionTrackingError ?? 0).toFixed(5)}m / ${(maceDirect.rotationTrackingErrorDegrees ?? 0).toFixed(3)}deg / ${(maceDirect.visualPhysicalHeadError ?? 0).toFixed(5)}m`,
      `mace contact ${mace.primitiveThatContacted ?? '-'} / ${mace.contactClassification ?? '-'}  actor ${mace.resolvedActorId ?? '-'}  region ${mace.impactRegion ?? '-'}`,
      `mace speed ${(mace.normalImpactSpeed ?? 0).toFixed(3)}m/s  mass ${(mace.effectiveMass ?? 0).toFixed(2)}kg  impulse ${(mace.estimatedImpulse ?? 0).toFixed(2)}Ns  energy ${(mace.estimatedEnergy ?? 0).toFixed(2)}J`,
      `mace point ${JSON.stringify(mace.impactPoint ?? null)}  damage ${(mace.actorDamageApplied ?? 0).toFixed(3)}  reaction ${mace.reactionEmitted ? 'YES' : 'NO'}  collapse ${mace.collapseRequested ? 'YES' : 'NO'}`,
      `mace feedback ${mace.feedbackCount ?? 0}  rejected repeat ${mace.rejectedRepeatContactCount ?? 0}  sweep ${mace.sweepSampleCount ?? 0}/${mace.maximumSweepSampleCount ?? 0}`,
      '',
      `knife ${weapon.equipped ? 'EQUIPPED' : 'HOLSTERED'}  ${weapon.state ?? 'unavailable'}`,
      `reason ${weapon.reason ?? '-'}  intent ${weapon.intent ?? '-'} (${weapon.intentReason ?? '-'})`,
      `pos ${JSON.stringify(weapon.worldPosition ?? [])}`,
      `rot ${JSON.stringify(weapon.worldRotation ?? [])}`,
      `forward ${JSON.stringify(weapon.bladeForward ?? [])}`,
      `desired ${JSON.stringify(weapon.desiredHand ?? [])}`,
      `actual ${JSON.stringify(weapon.actualHand ?? [])}`,
      `depth ${(weapon.penetrationDepth ?? 0).toFixed(3)}m  deliberate ${JSON.stringify(weapon.deliberateInputVelocity ?? [])}`,
      `total world ${JSON.stringify(weapon.totalWorldVelocity ?? [])}  offensive ${JSON.stringify(weapon.offensiveVelocity ?? [])}`,
      `owner ${weapon.gripPointerOwner ?? '-'}  attack ${weapon.attackEnabled ? 'ENABLED' : 'SAFE'}  ${weapon.contactDamageReason ?? '-'}`,
      `visual/collision error ${(weapon.visibleCollisionError ?? 0).toFixed(5)}m`,
      `presentation ${weapon.presentationReady ? 'READY' : 'SETTLING'}  micro ${JSON.stringify(weapon.microImpact ?? null)}`,
      `tissue ${JSON.stringify(weapon.tissueResistance ?? null)}  max offset ${(weapon.maximumPresentationOffset ?? 0).toFixed(5)}m`,
      `part ${weapon.contactPart ?? '-'}  wound ${weapon.activeWoundId ?? '-'}  interaction ${weapon.activeCombatInteractionId ?? '-'}`,
      `slash ${JSON.stringify(weapon.activeSlash ?? null)}`,
      '',
      'Grip handle, then up: thrust | down: withdraw | side: slash',
      'Release: safe spring return | J head | K left forearm | L right forearm',
    ].join('\n');
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.panel?.remove();
  }
}

function formatRgb(rgb) {
  return `[${(rgb?.[0] ?? 0).toFixed(3)},${(rgb?.[1] ?? 0).toFixed(3)},${(rgb?.[2] ?? 0).toFixed(3)}]`;
}

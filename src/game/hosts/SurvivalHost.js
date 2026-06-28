export class SurvivalHost {
  constructor({ gameState, hudHost = null, saveHost = null, sceneSessionHost = null, inventoryBridge = null, progressionHost = null } = {}) {
    this.gameState = gameState;
    this.hudHost = hudHost;
    this.saveHost = saveHost;
    this.sceneSessionHost = sceneSessionHost;
    this.inventoryBridge = inventoryBridge;
    this.progressionHost = progressionHost;
    this.session = null;
  }

  initializeForSession(session = this.sceneSessionHost) {
    this.session = session;
    this.syncHud();
  }

  update(deltaSeconds, { paused = false, equipmentPanelOpen = false, isPlayerDead = false } = {}) {
    const hunger = this.gameState?.updateHunger?.(deltaSeconds, {
      paused: paused || equipmentPanelOpen || isPlayerDead,
      applyStarvationDamage: (amount) => this.applyStarvationDamage(amount),
    });
    if (hunger) this.syncHud(hunger);
    return hunger;
  }

  applyStarvationDamage(amount) {
    
  }

  syncHud(hunger = this.getHungerSnapshot()) {
    if (!hunger) return;
    this.hudHost?.updateVitals?.({ hunger });
  }

  saveSnapshot() {
    this.saveHost?.saveSurvivalState?.(this.gameState);
  }

  getHungerSnapshot() {
    const snapshot = this.gameState?.getFieldSurvivalSnapshot?.();
    if (!snapshot) return null;
    return {
      hungerSecondsRemaining: snapshot.hungerSecondsRemaining,
      hungerMaxSeconds: snapshot.hungerMaxSeconds,
    };
  }

  acquireSurvivalItem(itemId, metadata = {}) {
    const acquired = this.inventoryBridge?.isSurvivalItem?.(itemId)
      ? this.inventoryBridge.acquireItem(itemId, metadata)
      : this.gameState?.addFieldItem?.(itemId, metadata.amount ?? 1, metadata);
    if (acquired) this.saveSnapshot();
    return Boolean(acquired);
  }

  consumeFieldItems(cost = {}) {
    const consumed = this.gameState?.consumeFieldItems?.(cost) ?? false;
    if (consumed) this.saveSnapshot();
    return consumed;
  }

  handleFoodConsumed(itemId = this.gameState?.getEquippedFieldItem?.(), context = {}) {
    if (itemId !== 'cooked_fish') return false;
    return this.eatCookedFish(context);
  }

  eatCookedFish() {
    const eaten = this.gameState?.eatCookedFish?.() ?? false;
    if (eaten) {
      this.syncHud();
      this.saveSnapshot();
    }
    return eaten;
  }

  handleCookedFishCollected(interaction = {}, context = {}) {
    const metadata = {
      source: interaction.id ?? interaction.pickup?.id,
      tags: ['field-survival', 'cooked-fish'],
      fishSizeGroup: interaction.fishSizeGroup ?? interaction.pickup?.fishSizeGroup,
      hungerSeconds: interaction.hungerSeconds ?? interaction.pickup?.hungerSeconds,
      ...context,
    };
    return this.acquireSurvivalItem('cooked_fish', metadata);
  }

  handleRawFishCollected(interaction = {}, context = {}) {
    const metadata = {
      source: interaction.id ?? interaction.pickup?.id,
      tags: ['field-survival', 'raw-fish'],
      fishSizeGroup: interaction.fishSizeGroup ?? interaction.pickup?.fishSizeGroup,
      hungerSeconds: interaction.hungerSeconds ?? interaction.pickup?.hungerSeconds,
      ...context,
    };
    return this.acquireSurvivalItem('raw_fish', metadata);
  }

  handleCampfireBuilt(position) {
    const campfire = this.gameState?.markFieldCampfireBuilt?.(position);
    if (campfire) this.saveSnapshot();
    return campfire;
  }

  handleCampfireCooked({ target = null } = {}) {
    const fishMeta = this.gameState?.peekFishStackMetadata?.('raw_fish') ?? { fishSizeGroup: 'medium', hungerSeconds: 10 * 60 };
    if (!this.consumeFieldItems({ raw_fish: 1 })) return null;
    return { ...fishMeta, target };
  }

  dispose() {
    this.session = null;
  }
}

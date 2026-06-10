export class EquipmentInventory {
  constructor(initialItemIds = []) {
    this.items = new Map();
    initialItemIds.forEach((itemId) => this.acquire(itemId));
  }

  acquire(itemId, metadata = {}) {
    if (!itemId) return null;

    const existing = this.items.get(itemId);
    if (existing) {
      existing.quantity += metadata.quantity ?? 1;
      return existing;
    }

    const item = {
      id: itemId,
      quantity: metadata.quantity ?? 1,
      acquiredAt: metadata.acquiredAt ?? Date.now(),
      tags: [...(metadata.tags ?? [])],
    };
    this.items.set(itemId, item);
    return item;
  }

  has(itemId) {
    return this.items.has(itemId);
  }

  list() {
    return [...this.items.values()].map((item) => ({ ...item, tags: [...item.tags] }));
  }

  load(itemIds = []) {
    this.items.clear();
    itemIds.forEach((itemId) => this.acquire(itemId, { acquiredAt: null }));
  }
}

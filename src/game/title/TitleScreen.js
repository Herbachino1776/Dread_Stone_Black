import { TitleAmbience } from '../audio/TitleAmbience.js';

const MENU_ITEMS = Object.freeze(['new', 'continue']);
const CONFIRM_CODES = new Set(['Enter', 'Space', 'NumpadEnter', 'KeyA', 'Gamepad0']);

export class TitleScreen {
  constructor({ storage = window.localStorage, ambience = new TitleAmbience() } = {}) {
    this.storage = storage;
    this.ambience = ambience;
    this.stage = 'boot';
    this.selectedIndex = 0;
    this.disposers = [];
    this.hasSave = this.detectExistingSave();
    this.resolveChoice = null;
    this.root = this.createRoot();
    document.body.append(this.root);
    this.bindEvents();
  }

  waitForSelection() {
    return new Promise((resolve) => {
      this.resolveChoice = resolve;
    });
  }

  createRoot() {
    const root = document.createElement('section');
    root.className = 'title-screen title-screen--boot';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
      <div class="title-screen__panel" data-title-panel>
        <p class="title-screen__eyebrow">DREAD STONE BLACK</p>
        <h1 class="title-screen__logo">DREAD STONE BLACK</h1>
        <p class="title-screen__wake" data-wake-text>Tap / Click to Wake</p>
        <nav class="title-screen__menu" data-menu aria-label="Start menu" hidden>
          <button class="title-screen__button" type="button" data-title-action="new">New Game</button>
          <button class="title-screen__button" type="button" data-title-action="continue">Continue</button>
        </nav>
      </div>
    `;
    this.menu = root.querySelector('[data-menu]');
    this.wakeText = root.querySelector('[data-wake-text]');
    this.buttons = MENU_ITEMS.map((id) => root.querySelector(`[data-title-action="${id}"]`));
    this.updateMenuState();
    return root;
  }

  bindEvents() {
    const onPointerDown = (event) => {
      event.preventDefault();
      if (this.stage === 'boot') {
        this.wake();
        return;
      }
      const action = event.target?.closest?.('[data-title-action]')?.dataset?.titleAction;
      if (action) this.confirm(action);
    };
    const onKeyDown = (event) => {
      if (this.stage === 'boot' && this.isConfirmKey(event)) {
        event.preventDefault();
        this.wake();
        return;
      }
      if (this.stage !== 'menu') return;
      if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        this.moveSelection(-1);
      } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        event.preventDefault();
        this.moveSelection(1);
      } else if (this.isConfirmKey(event)) {
        event.preventDefault();
        this.confirm(MENU_ITEMS[this.selectedIndex]);
      }
    };
    this.root.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.root.removeEventListener('pointerdown', onPointerDown));
    this.disposers.push(() => window.removeEventListener('keydown', onKeyDown));
  }

  async wake() {
    if (this.stage !== 'boot') return;
    this.stage = 'waking';
    this.wakeText.textContent = 'Waking...';
    await this.ambience.unlockAndPlay();
    this.showMenu();
  }

  showMenu() {
    this.stage = 'menu';
    this.root.classList.remove('title-screen--boot');
    this.root.classList.add('title-screen--menu');
    this.wakeText.hidden = true;
    this.menu.hidden = false;
    this.selectedIndex = 0;
    this.updateMenuState();
    this.buttons[this.selectedIndex]?.focus?.({ preventScroll: true });
  }

  moveSelection(direction) {
    let next = this.selectedIndex;
    do {
      next = (next + direction + MENU_ITEMS.length) % MENU_ITEMS.length;
    } while (MENU_ITEMS[next] === 'continue' && !this.hasSave && next !== this.selectedIndex);
    this.selectedIndex = next;
    this.updateMenuState();
    this.buttons[this.selectedIndex]?.focus?.({ preventScroll: true });
  }

  confirm(action) {
    if (this.stage !== 'menu') return;
    if (action === 'continue' && !this.hasSave) return;
    this.stage = 'starting';
    this.root.classList.add('title-screen--starting');
    this.resolveChoice?.({ action });
  }

  updateMenuState() {
    this.buttons.forEach((button, index) => {
      if (!button) return;
      const action = MENU_ITEMS[index];
      const disabled = action === 'continue' && !this.hasSave;
      button.disabled = disabled;
      button.classList.toggle('is-selected', index === this.selectedIndex);
      button.setAttribute('aria-current', index === this.selectedIndex ? 'true' : 'false');
    });
  }

  isConfirmKey(event) {
    return CONFIRM_CODES.has(event.code);
  }

  detectExistingSave() {
    try {
      for (let index = 0; index < this.storage.length; index += 1) {
        if (this.storage.key(index)?.startsWith('dreadStoneBlack.')) return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.root?.remove();
  }
}

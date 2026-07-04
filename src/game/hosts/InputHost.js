import { MobileControls } from '../MobileControls.js';

export class InputHost {
  constructor({ root }) {
    this.root = root;
    this.controls = new MobileControls(root);
    this.disposers = [];
    this.preventMobilePageGestures();
    this.bindDesktopAttack();
  }

  bindDesktopAttack() {
    const queueAttack = (event) => {
      if (event.code !== 'Space' || event.repeat) return;
      event.preventDefault();
      this.controls.queueAttack();
    };
    window.addEventListener('keydown', queueAttack);
    this.disposers.push(() => window.removeEventListener('keydown', queueAttack));
  }

  preventMobilePageGestures() {
    // CSS handles most cases; this catches iOS Safari's page drag on the document.
    const preventDefault = (event) => event.preventDefault();
    document.addEventListener('touchmove', preventDefault, { passive: false });
    document.addEventListener('contextmenu', preventDefault);
    this.disposers.push(() => document.removeEventListener('touchmove', preventDefault));
    this.disposers.push(() => document.removeEventListener('contextmenu', preventDefault));
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.controls?.dispose?.();
  }
}

import { MobileControls } from '../MobileControls.js';

export class InputHost {
  constructor({ root }) {
    this.root = root;
    this.controls = new MobileControls(root);
    this.preventMobilePageGestures();
  }

  preventMobilePageGestures() {
    // CSS handles most cases; this catches iOS Safari's page drag on the document.
    document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', (event) => event.preventDefault());
  }
}

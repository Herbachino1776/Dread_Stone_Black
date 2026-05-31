export class Hud {
  constructor(root) {
    this.root = root;
    this.messageEl = root.querySelector('[data-hud="message"]');
    this.timeoutId = null;
  }

  showMessage(message) {
    this.messageEl.textContent = message;
    window.clearTimeout(this.timeoutId);
    this.timeoutId = window.setTimeout(() => {
      this.messageEl.textContent = 'The air is cold and still.';
    }, 3200);
  }
}

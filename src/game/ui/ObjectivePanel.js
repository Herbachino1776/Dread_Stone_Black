export class ObjectivePanel {
  constructor({ root, objectiveRuntime, enabled = false }) {
    this.root = root;
    this.objectiveRuntime = objectiveRuntime;
    this.enabled = enabled;
    this.viewport = root.querySelector('[data-game="viewport"]');
    this.toastTimer = null;
    this.isExpanded = false;

    if (!this.enabled) return;
    this.mount();
    this.bindEvents();
    this.render();
  }

  mount() {
    if (!this.viewport) return;
    this.toast = document.createElement('div');
    this.toast.className = 'objective-toast';
    this.toast.setAttribute('aria-live', 'polite');
    this.toast.dataset.objectiveToast = 'true';

    this.panel = document.createElement('section');
    this.panel.className = 'objective-panel';
    this.panel.dataset.objectivePanel = 'true';
    this.panel.setAttribute('aria-label', 'Active objective');
    this.panel.innerHTML = `
      <button class="objective-panel__toggle" type="button" aria-expanded="false" data-objective-toggle>
        <span data-objective-title></span>
        <span data-objective-step></span>
      </button>
      <div class="objective-panel__body" data-objective-body hidden></div>
    `;
    this.titleEl = this.panel.querySelector('[data-objective-title]');
    this.stepEl = this.panel.querySelector('[data-objective-step]');
    this.bodyEl = this.panel.querySelector('[data-objective-body]');
    this.toggleButton = this.panel.querySelector('[data-objective-toggle]');

    this.viewport.append(this.toast, this.panel);
  }

  bindEvents() {
    this.toggleButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.toggle();
    });
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'KeyO') return;
      event.preventDefault();
      this.toggle();
    });
    this.objectiveRuntime.on('objectiveChanged', () => this.render());
  }

  showToast(message) {
    if (!this.toast || !message) return;
    window.clearTimeout(this.toastTimer);
    this.toast.textContent = message;
    this.toast.classList.add('is-visible');
    this.toastTimer = window.setTimeout(() => {
      this.toast?.classList.remove('is-visible');
    }, 2700);
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
    this.panel?.classList.toggle('is-expanded', this.isExpanded);
    this.toggleButton?.setAttribute('aria-expanded', String(this.isExpanded));
    if (this.bodyEl) this.bodyEl.hidden = !this.isExpanded;
    this.render();
  }

  render() {
    if (!this.panel || !this.titleEl || !this.stepEl || !this.bodyEl) return;
    const activeObjectives = this.objectiveRuntime.getActiveObjectives();
    const current = activeObjectives[0] ?? null;
    this.panel.classList.toggle('has-objective', Boolean(current));

    if (!current) {
      this.titleEl.textContent = '';
      this.stepEl.textContent = '';
      this.bodyEl.innerHTML = '';
      return;
    }

    const activeStep = current.steps.find((step) => step.state === 'active');
    this.titleEl.textContent = current.title;
    this.stepEl.textContent = activeStep?.shortText ?? current.shortText ?? '';

    this.bodyEl.innerHTML = '';
    current.steps.forEach((step) => {
      const row = document.createElement('p');
      row.className = `objective-panel__step objective-panel__step--${step.state}`;
      row.textContent = `${step.state === 'complete' ? 'Done' : 'Now'}: ${step.shortText ?? step.title}`;
      this.bodyEl.append(row);
    });
  }
}

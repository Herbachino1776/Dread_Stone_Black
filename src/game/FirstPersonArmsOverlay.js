const DEFAULT_LAYER = 'arms';

export const ARM_OVERLAY_ASSETS = {
  unarmedIdle: {
    id: 'unarmed.idle',
    layer: DEFAULT_LAYER,
    src: `${import.meta.env.BASE_URL}assets/player/arms/arms_base_idle_strip_01.png`,
    frameCount: 6,
    frameWidth: 1024,
    frameHeight: 1024,
    fps: 7,
    loop: true,
  },
};

export class FirstPersonArmsOverlay {
  constructor(root) {
    this.root = root;
    this.layers = new Map();
    this.currentClip = null;
    this.elapsedSeconds = 0;
    this.currentFrame = -1;

    this.registerLayer(DEFAULT_LAYER, root.querySelector('[data-arms-layer="base"]'));
    this.play(ARM_OVERLAY_ASSETS.unarmedIdle);
  }

  registerLayer(name, element) {
    if (!element) return;

    this.layers.set(name, element);
  }

  play(clip) {
    const layer = this.layers.get(clip.layer || DEFAULT_LAYER);
    if (!layer) return;

    this.currentClip = clip;
    this.elapsedSeconds = 0;
    this.currentFrame = -1;

    layer.style.setProperty('--arms-strip-url', `url("${clip.src}")`);
    layer.style.setProperty('--arms-frame-width', `${clip.frameWidth}px`);
    layer.style.setProperty('--arms-frame-height', `${clip.frameHeight}px`);
    layer.style.setProperty('--arms-frame-aspect', `${clip.frameWidth} / ${clip.frameHeight}`);
    layer.style.setProperty('--arms-frame-count', clip.frameCount);
    layer.style.setProperty('--arms-strip-width', `${clip.frameCount * 100}%`);
    layer.classList.add('is-visible');
    this.renderFrame(0);
  }

  update(deltaSeconds) {
    if (!this.currentClip) return;

    this.elapsedSeconds += deltaSeconds;
    const { frameCount, fps, loop } = this.currentClip;
    const rawFrame = Math.floor(this.elapsedSeconds * fps);
    const frame = loop ? rawFrame % frameCount : Math.min(rawFrame, frameCount - 1);

    this.renderFrame(frame);
  }

  renderFrame(frame) {
    if (!this.currentClip || frame === this.currentFrame) return;

    const layer = this.layers.get(this.currentClip.layer || DEFAULT_LAYER);
    if (!layer) return;

    this.currentFrame = frame;
    const maxFrame = Math.max(1, this.currentClip.frameCount - 1);
    layer.style.setProperty('--arms-frame-index', frame);
    layer.style.setProperty('--arms-frame-position', `${(frame / maxFrame) * 100}%`);
  }
}

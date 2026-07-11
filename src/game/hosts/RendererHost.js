import * as THREE from 'three';

export class RendererHost {
  constructor({ root, shellHtml = null }) {
    this.root = root;
    if (shellHtml !== null) this.root.innerHTML = shellHtml;
    this.canvas = this.root.querySelector('#game-canvas');
    this.viewport = this.root.querySelector('[data-game="viewport"]');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.outdoorQualityTier = this.renderer.capabilities.maxTextureSize >= 8192 && this.getViewportSize().width >= 900 ? 'desktop-high' : 'mobile-balanced';
    this.defaultToneMappingExposure = this.renderer.toneMappingExposure;
    this.resizeCallbacks = new Set();
    this.resize = this.resize.bind(this);
    this.handleOrientationChange = this.handleOrientationChange.bind(this);

    const { width, height } = this.getViewportSize();
    this.renderer.setSize(width, height, false);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.handleOrientationChange);
    this.viewportResizeObserver = new ResizeObserver(this.resize);
    if (this.viewport) this.viewportResizeObserver.observe(this.viewport);
  }

  getViewportSize() {
    const rect = this.viewport?.getBoundingClientRect?.();
    return {
      width: Math.max(1, Math.floor(rect?.width || window.innerWidth)),
      height: Math.max(1, Math.floor(rect?.height || window.innerHeight)),
    };
  }

  onResize(callback) {
    this.resizeCallbacks.add(callback);
    return () => this.resizeCallbacks.delete(callback);
  }

  resize() {
    const size = this.getViewportSize();
    this.renderer.setSize(size.width, size.height, false);
    this.resizeCallbacks.forEach((callback) => callback(size));
  }

  handleOrientationChange() {
    window.setTimeout(this.resize, 250);
  }

  setAnimationLoop(callback) {
    this.renderer.setAnimationLoop(callback);
  }

  render(scene, camera, { viewmodelLayer = 1 } = {}) {
    if (!scene || !camera) return;

    const previousMask = camera.layers.mask;
    try {
      camera.layers.set(0);
      this.renderer.render(scene, camera);
    } finally {
      camera.layers.mask = previousMask;
    }

    this.renderViewmodelOverlay(scene, camera, viewmodelLayer);
  }

  applySceneExposure(dungeon) {
    const target = dungeon?.outdoorLightingDirector?.exposure ?? this.defaultToneMappingExposure;
    this.renderer.toneMappingExposure = target;
  }

  renderViewmodelOverlay(scene, camera, layer = 1) {
    if (!scene || !camera) return;

    const previousAutoClear = this.renderer.autoClear;
    const previousMask = camera.layers.mask;
    const previousBackground = scene.background;
    const previousFog = scene.fog;

    try {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      scene.background = null;
      scene.fog = null;
      camera.layers.set(layer);
      this.renderer.render(scene, camera);
    } finally {
      this.renderer.autoClear = previousAutoClear;
      camera.layers.mask = previousMask;
      scene.background = previousBackground;
      scene.fog = previousFog;
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.handleOrientationChange);
    this.viewportResizeObserver?.disconnect();
    this.resizeCallbacks.clear();
    this.renderer.dispose();
  }
}

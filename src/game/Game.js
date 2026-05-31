import * as THREE from 'three';
import { DungeonScene } from './DungeonScene.js';
import { Hud } from './Hud.js';
import { Interactions } from './Interactions.js';
import { MobileControls } from './MobileControls.js';
import { PlayerController } from './PlayerController.js';

export class Game {
  constructor(app) {
    this.app = app;
    this.clock = new THREE.Clock();
    this.lastFrame = 0;
  }

  start() {
    this.app.innerHTML = this.renderShell();

    this.canvas = this.app.querySelector('#game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 28);
    this.dungeon = new DungeonScene();
    this.scene = this.dungeon.build();
    this.player = new PlayerController(this.camera, this.dungeon.collision);
    this.hud = new Hud(this.app);
    this.controls = new MobileControls(this.app);
    this.interactions = new Interactions({ player: this.player, dungeon: this.dungeon, hud: this.hud });

    this.preventMobilePageGestures();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 250));

    this.renderer.setAnimationLoop((time) => this.update(time));
  }

  renderShell() {
    return `
      <canvas id="game-canvas" aria-label="Dread Stone Black game view"></canvas>
      <div class="game-overlay" aria-label="Game HUD and touch controls">
        <section class="hud-panel" aria-label="Player status">
          <div class="stat"><span>HP</span><strong>100</strong></div>
          <div class="stat"><span>MP</span><strong>24</strong></div>
          <div class="stat"><span>POWER</span><strong>10</strong></div>
          <div class="stat"><span>MAGIC</span><strong>3</strong></div>
        </section>
        <p class="message-box" data-hud="message">The air is cold and still.</p>
        <p class="debug-readout" data-hud="debug" aria-label="Debug player position">POS 0.0, 0.0 · YAW 0°</p>
        <div class="control-zones">
          <div class="move-zone" data-control="move" aria-label="Move">
            <div class="move-ring"><div class="move-knob" data-control="move-knob"></div></div>
            <span>MOVE</span>
          </div>
          <div class="look-zone" data-control="look" aria-label="Turn view">
            <span>DRAG TO TURN</span>
          </div>
          <button class="interact-button" data-action="interact" type="button">INTERACT</button>
        </div>
        <div class="sword-placeholder" aria-hidden="true"></div>
      </div>
    `;
  }

  update() {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    this.player.update(deltaSeconds, this.controls);

    if (this.controls.consumeInteract()) {
      this.interactions.interact();
    }

    this.hud.updateDebug(this.player);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  preventMobilePageGestures() {
    // CSS handles most cases; this catches iOS Safari's page drag on the document.
    document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', (event) => event.preventDefault());
  }
}

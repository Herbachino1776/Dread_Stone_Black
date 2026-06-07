import * as THREE from 'three';
import { Combat } from './Combat.js';
import { DungeonScene } from './DungeonScene.js';
import { FirstPersonArmsOverlay } from './FirstPersonArmsOverlay.js';
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
    this.viewport = this.app.querySelector('[data-game="viewport"]');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const { width, height } = this.getViewportSize();
    this.renderer.setSize(width, height, false);

    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 260);
    const requestedArea = new URLSearchParams(window.location.search).get('area');
    this.dungeon = new DungeonScene({ area: requestedArea === 'dungeon' ? 'dungeon' : 'field' });
    this.scene = this.dungeon.build();
    this.player = new PlayerController(this.camera, this.dungeon.collision, this.dungeon.playerSpawn);
    this.hud = new Hud(this.app);
    this.armsOverlay = new FirstPersonArmsOverlay(this.app);
    this.controls = new MobileControls(this.app);
    this.interactions = new Interactions({ player: this.player, dungeon: this.dungeon, hud: this.hud });
    this.combat = new Combat({ player: this.player, dungeon: this.dungeon, hud: this.hud, controls: this.controls });

    this.preventMobilePageGestures();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 250));
    this.viewportResizeObserver = new ResizeObserver(() => this.resize());
    this.viewportResizeObserver.observe(this.viewport);

    this.renderer.setAnimationLoop((time) => this.update(time));
  }

  renderShell() {
    return `
      <main class="reliquary-shell" aria-label="Dread Stone Black handheld reliquary interface">
        <section class="top-stat-row" aria-label="Player status">
          <div class="stat stat-hp"><span>HP</span><strong data-stat="hp">100</strong></div>
          <div class="stat stat-mp"><span>MP</span><strong>24</strong></div>
          <div class="stat stat-power"><span>POWER</span><strong data-stat="power">10</strong></div>
          <div class="stat stat-magic"><span>MAGIC</span><strong>3</strong></div>
        </section>

        <section class="viewport-frame" aria-label="Framed game viewport">
          <div class="viewport-ornament viewport-ornament-top" aria-hidden="true">✦</div>
          <div class="viewport-stage" data-game="viewport">
            <canvas id="game-canvas" aria-label="Dread Stone Black game view"></canvas>
            <p class="interaction-hint" data-hud="hint" aria-live="polite"></p>
            <div class="first-person-arms" data-arms-overlay aria-hidden="true">
              <div class="first-person-arms__layer" data-arms-layer="base"></div>
            </div>
            <div class="damage-flash" data-hud="damage" aria-hidden="true"></div>
          </div>
          <div class="viewport-ornament viewport-ornament-bottom" aria-hidden="true">◆</div>
        </section>

        <section class="control-deck" aria-label="Touch controls">
          <div class="deck-engraving" aria-hidden="true"></div>
          <div class="stick-zone move-zone" data-control="move" aria-label="Move">
            <div class="stick-ring">
              <div class="stick-cardinal stick-cardinal-up">▲</div>
              <div class="stick-cardinal stick-cardinal-down">▼</div>
              <div class="stick-knob" data-control="move-knob"></div>
            </div>
            <span>MOVE</span>
          </div>

          <div class="action-cluster" aria-label="Action buttons">
            <button class="interact-button action-button" data-action="interact" type="button" aria-label="Interact">X</button>
            <button class="attack-button action-button" data-action="attack" type="button" aria-label="Attack">A</button>
          </div>

          <div class="stick-zone look-zone" data-control="look" aria-label="Look">
            <div class="stick-ring">
              <div class="stick-cardinal stick-cardinal-left">◀</div>
              <div class="stick-cardinal stick-cardinal-right">▶</div>
              <div class="stick-knob" data-control="look-knob"></div>
            </div>
            <span>LOOK</span>
          </div>
        </section>

        <p class="debug-readout" data-hud="debug" aria-label="Debug player position">POS 0.0, 0.0 · YAW 0° · PITCH 0°</p>
      </main>
    `;
  }

  update() {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    if (!this.combat.isPlayerDead) {
      this.player.update(deltaSeconds, this.controls);
    }
    this.dungeon.update(deltaSeconds);
    this.combat.update(deltaSeconds);
    this.armsOverlay.update(deltaSeconds);
    this.interactions.updateHint();

    if (this.controls.consumeInteract()) {
      this.interactions.interact();
    }

    this.hud.updateDebug(this.player);
    this.renderer.render(this.scene, this.camera);
  }

  getViewportSize() {
    const rect = this.viewport.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width || window.innerWidth)),
      height: Math.max(1, Math.floor(rect.height || window.innerHeight)),
    };
  }

  resize() {
    if (!this.viewport || !this.renderer || !this.camera) return;

    const { width, height } = this.getViewportSize();
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

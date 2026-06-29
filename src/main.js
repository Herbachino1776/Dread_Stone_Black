import './styles/base.css';
import './styles/hud.css';
import './styles/controls.css';
import { Game } from './game/Game.js';
import { SaveHost } from './game/hosts/SaveHost.js';
import { TitleScreen } from './game/title/TitleScreen.js';

const app = document.querySelector('#app');
const titleScreen = new TitleScreen();
const selection = await titleScreen.waitForSelection();

if (selection.action === 'new') {
  new SaveHost().resetAllProgress();
}

const game = new Game(app);
const startupSucceeded = await game.start();

if (startupSucceeded) {
  titleScreen.dispose();
} else {
  titleScreen.showStartupError();
}

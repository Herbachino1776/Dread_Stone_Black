import './styles/base.css';
import './styles/hud.css';
import './styles/controls.css';
import { Game } from './game/Game.js';

const app = document.querySelector('#app');
const game = new Game(app);

game.start();

import './styles/base.css';
import './styles/ui-foundation.css';
import './styles/hud.css';
import './styles/controls.css';

const app = document.querySelector('#app');

try {
  const [{ Game }, { SaveHost }, { TitleScreen }] = await Promise.all([
    import('./game/Game.js'),
    import('./game/hosts/SaveHost.js'),
    import('./game/title/TitleScreen.js'),
  ]);
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
} catch (error) {
  console.error('[Dread Stone Black] Bootstrap failed before the title screen could start.', error);
  showBootstrapError(error);
}

function showBootstrapError(error) {
  document.querySelector('[data-bootstrap-fatal-overlay]')?.remove();
  const overlay = document.createElement('section');
  overlay.dataset.bootstrapFatalOverlay = 'true';
  overlay.setAttribute('role', 'alert');
  overlay.setAttribute('aria-live', 'assertive');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:24px;background:#080202;color:#ffe0cf;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;';
  const message = document.createElement('pre');
  message.style.cssText = 'width:min(100%,720px);max-height:88vh;overflow:auto;margin:0;padding:16px;border:1px solid #b86b42;background:#260805;white-space:pre-wrap;user-select:text;-webkit-user-select:text;';
  message.textContent = `Dread Stone Black could not start.\n\n${error?.message ?? error ?? 'Unknown bootstrap error'}${error?.stack ? `\n\n${error.stack}` : ''}`;
  overlay.append(message);
  document.body.append(overlay);
}

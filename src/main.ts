import './styles/main.css';
import { Engine } from './core/Engine';
import { InputManager } from './core/InputManager';
import { MatchController } from './simulation/MatchController';
import { UIManager } from './ui/UIManager';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const worldPopups = document.getElementById('world-popups') as HTMLElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;
const splash = document.getElementById('loading-splash');

const engine = new Engine(canvas);
const match = new MatchController(engine, worldPopups);
const input = new InputManager(match, canvas);
const ui = new UIManager(uiRoot, match, input);

// §19 Warm up shaders cleanly before dismissing Seed-to-Sprout splash
engine.warmUpShaders();
if (splash) {
  splash.style.opacity = '0';
  setTimeout(() => splash.remove(), 350);
}

let lastTime = performance.now();

function loop(now: number): void {
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;

  match.update(rawDt);
  ui.update(Math.min(0.05, rawDt));

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

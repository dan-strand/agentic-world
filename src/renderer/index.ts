import { World } from './world';
import { GameLoop } from './game-loop';
import { SessionInfo } from '../shared/types';

async function main(): Promise<void> {
  console.log('[renderer] main() starting...');

  // 1. Init PixiJS world
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    throw new Error('#app container not found');
  }

  console.log('[renderer] Creating World...');
  const world = new World();
  await world.init(appContainer);
  console.log('[renderer] World initialized');

  // 2. Init adaptive game loop
  const gameLoop = new GameLoop(world.getApp(), world);
  gameLoop.start();
  console.log('[renderer] GameLoop started');

  // 3. Wire IPC -> visuals
  window.agentWorld.onSessionsUpdate((sessions: SessionInfo[]) => {
    world.updateSessions(sessions);
    gameLoop.onSessionsUpdate(sessions);
  });

  // 4. Load initial sessions
  const initialSessions = await window.agentWorld.getInitialSessions();
  console.log('[renderer] Initial sessions:', initialSessions.length);
  world.updateSessions(initialSessions);
  gameLoop.onSessionsUpdate(initialSessions);

  // 5. Handle window resize
  window.addEventListener('resize', () => {
    world.resize();
  });

  // 6. Handle minimize/restore for adaptive frame rate
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      gameLoop.onWindowMinimized();
    } else {
      gameLoop.onWindowRestored();
    }
  });

  console.log('[renderer] Agent World initialized');
}

main().catch(err => {
  console.error('[renderer] Failed to initialize Agent World:', err);
  // Show error visually in the DOM so it's visible without DevTools
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'color:red;padding:20px;font-family:monospace;white-space:pre-wrap;';
  errDiv.textContent = `Init Error: ${err?.message || err}\n\n${err?.stack || ''}`;
  document.body.appendChild(errDiv);
});

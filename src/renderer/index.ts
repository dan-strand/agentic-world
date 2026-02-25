import { World } from './world';
import { GameLoop } from './game-loop';
import { SessionInfo } from '../shared/types';

async function main(): Promise<void> {
  // 1. Init PixiJS world
  const appContainer = document.getElementById('app')!;
  const world = new World();
  await world.init(appContainer);

  // 2. Init adaptive game loop
  const gameLoop = new GameLoop(world.getApp(), world);
  gameLoop.start();

  // 3. Wire IPC -> visuals
  window.agentWorld.onSessionsUpdate((sessions: SessionInfo[]) => {
    world.updateSessions(sessions);
    gameLoop.onSessionsUpdate(sessions);
  });

  // 4. Load initial sessions
  const initialSessions = await window.agentWorld.getInitialSessions();
  world.updateSessions(initialSessions);
  gameLoop.onSessionsUpdate(initialSessions);

  // 5. Handle window resize
  window.addEventListener('resize', () => {
    world.resize();
  });

  // 6. Handle minimize/restore for adaptive frame rate
  // document.visibilitychange is reliable for minimize detection in Electron
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      gameLoop.onWindowMinimized();
    } else {
      gameLoop.onWindowRestored();
    }
  });

  console.log('Agent World initialized');
}

main().catch(err => {
  console.error('Failed to initialize Agent World:', err);
});

import { TextureStyle } from 'pixi.js';

// CRITICAL: Must be set before ANY texture creation or Assets.load()
// This ensures all pixel art renders crisp at any scale
TextureStyle.defaultOptions.scaleMode = 'nearest';

import { World } from './world';
import { GameLoop } from './game-loop';
import { SessionInfo } from '../shared/types';
import { installPixelFont } from './bitmap-font';
import { initActivityIcons } from './activity-icons';
import { loadAllAssets } from './asset-loader';
import { SoundManager } from './sound-manager';
import { DashboardPanel } from './dashboard-panel';

async function main(): Promise<void> {
  // Wire window control buttons
  document.getElementById('btn-minimize')?.addEventListener('click', () => window.agentWorld.minimizeWindow());
  document.getElementById('btn-close')?.addEventListener('click', () => window.agentWorld.closeWindow());

  // Wire window dragging
  const dragRegion = document.getElementById('drag-region');
  if (dragRegion) {
    dragRegion.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).classList.contains('window-btn')) return;
      window.agentWorld.startDrag();
    });
    window.addEventListener('mouseup', () => window.agentWorld.endDrag());
  }

  console.log('[renderer] main() starting...');

  // 1. Init PixiJS world
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    throw new Error('#app container not found');
  }
  // Load sprite atlases (tiles, future: characters, buildings)
  await loadAllAssets();
  console.log('[renderer] Assets loaded');

  // Initialize sprite systems before world init (required for BitmapText, Agent, SpeechBubble)
  installPixelFont();
  initActivityIcons();
  console.log('[renderer] Fonts and icons initialized');

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

  // 5. Handle minimize/restore for adaptive frame rate (window is fixed-size, no resize handler needed)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      gameLoop.onWindowMinimized();
    } else {
      gameLoop.onWindowRestored();
    }
  });

  // 6. Wire audio controls
  const soundManager = SoundManager.getInstance();
  const muteBtn = document.getElementById('btn-mute');
  const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement | null;

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      soundManager.toggleMute();
      muteBtn.innerHTML = soundManager.muted ? '&#x1F507;' : '&#x1F50A;';
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      soundManager.volume = parseInt(volumeSlider.value, 10) / 100;
    });
  }

  // 7. Init dashboard panel
  const dashboardEl = document.getElementById('dashboard');
  if (dashboardEl) {
    const dashboardPanel = new DashboardPanel(dashboardEl);

    window.agentWorld.onDashboardUpdate((data) => {
      dashboardPanel.update(data);
    });

    // Load historical data once at startup
    window.agentWorld.getHistory().then((history) => {
      dashboardPanel.updateHistory(history);
      console.log('[renderer] History loaded:', history.length, 'days');
    }).catch((err) => {
      console.warn('[renderer] Failed to load history:', err);
    });

    console.log('[renderer] Dashboard panel initialized');
  }

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

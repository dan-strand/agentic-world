import { Application } from 'pixi.js';
import { SessionInfo } from '../shared/types';
import { FPS_ACTIVE, FPS_IDLE } from '../shared/constants';
import { World } from './world';

/**
 * GameLoop -- Adaptive ticker management.
 * 30fps when sessions are active, 5fps when all idle, stopped when minimized.
 * Critical for always-on viability: under 2% CPU when idle, near 0% when minimized.
 */
export class GameLoop {
  private app: Application;
  private world: World;
  private isIdle = true;
  private isMinimized = false;
  private tickerCallback: ((ticker: { deltaMS: number }) => void) | null = null;

  constructor(app: Application, world: World) {
    this.app = app;
    this.world = world;
  }

  start(): void {
    // Start conservatively at idle FPS
    this.app.ticker.maxFPS = FPS_IDLE;

    this.tickerCallback = (ticker: { deltaMS: number }) => {
      this.world.tick(ticker.deltaMS);
    };
    this.app.ticker.add(this.tickerCallback);
    this.app.ticker.start();
  }

  /**
   * Adjust frame rate based on session activity.
   * Active sessions -> 30fps, all idle -> 5fps, no sessions -> stop ticker.
   */
  onSessionsUpdate(sessions: SessionInfo[]): void {
    if (this.isMinimized) return;

    const hasActive = sessions.some(s => s.status === 'active') || this.world.hasActiveAnimations();

    if (sessions.length === 0) {
      // No sessions at all -- stop rendering for zero CPU
      this.app.ticker.stop();
      this.isIdle = true;
      return;
    }

    if (hasActive && this.isIdle) {
      // Ramp up to active frame rate
      this.app.ticker.maxFPS = FPS_ACTIVE;
      if (!this.app.ticker.started) {
        this.app.ticker.start();
      }
      this.isIdle = false;
    } else if (!hasActive && !this.isIdle) {
      // Drop to idle frame rate
      this.app.ticker.maxFPS = FPS_IDLE;
      this.isIdle = true;
    } else if (!this.app.ticker.started) {
      // Ensure ticker is running if we have sessions
      this.app.ticker.start();
    }
  }

  onWindowMinimized(): void {
    this.app.ticker.stop();
    this.isMinimized = true;
  }

  onWindowRestored(): void {
    this.isMinimized = false;
    this.app.ticker.maxFPS = this.isIdle ? FPS_IDLE : FPS_ACTIVE;
    this.app.ticker.start();
  }

  stop(): void {
    if (this.tickerCallback) {
      this.app.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }
    this.app.ticker.stop();
  }
}

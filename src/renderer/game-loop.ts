import { Application } from 'pixi.js';
import { SessionInfo } from '../shared/types';
import { FPS_ACTIVE, FPS_IDLE } from '../shared/constants';
import { World } from './world';

/**
 * ErrorTracker -- Rapid-repeat error detection for the game loop.
 * Tracks error count within a sliding time window.
 * Returns 'critical' when threshold is reached, 'log' otherwise.
 */
export class ErrorTracker {
  private errorCount = 0;
  private windowStart = 0;
  private readonly windowMs: number;
  private readonly threshold: number;

  constructor(windowMs = 10_000, threshold = 5) {
    this.windowMs = windowMs;
    this.threshold = threshold;
  }

  /** Record an error. Returns 'critical' if threshold reached, 'log' otherwise. */
  record(now: number): 'log' | 'critical' {
    if (now - this.windowStart > this.windowMs) {
      this.errorCount = 1;
      this.windowStart = now;
    } else {
      this.errorCount++;
    }
    return this.errorCount >= this.threshold ? 'critical' : 'log';
  }

  /** Reset error count (call on successful tick). */
  reset(): void {
    this.errorCount = 0;
  }
}

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
  private stopped = false;
  private errorTracker = new ErrorTracker();
  private tickerCallback: ((ticker: { deltaMS: number }) => void) | null = null;

  constructor(app: Application, world: World) {
    this.app = app;
    this.world = world;
  }

  start(): void {
    // Start conservatively at idle FPS
    this.app.ticker.maxFPS = FPS_IDLE;

    this.tickerCallback = (ticker: { deltaMS: number }) => {
      if (this.stopped) return;
      try {
        this.world.tick(ticker.deltaMS);
        this.errorTracker.reset();
      } catch (err) {
        const severity = this.errorTracker.record(Date.now());
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        window.agentWorld.logError('game-loop', message, stack);

        if (severity === 'critical') {
          window.agentWorld.logCritical('game-loop', 'Ticker stopped: 5+ errors in 10 seconds');
          this.app.ticker.stop();
          this.stopped = true;
        }
      }
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
      // No sessions -- keep ticking at idle FPS for ambient agent animation
      this.app.ticker.maxFPS = FPS_IDLE;
      if (!this.app.ticker.started) {
        this.app.ticker.start();
      }
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

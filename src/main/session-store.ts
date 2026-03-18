import { BrowserWindow } from 'electron';
import { SessionInfo, IPC_CHANNELS, DashboardData, DashboardSession, TodayTotals } from '../shared/types';
import { POLL_INTERVAL_MS } from '../shared/constants';
import { SessionDetector } from './session-detector';
import { UsageAggregator } from './usage-aggregator';
import { HistoryStore } from './history-store';

/**
 * Central session state management.
 * Orchestrates periodic detection and pushes updates to the renderer via IPC.
 *
 * Key behaviors:
 * - Polls detector every POLL_INTERVAL_MS (3s)
 * - Only pushes IPC updates when session data actually changes
 * - Completed/ended sessions persist until app restart (never removed from map)
 * - Runs an immediate first poll on start (no waiting for interval)
 */
export class SessionStore {
  private sessions: Map<string, SessionInfo> = new Map();
  private detector: SessionDetector;
  private pollInterval: NodeJS.Timeout | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor(
    detector: SessionDetector,
    private usageAggregator: UsageAggregator,
    private historyStore: HistoryStore,
  ) {
    this.detector = detector;
  }

  /**
   * Begin polling for session changes and pushing updates to the renderer.
   * Runs an immediate first poll, then starts the interval.
   */
  start(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Immediate first poll so the renderer has data right away
    this.poll();

    // Start periodic polling
    this.pollInterval = setInterval(() => {
      this.poll();
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stop polling and clean up resources.
   */
  stop(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.mainWindow = null;
    console.log('[session-store] Polling stopped');
  }

  /**
   * Get current snapshot of all known sessions.
   * Used by IPC handler for initial sessions request.
   */
  getSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Single poll cycle:
   * 1. Discover current sessions from the detector
   * 2. Merge with existing map (never remove sessions -- they persist until restart)
   * 3. Detect changes (new sessions, status changes, lastModified changes)
   * 4. If changes found, push update to renderer via IPC
   */
  private async poll(): Promise<void> {
    try {
      const discovered = await this.detector.discoverSessions();
      let hasChanges = false;

      // Track which sessions were returned by the detector this cycle
      const discoveredIds = new Set<string>();

      for (const session of discovered) {
        discoveredIds.add(session.sessionId);

        const existing = this.sessions.get(session.sessionId);
        if (!existing) {
          // New session discovered
          this.sessions.set(session.sessionId, session);
          hasChanges = true;
          console.log(`[session-store] New session: ${session.projectName} (${session.status})`);
        } else if (
          existing.status !== session.status ||
          existing.lastModified !== session.lastModified ||
          existing.lastEntryType !== session.lastEntryType ||
          existing.lastToolName !== session.lastToolName
        ) {
          // Session data changed
          this.sessions.set(session.sessionId, session);
          hasChanges = true;
        }
        // If nothing changed, keep the existing entry (no update needed)
      }

      // Remove sessions the detector no longer returns (stale/closed).
      // This lets the renderer detect disappearance and trigger agent fade-out.
      for (const sessionId of this.sessions.keys()) {
        if (!discoveredIds.has(sessionId)) {
          console.log(`[session-store] Session removed: ${this.sessions.get(sessionId)?.projectName}`);
          this.sessions.delete(sessionId);
          hasChanges = true;
        }
      }

      // Prune stale entries from detector and usage caches
      this.detector.pruneStaleEntries?.(discoveredIds);
      this.usageAggregator.pruneStaleEntries(discoveredIds);

      if (hasChanges) {
        this.pushUpdate();
        await this.pushDashboardUpdate();
      }
    } catch (err) {
      console.error('[session-store] Poll error:', (err as Error).message);
    }
  }

  /**
   * Push current session data to the renderer via IPC.
   */
  private pushUpdate(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    const sessionList = this.getSessions();

    try {
      this.mainWindow.webContents.send(
        IPC_CHANNELS.SESSIONS_UPDATE,
        sessionList
      );
      console.log(`[session-store] Pushed update: ${sessionList.length} sessions`);
    } catch (err) {
      console.warn('[session-store] Failed to push update:', (err as Error).message);
    }
  }

  /**
   * Build and push DashboardData (per-session usage + cost + today totals) to the renderer.
   * Called after pushUpdate() whenever session data changes.
   */
  private async pushDashboardUpdate(): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const sessions = this.getSessions();
    const dashboardSessions: DashboardSession[] = [];

    for (const session of sessions) {
      const usage = await this.usageAggregator.getUsageWithCost(session.sessionId, session.filePath);
      if (usage) {
        dashboardSessions.push({
          sessionId: session.sessionId,
          projectName: session.projectName,
          status: session.status,
          lastToolName: session.lastToolName,
          lastModified: session.lastModified,
          ...usage,
        });
      }
    }

    const todayTotals: TodayTotals = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalCostUsd: 0,
      cacheSavingsUsd: 0,
      sessionCount: dashboardSessions.length,
    };

    for (const ds of dashboardSessions) {
      todayTotals.inputTokens += ds.inputTokens;
      todayTotals.outputTokens += ds.outputTokens;
      todayTotals.cacheCreationTokens += ds.cacheCreationTokens;
      todayTotals.cacheReadTokens += ds.cacheReadTokens;
      todayTotals.totalCostUsd += ds.totalCostUsd;
      todayTotals.cacheSavingsUsd += ds.cacheSavingsUsd;
    }

    // Persist today's aggregate to history (skips write if unchanged)
    this.historyStore.recordTodayTotals(todayTotals);

    const data: DashboardData = { sessions: dashboardSessions, todayTotals };

    try {
      this.mainWindow.webContents.send(IPC_CHANNELS.DASHBOARD_UPDATE, data);
    } catch (err) {
      console.warn('[session-store] Failed to push dashboard update:', (err as Error).message);
    }
  }
}

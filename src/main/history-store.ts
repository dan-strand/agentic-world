import * as fs from 'fs';
import * as path from 'path';
import { TodayTotals, DailyAggregate } from '../shared/types';

interface HistoryFile {
  version: 1;
  days: Record<string, DailyAggregate>;
}

const RETENTION_DAYS = 30;

/**
 * Persists daily usage aggregates to a JSON file.
 *
 * Key behaviors:
 * - Loads history from disk at construction (sync, <5KB file)
 * - Records today's totals by overwriting (not accumulating) the daily record
 * - Uses local date (YYYY-MM-DD) as the day key so "today" matches user's calendar day
 * - Writes atomically via tmp+rename with Windows EPERM/EBUSY fallback
 * - Skips writes when data hasn't changed (lastWrittenJson comparison)
 * - Prunes records older than 30 days on each update
 * - flush() called on app quit to ensure latest data is persisted
 */
export class HistoryStore {
  private filePath: string;
  private data: HistoryFile;
  private lastWrittenJson: string = '';

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'history.json');
    this.data = this.load();
  }

  /**
   * Load history file from disk. Returns empty history if file doesn't exist or is corrupted.
   */
  private load(): HistoryFile {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && parsed?.days && typeof parsed.days === 'object') {
        // Cache the loaded JSON so we don't rewrite an unchanged file
        this.lastWrittenJson = JSON.stringify(parsed, null, 2);
        return parsed as HistoryFile;
      }
    } catch {
      // File doesn't exist or is corrupted -- start fresh
    }
    return { version: 1, days: {} };
  }

  /**
   * Atomic write: write to .tmp, then rename. On Windows, rename can throw
   * EPERM/EBUSY when antivirus locks the target file -- fall back to copyFile.
   */
  private save(): void {
    const json = JSON.stringify(this.data, null, 2);
    if (json === this.lastWrittenJson) return; // Skip if nothing changed

    const tmpPath = this.filePath + '.tmp';
    try {
      // Ensure directory exists (userData should exist, but be safe)
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(tmpPath, json, 'utf-8');
      try {
        fs.renameSync(tmpPath, this.filePath);
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EPERM' || code === 'EBUSY') {
          // Windows NTFS: antivirus locks target file during rename
          fs.copyFileSync(tmpPath, this.filePath);
          try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup failure */ }
        } else {
          throw err;
        }
      }
      this.lastWrittenJson = json;
      console.log('[history-store] Saved history:', Object.keys(this.data.days).length, 'days');
    } catch (err) {
      console.warn('[history-store] Save failed:', (err as Error).message);
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }

  /**
   * Remove records older than RETENTION_DAYS. Uses local date for consistency
   * with the day key format. Never removes today's record.
   */
  private prune(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffStr = cutoff.toLocaleDateString('en-CA'); // YYYY-MM-DD local

    for (const date of Object.keys(this.data.days)) {
      if (date < cutoffStr) {
        delete this.data.days[date];
      }
    }
  }

  /**
   * Record today's totals. Overwrites the daily record entirely (not accumulates)
   * because TodayTotals from SessionStore is already a full aggregate computed
   * from all live sessions.
   */
  recordTodayTotals(totals: TodayTotals): void {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

    this.data.days[today] = {
      date: today,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheCreationTokens: totals.cacheCreationTokens,
      cacheReadTokens: totals.cacheReadTokens,
      totalCostUsd: totals.totalCostUsd,
      cacheSavingsUsd: totals.cacheSavingsUsd,
      sessionCount: totals.sessionCount,
    };

    this.prune();
    this.save();
  }

  /**
   * Return all daily aggregates sorted by date ascending.
   */
  getHistory(): DailyAggregate[] {
    return Object.values(this.data.days)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Force a save to disk. Called on app before-quit to persist latest data.
   */
  flush(): void {
    // Force save by clearing lastWrittenJson so save() will write
    const currentJson = JSON.stringify(this.data, null, 2);
    if (currentJson !== this.lastWrittenJson) {
      this.lastWrittenJson = ''; // Force write
      this.save();
    }
  }
}

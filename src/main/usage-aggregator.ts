import * as fs from 'fs';
import { readUsageTotals, TokenUsageTotals } from './jsonl-reader';

/**
 * Caches parsed token usage per session, keyed by sessionId.
 * Only re-parses a JSONL file when its mtime has changed since the last scan.
 * Mirrors the mtime cache pattern from FilesystemSessionDetector (session-detector.ts:33).
 */
export class UsageAggregator {
  private cache = new Map<string, { mtimeMs: number; totals: TokenUsageTotals }>();

  async getUsage(sessionId: string, filePath: string): Promise<TokenUsageTotals | null> {
    try {
      const stat = fs.statSync(filePath);
      const cached = this.cache.get(sessionId);

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.totals;  // File unchanged -- return cached
      }

      const totals = await readUsageTotals(filePath);
      this.cache.set(sessionId, { mtimeMs: stat.mtimeMs, totals });
      return totals;
    } catch {
      return null;  // File deleted, permissions error, etc.
    }
  }

  clearSession(sessionId: string): void {
    this.cache.delete(sessionId);
  }
}

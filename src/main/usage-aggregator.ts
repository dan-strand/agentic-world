import { promises as fsp } from 'fs';
import { readUsageTotals, readUsageTotalsIncremental, TokenUsageTotals } from './jsonl-reader';
import { resolveModelPricing, calculateCost, calculateCacheSavings, getModelDisplayName } from '../shared/constants';

/**
 * Caches parsed token usage per session, keyed by sessionId.
 * Only re-parses a JSONL file when its mtime has changed since the last scan.
 * Supports incremental offset-based parsing: reads only newly-appended bytes
 * instead of re-streaming the entire 2-18 MB file on every mtime change.
 *
 * Falls back to full re-parse when:
 * - No cached entry exists (first read)
 * - File was truncated (size < stored offset)
 * - File inode changed (file replaced, e.g., by log rotation)
 */
export class UsageAggregator {
  private cache = new Map<string, {
    mtimeMs: number;
    totals: TokenUsageTotals;
    byteOffset: number;
    ino: number;
  }>();

  async getUsage(sessionId: string, filePath: string, lastModified?: number): Promise<TokenUsageTotals | null> {
    try {
      // Fast path: if caller provides lastModified and it matches the cached mtime,
      // skip the stat call entirely (saves one async I/O per poll cycle per session)
      const cached = this.cache.get(sessionId);
      if (lastModified !== undefined && cached && cached.mtimeMs === lastModified) {
        return cached.totals;
      }

      const stat = await fsp.stat(filePath);

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.totals;  // File unchanged -- return cached
      }

      // Detect truncation or file replacement -- fall back to full re-parse
      const needsFullReparse =
        !cached ||
        stat.size < cached.byteOffset ||                                       // truncation
        (stat.ino !== 0 && cached.ino !== 0 && stat.ino !== cached.ino);       // inode change (skip if ino=0, Windows fallback)

      if (needsFullReparse) {
        const totals = await readUsageTotals(filePath);
        this.cache.set(sessionId, {
          mtimeMs: stat.mtimeMs,
          totals,
          byteOffset: stat.size,
          ino: stat.ino,
        });
        return totals;
      }

      // Incremental: read only new bytes from last offset
      const { totals, newOffset } = await readUsageTotalsIncremental(
        filePath, cached.byteOffset, cached.totals
      );
      this.cache.set(sessionId, {
        mtimeMs: stat.mtimeMs,
        totals,
        byteOffset: newOffset,
        ino: stat.ino,
      });
      return totals;
    } catch {
      return null;  // File deleted, permissions error, etc.
    }
  }

  async getUsageWithCost(sessionId: string, filePath: string, lastModified?: number): Promise<{
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCostUsd: number;
    cacheSavingsUsd: number;
    model: string;
    modelDisplayName: string;
    isEstimate: boolean;
    turnCount: number;
  } | null> {
    const totals = await this.getUsage(sessionId, filePath, lastModified);
    if (!totals) return null;

    const { pricing, isEstimate } = resolveModelPricing(totals.model);
    const totalCostUsd = calculateCost(totals, pricing);
    const cacheSavingsUsd = calculateCacheSavings(totals.cacheReadTokens, pricing);

    return {
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheCreationTokens: totals.cacheCreationTokens,
      cacheReadTokens: totals.cacheReadTokens,
      totalCostUsd,
      cacheSavingsUsd,
      model: totals.model,
      modelDisplayName: getModelDisplayName(totals.model),
      isEstimate,
      turnCount: totals.turnCount,
    };
  }

  clearSession(sessionId: string): void {
    this.cache.delete(sessionId);
  }

  /**
   * Prune cached entries for sessions no longer in the active set.
   * Prevents cache from growing without bound as sessions come and go.
   * Called by SessionStore after each poll cycle.
   */
  pruneStaleEntries(activeSessionIds: Set<string>): void {
    for (const key of this.cache.keys()) {
      if (!activeSessionIds.has(key)) {
        this.cache.delete(key);
      }
    }
  }
}

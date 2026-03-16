import * as fs from 'fs';
import { readUsageTotals, TokenUsageTotals } from './jsonl-reader';
import { resolveModelPricing, calculateCost, calculateCacheSavings, getModelDisplayName } from '../shared/constants';

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

  async getUsageWithCost(sessionId: string, filePath: string): Promise<{
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
    const totals = await this.getUsage(sessionId, filePath);
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

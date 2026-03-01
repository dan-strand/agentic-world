import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UsageAggregator } from './usage-aggregator';

// Helper to create a temp JSONL file with given lines
function writeTempJsonl(lines: string[], suffix?: string): string {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `test-agg-${Date.now()}-${suffix ?? Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  return filePath;
}

// Helper to build an assistant entry with usage
function assistantEntry(opts: {
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      model: opts.model ?? 'claude-opus-4-6',
      usage: {
        input_tokens: opts.input_tokens ?? 0,
        output_tokens: opts.output_tokens ?? 0,
        cache_creation_input_tokens: opts.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: opts.cache_read_input_tokens ?? 0,
      },
    },
    timestamp: new Date().toISOString(),
  });
}

describe('UsageAggregator', () => {
  const tempFiles: string[] = [];

  after(() => {
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });

  it('returns token totals for a valid file', async () => {
    const filePath = writeTempJsonl([
      assistantEntry({ input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 200, cache_read_input_tokens: 300 }),
    ]);
    tempFiles.push(filePath);

    const agg = new UsageAggregator();
    const result = await agg.getUsage('session-1', filePath);

    assert.notEqual(result, null);
    assert.equal(result!.inputTokens, 100);
    assert.equal(result!.outputTokens, 50);
    assert.equal(result!.cacheCreationTokens, 200);
    assert.equal(result!.cacheReadTokens, 300);
    assert.equal(result!.turnCount, 1);
  });

  it('returns cached result when file mtime unchanged', async () => {
    const filePath = writeTempJsonl([
      assistantEntry({ input_tokens: 42, output_tokens: 7 }),
    ]);
    tempFiles.push(filePath);

    const agg = new UsageAggregator();
    const result1 = await agg.getUsage('session-cache', filePath);
    const result2 = await agg.getUsage('session-cache', filePath);

    assert.equal(result1!.inputTokens, 42);
    assert.equal(result2!.inputTokens, 42);
    assert.equal(result1!.outputTokens, 7);
    assert.equal(result2!.outputTokens, 7);
    // Same object reference means cache hit
    assert.equal(result1, result2);
  });

  it('re-parses and returns updated totals when file mtime changes', async () => {
    const filePath = writeTempJsonl([
      assistantEntry({ input_tokens: 10, output_tokens: 5 }),
    ]);
    tempFiles.push(filePath);

    const agg = new UsageAggregator();
    const result1 = await agg.getUsage('session-reparse', filePath);
    assert.equal(result1!.inputTokens, 10);

    // Append a new assistant entry -- this changes the mtime
    // Use a small delay to ensure mtime changes (filesystem resolution)
    await new Promise(resolve => setTimeout(resolve, 50));
    fs.appendFileSync(filePath, assistantEntry({ input_tokens: 20, output_tokens: 10 }) + '\n');

    const result2 = await agg.getUsage('session-reparse', filePath);
    assert.equal(result2!.inputTokens, 30); // 10 + 20
    assert.equal(result2!.outputTokens, 15); // 5 + 10
    assert.equal(result2!.turnCount, 2);
  });

  it('returns null for nonexistent file path', async () => {
    const agg = new UsageAggregator();
    const result = await agg.getUsage('session-missing', '/tmp/nonexistent-file-99999.jsonl');
    assert.equal(result, null);
  });

  it('clearSession removes cache entry so next call re-parses', async () => {
    const filePath = writeTempJsonl([
      assistantEntry({ input_tokens: 100, output_tokens: 50 }),
    ]);
    tempFiles.push(filePath);

    const agg = new UsageAggregator();
    const result1 = await agg.getUsage('session-clear', filePath);
    assert.equal(result1!.inputTokens, 100);

    agg.clearSession('session-clear');

    const result2 = await agg.getUsage('session-clear', filePath);
    assert.equal(result2!.inputTokens, 100);
    // After clearSession, result2 should be a new object (re-parsed)
    assert.notEqual(result1, result2);
  });

  it('caches multiple sessions independently', async () => {
    const file1 = writeTempJsonl([
      assistantEntry({ input_tokens: 10, output_tokens: 1 }),
    ], 'multi-1');
    const file2 = writeTempJsonl([
      assistantEntry({ input_tokens: 20, output_tokens: 2 }),
    ], 'multi-2');
    tempFiles.push(file1, file2);

    const agg = new UsageAggregator();
    const r1 = await agg.getUsage('session-a', file1);
    const r2 = await agg.getUsage('session-b', file2);

    assert.equal(r1!.inputTokens, 10);
    assert.equal(r2!.inputTokens, 20);

    // Clearing one doesn't affect the other
    agg.clearSession('session-a');
    const r2again = await agg.getUsage('session-b', file2);
    assert.equal(r2, r2again); // Same reference = cache hit
  });
});

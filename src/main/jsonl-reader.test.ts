import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readUsageTotals, readUsageTotalsIncremental, readSessionTail } from './jsonl-reader';

// Helper to create a temp JSONL file with given lines
function writeTempJsonl(lines: string[]): string {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `test-usage-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
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

describe('readUsageTotals', () => {
  const tempFiles: string[] = [];

  after(() => {
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });

  it('returns zero totals for an empty file', async () => {
    const filePath = writeTempJsonl([]);
    tempFiles.push(filePath);
    // Write truly empty file (writeTempJsonl writes a trailing newline)
    fs.writeFileSync(filePath, '', 'utf-8');

    const result = await readUsageTotals(filePath);
    assert.equal(result.inputTokens, 0);
    assert.equal(result.outputTokens, 0);
    assert.equal(result.cacheCreationTokens, 0);
    assert.equal(result.cacheReadTokens, 0);
    assert.equal(result.model, '');
    assert.equal(result.turnCount, 0);
  });

  it('returns correct token counts for a single assistant entry', async () => {
    const filePath = writeTempJsonl([
      assistantEntry({
        model: 'claude-opus-4-6',
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300,
      }),
    ]);
    tempFiles.push(filePath);

    const result = await readUsageTotals(filePath);
    assert.equal(result.inputTokens, 100);
    assert.equal(result.outputTokens, 50);
    assert.equal(result.cacheCreationTokens, 200);
    assert.equal(result.cacheReadTokens, 300);
    assert.equal(result.model, 'claude-opus-4-6');
    assert.equal(result.turnCount, 1);
  });

  it('sums multiple assistant entries; model is from last entry', async () => {
    const filePath = writeTempJsonl([
      assistantEntry({
        model: 'claude-sonnet-4-20250514',
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300,
      }),
      assistantEntry({
        model: 'claude-opus-4-6',
        input_tokens: 400,
        output_tokens: 150,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 500,
      }),
    ]);
    tempFiles.push(filePath);

    const result = await readUsageTotals(filePath);
    assert.equal(result.inputTokens, 500);
    assert.equal(result.outputTokens, 200);
    assert.equal(result.cacheCreationTokens, 200);
    assert.equal(result.cacheReadTokens, 800);
    assert.equal(result.model, 'claude-opus-4-6');
    assert.equal(result.turnCount, 2);
  });

  it('skips non-assistant entries', async () => {
    const filePath = writeTempJsonl([
      JSON.stringify({ type: 'user', message: { content: 'hello' } }),
      JSON.stringify({ type: 'system', data: {} }),
      JSON.stringify({ type: 'progress', data: {} }),
      assistantEntry({ input_tokens: 10, output_tokens: 5 }),
    ]);
    tempFiles.push(filePath);

    const result = await readUsageTotals(filePath);
    assert.equal(result.inputTokens, 10);
    assert.equal(result.outputTokens, 5);
    assert.equal(result.turnCount, 1);
  });

  it('skips malformed JSON lines without throwing', async () => {
    const filePath = writeTempJsonl([
      '{this is not valid json',
      assistantEntry({ input_tokens: 42, output_tokens: 7 }),
      'another bad line {{{',
    ]);
    tempFiles.push(filePath);

    const result = await readUsageTotals(filePath);
    assert.equal(result.inputTokens, 42);
    assert.equal(result.outputTokens, 7);
    assert.equal(result.turnCount, 1);
  });

  it('skips assistant entry with missing usage field (turnCount not incremented)', async () => {
    const filePath = writeTempJsonl([
      JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-4-6' } }),
      assistantEntry({ input_tokens: 10, output_tokens: 5 }),
    ]);
    tempFiles.push(filePath);

    const result = await readUsageTotals(filePath);
    assert.equal(result.inputTokens, 10);
    assert.equal(result.outputTokens, 5);
    assert.equal(result.turnCount, 1);
  });

  it('defaults missing individual token fields to 0', async () => {
    const filePath = writeTempJsonl([
      JSON.stringify({
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 10 },
        },
      }),
    ]);
    tempFiles.push(filePath);

    const result = await readUsageTotals(filePath);
    assert.equal(result.inputTokens, 10);
    assert.equal(result.outputTokens, 0);
    assert.equal(result.cacheCreationTokens, 0);
    assert.equal(result.cacheReadTokens, 0);
    assert.equal(result.turnCount, 1);
  });

  it('returns zero totals for a nonexistent file path', async () => {
    const result = await readUsageTotals('/tmp/nonexistent-file-12345.jsonl');
    assert.equal(result.inputTokens, 0);
    assert.equal(result.outputTokens, 0);
    assert.equal(result.turnCount, 0);
  });

  it('readUsageTotals destroys stream on successful read (no leaked file descriptors)', async () => {
    // Create a temp file with valid data
    const filePath = writeTempJsonl([
      assistantEntry({ input_tokens: 100, output_tokens: 50 }),
    ]);
    tempFiles.push(filePath);

    // Call readUsageTotals -- the finally block should destroy the stream
    const result = await readUsageTotals(filePath);
    assert.equal(result.inputTokens, 100);
    assert.equal(result.outputTokens, 50);
    assert.equal(result.turnCount, 1);
    // Stream cleanup is structural (finally block) -- verification is that
    // this test completes without hanging from a leaked file descriptor
  });

  it('readUsageTotals returns zero totals and does not leak stream on read error', async () => {
    // Pass a directory path (not a file) which will cause createReadStream to error
    const dirPath = os.tmpdir();

    const result = await readUsageTotals(dirPath);
    assert.equal(result.inputTokens, 0);
    assert.equal(result.outputTokens, 0);
    assert.equal(result.turnCount, 0);
    // If stream.destroy() is missing from the finally block, the stream
    // could leak a file descriptor. This test verifies it doesn't hang.
  });
});

// Helper to build an assistant entry with tool_use content
function assistantWithToolUse(toolName: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', name: toolName, input: {} }],
      model: 'claude-opus-4-6',
      usage: { input_tokens: 10, output_tokens: 5 },
    },
  });
}

describe('readSessionTail', () => {
  const tempFiles: string[] = [];

  after(() => {
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });

  it('returns { lastEntry: null, lastToolName: null } for an empty file', async () => {
    const filePath = writeTempJsonl([]);
    tempFiles.push(filePath);
    fs.writeFileSync(filePath, '', 'utf-8');

    const result = await readSessionTail(filePath);
    assert.equal(result.lastEntry, null);
    assert.equal(result.lastToolName, null);
  });

  it('returns both lastEntry and lastToolName for a single assistant entry with tool_use', async () => {
    const filePath = writeTempJsonl([
      assistantWithToolUse('Edit'),
    ]);
    tempFiles.push(filePath);

    const result = await readSessionTail(filePath);
    assert.notEqual(result.lastEntry, null);
    assert.equal(result.lastEntry!.type, 'assistant');
    assert.equal(result.lastToolName, 'Edit');
  });

  it('returns lastEntry but lastToolName is null when no tool_use content', async () => {
    const filePath = writeTempJsonl([
      JSON.stringify({ type: 'user', message: { content: 'hello' } }),
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'response' }],
          model: 'claude-opus-4-6',
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      }),
    ]);
    tempFiles.push(filePath);

    const result = await readSessionTail(filePath);
    assert.notEqual(result.lastEntry, null);
    assert.equal(result.lastEntry!.type, 'assistant');
    assert.equal(result.lastToolName, null);
  });

  it('falls back to previous line when last line is malformed (mid-write race)', async () => {
    const filePath = writeTempJsonl([
      assistantWithToolUse('Read'),
      '{this is a partial write that got cut off',
    ]);
    tempFiles.push(filePath);

    const result = await readSessionTail(filePath);
    assert.notEqual(result.lastEntry, null);
    assert.equal(result.lastEntry!.type, 'assistant');
    assert.equal(result.lastToolName, 'Read');
  });

  it('returns { lastEntry: null, lastToolName: null } for a nonexistent file', async () => {
    const result = await readSessionTail('/tmp/nonexistent-readSessionTail-test-12345.jsonl');
    assert.equal(result.lastEntry, null);
    assert.equal(result.lastToolName, null);
  });

  it('returns the LAST tool_use when file has multiple tool_use entries (scanning backward)', async () => {
    const filePath = writeTempJsonl([
      assistantWithToolUse('Read'),
      JSON.stringify({ type: 'user', message: { content: 'ok' } }),
      assistantWithToolUse('Write'),
      JSON.stringify({ type: 'user', message: { content: 'next' } }),
      assistantWithToolUse('Bash'),
    ]);
    tempFiles.push(filePath);

    const result = await readSessionTail(filePath);
    assert.notEqual(result.lastEntry, null);
    // lastEntry is the last valid entry scanning backward (the Bash tool_use)
    assert.equal(result.lastEntry!.type, 'assistant');
    // lastToolName should be the most recent tool_use
    assert.equal(result.lastToolName, 'Bash');
  });

  it('finds lastEntry even when all entries are non-assistant (lastToolName is null)', async () => {
    const filePath = writeTempJsonl([
      JSON.stringify({ type: 'user', message: { content: 'hello' } }),
      JSON.stringify({ type: 'system', data: { foo: 'bar' } }),
    ]);
    tempFiles.push(filePath);

    const result = await readSessionTail(filePath);
    assert.notEqual(result.lastEntry, null);
    assert.equal(result.lastEntry!.type, 'system');
    assert.equal(result.lastToolName, null);
  });
});

describe('readUsageTotalsIncremental', () => {
  const tempFiles: string[] = [];

  after(() => {
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });

  it('reading from offset 0 produces same totals as readUsageTotals (full file equivalence)', async () => {
    const filePath = writeTempJsonl([
      assistantEntry({ model: 'claude-opus-4-6', input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 200, cache_read_input_tokens: 300 }),
      assistantEntry({ model: 'claude-sonnet-4-20250514', input_tokens: 400, output_tokens: 150, cache_creation_input_tokens: 0, cache_read_input_tokens: 500 }),
    ]);
    tempFiles.push(filePath);

    const zeroTotals = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, model: '', turnCount: 0 };
    const incremental = await readUsageTotalsIncremental(filePath, 0, zeroTotals);
    const full = await readUsageTotals(filePath);

    assert.equal(incremental.totals.inputTokens, full.inputTokens);
    assert.equal(incremental.totals.outputTokens, full.outputTokens);
    assert.equal(incremental.totals.cacheCreationTokens, full.cacheCreationTokens);
    assert.equal(incremental.totals.cacheReadTokens, full.cacheReadTokens);
    assert.equal(incremental.totals.model, full.model);
    assert.equal(incremental.totals.turnCount, full.turnCount);
  });

  it('reading from a mid-file offset accumulates only new entries onto existing totals', async () => {
    // Write 2 entries, note file size
    const filePath = writeTempJsonl([
      assistantEntry({ input_tokens: 100, output_tokens: 50 }),
      assistantEntry({ input_tokens: 200, output_tokens: 75 }),
    ]);
    tempFiles.push(filePath);

    const midSize = fs.statSync(filePath).size;

    // Append 1 more entry
    fs.appendFileSync(filePath, assistantEntry({ input_tokens: 300, output_tokens: 125 }) + '\n');

    // Read incrementally from old size with existing totals
    const existingTotals = { inputTokens: 300, outputTokens: 125, cacheCreationTokens: 0, cacheReadTokens: 0, model: 'claude-opus-4-6', turnCount: 2 };
    const result = await readUsageTotalsIncremental(filePath, midSize, existingTotals);

    // Should have accumulated only the new entry's tokens
    assert.equal(result.totals.inputTokens, 600);   // 300 existing + 300 new
    assert.equal(result.totals.outputTokens, 250);   // 125 existing + 125 new
    assert.equal(result.totals.turnCount, 3);         // 2 existing + 1 new
  });

  it('first line after non-zero offset is discarded (partial line safety)', async () => {
    // Write 2 entries
    const filePath = writeTempJsonl([
      assistantEntry({ input_tokens: 100, output_tokens: 50 }),
      assistantEntry({ input_tokens: 200, output_tokens: 75 }),
    ]);
    tempFiles.push(filePath);

    // Use an offset that lands mid-way through the first line (simulate mid-line resume)
    const offset = 10; // mid-first-line offset
    const existingTotals = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, model: '', turnCount: 0 };
    const result = await readUsageTotalsIncremental(filePath, offset, existingTotals);

    // First line fragment should be discarded, only second entry counted
    assert.equal(result.totals.inputTokens, 200);
    assert.equal(result.totals.outputTokens, 75);
    assert.equal(result.totals.turnCount, 1);
  });

  it('returns existing totals unchanged on nonexistent file', async () => {
    const existingTotals = { inputTokens: 42, outputTokens: 7, cacheCreationTokens: 3, cacheReadTokens: 1, model: 'claude-opus-4-6', turnCount: 5 };
    const result = await readUsageTotalsIncremental('/tmp/nonexistent-incremental-12345.jsonl', 0, existingTotals);

    assert.equal(result.totals.inputTokens, 42);
    assert.equal(result.totals.outputTokens, 7);
    assert.equal(result.totals.turnCount, 5);
    assert.equal(result.newOffset, 0);
  });

  it('skips non-assistant entries in incremental delta', async () => {
    const filePath = writeTempJsonl([
      JSON.stringify({ type: 'user', message: { content: 'hello' } }),
      JSON.stringify({ type: 'system', data: {} }),
      assistantEntry({ input_tokens: 10, output_tokens: 5 }),
    ]);
    tempFiles.push(filePath);

    const zeroTotals = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, model: '', turnCount: 0 };
    const result = await readUsageTotalsIncremental(filePath, 0, zeroTotals);

    assert.equal(result.totals.inputTokens, 10);
    assert.equal(result.totals.outputTokens, 5);
    assert.equal(result.totals.turnCount, 1);
  });

  it('returns newOffset equal to file size after successful read', async () => {
    const filePath = writeTempJsonl([
      assistantEntry({ input_tokens: 100, output_tokens: 50 }),
    ]);
    tempFiles.push(filePath);

    const expectedSize = fs.statSync(filePath).size;
    const zeroTotals = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, model: '', turnCount: 0 };
    const result = await readUsageTotalsIncremental(filePath, 0, zeroTotals);

    assert.equal(result.newOffset, expectedSize);
  });
});

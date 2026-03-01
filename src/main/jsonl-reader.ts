import * as fs from 'fs';
import * as readline from 'readline';
import { JSONL_TAIL_BUFFER_SIZE } from '../shared/constants';

export interface JsonlEntry {
  type: string;
  sessionId?: string;
  cwd?: string;
  timestamp?: string;
  data?: unknown;
  [key: string]: unknown;
}

/**
 * Efficiently read the last JSON line from a JSONL file by seeking to the end.
 * Only reads the last `bufferSize` bytes (default 4096) -- O(1) regardless of file size.
 * JSONL files can be 2-18 MB; never read the entire file.
 *
 * Handles race conditions where Claude Code is mid-write by falling back
 * to the second-to-last line if the last line fails to parse.
 */
export function readLastJsonlLine(
  filePath: string,
  bufferSize: number = JSONL_TAIL_BUFFER_SIZE
): JsonlEntry | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);

    if (stat.size === 0) {
      return null;
    }

    const readSize = Math.min(bufferSize, stat.size);
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);

    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    if (lines.length === 0) {
      return null;
    }

    // Try last line first, then fall back to previous lines on parse error
    // (race condition: Claude may be mid-write on the last line)
    const maxAttempts = Math.min(3, lines.length);
    for (let i = lines.length - 1; i >= lines.length - maxAttempts; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
          return parsed as JsonlEntry;
        }
      } catch {
        // Parse failed -- try previous line
        continue;
      }
    }

    // All attempts failed -- log warning but don't crash
    console.warn(`[jsonl-reader] Could not parse any recent lines from: ${filePath}`);
    return null;
  } catch (err) {
    // File may have been deleted between discovery and read, or permissions issue
    console.warn(`[jsonl-reader] Error reading ${filePath}:`, (err as Error).message);
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Extract the most recent tool_use name from JSONL progress entries.
 * Scans backward through the tail buffer for a progress entry containing
 * a tool_use content block with a name field.
 *
 * Uses same buffer size as status reader -- assistant entries with tool_use
 * can be very large (100KB+), pushing tool_use entries far from file tail.
 */
export function readLastToolUse(
  filePath: string,
  bufferSize: number = JSONL_TAIL_BUFFER_SIZE
): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);
    if (stat.size === 0) return null;

    const readSize = Math.min(bufferSize, stat.size);
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);

    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    // Scan backward for an assistant entry with tool_use content
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        if (obj.type !== 'assistant') continue;
        // Tool uses are at obj.message.content[] (top-level message, not nested in data)
        const content = obj.message?.content;
        if (!Array.isArray(content)) continue;
        // Look for tool_use blocks in content array
        for (const c of content) {
          if (c.type === 'tool_use' && typeof c.name === 'string') {
            return c.name;
          }
        }
      } catch {
        continue; // Parse failed -- try previous line
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}

export interface TokenUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
  turnCount: number;
}

/**
 * Stream-parse a JSONL file and accumulate token usage from all assistant entries.
 * Uses readline + createReadStream so it never blocks the main process with readFileSync.
 * Malformed lines are silently skipped (race condition: Claude may be mid-write).
 */
export async function readUsageTotals(filePath: string): Promise<TokenUsageTotals> {
  const totals: TokenUsageTotals = {
    inputTokens: 0, outputTokens: 0,
    cacheCreationTokens: 0, cacheReadTokens: 0,
    model: '', turnCount: 0,
  };

  let stream: fs.ReadStream | null = null;
  try {
    stream = fs.createReadStream(filePath, { encoding: 'utf-8' });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'assistant') continue;
        const usage = entry.message?.usage;
        if (!usage) continue;

        totals.inputTokens += usage.input_tokens ?? 0;
        totals.outputTokens += usage.output_tokens ?? 0;
        totals.cacheCreationTokens += usage.cache_creation_input_tokens ?? 0;
        totals.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
        totals.turnCount++;

        if (entry.message?.model) {
          totals.model = entry.message.model;
        }
      } catch {
        // Malformed line (mid-write race) -- skip silently
      }
    }
  } catch {
    // File doesn't exist, permission error, etc. -- return zero totals
  }

  return totals;
}

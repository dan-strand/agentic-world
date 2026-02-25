import * as fs from 'fs';
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

# Phase 26: I/O Pipeline - Research

**Researched:** 2026-03-18
**Domain:** Node.js async filesystem I/O, incremental JSONL parsing, adaptive polling in Electron main process
**Confidence:** HIGH

## Summary

Phase 26 optimizes the Electron main process I/O pipeline across four files: `session-detector.ts`, `jsonl-reader.ts`, `usage-aggregator.ts`, and `session-store.ts`. The current implementation blocks the main process event loop every 3 seconds with synchronous filesystem calls (`readdirSync`, `statSync`, `openSync`, `readSync`, `closeSync`), opens each changed JSONL file twice per poll cycle (once for status detection, once for tool-use detection), re-streams entire 2-18MB JSONL files on every mtime change for usage aggregation, and polls at a fixed 3-second interval regardless of whether any sessions exist.

All four optimizations use APIs already available in the installed stack (Node.js 24.x via Electron 40.6.1). Zero new dependencies are required. The `fs.promises` API provides async equivalents of every sync call. The `FileHandle.read(buffer, offset, length, position)` API enables seeking to a byte offset for incremental parsing. The `createReadStream({ start })` option enables offset-based stream reads. These are stable, well-documented APIs that have been available since Node.js 10+.

The primary risks are async race conditions during session discovery (TOCTOU between readdir and stat), incremental parsing correctness on file truncation or inode change, and poll backoff making new sessions appear sluggish. All three have well-understood mitigation patterns documented below.

**Primary recommendation:** Implement in order: (1) combine the two JSONL tail reads into a single `readSessionTail()`, (2) convert the combined read and `discoverSessions()` to async, (3) add incremental offset-based parsing to `UsageAggregator`, (4) add adaptive poll backoff to `SessionStore`. This order minimizes risk: refactor first (sync), then make it async, then optimize the hot path, then add the nice-to-have.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IO-01 | readLastJsonlLine and readLastToolUse combined into single file open/read/parse pass | Combined `readSessionTail()` function replaces two separate file opens. Architecture pattern #1 below provides the implementation approach. Both functions already read the same 64KB tail buffer -- merge into one read with dual extraction. |
| IO-02 | discoverSessions converted from synchronous to async fs.promises (unblocks main process) | `fs.promises.readdir`, `fs.promises.stat`, `FileHandle.read()` replace all sync calls. Architecture pattern #2 provides the conversion approach. SessionDetector interface changes return type to `Promise<SessionInfo[]>`. |
| IO-03 | UsageAggregator uses incremental offset-based JSONL parsing instead of full file re-read | Extended cache shape `{ mtimeMs, totals, byteOffset, ino }` with `createReadStream({ start: offset })` for delta reads. Architecture pattern #3 provides the implementation. Truncation/inode detection is the safety net. |
| IO-04 | Poll interval backs off to 10-30s when no active sessions detected for consecutive cycles | `setTimeout` recursion replaces `setInterval` in SessionStore. Architecture pattern #4 provides the dynamic interval calculation with consecutive-empty counter and hard cap. |
</phase_requirements>

## Standard Stack

### Core

No new packages required. All optimizations use Node.js built-in APIs.

| API | Available Since | Purpose | Why Standard |
|-----|----------------|---------|--------------|
| `fs.promises.readdir` | Node.js 10+ | Async directory listing with `withFileTypes` | Returns `Dirent[]` same as `readdirSync`. Drop-in async replacement. |
| `fs.promises.stat` | Node.js 10+ | Async file metadata | Returns `fs.Stats` identical to `statSync`. |
| `fs.promises.open` / `FileHandle` | Node.js 10+ | Async file open with `read(buffer, offset, length, position)` | Enables positioned reads without blocking. Replaces `openSync`/`readSync`/`closeSync` triple. |
| `fs.createReadStream({ start })` | Node.js 0.x+ | Byte-offset stream reads | Start reading at a specific byte position. Enables incremental JSONL parsing. |
| `setTimeout` recursion | Always | Dynamic interval scheduling | Replaces `setInterval` for variable-interval polling. |

### Version Compatibility

- **Electron 40.6.1** bundles **Node.js 24.x** -- all `fs.promises` APIs have been stable for 7+ major Node.js versions.
- **TypeScript ~5.7.0** -- `fs.promises` types are fully included in `@types/node` bundled with Electron.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.promises` async | Worker threads | Out of scope per REQUIREMENTS.md. Worker thread overhead not justified for this workload. |
| `createReadStream({ start })` for incremental | `FileHandle.read()` with manual buffer | Both work. `createReadStream` + `readline` is simpler for line-by-line JSONL parsing since it handles buffer boundaries and UTF-8 decoding automatically. |
| `setTimeout` recursion | `setInterval` with `clearInterval`/`setInterval` swap | Dynamic `setTimeout` is simpler -- no need to clear and recreate the interval on every change. Single pattern, no edge cases. |
| Manual `fs.promises.access` for existence check | Try-catch around `fs.promises.readdir` | Node.js docs explicitly recommend against access-then-open (TOCTOU). Better to just try the operation and handle ENOENT. |

## Architecture Patterns

### Current File Layout (No Changes to Structure)

```
src/main/
  jsonl-reader.ts        # Low-level JSONL file I/O (modified)
  session-detector.ts    # Filesystem scanning, session status (modified)
  usage-aggregator.ts    # Token/cost accumulation with caching (modified)
  session-store.ts       # Poll orchestration, IPC push (modified)
src/shared/
  constants.ts           # POLL_INTERVAL_MS (referenced, may add backoff constants)
  types.ts               # SessionDetector interface (modified)
```

### Pattern 1: Combined JSONL Tail Read (IO-01)

**What:** Merge `readLastJsonlLine()` and `readLastToolUse()` into a single `readSessionTail()` that opens the file once, reads the 64KB tail buffer once, and extracts both the last entry and the last tool_use name from the same buffer.

**When to use:** Every call to `processSessionFile()` when mtime has changed.

**Implementation approach:**
```typescript
// jsonl-reader.ts -- new combined function
export interface SessionTailResult {
  lastEntry: JsonlEntry | null;
  lastToolName: string | null;
}

export function readSessionTail(
  filePath: string,
  bufferSize: number = JSONL_TAIL_BUFFER_SIZE
): SessionTailResult {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);
    if (stat.size === 0) return { lastEntry: null, lastToolName: null };

    const readSize = Math.min(bufferSize, stat.size);
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);

    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    let lastEntry: JsonlEntry | null = null;
    let lastToolName: string | null = null;

    // Single backward scan: find last valid entry AND last tool_use
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        // Capture last valid entry (first one found scanning backward)
        if (!lastEntry && obj && typeof obj === 'object' && typeof obj.type === 'string') {
          lastEntry = obj as JsonlEntry;
        }
        // Capture last tool_use name (first assistant with tool_use scanning backward)
        if (!lastToolName && obj.type === 'assistant') {
          const content = obj.message?.content;
          if (Array.isArray(content)) {
            for (const c of content) {
              if (c.type === 'tool_use' && typeof c.name === 'string') {
                lastToolName = c.name;
                break;
              }
            }
          }
        }
        // Stop early when both found
        if (lastEntry && lastToolName) break;
      } catch {
        continue;
      }
    }

    return { lastEntry, lastToolName };
  } catch {
    return { lastEntry: null, lastToolName: null };
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}
```

**Key detail:** The existing `readLastJsonlLine` tries up to 3 lines for the last entry (mid-write race condition handling). The combined function uses a simpler approach -- it scans backward through ALL lines for both targets. Since we are already iterating backward for tool_use, the fallback behavior is naturally preserved. The first valid entry found scanning backward IS the last entry (or the second-to-last if the last line was mid-write).

**Integration in session-detector.ts:**
```typescript
// BEFORE (2 file opens):
const lastEntry = readLastJsonlLine(filePath);
const lastToolName = readLastToolUse(filePath);

// AFTER (1 file open):
const { lastEntry, lastToolName } = readSessionTail(filePath);
```

### Pattern 2: Async Session Discovery (IO-02)

**What:** Convert `discoverSessions()` from synchronous to async using `fs.promises` equivalents.

**When to use:** Every poll cycle (3s intervals).

**Implementation approach:**

1. Change `SessionDetector` interface:
```typescript
export interface SessionDetector {
  discoverSessions(): Promise<SessionInfo[]>;  // was SessionInfo[]
  pruneStaleEntries?(activeSessionIds: Set<string>): void;
}
```

2. Convert `FilesystemSessionDetector`:
- Replace `fs.existsSync` with try-catch around `fs.promises.readdir`
- Replace `fs.readdirSync` with `await fs.promises.readdir`
- Replace `fs.statSync` with `await fs.promises.stat`
- Convert `readSessionTail` to async using `fs.promises.open` + `FileHandle.read()` + `fileHandle.close()`
- Use sequential `for...of` + `await` for the outer project directory loop (not `Promise.all`)
- Handle `ENOENT` at every `await` site (file/dir deleted between listing and access)

3. Update `SessionStore.poll()`:
```typescript
// BEFORE:
const discovered = this.detector.discoverSessions();

// AFTER:
const discovered = await this.detector.discoverSessions();
```
The `poll()` method is already `async`, so this is a one-line change at the call site.

**Critical detail -- sequential vs. parallel:**
- Outer loop (project directories): Use sequential `for...of` + `await`. Only 2-8 directories. Parallel gains are negligible. Sequential preserves deterministic ordering and minimizes TOCTOU windows.
- Inner loop (files within a directory): CAN use `Promise.all` for parallelism since files are independent. But given the small number of files per directory (typically 1-5 JSONL files), sequential is simpler and sufficient. Start sequential; only parallelize if profiling shows a bottleneck.

**Also convert `UsageAggregator.getUsage()`:**
The `statSync` call in `UsageAggregator.getUsage()` (line 15) also blocks. Convert to `await fs.promises.stat()`. This is already inside an async method, so no interface changes needed.

### Pattern 3: Incremental JSONL Usage Parsing (IO-03)

**What:** Track byte offset where the previous parse ended. On next mtime change, seek to that offset and parse only newly-appended bytes.

**When to use:** Every poll cycle where a session's JSONL file has a new mtime.

**Implementation approach:**

1. Extend the cache shape:
```typescript
private cache = new Map<string, {
  mtimeMs: number;
  totals: TokenUsageTotals;
  byteOffset: number;  // byte position where last parse ended
  ino: number;         // file inode for replacement detection
}>();
```

2. Add incremental read function to `jsonl-reader.ts`:
```typescript
export async function readUsageTotalsIncremental(
  filePath: string,
  fromOffset: number,
  existingTotals: TokenUsageTotals
): Promise<{ totals: TokenUsageTotals; newOffset: number }> {
  const totals = { ...existingTotals };
  let stream: fs.ReadStream | null = null;
  let newOffset = fromOffset;

  try {
    stream = fs.createReadStream(filePath, {
      encoding: 'utf-8',
      start: fromOffset,
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    let isFirstLine = fromOffset > 0;
    for await (const line of rl) {
      // If resuming mid-file, discard first partial line
      // (offset may land in the middle of a line)
      if (isFirstLine) {
        isFirstLine = false;
        // Only discard if offset > 0 (mid-file resume)
        // The first "line" may be the tail of a partially-read previous line
        // Skip it to be safe -- at worst we miss one entry that was already counted
        continue;
      }

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
        // Malformed line -- skip
      }
    }

    // Calculate new offset from file size (not from bytes read)
    const stat = fs.statSync(filePath);
    newOffset = stat.size;
  } catch {
    // Fall back: return existing totals, keep old offset
    return { totals: existingTotals, newOffset: fromOffset };
  } finally {
    if (stream) stream.destroy();
  }

  return { totals, newOffset };
}
```

3. Update `UsageAggregator.getUsage()`:
```typescript
async getUsage(sessionId: string, filePath: string): Promise<TokenUsageTotals | null> {
  try {
    const stat = await fs.promises.stat(filePath);
    const cached = this.cache.get(sessionId);

    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.totals;  // File unchanged
    }

    // Detect truncation or file replacement
    const needsFullReparse =
      !cached ||
      stat.size < cached.byteOffset ||  // truncation
      stat.ino !== cached.ino;           // inode change (file replaced)

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

    // Incremental: read only new bytes
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
    return null;
  }
}
```

**Critical safety checks (MUST implement before the offset logic):**
- `stat.size < cached.byteOffset` -- truncation detection. Reset to full re-parse.
- `stat.ino !== cached.ino` -- file replacement detection. Reset to full re-parse.
- First partial line discard when `fromOffset > 0` -- offset may land mid-line.

**Windows `stat.ino` caveat:** On Windows (NTFS), `stat.ino` returns 0 for all files by default in older Node.js versions. However, Node.js 24.x (Electron 40) returns proper file IDs on NTFS. If `ino` is unreliable, fall back to comparing `stat.size < cached.byteOffset` only -- this covers the primary truncation case. File replacement (delete + create same path) is rare for Claude Code JSONL files.

### Pattern 4: Adaptive Poll Backoff (IO-04)

**What:** When no sessions are active for consecutive poll cycles, stretch the poll interval from 3s up to 10-30s. Reset immediately when a session appears.

**When to use:** Always (replaces fixed-interval polling).

**Implementation approach:**

1. Replace `setInterval` with `setTimeout` recursion in `SessionStore`:
```typescript
export class SessionStore {
  private sessions: Map<string, SessionInfo> = new Map();
  private pollTimeout: ReturnType<typeof setTimeout> | null = null;
  private consecutiveEmpty = 0;

  start(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.poll();  // Immediate first poll
    this.schedulePoll();
  }

  stop(): void {
    if (this.pollTimeout !== null) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    this.mainWindow = null;
  }

  private schedulePoll(): void {
    const interval = this.getNextInterval();
    this.pollTimeout = setTimeout(() => {
      this.poll();
      this.schedulePoll();
    }, interval);
  }

  private getNextInterval(): number {
    if (this.consecutiveEmpty === 0) return POLL_INTERVAL_MS;  // 3s when active
    // Linear backoff: 3s -> 5s -> 8s -> 12s -> ... -> 30s cap
    return Math.min(
      MAX_POLL_INTERVAL_MS,  // 30s cap
      POLL_INTERVAL_MS + (this.consecutiveEmpty * BACKOFF_STEP_MS)
    );
  }

  private async poll(): Promise<void> {
    // ... existing logic ...
    // After discovering sessions:
    if (discoveredIds.size === 0) {
      this.consecutiveEmpty++;
    } else {
      this.consecutiveEmpty = 0;  // Immediate reset
    }
  }
}
```

2. Add constants:
```typescript
// constants.ts or inline in session-store.ts
const MAX_POLL_INTERVAL_MS = 30_000;  // 30s maximum backoff
const BACKOFF_STEP_MS = 3000;         // Each empty cycle adds 3s
```

**Key detail:** The `consecutiveEmpty` counter resets to 0 the instant ANY session is discovered -- not gradually. This ensures the 3s polling resumes instantly when a user starts a Claude Code session.

**Backoff curve with BACKOFF_STEP_MS = 3000:**
| Consecutive empty polls | Interval |
|------------------------|----------|
| 0 | 3s (normal) |
| 1 | 6s |
| 2 | 9s |
| 3+ | 12s, 15s, ... capped at 30s |

This reaches the 30s cap after 9 consecutive empty polls (27 seconds of no sessions). Acceptable: if nobody has had a session for 27 seconds, waiting up to 30s for the next poll is fine.

### Anti-Patterns to Avoid

- **`Promise.all` for the outer directory scan:** Creates TOCTOU windows and non-deterministic ordering. Use sequential `for...of` + `await`. Only 2-8 project directories -- parallel offers no measurable benefit.

- **Converting CPU-bound operations to async:** Regex matching (`UUID_JSONL_REGEX.test`), string splitting, `JSON.parse` -- these are CPU-bound and should remain synchronous within the async flow. Only I/O operations (`stat`, `read`, `readdir`) benefit from async.

- **Combining detector tail-read with aggregator full-read:** Different data volumes (4KB tail vs. full file), different cache semantics, different error handling. Keep them separate. The detector reads the tail; the aggregator reads incrementally from its last offset. The research (PITFALLS.md Pitfall 7) confirms this is the correct approach.

- **Exponential backoff without a cap:** Exponential leads to unacceptable detection latency (24s+). Use linear backoff with a hard 30s cap.

- **Replacing `existsSync` with `fs.promises.access` before `readdir`:** Node.js docs explicitly recommend against access-then-open (TOCTOU). Instead, just try `readdir` and catch `ENOENT`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async file iteration | Custom file walker with generators | `fs.promises.readdir` + `for...of` | Built-in, handles encoding, returns Dirents |
| Incremental line parsing from byte offset | Manual buffer management with newline scanning | `createReadStream({ start })` + `readline.createInterface` | readline handles UTF-8 decoding, buffer boundaries, CRLF normalization automatically |
| Dynamic interval scheduling | Custom timer manager class | `setTimeout` recursion with `clearTimeout` cleanup | Standard pattern, zero overhead, no state management needed |
| File change detection | `fs.watch` / chokidar for JSONL files | mtime cache comparison (existing pattern) | `fs.watch` on Windows is unreliable for recursive watching; mtime polling is already proven in this codebase |

**Key insight:** Every optimization in this phase uses existing Node.js APIs applied to existing code patterns. The complexity is not in the APIs but in the correctness edge cases (truncation detection, async race conditions, partial line handling).

## Common Pitfalls

### Pitfall 1: Async Race Conditions in Session Discovery
**What goes wrong:** Converting `readdirSync` to `await readdir` introduces TOCTOU windows. A JSONL file can be deleted between `readdir` returning its name and `stat` reading its metadata. With sync I/O the window is microseconds; with async, other operations interleave during `await`, widening it to milliseconds.
**Why it happens:** Sync-to-async conversion appears mechanical but introduces yield points at every `await`.
**How to avoid:** Handle `ENOENT` at every `await stat()` and `await read()` site. Use sequential `for...of` (not `Promise.all`) for the outer project directory scan. Capture mtime from a single `stat()` and pass it through atomically.
**Warning signs:** Intermittent ENOENT errors in logs, session status flickering, sessions appearing/disappearing briefly.

### Pitfall 2: Incremental Parsing Breaks on File Truncation
**What goes wrong:** Stored offset points past end-of-file after truncation. Reading from `offset > file.size` returns empty data. Accumulated totals become stale.
**Why it happens:** Incremental parsing works perfectly for append-only files. Truncation violates the append-only assumption.
**How to avoid:** Before every incremental read, check `stat.size < storedOffset` (truncation) AND `stat.ino !== cached.ino` (file replacement). Fall back to full re-parse on either condition. Implement these checks BEFORE the offset read logic, not after.
**Warning signs:** Token totals drop to zero, stale counts that never update, JSON parse errors during incremental reads.

### Pitfall 3: First Partial Line After Offset Resume
**What goes wrong:** When reading from a byte offset, the first bytes may be the tail of a previously-read line. Parsing this fragment produces a JSON error or (worse) parses as a different entry.
**Why it happens:** The stored offset points to the last byte read, not necessarily to a line boundary.
**How to avoid:** When `fromOffset > 0`, discard the first line read by `readline`. This line may be a partial fragment. Store the offset as file size after the read completes (which is a known-good boundary).
**Warning signs:** Inflated token totals (partial line parsed as different entry), sporadic JSON parse errors only on incremental reads.

### Pitfall 4: Poll Backoff Makes New Sessions Feel Slow
**What goes wrong:** When polling is backed off to 30s, a newly started Claude Code session takes up to 30 seconds to appear. User thinks the app is broken.
**Why it happens:** Activity can only be detected by polling. Longer intervals mean longer detection latency.
**How to avoid:** Cap maximum backoff at 30s (not exponential). Reset `consecutiveEmpty` to 0 immediately when ANY session is discovered. Use linear backoff so the curve is predictable. A 30s worst-case detection latency is acceptable because it only occurs when NO sessions have existed for ~27 seconds.
**Warning signs:** New sessions take noticeably longer than 3s to appear after extended idle periods.

### Pitfall 5: Mtime Cache Coherence Between Detector and Aggregator
**What goes wrong:** Both `FilesystemSessionDetector` and `UsageAggregator` maintain independent mtime caches. After converting to async, both call `stat()` independently -- the file could change between the detector's stat and the aggregator's stat. Result: detector sees one mtime, aggregator sees a different mtime, caches desync.
**Why it happens:** Each component is independently correct but they read the same file at slightly different times.
**How to avoid:** Keep the caches independent (they are today and it works). The detector caches `{ mtimeMs, sessionInfo }`, the aggregator caches `{ mtimeMs, totals, byteOffset, ino }`. Both are mtime-gated independently. A one-poll-cycle desync between them is harmless -- the next poll will pick up the change. Do NOT try to share a single stat result between them.
**Warning signs:** This is mostly a theoretical concern. If seen: dashboard shows stale token counts for exactly one poll cycle after a status change.

## Code Examples

### Async readSessionTail (combined + async)
```typescript
// Source: Node.js fs.promises.open + FileHandle.read() API
export async function readSessionTail(
  filePath: string,
  bufferSize: number = JSONL_TAIL_BUFFER_SIZE
): Promise<SessionTailResult> {
  let fh: fs.promises.FileHandle | null = null;
  try {
    fh = await fs.promises.open(filePath, 'r');
    const stat = await fh.stat();
    if (stat.size === 0) return { lastEntry: null, lastToolName: null };

    const readSize = Math.min(bufferSize, stat.size);
    const buffer = Buffer.alloc(readSize);
    await fh.read(buffer, 0, readSize, stat.size - readSize);

    // ... same parsing logic as sync version ...
  } catch {
    return { lastEntry: null, lastToolName: null };
  } finally {
    await fh?.close().catch(() => {});
  }
}
```

### Async discoverSessions outer loop
```typescript
// Source: Node.js fs.promises.readdir + sequential for...of
async discoverSessions(): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  try {
    const projectDirs = await fs.promises.readdir(this.claudeProjectsDir, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const dirPath = path.join(this.claudeProjectsDir, dir.name);
      await this.scanProjectDirectory(dirPath, dir.name, sessions);
    }
  } catch (err) {
    // Directory doesn't exist or permission error
    console.warn('[session-detector] Error scanning projects directory:', (err as Error).message);
  }
  return sessions;
}
```

### Incremental read with truncation detection
```typescript
// Source: Node.js createReadStream({ start }) + readline
const stat = await fs.promises.stat(filePath);
const cached = this.cache.get(sessionId);

const needsFullReparse = !cached
  || stat.size < cached.byteOffset   // truncation
  || stat.ino !== cached.ino;          // file replaced

if (needsFullReparse) {
  // Full parse from byte 0
  const totals = await readUsageTotals(filePath);
  this.cache.set(sessionId, { mtimeMs: stat.mtimeMs, totals, byteOffset: stat.size, ino: stat.ino });
  return totals;
}

// Incremental parse from last offset
const stream = fs.createReadStream(filePath, { encoding: 'utf-8', start: cached.byteOffset });
// ... readline parsing of new lines only ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.readFileSync` everywhere | `fs.promises` for I/O, sync for CPU-bound | Node.js 10+ (2018) | Non-blocking main process |
| Full file re-read on change | Offset-based incremental read | Standard log-tailing pattern (Filebeat, etc.) | O(delta) vs O(n) per poll |
| Fixed-interval polling | Adaptive polling with backoff | Common pattern | Near-zero idle I/O |

**Deprecated/outdated:**
- `fs.exists()` -- deprecated since Node.js 1.0. Use try-catch around the actual operation.
- `fs.readFile` callback API -- still works but `fs.promises` is the modern equivalent.

## Open Questions

1. **Windows `stat.ino` reliability in Node.js 24**
   - What we know: Node.js 24 on Windows NTFS should return proper file IDs (not 0). Earlier Node.js versions returned 0.
   - What's unclear: Whether the Electron 40 bundled Node.js correctly populates `stat.ino` on NTFS.
   - Recommendation: Implement inode check but add a fallback: if `stat.ino === 0`, skip the inode comparison and rely solely on `stat.size < offset` for truncation detection. Test empirically on the target machine.

2. **Optimal backoff step size**
   - What we know: Linear backoff with 3s step reaches 30s cap in ~27 seconds. Acceptable for this use case.
   - What's unclear: Whether users will perceive the 30s detection latency as too slow.
   - Recommendation: Start with `BACKOFF_STEP_MS = 3000` and `MAX_POLL_INTERVAL_MS = 30000`. Tune if user feedback indicates sluggishness. Constants are easy to adjust.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` |
| Config file | None (built-in, no config needed) |
| Quick run command | `npx tsx --test src/main/jsonl-reader.test.ts src/main/usage-aggregator.test.ts` |
| Full suite command | `npx tsx --test src/main/*.test.ts src/renderer/*.test.ts` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IO-01 | `readSessionTail` returns both lastEntry and lastToolName from single read | unit | `npx tsx --test src/main/jsonl-reader.test.ts` | Exists but needs new tests for `readSessionTail` |
| IO-01 | `readSessionTail` handles mid-write race (partial last line) | unit | `npx tsx --test src/main/jsonl-reader.test.ts` | Needs new test |
| IO-02 | `discoverSessions` returns Promise, does not block event loop | unit | `npx tsx --test src/main/session-detector.test.ts` | Does not exist -- Wave 0 |
| IO-02 | Async discovery handles ENOENT gracefully (file deleted between readdir and stat) | unit | `npx tsx --test src/main/session-detector.test.ts` | Does not exist -- Wave 0 |
| IO-03 | Incremental parse produces same totals as full parse | unit | `npx tsx --test src/main/usage-aggregator.test.ts` | Exists but needs incremental tests |
| IO-03 | Truncation detection resets to full re-parse | unit | `npx tsx --test src/main/usage-aggregator.test.ts` | Needs new test |
| IO-03 | First partial line after offset resume is discarded | unit | `npx tsx --test src/main/jsonl-reader.test.ts` | Needs new test |
| IO-04 | Poll interval increases when no sessions, resets on activity | unit | `npx tsx --test src/main/session-store.test.ts` | Does not exist -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsx --test src/main/jsonl-reader.test.ts src/main/usage-aggregator.test.ts`
- **Per wave merge:** `npx tsx --test src/main/*.test.ts`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/main/session-detector.test.ts` -- covers IO-02 (async discovery, ENOENT handling)
- [ ] `src/main/session-store.test.ts` -- covers IO-04 (poll backoff, consecutive empty counter, interval reset)
- [ ] New test cases in existing `jsonl-reader.test.ts` for `readSessionTail` (IO-01) and incremental parsing (IO-03)
- [ ] New test cases in existing `usage-aggregator.test.ts` for incremental parse, truncation detection, inode check (IO-03)

## Sources

### Primary (HIGH confidence)
- [Node.js fs API documentation](https://nodejs.org/api/fs.html) -- `fs.promises`, `FileHandle.read()`, `createReadStream({ start })`, `stat.ino`
- Direct source code analysis of: `src/main/session-detector.ts`, `src/main/jsonl-reader.ts`, `src/main/usage-aggregator.ts`, `src/main/session-store.ts`, `src/shared/constants.ts`, `src/shared/types.ts`
- Existing test files: `src/main/jsonl-reader.test.ts`, `src/main/usage-aggregator.test.ts` -- established patterns for `node:test` framework usage
- [Electron 40.0.0 release notes](https://www.electronjs.org/blog/electron-40-0) -- Node.js 24.x bundled with Electron 40

### Secondary (MEDIUM confidence)
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance) -- prefer async I/O in main process
- [Elastic Filebeat log rotation docs](https://www.elastic.co/guide/en/beats/filebeat/current/file-log-rotation.html) -- offset tracking with truncation/rotation detection pattern

### Tertiary (LOW confidence)
- Windows `stat.ino` behavior on NTFS in Node.js 24 -- needs empirical verification on target machine

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all APIs are stable Node.js built-ins, verified against official docs, available for 7+ major versions
- Architecture: HIGH -- based on direct source code analysis of all four affected files, with line-by-line understanding of current behavior
- Pitfalls: HIGH -- all pitfalls identified from PITFALLS.md research and verified against official Node.js documentation and established patterns (Filebeat offset tracking, async I/O race conditions)

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable APIs, 30-day window)

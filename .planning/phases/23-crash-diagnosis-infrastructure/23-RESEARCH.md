# Phase 23: Crash Diagnosis Infrastructure - Research

**Researched:** 2026-03-16
**Domain:** Electron error handling, persistent logging, memory monitoring
**Confidence:** HIGH

## Summary

This phase adds crash capture, error boundaries, persistent logging, and memory health monitoring to the Agent World Electron app. The primary tools are `electron-log` (v5.x) for persistent file logging with rotation, built-in Electron APIs for crash/process-gone detection, and Node.js `process.memoryUsage()` for heap monitoring. The app currently has zero crash handling infrastructure -- all errors go to console.log and are lost when the process dies.

The implementation is straightforward because the CONTEXT.md decisions are well-scoped: log to file, wrap the game loop tick, sample memory periodically, and check for previous crashes on startup. No UI indicators, no dashboards, no user-facing notifications. Pure diagnostic plumbing.

**Primary recommendation:** Use `electron-log/main` in the main process with a custom `resolvePathFn` pointing to `app.getPath('userData')/crash.log`, add `render-process-gone` and `uncaughtException` handlers in `src/main/index.ts`, wrap `world.tick()` in `src/renderer/game-loop.ts`, and add a 60-second memory sampling interval in the renderer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation decisions delegated to Claude. The following are Claude's recommended approaches from the discussion phase:

- Log to `~/.agent-world/crash.log` (follows existing data directory pattern)
- Use `electron-log` (^5.4) for persistent file logging
- Append-only format with ISO timestamps and stack traces
- Rotate/truncate at reasonable size to prevent unbounded growth
- Both main process and renderer crashes logged to same file
- Wrap `world.tick()` in try/catch -- log exception, continue ticking
- If same error repeats rapidly (5x in 10 seconds), stop ticker and log critical error
- No UI indicator for caught exceptions -- log silently
- Sample heap stats every 60 seconds using `process.memoryUsage()` (renderer) and `process.getHeapStatistics()` (main)
- Log warning entry when heap grows >50MB over a 10-minute window (sustained trend)
- Memory stats appended to crash log file
- On startup, check crash.log for entries from last run and log console message
- No user-facing notification for previous crashes

### Claude's Discretion
All decisions delegated to Claude -- no additional discretion areas.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DIAG-01 | App captures crash events (render-process-gone, uncaughtException, window.onerror) and logs them to a persistent file | electron-log file transport with custom resolvePathFn; Electron `render-process-gone` event with RenderProcessGoneDetails; `process.on('uncaughtException')` in main; `window.onerror`/`window.onunhandledrejection` in renderer bridged via IPC |
| DIAG-02 | Game loop tick is wrapped in an error boundary so a single exception doesn't silently freeze the app | try/catch around `this.world.tick(ticker.deltaMS)` in GameLoop.start(); rapid-repeat detection with counter+timestamp; ticker stop on critical threshold |
| DIAG-03 | Crash events are logged to a persistent file via electron-log with timestamps and stack traces | electron-log v5 file transport; format string with ISO timestamps; stack trace captured from Error objects; maxSize rotation at 1MB default |
| DIAG-04 | Memory health monitor periodically logs heap statistics to detect growing memory before crash | 60-second setInterval with `process.memoryUsage()` in renderer; sliding window of 10 samples (10 minutes); >50MB sustained growth triggers warning log entry |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-log | ^5.4 | Persistent file logging across main/renderer | Only mature Electron logging library with built-in IPC bridging, file rotation, and zero dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron (built-in) | 40.6.1 | `render-process-gone` event, `process.getHeapStatistics()` | Crash detection, memory stats in main process |
| Node.js (built-in) | 24.x | `process.memoryUsage()`, `process.on('uncaughtException')` | Memory stats in renderer, unhandled exception capture |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-log | electron-unhandled | electron-unhandled only handles errors, no file logging -- would still need a file logger |
| electron-log | winston | Heavyweight, complex config, not Electron-aware (no IPC bridging) |
| electron-log | Manual fs.appendFileSync | Loses rotation, formatting, cross-process IPC for free -- hand-rolling what electron-log already does |

**Installation:**
```bash
npm install electron-log@^5.4
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  main/
    index.ts           # Add crash handlers, electron-log init, startup crash check
    crash-logger.ts     # NEW: CrashLogger class -- encapsulates electron-log setup, memory monitor (main-side), startup check
  renderer/
    game-loop.ts        # Wrap world.tick() in try/catch with rapid-repeat detection
    index.ts            # Add window.onerror/onunhandledrejection handlers
    memory-monitor.ts   # NEW: MemoryMonitor class -- 60s sampling, trend detection, IPC to main for logging
  preload/
    preload.ts          # Add IPC channel for renderer->main error/memory reporting
  shared/
    types.ts            # Add IPC channel constants for crash logging
```

### Pattern 1: Centralized Crash Logger (Main Process)
**What:** A single CrashLogger class in the main process owns the electron-log instance and all file I/O. Renderer errors are bridged via IPC.
**When to use:** Always -- this is the core pattern for the phase.
**Example:**
```typescript
// src/main/crash-logger.ts
import log from 'electron-log/main';
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

export class CrashLogger {
  private logPath: string;

  constructor() {
    this.logPath = path.join(app.getPath('userData'), 'crash.log');

    // Configure electron-log file transport
    log.transports.file.resolvePathFn = () => this.logPath;
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    log.transports.file.maxSize = 1048576; // 1MB, then rotate to .old.log

    // Disable console transport (we don't want double-logging)
    log.transports.console.level = false;

    // Initialize IPC bridge for renderer logging
    log.initialize();
  }

  logCrash(source: string, reason: string, details?: string): void {
    log.error(`[CRASH] ${source}: ${reason}${details ? ' -- ' + details : ''}`);
  }

  logError(source: string, error: Error | string): void {
    const msg = error instanceof Error
      ? `${error.message}\n${error.stack}`
      : error;
    log.error(`[ERROR] ${source}: ${msg}`);
  }

  logMemoryWarning(message: string): void {
    log.warn(`[MEMORY] ${message}`);
  }

  logMemoryStats(stats: { heapUsedMB: number; rssMB: number }): void {
    log.info(`[MEMORY] heap=${stats.heapUsedMB.toFixed(1)}MB rss=${stats.rssMB.toFixed(1)}MB`);
  }

  getLogPath(): string {
    return this.logPath;
  }

  checkPreviousCrash(): void {
    // Check if crash.log exists and has error-level entries
    // Log to console (not file) for developer convenience
  }
}
```

### Pattern 2: Error Boundary in Game Loop
**What:** try/catch wrapper around `world.tick()` with rapid-repeat detection to prevent error spam.
**When to use:** In GameLoop.start() ticker callback.
**Example:**
```typescript
// In GameLoop.start()
private errorCount = 0;
private errorWindowStart = 0;
private stopped = false;

this.tickerCallback = (ticker: { deltaMS: number }) => {
  if (this.stopped) return;
  try {
    this.world.tick(ticker.deltaMS);
    // Reset error count on successful tick
    this.errorCount = 0;
  } catch (err) {
    const now = Date.now();
    if (now - this.errorWindowStart > 10000) {
      // New 10-second window
      this.errorCount = 1;
      this.errorWindowStart = now;
    } else {
      this.errorCount++;
    }

    // Log the error (via IPC to main process)
    window.agentWorld.logError('game-loop', err instanceof Error ? err.message : String(err), err instanceof Error ? err.stack : undefined);

    if (this.errorCount >= 5) {
      // Critical: same error repeating rapidly, stop ticker
      window.agentWorld.logCritical('game-loop', 'Ticker stopped: 5+ errors in 10 seconds');
      this.stop();
      this.stopped = true;
    }
  }
};
```

### Pattern 3: Memory Trend Detection (Sliding Window)
**What:** Sample heap every 60s, keep last 10 samples (10 minutes), detect sustained growth.
**When to use:** In renderer process via setInterval.
**Example:**
```typescript
// src/renderer/memory-monitor.ts
const SAMPLE_INTERVAL_MS = 60_000; // 60 seconds
const WINDOW_SIZE = 10; // 10 samples = 10 minutes
const GROWTH_THRESHOLD_MB = 50;

export class MemoryMonitor {
  private samples: number[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.intervalId = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
  }

  private sample(): void {
    const mem = process.memoryUsage();
    const heapMB = mem.heapUsed / (1024 * 1024);
    this.samples.push(heapMB);

    if (this.samples.length > WINDOW_SIZE) {
      this.samples.shift();
    }

    // Report stats via IPC
    window.agentWorld.logMemoryStats({
      heapUsedMB: heapMB,
      rssMB: mem.rss / (1024 * 1024),
    });

    // Check for sustained growth
    if (this.samples.length >= WINDOW_SIZE) {
      const oldest = this.samples[0];
      const newest = this.samples[this.samples.length - 1];
      if (newest - oldest > GROWTH_THRESHOLD_MB) {
        window.agentWorld.logMemoryWarning(
          `Heap grew ${(newest - oldest).toFixed(1)}MB over ${WINDOW_SIZE} minutes ` +
          `(${oldest.toFixed(1)}MB -> ${newest.toFixed(1)}MB)`
        );
      }
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

### Anti-Patterns to Avoid
- **Logging in renderer to file directly:** The renderer process should NOT import `fs` or write to disk. All file I/O goes through IPC to the main process. electron-log handles this automatically when initialized properly.
- **Catching errors silently without logging:** Every catch block must log. The whole point of this phase is that no failure is silent.
- **Using console.log for crash data:** console.log is lost when the process dies. Only electron-log file transport survives crashes.
- **Unbounded log growth:** Always set `maxSize` on the file transport. Without rotation, crash.log could grow indefinitely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File logging with rotation | Custom fs.appendFile + size checking + rename | electron-log file transport with maxSize | Handles atomic writes, encoding, rotation, cross-process IPC |
| Renderer-to-main error bridging | Custom IPC channel + serialization | electron-log's built-in IPC bridge via `log.initialize()` | Handles serialization, stack traces, process identification automatically |
| Log formatting with timestamps | Manual `new Date().toISOString() + ...` | electron-log format string `[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}` | Consistent, configurable, includes all context |

**Key insight:** electron-log was purpose-built for exactly this scenario. It handles the tricky parts (cross-process logging, file rotation, atomic writes on Windows) that are deceptively complex to hand-roll correctly.

## Common Pitfalls

### Pitfall 1: electron-log initialize() Must Be Called Before Window Creation
**What goes wrong:** Renderer-side logging silently fails (messages never reach main process).
**Why it happens:** `log.initialize()` injects a preload script into Electron sessions. If called after the BrowserWindow is created, the session misses the injection.
**How to avoid:** Call `log.initialize()` early in `src/main/index.ts`, before `app.on('ready', createWindow)`. Since the project uses Webpack with an explicit preload file, the safer approach is to import `electron-log/preload` in the existing preload script instead of relying on `log.initialize()` session injection.
**Warning signs:** `log.info()` calls in renderer produce no file output.

### Pitfall 2: process.memoryUsage() Not Available in Sandboxed Renderer
**What goes wrong:** `process.memoryUsage()` returns undefined or throws in the renderer.
**Why it happens:** The project uses `contextIsolation: true` and `nodeIntegration: false`, so the renderer's `process` object is limited.
**How to avoid:** Use `performance.memory.usedJSHeapSize` in the renderer (available in Chromium), or call `process.memoryUsage()` from the preload script and expose it via contextBridge. Alternatively, run memory monitoring entirely in the main process using `process.memoryUsage()` and `process.getHeapStatistics()` which are always available.
**Warning signs:** `TypeError: process.memoryUsage is not a function` in renderer console.

### Pitfall 3: uncaughtException Handler Keeps Process Alive in Broken State
**What goes wrong:** After catching an uncaughtException in the main process, the app continues in a corrupt state.
**Why it happens:** Node.js docs explicitly warn that `uncaughtException` is a "last resort" and the process should exit after logging.
**How to avoid:** Log the error to file, then call `app.exit(1)` after a short delay to allow the file write to flush. Do NOT attempt to continue normal operation after a main process uncaughtException.
**Warning signs:** App appears frozen or behaves unpredictably after an unhandled error.

### Pitfall 4: render-process-gone Handler Fires After Window Is Destroyed
**What goes wrong:** Attempting to access `mainWindow.webContents` in the handler throws because the window is already gone.
**Why it happens:** The renderer process crash destroys the webContents. The event fires on the main process side.
**How to avoid:** Only log to file in the handler. Don't try to interact with the window. The handler receives the details directly as a parameter.
**Warning signs:** Secondary crash in the crash handler itself.

### Pitfall 5: electron-log with Webpack Requires Correct Import Paths
**What goes wrong:** Build fails or runtime error with "Cannot find module 'electron-log/main'" in webpack-bundled app.
**Why it happens:** Webpack may not resolve the sub-path exports correctly for electron-log's `main`, `renderer`, and `preload` entry points.
**How to avoid:** electron-log v5 uses package.json `exports` field which webpack 5 supports. If issues arise, add electron-log to webpack externals for the main process config. The renderer import (`electron-log/renderer`) should work through the webpack bundler.
**Warning signs:** Module resolution errors at build time.

### Pitfall 6: Log Path Discrepancy -- CONTEXT.md vs Actual Code
**What goes wrong:** CONTEXT.md says `~/.agent-world/crash.log` but the codebase uses `app.getPath('userData')` for HistoryStore.
**Why it happens:** The discussion referenced a simplified path. On Windows, `app.getPath('userData')` resolves to `%APPDATA%/agent-world/`, not `~/.agent-world/`.
**How to avoid:** Use `app.getPath('userData')` consistently. This is what HistoryStore uses and is the correct cross-platform approach. The crash.log should be at `path.join(app.getPath('userData'), 'crash.log')`.
**Warning signs:** crash.log written to wrong location, not found on restart.

## Code Examples

### Existing Integration Points

**Main process entry (src/main/index.ts line 49):** Currently has `console-message` bridge:
```typescript
mainWindow.webContents.on('console-message', (event) => {
  console.log(`[renderer] ${event.message}`);
});
```
This will be supplemented (not replaced) by electron-log IPC.

**Game loop tick (src/renderer/game-loop.ts line 27-29):** Current unprotected tick:
```typescript
this.tickerCallback = (ticker: { deltaMS: number }) => {
  this.world.tick(ticker.deltaMS);
};
```
Needs try/catch wrapper with rapid-repeat detection.

**Preload script (src/preload/preload.ts):** Current contextBridge API:
```typescript
contextBridge.exposeInMainWorld('agentWorld', { ... });
```
Needs new IPC methods: `logError()`, `logCritical()`, `logMemoryStats()`, `logMemoryWarning()`.

**IPC channels (src/shared/types.ts line 29-34):** Current channels:
```typescript
export const IPC_CHANNELS = {
  SESSIONS_UPDATE: 'sessions-update',
  GET_INITIAL_SESSIONS: 'get-initial-sessions',
  DASHBOARD_UPDATE: 'dashboard-update',
  GET_HISTORY: 'get-history',
} as const;
```
Needs new channels for crash logging IPC (or use electron-log's built-in `__ELECTRON_LOG__` channel).

### electron-log Preload Integration (Recommended Approach)
```typescript
// In src/preload/preload.ts -- add at top
import 'electron-log/preload';

// This enables electron-log/renderer to work in the renderer process
// by bridging IPC automatically through the preload context.
```

### IPC API Extension for Crash Logging
```typescript
// Add to IAgentWorldAPI in src/shared/types.ts
logError: (source: string, message: string, stack?: string) => void;
logCritical: (source: string, message: string) => void;
logMemoryStats: (stats: { heapUsedMB: number; rssMB: number }) => void;
logMemoryWarning: (message: string) => void;

// Add to IPC_CHANNELS
CRASH_LOG_ERROR: 'crash-log-error',
CRASH_LOG_CRITICAL: 'crash-log-critical',
CRASH_MEMORY_STATS: 'crash-memory-stats',
CRASH_MEMORY_WARNING: 'crash-memory-warning',
```

### Renderer Error Handlers
```typescript
// In src/renderer/index.ts -- add before main()
window.onerror = (message, source, lineno, colno, error) => {
  window.agentWorld.logError(
    'renderer',
    `${message} at ${source}:${lineno}:${colno}`,
    error?.stack
  );
};

window.onunhandledrejection = (event) => {
  const reason = event.reason;
  window.agentWorld.logError(
    'renderer-promise',
    reason instanceof Error ? reason.message : String(reason),
    reason instanceof Error ? reason.stack : undefined
  );
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `webContents.on('crashed')` | `webContents.on('render-process-gone')` | Electron 8.4+ (deprecated), removed in recent versions | Must use `render-process-gone` with `RenderProcessGoneDetails` |
| electron-log v4 (global import) | electron-log v5 (sub-path imports) | v5.0 (2023) | Import from `electron-log/main`, `electron-log/renderer`, `electron-log/preload` |
| `process.memoryUsage()` everywhere | Limited in sandboxed renderer | Electron with `contextIsolation: true` | Use `performance.memory` in renderer, or bridge via preload/IPC |

**Deprecated/outdated:**
- `webContents.on('crashed')`: Removed in Electron 40. Use `render-process-gone` event.
- electron-log v4 single-import pattern: v5 requires sub-path imports (`electron-log/main`, `electron-log/renderer`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | None -- uses `node --test` directly |
| Quick run command | `npx tsx --test src/main/crash-logger.test.ts` |
| Full suite command | `npx tsx --test src/main/*.test.ts` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIAG-01 | Crash events written to log file | unit | `npx tsx --test src/main/crash-logger.test.ts` | No -- Wave 0 |
| DIAG-02 | Game loop tick error boundary with rapid-repeat detection | unit | `npx tsx --test src/renderer/game-loop.test.ts` | No -- Wave 0 |
| DIAG-03 | Log file format: timestamps, stack traces, rotation | unit | `npx tsx --test src/main/crash-logger.test.ts` | No -- Wave 0 |
| DIAG-04 | Memory trend detection over sliding window | unit | `npx tsx --test src/renderer/memory-monitor.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsx --test src/main/crash-logger.test.ts`
- **Per wave merge:** `npx tsx --test src/main/*.test.ts`
- **Phase gate:** All test files green before verify

### Wave 0 Gaps
- [ ] `src/main/crash-logger.test.ts` -- covers DIAG-01, DIAG-03 (log file creation, format, rotation behavior)
- [ ] `src/renderer/memory-monitor.test.ts` -- covers DIAG-04 (sliding window, threshold detection) -- note: this tests pure logic, not actual process.memoryUsage()
- [ ] DIAG-02 (game loop error boundary) is best verified by manual testing or integration test -- the rapid-repeat counter logic can be unit tested in isolation

**Note:** electron-log file I/O tests need mock or temp directory patterns. The existing test files (`jsonl-reader.test.ts`, `usage-aggregator.test.ts`) use `os.tmpdir()` for temp files -- follow the same pattern. DIAG-02's game-loop error boundary depends on PixiJS Application which is not testable outside Electron -- test the error counting logic separately.

## Open Questions

1. **electron-log + Webpack externals**
   - What we know: electron-log v5 uses `exports` field in package.json. Webpack 5 supports this.
   - What's unclear: Whether the main process webpack config needs `externals: ['electron-log']` to avoid bundling a Node.js module meant to run in the main process.
   - Recommendation: Try without externals first. If build fails, add `electron-log` to webpack externals for `mainConfig`. The existing project already handles `electron` as an external (standard for Forge).

2. **Memory monitoring: main process vs renderer**
   - What we know: `process.memoryUsage()` works in main process. In renderer with `contextIsolation: true`, it may not be available.
   - What's unclear: Whether the Forge webpack setup exposes `process.memoryUsage()` in the renderer bundle.
   - Recommendation: Run memory monitoring in the main process only. Use `process.memoryUsage()` for the main process heap. Use `webContents.getProcessMemoryInfo()` from the main process to get renderer memory without needing renderer-side code.

## Sources

### Primary (HIGH confidence)
- [Electron 40 docs - RenderProcessGoneDetails](https://www.electronjs.org/docs/latest/api/structures/render-process-gone-details) -- all reason values for renderer crash detection
- [Electron 40 docs - process API](https://www.electronjs.org/docs/latest/api/process) -- `getProcessMemoryInfo()`, `getHeapStatistics()` APIs
- [electron-log GitHub](https://github.com/megahertz/electron-log) -- v5 API, initialization, transport config
- [electron-log file transport docs](https://github.com/megahertz/electron-log/blob/master/docs/transports/file.md) -- maxSize, resolvePathFn, archiveLogFn
- [electron-log initialize docs](https://github.com/megahertz/electron-log/blob/master/docs/initialize.md) -- preload injection, renderer bridging

### Secondary (MEDIUM confidence)
- [electron-log npm](https://www.npmjs.com/package/electron-log) -- v5.4.x current, zero dependencies confirmed
- [electron-unhandled npm](https://www.npmjs.com/package/electron-unhandled) -- evaluated and excluded (logging-only, no file transport)

### Tertiary (LOW confidence)
- Memory monitoring in sandboxed renderer -- `process.memoryUsage()` availability needs runtime verification. Recommendation to use main-process-only monitoring avoids this uncertainty.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- electron-log v5 is well-documented, zero-dependency, purpose-built for Electron
- Architecture: HIGH -- patterns derived from codebase analysis and official Electron/electron-log docs
- Pitfalls: HIGH -- verified against official Electron 40 API docs and electron-log v5 migration guide

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, electron-log v5 is mature)

# Phase 19: Historical Persistence - Research

**Researched:** 2026-03-01
**Domain:** JSON file persistence for daily usage aggregates in Electron main process
**Confidence:** HIGH

## Summary

Phase 19 adds data persistence to the existing live dashboard so that closing and reopening Agent World preserves today's usage totals and past daily aggregates, and the dashboard shows a 30-day historical summary. The implementation is straightforward because Phase 18 already delivers all the data needed: `SessionStore.pushDashboardUpdate()` computes live `DashboardData` with per-session usage and `TodayTotals` on every poll cycle. Phase 19 adds a `HistoryStore` class that (a) persists today's aggregate as a daily record on each poll, (b) loads historical records from disk at startup, (c) exposes a 30-day summary to the renderer via a new IPC invoke channel, and (d) prunes records older than 30 days.

The storage format is a pre-aggregated JSON file with one record per day, stored at Electron's `app.getPath('userData')` directory (resolves to `C:\Users\dlaws\AppData\Roaming\Agent World\history.json` on Windows). At 30 days of data, this file is under 5KB -- trivially small, safe for synchronous read at startup, and safe for atomic write on each update. The atomic write pattern (write to `.tmp`, then `fs.renameSync` to target) is the standard approach, with a try/catch fallback for Windows NTFS EPERM/EBUSY errors caused by antivirus file locking.

No new npm dependencies are required. The entire feature uses Node.js built-ins (`fs`, `path`) and existing Electron APIs (`app.getPath`, `ipcMain.handle`). The renderer changes are minimal: the `DashboardPanel` adds a history summary section showing 30-day aggregate totals.

**Primary recommendation:** Build a `HistoryStore` class in the main process that owns a single JSON file, writes atomically with Windows EPERM retry, and exposes data to the renderer via `ipcMain.handle('get-history')`. Keep the renderer display simple -- a 30-day aggregate totals row in the dashboard, not a chart (Chart.js deferred to v1.6 per REQUIREMENTS.md out-of-scope).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIST-01 | Daily aggregates persisted to a JSON file for 30-day retention | HistoryStore class with atomic JSON writes, auto-pruning of records >30 days, stored at Electron userData path |
| HIST-02 | Dashboard shows 30-day aggregate total (tokens and cost) | New IPC `get-history` invoke returns `DailyAggregate[]`; renderer displays 30-day summary in dashboard totals area; data loaded once at startup + refreshed on day rollover |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` | built-in | Read/write JSON history file | Already used throughout the project; no dependency needed |
| `node:path` | built-in | Construct file paths for history store | Already used throughout the project |
| Electron `app.getPath` | 40.6.1 | Resolve platform-correct userData directory | Standard Electron pattern for persistent user data; handles Windows/Mac/Linux path differences |
| Electron `ipcMain.handle` | 40.6.1 | Expose history data to renderer via invoke/handle pattern | Already used for `get-initial-sessions`; request/response pattern is correct for one-time data loads |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:os` | built-in | Fallback home directory if app.getPath unavailable | Only if running outside Electron context (e.g., tests) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw JSON file | `write-file-atomic` npm package | Handles EPERM retry automatically, but adds a dependency for a problem solvable with 10 lines of try/catch. Not justified for a single file written at most once per poll cycle |
| `app.getPath('userData')` | `~/.agent-world/` (home directory) | Research originally suggested `~/.agent-world/`. Electron's `userData` is the standard location for app data, handles platform differences, and is what users expect. Use `userData` |
| JSON file | SQLite via `better-sqlite3` | Rejected in project research -- native module ABI rebuild per Electron version, overkill for 30 flat records |
| Synchronous startup read | Async startup read | History file is <5KB for 30 days; sync read adds <1ms latency. Async adds complexity for no measurable benefit |

**Installation:**
```bash
# No new packages needed -- all built-in
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main/
│   ├── history-store.ts        # NEW: HistoryStore class (persistence, pruning, atomic writes)
│   ├── session-store.ts        # MODIFIED: calls historyStore.recordTodayTotals() after dashboard push
│   ├── ipc-handlers.ts         # MODIFIED: adds get-history invoke handler
│   └── index.ts                # MODIFIED: creates HistoryStore, passes to SessionStore + IPC
├── shared/
│   └── types.ts                # MODIFIED: adds DailyAggregate, HistoryData, IPC channel constant
├── preload/
│   └── preload.ts              # MODIFIED: exposes getHistory() invoke method
└── renderer/
    ├── dashboard-panel.ts      # MODIFIED: adds 30-day history summary section
    └── index.ts                # MODIFIED: calls getHistory() at startup, passes to dashboard
```

### Pattern 1: HistoryStore — Single-Owner JSON Persistence

**What:** A class that owns a JSON file, loads it at construction, updates it in memory, and writes atomically to disk. No other code path reads or writes this file.

**When to use:** When persisting a small dataset (<100KB) that changes infrequently (once per poll cycle at most) and must survive app restarts.

**Key design:**
```typescript
// Source: Node.js fs docs + Electron app.getPath docs
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface DailyAggregate {
  date: string;           // YYYY-MM-DD
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
  cacheSavingsUsd: number;
  sessionCount: number;
}

interface HistoryFile {
  version: 1;
  days: Record<string, DailyAggregate>;  // keyed by YYYY-MM-DD
}

export class HistoryStore {
  private filePath: string;
  private data: HistoryFile;

  constructor(userDataPath?: string) {
    const dir = userDataPath ?? app.getPath('userData');
    this.filePath = path.join(dir, 'history.json');
    this.data = this.load();
  }

  private load(): HistoryFile {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && parsed?.days) {
        return parsed as HistoryFile;
      }
    } catch {
      // File doesn't exist or is corrupted -- start fresh
    }
    return { version: 1, days: {} };
  }
  // ...
}
```

### Pattern 2: Atomic Write with Windows EPERM Retry

**What:** Write to `.tmp` file, then rename to target. On Windows, `renameSync` can throw EPERM/EBUSY when antivirus briefly locks the target. Retry once after a short delay.

**When to use:** Any file write that must not corrupt data on crash or contention.

**Key design:**
```typescript
// Source: Node.js issue #29481, npm/write-file-atomic pattern
private save(): void {
  const tmpPath = this.filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
    try {
      fs.renameSync(tmpPath, this.filePath);
    } catch (renameErr: unknown) {
      // Windows NTFS: EPERM/EBUSY when target locked by antivirus
      const code = (renameErr as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EBUSY') {
        // Fallback: copy then unlink temp
        fs.copyFileSync(tmpPath, this.filePath);
        try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup failure */ }
      } else {
        throw renameErr;
      }
    }
  } catch (err) {
    console.warn('[history-store] Failed to save:', (err as Error).message);
    // Clean up temp file if it exists
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}
```

### Pattern 3: Today's Date Key for Rolling Aggregation

**What:** Use `YYYY-MM-DD` as the record key. On each poll cycle, update today's record in-place (overwrite, not accumulate -- today's totals come from live data). On day rollover, yesterday's record becomes immutable.

**When to use:** When aggregating data that arrives continuously but must be stored as daily snapshots.

**Key design:**
```typescript
recordTodayTotals(totals: TodayTotals): void {
  const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD

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
```

### Pattern 4: IPC Invoke for One-Time Data Load

**What:** Use `ipcMain.handle` / `ipcRenderer.invoke` for history data, not the push-based `webContents.send` used for live updates. History changes at most once per day -- it should be requested, not pushed every 3 seconds.

**When to use:** When the renderer needs data that changes infrequently and should be loaded on demand.

**Key design:**
```typescript
// main/ipc-handlers.ts
ipcMain.handle('get-history', async (): Promise<DailyAggregate[]> => {
  return historyStore.getHistory();
});

// preload/preload.ts
getHistory: (): Promise<DailyAggregate[]> => {
  return ipcRenderer.invoke('get-history');
},

// renderer/index.ts (at startup)
const history = await window.agentWorld.getHistory();
dashboardPanel.updateHistory(history);
```

### Anti-Patterns to Avoid

- **Writing history on every 3-second poll tick:** Today's totals are recomputed from live sessions on every poll. Writing to disk on every poll means ~20 writes/minute. Instead, write only when totals have actually changed (compare with last-written values), or throttle to once per minute.
- **Storing history in the renderer:** The renderer is the wrong place for persistence. The main process owns the filesystem and should be the single writer.
- **Including history in the `dashboard-update` IPC push:** History data (30 records) does not change on every poll. Including it in the 3-second push wastes IPC bandwidth. Use a separate invoke channel.
- **Accumulating totals across days:** Today's record should be overwritten (not incremented) on each update, because `TodayTotals` from Phase 18 is already a full aggregate. Incrementing would double-count.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write | Custom fsync + rename with platform detection | Simple write-tmp-then-rename with EPERM catch | The pattern is 15 lines; `write-file-atomic` npm package is overkill for one file |
| Date string formatting | Custom date formatter | `new Date().toISOString().slice(0, 10)` | Built-in, UTC-safe, zero dependencies |
| Platform-correct data directory | `os.homedir() + '/.agent-world/'` | `app.getPath('userData')` | Electron handles Windows/Mac/Linux; uses `%APPDATA%/Agent World` on Windows which is the standard location |

**Key insight:** The entire persistence layer is ~100 lines of code using Node.js built-ins. The problem space is small (30 daily records, one JSON file, one writer). No libraries are needed.

## Common Pitfalls

### Pitfall 1: History File Corruption on Crash

**What goes wrong:** `fs.writeFileSync()` directly to the history file can produce a zero-byte or truncated file if the process exits mid-write. On next startup, `JSON.parse` fails and all history is lost.
**Why it happens:** `writeFileSync` is not atomic -- it truncates the target file before writing new content. If the process crashes between truncation and write completion, the file is empty.
**How to avoid:** Write to `.tmp` file, then rename. Rename is atomic on most filesystems. On Windows, add EPERM/EBUSY retry (see Pattern 2).
**Warning signs:** `history.json` is 0 bytes after an unexpected app close; history resets to empty without user action.

### Pitfall 2: Windows NTFS Rename Failure (EPERM/EBUSY)

**What goes wrong:** `fs.renameSync(tmp, target)` throws EPERM or EBUSY on Windows when the target file is briefly locked by Windows Defender real-time scanning or the Windows Search indexer.
**Why it happens:** Antivirus software opens files for scanning immediately after they are written. If the rename fires while the target is still held open by the scanner, the OS rejects the rename.
**How to avoid:** Catch EPERM/EBUSY on rename and fall back to `copyFileSync` + `unlinkSync`. This is not a retry loop -- it is a single fallback attempt using a different filesystem operation that is less susceptible to the lock.
**Warning signs:** Console shows `EPERM: operation not permitted, rename` errors on Windows only; history file stops updating.

### Pitfall 3: Double-Counting Today's Totals by Accumulating Instead of Overwriting

**What goes wrong:** The `recordTodayTotals` method adds incoming totals to the existing daily record instead of replacing it. Since `TodayTotals` from Phase 18 is already a full aggregate (computed from all live sessions), adding it to a stored value doubles the count on every poll cycle.
**Why it happens:** The intuitive pattern for daily aggregation is "add new data to existing daily total." But Phase 18's `pushDashboardUpdate()` already computes the full aggregate on every poll -- there is no delta to add.
**How to avoid:** Overwrite today's record entirely on each update. The stored value for today is always the latest snapshot from `TodayTotals`, never an accumulation.
**Warning signs:** Today's token counts grow exponentially; restarting the app shows a much lower value than before the restart.

### Pitfall 4: Pruning Deletes Today's Record

**What goes wrong:** The pruning logic removes all records older than 30 days, but uses an off-by-one calculation that can delete today's record or yesterday's record.
**Why it happens:** Date math with "30 days ago" can be ambiguous about whether the boundary day is included or excluded. Timezone differences between UTC and local time can make today appear to be "yesterday" in UTC.
**How to avoid:** Keep records for dates where `date >= cutoffDate`. Use the same timezone (local) for both the record key and the cutoff calculation. Pruning should never touch today's record.
**Warning signs:** Today's totals disappear after midnight; the dashboard shows "no history" despite recent usage.

### Pitfall 5: Writing History Every 3 Seconds Creates Disk I/O Pressure

**What goes wrong:** `recordTodayTotals` is called on every poll cycle (every 3 seconds). Each call writes the full history JSON to disk. This means 20 writes per minute, 1200 writes per hour -- unnecessary I/O for data that changes slowly.
**Why it happens:** The simplest integration point is calling `historyStore.recordTodayTotals(todayTotals)` inside `pushDashboardUpdate()`, which runs every 3 seconds.
**How to avoid:** Throttle writes. Only write to disk when today's totals have materially changed (compare with last-written values) or on a timer (e.g., once per minute). Always write on `before-quit` to ensure the latest data is persisted before the app closes.
**Warning signs:** Disk activity LED flashes constantly; SSD wear concern for always-on application; write latency occasionally exceeds 100ms.

## Code Examples

### Complete HistoryStore Class (Skeleton)

```typescript
// src/main/history-store.ts
import * as fs from 'fs';
import * as path from 'path';
import { TodayTotals } from '../shared/types';

export interface DailyAggregate {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
  cacheSavingsUsd: number;
  sessionCount: number;
}

interface HistoryFile {
  version: 1;
  days: Record<string, DailyAggregate>;
}

const RETENTION_DAYS = 30;

export class HistoryStore {
  private filePath: string;
  private data: HistoryFile;
  private lastWrittenJson: string = '';

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'history.json');
    this.data = this.load();
  }

  private load(): HistoryFile {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && parsed?.days) return parsed;
    } catch { /* start fresh */ }
    return { version: 1, days: {} };
  }

  private save(): void {
    const json = JSON.stringify(this.data, null, 2);
    if (json === this.lastWrittenJson) return;  // Skip if nothing changed

    const tmpPath = this.filePath + '.tmp';
    try {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(tmpPath, json, 'utf-8');
      try {
        fs.renameSync(tmpPath, this.filePath);
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EPERM' || code === 'EBUSY') {
          fs.copyFileSync(tmpPath, this.filePath);
          try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        } else {
          throw err;
        }
      }
      this.lastWrittenJson = json;
    } catch (err) {
      console.warn('[history-store] Save failed:', (err as Error).message);
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }

  private prune(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    for (const date of Object.keys(this.data.days)) {
      if (date < cutoffStr) {
        delete this.data.days[date];
      }
    }
  }

  recordTodayTotals(totals: TodayTotals): void {
    const today = new Date().toISOString().slice(0, 10);
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

  getHistory(): DailyAggregate[] {
    return Object.values(this.data.days)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  get30DaySummary(): { totalTokens: number; totalCostUsd: number; totalSessions: number; dayCount: number } {
    const days = Object.values(this.data.days);
    return {
      totalTokens: days.reduce((s, d) => s + d.inputTokens + d.outputTokens + d.cacheCreationTokens + d.cacheReadTokens, 0),
      totalCostUsd: days.reduce((s, d) => s + d.totalCostUsd, 0),
      totalSessions: days.reduce((s, d) => s + d.sessionCount, 0),
      dayCount: days.length,
    };
  }
}
```

### Wiring into SessionStore

```typescript
// In session-store.ts pushDashboardUpdate(), after computing todayTotals:
this.historyStore.recordTodayTotals(todayTotals);
```

### IPC Handler Registration

```typescript
// In ipc-handlers.ts
ipcMain.handle('get-history', async () => {
  return historyStore.getHistory();
});
```

### Renderer History Display

```typescript
// In dashboard-panel.ts, new method:
updateHistory(history: DailyAggregate[]): void {
  const totalCost = history.reduce((s, d) => s + d.totalCostUsd, 0);
  const totalTokens = history.reduce((s, d) =>
    s + d.inputTokens + d.outputTokens + d.cacheCreationTokens + d.cacheReadTokens, 0);
  // Render as a summary row in the totals area
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `electron-store` for JSON persistence | Manual JSON file with atomic write | 2024+ (electron-store ESM issues) | `electron-store` has Electron Forge + ESM incompatibility (issue #259); manual approach is simpler and avoids the dependency |
| SQLite for small datasets in Electron | Pre-aggregated JSON for <100 records | Ongoing best practice | SQLite requires native module rebuild per Electron ABI version; JSON is zero-dependency for small datasets |
| `~/.appname/` for user data | `app.getPath('userData')` | Electron convention | Platform-correct paths: `%APPDATA%` on Windows, `~/Library/Application Support` on Mac, `~/.config` on Linux |

**Deprecated/outdated:**
- `electron-store` v8+: ESM-only, causes issues with Electron Forge webpack plugin. Not recommended for new Electron Forge projects.

## Open Questions

1. **Write throttle timing**
   - What we know: Writing on every 3-second poll is excessive; writing only on `before-quit` risks losing data on crash.
   - What's unclear: Optimal balance between data freshness and disk I/O.
   - Recommendation: Compare today's totals with last-written values. Only write to disk when values have changed. This naturally throttles writes to "only when new JSONL data arrives" -- which is when Claude sessions are active and producing tokens. Also write on `before-quit` as a safety net. Estimated write frequency: 1-5 writes per minute during active use, zero during idle.

2. **UTC vs local time for date keys**
   - What we know: `new Date().toISOString().slice(0, 10)` gives UTC date. A user working at 11pm local time (UTC-5) sees their usage recorded under "tomorrow's" date.
   - What's unclear: Whether users expect UTC or local time.
   - Recommendation: Use local date for the day key: `new Date().toLocaleDateString('en-CA')` returns `YYYY-MM-DD` in local time. This matches user expectation ("today's usage" = calendar day in their timezone).

## Sources

### Primary (HIGH confidence)
- [Node.js fs documentation](https://nodejs.org/api/fs.html) - `writeFileSync`, `renameSync`, `copyFileSync`, `mkdirSync` behavior and error codes
- [Electron app.getPath documentation](https://www.electronjs.org/docs/latest/api/app) - `userData` path resolution per platform (`%APPDATA%/Agent World` on Windows)
- Direct codebase analysis: `src/main/session-store.ts`, `src/main/usage-aggregator.ts`, `src/shared/types.ts`, `src/main/ipc-handlers.ts`, `src/preload/preload.ts`, `src/renderer/dashboard-panel.ts` - Phase 18 data flow verified

### Secondary (MEDIUM confidence)
- [Node.js issue #29481 - EPERM when renaming files on Windows](https://github.com/nodejs/node/issues/29481) - Confirms Windows NTFS rename failures due to antivirus file locking; documents EPERM/EBUSY error codes
- [npm/write-file-atomic](https://github.com/npm/write-file-atomic) - Reference implementation of atomic write pattern (write-tmp-then-rename); confirms pattern is industry standard
- [electron-store issue #259](https://github.com/sindresorhus/electron-store/issues/259) - ESM incompatibility with Electron Forge; confirms avoiding this dependency

### Tertiary (LOW confidence)
- None -- all findings verified against primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Node.js built-ins, no external dependencies, patterns verified against existing codebase
- Architecture: HIGH - Data flow from Phase 18 fully traced; integration points (SessionStore, IPC handlers, preload, renderer) clearly identified with line-level references
- Pitfalls: HIGH - Windows EPERM issue backed by Node.js GitHub issue with reproduction; double-counting pitfall derived from direct code analysis of Phase 18's `TodayTotals` computation pattern

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable domain -- Node.js fs and Electron app APIs change rarely)

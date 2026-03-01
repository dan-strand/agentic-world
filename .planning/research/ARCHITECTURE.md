# Architecture Research

**Domain:** Usage dashboard integration into Electron + PixiJS Fantasy RPG visualizer
**Researched:** 2026-03-01
**Confidence:** HIGH (based on direct codebase analysis of all source files + JSONL structure verification)

---

## Context: What Already Exists

This research is for v1.5, a subsequent milestone adding a usage dashboard below the
existing RPG world. The codebase is 6,461 LOC across 22 files. The integration problem
is specific: how to add a dashboard panel to a fixed-size, frameless Electron window that
currently runs a full-screen PixiJS canvas.

**Confirmed JSONL usage structure (verified from live session files):**

```json
{
  "type": "assistant",
  "sessionId": "5de0e917-...",
  "cwd": "C:\\Users\\dlaws\\Projects\\Agent World",
  "timestamp": "2026-03-01T01:35:13.099Z",
  "message": {
    "model": "claude-opus-4-6",
    "usage": {
      "input_tokens": 1,
      "cache_creation_input_tokens": 363,
      "cache_read_input_tokens": 41326,
      "output_tokens": 60,
      "server_tool_use": { "web_search_requests": 0, "web_fetch_requests": 0 },
      "service_tier": "standard",
      "cache_creation": {
        "ephemeral_1h_input_tokens": 363,
        "ephemeral_5m_input_tokens": 0
      }
    }
  }
}
```

Fields needed for cost calculation: `input_tokens`, `output_tokens`,
`cache_creation_input_tokens`, `cache_read_input_tokens`, and `model`.
The `system` entry with `subtype: "turn_duration"` has `durationMs` for per-turn
timing. The `timestamp` field on each entry gives session start/end time.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                              │
├──────────────────────────────────────────────────────────────────────┤
│  FilesystemSessionDetector    UsageAggregator (NEW)                  │
│  (polls JSONL tail, 3s)       - mtime-cached full JSONL scans        │
│                               - sums input/output/cache tokens       │
│                               - model detection for pricing          │
├──────────────────────────────────────────────────────────────────────┤
│  SessionStore                 HistoryStore (NEW)                     │
│  (live sessions, IPC push)    - ~/.agent-world/history.json          │
│                               - 30 DailyAggregate records            │
│                               - atomic JSON write on completion      │
├──────────────────────────────────────────────────────────────────────┤
│  IPC Layer (extended)                                                 │
│  sessions-update (existing)  → SessionInfo[]                         │
│  dashboard-update (NEW)      → DashboardData                         │
│  get-history (NEW)           → DailyAggregate[]                      │
├──────────────────────────────────────────────────────────────────────┤
│  Preload contextBridge (extended)                                     │
│  onSessionsUpdate() (existing)                                        │
│  onDashboardUpdate() (NEW)                                            │
│  getHistory() (NEW)                                                   │
└──────────────────────────────────────────────────────────────────────┘
                               │ IPC
┌──────────────────────────────────────────────────────────────────────┐
│                    Renderer Process                                   │
├──────────────────────────────────────────────────────────────────────┤
│  PixiJS World (1024x768 canvas)  -- ZERO CHANGES to this layer       │
│  world.ts, building.ts, agent.ts, tilemap-builder.ts, etc.           │
├──────────────────────────────────────────────────────────────────────┤
│  Dashboard Panel (NEW) -- HTML/CSS, 1024x312 strip below canvas      │
│  .dashboard-header  : today totals (tokens, cost, session count)     │
│  .session-list      : compact rows, click to expand for token detail  │
│  .history-section   : 30-day chart (HTML Canvas 2D, not PixiJS)      │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New vs Modified |
|-----------|----------------|-----------------|
| `FilesystemSessionDetector` | Status polling every 3s (tail 64KB) | Unchanged |
| `jsonl-reader.ts` | Add `readUsageTotals()` for full-file token scan | Modified (additive) |
| `UsageAggregator` | Per-session mtime-cached token totals, cost math | NEW |
| `HistoryStore` | Persist daily aggregates to JSON, 30-day retention | NEW |
| `SessionStore` | Calls UsageAggregator, pushes dashboard-update IPC | Modified |
| `ipc-handlers.ts` | Register `get-history` handler | Modified |
| `preload.ts` | Expose `onDashboardUpdate()`, `getHistory()` on contextBridge | Modified |
| `shared/types.ts` | Add `SessionUsage`, `DashboardData`, `DailyAggregate` types | Modified |
| `shared/constants.ts` | Add `DASHBOARD_HEIGHT`, `MODEL_PRICING`, window dims | Modified |
| `main/index.ts` | Window height 768→1080, initialize new stores | Modified |
| `DashboardPanel` | HTML/CSS session rows, expandable detail, today totals | NEW (renderer) |
| `HistoryChart` | 30-day bar chart via HTML Canvas 2D API | NEW (renderer) |
| `renderer/index.html` | Expand body height, add `#dashboard` div | Modified |
| `renderer/index.ts` | Wire dashboard IPC, init DashboardPanel | Modified |

---

## Recommended Project Structure

```
src/
├── main/
│   ├── index.ts            # Modified: window 768→1080, init UsageAggregator + HistoryStore
│   ├── session-detector.ts # Unchanged
│   ├── session-store.ts    # Modified: call UsageAggregator in poll(), push dashboard-update
│   ├── jsonl-reader.ts     # Modified: add readUsageTotals() (existing exports unchanged)
│   ├── ipc-handlers.ts     # Modified: add get-history handler
│   ├── usage-aggregator.ts # NEW: per-session token totals, mtime cache, cost calculation
│   └── history-store.ts    # NEW: JSON file persistence, daily aggregation, 30-day retention
├── renderer/
│   ├── index.html          # Modified: body height 1080, add #dashboard div below #app
│   ├── index.ts            # Modified: init DashboardPanel, subscribe to onDashboardUpdate
│   ├── dashboard-panel.ts  # NEW: session list rows, expandable detail, today totals header
│   ├── history-chart.ts    # NEW: 30-day bar chart (HTML Canvas 2D)
│   └── [all other files]   # Unchanged (world, building, agent, sound-manager, etc.)
├── shared/
│   ├── types.ts            # Modified: add SessionUsage, DashboardData, DailyAggregate
│   └── constants.ts        # Modified: add DASHBOARD_HEIGHT, WINDOW_HEIGHT_EXPANDED, MODEL_PRICING
└── preload/
    └── preload.ts          # Modified: expose onDashboardUpdate, getHistory
```

### Structure Rationale

- **`usage-aggregator.ts` in main/**: Full JSONL reads are Node.js file I/O. They belong
  in the main process, not the renderer. The aggregator runs alongside the poll cycle.
- **`history-store.ts` in main/**: Writes to `~/.agent-world/history.json`. All persistent
  storage lives in the main process.
- **`dashboard-panel.ts` in renderer/**: Pure HTML/CSS rendering. No PixiJS involvement.
  Lives in renderer alongside world.ts but is architecturally separate.
- **All existing renderer files unchanged**: The RPG world is zero-touch. The dashboard is
  purely additive.

---

## Architectural Patterns

### Pattern 1: Window Expansion (1024x768 to 1024x1080)

**What:** Increase `height`, `minHeight`, and `maxHeight` in the `BrowserWindow` config.
Add a fixed-height `#dashboard` div in `index.html` below the PixiJS `#app` canvas.
The PixiJS canvas stays exactly 1024x768. The dashboard occupies a new 312px strip.

**When to use:** This is the only viable approach for below-the-canvas content in Electron
without introducing multiple windows or overlaying on the canvas.

**Trade-offs:** Simple layout with zero impact on the PixiJS scene. The fixed total height
means no resizing complexity -- the window grows by exactly 312px.

**index.html change:**
```html
<style>
  html, body {
    width: 1024px;
    height: 1080px;
    overflow: hidden;       /* no OS-level scrollbars */
    background: #1a1a2e;
    display: flex;
    flex-direction: column;
  }
  #app {
    width: 1024px;
    height: 768px;          /* PixiJS canvas: unchanged */
    flex-shrink: 0;
  }
  #dashboard {
    width: 1024px;
    height: 312px;          /* new dashboard strip */
    overflow-y: auto;       /* internal scroll if content exceeds 312px */
    background: #0f0f1a;
    border-top: 1px solid #2a2a3e;
    flex-shrink: 0;
  }
</style>
<body>
  <div id="drag-region">...</div>
  <div id="app"></div>           <!-- PixiJS canvas target, unchanged -->
  <div id="dashboard"></div>    <!-- NEW dashboard strip -->
  <div id="audio-controls">...</div>
</body>
```

**main/index.ts change:**
```typescript
const mainWindow = new BrowserWindow({
  width: 1024,
  height: 1080,        // was 768
  minWidth: 1024,
  minHeight: 1080,     // was 768
  maxWidth: 1024,
  maxHeight: 1080,     // was 768
  resizable: false,    // unchanged
  // ... rest unchanged
});
```

### Pattern 2: Separate IPC Channel for Dashboard Data

**What:** Dashboard data flows on a new `dashboard-update` IPC channel, separate from the
existing `sessions-update` channel. The RPG world continues to receive `SessionInfo[]` on
`sessions-update`. The dashboard receives `DashboardData` (with token/cost fields) on
`dashboard-update`.

**When to use:** Dashboard updates trigger on a different cadence (only when a file mtime
changes and usage totals change). Separation prevents dashboard-only updates from triggering
unnecessary RPG world re-renders.

**Trade-offs:** Two subscriptions in the renderer instead of one. The alternative -- adding
token fields to `SessionInfo` -- would embed dashboard concerns into the status type and
force token re-aggregation on every 3s poll for all sessions.

**New type definitions (shared/types.ts):**
```typescript
export interface SessionUsage {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
  model: string;              // e.g. "claude-opus-4-6"
  turnCount: number;          // number of assistant entries scanned
  durationMs: number;         // sum of system turn_duration entries
  startedAt: number;          // epoch ms of first JSONL entry
  lastActiveAt: number;       // epoch ms of last JSONL entry
}

export interface DashboardData {
  sessions: SessionUsage[];
  todayTotals: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCostUsd: number;
    sessionCount: number;
    completionCount: number;
    activeMinutes: number;
  };
}

export interface DailyAggregate {
  date: string;               // 'YYYY-MM-DD'
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
  sessionCount: number;
  completionCount: number;
}
```

**Extended IPC_CHANNELS:**
```typescript
export const IPC_CHANNELS = {
  SESSIONS_UPDATE: 'sessions-update',           // existing
  GET_INITIAL_SESSIONS: 'get-initial-sessions', // existing
  DASHBOARD_UPDATE: 'dashboard-update',         // NEW
  GET_HISTORY: 'get-history',                  // NEW
} as const;
```

### Pattern 3: Mtime-Cached Full JSONL Scan for Token Data

**What:** The existing `readLastJsonlLine()` tail-reads 64KB for status detection. Token
aggregation requires scanning ALL assistant entries to sum token counts. A new
`readUsageTotals()` function opens the full file and accumulates token totals.

**Critically:** It is called only when the file mtime has changed since the last scan.
Unchanged files return cached totals without any I/O. This mirrors the mtime-caching
pattern already established in `FilesystemSessionDetector.mtimeCache`.

**When to use:** Always, via `UsageAggregator`. Never call `readUsageTotals()` directly
from the poll cycle without the mtime guard.

**Trade-offs:** First scan of a 18MB JSONL file may take 50-150ms on a typical SSD.
Subsequent polls hit the cache. In practice, only 1-3 files change per poll cycle (the
actively-running sessions). Acceptable for always-on desktop app.

**New export in jsonl-reader.ts:**
```typescript
export interface SessionUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;               // last model seen in assistant entries
  turnCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  durationMs: number;          // sum of system turn_duration.durationMs entries
}

export function readUsageTotals(filePath: string): SessionUsageTotals {
  const totals: SessionUsageTotals = {
    inputTokens: 0, outputTokens: 0,
    cacheCreationTokens: 0, cacheReadTokens: 0,
    model: '', turnCount: 0,
    firstTimestamp: null, lastTimestamp: null, durationMs: 0,
  };
  // Read full file, split on newline, parse each line
  // For 'assistant' entries with message.usage: accumulate all token fields
  // For 'system' entries with subtype 'turn_duration': add durationMs
  // Track first/last timestamps
  return totals;
}
```

**Performance note:** If a 18MB file scan exceeds 100ms, the implementation should use
`fs.createReadStream()` + readline for streaming rather than `readFileSync`. Benchmark
before deciding. For most session files (2-5MB typical), `readFileSync` is fine.

### Pattern 4: Daily History in Local JSON File

**What:** Daily aggregates persist to `~/.agent-world/history.json` as an object keyed
by `'YYYY-MM-DD'`. Written atomically on each session completion event. Loaded into
memory at app start. Pruned to 31 days on each write.

**When to use:** Simple, zero-dependency persistence for small data (30 records = ~3KB).
SQLite would be overkill. The data set is small enough that the full file is always
read into memory.

**Trade-offs:** JSON file reads/writes are synchronous but cheap at 3KB. Atomic write
(write temp, rename) prevents corruption on crash. The `~/.agent-world/` directory is
app-controlled and safe from Claude Code reorganizations.

**history-store.ts:**
```typescript
export class HistoryStore {
  private historyPath: string;
  private data: Map<string, DailyAggregate> = new Map();

  constructor() {
    this.historyPath = path.join(os.homedir(), '.agent-world', 'history.json');
    this.load();
  }

  load(): void {
    // Read history.json, parse, populate this.data
    // If file not found, start with empty map
  }

  recordCompletion(usage: SessionUsage): void {
    const dateKey = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const existing = this.data.get(dateKey) ?? this.emptyDay(dateKey);
    // Add usage fields to today's aggregate
    this.data.set(dateKey, updated);
    this.prune(); // remove entries older than 31 days
    this.save(); // atomic write to temp file then rename
  }

  getTodayTotals(): DashboardData['todayTotals'] {
    const today = new Date().toISOString().slice(0, 10);
    return this.data.get(today) ?? this.emptyTotals();
  }

  getLast30Days(): DailyAggregate[] {
    // Return array of last 30 days, sorted ascending by date
    // Fill gaps with zero-value records for days with no activity
  }

  private save(): void {
    const tmpPath = this.historyPath + '.tmp';
    const obj = Object.fromEntries(this.data.entries());
    fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.historyPath); // atomic on same filesystem
  }
}
```

### Pattern 5: Dashboard as Pure HTML/CSS (No PixiJS)

**What:** The dashboard panel is a standard HTML `<div>` with CSS styling. Session rows
are `<div>` elements. The history chart uses the HTML Canvas 2D API (`ctx.fillRect()`,
`ctx.fillText()`). No PixiJS classes are involved.

**When to use:** Text-heavy tabular data is what HTML/CSS is built for. PixiJS BitmapText
at 11-13px is harder to control than a `<span>`. Expandable rows are a CSS `height`
transition plus `display: none` toggle, not a PixiJS animation.

**Trade-offs:** Mixing HTML DOM and PixiJS is already established in this project (drag
region, mute button, volume slider are all HTML elements in the same window). The dashboard
extends the same pattern. The PixiJS canvas is simply a fixed-size element at the top of
the flex column layout.

---

## Data Flow

### Flow 1: Session Status Updates (Existing, Unchanged)

```
FilesystemSessionDetector.discoverSessions()  [every 3s]
    |
SessionStore.poll()  -- detects changes
    |
mainWindow.webContents.send('sessions-update', SessionInfo[])
    |  (IPC)
window.agentWorld.onSessionsUpdate(callback)  [preload]
    |
world.updateSessions(sessions)   -- RPG world updates (unchanged)
gameLoop.onSessionsUpdate(sessions)
```

### Flow 2: Dashboard Data Updates (New)

```
SessionStore.poll()  [every 3s, same poll cycle as status]
    |
    +-- Collect file paths for sessions with changed mtime
    |
UsageAggregator.getUsageForSessions(sessions)
    |
    +-- For each session with changed mtime:
    |     readUsageTotals(filePath)  -- full file scan
    |     calculate cost from MODEL_PRICING
    |     update mtime cache
    |
DashboardData assembled (sessions: SessionUsage[], todayTotals: ...)
    |
mainWindow.webContents.send('dashboard-update', DashboardData)
    |  (IPC)
window.agentWorld.onDashboardUpdate(callback)  [preload]
    |
DashboardPanel.update(data)  -- HTML panel re-renders session rows
```

### Flow 3: History Load (New, Once at Init)

```
renderer/index.ts startup
    |
window.agentWorld.getHistory()  -- ipcRenderer.invoke('get-history')
    |  (IPC)
ipc-handlers.ts → historyStore.getLast30Days()
    |
DailyAggregate[]  (30 records max)
    |
DashboardPanel.renderHistory(data)
    |
HistoryChart.render(data)  -- HTML Canvas 2D bar chart
```

### Flow 4: Session Completion Recording (New, Event-Driven)

```
SessionStore.poll() detects session transition to idle
    |
    +-- If session was previously active/waiting and is now idle
    |   AND UsageAggregator has totals for this session
    |
historyStore.recordCompletion(sessionUsage)
    |
history.json updated  [atomic write]
```

### Cost Calculation

```
UsageAggregator.calculateCost(model, inputTokens, outputTokens, cacheCreate, cacheRead)
    |
MODEL_PRICING[model] lookup  (shared/constants.ts)
    |
cost = (inputTokens * inputPer1M / 1_000_000)
     + (outputTokens * outputPer1M / 1_000_000)
     + (cacheCreate * cacheCreatePer1M / 1_000_000)
     + (cacheRead * cacheReadPer1M / 1_000_000)
```

**Model pricing constants (shared/constants.ts):**

```typescript
// Pricing as of 2026-03-01 -- verify against anthropic.com/pricing before implementation
// Model IDs match the exact string in JSONL message.model field (verified: "claude-opus-4-6")
export const MODEL_PRICING: Record<string, {
  inputPer1M: number;
  outputPer1M: number;
  cacheCreatePer1M: number;
  cacheReadPer1M: number;
}> = {
  'claude-opus-4-6':   { inputPer1M: 15.00, outputPer1M: 75.00,  cacheCreatePer1M: 18.75, cacheReadPer1M: 1.50 },
  'claude-sonnet-4-6': { inputPer1M: 3.00,  outputPer1M: 15.00,  cacheCreatePer1M: 3.75,  cacheReadPer1M: 0.30 },
  'claude-3-7-sonnet': { inputPer1M: 3.00,  outputPer1M: 15.00,  cacheCreatePer1M: 3.75,  cacheReadPer1M: 0.30 },
  'claude-3-5-sonnet': { inputPer1M: 3.00,  outputPer1M: 15.00,  cacheCreatePer1M: 3.75,  cacheReadPer1M: 0.30 },
  'claude-3-haiku':    { inputPer1M: 0.25,  outputPer1M: 1.25,   cacheCreatePer1M: 0.30,  cacheReadPer1M: 0.03 },
};

// Fallback for unknown models -- conservative estimate using Sonnet pricing
export const DEFAULT_MODEL_PRICING = MODEL_PRICING['claude-sonnet-4-6'];
```

---

## Build Order (Dependencies Drive Sequence)

### Step 1: Types + Constants (Foundation -- No Dependencies)

**Files:** `shared/types.ts`, `shared/constants.ts`

**Changes:**
- Add `SessionUsage`, `DashboardData`, `DailyAggregate` interfaces
- Add `DASHBOARD_UPDATE`, `GET_HISTORY` to `IPC_CHANNELS`
- Add `IAgentWorldAPI` methods: `onDashboardUpdate()`, `getHistory()`
- Add `MODEL_PRICING`, `DEFAULT_MODEL_PRICING` constants
- Add `DASHBOARD_HEIGHT = 312`, `WINDOW_HEIGHT_EXPANDED = 1080` constants

**Why first:** Every other new file depends on these types. Zero risk to existing code.

**Duration estimate:** 30-60 minutes.

### Step 2: JSONL Usage Reader (Depends on Step 1 Types)

**Files:** `main/jsonl-reader.ts`

**Changes:** Add `readUsageTotals()` export. Existing `readLastJsonlLine()` and
`readLastToolUse()` exports are NOT modified. This is purely additive.

**Why second:** `UsageAggregator` depends on this function. Can be built and verified
in isolation with a single JSONL file before wiring to anything else.

**Duration estimate:** 1-2 hours.

### Step 3: UsageAggregator + HistoryStore (Depends on Steps 1 + 2)

**Files:** `main/usage-aggregator.ts` (new), `main/history-store.ts` (new)

**UsageAggregator:**
- Maintains `Map<sessionId, { mtimeMs: number, totals: SessionUsageTotals }>` cache
- `getUsageForSessions(sessions: SessionInfo[]): SessionUsage[]` -- checks mtime, scans
  changed files, calculates cost, returns array
- No polling loop -- called synchronously by SessionStore

**HistoryStore:**
- Loads `~/.agent-world/history.json` at construction (creates dir if missing)
- `recordCompletion(usage: SessionUsage): void` -- updates today's aggregate, atomic write
- `getTodayTotals(): DashboardData['todayTotals']`
- `getLast30Days(): DailyAggregate[]`

**Why third:** Both depend on Step 1 types and Step 2 reader. Can be independently
tested before IPC wiring.

**Duration estimate:** 2-3 hours.

### Step 4: IPC Wiring -- Main + Preload (Depends on Steps 1-3)

**Files:** `main/session-store.ts`, `main/ipc-handlers.ts`, `main/index.ts`,
`preload/preload.ts`

**session-store.ts changes:**
- Constructor receives `UsageAggregator` and `HistoryStore` as new dependencies
- `poll()` calls `usageAggregator.getUsageForSessions()` and `historyStore.getTodayTotals()`
  after status detection, pushes `dashboard-update` IPC when usage data changes
- Detects session completion transitions to call `historyStore.recordCompletion()`

**ipc-handlers.ts changes:**
- Register `get-history` handler: `ipcMain.handle(IPC_CHANNELS.GET_HISTORY, () => historyStore.getLast30Days())`

**main/index.ts changes:**
- Instantiate `UsageAggregator` and `HistoryStore`
- Pass them to `SessionStore` constructor
- Change window `height`/`minHeight`/`maxHeight` from 768 to 1080

**preload.ts changes:**
- Add `onDashboardUpdate(callback)` that wraps `ipcRenderer.on('dashboard-update', ...)`
- Add `getHistory()` that wraps `ipcRenderer.invoke('get-history')`

**Why fourth:** Depends on all main-process components existing. After this step, the
renderer can receive real dashboard data via IPC.

**Duration estimate:** 1-2 hours.

### Step 5: Dashboard UI -- Renderer (Depends on Step 4 Preload API)

**Files:** `renderer/index.html`, `renderer/index.ts`, `renderer/dashboard-panel.ts`,
`renderer/history-chart.ts`

**index.html changes:**
- Body layout: flex column, height 1080px
- Add `#dashboard` div below `#app`
- Dashboard CSS: dark background, scroll, border

**index.ts changes:**
- Instantiate `DashboardPanel(document.getElementById('dashboard')!)`
- Subscribe to `window.agentWorld.onDashboardUpdate(data => dashboardPanel.update(data))`
- Invoke `window.agentWorld.getHistory()` then call `dashboardPanel.renderHistory(history)`

**dashboard-panel.ts:**
- Pure TypeScript class managing a `<div>` subtree
- Renders session rows: project name, status badge, duration, total tokens, cost
- Handles click-to-expand for per-session token breakdown
- Renders today's totals header bar

**history-chart.ts:**
- Creates an HTML `<canvas>` element
- Uses `ctx.fillRect()` for bars, `ctx.fillText()` for axis labels
- `render(data: DailyAggregate[]): void` -- full chart redraw (called once)
- `mousemove` listener for date tooltip on hover

**Why last:** The renderer UI depends on the preload API being defined (Step 4). The
PixiJS canvas at the top is untouched -- only the new `#dashboard` div is affected.

**Duration estimate:** 3-5 hours.

---

## Integration Points with Existing Code

### session-detector.ts -- Zero Changes

Status polling continues as-is. The `readLastJsonlLine()` tail read is not changed.
Session detection and token aggregation are independent concerns.

### session-store.ts -- Minimal, Surgical Changes

The poll cycle calls `usageAggregator.getUsageForSessions()` after status detection:

```typescript
// Addition to SessionStore constructor signature:
constructor(
  detector: SessionDetector,
  usageAggregator: UsageAggregator,  // NEW
  historyStore: HistoryStore          // NEW
) { ... }

// Addition to poll():
private poll(): void {
  // [existing status detection code unchanged]
  ...
  if (hasChanges) {
    this.pushUpdate();            // existing sessions-update IPC
    this.pushDashboardUpdate();   // NEW
  }
}

private pushDashboardUpdate(): void {
  const sessions = this.getSessions();
  const usageData = this.usageAggregator.getUsageForSessions(sessions);
  const todayTotals = this.historyStore.getTodayTotals();
  const data: DashboardData = { sessions: usageData, todayTotals };
  this.mainWindow?.webContents.send(IPC_CHANNELS.DASHBOARD_UPDATE, data);
}
```

Completion detection (to trigger `historyStore.recordCompletion()`) watches for sessions
that transition from `active` or `waiting` to `idle` and do not reappear as `active` on
the next poll cycle. SessionStore already tracks previous states via its `sessions` Map --
the `existing.status !== session.status` check is the right hook point.

### jsonl-reader.ts -- Additive Only

New `readUsageTotals()` export added. The existing `readLastJsonlLine()` and
`readLastToolUse()` exports are unchanged. No regression risk to status detection.

### index.html -- Layout, Not Behavior

The PixiJS `#app` div stays at `height: 768px`. The window body grows to 1080px.
Audio controls (`#audio-controls`) move to `position: fixed; bottom: 320px` (above the
dashboard) or are repositioned within the dashboard. The drag region stays at top.

### shared/types.ts -- Additive Only

New interfaces added. Existing `SessionInfo`, `IPC_CHANNELS`, `IAgentWorldAPI`, and
`SessionStatus` types are unchanged. The renderer and main process continue to work with
`SessionInfo[]` for RPG world updates.

---

## Scaling Considerations

This is a local always-on app. Practical limits are known and small.

| Dimension | Expected | Architecture Notes |
|-----------|----------|-------------------|
| Concurrent sessions | 4-8 | mtime cache means only changed files get full-scanned |
| JSONL file size | 2-18MB | Full scan at 18MB: ~50-150ms on SSD. Mtime cache skips unchanged files. |
| Active polls with changed files | 1-3 per cycle | Only actively-running sessions write to JSONL continuously |
| History records | 30 days max | ~3KB JSON, trivial I/O |
| Dashboard re-renders | Every 3s when active | HTML DOM updates for 4-8 session rows are instantaneous |

**If a 18MB file scan becomes problematic:** Use `fs.createReadStream()` + readline
for streaming parse instead of `readFileSync`. This allows interrupting the scan early
(stop after reading the last N lines if only recent turns are needed) and reduces peak
memory use. Profile before optimizing -- for the expected session count, `readFileSync`
is likely adequate.

**Dashboard update frequency:** Consider decoupling dashboard updates from the 3s status
poll. Dashboard could update every 10s instead of every 3s -- token counts don't change
that quickly and the extra latency is imperceptible for historical data. This halves the
number of full JSONL scans. The RPG world continues on its 3s cycle unaffected.

---

## Anti-Patterns

### Anti-Pattern 1: Extracting Token Data from the Tail Buffer

**What people do:** Add token extraction to the existing `readLastJsonlLine()` and try to
sum usage from the last 64KB tail.

**Why it's wrong:** Usage fields live on assistant entries. Between any assistant entry
and the file tail, there may be hundreds of tool_result, user, system, and progress entries.
The tail buffer covers at most the last 2-3 turns of a long session. Cache tokens
(which are the dominant cost driver for long sessions) would be severely undercounted.

**Do this instead:** A separate `readUsageTotals()` function scans the full file,
called only when the file mtime has changed. Keep the tail read for status detection,
full read for token aggregation.

### Anti-Pattern 2: Adding Token Fields to SessionInfo

**What people do:** Add `inputTokens`, `outputTokens`, `totalCostUsd` to the `SessionInfo`
interface to avoid a second IPC channel.

**Why it's wrong:** `SessionInfo` is a lightweight status snapshot pushed every 3s to
drive the RPG world. Token aggregation (full JSONL scan) would then run on every 3s poll
for every session, even when the dashboard is not in focus. The RPG world never uses token
data. Coupling the two concerns means a slow token scan blocks the status update.

**Do this instead:** A separate `DashboardData` type on a separate `dashboard-update`
channel. The dashboard can update at a different cadence (e.g., 10s). The RPG world
status path has zero overhead from the dashboard feature.

### Anti-Pattern 3: Rendering the Dashboard via PixiJS

**What people do:** Extend the PixiJS world with dashboard containers, BitmapText
session rows, and Graphics sparklines.

**Why it's wrong:** PixiJS is optimized for sprite animation. Text-heavy tabular data
(project names, token counts, cost numbers, dates) is what HTML/CSS is designed for.
BitmapText at 11-13px readable scale is harder to position than a `<div>`. Expandable
rows require PixiJS hit-testing vs. CSS click events. A 30-day sparkline requires custom
Graphics math vs. three `ctx.fillRect()` calls.

**Do this instead:** A pure HTML `<div id="dashboard">` below the PixiJS canvas. The
project already mixes HTML elements (drag region, mute button, volume slider) with the
PixiJS canvas -- the dashboard extends the same established pattern.

### Anti-Pattern 4: Writing History to ~/.claude/ Directory

**What people do:** Write `history.json` inside `~/.claude/projects/` alongside the
session JSONL files for co-location with the data source.

**Why it's wrong:** Claude Code manages its `.claude/` directory. Future Claude Code
versions could reorganize, migrate, or purge files in that directory. App-generated
data should live in an app-controlled location.

**Do this instead:** `~/.agent-world/history.json`. Create the directory at
`HistoryStore` construction time if it does not exist. The directory name is specific
enough to avoid collisions.

### Anti-Pattern 5: Synchronous Full-File Scans on Every Poll

**What people do:** Call `readUsageTotals()` for every session every 3s poll, regardless
of whether the file changed.

**Why it's wrong:** Scanning 8 sessions × 18MB each = 144MB read per poll cycle = 144MB
per 3 seconds. On an SSD this is still ~400ms I/O per cycle, causing the poll to block
the main process and delay status updates.

**Do this instead:** The `UsageAggregator` maintains a `Map<sessionId, { mtimeMs, totals }>`
cache. Only scan a file when its mtime has changed since the last scan. In steady state,
only 1-3 actively-running sessions have changing mtimes.

---

## New Components -- Detail

### UsageAggregator (main/usage-aggregator.ts)

```
State:
  Map<sessionId, { mtimeMs: number, totals: SessionUsageTotals, filePath: string }>

Public API:
  getUsageForSessions(sessions: SessionInfo[]): SessionUsage[]
    - For each session, stat its JSONL file
    - If mtime unchanged: return cached totals
    - If mtime changed: call readUsageTotals(), recalculate cost, update cache
    - Return SessionUsage[] with totalCostUsd calculated from MODEL_PRICING

Dependencies:
  - readUsageTotals() from jsonl-reader.ts
  - MODEL_PRICING, DEFAULT_MODEL_PRICING from shared/constants.ts
```

### HistoryStore (main/history-store.ts)

```
State:
  Map<'YYYY-MM-DD', DailyAggregate> -- loaded from disk at construction

Public API:
  recordCompletion(usage: SessionUsage): void
    - Accumulates usage into today's DailyAggregate
    - Prunes entries older than 31 days
    - Writes atomically to ~/.agent-world/history.json

  getTodayTotals(): DashboardData['todayTotals']
    - Returns today's running aggregate (or zeros if no activity today)

  getLast30Days(): DailyAggregate[]
    - Returns array sorted ascending by date
    - Fills missing days with zero-value records

Storage location:
  ~/.agent-world/history.json
  Created with fs.mkdirSync({ recursive: true }) at construction if missing
```

### DashboardPanel (renderer/dashboard-panel.ts)

```
State:
  Map<sessionId, { expanded: boolean }> -- tracks expanded/collapsed rows

Public API:
  update(data: DashboardData): void
    - Diffs current session list against DOM
    - Adds new session rows, removes gone sessions, updates existing rows
    - Updates today's totals header bar

  renderHistory(data: DailyAggregate[]): void
    - Delegates to HistoryChart.render()

DOM structure:
  <div id="dashboard">
    <div class="dashboard-header">
      <span class="stat">Tokens today: 1.2M</span>
      <span class="stat">Cost today: $0.47</span>
      <span class="stat">Sessions: 3</span>
    </div>
    <div class="session-list">
      <div class="session-row" data-id="abc...">
        <span class="name">Agent World</span>
        <span class="status active">active</span>
        <span class="tokens">42K tokens</span>
        <span class="cost">$0.18</span>
        <div class="session-detail" style="display:none">
          <!-- token breakdown per type -->
        </div>
      </div>
    </div>
    <div class="history-section">
      <canvas id="history-chart" width="1024" height="100"></canvas>
    </div>
  </div>
```

### HistoryChart (renderer/history-chart.ts)

```
Public API:
  render(canvas: HTMLCanvasElement, data: DailyAggregate[]): void
    - Clears canvas
    - Draws 30 bars (one per day), height proportional to totalCostUsd
    - Draws date labels on x-axis (abbreviated: "Mar 1")
    - Draws cost labels on y-axis
    - Attaches mousemove listener for tooltip overlay

Implementation:
  - HTML Canvas 2D API (ctx.fillRect, ctx.fillText, ctx.strokeRect)
  - No external chart library needed -- 30 data points, one dimension
  - ~100 lines of straightforward canvas math
```

---

## Sources

- Direct codebase analysis: all 22 source files in `src/` (HIGH confidence)
- Live JSONL inspection: `~/.claude/projects/C--Users-dlaws-Projects-Agent-World/5de0e917-*.jsonl`
  -- confirmed `message.usage` structure with all four token fields, model string format
  `"claude-opus-4-6"`, and `system` entry `durationMs` field (HIGH confidence)
- Electron BrowserWindow docs: `width`/`height`/`maxHeight` for window expansion,
  `webContents.send` for IPC push, `ipcMain.handle` for async IPC (HIGH confidence)
- Electron contextBridge pattern: verified against existing `src/preload/preload.ts`
  -- `contextBridge.exposeInMainWorld` extension pattern is clear (HIGH confidence)
- Node.js `fs.renameSync` for atomic file writes on Windows (same filesystem, NTFS)
  -- MINGW64/Git Bash environment confirmed in project constraints (MEDIUM confidence,
  atomic rename is best-effort on Windows but reliable for same-volume moves)
- Anthropic model pricing: MEDIUM confidence -- pricing verified against known model
  tiers (Opus/Sonnet/Haiku). Prices change. Verify at anthropic.com/pricing before
  implementation and add a comment in constants.ts with the verification date.

---

*Architecture research for: Agent World v1.5 -- Usage Dashboard Integration*
*Researched: 2026-03-01*

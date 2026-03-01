# Pitfalls Research

**Domain:** Adding a usage/cost dashboard (token tracking, cost estimation, historical stats) to an existing Electron + PixiJS Fantasy RPG visualizer
**Researched:** 2026-03-01
**Confidence:** HIGH (verified via Electron docs, PixiJS GitHub issues, Node.js streaming patterns, Claude JSONL structure from ccusage community, Anthropic pricing history)

---

## Critical Pitfalls

### Pitfall 1: Synchronous JSONL Parsing Blocks the Electron Main Process

**What goes wrong:**
A session JSONL file can be 2-18MB. Reading it with `fs.readFileSync()` or even `fs.readFile()` followed by `content.split('\n').map(JSON.parse)` blocks the Node.js event loop for 100-800ms on a mid-range Windows machine. In Electron, the main process drives the entire application frame pipeline. Blocking the main process causes the PixiJS animation to visibly stutter or freeze — the RPG world hitches while parsing. Users experience this as the visualizer locking up every time the dashboard refreshes data.

**Why it happens:**
The straightforward approach to reading JSONL is `readFileSync` + split + parse. This works fine for small files but does not scale to 18MB. Developers reaching for "quick" implementations use the synchronous pattern because it is simpler. The problem is compounded by the fact that this app already has a 3-second session poll loop, and if the poll also triggers a full re-parse of all JSONL files (including historical ones), the main process is blocked on every tick.

**How to avoid:**
Use Node.js `readline` with `fs.createReadStream()` for line-by-line streaming. This reads and parses JSONL incrementally without loading the full file into memory or blocking the event loop:

```typescript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async function parseJsonl(filePath: string): Promise<UsageEntry[]> {
  const entries: UsageEntry[] = [];
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}
```

For historical aggregation (multiple files from previous days), process files sequentially with `await`, not `Promise.all()` — parallel streaming of 30 JSONL files simultaneously saturates I/O and provides no speedup while increasing memory pressure. Aggregate incrementally: accumulate totals per file, never hold all files in memory at once.

For live sessions (the active JSONL file being written by Claude Code), track the last-read byte offset and use `fs.createReadStream({ start: offset })` to tail only new lines on each poll cycle. This avoids re-parsing the entire file every 3 seconds.

**Warning signs:**
- PixiJS animation visibly hitches or freezes every 3 seconds (aligned with the session poll interval)
- `--inspect` profiling shows long tasks in the main process during the poll cycle
- Node.js event loop lag exceeds 100ms during data refresh

**Phase to address:**
Phase 1 (JSONL parsing infrastructure). Establish the streaming pattern and tail-read approach before any dashboard UI is built. It is much harder to retrofit streaming after synchronous parsing is wired into multiple call sites.

---

### Pitfall 2: Window Height Expansion Corrupts PixiJS Canvas Coordinates

**What goes wrong:**
The current window is a fixed 1024x768 with `resizable: false`. Expanding the window height to 1024x1068 (adding a 300px dashboard panel below the 768px world view) changes the window dimensions. If this resize is not handled carefully, the PixiJS canvas either stays at 768px height (leaving a gap), stretches to fill 1068px (distorting the pixel-art world), or misaligns its CSS position relative to the new window geometry. Building positions (computed relative to the 1024x768 canvas) remain hardcoded and correct, but the canvas `<canvas>` DOM element may report wrong `getBoundingClientRect()` values if its CSS height is recalculated incorrectly, breaking any future hit-testing.

Additionally, if `app.renderer.resize()` is called without explicitly pinning the world canvas to its original 768px height, PixiJS may attempt to fill the new 1068px container, scaling all sprite coordinates by `1068/768 = 1.39x` and displacing agents, buildings, and the tilemap from their intended positions.

**Why it happens:**
The existing code assumes 1024x768 everywhere — building coordinates, agent positions, tilemap dimensions, campfire location, and station offsets are all computed against this fixed size. When the Electron window grows taller, the browser layout reflows. If the PixiJS `<canvas>` element has `width: 100%; height: 100%` CSS (a common default), it stretches to fill the new window height. PixiJS then calls its auto-resize logic and invalidates the coordinate system. The `resizeTo` option in `app.init()` compounds this: per PixiJS issue #11427 (May 2025), `resizeTo` only triggers on window resize events, not on DOM layout changes, so even a ResizeObserver approach has edge cases.

**How to avoid:**
Structure the HTML layout so the PixiJS canvas has a fixed, explicit pixel height that never changes:

```html
<body style="display: flex; flex-direction: column; height: 1068px; overflow: hidden;">
  <canvas id="pixi-canvas" style="width: 1024px; height: 768px; flex-shrink: 0;"></canvas>
  <div id="dashboard" style="width: 1024px; height: 300px; flex-shrink: 0; overflow-y: auto;"></div>
</body>
```

Do NOT use `resizeTo` or `autoResize` on the PixiJS application — the canvas must be frozen at 1024x768. Initialize the PixiJS app with explicit `width: 1024, height: 768` and never call `app.renderer.resize()` after startup. The Electron `BrowserWindow` is resized programmatically via `mainWindow.setSize(1024, 1068)` (or `setContentSize`), but the PixiJS canvas within it remains unchanged.

Keep `resizable: false` in Electron's `BrowserWindow` options — only the programmatic initial resize is needed. Verify using `mainWindow.getContentSize()` vs. `mainWindow.getSize()` — on Windows, the content size excludes the title bar, so use `setContentSize(1024, 1068)` to ensure the canvas + dashboard both fit.

**Warning signs:**
- Agents appear at wrong positions after window height is changed
- Building interiors render outside the visible canvas area
- Console shows PixiJS warnings about renderer resize
- CSS `height: 100%` on the canvas element (audit for this immediately)

**Phase to address:**
Phase 1 (window layout). The HTML structure, CSS, and Electron `BrowserWindow` configuration must be locked before any dashboard HTML is added. Adding dashboard HTML before fixing the canvas CSS risks the canvas stretching silently.

---

### Pitfall 3: Token Double-Counting from Re-Reading Already-Parsed JSONL Lines

**What goes wrong:**
The app reads active session JSONL files on each 3-second poll cycle. A naive implementation re-reads the entire JSONL file each poll and sums all `message.usage` entries. This works correctly for totals but inflates counts when the same entries are read multiple times. If the cache is not used and line counts are not tracked, the dashboard shows token counts climbing even when Claude has not generated new output — because the same 500 lines are being re-summed on every poll tick.

**Why it happens:**
"Parse the file and sum tokens" is the obvious implementation. The bug is invisible during development (a freshly-started session has few lines), but manifests in production where sessions run for hours and JSONL files grow to thousands of entries. Each 3-second re-parse re-adds all historical tokens from the session, multiplying real counts by `(elapsed_time / 3s)`.

**How to avoid:**
Track the last-read line count (or byte offset) per session file. On each poll cycle, only parse new lines appended since the last read. Accumulate a running total in memory per session rather than re-summing from scratch. Store `{ sessionId, byteOffset, runningTotal }` in a Map:

```typescript
const sessionOffsets = new Map<string, { offset: number; tokens: TokenTotals }>();

async function updateSessionTokens(sessionId: string, filePath: string) {
  const state = sessionOffsets.get(sessionId) ?? { offset: 0, tokens: emptyTokens() };
  const newLines = await readLinesFrom(filePath, state.offset);
  const newOffset = await getFileSize(filePath);

  for (const line of newLines) {
    const entry = JSON.parse(line);
    if (entry.message?.usage) {
      accumulate(state.tokens, entry.message.usage);
    }
  }

  sessionOffsets.set(sessionId, { offset: newOffset, tokens: state.tokens });
}
```

For historical data (previous days), parse once and store aggregated results — never re-parse historical JSONL files on each poll.

**Warning signs:**
- Token counts in the dashboard grow faster than expected relative to actual Claude activity
- Restarting the app shows a different (lower) token count for completed sessions
- Dashboard totals are not reproducible between app restarts

**Phase to address:**
Phase 1 (JSONL parsing infrastructure). The offset-tracking approach must be the implementation from the start. Retrofitting it after the UI is wired up requires auditing all call sites.

---

### Pitfall 4: Cache Token Accounting is Non-Intuitive and Easily Mis-Totaled

**What goes wrong:**
The JSONL `message.usage` object contains four fields: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`. A dashboard that shows "total tokens" by summing only `input_tokens + output_tokens` significantly undercounts because it ignores cache tokens. Conversely, a dashboard that sums all four fields for "total input" is also misleading — cache reads and cache writes have different pricing than regular input tokens, and showing them as undifferentiated "input" causes cost estimates to be wrong.

Cache tokens are also structurally confusing: `cache_creation_input_tokens` appears on the first turn of a cached context block (high cost per token), while `cache_read_input_tokens` appears on all subsequent turns using that cache (low cost per token). A long session will show a spike in `cache_creation_input_tokens` at the start and high `cache_read_input_tokens` accumulation thereafter. Summing all turns naively gives a distorted picture of actual spending.

**Why it happens:**
The four-field structure is specific to Anthropic's API and not well-documented for tool authors. Most third-party token trackers initially got this wrong and had to correct their implementations. The Claude Code JSONL files accumulate cache tokens heavily because every turn re-sends the full conversation history as cached context — per GitHub issue #24147, `cache_read_input_tokens` can dominate 99.93% of quota usage as CLAUDE.md files grow.

**How to avoid:**
Track all four token types separately and display them separately in the UI:

```typescript
interface TokenBreakdown {
  inputTokens: number;           // billed at standard input rate
  outputTokens: number;          // billed at output rate (typically 5x input)
  cacheCreationTokens: number;   // billed at 1.25x input rate (write)
  cacheReadTokens: number;       // billed at 0.1x input rate (read)
}
```

Cost calculation must use separate rates for each field:

```typescript
function calculateCost(tokens: TokenBreakdown, rates: ModelRates): number {
  return (
    tokens.inputTokens * rates.inputPerToken +
    tokens.outputTokens * rates.outputPerToken +
    tokens.cacheCreationTokens * rates.cacheWritePerToken +
    tokens.cacheReadTokens * rates.cacheReadPerToken
  );
}
```

In the UI, show the breakdown so users can see why cache dominates. A single "total tokens" number without the breakdown is misleading for Claude Code sessions.

**Warning signs:**
- Cost estimates appear far lower than actual Anthropic invoices
- "Total tokens" does not match what `ccusage` reports for the same sessions
- Sessions with long CLAUDE.md files show suspiciously low token counts

**Phase to address:**
Phase 2 (token counting). Design the data model with all four token types from the start. Adding cache token fields later requires migrating stored historical data.

---

### Pitfall 5: Hardcoded Token Pricing Rates Become Stale Within Months

**What goes wrong:**
The dashboard embeds pricing rates like `sonnet_input: 0.000003` (per token). Anthropic cut Claude Opus prices by 67% in 2025 (from $15 to $5 per million input tokens). The Claude 4 series introduced Opus 4.5 and Sonnet 4.6 with new pricing tiers. Model names in JSONL files also change (e.g., `claude-sonnet-4-5` becomes `claude-sonnet-4-6`). A hardcoded rate table that does not match the actual model names in the JSONL files defaults to $0 cost for unrecognized models, silently underreporting costs. A rate table that is not updated becomes increasingly inaccurate as Anthropic adjusts prices every few months.

**Why it happens:**
Hardcoding rates is the fastest implementation. It works for the current moment but requires manual code changes on every Anthropic pricing update. Given that Anthropic has released three major model updates in two months (Sonnet 4.5 → Haiku 4.5 → Opus 4.5) and made large price cuts, any hardcoded table has a short shelf life.

**How to avoid:**
Store pricing rates in a user-editable JSON config file, not in source code:

```json
// ~/.claude/agent-world-config.json or app userData path
{
  "pricingRates": {
    "claude-opus-4-6": { "input": 5.00, "output": 25.00, "cacheWrite": 6.25, "cacheRead": 0.50 },
    "claude-sonnet-4-6": { "input": 3.00, "output": 15.00, "cacheWrite": 3.75, "cacheRead": 0.30 },
    "claude-haiku-4-5": { "input": 1.00, "output": 5.00, "cacheWrite": 1.25, "cacheRead": 0.10 },
    "default": { "input": 3.00, "output": 15.00, "cacheWrite": 3.75, "cacheRead": 0.30 }
  },
  "pricingUnit": "per_million_tokens"
}
```

Key design decisions:
- Use per-million-token units in the config (matches Anthropic's published rates) and convert to per-token internally
- Include a `default` entry that applies to unrecognized model names, with a note in the UI that the rate is estimated
- When a JSONL entry has a `model` field that does not match any config key, log the unrecognized model name so users know to update their config
- Show the pricing version date and a link to Anthropic's pricing page in the dashboard footer so users know when to update

Do NOT attempt to auto-fetch pricing from Anthropic — they have no public pricing API, and scraping the pricing page would be fragile.

**Warning signs:**
- Console logs show "unrecognized model: claude-opus-4-6, using default rate" often
- Cost estimates are $0 for recent sessions while older sessions show costs
- User reports that estimated costs do not match their Anthropic invoice

**Phase to address:**
Phase 2 (cost estimation). Design the config file format before implementing the cost calculation. Never write pricing values directly in TypeScript source files.

---

### Pitfall 6: Historical Storage Approach Chosen Too Late Requires Data Migration

**What goes wrong:**
The dashboard shows "today's totals + 30-day daily breakdown." If historical data is stored as individual JSONL files re-parsed on demand, the 30-day view requires reading up to 30 days × (multiple sessions per day) JSONL files on each open — potentially 50-100 files at 2-18MB each. This is unacceptably slow. If data is stored as a single growing JSON file (`history.json`), the entire file must be read and written on every update — at 30 days of data, this file can grow to several MB, and JSON.parse of the full file on startup adds startup latency. SQLite avoids both problems but adds a native module dependency that must be rebuilt for the specific Electron ABI version.

**Why it happens:**
Teams reach for the simplest storage mechanism (JSON file) for early features and discover its limitations only when the dataset grows. For 30 days of daily aggregates, the data volume is actually small (30 records × ~5 fields each). The problem is not data size — it is re-parsing raw JSONL on demand versus reading pre-aggregated summaries.

**How to avoid:**
Use a pre-aggregated JSON store with one record per day, stored in Electron's `app.getPath('userData')`:

```typescript
// ~/.config/Agent World/usage-history.json (or Windows equivalent)
{
  "version": 1,
  "dailyTotals": {
    "2026-02-28": {
      "inputTokens": 1250000,
      "outputTokens": 180000,
      "cacheCreationTokens": 95000,
      "cacheReadTokens": 3200000,
      "estimatedCostUSD": 4.23,
      "sessionCount": 8,
      "completionCount": 6
    },
    "2026-03-01": { ... }
  },
  "lastUpdated": "2026-03-01T14:32:00Z"
}
```

This approach:
- Stores only 30 records (one per day), not raw JSONL data
- Can be read synchronously at startup (tiny file, < 10KB for 30 days)
- Requires writing only on day boundary transitions (once per day, not every poll)
- Requires no native module dependencies (no SQLite rebuild against Electron ABI)
- Is human-readable and user-inspectable

Do NOT use SQLite unless the data model requires complex queries. For 30-day daily aggregates, SQLite is engineering overkill and adds Electron native module complexity (better-sqlite3 must be rebuilt against each Electron major version).

**Warning signs:**
- Dashboard startup takes > 500ms (signals re-parsing historical JSONL)
- The history store file grows > 1MB (signals storing raw entries instead of aggregates)
- Console shows "rebuilding SQLite native module" on first run (signals premature SQLite adoption)

**Phase to address:**
Phase 3 (historical data). Decide the storage format before writing any persistence code. The pre-aggregated JSON approach handles the 30-day case cleanly with zero dependencies.

---

### Pitfall 7: Dashboard HTML Rendered in PixiJS Canvas Space Instead of DOM Layer

**What goes wrong:**
The developer attempts to build the dashboard as a PixiJS Graphics/Text layer added below the world's stage. This creates several problems: text rendering in PixiJS is either BitmapText (good for pixel art but poor for dense numerical data) or HTMLText (which uses CSS in an SVG foreignObject and has known rendering issues in Electron). Click interactions on dashboard rows require manual hit-testing against PixiJS display objects instead of native DOM events. Scrolling a 30-day breakdown list in PixiJS requires implementing a custom scroll container. Updating token counts on each 3-second poll requires re-rendering dozens of PixiJS text objects, which is expensive compared to updating DOM `textContent`.

Additionally, per PixiJS issue #4327, mixing DOM elements with PixiJS elements using `DOMContainer` has an unresolved architectural complexity: DOM elements must be positioned as CSS overlays synchronized with PixiJS transforms, which breaks if the canvas moves.

**Why it happens:**
For developers already working in PixiJS, the temptation is to build everything inside the canvas. The fantasy RPG world is PixiJS, so "add the dashboard to PixiJS" feels natural. But dashboards are a DOM-native use case — tabular data, scrolling lists, styled text, interactive rows — and implementing them in WebGL/Canvas is strictly harder than using HTML.

**How to avoid:**
Build the dashboard as a plain HTML `<div>` below the PixiJS `<canvas>`. The canvas occupies the top 768px; the dashboard div occupies the bottom 300px. They never interact. The dashboard reads token data via IPC from the main process and updates `textContent` and `classList` directly. This approach uses:
- Native DOM scrolling for the 30-day breakdown list
- Native CSS for hover states, truncation, expandable rows
- No PixiJS involvement in the dashboard layer

The PixiJS canvas and the dashboard div are completely separate. The only shared concern is the overall window height. This is the correct architecture.

```html
<div style="display:flex; flex-direction:column; height:1068px;">
  <canvas id="world" style="width:1024px; height:768px; flex:0 0 768px;"></canvas>
  <div id="dashboard" style="flex:0 0 300px; overflow-y:auto; background:#1a1a2e;">
    <!-- session rows, token totals, 30-day chart rendered as HTML -->
  </div>
</div>
```

**Warning signs:**
- Session rows are being added as PixiJS Text or Container objects
- Dashboard scrolling requires a custom PixiJS viewport implementation
- Token count updates cause PixiJS to re-render the display list unnecessarily
- Click handling on dashboard rows goes through PixiJS event system

**Phase to address:**
Phase 1 (window layout). Establish the HTML structure as the first step. The architecture decision (HTML div, not PixiJS layer) must be made before any dashboard rendering code is written.

---

### Pitfall 8: 30-Day Retention Cleanup Race Condition Corrupts History File

**What goes wrong:**
The cleanup job that removes history entries older than 30 days runs at startup or on a timer. If the app is closed mid-write during the cleanup (or if the write and the cleanup both run simultaneously), the `usage-history.json` file can be written in a partially truncated state. On next startup, `JSON.parse` fails and the entire history is lost. This is particularly bad because history cannot be reconstructed from JSONL files without re-parsing all historical sessions (which may no longer exist if Claude Code has cleaned up its own JSONL files).

**Why it happens:**
`fs.writeFileSync()` is not atomic. Writing a large JSON file replaces the file in place. If the process crashes between the old file being cleared and the new content being written, the file is empty. Concurrent writes (main process writes a daily update while the startup cleanup is also running) can interleave and corrupt the output.

**How to avoid:**
Use an atomic write pattern: write to a `.tmp` file first, then rename:

```typescript
import { writeFileSync, renameSync } from 'fs';
import { join } from 'path';

function saveHistoryAtomically(historyPath: string, data: HistoryData): void {
  const tmpPath = historyPath + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmpPath, historyPath);  // atomic on most filesystems
}
```

On Windows, `renameSync` over an existing file may fail if the file is locked. Use a try/catch and fall back to `copyFileSync` + `unlinkSync` if rename fails.

Serialize all history writes through a single async queue — never write the history file from two concurrent code paths. The main process owns the history file exclusively; the renderer reads it via IPC only.

**Warning signs:**
- `usage-history.json` is zero bytes on startup after an unexpected app close
- `JSON.parse` failures in startup logs
- History data resets to empty without user action

**Phase to address:**
Phase 3 (historical data persistence). The atomic write pattern must be the implementation from day one. Retrofitting it requires auditing all write call sites.

---

### Pitfall 9: IPC Data Transfer Overhead for Large Token Aggregates on Each Poll

**What goes wrong:**
The 3-second poll cycle pushes session data from main process to renderer via IPC. If the full token breakdown (all 30 days of history + all live session token counts) is serialized and sent on every poll tick, the IPC payload grows as more sessions accumulate. IPC in Electron serializes objects to JSON for transfer — sending 30 days × 8 sessions/day × 4 token fields = 960+ numbers plus metadata on every 3-second tick is wasteful. More importantly, if the renderer processes a large IPC payload synchronously, it blocks the PixiJS render loop.

**Why it happens:**
The existing IPC pattern sends all session data on each `updateSessions` IPC call. Extending this call to also include token data and historical summaries is the path of least resistance. But combining live session state (changes every 3 seconds) with historical data (changes at most once per day) into the same frequent IPC call is architecturally wrong.

**How to avoid:**
Split IPC into two channels with different update frequencies:

1. **`session-update` (every 3 seconds):** Sends only live session state — status, current tool, token delta since last poll (not cumulative totals). The renderer accumulates deltas locally.

2. **`history-snapshot` (on startup + once per day at midnight):** Sends the full 30-day historical summary. The renderer caches this and only re-requests it via `ipcRenderer.invoke('get-history')` when the user navigates to the history view.

This keeps the high-frequency IPC payload small (< 1KB per tick for typical 4-session usage) and avoids re-sending historical data that has not changed.

**Warning signs:**
- IPC messages are larger than a few KB per 3-second tick
- The renderer's `ipcRenderer.on('session-update')` handler takes > 16ms (misses a frame)
- Historical data is included in every live poll response

**Phase to address:**
Phase 2 (dashboard live data). Design the IPC protocol separation before writing any token-to-renderer IPC code. The separation is cheap to do upfront and expensive to refactor later.

---

### Pitfall 10: Session Duration Calculation is Wrong for Long-Running or Interrupted Sessions

**What goes wrong:**
Session duration is calculated as `lastActivity - firstActivity` from JSONL timestamps. For a session that ran from 9am to 5pm but was idle from 12pm to 2pm (user at lunch), this reports 8 hours even though Claude was only actively working for 6 hours. For sessions interrupted by a system restart or app crash, the last JSONL timestamp before the crash is used as the end time, which may be hours before the session actually stopped. The dashboard shows inflated "active session duration" metrics.

**Why it happens:**
"Duration = last timestamp - first timestamp" is the obvious calculation. It is wrong for long-running sessions with idle gaps, which are exactly the sessions users care most about tracking.

**How to avoid:**
Calculate duration as the sum of active intervals rather than total elapsed time. Define an "active interval" as a sequence of JSONL entries where no gap between consecutive entries exceeds a threshold (e.g., 5 minutes — the same threshold used for idle timeout in the existing session detection logic). If two consecutive JSONL entries are more than 5 minutes apart, the gap is not counted toward duration. This gives "active working time" rather than "wall clock time."

```typescript
function calculateActiveSessionDuration(entries: JsonlEntry[]): number {
  const GAP_THRESHOLD_MS = 5 * 60 * 1000;
  let totalMs = 0;
  for (let i = 1; i < entries.length; i++) {
    const gap = entries[i].timestamp - entries[i-1].timestamp;
    if (gap < GAP_THRESHOLD_MS) {
      totalMs += gap;
    }
  }
  return totalMs;
}
```

Use the same 5-minute idle threshold already used in the session detection logic for consistency.

**Warning signs:**
- Session durations exceed 8 hours for sessions where Claude was clearly idle overnight
- Duration shown for crashed sessions matches the time from session start to app restart, not actual work time
- "Average session duration" is disproportionately high compared to subjective experience

**Phase to address:**
Phase 2 (token counting + session metrics). Define the duration calculation algorithm explicitly and document it in the dashboard tooltip — users will otherwise be confused by the definition of "duration."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `readFileSync` for JSONL parsing | Simpler code, no async complexity | Blocks main process on 18MB files; animation hitches every 3 seconds | Never — streaming is only slightly more complex and always required |
| Hardcoded pricing rates in source code | Fast to implement | Rates stale within months; unrecognized new model names silently cost $0 | Never — use a config JSON file from day one |
| Single `session-update` IPC for all data | No new IPC channels needed | Historical data re-sent every 3 seconds; large payload blocks renderer | Never — split live vs. historical IPC channels |
| Re-parsing full JSONL on each poll | No offset tracking state needed | Token counts multiply by elapsed time; CPU wasteful on 18MB files | Never — track byte offsets from the start |
| SQLite for 30-day daily summaries | Structured queries, ACID writes | Native module ABI rebuild required per Electron major version; overkill for 30 records | Never for this scale — pre-aggregated JSON is sufficient |
| Storing full JSONL entries in history | Easy to add new aggregation later | History file grows unbounded; re-aggregation on startup is slow | MVP only if the data is discarded on next startup (not persisted) |
| Building dashboard as PixiJS layer | No HTML/DOM work needed | Scrolling, text, click interaction all require custom PixiJS reimplementation | Never — HTML div below canvas is strictly simpler |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PixiJS canvas + dashboard HTML | CSS `height: 100%` on canvas element stretches canvas to fill new window height | Explicit `height: 768px` in CSS; never use percentage heights on the PixiJS canvas element |
| Electron `BrowserWindow.setSize()` | Using `setSize()` instead of `setContentSize()` — content area is smaller than window by title bar height | Use `setContentSize(1024, 1068)` so canvas + dashboard fill the content area exactly |
| JSONL `message.usage` structure | Assuming `usage` is always present on every line — most JSONL lines are tool calls with no `usage` field | Guard: `if (entry.message?.usage)` before accessing token fields |
| Claude model name in JSONL | Model name format changes between versions (`claude-3-5-sonnet-20241022` → `claude-sonnet-4-5` → `claude-sonnet-4-6`) | Use prefix matching (`startsWith('claude-opus')`) or a fallback default rate |
| Cache token pricing | Treating `cache_read_input_tokens` at the same rate as `input_tokens` | Cache reads cost 0.1× input rate; cache writes cost 1.25× input rate; always use separate multipliers |
| History file write | Writing JSON directly to the target file — partial write on crash corrupts it | Write to `.tmp` file, then `renameSync` to target (atomic on most filesystems) |
| IPC for historical data | Including 30-day history in the 3-second `session-update` IPC call | Separate `get-history` invoke (on-demand) from `session-update` push (frequent) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full JSONL re-parse on each 3-second poll | Main process CPU usage spikes every 3 seconds; animation stutters | Track byte offset per session file; only read new lines since last poll | Immediately on sessions with > 500 JSONL lines (~1MB) |
| `Promise.all()` for parallel historical JSONL reads | Memory spike at startup; I/O saturation; no meaningful speedup | Process historical files sequentially with `await`; one file at a time | When loading 30+ historical session files simultaneously |
| Re-rendering full dashboard on every IPC tick | DOM thrashing; token numbers flicker; forced layout recalculations | Use DOM diffing: only update `textContent` on elements whose values changed | With 8+ live sessions updating every 3 seconds |
| Dashboard causing PixiJS frame drop | PixiJS reports 20 FPS during dashboard data updates | Dashboard JS must not run during PixiJS render frame; use `requestAnimationFrame` scheduling | Whenever dashboard JS takes > 8ms per update (common with naive DOM update loops) |
| History cleanup deleting files while being read | Partial file read during deletion causes parse failure | Lock history file during cleanup; complete all reads before beginning cleanup writes | During startup when both init-read and cleanup run concurrently |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw cache token counts without explanation | Users see "cache_read_input_tokens: 3,200,000" and are confused why it is so high | Show "Cache Reads" with a tooltip: "Re-used context (billed at 0.1× input rate)" |
| Cost estimate labeled as exact rather than estimated | User compares dashboard cost to Anthropic invoice and finds discrepancy; loses trust | Label all costs as "est." with a note that rates may differ from actual billing; link to pricing page |
| 30-day chart without context | Bar chart with no axis labels or session counts is uninterpretable | Show date labels on x-axis and token count / cost on y-axis; add session count per bar |
| Dashboard obscures RPG world during active sessions | User's attention is split; dashboard draws eye away from agent animations | Keep dashboard panel visually subdued (dark background, muted colors) so RPG world remains primary |
| Token counts updating every 3 seconds cause numeric flicker | Rapidly changing numbers are stressful and unreadable | Round displayed numbers (e.g., show "1.2M" not "1,234,567") and only update when change exceeds 1% |

---

## "Looks Done But Isn't" Checklist

- [ ] **Canvas layout:** Window height expanded to 1068px — verify PixiJS canvas is still 768px by inspecting canvas element `getBoundingClientRect()` (not stretched to 1068px)
- [ ] **Token totals accuracy:** Compare dashboard token totals against `ccusage` output for the same session — they must match within rounding error (< 1%)
- [ ] **Cache token separate rates:** Verify cost estimate uses different rates for `cache_creation_input_tokens` (1.25×) vs `cache_read_input_tokens` (0.1×) — not the same rate for all input token types
- [ ] **Unrecognized model handling:** Start a session with a newly-released model not in the pricing config — verify cost shows "est. (unknown model)" rather than silently returning $0
- [ ] **Offset tracking:** Start a session, let it generate 1000 JSONL lines, restart the app — verify token totals are not doubled (offset tracking resumes from correct position)
- [ ] **History atomicity:** Kill the app mid-write during a daily rollover — restart and verify `usage-history.json` is valid JSON (not empty or truncated)
- [ ] **30-day cleanup:** Simulate 31 days of history entries — verify entries older than 30 days are removed and the file does not grow unboundedly
- [ ] **Duration calculation:** Open a session, pause for 10 minutes, resume, and close — verify the 10-minute idle gap is excluded from the reported session duration
- [ ] **IPC payload size:** Log IPC message size on each `session-update` event — verify it stays under 10KB even with 8 active sessions

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Animation stutter from sync JSONL parse | HIGH | Identify call sites using `readFileSync`; convert each to streaming readline; test with 18MB fixture file |
| Canvas coordinate corruption after height expand | HIGH | Audit all CSS on canvas element; enforce `height: 768px` inline style; call `app.renderer.resize(1024, 768)` after window resize if needed |
| Token double-counting from no offset tracking | MEDIUM | Clear accumulated token state; re-parse all current session files from offset 0 (one-time cost); add offset tracking going forward |
| Corrupted history file | MEDIUM | Delete `usage-history.json`; history resets to today-only (30-day data is lost but app continues working); add atomic write to prevent recurrence |
| Stale pricing rates | LOW | Update config JSON file with current Anthropic rates; cost estimates recalculate on next app restart |
| History storage approach wrong (full JSONL stored) | HIGH | Migrate data: re-aggregate stored raw entries into daily summaries; delete raw entries; update write logic to aggregate at write time |
| Dashboard built as PixiJS layer | HIGH | Migrate to HTML div: remove PixiJS dashboard containers; create `dashboard.ts` HTML renderer; restructure layout HTML |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Synchronous JSONL parsing blocks main process | Phase 1: Parsing infrastructure | Parse 18MB fixture file; confirm main process stays responsive (< 10ms IPC round-trip during parse) |
| Window height expansion corrupts canvas | Phase 1: Window layout | Inspect canvas element after resize; `getBoundingClientRect().height` must equal 768 |
| Dashboard in PixiJS canvas layer | Phase 1: Window layout | Dashboard must be a `<div>` element, not PixiJS Container; verify in DevTools Elements panel |
| Token double-counting from re-reads | Phase 1: Parsing infrastructure | Parse same JSONL twice; totals must be identical to parsing once (idempotent) |
| Cache token mis-accounting | Phase 2: Token counting | Compare 4-field breakdown against `ccusage` output; all four values must match |
| Hardcoded pricing rates | Phase 2: Cost estimation | Change model name in test JSONL to unknown value; verify cost shows "est. (unknown)" not $0 |
| IPC payload bloat | Phase 2: Dashboard live data | Log IPC message byte size; must stay < 10KB per 3-second tick |
| Session duration inflation | Phase 2: Session metrics | Create test JSONL with 10-minute gap between entries; gap must not appear in computed duration |
| Historical storage format | Phase 3: Historical data | History file must be < 10KB for 30 days of data; must load in < 50ms at startup |
| History file corruption on crash | Phase 3: Historical data | Kill process during write; restart; history file must be valid JSON |
| 30-day retention cleanup race | Phase 3: Historical data | Simulate 31-day history; verify cleanup completes atomically and does not corrupt file |
| Stale pricing rates over time | Post-launch | Add UI note with last-updated date and link to Anthropic pricing page |

---

## Sources

- [Electron Performance Docs](https://www.electronjs.org/docs/latest/tutorial/performance) — Main process blocking patterns and Worker Thread recommendations (HIGH confidence, official docs)
- [The Horror of Blocking Electron's Main Process — Actual Budget](https://medium.com/actualbudget/the-horror-of-blocking-electrons-main-process-351bf11a763c) — Real-world case study on main process blocking consequences (MEDIUM confidence, verified pattern)
- [PixiJS Issue #11427 — resizeTo ignores layout changes](https://github.com/pixijs/pixijs/issues/11427) — Confirmed PixiJS bug: resizeTo only responds to window resize events, not DOM layout changes (HIGH confidence, May 2025 issue)
- [PixiJS Renderers Guide](https://pixijs.com/8.x/guides/components/renderers) — Official PixiJS 8 resize and resolution documentation (HIGH confidence)
- [PixiJS Issue #4327 — DOM + PixiJS mixing](https://github.com/pixijs/pixijs/issues/4327) — Architectural complexity of DOMContainer approach (MEDIUM confidence)
- [Electron BrowserWindow Docs](https://www.electronjs.org/docs/latest/api/browser-window) — setSize, setContentSize, content vs. window size (HIGH confidence, official docs)
- [Electron Issue #6320 — Canvas disappears on Windows after minimize-restore](https://github.com/electron/electron/issues/6320) — Windows-specific canvas + minWidth/maxHeight interaction bug (MEDIUM confidence)
- [Node.js Streams for Large Files — Paige Niedringhaus](https://www.paigeniedringhaus.com/blog/streams-for-the-win-a-performance-comparison-of-node-js-methods-for-reading-large-datasets-pt-2/) — Performance comparison: readFileSync vs. readline streaming for large files (HIGH confidence)
- [ccusage — Claude Code Usage CLI](https://github.com/ryoppippi/ccusage) — Reference implementation for JSONL token aggregation; tracks all four token fields separately (HIGH confidence, active project as of 2026)
- [Cache Tokens Dominate Quota — Claude Code Issue #24147](https://github.com/anthropics/claude-code/issues/24147) — Cache read tokens can be 99.93% of quota; confirms cache tokens must be tracked separately (HIGH confidence)
- [Anthropic Pricing Page](https://platform.claude.com/docs/en/about-claude/pricing) — Current model rates and cache pricing multipliers (HIGH confidence, official docs)
- [Anthropic Pricing Cut — InfoWorld](https://www.infoworld.com/article/4095894/anthropics-claude-opus-4-5-pricing-cut-signals-a-shift-in-the-enterprise-ai-market.html) — 67% Opus price cut in 2025 documents pricing volatility (HIGH confidence)
- [Model Deprecations — Anthropic Docs](https://platform.claude.com/docs/en/about-claude/model-deprecations) — Deprecation timeline and 60-day notice policy (HIGH confidence, official docs)
- [RxDB Electron Database Guide](https://rxdb.info/electron-database.html) — SQLite vs. JSON file tradeoffs for Electron persistence (MEDIUM confidence)
- [Electron IPC Memory Leak — Issue #27039](https://github.com/electron/electron/issues/27039) — IPC event listener leaks when contextBridge is used incorrectly (MEDIUM confidence)
- [Shipyard: Claude Code Tokens Explained](https://shipyard.build/blog/claude-code-tokens/) — Token type definitions and cost calculation methodology (MEDIUM confidence)

---
*Pitfalls research for: Agent World v1.5 — Usage Dashboard (token tracking, cost estimation, historical stats)*
*Researched: 2026-03-01*

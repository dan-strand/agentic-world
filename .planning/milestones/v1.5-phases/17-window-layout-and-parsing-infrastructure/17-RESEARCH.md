# Phase 17: Window Layout and Parsing Infrastructure - Research

**Researched:** 2026-03-01
**Domain:** Electron window layout expansion + streaming JSONL token usage parsing
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAYOUT-01 | Window expands from 1024x768 to 1024x1080 with dashboard panel below the RPG world | Pattern 1 (Window Expansion) documents exact BrowserWindow config changes, CSS layout, and HTML structure. Verified against current `main/index.ts` lines 23-30 and `index.html` CSS. |
| LAYOUT-02 | PixiJS canvas remains pinned at exactly 1024x768 -- no scene graph changes | PixiJS app is initialized with explicit `width: WORLD_WIDTH (1024)`, `height: WORLD_HEIGHT (768)` in `world.ts` line 119-127. No `resizeTo` option is used. Canvas just needs `flex-shrink: 0` and explicit height in CSS. Zero PixiJS code changes required. |
| LAYOUT-03 | Dashboard panel renders as HTML/CSS div below the canvas | Pattern 2 (Dashboard as HTML div) shows the `#dashboard` div structure. Existing project already mixes HTML elements with PixiJS canvas (drag region, audio controls). Same established pattern. |
| PARSE-01 | JSONL usage parser extracts input_tokens, output_tokens, cache_creation_input_tokens, and cache_read_input_tokens from assistant entries | Live JSONL verification confirms all four fields at `message.usage` on `type: "assistant"` entries. Model at `message.model`. Code example in Pattern 3. |
| PARSE-02 | Parser uses streaming readline to avoid blocking the main process | Benchmark: 33MB file parsed via `readline.createInterface` + `fs.createReadStream` in 173ms. Pattern 3 documents the async iterator approach. Must be async to avoid blocking the 3s poll cycle. |
| PARSE-03 | Parser caches results by file mtime to skip unchanged files on subsequent polls | Pattern 4 (mtime-cached aggregator) mirrors the existing `FilesystemSessionDetector.mtimeCache` pattern already proven in the codebase. Only files with changed mtime are re-scanned. |
</phase_requirements>

## Summary

Phase 17 is the foundation layer for the v1.5 Usage Dashboard. It addresses two independent concerns that must both be correct before any dashboard UI work begins in Phase 18: (1) expanding the Electron window to accommodate a dashboard panel below the RPG world, and (2) building a streaming JSONL parser that can extract token usage data without blocking the animation.

The window expansion is straightforward but has specific pitfalls. The current `BrowserWindow` is locked at 1024x768 with `resizable: false`, `maxWidth: 1024`, `maxHeight: 768`. The `#app` div uses `width: 100%; height: 100%` CSS which will cause the PixiJS canvas to stretch if the window grows without pinning the canvas. The fix is a flex column layout with the `#app` div at fixed 768px height and a new `#dashboard` div at 312px below it. The PixiJS `Application` is already initialized with explicit pixel dimensions (1024x768) and no `resizeTo`, so the canvas itself is safe -- only the CSS container needs pinning.

The JSONL parser is the higher-risk component. Live verification confirms that token usage fields (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) live at `message.usage` on `type: "assistant"` entries, and the model name is at `message.model`. A benchmark on the project's largest JSONL file (33MB, 8907 lines, 1237 assistant entries) shows streaming readline completes in 173ms. This is acceptable for a one-time scan but would cause visible stutter if run on every 3s poll for every session. The mtime cache pattern (already proven in `FilesystemSessionDetector`) ensures only changed files are re-scanned, keeping per-poll I/O to the 1-3 actively-writing sessions.

**Primary recommendation:** Implement window expansion and JSONL parser as independent work streams. The window layout is CSS/HTML only with zero PixiJS changes. The parser is a new async function added to `jsonl-reader.ts` (existing file, additive export) consumed by a new `UsageAggregator` class with mtime caching.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:readline` | Built-in (Node.js 22) | Streaming line-by-line JSONL parsing | Avoids loading full files into memory. `for await (const line of rl)` async iterator is stable since Node.js 11.4. Available in Electron 40.6.1's Node.js 22. Zero install. |
| `node:fs` | Built-in (already used) | File stat for mtime checks, createReadStream for parser input | Already used throughout `session-detector.ts` and `jsonl-reader.ts`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:path` | Built-in (already used) | Resolve JSONL file paths | Already used in `session-detector.ts` |
| `node:os` | Built-in (already used) | `os.homedir()` for `~/.claude/projects/` path | Already used in `session-detector.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:readline` streaming | `fs.readFileSync` + split | Simpler code but blocks main process for 100-800ms on 18-33MB files. Causes visible animation stutter. Never acceptable for this use case. |
| `node:readline` streaming | `stream-json` / `jsonlines` npm packages | Third-party packages for a task Node.js handles natively. Zero benefit over built-in readline + JSON.parse per line. Adds unnecessary dependency. |
| Mtime-based cache | Byte-offset incremental parsing | More complex state management (track offset per file, handle file truncation). Mtime cache is simpler and already proven in codebase. For Phase 17 (foundation), full-file re-scan on mtime change is sufficient. Byte-offset optimization can be added later if needed. |

### Installation

No new npm dependencies required for Phase 17. All functionality uses Node.js built-ins.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main/
│   ├── index.ts              # MODIFIED: window 768→1080 height
│   ├── jsonl-reader.ts       # MODIFIED: add readUsageTotals() export
│   ├── usage-aggregator.ts   # NEW: mtime-cached per-session token totals
│   ├── session-store.ts      # UNCHANGED (Phase 17 does not wire dashboard IPC)
│   ├── session-detector.ts   # UNCHANGED
│   └── ipc-handlers.ts       # UNCHANGED (Phase 17 does not add IPC channels)
├── renderer/
│   ├── index.html            # MODIFIED: flex column layout, add #dashboard div
│   ├── index.ts              # UNCHANGED
│   └── [all other files]     # UNCHANGED
├── shared/
│   ├── types.ts              # MODIFIED: add SessionUsage, TokenUsage interfaces
│   └── constants.ts          # MODIFIED: add DASHBOARD_HEIGHT, WINDOW_HEIGHT constants
└── preload/
    └── preload.ts            # UNCHANGED
```

### Pattern 1: Window Expansion (1024x768 to 1024x1080)

**What:** Increase BrowserWindow dimensions from 768px to 1080px height. Restructure `index.html` body as a flex column with the PixiJS `#app` div pinned at 768px and a new `#dashboard` div occupying the remaining 312px below.

**When to use:** This is the only approach for this project. Alternatives (second BrowserWindow, PixiJS-based dashboard) are documented anti-patterns.

**Current state (verified from codebase):**

`main/index.ts` lines 23-30:
```typescript
const mainWindow = new BrowserWindow({
  width: 1024,
  height: 768,
  minWidth: 1024,
  minHeight: 768,
  maxWidth: 1024,
  maxHeight: 768,
  resizable: false,
  // ...
});
```

`index.html` current CSS:
```css
html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1a2e; }
#app { width: 100%; height: 100%; }
```

**Required changes:**

`main/index.ts` -- update all height values:
```typescript
const mainWindow = new BrowserWindow({
  width: 1024,
  height: 1080,       // was 768
  minWidth: 1024,
  minHeight: 1080,    // was 768
  maxWidth: 1024,
  maxHeight: 1080,    // was 768
  resizable: false,
  // ... rest unchanged
});
```

`index.html` -- restructure CSS and add dashboard div:
```html
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1024px;
    height: 1080px;       /* was 100% */
    overflow: hidden;
    background: #1a1a2e;
    display: flex;
    flex-direction: column;
  }
  #app {
    width: 1024px;
    height: 768px;        /* PINNED -- never changes */
    flex-shrink: 0;       /* prevent flex from compressing canvas */
    -webkit-app-region: no-drag;
  }
  #dashboard {
    width: 1024px;
    height: 312px;        /* 1080 - 768 = 312 */
    flex-shrink: 0;
    overflow-y: auto;     /* internal scroll if content exceeds */
    background: #0f0f1a;
    border-top: 1px solid #2a2a3e;
    color: #c9a96e;
    font-family: 'Segoe UI', sans-serif;
    font-size: 13px;
  }
</style>
<body>
  <div id="drag-region">...</div>
  <div id="app"></div>
  <div id="dashboard"></div>
  <div id="audio-controls">...</div>
</body>
```

**Critical details:**
- `#app` must have `height: 768px` (explicit pixels), NOT `height: 100%`. The current `height: 100%` would stretch the canvas to 1080px.
- `#app` must have `flex-shrink: 0` to prevent flex layout from compressing it.
- The PixiJS `Application` init in `world.ts` already uses `width: WORLD_WIDTH (1024), height: WORLD_HEIGHT (768)` with no `resizeTo` -- the canvas itself requires zero changes.
- `#audio-controls` uses `position: fixed; bottom: 8px; right: 8px` which will place it over the dashboard panel. Needs repositioning to `bottom: 320px` (above dashboard) or moved inside the dashboard strip.

### Pattern 2: Dashboard as HTML Div (Not PixiJS)

**What:** The `#dashboard` div is a standard HTML container that Phase 18 will populate with session rows, token counts, and cost estimates. Phase 17 creates the empty div with correct dimensions and basic styling. No PixiJS involvement.

**Why:** The project already mixes HTML DOM elements with the PixiJS canvas:
- `#drag-region` with minimize/close buttons (HTML, `position: fixed`)
- `#audio-controls` with mute button and volume slider (HTML, `position: fixed`)

The dashboard extends this established pattern. PixiJS is for sprite animation; HTML is for text-heavy data displays.

**Phase 17 scope:** The dashboard div is empty or shows a minimal placeholder text (e.g., "Dashboard loading...") to visually confirm the region exists. Content rendering is Phase 18.

### Pattern 3: Streaming JSONL Usage Parser

**What:** A new `readUsageTotals()` async function in `jsonl-reader.ts` that reads a full JSONL file via streaming readline and returns aggregated token usage totals.

**Verified JSONL structure (from live file inspection):**
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6",
    "usage": {
      "input_tokens": 2,
      "cache_creation_input_tokens": 15014,
      "cache_read_input_tokens": 11128,
      "output_tokens": 9,
      "service_tier": "standard"
    }
  },
  "timestamp": "2026-03-01T01:35:13.099Z"
}
```

**Key facts verified against live data:**
- `model` is at `message.model` (NOT top-level `obj.model`)
- `usage` is at `message.usage` (NOT top-level `obj.usage`)
- All four token fields are always present on assistant entries with usage
- Largest file in this project: 33MB, 8907 lines, 1237 assistant entries
- Streaming readline parse of 33MB file: 173ms

**Implementation pattern:**
```typescript
import * as fs from 'fs';
import * as readline from 'readline';

export interface TokenUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
  turnCount: number;
}

export async function readUsageTotals(filePath: string): Promise<TokenUsageTotals> {
  const totals: TokenUsageTotals = {
    inputTokens: 0, outputTokens: 0,
    cacheCreationTokens: 0, cacheReadTokens: 0,
    model: '', turnCount: 0,
  };

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,  // handles Windows \r\n
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
      // Malformed line (mid-write race) -- skip
    }
  }

  return totals;
}
```

**Important:** This function is `async` because it uses `for await`. It MUST be awaited by callers. The existing `readLastJsonlLine()` and `readLastToolUse()` are synchronous functions using `fs.openSync/readSync` -- this new function uses a fundamentally different I/O pattern. Both patterns coexist in the same file.

### Pattern 4: Mtime-Cached Usage Aggregator

**What:** A `UsageAggregator` class that wraps `readUsageTotals()` with a per-session mtime cache. Only re-scans files whose mtime has changed since the last scan.

**Mirrors existing pattern:** `FilesystemSessionDetector` already uses `mtimeCache: Map<string, { mtimeMs, sessionInfo, hasToolUse }>` (verified in `session-detector.ts` line 33). The aggregator follows the same caching strategy.

```typescript
export class UsageAggregator {
  private cache: Map<string, { mtimeMs: number; totals: TokenUsageTotals }> = new Map();

  async getUsageForFile(sessionId: string, filePath: string): Promise<TokenUsageTotals | null> {
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
      return null;
    }
  }
}
```

**Phase 17 scope:** Build the aggregator but do NOT wire it into the poll cycle yet. That integration happens in Phase 18 when the dashboard-update IPC channel is added. Phase 17 ensures the parser and aggregator are correct and testable in isolation.

### Anti-Patterns to Avoid

- **Stretching the canvas with `height: 100%`:** The current `#app { height: 100% }` will make the PixiJS canvas fill 1080px instead of 768px. Must change to explicit `height: 768px`.
- **Calling `app.renderer.resize()` after window expansion:** The PixiJS renderer must stay at 1024x768. Never call resize on it. The window grows; the canvas does not.
- **Using `readFileSync` for full JSONL parsing:** Synchronous reads of 18-33MB files block the main process for 100-800ms. Always use streaming readline.
- **Adding token fields to `SessionInfo`:** Token data belongs in a separate `SessionUsage` type. `SessionInfo` is for lightweight status updates pushed to the RPG world every 3s.
- **Reading the full file on every 3s poll:** Without mtime caching, 8 sessions x 33MB = 264MB read per poll cycle. Use mtime to skip unchanged files.
- **Putting dashboard content in PixiJS:** PixiJS is for sprite animation. HTML/CSS is for data tables. The codebase already mixes HTML + PixiJS successfully.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Line-by-line file parsing | Custom stream splitter or `readFileSync().split('\n')` | `readline.createInterface` + `fs.createReadStream` | readline handles Windows CRLF via `crlfDelay: Infinity`, manages backpressure, and is zero-dependency. Custom splitters miss edge cases (partial lines at buffer boundaries, BOM characters). |
| Mtime-based file change detection | Custom polling with `fs.watch` or chokidar for JSONL changes | `fs.statSync(path).mtimeMs` comparison against cached value | The codebase already uses this exact pattern in `FilesystemSessionDetector.mtimeCache`. Simple, proven, no filesystem watcher overhead. |

**Key insight:** Phase 17 requires no new npm dependencies. Every capability needed is either a Node.js built-in or an existing pattern already proven in the codebase.

## Common Pitfalls

### Pitfall 1: Canvas Stretching After Window Height Change
**What goes wrong:** The `#app` div has `height: 100%` CSS. When the window grows from 768px to 1080px, the div stretches to 1080px, and the PixiJS canvas rendered inside it also stretches, distorting the pixel-art world and breaking all building/agent coordinate calculations.
**Why it happens:** The current CSS assumes `body` is 768px tall, so `height: 100%` on `#app` equals 768px. After expansion, `100%` of 1080px = 1080px.
**How to avoid:** Change `#app` CSS from `height: 100%` to `height: 768px` with `flex-shrink: 0`. The PixiJS `Application` is already initialized with explicit `width: 1024, height: 768` and no `resizeTo`, so only the CSS container needs pinning.
**Warning signs:** Agents appear at wrong positions; buildings stretch vertically; console shows no PixiJS errors (it silently renders into the larger container).

### Pitfall 2: Audio Controls Overlap Dashboard
**What goes wrong:** `#audio-controls` is positioned with `position: fixed; bottom: 8px; right: 8px`. After the window grows, this places the controls over the dashboard area (8px from the bottom of the new 1080px window, which is inside the dashboard strip).
**Why it happens:** Fixed positioning is relative to the viewport (the full window), not to the canvas area.
**How to avoid:** Reposition audio controls to `bottom: 320px` (312px dashboard + 8px margin) or move them into the dashboard strip. Alternatively, use `top: 740px` to pin them relative to the top of the window (just inside the canvas area).
**Warning signs:** Mute button and volume slider appear overlapping dashboard text or are visually cut off at the canvas/dashboard boundary.

### Pitfall 3: Synchronous readUsageTotals Blocks Main Process
**What goes wrong:** Implementing `readUsageTotals()` with `fs.readFileSync` + `split('\n')` because it is simpler. On a 33MB file, this blocks the event loop for ~170ms+. During the block, IPC messages queue up, the PixiJS animation freezes, and the window becomes unresponsive.
**Why it happens:** The synchronous pattern is the "obvious" implementation. It works during development with small test files but fails with real-world 18-33MB session files.
**How to avoid:** Use `readline.createInterface` with `fs.createReadStream` and `for await` iterator from the start. The function signature must be `async function readUsageTotals(): Promise<TokenUsageTotals>`.
**Warning signs:** PixiJS animation hitches every time a file is re-scanned; Node.js event loop lag exceeds 100ms during the poll cycle.

### Pitfall 4: Using setSize Instead of Direct Config Properties
**What goes wrong:** Trying to resize the window dynamically with `mainWindow.setSize(1024, 1080)` after creation, instead of setting the size in the BrowserWindow constructor options. `setSize()` on frameless windows can cause visual artifacts on Windows (content renders before window resizes).
**Why it happens:** Some developers think the window should be created at the old size and then resized. This is unnecessary for a fixed-size window expansion.
**How to avoid:** Set `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight` directly in the BrowserWindow constructor options. The window is created at the correct size from the start.
**Warning signs:** Brief flash of 768px window before it snaps to 1080px; content shifts during resize animation.

### Pitfall 5: message.model vs Top-Level model Field Path Confusion
**What goes wrong:** The parser reads `entry.model` (top-level) instead of `entry.message.model` for the model name. Top-level `model` does not exist on JSONL entries -- the field is always inside `message`.
**Why it happens:** Prior research documents mentioned both `message.model` and top-level `model` as possible locations. Live verification conclusively shows it is only at `message.model`.
**How to avoid:** Always access `entry.message?.model`. Live verification against 200 assistant entries showed 100% at `message.model`, 0% at top-level `model`.
**Warning signs:** Model string is always empty or undefined; cost calculations fall back to default pricing for every session.

## Code Examples

### Example 1: Window Expansion Changes (main/index.ts)

```typescript
// BEFORE (current):
const mainWindow = new BrowserWindow({
  width: 1024,
  height: 768,
  minWidth: 1024,
  minHeight: 768,
  maxWidth: 1024,
  maxHeight: 768,
  resizable: false,
  maximizable: false,
  fullscreenable: false,
  autoHideMenuBar: true,
  frame: false,
  // ...
});

// AFTER:
const mainWindow = new BrowserWindow({
  width: 1024,
  height: 1080,       // 768 + 312 dashboard
  minWidth: 1024,
  minHeight: 1080,
  maxWidth: 1024,
  maxHeight: 1080,
  resizable: false,
  maximizable: false,
  fullscreenable: false,
  autoHideMenuBar: true,
  frame: false,
  // ...
});
```

### Example 2: HTML Layout Restructure (index.html)

```html
<!-- Key CSS changes -->
<style>
  html, body {
    width: 1024px;
    height: 1080px;
    overflow: hidden;
    background: #1a1a2e;
    display: flex;
    flex-direction: column;
  }
  #app {
    width: 1024px;
    height: 768px;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
  }
  #dashboard {
    width: 1024px;
    height: 312px;
    flex-shrink: 0;
    overflow-y: auto;
    background: #0f0f1a;
    border-top: 1px solid #2a2a3e;
    color: #c9a96e;
    font-family: 'Segoe UI', sans-serif;
    font-size: 13px;
    padding: 8px 12px;
  }
  #audio-controls {
    position: fixed;
    bottom: 320px;    /* was bottom: 8px -- now above dashboard */
    right: 8px;
    /* rest unchanged */
  }
</style>

<!-- Body structure -->
<body>
  <div id="drag-region">...</div>
  <div id="app"></div>
  <div id="dashboard"></div>
  <div id="audio-controls">...</div>
</body>
```

### Example 3: Streaming JSONL Parser (jsonl-reader.ts addition)

```typescript
// New types added to jsonl-reader.ts
export interface TokenUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
  turnCount: number;
}

// New async export -- does NOT modify existing readLastJsonlLine or readLastToolUse
export async function readUsageTotals(filePath: string): Promise<TokenUsageTotals> {
  const totals: TokenUsageTotals = {
    inputTokens: 0, outputTokens: 0,
    cacheCreationTokens: 0, cacheReadTokens: 0,
    model: '', turnCount: 0,
  };

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
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
      // skip malformed lines
    }
  }

  return totals;
}
```

### Example 4: Usage Aggregator with Mtime Cache (usage-aggregator.ts)

```typescript
import * as fs from 'fs';
import { readUsageTotals, TokenUsageTotals } from './jsonl-reader';

export class UsageAggregator {
  private cache = new Map<string, { mtimeMs: number; totals: TokenUsageTotals }>();

  async getUsage(sessionId: string, filePath: string): Promise<TokenUsageTotals | null> {
    try {
      const stat = fs.statSync(filePath);
      const cached = this.cache.get(sessionId);

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.totals;
      }

      const totals = await readUsageTotals(filePath);
      this.cache.set(sessionId, { mtimeMs: stat.mtimeMs, totals });
      return totals;
    } catch {
      return null;
    }
  }

  clearSession(sessionId: string): void {
    this.cache.delete(sessionId);
  }
}
```

### Example 5: New Type Definitions (shared/types.ts additions)

```typescript
// Token usage from a single JSONL assistant entry's message.usage
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

// Aggregated usage for one session (accumulated across all assistant entries)
export interface SessionUsage {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
  turnCount: number;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `readFileSync` + split for JSONL | `readline.createInterface` + `createReadStream` | Standard since Node.js 11.4 (2018) | Non-blocking streaming; handles backpressure and CRLF automatically |
| Percentage-based CSS heights for mixed layouts | Explicit pixel heights with `flex-shrink: 0` | CSS flexbox best practice | Prevents container children from being stretched or compressed unpredictably |
| Window resize via `setSize()` after creation | Set dimensions in BrowserWindow constructor | Electron best practice for fixed-size windows | Avoids visual flash on startup |

## Open Questions

1. **Audio controls positioning after window expansion**
   - What we know: `#audio-controls` uses `position: fixed; bottom: 8px` which will overlap the dashboard.
   - What's unclear: Should controls move above the dashboard boundary (bottom: 320px), be embedded within the dashboard strip, or stay overlapping the canvas at bottom: 8px (canvas-relative)?
   - Recommendation: Move to `bottom: 320px` (simplest, preserves current visual). This is a CSS-only change. If the dashboard design later needs the controls embedded, it is trivial to move them.

2. **Dashboard placeholder content for Phase 17**
   - What we know: Phase 17 creates the empty dashboard div. Phase 18 populates it.
   - What's unclear: Should Phase 17 show placeholder text ("Dashboard loading...") or leave it truly empty (just the dark background strip)?
   - Recommendation: Show minimal placeholder text like "Usage Dashboard" in muted color. This confirms the div is rendering correctly and helps visual testing. Use a simple `<p>` element, no complex HTML.

3. **UsageAggregator wiring: Phase 17 or Phase 18?**
   - What we know: The aggregator is built in Phase 17. But wiring it into the SessionStore poll cycle requires a new `dashboard-update` IPC channel (Phase 18 scope).
   - What's unclear: Should Phase 17 wire the aggregator into the poll cycle (leaking into Phase 18 territory)?
   - Recommendation: Phase 17 builds the aggregator as a standalone module. Phase 18 wires it into SessionStore and adds the IPC channel. This keeps Phase 17 focused on infrastructure correctness without coupling to dashboard UI.

## Existing Code Impact Analysis

### Files Modified

| File | Change Type | Risk | Details |
|------|------------|------|---------|
| `src/main/index.ts` | Config change | LOW | Change 4 numeric values (height, minHeight, maxHeight, maxWidth stays 1024). No logic changes. |
| `src/renderer/index.html` | Layout restructure | MEDIUM | Change body/app CSS from `100%` to explicit pixels. Add flex column. Add `#dashboard` div. Reposition `#audio-controls`. Must verify PixiJS canvas still renders at 768px. |
| `src/main/jsonl-reader.ts` | Additive export | LOW | Add `readUsageTotals()` async function and `TokenUsageTotals` interface. Zero changes to existing `readLastJsonlLine()` or `readLastToolUse()`. New imports for `readline`. |
| `src/shared/types.ts` | Additive interfaces | LOW | Add `TokenUsage`, `SessionUsage` interfaces. Zero changes to existing types. |
| `src/shared/constants.ts` | Additive constants | LOW | Add `DASHBOARD_HEIGHT = 312`, `WINDOW_HEIGHT = 1080` constants. Zero changes to existing constants. |

### Files Created

| File | Purpose |
|------|---------|
| `src/main/usage-aggregator.ts` | Mtime-cached wrapper around `readUsageTotals()` |

### Files NOT Modified (Zero-Touch)

| File | Why |
|------|-----|
| `src/renderer/world.ts` | PixiJS scene graph is unchanged. Canvas dimensions set by `Application` init, not CSS. |
| `src/renderer/agent.ts` | Agent positioning relative to 1024x768 canvas is unchanged. |
| `src/renderer/building.ts` | Building coordinates unchanged. |
| `src/renderer/game-loop.ts` | Animation loop unchanged. |
| `src/main/session-store.ts` | Poll cycle unchanged in Phase 17. Dashboard IPC wiring is Phase 18. |
| `src/main/session-detector.ts` | Status detection unchanged. |
| `src/preload/preload.ts` | No new IPC channels in Phase 17. |
| All other renderer files | Unchanged. |

## Performance Expectations

| Operation | Expected Duration | Measured | Acceptable? |
|-----------|-------------------|----------|-------------|
| Streaming readline parse of 33MB JSONL | 150-200ms | 173ms | Yes, but only acceptable when cached by mtime. Must NOT run on every 3s poll. |
| Streaming readline parse of 5MB JSONL | 30-50ms | Not measured (extrapolated from 33MB linear) | Yes |
| Mtime stat check per file | < 1ms | Standard fs.statSync | Yes, runs on every poll for all sessions |
| Full poll cycle with 8 sessions, 1 changed | < 200ms | 7 stat checks (~7ms) + 1 parse (~50-173ms) | Yes |
| Full poll cycle with 8 sessions, 0 changed | < 10ms | 8 stat checks only | Yes |

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: all 23 source files in `src/` -- existing patterns verified
- Live JSONL inspection: `~/.claude/projects/C--Users-dlaws-Projects-Agent-World/5de0e917-*.jsonl` -- confirmed `message.usage` structure, `message.model` field path
- Live JSONL benchmark: `c25db940-*.jsonl` (33MB, 8907 lines) parsed via streaming readline in 173ms
- Model field path verification: 200 assistant entries checked, 100% at `message.model`, 0% at top-level `model`
- Node.js `readline` docs -- `for await (const line of rl)` async iterator, `crlfDelay: Infinity` for Windows CRLF

### Secondary (MEDIUM confidence)
- Electron BrowserWindow docs -- `width`/`height`/`maxHeight` for window geometry
- PixiJS Application init -- `width`/`height` explicit pixel dimensions, no `resizeTo` needed
- Existing mtime cache pattern in `FilesystemSessionDetector.mtimeCache` -- proven approach for this exact use case

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Node.js built-ins, verified against live files
- Architecture: HIGH - All patterns derived from direct codebase analysis and live JSONL verification
- Pitfalls: HIGH - Canvas stretching, audio overlap, and sync blocking all verified against actual current code state

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable domain -- Node.js built-ins and Electron BrowserWindow API are not changing)

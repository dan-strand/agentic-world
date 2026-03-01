# Stack Research

**Domain:** Animated 2D pixel-art desktop process visualizer (always-on, Windows)
**Researched:** 2026-03-01
**Confidence:** HIGH

---

## v1.5 Usage Dashboard -- Stack Additions Only

This document covers stack needs for the v1.5 usage dashboard: a panel below the RPG world showing live session details, token usage, cost estimates, and 30-day historical trends.

**Validated core (do not re-research):** Electron 40.6.1, PixiJS 8.16.0, TypeScript 5.7, pixi-filters 6.1.5, Webpack (Electron Forge), pngjs, chokidar. JSONL tail-read pattern already implemented in `src/main/jsonl-reader.ts`.

**Bottom line:** One new npm dependency (Chart.js). Data persistence uses Node.js `fs` with a JSON file. JSONL batch parsing uses the Node.js built-in `readline` module. The dashboard itself is plain HTML/CSS in the existing renderer process.

---

## Recommended Stack

### Core Technologies (New Additions Only)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Chart.js | ^4.5.1 | 30-day trend bar chart in renderer | Lightest canvas-based charting library (11KB gzipped). Renders on HTML `<canvas>` — no WebGL context needed, no Electron-specific issues. Already in every developer's mental model. Tree-shakeable so only the Bar chart registers. No React or framework dependency. |

### Supporting Libraries (Node.js Built-ins — No Install Needed)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `node:readline` | Batch JSONL parsing line-by-line for token aggregation | Historical stats scan: read entire JSONL files from start, accumulate `message.usage` totals per day |
| `node:fs` (already used) | Read/write the persistent stats JSON file | `fs.readFileSync` / `fs.writeFileSync` for the small (< 50KB) daily-rollup file |
| `node:path` (already used) | Resolve JSONL file paths | Already used in `session-detector.ts` |

### No Additional Libraries Required

| Feature | Approach | Reason |
|---------|----------|--------|
| Dashboard panel layout | Plain HTML `<div>` below the PixiJS `<canvas>` | Renderer process already runs in Chromium — full CSS flexbox/grid available. Adding a CSS framework (Tailwind, Bootstrap) is over-engineering for a fixed-width panel. |
| Dashboard data updates | IPC message from main to renderer | Existing IPC pattern (`ipc-handlers.ts`) already pushes `sessions-update`. Reuse same channel pattern for `dashboard-update`. |
| Historical stats storage | JSON file in `app.getPath('userData')` | 30 days of daily rollups is < 10KB. SQLite (better-sqlite3) is native module requiring `@electron/rebuild` — adds build complexity for no benefit at this data scale. A single JSON file with `fs.readFileSync`/`fs.writeFileSync` is sufficient and zero-friction. |
| Cost calculation | Hardcoded rate table in TypeScript | Claude API pricing is stable within a model generation. A runtime pricing fetch adds network dependency to an always-offline app. Rates are O(10) values stored as a typed constant. Updating rates means a code edit, not a config file. |
| Session list rows | HTML/CSS in the renderer | Click-to-expand details are standard `<details>`/`<summary>` or a toggled class. No virtual list library needed for max ~8 rows. |

---

## Architecture Decision: Dashboard Rendering Approach

**Use HTML in the existing renderer process, not a second BrowserWindow.**

The existing `index.html` contains a full-height `<div id="app">` that PixiJS attaches to. The PixiJS canvas fills it entirely. For the dashboard:

1. Change the window height in `main/index.ts` (e.g., from 768 to ~1000px).
2. Add a `<div id="dashboard">` below `<div id="app">` in `index.html`.
3. The PixiJS canvas stays at fixed 1024x768 (unchanged). The dashboard panel occupies the new space below.

**Why not a second BrowserWindow:** Two windows means two renderer processes, IPC routing to both, and session management complexity. The existing single-window layout handles HTML + canvas side-by-side without issue — the audio controls and drag region are already plain HTML elements overlapping the PixiJS canvas. A below-canvas dashboard is simpler.

**Why not PixiJS for the dashboard:** Token counts, session names, cost estimates, and a bar chart are fundamentally HTML UI problems. PixiJS text rendering (BitmapText, canvas drawText) is not designed for data table layouts, click interactions, or text selection. HTML/CSS is the correct tool.

---

## Chart.js Integration Pattern

Chart.js renders to an HTML `<canvas>` element. In the renderer process, it works exactly as in any web page. No `electron-chartjs` wrapper needed — that package is a legacy compatibility shim for old Chart.js v2 + Electron combinations.

```typescript
// In renderer/dashboard.ts
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';

// Register only what's needed (tree-shaking via explicit registration)
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const ctx = document.getElementById('trend-chart') as HTMLCanvasElement;
const chart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: last30DayLabels,    // ['Feb 01', 'Feb 02', ...]
    datasets: [{
      label: 'Daily Cost (USD)',
      data: last30DayCosts,
      backgroundColor: '#c9a96e',  // matches existing RPG gold palette
    }]
  },
  options: {
    responsive: false,            // fixed-size canvas, no resize listener needed
    animation: false,             // dashboard updates are frequent, skip animation
    plugins: { legend: { display: false } }
  }
});

// Update on new data
chart.data.datasets[0].data = newCosts;
chart.update('none');  // 'none' = no animation on update
```

**Webpack note:** Chart.js is an ESM package. Electron Forge's webpack config handles ESM imports from `node_modules` correctly via `@electron-forge/plugin-webpack`. No special config needed.

---

## JSONL Batch Parsing for Historical Stats

The existing `jsonl-reader.ts` tail-reads (last 4096 bytes) for status detection. Historical token aggregation requires full-file reads — a different code path, not a modification of the existing tail-reader.

**Pattern: Node.js readline (no new library)**

```typescript
// In main/token-aggregator.ts (new file)
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import * as path from 'node:path';

interface DailyStats {
  date: string;          // 'YYYY-MM-DD'
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUSD: number;
  sessionCount: number;
  completionCount: number;
}

async function aggregateSessionTokens(jsonlPath: string): Promise<Map<string, DailyStats>> {
  const dailyMap = new Map<string, DailyStats>();

  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,  // handles Windows \r\n line endings
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      // Only process entries with message.usage (assistant turns with token counts)
      const usage = entry?.message?.usage;
      if (!usage) continue;

      const date = entry.timestamp?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      const stats = dailyMap.get(date) ?? createEmptyDay(date);
      stats.inputTokens += usage.input_tokens ?? 0;
      stats.outputTokens += usage.output_tokens ?? 0;
      stats.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
      stats.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
      // Cost calculation uses model from entry (see rate table below)
      const model = entry?.message?.model ?? entry?.model ?? 'claude-sonnet-4-5';
      stats.costUSD += calculateCost(usage, model);
      dailyMap.set(date, stats);
    } catch {
      // Malformed line (mid-write race condition) — skip
    }
  }

  return dailyMap;
}
```

**Performance note:** JSONL files are 2–18 MB per the PROJECT.md. `readline` streams line-by-line without loading the full file into memory. For a 30-day scan of ~10 session files, this completes in < 500ms on any modern SSD. Run in the main process on a timer (e.g., once at startup + once per hour) and cache results.

---

## Cost Calculation Rate Table

Hard-code model rates in TypeScript as a typed constant. No network fetch required.

```typescript
// In shared/pricing.ts (new file)
interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheReadPerMillion: number;
}

// Rates current as of 2026-03: per million tokens in USD
// Source: https://platform.claude.com/docs/en/about-claude/pricing
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6':    { inputPerMillion: 5.00,  outputPerMillion: 25.00, cacheWritePerMillion: 6.25,  cacheReadPerMillion: 0.50 },
  'claude-sonnet-4-6':  { inputPerMillion: 3.00,  outputPerMillion: 15.00, cacheWritePerMillion: 3.75,  cacheReadPerMillion: 0.30 },
  'claude-sonnet-4-5':  { inputPerMillion: 3.00,  outputPerMillion: 15.00, cacheWritePerMillion: 3.75,  cacheReadPerMillion: 0.30 },
  'claude-haiku-4-5':   { inputPerMillion: 1.00,  outputPerMillion: 5.00,  cacheWritePerMillion: 1.25,  cacheReadPerMillion: 0.10 },
  // Fallback: assume Sonnet pricing if model not recognized
  'default':            { inputPerMillion: 3.00,  outputPerMillion: 15.00, cacheWritePerMillion: 3.75,  cacheReadPerMillion: 0.30 },
};

export function calculateCost(usage: TokenUsage, model: string): number {
  const rates = MODEL_PRICING[model] ?? MODEL_PRICING['default'];
  return (
    (usage.input_tokens ?? 0) * rates.inputPerMillion / 1_000_000 +
    (usage.output_tokens ?? 0) * rates.outputPerMillion / 1_000_000 +
    (usage.cache_creation_input_tokens ?? 0) * rates.cacheWritePerMillion / 1_000_000 +
    (usage.cache_read_input_tokens ?? 0) * rates.cacheReadPerMillion / 1_000_000
  );
}
```

**Model name detection:** JSONL entries contain the model name in `message.model` or at the top-level `model` field. The exact field path should be verified against live JSONL files during implementation.

---

## Historical Stats Persistence

Store the 30-day daily rollup as a single JSON file in Electron's user data directory.

```typescript
// In main/stats-store.ts (new file)
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

const STATS_PATH = path.join(app.getPath('userData'), 'usage-stats.json');

interface UsageStats {
  version: 1;
  days: DailyStats[];  // sorted ascending by date, max 30 entries
}

function loadStats(): UsageStats {
  try {
    const raw = fs.readFileSync(STATS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { version: 1, days: [] };
  }
}

function saveStats(stats: UsageStats): void {
  // Prune to 30 days before saving
  stats.days = stats.days.slice(-30);
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), 'utf-8');
}
```

**Why not SQLite (better-sqlite3):** better-sqlite3 is a native Node.js module. It requires `@electron/rebuild` to recompile against Electron's Node.js ABI on every Electron version upgrade. It has documented issues with ASAR packaging, Windows build toolchain requirements (Python, node-gyp, MSVC), and recent reports of build failures on Node.js 25 / Electron 40+ (issue #1401, #1411 on the WiseLibs/better-sqlite3 GitHub). A JSON file for < 50KB of data has none of these risks and is trivially readable/debuggable. Use SQLite only if query complexity or data volume requires it — 30 rows and 8 columns does not.

**Why not electron-store:** electron-store v10+ is native ESM only and conflicts with Electron Forge's webpack CommonJS build. The documented workaround (dynamic import shims) adds friction. Direct `fs.readFileSync`/`fs.writeFileSync` is simpler and has no ESM/CJS boundary issue.

---

## Installation

```bash
# New dependency: Chart.js for 30-day trend visualization
npm install chart.js

# No other new dependencies needed:
# - readline: Node.js built-in
# - fs/path: Node.js built-ins (already used)
# - Dashboard HTML/CSS: no framework needed
# - Stats persistence: JSON file via fs
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Chart.js 4.5.1 | D3.js | D3 is a full data visualization toolkit, not a charting library. For a single bar chart of 30 data points, D3's API surface is dramatically oversized. Chart.js is 3-4x smaller and produces the same bar chart in 20 lines vs 80+. |
| Chart.js 4.5.1 | Recharts / Victory / Nivo | All are React-based. The project has no React dependency and adding one for a single chart is irrational. |
| Chart.js 4.5.1 | ApexCharts | 200KB+ bundle. Feature-rich but overkill. ApexCharts' main advantage is real-time streaming data — not needed for a 30-day historical view that updates once per hour. |
| Chart.js 4.5.1 | Hand-coded canvas bar chart | Viable (PixiJS Graphics could draw bars), but puts chart code in the PixiJS rendering layer where it doesn't belong. Axes, labels, and tooltips would require significant custom code. Chart.js provides all of this for 11KB. |
| JSON file persistence | better-sqlite3 | Native module build complexity on Windows, ASAR packaging issues, node-gyp toolchain requirements. Not justified for 30 rows of data. |
| JSON file persistence | electron-store | ESM-only in v10+, conflicts with Electron Forge webpack CommonJS build. Direct fs is simpler. |
| Node.js readline | stream-json / jsonlines npm | Both are 3rd-party packages for a task Node.js handles natively. The readline + async iterator pattern is idiomatic Node.js and requires zero new dependencies. |
| Hardcoded rate table | Runtime API pricing fetch | The app is intentionally offline-only (PROJECT.md constraint). A network fetch for pricing would introduce a dependency on Anthropic's pricing API availability, add latency, and require caching anyway. Rates change at most a few times per year and can be updated in code. |
| Single renderer process | Second BrowserWindow for dashboard | Two windows doubles IPC complexity, requires session routing to two renderers, adds OS window chrome. The existing renderer already handles mixed HTML + canvas (audio controls, drag region are plain HTML). |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `electron-chartjs` (npm) | Legacy wrapper for Chart.js v2 + old Electron. Chart.js 4.x works natively in Electron's renderer without any wrapper. | `chart.js` directly |
| `better-sqlite3` | Native module: requires `@electron/rebuild`, node-gyp, MSVC on Windows, ASAR unpack config. Documented build failures with recent Electron. No benefit for < 50KB of data. | Plain JSON file with `fs` |
| `electron-store` v10+ | Native ESM only — incompatible with Electron Forge webpack's CommonJS bundling without workarounds. | Direct `fs.readFileSync`/`fs.writeFileSync` |
| `rxdb` / `nedb` / `lowdb` | Embedded database abstractions with overhead not warranted for 30 daily stat records. | Direct JSON with `fs` |
| D3.js | 500KB+ library for visualization primitives, not chart components. Massive overkill for one bar chart. | Chart.js |
| WebGL-based charts (LightningChart, ECharts) | WebGL context complexity in Electron can cause context loss issues (documented for Electron v28+). Chart.js uses 2D canvas context — simpler and more stable. | Chart.js (2D canvas) |
| `node-fetch` / `axios` for pricing | Violates the offline-only constraint. Pricing API availability not guaranteed. | Hardcoded rate table in `shared/pricing.ts` |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| chart.js | ^4.5.1 | Electron 40.6.1 (Chromium ~130) | Chart.js 4.x targets modern browsers. Electron 40's Chromium fully supports the Canvas 2D API used by Chart.js. No compatibility shims needed. |
| chart.js | ^4.5.1 | TypeScript 5.7 | Chart.js 4.x ships with bundled TypeScript types (`@types/chart.js` not needed). Types are accurate and comprehensive. |
| chart.js | ^4.5.1 | Webpack (Electron Forge) | Chart.js is ESM with CJS fallback. Webpack 5 resolves ESM from node_modules correctly. No special alias or externals config needed. |
| node:readline | Built-in | Electron 40.6.1 (Node.js 22+) | `for await (const line of rl)` async iterator is stable since Node.js 11.4. Available in all current Electron versions. |

---

## Integration Points (New Files Expected)

| File | Purpose | Notes |
|------|---------|-------|
| `src/main/token-aggregator.ts` | Full JSONL scan for historical token data | New. Uses `node:readline` + `node:fs`. Called from `ipc-handlers.ts`. |
| `src/main/stats-store.ts` | Read/write `usage-stats.json` in userData | New. Pure `node:fs` JSON. |
| `src/shared/pricing.ts` | Claude model rate table + `calculateCost()` | New. Used by both `token-aggregator.ts` and renderer live-session display. |
| `src/renderer/dashboard.ts` | Dashboard panel UI logic + Chart.js | New. HTML DOM manipulation + Chart.js instance management. |
| `src/renderer/index.html` | Add `<div id="dashboard">` below `<div id="app">` | Modified. Also add `<canvas id="trend-chart">`. |
| `src/renderer/index.ts` | Initialize dashboard module, wire IPC for `dashboard-update` | Modified. |
| `src/main/ipc-handlers.ts` | Add `dashboard-update` IPC channel | Modified. Triggers on session scan completion. |
| `src/main/index.ts` | Increase `BrowserWindow` height | Modified. Add dashboard panel height to existing 768px. |

---

## Sources

- [Chart.js npm (v4.5.1)](https://www.npmjs.com/package/chart.js) — version verified, 11KB gzipped confirmed (MEDIUM confidence — npm page returned 403, version from web search result confirming 4.5.1)
- [Chart.js GitHub Releases](https://github.com/chartjs/Chart.js/releases) — v4.5.1 confirmed as latest release (MEDIUM confidence)
- [Chart.js Installation Docs](https://www.chartjs.org/docs/latest/getting-started/installation.html) — ESM/CJS details, tree-shaking via explicit registration (HIGH confidence)
- [Anthropic Pricing Docs](https://platform.claude.com/docs/en/about-claude/pricing) — Opus 4.6, Sonnet 4.6, Haiku 4.5 rates (HIGH confidence — current as of 2026-03)
- [better-sqlite3 Issue #1401](https://github.com/WiseLibs/better-sqlite3/issues/1401) — Windows 11 + Electron build failures (HIGH confidence — direct issue reference)
- [better-sqlite3 Issue #1411](https://github.com/WiseLibs/better-sqlite3/issues/1411) — Node.js 25 build failures (HIGH confidence — direct issue reference)
- [electron-store ESM issue #259](https://github.com/sindresorhus/electron-store/issues/259) — electron-forge + ESM incompatibility (HIGH confidence)
- [Electron Forge ESM issue #3780](https://github.com/electron/forge/issues/3780) — webpack-typescript ESM support status (HIGH confidence)
- [Node.js readline docs](https://nodejs.org/api/readline.html) — async iterator pattern for JSONL parsing (HIGH confidence)
- Codebase analysis: `jsonl-reader.ts`, `index.html`, `ipc-handlers.ts`, `package.json` — existing patterns verified (HIGH confidence)

---

*Stack research for: Agent World v1.5 — Usage Dashboard*
*Researched: 2026-03-01*

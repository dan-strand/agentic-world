# Project Research Summary

**Project:** Agent World v1.5 — Usage Dashboard
**Domain:** LLM token tracking and cost estimation integrated into an Electron + PixiJS desktop visualizer
**Researched:** 2026-03-01
**Confidence:** HIGH

## Executive Summary

Agent World v1.5 adds a usage dashboard panel below the existing RPG world view — a text-data-heavy UI component that tracks token consumption, cost estimates per session, and a 30-day historical trend chart. The research strongly indicates that this is an additive feature built on top of a stable foundation: the existing Electron main process already polls JSONL session files every 3 seconds, and all the data needed for the dashboard already exists in those files but is never parsed for usage fields. The correct implementation is a two-layer HTML+PixiJS window where the PixiJS canvas is pinned at exactly 1024x768 and a new `<div id="dashboard">` occupies a new 312px strip below it. Nothing in the existing RPG world layer needs to change.

The recommended stack requires exactly one new dependency — Chart.js 4.5.1 for the 30-day bar chart. All other needs are covered by Node.js built-ins (`readline`, `fs`, `path`), Electron's existing IPC pattern, and plain HTML/CSS for the dashboard panel. The alternatives that appear tempting — SQLite for persistence, React-based charts, a second BrowserWindow, or embedding the dashboard into PixiJS — are all meaningfully worse options with documented failure modes in this specific Electron 40 + Windows environment.

The most important risk is synchronous JSONL parsing blocking Electron's main process and causing the RPG animation to stutter every 3 seconds. This must be addressed first using streaming readline with mtime-based caching. A secondary risk is that hardcoded pricing rates will become stale within months as Anthropic releases new models and adjusts prices — pricing must live in a config structure that can be updated without a code release. Both risks are straightforward to mitigate if addressed at the start of Phase 1 rather than retrofitted.

---

## Key Findings

### Recommended Stack

The existing stack (Electron 40.6.1, PixiJS 8.16.0, TypeScript 5.7, Webpack via Electron Forge) requires no changes. One new npm dependency is warranted: **Chart.js 4.5.1** for the 30-day bar chart. Chart.js renders to an HTML `<canvas>` element, works natively in Electron's renderer without any wrapper, is 11KB gzipped, and requires only the `BarController`, `BarElement`, `CategoryScale`, `LinearScale`, and `Tooltip` components to be registered (tree-shaking via explicit registration). All other dashboard needs use Node.js built-ins: `readline` for streaming JSONL parsing, `fs` for JSON persistence, and `path` for file location. See STACK.md for full rationale on alternatives rejected (D3.js, better-sqlite3, electron-store, second BrowserWindow).

**Core technologies (new additions only):**
- **Chart.js 4.5.1**: 30-day trend bar chart — lightest canvas-based charting library, zero framework dependency, native Electron renderer support
- **node:readline** (built-in): Streaming JSONL line-by-line parsing — avoids loading full 18MB files into memory
- **node:fs** (already used): JSON persistence for daily aggregate store — no native module rebuild required
- Plain HTML/CSS: Dashboard panel layout — already proven pattern in this project (drag region, audio controls are existing HTML elements)

### Expected Features

The JSONL `assistant` entry format is verified from live session files. All four token fields (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) are present and correctly structured. Cache tokens dominate long sessions — per confirmed issue #24147, cache reads can account for 99.93% of quota usage as CLAUDE.md files grow. Any dashboard that does not track cache tokens separately will show severely undercounted costs.

**Must have (table stakes — v1.5 Core):**
- Window height expansion (1024x768 to 1024x1080) with PixiJS canvas pinned at 768px
- JSONL usage parser with streaming readline + mtime-based caching in the main process
- Bundled model pricing table (Opus/Sonnet/Haiku for Claude 3.x and 4.x families)
- Live session list with compact rows (project name, status badge, duration, current tool)
- Click-to-expand rows showing full 4-field token breakdown and cost estimate
- Today's totals bar (input tokens, output tokens, cost, session count)
- Cost estimate per session using `~$X.XX` notation to signal estimate status

**Should have (v1.5 Polish, after core validated):**
- 30-day daily breakdown chart via Chart.js
- Cache savings display ("Cache saved ~$X")
- Session completion count in the totals bar
- Cost-by-model chart stacking (Opus vs Sonnet vs Haiku colors)

**Defer (v2+):**
- Budget threshold coloring (requires a settings system that does not exist)
- Per-project historical view (project-to-session mapping is currently fuzzy)
- Data export (users have direct JSONL filesystem access; ccusage CLI covers this)
- Cloud sync (violates local-only constraint)
- Real-time token streaming counter (JSONL files only written at message boundaries, not during streaming)

### Architecture Approach

The architecture is purely additive — the existing RPG world layer is zero-touch. New main-process components (`UsageAggregator`, `HistoryStore`) plug into the existing `SessionStore` poll cycle and push to a new `dashboard-update` IPC channel. The renderer adds `DashboardPanel` and `HistoryChart` as HTML-only modules; neither uses PixiJS. The separation of IPC channels (`sessions-update` for the RPG world, `dashboard-update` for the dashboard) prevents slow token aggregation from blocking the status display. History is fetched once at startup via `ipcRenderer.invoke('get-history')`, not on every 3-second poll.

**Major components:**
1. **UsageAggregator** (`main/usage-aggregator.ts`) — mtime-cached full JSONL scan, cost calculation using MODEL_PRICING constants; called synchronously from SessionStore poll cycle
2. **HistoryStore** (`main/history-store.ts`) — daily aggregate JSON persistence at `~/.agent-world/history.json`, atomic writes (write-tmp-then-rename), 31-day pruning, loaded into memory at startup
3. **DashboardPanel** (`renderer/dashboard-panel.ts`) — pure HTML/CSS session list, expandable rows, today's totals header; zero PixiJS involvement
4. **HistoryChart** (`renderer/history-chart.ts`) — HTML Canvas 2D bar chart for 30-day trend (or Chart.js wrapper); receives `DailyAggregate[]` and renders statically

**Build order is dependency-driven:**
1. Types and constants (`shared/types.ts`, `shared/constants.ts`) — foundation; no dependencies
2. JSONL usage reader extension (additive export to `jsonl-reader.ts`)
3. UsageAggregator + HistoryStore (depend on types and reader)
4. IPC wiring — main + preload (depends on steps 1-3)
5. Dashboard UI — renderer (depends on preload API from step 4)

### Critical Pitfalls

Top 5 pitfalls from PITFALLS.md:

1. **Synchronous JSONL parsing blocks main process** — Use `fs.createReadStream()` + `readline` async iterator. Never use `readFileSync` + split for JSONL > 1MB. Track byte offsets per session so only new lines are parsed on each poll cycle. This must be the implementation from day one; retrofitting is costly and painful.

2. **Window height expansion corrupts PixiJS canvas coordinates** — The PixiJS canvas element must have explicit CSS `height: 768px` and `flex-shrink: 0`. Never use percentage heights on the canvas. Use Electron's `setContentSize(1024, 1080)` rather than `setSize()`. Do not use PixiJS `resizeTo` or `autoResize` after init — canvas dimensions must be frozen.

3. **Cache token accounting errors produce wrong cost estimates** — `cache_read_input_tokens` are priced at 0.1× input rate; `cache_creation_input_tokens` at 1.25× input rate. Using a single input rate for all token fields produces costs that can be off by 2-5× for long sessions where cache dominates. All four token fields must be tracked separately with separate rate multipliers throughout.

4. **Hardcoded pricing rates become stale within months** — Anthropic cut Opus prices 67% in 2025 and releases new model families 2-3 times per year. Model name formats change between versions. Pricing must use a structured constant with a `default` fallback that shows "est. (unknown model)" rather than silently returning $0 for unrecognized models.

5. **History file corruption on crash** — `fs.writeFileSync()` is not atomic. Write to a `.tmp` file, then `fs.renameSync()` to the target. On Windows, rename over an existing file may fail if locked — add a try/catch fallback to `copyFileSync` + `unlinkSync`. Never write from two concurrent code paths; serialize all history writes through a single owner.

---

## Implications for Roadmap

Based on research, the dependency graph strongly dictates a 3-phase structure. All pitfalls map cleanly to "which phase must prevent this." The build order identified in ARCHITECTURE.md is the correct phase order.

### Phase 1: Foundation (Parsing Infrastructure + Window Layout)

**Rationale:** Every other feature depends on correct JSONL parsing and correct window geometry. Getting these wrong creates downstream bugs that are expensive to fix. Pitfall 1 (synchronous blocking) and Pitfall 2 (canvas coordinate corruption) must be resolved here before any UI work begins. This phase has zero visible user-facing output beyond a visible dashboard stub, but it determines correctness of all subsequent phases.

**Delivers:**
- Correct window layout: 1024x1080 window, PixiJS canvas pinned at 768px, `#dashboard` div stub visible
- `readUsageTotals()` streaming JSONL reader with byte-offset tracking (verified non-blocking)
- All new TypeScript types: `SessionUsage`, `DashboardData`, `DailyAggregate`
- All new IPC channel constants: `DASHBOARD_UPDATE`, `GET_HISTORY`
- `MODEL_PRICING` constants with all Claude 3.x and 4.x families and a `default` fallback

**Addresses (from FEATURES.md):** Window height expansion, JSONL usage parser, bundled pricing table

**Avoids (from PITFALLS.md):** Pitfall 1 (synchronous blocking), Pitfall 2 (canvas corruption), Pitfall 3 (token double-counting), Pitfall 4 (cache token mis-accounting), Pitfall 7 (dashboard as PixiJS layer)

### Phase 2: Live Dashboard (Session List + Today's Totals)

**Rationale:** With parsing infrastructure correct, this phase wires the main-process components (`UsageAggregator`, `SessionStore` extension) to IPC and builds the renderer dashboard panel. Features in this phase use only current/live session data — no historical persistence required. The live dashboard is what users interact with daily and delivers immediate value. Pitfalls around IPC payload size and session duration calculation must be addressed here.

**Delivers:**
- `UsageAggregator` with mtime cache — only changed sessions re-scanned per poll cycle
- `dashboard-update` IPC channel carrying `DashboardData` (live sessions + today's totals)
- `DashboardPanel` HTML/CSS component: compact session rows, today's totals header bar
- Click-to-expand rows showing 4-field token breakdown and cost estimate per session
- Model badge per session (Sonnet, Opus, Haiku)
- Duration calculation using active-interval algorithm (5-minute gap threshold)

**Uses (from STACK.md):** Node.js readline, existing IPC pattern, plain HTML/CSS, MODEL_PRICING constants

**Implements (from ARCHITECTURE.md):** UsageAggregator, DashboardPanel, IPC channel separation

**Avoids (from PITFALLS.md):** Pitfall 5 (stale pricing — unrecognized model shows "est. (unknown)" not $0), Pitfall 9 (IPC payload bloat — history not included in 3s poll), Pitfall 10 (duration inflation — gap threshold used)

### Phase 3: Historical Data (30-Day Chart + Persistence)

**Rationale:** Historical data requires a persistence layer that was explicitly deferred until live data is validated. The storage format decision (pre-aggregated daily JSON, not raw JSONL mirroring) must be made before any persistence code is written, per Pitfall 6. Pitfall 8 (history file corruption) and the retention cleanup race condition are addressed here with atomic write patterns. Chart.js is added as the one new npm dependency in this phase.

**Delivers:**
- `HistoryStore` with atomic JSON writes to `~/.agent-world/history.json`
- Session completion detection triggering daily aggregate updates
- `get-history` IPC invoke handler returning `DailyAggregate[]`
- `HistoryChart` component using Chart.js 4.5.1 with RPG gold color palette
- 30-day daily breakdown chart (one bar per day, cost in USD on y-axis, date labels on x-axis)
- Cache savings display in expanded session rows
- Session completion count in today's totals bar
- 31-day retention pruning with atomic cleanup

**Uses (from STACK.md):** Chart.js 4.5.1 (new install: `npm install chart.js`), node:fs atomic write pattern, `~/.agent-world/` for storage location

**Implements (from ARCHITECTURE.md):** HistoryStore, HistoryChart, Flow 3 (history load at init), Flow 4 (completion recording)

**Avoids (from PITFALLS.md):** Pitfall 6 (wrong storage format — daily aggregates not raw JSONL), Pitfall 8 (history file corruption — atomic write-tmp-then-rename), retention cleanup race condition

### Phase Ordering Rationale

- **Types first (within Phase 1):** `shared/types.ts` and `shared/constants.ts` changes are the foundation. Every new file depends on these. Zero risk to existing code since changes are purely additive.
- **Parsing before UI:** The streaming JSONL reader must be correct before any token numbers appear in the UI. A parsing bug discovered after the UI is wired requires changes in multiple call sites. A parsing bug discovered in isolation is contained to one file.
- **Live data before history:** The live dashboard validates the token counting, cost calculation, and IPC flow. Problems found here would corrupt the history store if it were already committing daily aggregates to disk. Fix accuracy before persisting.
- **History last:** Historical persistence has the highest risk of data corruption (Pitfalls 6, 8) and is the only phase requiring a new npm dependency. Deferring it ensures the live dashboard is stable before introducing persistence complexity.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1 (Window Layout):** The HTML structure for the expanded window with PixiJS canvas pinned is documented in ARCHITECTURE.md Pattern 1, but should be validated against the actual `index.html` before coding. Audio controls positioning relative to the new layout may need a decision (move above dashboard or keep fixed position). Low research burden — mostly verification, not discovery.

- **Phase 3 (History Persistence):** Atomic rename behavior on Windows/NTFS when the target file is locked is MEDIUM confidence in sources. The fallback to `copyFileSync` + `unlinkSync` may need Windows-specific testing. Consider a brief verification task for Windows atomic write patterns before implementing `HistoryStore.save()`.

Phases with standard patterns (skip research-phase):

- **Phase 2 (Live Dashboard):** HTML/CSS session list rows and IPC wiring follow patterns already established in the codebase. The `UsageAggregator` mtime-cache pattern mirrors `FilesystemSessionDetector.mtimeCache` exactly. No novel patterns introduced.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Chart.js 4.5.1 version verified via GitHub releases. All Node.js built-in alternatives confirmed. Rejection of better-sqlite3, electron-store, D3.js based on specific GitHub issues with version references. |
| Features | HIGH | JSONL token structure verified from live session files. Feature set validated against ccusage and Claude-Code-Usage-Monitor as reference implementations. Pricing from official Anthropic docs as of 2026-03-01. |
| Architecture | HIGH | All 22 source files analyzed directly. Live JSONL file structure inspected and field names confirmed. IPC patterns and preload API verified against actual codebase. Build order derived from concrete dependency analysis. |
| Pitfalls | HIGH | Most pitfalls backed by specific GitHub issue references (PixiJS #11427, electron #6320, better-sqlite3 #1401/#1411, Claude Code #24147). JSONL parsing patterns cross-referenced against ccusage reference implementation. |

**Overall confidence: HIGH**

### Gaps to Address

- **Model name field path in JSONL:** Architecture research confirms the format as `"claude-opus-4-6"` from a live session file, but STACK.md notes the `model` field may appear in `message.model` or at the top-level `model` field. The exact field path should be verified against 2-3 different JSONL files before implementing `readUsageTotals()`. Cost: 10 minutes of inspection at implementation start.

- **Opus 4.6 pricing discrepancy between research files:** ARCHITECTURE.md lists `claude-opus-4-6` at `inputPer1M: 15.00` (old Opus 3 pricing tier), while STACK.md and FEATURES.md list it at `5.00` (reflecting the confirmed 2025 67% price cut). This conflict must be resolved before the pricing table is committed to code. Verify against `https://platform.claude.com/docs/en/about-claude/pricing` at implementation start.

- **Atomic rename on Windows with locked files:** `fs.renameSync()` to overwrite an existing file is MEDIUM confidence on Windows/NTFS specifically. The exact failure conditions when the target file is locked by antivirus or another process are not fully documented. Add a try/catch fallback at implementation time and test with Windows Defender active.

- **Audio controls repositioning:** The current `#audio-controls` element is positioned relative to the window. When the window grows from 768px to 1080px height, the audio controls may need repositioning to remain above the dashboard panel and not overlap it. This is a minor layout decision not fully resolved in the research.

---

## Sources

### Primary (HIGH confidence)
- [Anthropic Pricing Docs](https://platform.claude.com/docs/en/about-claude/pricing) — Model rates for Opus/Sonnet/Haiku across Claude 3.x and 4.x families
- [Chart.js GitHub Releases](https://github.com/chartjs/Chart.js/releases) — v4.5.1 confirmed as latest stable
- [Chart.js Installation Docs](https://www.chartjs.org/docs/latest/getting-started/installation.html) — ESM/CJS details, tree-shaking via explicit registration
- [Node.js readline docs](https://nodejs.org/api/readline.html) — async iterator pattern for JSONL streaming
- [Electron BrowserWindow Docs](https://www.electronjs.org/docs/latest/api/browser-window) — setSize vs. setContentSize, window geometry
- [PixiJS Issue #11427](https://github.com/pixijs/pixijs/issues/11427) — resizeTo only triggers on window resize events, not DOM layout changes (May 2025)
- [better-sqlite3 Issue #1401](https://github.com/WiseLibs/better-sqlite3/issues/1401) — Windows 11 + Electron build failures
- [better-sqlite3 Issue #1411](https://github.com/WiseLibs/better-sqlite3/issues/1411) — Node.js 25 build failures
- [electron-store Issue #259](https://github.com/sindresorhus/electron-store/issues/259) — Electron Forge + ESM incompatibility
- [Claude Code Issue #24147](https://github.com/anthropics/claude-code/issues/24147) — Cache tokens can be 99.93% of quota usage
- [ccusage GitHub](https://github.com/ryoppippi/ccusage) — Reference JSONL token aggregation implementation; four-field tracking confirmed
- Direct codebase analysis: all 22 source files in `src/` — existing patterns verified
- Live JSONL inspection: `~/.claude/projects/C--Users-dlaws-Projects-Agent-World/5de0e917-*.jsonl` — confirmed `message.usage` structure and model field format `"claude-opus-4-6"`

### Secondary (MEDIUM confidence)
- [Paige Niedringhaus — Node.js streaming performance comparison](https://www.paigeniedringhaus.com/blog/streams-for-the-win-a-performance-comparison-of-node-js-methods-for-reading-large-datasets-pt-2/) — readFileSync vs. readline streaming for large files
- [PixiJS Issue #4327](https://github.com/pixijs/pixijs/issues/4327) — DOM + PixiJS mixing architectural complexity
- [Electron Issue #6320](https://github.com/electron/electron/issues/6320) — Canvas disappears on Windows after minimize-restore
- [Anthropic model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) — 60-day deprecation notice policy
- [Shipyard: How to track Claude Code usage](https://shipyard.build/blog/claude-code-track-usage/) — Four tracking approaches compared
- [Claude-Code-Usage-Monitor GitHub](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) — Real-time terminal UI reference implementation
- Chart.js npm page — Bundle size (page returned 403 during research; 11KB gzipped confirmed via web search result)

### Tertiary (LOW confidence)
- [RxDB Electron Database Guide](https://rxdb.info/electron-database.html) — SQLite vs. JSON tradeoffs (general patterns, not Electron 40 specific)

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*

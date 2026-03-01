# Feature Research

**Domain:** LLM usage dashboard — token tracking, cost estimation, historical stats for a local Electron desktop app
**Researched:** 2026-03-01
**Confidence:** HIGH (confirmed by live ecosystem tools ccusage, Claude-Code-Usage-Monitor, and official Anthropic pricing docs)

## Context

This is v1.5 milestone research for the Agent World project. The existing v1.4 system already parses JSONL files from `~/.claude/projects/{encoded-path}/{session-uuid}.jsonl` to detect session status. The new dashboard feature adds a panel below the RPG world view that shows live session details, token consumption, cost estimates, and 30-day historical trends.

**Key existing assets that feed this feature:**
- `FilesystemSessionDetector` already scans all JSONL files and extracts `sessionId`, `projectPath`, `projectName`, `status`, `lastModified`
- `readLastJsonlLine()` / `readLastToolUse()` read the tail buffer; parsing usage requires scanning more of each file
- `SessionInfo` type already carries `projectName`, `status`, `lastToolName`, `activityType`
- The main-process `session-store.ts` polls every 3 seconds and pushes `sessions-update` IPC events to the renderer

Token data (`message.usage`) is in the JSONL files but is never parsed today. The `usage` object in `assistant` entries contains `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`. The `model` field in the same entry provides the model identifier needed for cost calculation.

## Feature Landscape

### Table Stakes (Users Expect These)

Features any LLM usage dashboard must have. Missing these = dashboard feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Live session list** | Users need to identify which sessions are running and their current status at a glance — this is the entry point to all other data | LOW | Already have `SessionInfo[]` from session-store IPC. Renderer renders compact rows: project name, status badge, duration, current tool. No new data needed — just a DOM panel layout using existing IPC data. |
| **Token count per session (input + output)** | Primary unit of cost; without raw numbers there is no basis for cost estimation | MEDIUM | Requires scanning each JSONL file for all `assistant` entries with `usage` objects, not just the tail. Need `readAllUsage(filePath)` function that streams the file. Cache per session by (filePath, mtimeMs) to avoid re-scanning unchanged files. |
| **Cost estimate per session** | Token counts mean nothing to most users; "$0.34" is actionable | MEDIUM | Hardcode pricing table for model families (Opus, Sonnet, Haiku) matching Anthropic docs. Formula: `(input_tokens * input_rate) + (output_tokens * output_rate) + (cache_creation * cache_write_rate) + (cache_read * cache_read_rate)`. Model name from JSONL `model` field. |
| **Today's totals (tokens + cost)** | "How much have I spent today?" is the most common question for any usage tracker | MEDIUM | Sum token counts across all sessions where the JSONL mtime is within today's date. Requires parsing usage from all files, not just active ones. Accumulate in the main process; emit via IPC on each poll. |
| **Cache token breakdown** | Cache tokens are priced differently (write = 1.25x input, read = 0.1x input); hiding them gives wrong cost estimates | LOW | Surface `cache_creation_input_tokens` and `cache_read_input_tokens` separately, or show them as a combined "cache" line below input/output in the expanded detail view. Data is already in the JSONL `usage` object. |
| **Per-session duration** | Users need to understand "how long has this session been running?" for time-cost tradeoffs | LOW | `Date.now() - session.lastModified` gives time-since-last-activity. Session start is the mtime of the first JSONL entry; read this once on session discovery and cache it. |
| **Model identification** | Different models have radically different pricing; must show which model is in use | LOW | Extract `model` field from `assistant` entries in JSONL. Most sessions are single-model but store it per session. Display as a badge ("Sonnet", "Opus", "Haiku"). |

### Differentiators (Competitive Advantage)

Features beyond the baseline that make this dashboard worth using over existing CLI tools like ccusage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **30-day daily chart** | Trend visibility — "Am I using more AI this week than last week?" — not available in any of the live monitors we surveyed | HIGH | Requires parsing historical JSONL files grouped by calendar date. Each file's mtime gives its most-recent-activity date, but earlier entries within the file may be days older. For accuracy: scan all entries in each JSONL file and bucket by timestamp. Use a canvas-rendered bar chart (PixiJS Graphics or HTML canvas overlay). 30 bars, daily resolution. |
| **Cost-by-model breakdown** | Users running mixed Opus/Sonnet sessions benefit from seeing the cost split; tells them if Haiku would be cheaper for certain tasks | MEDIUM | Track model usage per session and per day. Requires storing `Map<model, TokenCounts>` per day rather than a flat daily total. Render as a stacked or grouped bar. |
| **Session completion count** | "I completed 7 tasks today" — gives a sense of productivity alongside cost | LOW | Count sessions that transitioned through `celebrating` state (already detected in agent lifecycle). Or count JSONL files with a `system` entry indicating task completion. The existing dual-gate completion detection can emit a counter. |
| **Integrated live view** | The existing RPG world already shows which agents are active/waiting — the dashboard sits below it and enriches the at-a-glance view rather than replacing it | LOW | This is an architectural advantage over CLI tools (ccusage, Claude-Code-Usage-Monitor) which are separate terminal windows. No extra implementation cost — it is inherent to the Electron single-window design. |
| **Click-to-expand session rows** | Compact default view with full token/cost detail on demand — prevents information overload while keeping details accessible | LOW | HTML click handler on row element toggles a `details` div. No state machine needed. |
| **Cache savings display** | Show "You saved $X by using cache" = `(cache_read_tokens * (input_rate - cache_read_rate))` — motivates good prompting habits | LOW | Simple calculation once cache token counts are available. Display as a green "saved" line or tooltip. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time token streaming counter** | Watching tokens increment live is satisfying and feels informative | JSONL files are only written at message boundaries, not during streaming. A live token counter would require hooking Claude Code internals (not accessible). Polling at 3s intervals means the counter would jump in large steps, not increment smoothly. False sense of precision. | Show tokens from the last completed message, updated on each poll cycle. Make it clear this is "last message" not streaming. |
| **Budget alerts / spend limits** | "Alert me when I hit $10/day" sounds useful | Agent World is a visualizer, not a controller. Implementing actionable alerts (pause Claude, notify via OS, etc.) requires system integration far beyond the current scope. A passive dashboard cannot enforce limits. | Display the daily running total prominently. Users can self-limit based on what they see. Flag as v2+ if genuinely needed. |
| **Usage prediction / ML forecasting** | Claude-Code-Usage-Monitor does this and it seems impressive | For a personal desktop tool used by one developer, predictions based on 8-day history are noise, not signal. The complexity (P90 calculation, rolling average, extrapolation) far exceeds the value for a tool that updates every 3 seconds. | Show current day's total. Users have intuitive models of their own usage. |
| **Data export (CSV/JSON)** | Power users might want to analyze data in spreadsheets | The underlying data is already in plaintext JSONL files the user owns. Adding an export button just copies data the user already has direct filesystem access to. Real cost: file dialogs, serialization format decisions, renderer-to-main IPC for file writes. | Document where JSONL files live. Point users to ccusage CLI for structured exports. |
| **Cloud sync / remote dashboard** | "I want to see my usage on my phone" | Violates the local-only constraint (established in PROJECT.md). Requires a server, authentication, data transmission of potentially sensitive session content. The core value is local, always-on, zero-config. | Keep local. Access the app on the desktop where Claude Code runs. |
| **Per-project cost allocation** | "How much did I spend on Project X this month?" | The project-to-session mapping is fuzzy (sessions can switch projects, project names derived from `cwd` are human-readable but not canonical identifiers). Inaccurate attribution is worse than no attribution. | Show per-session costs where the project context is reliable. Aggregate daily totals are accurate; per-project allocation is not. |
| **Historical data persistence (database)** | "Store usage stats even after JSONL files are deleted" | JSONL files are the source of truth. Adding a separate SQLite or JSON database to mirror this data creates a sync problem: what wins when they disagree? Doubles storage, adds a migration concern. | Read JSONL files directly. Anthropic keeps them for a long time by default. If the user deletes them, the history is gone — that is correct behavior. |

## Feature Dependencies

```
[Live Session List]
    +--already provided by--> SessionInfo[] via IPC (no new data needed)
    +--enhances--> [Per-Session Duration] (start time from first JSONL entry)
    +--enhances--> [Model Badge] (model field from assistant entries)

[JSONL Usage Parser]
    +--required by--> [Token Count per Session]
    +--required by--> [Cost Estimate per Session]
    +--required by--> [Cache Token Breakdown]
    +--required by--> [Today's Totals]
    +--required by--> [30-Day Daily Chart]
    +--required by--> [Cost-by-Model Breakdown]

[Token Count per Session]
    +--required by--> [Cost Estimate per Session]
    +--required by--> [Cache Savings Display]

[Today's Totals]
    +--required by--> [30-Day Daily Chart] (same bucketing logic, different time window)

[Cost Estimate per Session]
    +--required by--> [Cost-by-Model Breakdown]

[Session Completion Count]
    +--independent of--> [JSONL Usage Parser] (uses existing completion detection in session-store)

[Click-to-Expand Session Rows]
    +--requires--> [Live Session List] (rows must exist before expansion works)
    +--enhances--> [Token Count per Session] (shows detail on expand)
    +--enhances--> [Cache Token Breakdown] (shows detail on expand)
```

### Dependency Notes

- **JSONL Usage Parser is the foundation:** Every cost and token feature depends on a function that scans JSONL files for `assistant` entries with `usage` objects. This parser is the first thing to build. It runs in the main process (filesystem access), results cached by `(filePath, fileSize)` to avoid redundant reads. The existing `readLastJsonlLine` tail-only approach is intentionally insufficient for usage — usage data accumulates across the entire file's history.

- **Model pricing table must be bundled, not fetched:** Pricing from `platform.claude.com/docs/en/about-claude/pricing` must be baked into constants. The app is always-on and offline-capable; network fetches for pricing would create flicker on startup. The table needs maintenance when Anthropic releases new models, but this is infrequent (2-3 times per year).

- **Today's Totals and 30-day Chart share the same bucketing logic:** If daily bucketing by calendar date is built for Today's Totals, the 30-day chart is an extension of the same scan with a wider date window. Build them together or ensure the data structure supports both from the start.

- **Session list rows are independent of token data:** The session list (project name, status, duration, tool) can render immediately using existing IPC data. Token/cost detail only appears when rows are expanded — this allows a phased implementation: ship the list first, add expansion with token data in a later phase.

- **Click-to-expand requires no new IPC:** Token data for expanded rows can be fetched on demand via a new IPC handler `get-session-usage` that takes a `sessionId` and returns `TokenCounts`. No need to include usage in every sessions-update broadcast (would bloat IPC payload on every 3-second poll).

## MVP Definition

### Launch With (v1.5 Core)

Minimum viable dashboard that makes the "Active" requirements in PROJECT.md complete.

- [ ] **Expand window height** — Add ~200px below the 768px RPG world for the dashboard panel. Requires `BrowserWindow` height change in `main/index.ts` and CSS panel layout in renderer.
- [ ] **JSONL usage parser (main process)** — `readSessionUsage(filePath): TokenCounts` scanning all `assistant` entries with `usage` objects. Cache by `(filePath, mtimeMs)`. This is the foundation all cost features depend on.
- [ ] **Bundled model pricing table** — Constants for Opus, Sonnet, Haiku (input, output, cache write, cache read rates per MTok). Cover Claude 3.x through Claude 4.6 families. Source: official Anthropic docs.
- [ ] **Live session list with compact rows** — Project name, status badge (color-coded), duration (time since session start), current tool. Renders as an HTML panel below the canvas. Updates on each `sessions-update` IPC event.
- [ ] **Click-to-expand row with token detail** — Expanded view shows input tokens, output tokens, cache creation, cache read, cost estimate, model name. Fetched via on-demand `get-session-usage` IPC call when row is clicked.
- [ ] **Today's totals bar** — Persistent header row in the dashboard: "Today: X input tokens | Y output tokens | ~$Z". Updated on each poll cycle.
- [ ] **Cost estimation per session** — Apply pricing table to token counts from the usage parser. Display as `~$0.34` with tilde to signal estimate.

### Add After Validation (v1.5 Polish)

- [ ] **30-day daily breakdown chart** — Canvas-rendered bar chart of daily token spend. Requires scanning all historical JSONL files grouped by date. Add only after the core session list and today's totals are working correctly.
- [ ] **Cache savings display** — "Cache saved ~$X" line in expanded session detail. Low effort once cache token counts are available.
- [ ] **Session completion count** — "7 tasks completed today" metric in the totals bar. Tap into the existing celebration-detection logic.
- [ ] **Cost-by-model breakdown** — In the 30-day chart, stack Opus vs Sonnet vs Haiku costs. Adds context to the daily bar chart.

### Future Consideration (v2+)

- [ ] **Budget display threshold coloring** — Yellow/red tinting on the totals bar above user-defined daily limits. Requires a settings system that does not exist yet.
- [ ] **Per-project historical view** — Filter the 30-day chart by project. Depends on reliable project-to-session mapping, which is currently fuzzy for multi-project sessions.
- [ ] **Data export** — Point users to ccusage CLI as the canonical export solution. Only revisit if there is strong demand for in-app export.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Window height expansion | HIGH | LOW | P1 |
| JSONL usage parser | HIGH | MEDIUM | P1 |
| Model pricing table constants | HIGH | LOW | P1 |
| Live session list rows | HIGH | LOW | P1 |
| Today's totals bar | HIGH | MEDIUM | P1 |
| Click-to-expand token detail | HIGH | LOW | P1 |
| Cost estimate per session | HIGH | LOW (once parser exists) | P1 |
| 30-day daily chart | MEDIUM | HIGH | P2 |
| Cache savings display | MEDIUM | LOW | P2 |
| Session completion count | MEDIUM | LOW | P2 |
| Cost-by-model chart stacking | LOW | MEDIUM | P3 |
| Budget threshold coloring | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.5 milestone sign-off
- P2: Should have, add after P1 items are validated
- P3: Nice to have, future consideration

## Existing Infrastructure Reuse

| Existing Code | How It Is Reused for Dashboard |
|---------------|-------------------------------|
| `FilesystemSessionDetector.discoverSessions()` | Already scans all JSONL files. Usage parser runs on same file paths — no new discovery logic needed. |
| `SessionStore.poll()` + IPC push | Session list update triggers are already wired. Today's totals can piggyback on the same polling cycle. |
| `readLastJsonlLine()` in `jsonl-reader.ts` | Pattern for O(1) reads is established. Usage parser follows the same file-open/stat/read/close pattern but reads the full file rather than tail-only. |
| `SessionInfo.projectName`, `.status`, `.lastToolName` | Live session list rows render directly from these fields — no new IPC channels needed for the list itself. |
| `ipc-handlers.ts` + `preload.ts` + `IAgentWorldAPI` | On-demand usage fetch (`get-session-usage`) follows the existing `getInitialSessions` IPC pattern. Add a new channel, handler, and preload bridge. |
| `IPC_CHANNELS` constant in `types.ts` | New channel names (`GET_SESSION_USAGE`, `GET_DAILY_TOTALS`) follow the same single-source-of-truth pattern. |
| Main process file access (Electron context) | Token parsing is compute on the main process side — fits the existing architecture where all filesystem I/O happens in main, not renderer. |

## Implementation Notes: JSONL Usage Parsing

The JSONL `assistant` entries that carry usage data have this structure:

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-sonnet-4-6-20260228",
    "usage": {
      "input_tokens": 4821,
      "output_tokens": 312,
      "cache_creation_input_tokens": 3500,
      "cache_read_input_tokens": 12000
    }
  }
}
```

Key parser requirements:
1. Scan all lines in the file (not just tail) — usage accumulates over the full session history
2. Only process lines where `type === "assistant"` and `message.usage` is present
3. Sum all four token fields across all assistant entries in the file
4. Extract the most recent `message.model` for cost calculation
5. Cache result by `(filePath, fileSizeBytes)` — if size unchanged since last scan, return cached result (JSONL files only grow, never shrink)

**Cost formula (per session):**

```
cost = (input_tokens / 1_000_000) * input_rate_per_mtok
     + (output_tokens / 1_000_000) * output_rate_per_mtok
     + (cache_creation_input_tokens / 1_000_000) * cache_write_rate_per_mtok
     + (cache_read_input_tokens / 1_000_000) * cache_read_rate_per_mtok
```

**Model pricing constants (as of 2026-03-01, from official Anthropic docs):**

| Model family | Input $/MTok | Output $/MTok | Cache Write $/MTok | Cache Read $/MTok |
|--------------|-------------|--------------|-------------------|------------------|
| claude-opus-4.x | 5.00 | 25.00 | 6.25 | 0.50 |
| claude-sonnet-4.x | 3.00 | 15.00 | 3.75 | 0.30 |
| claude-haiku-4.x | 1.00 | 5.00 | 1.25 | 0.10 |
| claude-sonnet-3.7 | 3.00 | 15.00 | 3.75 | 0.30 |
| claude-haiku-3.5 | 0.80 | 4.00 | 1.00 | 0.08 |
| claude-opus-3 | 15.00 | 75.00 | 18.75 | 1.50 |
| claude-haiku-3 | 0.25 | 1.25 | 0.30 | 0.03 |

Match by prefix substring: `model.startsWith('claude-opus-4')` → Opus 4.x pricing. Note that subscription-plan users (Claude Code Pro/Max) pay a flat monthly fee — the cost estimates will show API-equivalent pricing, not actual subscription cost. Display a disclaimer: "API-equivalent estimate."

## Competitor Feature Analysis

| Feature | ccusage (CLI) | Claude-Code-Usage-Monitor (terminal) | Agent World Dashboard (ours) |
|---------|--------------|-------------------------------------|------------------------------|
| Live session list | No (historical only) | Yes (real-time) | Yes (live, integrated with RPG view) |
| Token breakdown | Yes (daily/monthly/session) | Yes (real-time) | Yes (per session + today totals) |
| Cost estimate | Yes (auto/calculate/display modes) | Yes | Yes |
| Cache token tracking | Yes | Partial | Yes |
| Historical chart | Yes (table format) | Yes (real-time view only) | Yes (30-day bar chart, v1.5 P2) |
| Model breakdown | Yes (optional flag) | No | Yes (model badge per session) |
| Integration with status view | No (separate tool) | No (separate terminal) | Yes (same window as RPG visualizer) |
| Windows native | Yes (Node.js CLI) | Yes (Python terminal) | Yes (Electron) |
| Offline pricing | Yes (LiteLLM cached) | Unknown | Yes (bundled constants) |
| No setup required | No (npm install needed) | No (pip install needed) | Yes (already installed) |

## Sources

- [ccusage official site](https://ccusage.com/) — feature set, cost modes, token types tracked
- [ccusage GitHub](https://github.com/ryoppippi/ccusage) — daily/weekly/monthly/session views, JSON export, 5-hour billing windows
- [ccusage cost modes guide](https://ccusage.com/guide/cost-modes) — auto/calculate/display modes, token formula
- [Claude-Code-Usage-Monitor GitHub](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) — real-time terminal UI, P90 predictions, color-coded progress bars
- [Anthropic Claude API pricing (official)](https://platform.claude.com/docs/en/about-claude/pricing) — per-model pricing table for all Claude 3.x and 4.x families
- [Shipyard: How to track Claude Code usage](https://shipyard.build/blog/claude-code-track-usage/) — four approaches compared, complementary strategy
- [Langfuse token and cost tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking) — industry patterns for LLM observability dashboards
- [LLM Cost Estimation Guide (Medium)](https://medium.com/@alphaiterations/llm-cost-estimation-guide-from-token-usage-to-total-spend-fba348d62824) — token type breakdown, cost formula structure
- Direct codebase analysis: `src/main/jsonl-reader.ts`, `src/main/session-detector.ts`, `src/main/session-store.ts`, `src/shared/types.ts`

---
*Feature research for: v1.5 Usage Dashboard milestone*
*Researched: 2026-03-01*

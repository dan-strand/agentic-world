# Phase 18: Live Dashboard with Cost Estimation - Research

**Researched:** 2026-03-01
**Domain:** HTML/CSS dashboard UI, model pricing, IPC wiring, token cost calculation in Electron
**Confidence:** HIGH

## Summary

Phase 18 builds the primary daily-use feature: a live dashboard that renders session rows, token breakdowns, and cost estimates inside the existing `#dashboard` div (312px strip below the PixiJS canvas). Phase 17 delivered all the infrastructure this phase needs -- the `readUsageTotals()` streaming JSONL parser, the `UsageAggregator` with mtime caching, the `TokenUsageTotals` and `SessionUsage` types, and the HTML/CSS dashboard div itself. Phase 18 is pure wiring and rendering: connect `UsageAggregator` into the `SessionStore` poll cycle, pipe `DashboardData` through a new IPC channel, and render it as HTML in the renderer.

The most important finding from this research is that **model name strings in live JSONL files have six distinct formats**: `claude-opus-4-6`, `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`, `opus`, `sonnet`, `haiku`, and `<synthetic>`. The pricing lookup must use prefix-matching (not exact match) and handle bare short names as aliases. The ARCHITECTURE.md pricing table had an incorrect rate for `claude-opus-4-6` ($15.00 input -- that is Opus 4.1/4.0 pricing). Verified against official Anthropic docs: Opus 4.6 and 4.5 are $5.00 input / $25.00 output. This discrepancy is now resolved.

**Primary recommendation:** Build in two plans: (1) main-process wiring (pricing constants, cost calculation in UsageAggregator, IPC channel, preload bridge) and (2) renderer dashboard UI (session rows, expandable detail, today's totals bar, cache savings). No new npm dependencies needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COST-01 | Bundled pricing table covers Opus, Sonnet, and Haiku model families with correct per-token rates | Verified pricing table from official Anthropic docs (2026-03-01). All 12 model tiers documented with exact rates. Model name formats verified from 6 live JSONL files. Prefix-matching needed for date-suffixed names. |
| COST-02 | Cache read tokens priced at 0.1x input rate, cache write tokens at 1.25x input rate | Confirmed from official Anthropic pricing page. Formula: `cacheRead = input * 0.1`, `cacheWrite = input * 1.25`. These multipliers apply uniformly across all models. |
| COST-03 | Model auto-detected from JSONL message.model field | Verified: model lives at `entry.message.model` (not top-level). `readUsageTotals()` already extracts this (jsonl-reader.ts line 176). Six model name formats found in live files require prefix-matching or alias mapping. |
| COST-04 | Cost displayed as ~$X.XX to signal estimate status | UI pattern: prefix with tilde, format to 2 decimal places. Unknown models display "~$X.XX est." rather than $0. Research confirms DEFAULT_MODEL_PRICING fallback using Sonnet rates. |
| DASH-01 | Live session list shows compact rows with project name, status badge, duration, and current tool | Session data already flows via `sessions-update` IPC with `projectName`, `status`, `lastToolName`, `lastModified`. Duration = `Date.now() - session.lastModified` or first JSONL timestamp. Dashboard div exists at 312px. |
| DASH-02 | Clicking a session row expands it to reveal a full token breakdown and cost estimate | HTML click handler toggles a detail div. Token data from `DashboardData.sessions[].inputTokens/outputTokens/cacheCreationTokens/cacheReadTokens/totalCostUsd`. Pure CSS height transition. |
| DASH-03 | Today's totals bar shows aggregate input tokens, output tokens, estimated cost, and session count | Sum all `SessionUsage` entries for sessions active today. Emit as `DashboardData.todayTotals`. Render as fixed header in dashboard div. |
| DASH-04 | Cache savings display shows estimated money saved by cache reads versus full-price input | Formula: `savings = cacheReadTokens * (inputRate - cacheReadRate) / 1_000_000`. Display as "Cache saved ~$X.XX" in totals bar or expanded row detail. |
</phase_requirements>

## Standard Stack

### Core

No new libraries needed. Everything uses existing project dependencies and Node.js built-ins.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron IPC | 40.6.1 (existing) | Push `dashboard-update` from main to renderer | Already established pattern (`sessions-update`). Same `contextBridge.exposeInMainWorld` approach. |
| HTML/CSS DOM | N/A (built-in) | Dashboard panel rendering | Text-heavy tabular data with expandable rows. Already proven in project (drag region, audio controls). |
| Node.js `fs` | Built-in | `statSync` for mtime checks in UsageAggregator | Already imported in usage-aggregator.ts and session-detector.ts. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `readUsageTotals()` | Phase 17 | Stream-parse JSONL for token totals | Called by UsageAggregator when file mtime changes. Already built and tested (8 tests pass). |
| `UsageAggregator` | Phase 17 | Mtime-cached wrapper around readUsageTotals | Called from SessionStore poll cycle. Already built and tested (6 tests pass). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain HTML/CSS dashboard | React/Preact in renderer | Massive complexity for 3 components. Project has zero React. 4-8 session rows do not justify a framework. |
| Separate `dashboard-update` IPC channel | Add token fields to `SessionInfo` on `sessions-update` | Couples dashboard concerns to RPG world updates. Forces full JSONL scan on every 3s poll for all sessions, even when dashboard data hasn't changed. |
| On-demand `get-session-usage` IPC per click | Push all usage data every poll cycle | On-demand adds latency on click (must await IPC round-trip). Pushing all usage in a single `dashboard-update` is simpler and the payload is small (4-8 sessions, ~50 bytes each). |

**Installation:** None required -- no new npm dependencies.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main/
│   ├── session-store.ts    # MODIFIED: call UsageAggregator, push dashboard-update IPC
│   ├── ipc-handlers.ts     # MODIFIED: no changes needed yet (get-history is Phase 19)
│   ├── usage-aggregator.ts # MODIFIED: add calculateCost() method using MODEL_PRICING
│   └── index.ts            # MODIFIED: wire UsageAggregator into SessionStore
├── renderer/
│   ├── index.ts            # MODIFIED: subscribe to onDashboardUpdate, init DashboardPanel
│   ├── index.html          # MODIFIED: remove placeholder text from #dashboard
│   └── dashboard-panel.ts  # NEW: session rows, expandable detail, today's totals
├── shared/
│   ├── types.ts            # MODIFIED: add DashboardData, IPC channel, preload API
│   └── constants.ts        # MODIFIED: add MODEL_PRICING table
└── preload/
    └── preload.ts          # MODIFIED: expose onDashboardUpdate callback
```

### Pattern 1: Model Pricing Lookup with Prefix Matching

**What:** A pricing table keyed by model ID prefix, with a resolution function that handles the six observed model name formats.

**When to use:** Every cost calculation in UsageAggregator.

**Why prefix-matching:** Live JSONL files contain model names in multiple formats:
- Full: `claude-opus-4-6`, `claude-sonnet-4-6`
- Date-suffixed: `claude-haiku-4-5-20251001`, `claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929`
- Bare: `opus`, `sonnet`, `haiku`
- Synthetic: `<synthetic>` (test/internal -- should use default pricing)

**Verified pricing (from official Anthropic docs, 2026-03-01):**

| Model Family | Input $/MTok | Output $/MTok | Cache Write $/MTok (1.25x) | Cache Read $/MTok (0.1x) |
|--------------|-------------|---------------|---------------------------|--------------------------|
| Opus 4.6/4.5 | 5.00 | 25.00 | 6.25 | 0.50 |
| Opus 4.1/4.0 | 15.00 | 75.00 | 18.75 | 1.50 |
| Sonnet 4.6/4.5/4.0/3.7 | 3.00 | 15.00 | 3.75 | 0.30 |
| Haiku 4.5 | 1.00 | 5.00 | 1.25 | 0.10 |
| Haiku 3.5 | 0.80 | 4.00 | 1.00 | 0.08 |
| Opus 3 | 15.00 | 75.00 | 18.75 | 1.50 |
| Haiku 3 | 0.25 | 1.25 | 0.30 | 0.03 |

**Example:**
```typescript
// Model pricing table -- verified against platform.claude.com/docs/en/about-claude/pricing (2026-03-01)
// Cache write = 1.25x input, cache read = 0.1x input (uniform across all models)
interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  cacheWritePer1M: number;
  cacheReadPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6':   { inputPer1M: 5.00,  outputPer1M: 25.00, cacheWritePer1M: 6.25,  cacheReadPer1M: 0.50 },
  'claude-opus-4-5':   { inputPer1M: 5.00,  outputPer1M: 25.00, cacheWritePer1M: 6.25,  cacheReadPer1M: 0.50 },
  'claude-opus-4-1':   { inputPer1M: 15.00, outputPer1M: 75.00, cacheWritePer1M: 18.75, cacheReadPer1M: 1.50 },
  'claude-opus-4':     { inputPer1M: 15.00, outputPer1M: 75.00, cacheWritePer1M: 18.75, cacheReadPer1M: 1.50 },
  'claude-sonnet-4':   { inputPer1M: 3.00,  outputPer1M: 15.00, cacheWritePer1M: 3.75,  cacheReadPer1M: 0.30 },
  'claude-sonnet-3':   { inputPer1M: 3.00,  outputPer1M: 15.00, cacheWritePer1M: 3.75,  cacheReadPer1M: 0.30 },
  'claude-haiku-4':    { inputPer1M: 1.00,  outputPer1M: 5.00,  cacheWritePer1M: 1.25,  cacheReadPer1M: 0.10 },
  'claude-haiku-3-5':  { inputPer1M: 0.80,  outputPer1M: 4.00,  cacheWritePer1M: 1.00,  cacheReadPer1M: 0.08 },
  'claude-opus-3':     { inputPer1M: 15.00, outputPer1M: 75.00, cacheWritePer1M: 18.75, cacheReadPer1M: 1.50 },
  'claude-haiku-3':    { inputPer1M: 0.25,  outputPer1M: 1.25,  cacheWritePer1M: 0.30,  cacheReadPer1M: 0.03 },
};

// Bare name aliases (observed in live JSONL: "opus", "sonnet", "haiku")
const BARE_MODEL_ALIASES: Record<string, string> = {
  'opus': 'claude-opus-4-6',
  'sonnet': 'claude-sonnet-4-6',
  'haiku': 'claude-haiku-4-5',
};

const DEFAULT_MODEL_PRICING: ModelPricing = MODEL_PRICING['claude-sonnet-4-6'];

function resolveModelPricing(model: string): { pricing: ModelPricing; isEstimate: boolean } {
  // 1. Check bare aliases
  if (BARE_MODEL_ALIASES[model]) {
    const key = BARE_MODEL_ALIASES[model];
    return { pricing: MODEL_PRICING[key] ?? DEFAULT_MODEL_PRICING, isEstimate: false };
  }
  // 2. Exact match
  if (MODEL_PRICING[model]) {
    return { pricing: MODEL_PRICING[model], isEstimate: false };
  }
  // 3. Prefix match (handles date-suffixed names like "claude-haiku-4-5-20251001")
  for (const prefix of Object.keys(MODEL_PRICING)) {
    if (model.startsWith(prefix)) {
      return { pricing: MODEL_PRICING[prefix], isEstimate: false };
    }
  }
  // 4. Default fallback -- flag as estimate
  return { pricing: DEFAULT_MODEL_PRICING, isEstimate: true };
}
```

### Pattern 2: DashboardData IPC Channel

**What:** A new `dashboard-update` IPC channel carrying `DashboardData` from main to renderer, separate from the existing `sessions-update` channel.

**When to use:** Pushed from SessionStore after each poll cycle where session data changed.

**Key design decisions:**
- Dashboard update piggybacks on the existing 3s poll cycle (no separate timer)
- Only pushed when `hasChanges` is true (same condition as `sessions-update`)
- Payload includes both per-session usage AND today's aggregated totals
- Today's totals computed by summing all SessionUsage entries (no separate HistoryStore needed for Phase 18 -- that is Phase 19)

**Example types:**
```typescript
export interface DashboardData {
  sessions: DashboardSession[];
  todayTotals: TodayTotals;
}

export interface DashboardSession {
  sessionId: string;
  projectName: string;
  status: SessionStatus;
  lastToolName: string;
  lastModified: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
  cacheSavingsUsd: number;
  model: string;
  modelDisplayName: string;  // "Opus 4.6", "Sonnet", "Haiku 4.5"
  isEstimate: boolean;       // true when model is unrecognized
  turnCount: number;
}

export interface TodayTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
  cacheSavingsUsd: number;
  sessionCount: number;
}
```

### Pattern 3: SessionStore Extension for Dashboard

**What:** Add UsageAggregator as a dependency of SessionStore. After status detection, call UsageAggregator for each session and push DashboardData via IPC.

**Critical constraint:** UsageAggregator.getUsage() is async (uses streaming readline). SessionStore.poll() is currently synchronous. The poll method must become async, or usage aggregation must be called after the synchronous status detection completes.

**Recommended approach:** Make poll() async. The `setInterval` callback can fire an async function -- missed intervals simply mean the next poll waits for the previous to complete. Since the poll interval is 3s and usage aggregation for changed files takes 50-150ms, there is no risk of overlap.

**Example:**
```typescript
// In SessionStore constructor:
constructor(
  detector: SessionDetector,
  private usageAggregator: UsageAggregator,  // NEW
) { ... }

// In poll():
private async poll(): Promise<void> {
  // [existing synchronous status detection unchanged]
  ...
  if (hasChanges) {
    this.pushUpdate();  // existing sessions-update
    await this.pushDashboardUpdate();  // NEW
  }
}

private async pushDashboardUpdate(): Promise<void> {
  const sessions = this.getSessions();
  const dashboardSessions: DashboardSession[] = [];

  for (const session of sessions) {
    const filePath = session.filePath;  // Need to add filePath to SessionInfo
    const usage = await this.usageAggregator.getUsage(session.sessionId, filePath);
    if (usage) {
      const { pricing, isEstimate } = resolveModelPricing(usage.model);
      const cost = calculateCost(usage, pricing);
      dashboardSessions.push({ ...session, ...usage, totalCostUsd: cost, isEstimate });
    }
  }

  const todayTotals = sumTotals(dashboardSessions);
  this.mainWindow?.webContents.send(IPC_CHANNELS.DASHBOARD_UPDATE, { sessions: dashboardSessions, todayTotals });
}
```

### Pattern 4: Dashboard HTML Structure

**What:** Pure HTML/CSS dashboard panel using DOM manipulation (createElement/innerHTML). No framework.

**When to use:** Rendering session rows, expandable detail, and today's totals header.

**Example DOM structure:**
```html
<div id="dashboard">
  <!-- Today's totals header bar -->
  <div class="dashboard-totals">
    <span class="stat">Input: 1.2M</span>
    <span class="stat">Output: 85K</span>
    <span class="stat">Cost: ~$0.47</span>
    <span class="stat">Cache saved: ~$1.23</span>
    <span class="stat">Sessions: 3</span>
  </div>

  <!-- Session rows -->
  <div class="session-list">
    <div class="session-row" data-session-id="abc123">
      <div class="session-summary">
        <span class="project-name">Agent World</span>
        <span class="status-badge active">active</span>
        <span class="model-badge">Opus 4.6</span>
        <span class="tool-name">Edit</span>
        <span class="duration">12m</span>
        <span class="cost">~$0.18</span>
      </div>
      <div class="session-detail" style="display: none;">
        <div class="token-row">Input: 42,350</div>
        <div class="token-row">Output: 3,120</div>
        <div class="token-row">Cache write: 6,700</div>
        <div class="token-row">Cache read: 38,400</div>
        <div class="token-row cost-row">Cost: ~$0.18</div>
        <div class="token-row savings-row">Cache saved: ~$0.52</div>
      </div>
    </div>
  </div>
</div>
```

### Anti-Patterns to Avoid

- **Adding token fields to SessionInfo:** Couples RPG world updates to dashboard concerns. Forces token scan on every poll for every session. Keep `SessionInfo` lean.
- **Rendering dashboard with PixiJS:** Text-heavy tabular data belongs in HTML/CSS. BitmapText at 13px is harder than a `<span>`. Project already mixes HTML elements with PixiJS canvas.
- **Polling UsageAggregator independently of SessionStore:** Creates a second timer, second set of file stats, and potential race conditions. Piggyback on the existing 3s poll cycle.
- **Using `readFileSync` in UsageAggregator:** Already resolved -- Phase 17 built `readUsageTotals()` with streaming readline. Never regress to synchronous full-file reads.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token number formatting | Custom number-to-string | `Intl.NumberFormat` or simple `toLocaleString()` | Handles thousands separators, locale-appropriate. Built into every JS engine. |
| Cost formatting | Manual string concatenation | `toFixed(2)` with `~$` prefix | Two decimal places with tilde prefix per COST-04. |
| Duration formatting | Complex date math | Simple `Math.floor((now - lastModified) / 60000)` + "m" suffix | Sessions are measured in minutes, not hours/days. Keep simple. |
| Token abbreviation (1.2M, 85K) | Recursive division | Simple conditional: `>= 1M -> (n/1M).toFixed(1)+'M'`, `>= 1K -> (n/1K).toFixed(0)+'K'` | Only two thresholds needed. |

**Key insight:** This phase involves zero algorithmically complex problems. The challenge is wiring -- connecting existing infrastructure (UsageAggregator, SessionStore, IPC) and rendering clean HTML. Resist the urge to over-engineer.

## Common Pitfalls

### Pitfall 1: Wrong Pricing for Opus 4.6 vs Opus 4.1/4.0

**What goes wrong:** Using $15.00 input for `claude-opus-4-6` when the correct rate is $5.00. The ARCHITECTURE.md research file had this error.
**Why it happens:** Opus 3 and Opus 4.0/4.1 are $15.00 input. Opus 4.5/4.6 are $5.00 input (67% reduction). Easy to use the old tier.
**How to avoid:** Use the verified pricing table in this research document. Comment the verification date in the constants file.
**Warning signs:** Cost estimates seem 3x too high for Opus sessions.

### Pitfall 2: Exact-Match Model Lookup Fails for Date-Suffixed Names

**What goes wrong:** `MODEL_PRICING['claude-haiku-4-5-20251001']` returns `undefined` because the key is `'claude-haiku-4-5'`.
**Why it happens:** JSONL model names sometimes include a date suffix (e.g., `-20251001`). Exact string matching misses these.
**How to avoid:** Use the `resolveModelPricing()` function with prefix matching. It tries exact match first, then prefix match, then falls back to default with `isEstimate: true`.
**Warning signs:** Sessions showing "est." indicator when they should be recognized models.

### Pitfall 3: Bare Model Names ("opus", "sonnet", "haiku")

**What goes wrong:** `resolveModelPricing('opus')` hits the default fallback instead of matching Opus pricing.
**Why it happens:** Some JSONL entries use bare model names without the `claude-` prefix. Observed in live data: `"model":"opus"`, `"model":"sonnet"`, `"model":"haiku"`.
**How to avoid:** Include a `BARE_MODEL_ALIASES` lookup that maps `'opus' -> 'claude-opus-4-6'` etc. Check bare aliases before prefix matching.
**Warning signs:** Sessions using bare names showing wrong model badge or "est." indicator.

### Pitfall 4: SessionInfo Lacks filePath -- UsageAggregator Can't Find the JSONL File

**What goes wrong:** `SessionStore` has `SessionInfo` objects but `UsageAggregator.getUsage()` needs a file path. `SessionInfo` does not currently include `filePath`.
**Why it happens:** The session detector knows the file path during `processSessionFile()` but does not expose it in `SessionInfo` because the renderer never needed it.
**How to avoid:** Either (a) add `filePath` to `SessionInfo` (simplest -- it stays in main process, renderer ignores it), or (b) have the detector expose a `getFilePath(sessionId)` method, or (c) have SessionStore maintain a separate `Map<sessionId, filePath>`.
**Warning signs:** Compile error or undefined filePath when wiring UsageAggregator to SessionStore.

### Pitfall 5: Async poll() Causing Overlapping Intervals

**What goes wrong:** `setInterval(poll, 3000)` fires the next interval while the previous async poll is still awaiting `readUsageTotals()`.
**Why it happens:** `setInterval` does not wait for async callbacks. If a file scan takes >3s (unlikely but possible on a very large file with cold disk cache), two polls could overlap.
**How to avoid:** Use a pattern like `setTimeout` chaining instead of `setInterval`: after each poll completes, schedule the next one. Or add a `polling: boolean` guard flag.
**Warning signs:** Duplicate IPC messages, console log interleaving, or doubled DOM updates.

### Pitfall 6: Cache Savings Calculation Uses Wrong Formula

**What goes wrong:** Calculating savings as `cacheReadTokens * inputRate` (total value) instead of `cacheReadTokens * (inputRate - cacheReadRate)` (marginal savings).
**Why it happens:** Confusing "what cache reads cost" with "what cache reads saved." The savings is the difference between what those tokens WOULD have cost at full input price versus what they actually cost at cache read price.
**How to avoid:** `savings = cacheReadTokens * (inputPer1M - cacheReadPer1M) / 1_000_000`.
**Warning signs:** Cache savings seem implausibly high (close to the total cost of the session).

## Code Examples

Verified patterns from direct codebase analysis and official docs.

### Cost Calculation

```typescript
// Source: Official Anthropic pricing page (platform.claude.com/docs/en/about-claude/pricing)
// Cache write = 1.25x input, cache read = 0.1x input

function calculateCost(usage: TokenUsageTotals, pricing: ModelPricing): number {
  return (
    (usage.inputTokens * pricing.inputPer1M / 1_000_000) +
    (usage.outputTokens * pricing.outputPer1M / 1_000_000) +
    (usage.cacheCreationTokens * pricing.cacheWritePer1M / 1_000_000) +
    (usage.cacheReadTokens * pricing.cacheReadPer1M / 1_000_000)
  );
}

function calculateCacheSavings(usage: TokenUsageTotals, pricing: ModelPricing): number {
  // Savings = what cache reads WOULD have cost at full input price minus what they actually cost
  return usage.cacheReadTokens * (pricing.inputPer1M - pricing.cacheReadPer1M) / 1_000_000;
}
```

### Model Display Name Extraction

```typescript
// Source: Live JSONL inspection -- model names from 6+ session files across multiple projects
function getModelDisplayName(model: string): string {
  const lower = model.toLowerCase();
  if (lower === 'opus' || lower.includes('opus')) return 'Opus';
  if (lower === 'sonnet' || lower.includes('sonnet')) return 'Sonnet';
  if (lower === 'haiku' || lower.includes('haiku')) return 'Haiku';
  return model;  // Unknown -- show raw string
}
```

### Wiring UsageAggregator into SessionStore.poll()

```typescript
// Source: Existing session-store.ts pattern + usage-aggregator.ts API
// The poll method becomes async; setInterval still works (fires and forgets)

private async poll(): Promise<void> {
  try {
    const discovered = this.detector.discoverSessions();
    let hasChanges = false;
    // [existing change detection logic unchanged]
    ...
    if (hasChanges) {
      this.pushUpdate();           // existing sessions-update IPC
      await this.pushDashboardUpdate();  // NEW dashboard-update IPC
    }
  } catch (err) {
    console.error('[session-store] Poll error:', (err as Error).message);
  }
}
```

### Preload Bridge Extension

```typescript
// Source: Existing preload.ts pattern (contextBridge.exposeInMainWorld)
// Add onDashboardUpdate alongside existing onSessionsUpdate

onDashboardUpdate: (callback: (data: DashboardData) => void): void => {
  ipcRenderer.on(IPC_CHANNELS.DASHBOARD_UPDATE, (_event, data: DashboardData) => {
    callback(data);
  });
},
```

### Dashboard Row Click-to-Expand

```typescript
// Source: Standard HTML DOM pattern -- no framework needed
row.addEventListener('click', () => {
  const detail = row.querySelector('.session-detail') as HTMLElement;
  if (detail) {
    const isExpanded = detail.style.display !== 'none';
    detail.style.display = isExpanded ? 'none' : 'block';
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Opus at $15/MTok input | Opus 4.5/4.6 at $5/MTok input | Late 2025 (Opus 4.5 release) | 3x reduction. Using old price severely over-estimates costs. |
| Exact model name matching | Prefix matching + bare aliases | N/A (project-specific) | Required because JSONL model names have 6+ formats |
| Synchronous JSONL full-file read | Streaming readline (Phase 17) | Phase 17 (2026-03-01) | Already resolved. Non-blocking. |

**Deprecated/outdated:**
- Opus 3, Sonnet 3.7 are deprecated per Anthropic model deprecations page. Pricing still listed for legacy sessions.
- The ARCHITECTURE.md pricing for `claude-opus-4-6` ($15.00 input) was incorrect. Corrected to $5.00 input in this document.

## Open Questions

1. **SessionInfo needs filePath for UsageAggregator**
   - What we know: `SessionInfo` does not include `filePath`. The session detector knows it during `processSessionFile()` but discards it.
   - What's unclear: Whether to add `filePath` to `SessionInfo` (simplest but leaks main-process implementation to renderer type) or maintain a separate lookup.
   - Recommendation: Add `filePath` to `SessionInfo`. It is already a main-process-only value that the renderer ignores. The `IAgentWorldAPI` strips it before sending to renderer. Alternatively, have `SessionStore` maintain a `Map<sessionId, filePath>` alongside the `sessions` map.

2. **Duration display: "time since last modified" vs "session duration"**
   - What we know: `SessionInfo.lastModified` gives the mtime (last file write). `readUsageTotals()` could extract first timestamp for session start time, but this is not currently returned.
   - What's unclear: Users likely expect "how long has this session been running" (start to now), not "how long since last activity."
   - Recommendation: Use `lastModified` for duration initially (simpler -- no parser changes). The result is "time since last activity" which is useful for active sessions. If users request true session duration, add `firstTimestamp` to `TokenUsageTotals` in a later iteration.

3. **Dashboard update frequency: every 3s or decoupled?**
   - What we know: The dashboard piggybacks on the 3s poll cycle. Token counts only change when JSONL files are written (message boundaries). Mtime cache means only changed files are scanned.
   - What's unclear: Whether 3s updates cause perceptible flicker or unnecessary DOM thrashing.
   - Recommendation: Start with 3s (same as status updates). The mtime cache means no-op polls are cheap. If DOM updates cause issues, add a simple dirty check (compare new data JSON hash to previous).

## Sources

### Primary (HIGH confidence)
- [Anthropic Official Pricing](https://platform.claude.com/docs/en/about-claude/pricing) - Complete model pricing table for all Claude model families. Verified 2026-03-01: Opus 4.6 = $5/$25, Sonnet 4.6 = $3/$15, Haiku 4.5 = $1/$5. Cache write = 1.25x input, cache read = 0.1x input.
- Direct codebase analysis: `src/main/usage-aggregator.ts`, `src/main/jsonl-reader.ts`, `src/main/session-store.ts`, `src/main/session-detector.ts`, `src/shared/types.ts`, `src/shared/constants.ts`, `src/preload/preload.ts`, `src/renderer/index.ts`, `src/renderer/index.html` - All source files read and analyzed.
- Live JSONL inspection: 6+ session files across 4 projects in `~/.claude/projects/` - Confirmed model name formats: `claude-opus-4-6`, `claude-haiku-4-5-20251001`, `claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929`, `claude-sonnet-4-6`, `opus`, `sonnet`, `haiku`, `<synthetic>`.
- Phase 17 Verification Report (17-VERIFICATION.md) - Confirmed: 10/10 truths verified, all 14 tests pass, readUsageTotals() uses streaming readline, UsageAggregator caches by mtime.

### Secondary (MEDIUM confidence)
- Project-level research (SUMMARY.md, ARCHITECTURE.md, FEATURES.md) - Architecture patterns, data flow, anti-patterns. Cross-referenced against actual code; some pricing corrections needed (Opus 4.6 rate).

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or direct code inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed. All infrastructure exists from Phase 17.
- Architecture: HIGH - Patterns verified against actual codebase. IPC wiring follows established project patterns exactly. Types and data flow designed from concrete code analysis.
- Pitfalls: HIGH - Model name formats verified from 6+ live JSONL files across multiple projects. Pricing verified from official Anthropic docs. Async poll overlap is a known setInterval pattern issue.

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (pricing may change; model name formats are stable)

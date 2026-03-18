# Architecture Research: v2.2 Performance Optimization Integration

**Domain:** Performance optimization for existing Electron + PixiJS always-on desktop visualizer
**Researched:** 2026-03-18
**Confidence:** HIGH (based on direct source code analysis of all affected files, PixiJS 8 documentation, Node.js fs API docs)

## Existing Architecture Overview

```
MAIN PROCESS (Node.js)
======================
                    every 3s
  SessionStore ───────────> poll()
       |                       |
       |    ┌──────────────────┤
       |    |                  |
       |    v                  v
       | FilesystemSession   UsageAggregator
       | Detector             |
       |    |                  | mtime check --> readUsageTotals()
       |    | readdirSync()    | (full re-stream on mtime change)
       |    | statSync()       |
       |    | readLastJsonlLine()
       |    | readLastToolUse()
       |    |  (2 separate file opens per session)
       |    |
       v    v
  IPC push: sessions-update + dashboard-update
       |
       v
RENDERER PROCESS (PixiJS 8)
============================
  GameLoop (adaptive FPS: 30/5/0)
       |
       v
  World.tick(deltaMs)
       |
       |-- DayNightCycle.tick()
       |     |-- getNightIntensity()    [sin/pow every tick]
       |     '-- getTintRGB()           [3 lerps every tick]
       |
       |-- stageFilter.matrix = [...]   [new array every tick, GPU re-upload]
       |
       |-- updateNightGlowLayer()       [19+ alpha writes every tick]
       |
       |-- ambientAgents.tick()          [2 agents]
       |
       |-- agents.tick()                 [per-agent: tint, breathing, shake, anim, state machine]
       |     |-- handleAgentReparenting()
       |     |-- advanceStatusDebounce()
       |     |-- idle/waiting timers
       |     '-- visibility safeguard
       |
       |-- deferred agent removal
       |
       |-- building.tick()               [4 buildings: smoke particles]
       |
       |-- ambientParticles.tick()       [25 fireflies + 8 sparks + 15 dust + 6 leaves]
       |
       |-- speechBubbles.tick()
       |
       |-- pruneDismissedSessions()
       |
       '-- building highlight recalc    [iterates all agents, sets tint on 4 buildings every tick]
```

## Optimization Integration Map

Each optimization below is classified as either **MODIFY** (changes existing code) or **NEW** (adds new code/component). The integration point in the existing architecture is specified.

### 1. Remove Stage-Level ColorMatrixFilter (GPU -- Critical)

**Type:** MODIFY
**Files:** `src/renderer/world.ts`, `src/renderer/day-night-cycle.ts`
**Current behavior:** A `ColorMatrixFilter` is applied to `app.stage.filters`. Every tick, `world.ts:287-292` creates a new 20-element array and assigns it to `stageFilter.matrix`. This forces PixiJS to re-upload the matrix to GPU as a uniform every frame. Worse, any filter on `app.stage` causes PixiJS to render the entire scene to an offscreen framebuffer first, then apply the filter shader, then composite to screen. This doubles the GPU render passes for the entire scene.

**Optimization:** Replace the stage filter with per-container `tint` values. In PixiJS 8, `Container.tint` is inherited by all children. Set `tint` on the top-level containers (`tilemapLayer`, `buildingsContainer`, `sceneryLayer`, `agentsContainer`) instead of using a filter on `app.stage`.

**Integration points:**
- `World.init()`: Remove `this.stageFilter = new ColorMatrixFilter()` and `this.app.stage.filters = [this.stageFilter]` (lines 252-253)
- `World.tick()`: Replace the `stageFilter.matrix` assignment (lines 287-292) with tint updates on each layer container
- `DayNightCycle.getTintRGB()`: Keep this method but add a `getTintHex()` method that returns a single `0xRRGGBB` number for use with `Container.tint`
- `nightGlowLayer` must NOT be tinted (glows should remain their original warm color)

**Data flow change:**
```
BEFORE: DayNightCycle.getTintRGB() --> [r,g,b] --> stageFilter.matrix (GPU uniform)
AFTER:  DayNightCycle.getTintHex() --> 0xRRGGBB --> container.tint (vertex color, no shader pass)
```

**Risk:** Container tint multiplies vertex colors, which is not identical to a color matrix. The visual result will be slightly different -- tint can only darken channels (multiply by 0-1), matching the current matrix which only uses diagonal values (r,g,b multipliers). Since the current matrix only sets diagonal values (no cross-channel mixing), tint is a valid 1:1 replacement.

### 2. Cache Day/Night Values with Change Threshold (GPU/CPU)

**Type:** MODIFY
**Files:** `src/renderer/world.ts`, `src/renderer/day-night-cycle.ts`
**Current behavior:** Every tick calls `getNightIntensity()` (1 sin + 1 pow) and `getTintRGB()` (3 lerps). Both recompute from scratch. The stage filter matrix is re-uploaded every tick even if the value has not visibly changed.

**Optimization:** Cache `nightIntensity` and `tintHex` inside DayNightCycle. Only recompute when `elapsed` has advanced enough to change the output. At 30fps, a tick is 33ms. The 10-minute cycle is 600,000ms. A threshold of ~100ms (0.017% of cycle) is invisible but skips 2 out of 3 recomputes.

**Integration points:**
- `DayNightCycle`: Add `private cachedNightIntensity`, `private cachedTintHex`, `private lastComputeElapsed` fields
- `DayNightCycle.tick()`: After advancing elapsed, check `|elapsed - lastComputeElapsed| > threshold`. If not, skip recompute. Return cached values from getters.
- `World.tick()`: Compare new tint hex to previous. Only call `container.tint = newTint` when the value actually changed.

**Dependency:** Builds on top of optimization #1 (tint replaces filter). Can be done in the same task.

### 3. Night Glow Layer -- Guard Against Redundant Alpha Updates (CPU)

**Type:** MODIFY
**Files:** `src/renderer/night-glow-layer.ts`, `src/renderer/world.ts`
**Current behavior:** `updateNightGlowLayer()` iterates 19+ glow sprites and sets `.alpha` on every tick, even when `nightIntensity` has not changed (or changed by an invisible amount).

**Optimization:** Pass previous `nightIntensity` to the update function. If `|current - previous| < 0.005`, skip the update entirely. Store the last-applied intensity in a variable.

**Integration points:**
- `World`: Add `private lastAppliedNightIntensity = -1` field
- `World.tick()`: Before calling `updateNightGlowLayer()`, check threshold. Skip if unchanged.
- `updateNightGlowLayer()`: No signature change needed -- the guard lives in `world.ts`

### 4. Throttle Ambient Particles at Idle FPS (CPU)

**Type:** MODIFY
**Files:** `src/renderer/ambient-particles.ts`, `src/renderer/world.ts`
**Current behavior:** `AmbientParticles.tick()` updates all 54 particles (25 fireflies + 15 dust + 6 leaves + up to 8 sparks) every tick, even at 5fps idle when visual fidelity is not needed.

**Optimization:** At idle FPS (5fps), skip every other tick for fireflies, dust motes, and leaves (they move slowly enough that 2.5fps updates are indistinguishable). Sparks can skip entirely when no sessions are active.

**Integration points:**
- `AmbientParticles`: Add `private tickCounter = 0` field
- `AmbientParticles.tick()`: Accept an `isIdle` boolean parameter. When idle, increment counter and skip particle types based on counter parity.
- `World.tick()`: Pass idle state to `ambientParticles.tick()`
- `World`: Add `private isIdle = true` field, updated from session data

**Data flow change:**
```
BEFORE: World.tick() --> ambientParticles.tick(deltaMs, nightIntensity)
AFTER:  World.tick() --> ambientParticles.tick(deltaMs, nightIntensity, isIdle)
```

### 5. Combine Redundant JSONL File Reads (I/O -- Main Process)

**Type:** MODIFY
**Files:** `src/main/jsonl-reader.ts`, `src/main/session-detector.ts`
**Current behavior:** For each changed session file, `processSessionFile()` calls:
1. `readLastJsonlLine(filePath)` -- opens file, reads 64KB tail, parses last line
2. `readLastToolUse(filePath)` -- opens SAME file again, reads 64KB tail, scans for tool_use

Each call does `fs.openSync()`, `fs.fstatSync()`, `fs.readSync()`, `fs.closeSync()` separately. That is 8 syscalls per session per poll cycle (when mtime changed), reading the same 64KB buffer twice.

**Optimization:** Create a single `readSessionTail(filePath)` function that opens the file once, reads the tail buffer once, and extracts both the last entry AND the last tool_use name from the same buffer in a single pass.

**Integration points:**
- `jsonl-reader.ts`: Add `readSessionTail(filePath)` returning `{ lastEntry: JsonlEntry | null, lastToolName: string | null }`
- `session-detector.ts`: Replace the two separate calls in `processSessionFile()` (lines 147-157) with a single `readSessionTail()` call
- No changes to `readUsageTotals()` -- it reads the full file (different use case) and is already mtime-gated

**Data flow change:**
```
BEFORE: processSessionFile() --> readLastJsonlLine() + readLastToolUse() (2 file opens)
AFTER:  processSessionFile() --> readSessionTail() (1 file open, 1 buffer, combined parse)
```

### 6. Convert Synchronous File I/O to Async (I/O -- Main Process)

**Type:** MODIFY
**Files:** `src/main/session-detector.ts`
**Current behavior:** `discoverSessions()` is synchronous: `readdirSync()` on `~/.claude/projects/`, then per project dir: `readdirSync()`, then per JSONL file: `statSync()`, `readLastJsonlLine()` (sync), `readLastToolUse()` (sync). With 5 projects and 3 sessions each, that is ~60+ blocking syscalls on the main process event loop every 3 seconds.

**Optimization:** Convert to `async discoverSessions()` using `fs.promises.readdir()`, `fs.promises.stat()`, and async file reads. The `SessionStore.poll()` is already `async`, so the call site is ready.

**Integration points:**
- `SessionDetector` interface: Change `discoverSessions()` return type from `SessionInfo[]` to `Promise<SessionInfo[]>`
- `FilesystemSessionDetector`: Convert all `fs.*Sync()` calls to `fs.promises.*` equivalents
- `SessionStore.poll()`: Already `await`s -- just change `this.detector.discoverSessions()` to `await this.detector.discoverSessions()`
- `readSessionTail()` (from optimization #5): Convert to async with `fs.promises.open()` + `fileHandle.read()` + `fileHandle.close()`

**Risk:** The mtime cache check (`cached.mtimeMs === stat.mtimeMs`) still works with async stat. Race condition risk is the same as sync (file could change between stat and read) -- existing fallback parsing handles this.

**Dependency:** Best done together with optimization #5 (combined read). Convert both in one pass.

### 7. Incremental JSONL Usage Parsing (I/O -- Main Process)

**Type:** MODIFY
**Files:** `src/main/jsonl-reader.ts`, `src/main/usage-aggregator.ts`
**Current behavior:** When a session's mtime changes, `UsageAggregator.getUsage()` calls `readUsageTotals(filePath)` which streams the ENTIRE file from byte 0 using `createReadStream` + `readline`. For a 10MB JSONL file, this re-parses ~5000 lines to recompute totals that only changed by the last few entries.

**Optimization:** Track the byte offset where the previous parse ended. On the next mtime change, open the file and seek to that offset. Only parse new lines appended since the last read. Accumulate incrementally into the cached totals.

**Integration points:**
- `UsageAggregator.cache`: Change value type from `{ mtimeMs, totals }` to `{ mtimeMs, totals, lastByteOffset }`
- `jsonl-reader.ts`: Add `readUsageTotalsIncremental(filePath, fromOffset)` that opens the file, seeks to `fromOffset`, and parses only new content
- `UsageAggregator.getUsage()`: When mtime changed and cache exists, call incremental version. When cache miss (new session), call full parse.
- Fallback: If the file size is SMALLER than `lastByteOffset` (file was truncated/rotated), fall back to full re-parse

**Data flow change:**
```
BEFORE: mtime changed --> readUsageTotals(fullFile) --> cache totals
AFTER:  mtime changed --> readUsageTotalsIncremental(fromOffset) --> accumulate into cached totals
```

**Risk:** JSONL files are append-only (Claude Code never modifies earlier lines), so offset-based incremental parsing is safe. The only edge case is file rotation/truncation, which the size check handles.

### 8. Building Highlight Caching (CPU -- Renderer)

**Type:** MODIFY
**Files:** `src/renderer/world.ts`
**Current behavior:** Lines 434-446 in `World.tick()` iterate ALL agents to build a `Set<Building>` of active buildings, then iterate ALL 4 quest zone buildings to set their `.tint`. This runs every tick (up to 30fps).

**Optimization:** Cache the set of active buildings. Only recompute when agents change state (which only happens on IPC updates or agent state transitions, not every tick).

**Integration points:**
- `World`: Add `private activeBuildingCache: Set<Building> = new Set()` and `private highlightsDirty = true`
- `World.tick()`: Only recompute highlights when `highlightsDirty` is true. Set `highlightsDirty = false` after update.
- `World.updateSessions()`, `World.manageAgents()`, agent state transitions: Set `highlightsDirty = true`

### 9. Per-Agent State Map Consolidation (Memory/CPU -- Renderer)

**Type:** MODIFY
**Files:** `src/renderer/world.ts`
**Current behavior:** World maintains 13+ separate `Map<string, ...>` instances for per-agent tracking:
- `agents`, `speechBubbles`, `lastActivity`, `statusDebounce`, `lastCommittedStatus`, `lastRawStatus`, `lastEntryType`, `agentBuilding`, `idleTimers`, `agentSpotIndex`, `hasPlayedReminder`, `waitingTimers`, `hasPlayedWaitingReminder`, `agentsInBuildings`

Each `.delete()` call on agent removal hits all 13 maps (lines 534-547, plus 731-744 for debounce cleanup). Each Map has its own hash table overhead.

**Optimization:** Create an `AgentTrackingState` interface that bundles all per-agent tracking into a single object. Use a single `Map<string, AgentTrackingState>` instead of 13 separate maps.

**Integration points:**
- `World`: Define `interface AgentTrackingState { agent, speechBubble, lastActivity, statusDebounce, ... }`
- Replace all 13+ Maps with `private agentStates: Map<string, AgentTrackingState>`
- `removeAgent()`: Single `this.agentStates.delete(sessionId)` replaces 13 individual deletes
- All code that reads/writes individual maps refactored to access through the consolidated object

**Risk:** This is a large refactor touching many lines. Benefits are reduced hash lookups per tick and cleaner removal. Should be done LAST to avoid merge conflicts with other optimizations.

### 10. Poll Backoff When No Sessions Active (I/O -- Main Process)

**Type:** MODIFY
**Files:** `src/main/session-store.ts`, `src/shared/constants.ts`
**Current behavior:** `SessionStore` polls every 3 seconds regardless of whether any sessions exist.

**Optimization:** When zero sessions are discovered for N consecutive polls, increase the poll interval (e.g., 3s --> 10s --> 30s). Reset to 3s immediately when a session is discovered.

**Integration points:**
- `SessionStore`: Add `private consecutiveEmpty = 0` counter
- `SessionStore.poll()`: After discovering sessions, if empty, increment counter. Use dynamic interval: `Math.min(30000, POLL_INTERVAL_MS * (1 + consecutiveEmpty))`
- `SessionStore.start()`: Use `setTimeout` recursion instead of `setInterval` to support dynamic intervals

### 11. Splice-to-Swap-and-Pop for Particle Arrays (CPU)

**Type:** MODIFY
**Files:** `src/renderer/ambient-particles.ts`, `src/renderer/building.ts`
**Current behavior:** Both `AmbientParticles` and `Building` use `Array.splice(i, 1)` to remove expired particles from arrays. Splice is O(n) because it shifts all subsequent elements.

**Optimization:** Replace with swap-and-pop: copy the last element to position `i`, then `array.pop()`. O(1) removal. Particle order does not matter for rendering.

**Integration points:**
- `ambient-particles.ts`: Line 253 `this.sparkParticles.splice(i, 1)` --> swap-and-pop
- `building.ts`: Line 416 `this.smokeParticles.splice(i, 1)` --> swap-and-pop

### 12. DOM Diffing for Dashboard Panel (CPU -- Renderer)

**Type:** MODIFY
**Files:** `src/renderer/dashboard-panel.ts`
**Current behavior:** `renderSessions()` (line 90) clears `this.sessionList.innerHTML = ''` and rebuilds all DOM elements from scratch on every dashboard update. `renderTotals()` (line 81) sets `innerHTML` on every update even if values haven't changed.

**Optimization:** Diff against the previous state. Only update DOM elements that have actually changed. Reuse existing DOM nodes.

**Integration points:**
- `DashboardPanel`: Add `private lastTotalsHtml: string` and `private lastSessionIds: string[]` for change detection
- `renderTotals()`: Compare new HTML string to cached. Only assign `innerHTML` if different.
- `renderSessions()`: Track existing session row elements by sessionId. Update in-place when possible. Only create/remove rows for added/removed sessions.

## Suggested Build Order

The optimizations have dependencies and varying risk levels. The build order balances: (1) highest impact first, (2) dependencies respected, (3) lower risk before higher risk.

### Phase 1: I/O Pipeline (Main Process) -- Do First

**Rationale:** Main process optimizations are isolated from the renderer. No visual risk. Unblock the event loop before touching GPU code.

| Order | Optimization | Why This Order |
|-------|-------------|----------------|
| 1.1 | Combined JSONL read (#5) | Foundation for #6. Reduces syscalls 50%. Zero risk to visuals. |
| 1.2 | Async file I/O (#6) | Depends on #5 (convert combined read to async). Unblocks main process event loop. |
| 1.3 | Incremental usage parsing (#7) | Independent. Biggest I/O win for large JSONL files. |
| 1.4 | Poll backoff (#10) | Independent. Quick win. Reduces idle I/O to near zero. |

### Phase 2: GPU/Render Pipeline -- Highest Visual Impact

**Rationale:** The ColorMatrixFilter removal is the single highest-impact optimization (doubles GPU throughput). Day/night caching builds on it.

| Order | Optimization | Why This Order |
|-------|-------------|----------------|
| 2.1 | Remove stage ColorMatrixFilter (#1) | Eliminates double render pass. Biggest GPU win. |
| 2.2 | Cache day/night values (#2) | Depends on #1 (works with tint, not filter). Reduces per-tick math. |
| 2.3 | Night glow guards (#3) | Independent. Quick win after #2 gives us cached intensity. |

### Phase 3: CPU Tick Loop Micro-Optimizations

**Rationale:** These reduce per-tick CPU work in the renderer. Lower individual impact but cumulative benefit.

| Order | Optimization | Why This Order |
|-------|-------------|----------------|
| 3.1 | Building highlight caching (#8) | Quick dirty-flag pattern. Eliminates per-tick agent iteration. |
| 3.2 | Particle throttling at idle (#4) | Reduces idle CPU by ~50% for particle updates. |
| 3.3 | Splice-to-swap-and-pop (#11) | One-line changes. O(n) to O(1) removal. |
| 3.4 | DOM diffing for dashboard (#12) | Eliminates unnecessary DOM thrashing. |

### Phase 4: Structural Refactor -- Do Last

**Rationale:** High line-count change that touches all agent tracking code. Do after all other optimizations are stable to avoid merge conflicts.

| Order | Optimization | Why This Order |
|-------|-------------|----------------|
| 4.1 | Per-agent state consolidation (#9) | Touches 13+ Maps and dozens of access sites. Must be last. |

## Component Boundaries

| Component | Responsibility | Optimizations Touching It |
|-----------|---------------|--------------------------|
| `SessionStore` | Poll orchestration, IPC push | #10 (poll backoff) |
| `FilesystemSessionDetector` | Filesystem scanning, session status | #5 (combined read), #6 (async) |
| `UsageAggregator` | Token/cost accumulation | #7 (incremental parsing) |
| `jsonl-reader.ts` | Low-level JSONL file I/O | #5 (combined read), #6 (async), #7 (incremental) |
| `World` | Scene orchestration, tick loop | #1 (filter removal), #2 (caching), #3 (glow guards), #4 (particle throttle), #8 (highlight cache), #9 (state consolidation) |
| `DayNightCycle` | Time-of-day computation | #1 (add getTintHex), #2 (caching) |
| `night-glow-layer.ts` | Glow sprite alpha updates | #3 (threshold guard) |
| `AmbientParticles` | Firefly/spark/dust/leaf simulation | #4 (idle throttle), #11 (swap-and-pop) |
| `Building` | Smoke particles, station management | #11 (swap-and-pop) |
| `DashboardPanel` | DOM rendering of session data | #12 (DOM diffing) |
| `constants.ts` | Shared constants | #10 (dynamic poll interval) |

## Data Flow Changes Summary

### Main Process Pipeline (Before)

```
SessionStore.poll()
    |
    v  sync
FilesystemSessionDetector.discoverSessions()
    |  sync                          |  sync
    v                                v
readdirSync(projects)          per file:
    |                              statSync()
    v                              readLastJsonlLine()  <-- separate open
readdirSync(dir)                   readLastToolUse()    <-- separate open (same file!)
    |
    v
merge with session map
    |  async
    v
UsageAggregator.getUsageWithCost()
    |  if mtime changed
    v
readUsageTotals()  <-- full file re-stream
    |
    v
IPC push to renderer
```

### Main Process Pipeline (After)

```
SessionStore.poll()  [dynamic interval: 3s active, up to 30s empty]
    |
    v  async
FilesystemSessionDetector.discoverSessions()
    |  async                         |  async
    v                                v
fs.promises.readdir(projects)  per file:
    |                              fs.promises.stat()
    v                              readSessionTail()  <-- SINGLE open, combined parse
fs.promises.readdir(dir)
    |
    v
merge with session map
    |  async
    v
UsageAggregator.getUsageWithCost()
    |  if mtime changed
    v
readUsageTotalsIncremental(offset)  <-- parse only NEW bytes
    |
    v
IPC push to renderer
```

### Renderer Tick Loop (Before)

```
World.tick(deltaMs)
    |
    v
DayNightCycle.tick()  --> sin()/pow() every tick
    |
    v
stageFilter.matrix = [new array]  --> GPU uniform upload every tick
                                      (+ double render pass from stage filter)
    |
    v
updateNightGlowLayer()  --> 19+ alpha writes every tick
    |
    v
[agents, buildings, particles, speech bubbles, highlights]
    |
    v
building highlights --> iterate ALL agents every tick
```

### Renderer Tick Loop (After)

```
World.tick(deltaMs)
    |
    v
DayNightCycle.tick()  --> cached: recompute only when threshold exceeded
    |
    v
if tintHex changed:
    container.tint = newTint  --> vertex color, NO extra render pass
    |
    v
if nightIntensity changed (> 0.005):
    updateNightGlowLayer()  --> 19+ alpha writes (only when needed)
    |
    v
[agents, buildings, particles, speech bubbles]
    |
    v
if highlightsDirty:
    recompute active buildings --> only on state change, not every tick
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Premature Abstraction of the Optimization Layer

**What people do:** Create a generic "optimization framework" with dirty-flag systems, change observers, and caching abstractions before implementing any specific optimization.
**Why it is wrong:** Adds indirection and complexity. Each optimization has different caching semantics (tint hex vs. night intensity threshold vs. mtime bytes). A generic system adds overhead without benefit.
**Do this instead:** Apply each optimization directly in the component that needs it. Use simple `if (value !== cached)` checks inline. Only abstract if 3+ optimizations share identical patterns.

### Anti-Pattern 2: Async Everything in the Session Detector

**What people do:** Convert every sync call to async, including cheap operations like `UUID_JSONL_REGEX.test(entry.name)`.
**Why it is wrong:** Async has overhead (microtask queue, promise allocation). Only I/O-bound operations (`stat`, `read`, `readdir`) benefit from async. CPU-bound operations (regex, string parsing, JSON.parse) should remain synchronous within the async flow.
**Do this instead:** Make the outer loop async (`for await` over directory entries), but keep parsing logic synchronous within each iteration.

### Anti-Pattern 3: Over-Throttling Day/Night Updates

**What people do:** Cache day/night values with a 1-second threshold to minimize recomputes.
**Why it is wrong:** A 1-second threshold at 30fps means 30 frames with the same tint value, then a visible jump. The day/night cycle is a 10-minute smooth sine wave -- jumps are noticeable.
**Do this instead:** Use a threshold of ~50-100ms (1-3 frames). This still eliminates 66-96% of recomputes while keeping transitions visually smooth.

### Anti-Pattern 4: Moving Particles to a Web Worker

**What people do:** Try to offscreen particle computation to a Web Worker for "real parallelism."
**Why it is wrong:** The bottleneck is not computation (54 particles is trivial) -- it is the PixiJS property assignments (`gfx.x`, `gfx.y`, `gfx.alpha`) which must happen on the main thread. Transferring position data via `postMessage` adds latency and complexity that exceeds the computation cost.
**Do this instead:** Keep particles on the main thread. Throttle at idle FPS. The CPU cost at 5fps idle is already negligible.

## Scaling Considerations

| Concern | 1-4 sessions | 5-10 sessions | 20+ sessions |
|---------|-------------|---------------|-------------|
| JSONL reads per poll | 2-8 file opens (current: 4-16) | 10-20 file opens | Out of scope (building limit is 4) |
| Tick loop CPU | ~0.5ms per tick | ~1ms per tick | N/A (max 4 buildings) |
| Incremental parse | Negligible benefit (small files) | Significant: 10MB files parse only last few KB | N/A |
| Poll backoff | Rarely triggers (usually sessions exist) | Never triggers | N/A |

The app's architecture naturally bounds scaling at 4 active buildings + campfire. Performance optimizations primarily matter for the steady-state case (1-4 sessions, always-on for hours).

## Sources

- [PixiJS 8 Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) -- Official guidance on filters, caching, and render optimization
- [PixiJS Issue #2288 -- Stage filter halves framerate](https://github.com/pixijs/pixijs/issues/2288) -- Confirmed: any filter on stage doubles render passes
- [PixiJS 8 Container.tint documentation](https://pixijs.download/dev/docs/scene.Container.html) -- Tint is inherited by children in v8
- [PixiJS Discussion #7765 -- How to tint Container](https://github.com/pixijs/pixijs/discussions/7765) -- Container tint as replacement for ColorMatrixFilter
- [PixiJS 8 Filters Guide](https://pixijs.com/8.x/guides/components/filters) -- Filters add framebuffer + shader pass
- [PixiJS Cache As Texture](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture) -- Alternative to filters for static content
- [Node.js fs.promises API](https://nodejs.org/api/fs.html) -- Async filesystem operations
- [Node.js Stream Cleanup](https://nodejs.org/api/stream.html) -- Proper stream destruction patterns
- Direct source code analysis of all 30+ files in Agent World `src/` directory

---
*Architecture research for: Agent World v2.2 Performance Optimization*
*Researched: 2026-03-18*

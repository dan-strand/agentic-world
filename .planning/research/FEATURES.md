# Feature Research

**Domain:** Stability hardening for long-running Electron + PixiJS desktop application
**Researched:** 2026-03-16
**Confidence:** HIGH

## Context

This is v2.1 milestone research for the Agent World project. The app runs as an always-on desktop visualizer and suffers from a silent crash after hours of continuous operation. The existing codebase has zero crash detection, zero crash recovery, zero memory monitoring, and several patterns that create unbounded resource growth over time. This research catalogs what features are needed to diagnose the crash, prevent future ones, and harden the codebase.

**Existing stability-relevant patterns (already built):**
- Adaptive frame rate (30fps active / 5fps idle / stopped when minimized)
- Comprehensive agent removal cleanup (13 tracking Maps cleaned)
- Mtime-based caching to avoid redundant JSONL re-parsing
- Alpha safeguard warning for invisible agents
- Smoke/spark particle destroy() on expiry

**What is missing (found via code review):**
- No `process.on('uncaughtException')` or `process.on('unhandledRejection')` anywhere
- No `webContents.on('render-process-gone')` handler
- No `window.onerror` or `window.onunhandledrejection` in renderer
- No memory usage logging of any kind
- No try/catch around the ticker callback (one throw kills the world permanently)
- Several Maps/Sets that grow unboundedly over long sessions
- DayNightCycle elapsed counter loses precision after ~25 days

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for a long-running always-on desktop app to be considered stable. Without these, the app silently dies after hours of use and the user has no idea why.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Crash event handlers (main + renderer) | Electron provides `render-process-gone`, `uncaughtException`, `unhandledRejection` -- not using them means crashes are invisible. Currently zero crash handlers exist in the entire codebase. | LOW | Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` in main process, `window.onerror` and `window.onunhandledrejection` in renderer, and `webContents.on('render-process-gone')` in main. Log crash reason, stack trace, and memory state. |
| Renderer crash recovery | When renderer process dies (OOM, GPU crash, unhandled exception), main process must detect it and reload the window automatically instead of showing a blank white screen | LOW | Use `render-process-gone` event to call `win.webContents.reload()` after a 1-second delay. Track crash count to avoid infinite reload loops (max 3 in 5 minutes). |
| Error boundary for tick() | If `world.tick()` throws, the PixiJS ticker callback crashes silently and never runs again. The world freezes with no error visible to the user. | LOW | Wrap the ticker callback in `game-loop.ts` with try/catch. Log the error, increment a counter, skip the frame, and let the next tick attempt recovery. After N consecutive failures, stop the ticker and show an error state. |
| Memory usage logging | Without any visibility into heap size, texture count, or GPU memory, leaks are invisible until the OOM crash happens. The "dies after hours" report has zero diagnostic data. | LOW | Every 60 seconds, log `process.memoryUsage()` in main process. In renderer, log `performance.memory.usedJSHeapSize` via IPC or in a console.log. Include agent count and particle count for context. |
| PixiJS Graphics resource cleanup audit | Every spark, smoke puff, and celebration effect creates `new Graphics()` objects. If `destroy()` is not called, GPU buffers leak. Building smoke creates ~20-32 Graphics objects every 3 seconds across 4 buildings. | MEDIUM | Audit all `new Graphics()` creation sites. Current status: smoke (building.ts) and sparks (ambient-particles.ts) both call `gfx.destroy()` on removal -- good. LevelUpEffect sparkles (level-up-effect.ts:137-139) are set to `visible = false` when expired but never individually destroyed. Parent `destroy({ children: true })` handles this when celebration ends, but only if the celebration completes normally. |
| Unbounded collection pruning | `dismissedSessions` Set, `mtimeCache` Map, `cwdCache` Map, and `usageAggregator.cache` Map all grow forever. After days of running with many sessions, hundreds of stale entries accumulate. | LOW | Cap `dismissedSessions` at 100 entries. Prune `mtimeCache`/`cwdCache` entries whose sessionIds no longer appear in discovered sessions. Call `usageAggregator.clearSession()` when sessions are removed from the store. |
| DayNightCycle elapsed precision fix | `this.elapsed` is a monotonically increasing number (ms). After ~24.8 days of continuous operation, it exceeds `Number.MAX_SAFE_INTEGER` and loses floating-point precision. The modulo in `getProgress()` handles wrapping but precision degrades for very large values. | LOW | Periodically reset `elapsed` to `elapsed % DAY_NIGHT_CYCLE_MS` (every cycle completion). Zero-cost fix that prevents precision drift. |
| Stream cleanup in JSONL reader | `readUsageTotals()` uses `fs.createReadStream` + `readline`. If the stream errors mid-read, the ReadStream may not be properly closed, leaking file handles over time. | LOW | Explicitly call `stream.destroy()` in the catch block. Or switch to `pipeline()` from `node:stream/promises` which handles cleanup automatically. |

### Differentiators (Beyond Basic Stability)

Features that go beyond "does not crash" into "actively monitors and reports health." Not expected from a personal tool, but valuable for diagnosing the specific silent crash issue and preventing regressions.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Structured crash log file | When the app crashes, write the last known state (heap size, agent count, uptime, last error) to `~/.agent-world/crash-log.json` so post-mortem diagnosis is possible even without DevTools open | MEDIUM | Write on `render-process-gone`, `uncaughtException`, and `before-quit`. Include timestamp, uptime, memory snapshot, session count, and last 10 console errors. Read and display on next startup. |
| PixiJS texture/GPU resource counter | Periodically count active textures, Graphics objects, and containers in the scene graph. Log warnings when counts exceed thresholds. | MEDIUM | PixiJS 8 exposes texture count via the GC system. Traverse scene graph to count Graphics children. Alert when spark/smoke particle counts exceed their caps. Helps pinpoint which subsystem is leaking. |
| Health heartbeat (main pings renderer) | Main process sends a ping IPC every 30s. If renderer does not respond within 5s, it is frozen (not crashed). Log and optionally force-reload. | MEDIUM | Detects hangs that `render-process-gone` does not catch (e.g., GPU stalls, infinite loops in tick(), WebGL context loss). More relevant if the crash turns out to be a freeze, not a termination. |
| Uptime display in dashboard | Show how long the app has been running in the dashboard footer. Makes the "dies after 4 hours" problem quantifiable and lets the user see when recovery reloads happen. | LOW | Simple `Date.now() - startTime` formatted as hours/minutes. Resets on renderer reload (which indicates a crash recovery). |
| Crash count display on startup | On app launch, read last crash log and display "Recovered from crash X minutes ago" in the dashboard or console so the user knows something happened. | LOW | Depends on crash log file existing. Simple read + display. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem useful for stability but create more problems than they solve in this context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automatic periodic forced GC (`global.gc()`) | "Force garbage collection to prevent memory leaks" | Forced GC causes 10-50ms frame stutters visible as animation jank. PixiJS 8 already runs its own texture GC every 600 frames. V8 has its own generational GC that runs during idle time. Forcing GC masks the real leak source rather than fixing it. | Fix the actual leak sources. Let V8 and PixiJS GC systems work naturally. Add monitoring to detect when they are insufficient. |
| Full scene graph rebuild on a timer | "Rebuild the world every hour to clear leaked resources" | Destroys all state: agent positions, celebration progress, building assignments, day/night cycle position. Causes a visible multi-second disruption. Does not fix the root cause. | Incremental resource cleanup: destroy particles on expiry, prune tracking Maps of stale entries, monitor texture count. |
| Kill renderer on memory threshold | "Use `forcefullyCrashRenderer()` when heap exceeds 500MB" | Loses all visual state abruptly. Aggressive threshold may kill during legitimate peak usage (many sessions + celebrations + large JSONL files). OOM is a symptom, not a cause. | Log a warning at threshold. Let the crash recovery system handle actual OOM events naturally via `render-process-gone` with reason `oom`. |
| Move rendering to OffscreenCanvas / Web Worker | "Isolate rendering from main thread for crash resilience" | PixiJS 8 does not support OffscreenCanvas rendering. Would require a complete architecture rewrite. Electron already isolates rendering in a separate process from main. | Keep current architecture. Fix the specific leak sources instead. |
| Sentry / BugSplat crash reporting service | "Cloud-based crash reporting for professional monitoring" | Requires account, internet access, privacy implications. User is the only user of this tool -- they can read a local crash log. The app is explicitly local-only per PROJECT.md constraints. | Write crash data to `~/.agent-world/crash-log.json`. Print last crash summary on next startup. |
| Winston / Bunyan structured logging library | "Professional logging framework for better diagnostics" | Adds an external dependency for something `console.log` with `[module]` prefixes already handles adequately. Structured logging matters for distributed systems with log aggregation, not for a single local desktop app. | Use existing `console.log('[module]')` pattern. Write structured data to crash-log.json only on crash events. |
| Memory trend chart in dashboard | "Show heap usage over time as a sparkline" | HIGH complexity for LOW immediate value. Requires periodic sampling, IPC to renderer, chart rendering, and state management for historical data points. Over-engineered for diagnosing a single crash bug. | Log memory to console every 60s. Pipe DevTools to a file for post-mortem analysis. Revisit if ongoing monitoring is needed after the crash is fixed. |

## Feature Dependencies

```
[Crash Event Handlers]
    |-- enables --> [Renderer Crash Recovery]
    |-- enables --> [Structured Crash Log File]
    |-- enables --> [Crash Count Display]
    '-- enables --> [Health Heartbeat]

[Memory Usage Logging]
    |-- enables --> [Uptime Display]
    '-- enhances --> [Structured Crash Log File]

[PixiJS Resource Cleanup Audit]
    |-- benefits-from --> [PixiJS Texture/GPU Resource Counter]
    '-- independent-of --> [Crash Event Handlers]

[Error Boundary for tick()]
    '-- independent (no dependencies, can be done first)

[Unbounded Collection Pruning]
    '-- independent (no dependencies, can be done in parallel)

[DayNightCycle Precision Fix]
    '-- independent (no dependencies, trivial fix)

[Stream Cleanup]
    '-- independent (no dependencies)
```

### Dependency Notes

- **Crash Event Handlers enable everything else:** You cannot recover from renderer crashes, write crash logs, or detect hangs if you do not detect crashes in the first place. The handlers must exist before any recovery or diagnostic feature can work.
- **Memory Logging enhances Crash Log:** If memory is being logged periodically, the crash log can include the last known memory state, making post-mortem diagnosis much more effective ("heap was at 1.2GB when crash occurred" vs "crash occurred").
- **Resource Cleanup Audit is independent of crash handling:** Fixing leaks directly reduces crash frequency regardless of whether crash handlers exist. Can be done in parallel.
- **Error boundary for tick() has zero dependencies:** Wrapping one line in try/catch. Can be the very first thing implemented.

## MVP Definition

### Phase 1: Crash Diagnosis Infrastructure (Implement First)

The minimum required to diagnose the silent crash and prevent invisible failures.

- [ ] **Error boundary for tick()** -- Wrap the game loop ticker callback in try/catch. One line of code in game-loop.ts. Prevents a single bad tick from killing animation permanently.
- [ ] **Crash event handlers** -- `process.on('uncaughtException')`, `process.on('unhandledRejection')` in main; `window.onerror` + `window.onunhandledrejection` in renderer; `webContents.on('render-process-gone')` in main.
- [ ] **Renderer crash recovery** -- On `render-process-gone`, log the crash reason, wait 1 second, reload. Track crash count; stop reloading after 3 in 5 minutes.
- [ ] **Memory usage logging** -- Every 60 seconds, log `process.memoryUsage()` in main and `performance.memory` in renderer. Include agent count and uptime.

### Phase 2: Resource Leak Fixes (Fix Root Causes)

Fix the specific leak sources that likely cause the crash.

- [ ] **PixiJS resource audit** -- Walk every `new Graphics()` call site: ambient-particles.ts sparks, building.ts smoke, level-up-effect.ts sparkles, night-glow-layer.ts glows. Verify destroy() on removal.
- [ ] **Unbounded collection pruning** -- Cap `dismissedSessions`. Prune `mtimeCache`/`cwdCache` of stale session IDs. Wire `usageAggregator.clearSession()` to session removal.
- [ ] **DayNightCycle elapsed overflow** -- Reset `elapsed` to `elapsed % DAY_NIGHT_CYCLE_MS` periodically.
- [ ] **Stream cleanup hardening** -- Ensure `readUsageTotals()` stream is destroyed on error.
- [ ] **Palette-swap cache review** -- Verify GPU texture impact of the module-level swapCache. Document that it is bounded (max ~400 entries) or add cleanup.

### Phase 3: Observability (After Crash Is Fixed)

Features to add once stability is confirmed, for ongoing health monitoring.

- [ ] **Structured crash log file** -- Write crash context to `~/.agent-world/crash-log.json`.
- [ ] **Crash count display** -- Show recovery info on startup.
- [ ] **PixiJS resource counter** -- Periodic scene graph traversal.
- [ ] **Uptime display** -- Hours/minutes in dashboard footer.
- [ ] **Health heartbeat** -- Main-to-renderer ping to detect freezes.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Error boundary for tick() | HIGH | LOW | P1 |
| Crash event handlers (main + renderer) | HIGH | LOW | P1 |
| Renderer crash recovery (auto-reload) | HIGH | LOW | P1 |
| Memory usage logging (periodic) | HIGH | LOW | P1 |
| PixiJS resource audit + destroy fixes | HIGH | MEDIUM | P1 |
| Unbounded collection pruning | MEDIUM | LOW | P1 |
| DayNightCycle elapsed overflow fix | MEDIUM | LOW | P1 |
| Stream cleanup hardening | MEDIUM | LOW | P2 |
| Palette-swap cache review | MEDIUM | LOW | P2 |
| Dashboard DOM event listener audit | LOW | LOW | P2 |
| Structured crash log file | MEDIUM | MEDIUM | P2 |
| Crash count display on startup | LOW | LOW | P3 |
| PixiJS resource counter | MEDIUM | MEDIUM | P3 |
| Health heartbeat | LOW | MEDIUM | P3 |
| Uptime display | LOW | LOW | P3 |

**Priority key:**
- P1: Must have -- directly addresses the silent crash problem or prevents known leak vectors
- P2: Should have -- prevents future stability issues and aids diagnosis
- P3: Nice to have -- observability features for ongoing monitoring after the crash is fixed

## Codebase-Specific Findings

### Identified Leak Risks (from code review)

1. **`dismissedSessions: Set<string>`** (world.ts:106) -- Grows unboundedly. Entries added on agent removal (line 499) but only deleted on non-idle reactivation (line 522). Over days of running with many sessions starting/stopping, this accumulates hundreds of stale UUIDs. Memory impact: minor (strings only), but unbounded growth is a code smell.

2. **LevelUpEffect sparkle particles** (level-up-effect.ts:137-139) -- Sparkles set to `visible = false` when lifetime expires but never individually destroyed. The parent `destroy({ children: true })` in agent.ts:400-403 handles cleanup when celebration ends normally. Risk: if the celebration is interrupted (e.g., session disappears mid-celebration, agent transitions to fading_out from celebrating state), the agent's `startFadeOut()` at line 397-406 does destroy the LevelUpEffect. This path looks safe.

3. **Smoke particles: continuous create/destroy cycle** (building.ts:354-404) -- Creates `new Graphics()` on every spawn, calls `gfx.destroy()` on expiry. This is correct, but creates/destroys ~20-32 Graphics objects across 4 buildings every 3 seconds. Over 4 hours: ~96,000 create/destroy cycles. PixiJS 8.16.0 includes fixes for Graphics destruction memory leaks (PRs #11581, #11753) that affected earlier 8.x versions. Need to verify that 8.16.0 handles this volume without accumulating GPU buffers.

4. **Spark particles: same create/destroy pattern** (ambient-particles.ts:211-242) -- Up to 8 concurrent sparks with 600ms spawn interval. Lower volume than smoke but same pattern.

5. **`swapCache` in palette-swap.ts** (line 11) -- Module-level `Map<string, Texture[]>` that caches palette-swapped textures forever. Bounded by combinatorics: max ~400 entries (25 palettes x 4 classes x 4 anim states). Each entry is a `Texture[]` backed by offscreen canvas `ImageSource`. GPU textures from these canvases are subject to PixiJS auto-GC after 3600 idle frames, but the JavaScript references in the cache prevent the textures from ever becoming idle. This means the GC will never reclaim them. For 400 entries with ~4 frames each, this is ~1600 textures pinned in GPU memory forever.

6. **DayNightCycle `elapsed` counter** (day-night-cycle.ts:26) -- Monotonically increasing. After 24 hours at 30fps, `elapsed` reaches ~2.6 billion ms. After ~24.8 days, exceeds `Number.MAX_SAFE_INTEGER`. The modulo in `getProgress()` still works but floating-point precision for the division degrades, causing subtle visual glitches in the day/night cycle. Trivial fix: periodically reset.

7. **`mtimeCache` and `cwdCache` in session-detector.ts** -- Grow with each new session UUID encountered. Never pruned. After weeks of running, hundreds of entries for sessions that no longer exist.

8. **`usageAggregator.cache`** (usage-aggregator.ts:11) -- Same pattern. Caches token totals per sessionId forever. The `clearSession()` method exists but is never called anywhere in the codebase.

9. **ColorMatrixFilter matrix reassignment every tick** (world.ts:263-268) -- `this.stageFilter.matrix` is set to a new array literal every single tick. This creates a new `Float32Array` (or plain array) every frame. At 30fps, that is 108,000 allocations per hour. Each is small and quickly GC'd, but the GC pressure is unnecessary. Could assign to the existing matrix indices instead of replacing the array.

### Patterns That Are Already Good

- **Agent removal cleanup** (world.ts:459-500) -- Comprehensive: cleans all 13 tracking Maps/Sets, destroys PixiJS children, releases factory slot, adds to dismissedSessions. Best cleanup code in the codebase.
- **Adaptive frame rate** (game-loop.ts) -- 30fps when active, 5fps when idle, stopped when minimized. Excellent for always-on CPU management.
- **Mtime caching** -- Both session-detector and usage-aggregator skip re-parsing unchanged files. Critical for avoiding I/O pressure on every 3-second poll.
- **Ticker stopping on minimize** -- `document.addEventListener('visibilitychange')` stops the ticker entirely when window is hidden.
- **Alpha safeguard** (world.ts:370-374) -- Detects and force-fixes agents with alpha < 0.4 in non-fading states. Prevents invisible agent bugs.
- **Deferred agent removal** (world.ts:377-386) -- Collect-then-remove pattern avoids mutating the agents Map during iteration.
- **File handle cleanup in JSONL reader** (jsonl-reader.ts:68-76) -- `readLastJsonlLine()` uses try/finally with explicit `fs.closeSync(fd)`. Proper pattern for synchronous file reads.
- **Atomic JSON writes** (history-store.ts:56-83) -- tmp+rename with Windows EPERM/EBUSY fallback. Prevents data corruption on crash.

## Sources

- [PixiJS 8 Garbage Collection Guide](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- AUTO GC config, destroy() best practices, texture idle threshold
- [PixiJS Graphics Memory Leak in v8 (issue #10586)](https://github.com/pixijs/pixijs/issues/10586) -- Graphics destruction leak in early v8
- [PixiJS Graphics Memory Leak Regression (issue #11550)](https://github.com/pixijs/pixijs/issues/11550) -- WebGLBuffer accumulation in v8.11+, fixed in PRs #11581 and #11753
- [PixiJS FillGradient Leak (issue #10936)](https://github.com/pixijs/pixijs/issues/10936) -- Texture-per-frame leak, fixed in PR #11061 (Nov 2024)
- [PixiJS Redrawing Graphics Leak (issue #10549)](https://github.com/pixijs/pixijs/issues/10549) -- 10MB/s memory growth from clear+redraw pattern
- [PixiJS 8.16.0 Release Notes](https://pixijs.com/blog/8.16.0) -- Released Feb 4, 2026; includes memory leak fixes from late 2025
- [Electron webContents API (render-process-gone, unresponsive)](https://www.electronjs.org/docs/latest/api/web-contents) -- Crash detection and recovery events
- [Electron crashReporter API](https://www.electronjs.org/docs/latest/api/crash-reporter) -- Native crash reporting (Breakpad/Crashpad)
- [Electron Process API (memoryUsage, getHeapStatistics)](https://www.electronjs.org/docs/latest/api/process) -- Memory monitoring APIs
- [Electron render-process-gone after hours (issue #7604)](https://github.com/electron/electron/issues/7604) -- Long-running crash reports
- [Electron render-process-gone OOM reason bug (issue #40426)](https://github.com/electron/electron/issues/40426) -- OOM sometimes reported as "crashed"
- [electron-unhandled library](https://github.com/sindresorhus/electron-unhandled) -- Reference for unhandled error patterns
- [Debugging Electron Memory Usage](https://seenaburns.com/debugging-electron-memory-usage/) -- process.memoryUsage() vs performance.memory
- [Node.js Stream API (pipeline, destroy)](https://nodejs.org/api/stream.html) -- Proper stream cleanup patterns
- Direct codebase analysis of all 30 source files in `src/`

---
*Feature research for: v2.1 Hardening and Crash Diagnosis milestone*
*Researched: 2026-03-16*

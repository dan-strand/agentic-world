# Project Research Summary

**Project:** Agent World v2.1 -- Hardening & Crash Diagnosis
**Domain:** Electron + PixiJS always-on desktop app stability
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

Agent World is a long-running Electron 40.6.1 + PixiJS 8.16.0 desktop visualizer that suffers from a silent crash after hours of continuous operation. The codebase has zero crash detection, zero crash recovery, zero memory monitoring, and several resource management patterns that cause unbounded growth over time. Research across stack, features, architecture, and pitfalls converges on a clear diagnosis: the crash is almost certainly caused by GPU/native memory exhaustion from palette-swapped texture accumulation, continuous Graphics object create/destroy churn in particle systems, and un-destroyed GlowFilter GPU resources -- none of which would appear in a JavaScript heap snapshot. The app has no error handlers of any kind, so these crashes are completely invisible.

The recommended approach is a three-phase hardening milestone. Phase 1 instruments the app with crash telemetry and memory monitoring (using only 2 new npm dependencies plus Electron built-in APIs) so the actual crash cause can be confirmed. Phase 2 fixes the identified leak sources: object pooling for particle Graphics, palette swap cache lifecycle management, filter cleanup, unbounded collection pruning, and timer overflow fixes. Phase 3 runs soak tests to verify all leaks are eliminated and adds optional observability features. This order is critical -- fixing leaks without instrumentation means you cannot verify they are fixed, and fixing the wrong leak first wastes effort (the "whack-a-mole" pitfall).

The key risk is misdiagnosing the crash by looking only at JavaScript heap metrics while the actual leak is in GPU memory, native memory, or file descriptors. The health monitoring system must track all four dimensions simultaneously. A secondary risk is that PixiJS 8.16.0's Graphics destruction, while improved from earlier 8.x versions, may still have residual issues at the volume of create/destroy cycles this app generates (~3,360/hour for smoke particles alone). Object pooling eliminates this risk entirely by removing the create/destroy cycle.

---

## Key Findings

### Recommended Stack

Only two new npm dependencies are needed. Everything else uses Electron built-in APIs and existing PixiJS 8.16.0 features that are already available in the installed version. The stack additions are minimal and targeted.

**Core technologies:**
- `electron-log` (^5.4): Persistent file logging across main + renderer processes -- auto-catches critical Electron events, provides IPC-based renderer-to-main log transport with 5MB file rotation
- `electron-unhandled` (^5.0.0): Catches uncaughtException + unhandledRejection in both processes -- prevents the most common cause of silent exits (unhandled promise rejections)
- Electron built-in `crashReporter`: Local crash dump collection via Crashpad without needing a remote server -- must be called before `app.on('ready')`
- Electron built-in memory APIs: `process.getHeapStatistics()`, `process.getProcessMemoryInfo()`, `process.getBlinkMemoryInfo()`, `app.getAppMetrics()` -- covers V8 heap, native memory, Blink/DOM, and per-process metrics
- PixiJS 8.16.0 unified `GCSystem`: Already installed but unconfigured -- needs `gcActive`, `gcMaxUnusedTime` (30s), `gcFrequency` (15s) tuned for a long-running 5-30fps app rather than the 60fps defaults

**What NOT to add:** Sentry/BugSplat (cloud crash reporting for a local-only app), Winston/Bunyan (overengineered for this use case), node-memwatch/heapdump (native addon complications with Electron), APM tools (enterprise monitoring for a personal tool), forced GC calls (masks root causes and causes animation jank).

### Expected Features

**Must have (table stakes for a long-running always-on app):**
- Crash event handlers in both main and renderer processes (currently zero exist)
- Renderer crash recovery with auto-reload (max 3 reloads in 5 minutes to prevent infinite loops)
- Error boundary wrapping the ticker callback (one throw currently kills the world permanently)
- Periodic memory usage logging (heap, RSS, GPU process, agent count, uptime)
- PixiJS Graphics resource cleanup audit across all particle systems
- Unbounded collection pruning (dismissedSessions, mtimeCache, cwdCache, usageAggregator.cache)
- DayNightCycle elapsed counter overflow fix
- Stream cleanup hardening in JSONL reader

**Should have (beyond basic stability):**
- Structured crash log file written on crash for post-mortem diagnosis
- PixiJS texture/GPU resource counter with threshold warnings
- Health heartbeat (main pings renderer to detect freezes vs crashes)
- Uptime display in dashboard footer
- Crash recovery notification on next startup

**Defer (after crash is fixed):**
- Memory trend chart in dashboard (HIGH complexity, LOW immediate value)
- Full scene graph rebuild timer (destroys state, masks root causes)
- OffscreenCanvas/Web Worker rendering (PixiJS 8 does not support it)

### Architecture Approach

The existing architecture is sound -- Electron main process handles session detection and IPC, renderer process manages the PixiJS scene graph with adaptive frame rates. The hardening work adds a thin diagnostic layer on top without restructuring. Four new components are needed: HealthMonitor (main process periodic sampling), CrashGuard (render-process-gone handler with auto-restart), ResourcePool (generic Graphics object pool for particles), and a cleanup sweep integrated into World.tick(). All existing components that create/destroy Graphics need refactoring to use the pool pattern instead.

**Major components to add:**
1. `HealthMonitor` (src/main/health-monitor.ts) -- 60-second sampling of V8 heap, process memory, per-process metrics; logs every 5 minutes or immediately at warning thresholds (512MB heap warning, 1024MB critical)
2. `CrashGuard` (integrated into src/main/index.ts) -- `render-process-gone` handler that logs crash reason, delays 1 second, reloads renderer; crash count tracking prevents infinite reload loops
3. `ResourcePool<Graphics>` (src/renderer/resource-pool.ts) -- Pre-allocated pool of Graphics objects for smoke and spark particles; borrow/return instead of create/destroy eliminates GPU allocation churn
4. Cleanup sweep (integrated into src/renderer/world.ts) -- Every 5 minutes prune dismissedSessions, stale cache entries; call existing but never-invoked `usageAggregator.clearSession()`

**Major components to modify:**
- `Building.tick()` and `AmbientParticles.tick()` -- Pool smoke/spark Graphics instead of create/destroy
- `palette-swap.ts` -- Add lifecycle management (destroy textures when agents are removed; LRU eviction or bounded cache)
- `LevelUpEffect` -- Explicitly destroy GlowFilter before container.destroy() (PixiJS does not auto-destroy filters)
- `game-loop.ts` -- Wrap ticker callback in try/catch error boundary
- `jsonl-reader.ts` -- Add `stream.destroy()` in finally block
- `DayNightCycle` -- Bounded accumulator: `elapsed = (elapsed + deltaMs) % DAY_NIGHT_CYCLE_MS`

### Critical Pitfalls

1. **Palette-swapped textures never destroyed** -- The module-level `swapCache` Map grows unboundedly as agents cycle through the system. Each entry holds `Texture[]` backed by offscreen `<canvas>` elements and GPU-uploaded texture data. When `AnimatedSprite.textures` is reassigned, old textures are silently leaked (PixiJS 8 confirmed behavior via issue #11407). Over hours, this exhausts GPU memory and triggers Chromium's silent OOM kill. **Fix:** Track cache keys per session; destroy textures and remove cache entries when agents are removed.

2. **Diagnosing the wrong leak type** -- JavaScript heap snapshots do not show GPU memory, native memory, or file descriptors. A developer can see a stable 40MB JS heap while GPU memory climbs to crash. **Fix:** Build a multi-dimensional health reporter that logs JS heap, RSS, GPU process memory, Blink memory, file handle count, and canvas element count simultaneously.

3. **GlowFilter GPU resources never released** -- Each LevelUpEffect creates a GlowFilter with shader programs and render textures. `Container.destroy({ children: true })` does NOT destroy filters -- this is by PixiJS design. After dozens of celebrations, GPU shader/texture resources accumulate. **Fix:** Explicitly call `filter.destroy()` on all filters before calling `container.destroy()`.

4. **Graphics create/destroy churn in particle systems** -- 4 buildings generating smoke = ~2,880 Graphics create/destroy cycles per hour. Even with PixiJS 8.16.0 leak fixes, this pattern fragments GPU memory over hours. **Fix:** Object pooling -- pre-allocate a fixed pool of Graphics objects, reuse via visibility/position reset.

5. **File descriptor leak from JSONL stream errors** -- `readUsageTotals()` uses `createReadStream` + `readline` without explicit `stream.destroy()` in finally block. Over hours, file descriptor exhaustion causes session detection to silently fail. **Fix:** Add `finally { stream.destroy() }` -- one-line fix.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Crash Diagnosis Infrastructure
**Rationale:** You cannot fix what you cannot see. The app has zero crash handlers, zero memory monitoring, and zero diagnostic output. Every other fix is blind without instrumentation. This phase must come first.
**Delivers:** Crash telemetry, memory health monitoring, error boundaries, renderer auto-recovery
**Addresses:** Crash event handlers, renderer crash recovery, error boundary for tick(), memory usage logging (all P1 table stakes from FEATURES.md)
**Avoids:** Pitfall 6 (silent crashes with no diagnostic trail), Pitfall 8 (diagnosing the wrong leak type)
**Stack:** Install `electron-log` + `electron-unhandled`, configure `crashReporter`, add HealthMonitor + HealthReporter modules, configure PixiJS GCSystem
**Verification:** Deliberately crash renderer; verify crash.log contains reason. Health metrics logged every 60 seconds.

### Phase 2: Resource Leak Fixes
**Rationale:** With instrumentation in place, fix the specific leak sources identified by code review and PixiJS issue tracking. Each fix can be verified against the health metrics baseline established in Phase 1.
**Delivers:** Elimination of all identified memory/GPU/handle leak vectors
**Addresses:** PixiJS resource audit, unbounded collection pruning, DayNightCycle overflow, stream cleanup, palette-swap cache lifecycle (all P1/P2 from FEATURES.md)
**Avoids:** Pitfall 1 (palette swap texture leak), Pitfall 2 (Graphics create/destroy churn), Pitfall 3 (timer precision drift), Pitfall 4 (dismissedSessions growth), Pitfall 5 (file descriptor leak), Pitfall 7 (GlowFilter leak), Pitfall 10 (cache accumulation)
**Stack:** ResourcePool<Graphics> implementation, palette-swap.ts lifecycle management, explicit filter cleanup
**Verification:** 1-hour soak test after each fix; renderer RSS growth must be < 5MB/hour. Trigger 10 celebrations; GPU memory returns to baseline.

### Phase 3: Soak Testing & Observability
**Rationale:** After fixing leaks, verify stability with an 8-hour soak test. If stable, add optional observability features for ongoing monitoring. The soak test is the definition of done for this milestone.
**Delivers:** Confirmed stability, crash log file, optional health dashboard features
**Addresses:** Structured crash log, crash count display, PixiJS resource counter, uptime display, health heartbeat (all P2/P3 from FEATURES.md)
**Avoids:** Pitfall 9 (whack-a-mole -- fixing one leak and missing another)
**Verification:** 8-hour continuous run with < 50MB total renderer process memory growth. All health metrics stable or periodic (no monotonic growth).

### Phase Ordering Rationale

- **Instrumentation before fixes:** Without crash telemetry and memory monitoring, you cannot confirm the crash cause, verify that fixes work, or detect new regressions. Phase 1 creates the diagnostic foundation.
- **Leak fixes grouped together:** All leak fixes in Phase 2 are independent of each other and can be implemented in parallel. However, each should be verified against Phase 1's baseline metrics before moving to the next.
- **Soak test as gate:** Phase 3 begins with a soak test that either confirms Phase 2 was successful or reveals remaining leaks. Only after passing the soak test should observability features be added.
- **Feature dependency chain:** Crash event handlers enable crash recovery, which enables crash log, which enables crash count display. This chain naturally maps to Phase 1 then Phase 3 ordering.
- **Anti-features excluded:** Forced GC, scene graph rebuilds, renderer kill-on-threshold, and cloud crash reporting are explicitly excluded per research consensus.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Graphics object pooling):** The pool must correctly reset all Graphics state (position, alpha, scale, tint, visibility, geometry) on return. PixiJS 8's Graphics API may have state that is not obvious to reset. Test with DevTools WebGL inspector to verify no buffer accumulation.
- **Phase 2 (Palette swap cache lifecycle):** Destroying textures that were created via `new Texture(new ImageSource({ resource: canvas }))` requires `texture.destroy(true)` to also destroy the source. Need to verify this actually releases the canvas element and GPU upload. May need `/gsd:research-phase` during planning.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Crash telemetry):** Electron's crash handling APIs are well-documented with official examples. `electron-log` and `electron-unhandled` have straightforward integration guides.
- **Phase 2 (Unbounded collection pruning):** Standard Map/Set pruning -- no framework-specific concerns.
- **Phase 2 (Timer overflow fix):** One-line modulo fix with zero risk.
- **Phase 2 (Stream cleanup):** Standard Node.js `finally { stream.destroy() }` pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 2 new dependencies, both well-maintained with high download counts. All other APIs are Electron/PixiJS built-ins verified against official docs. |
| Features | HIGH | Feature list derived from direct codebase audit of all 30 source files. Every identified leak has a specific file/line reference. Feature dependencies mapped from code structure. |
| Architecture | HIGH | Full scene graph analysis, data flow tracing, and integration point mapping. Anti-patterns identified with specific PixiJS GitHub issues confirming the behavior. |
| Pitfalls | HIGH | 10 pitfalls identified, each with specific codebase evidence, PixiJS/Electron issue references, and verified fix patterns. Palette swap leak confirmed by PixiJS issue #11407. Graphics churn confirmed by issues #10549, #10586, #11550. |

**Overall confidence:** HIGH

### Gaps to Address

- **PixiJS 8.16.0 Graphics destroy completeness:** While 8.16.0 includes fixes for the severe Graphics memory leaks in earlier 8.x, it is unclear whether the fixes are 100% complete at ~3,360 create/destroy cycles per hour. Object pooling makes this a non-issue, but if pooling is deferred, a soak test with pure create/destroy is needed to verify.
- **Palette swap `texture.destroy(true)` effectiveness:** Need to verify during implementation that destroying a Texture created from `new ImageSource({ resource: canvas })` actually releases the canvas element from the DOM and the GPU upload. If not, explicit `canvas.width = 0; canvas.height = 0` may be needed.
- **ColorMatrixFilter matrix allocation per tick:** The stage filter's matrix is replaced with a new array literal every frame (~108,000 allocations/hour). This creates GC pressure but is likely not the crash cause. Verify during Phase 2 whether assigning to existing array indices reduces GC pauses.
- **Electron IPC memory overhead:** Documented Electron issue suggests `setInterval` + `ipc.send()` can leak 10-15MB/hour. The 3-second poll interval is relatively slow. Monitor during Phase 1 soak testing to see if IPC overhead is significant.

---

## Sources

### Primary (HIGH confidence)
- [Electron crashReporter API](https://www.electronjs.org/docs/latest/api/crash-reporter) -- local crash dump collection, Crashpad storage
- [Electron process API](https://www.electronjs.org/docs/latest/api/process) -- getHeapStatistics, getProcessMemoryInfo, getBlinkMemoryInfo
- [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents) -- render-process-gone, unresponsive events
- [Electron app.getAppMetrics()](https://www.electronjs.org/docs/latest/api/app) -- per-process CPU/memory metrics
- [PixiJS 8.x Garbage Collection Guide](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- GCSystem config, texture idle threshold
- [PixiJS 8.16.0 Release Notes](https://pixijs.com/blog/8.16.0) -- GC marks renderGroups dirty, memory leak fixes
- [PixiJS #11407](https://github.com/pixijs/pixijs/issues/11407) -- AnimatedSprite lacks destroyTexture option in v8
- [PixiJS #10549](https://github.com/pixijs/pixijs/issues/10549) -- Redrawing Graphics leaks memory
- [PixiJS #11550](https://github.com/pixijs/pixijs/issues/11550) -- Memory leak regression in Graphics WebGL
- [PixiJS #10586](https://github.com/pixijs/pixijs/issues/10586) -- Memory leak in Graphics destruction in v8
- [electron-log on GitHub](https://github.com/megahertz/electron-log) -- v5 features, error handler, file transport
- [electron-unhandled on GitHub](https://github.com/sindresorhus/electron-unhandled) -- v5.0.0, Electron 30+ requirement
- Direct codebase analysis of all 30 source files in `src/`

### Secondary (MEDIUM confidence)
- [PixiJS #11331](https://github.com/pixijs/pixijs/issues/11331) -- Severe VRAM Management Degradation in v8
- [PixiJS #11592](https://github.com/pixijs/pixijs/issues/11592) -- Canvas leak after Application.destroy
- [Electron #705](https://github.com/electron/electron/issues/705) -- IPC memory leak with setInterval
- [Electron #7604](https://github.com/electron/electron/issues/7604) -- Render process crashes after hours
- [Electron #40426](https://github.com/electron/electron/issues/40426) -- OOM sometimes reported as crashed
- [Debugging Electron Memory Usage (Seena Burns)](https://seenaburns.com/debugging-electron-memory-usage/) -- RSS vs heap distinction
- [Node.js #1834](https://github.com/nodejs/node/issues/1834) -- createReadStream file descriptor leak on abort

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*

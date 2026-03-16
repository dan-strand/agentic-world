# Pitfalls Research

**Domain:** Memory leak diagnosis, silent crash fixes, and codebase hardening for a long-running Electron + PixiJS always-on desktop app
**Researched:** 2026-03-16
**Confidence:** HIGH (verified via PixiJS v8 GitHub issues, Electron crash documentation, direct codebase analysis, PixiJS garbage collection docs)

---

## Critical Pitfalls

### Pitfall 1: Palette-Swapped Textures Created on Every Animation State Change Are Never Destroyed

**What goes wrong:**
The `Agent.setAnimation()` method calls `createPaletteSwappedTextures()` every time an agent changes animation state (idle, walk, work, celebrate). While the palette swap function has a cache keyed by `${characterClass}_${paletteIndex}_${firstTextureUid}`, it creates new `Texture` and `ImageSource` objects backed by offscreen `<canvas>` elements each time a *new* combination is encountered. Crucially, when `this.sprite.textures = swappedTextures` is called in `setAnimation()`, the **old textures are silently replaced without being destroyed**. The old `Texture` objects become unreferenced by the sprite but still hold GPU-uploaded texture data and `<canvas>` element references. In PixiJS 8, `AnimatedSprite` does not destroy its previous textures when new ones are assigned (confirmed by [PixiJS issue #11407](https://github.com/pixijs/pixijs/issues/11407)).

For a single agent cycling between idle/walk/work states, the cache prevents re-creation of *known* combinations. However, the swapCache is a module-level `Map` that is never pruned. Over hours, as agents are created and destroyed, the cache grows with entries for sessions that no longer exist. Each cached entry holds an array of `Texture` objects (with their backing `ImageSource` and `<canvas>`). If 20 agents pass through the system over 8 hours, each with 4 animation states, that is 80 cached entries of `Texture[]` that are never released.

Additionally, the `new ImageSource({ resource: canvas })` call in `createPaletteSwappedTextures` creates an `<canvas>` element via `document.createElement('canvas')`. These canvases persist as long as the `ImageSource` exists. Hundreds of orphaned canvas elements will consume renderer memory.

**Why it happens:**
The palette swap cache was designed for correctness (avoid recreating the same swap), not for lifecycle management. It has no awareness of agent creation/destruction. The PixiJS 8 `AnimatedSprite` lacks a `destroyTextures` option that existed in earlier versions, so reassigning `.textures` silently leaks the old GPU resources.

**How to avoid:**
1. Track which cache keys belong to which session. When an agent is destroyed in `World.removeAgent()`, delete all associated cache entries and call `.destroy()` on each cached `Texture`.
2. Add a `destroySwappedTextures(characterClass, paletteIndex)` function to `palette-swap.ts` that finds all cache entries matching the class+palette combo, calls `texture.destroy(true)` on each texture (the `true` flag destroys the source), and removes the entries from the cache.
3. Call this cleanup function in `World.removeAgent()` after `agent.destroy({ children: true })`.

**Warning signs:**
- Task Manager shows the renderer process memory climbing by 5-20MB per hour
- DevTools "Performance Monitor" shows increasing GPU memory usage
- DevTools "Memory" tab heap snapshot shows growing counts of `HTMLCanvasElement` and `ImageSource` objects
- The `swapCache` Map size (inspectable in DevTools console) grows monotonically and never decreases

**Phase to address:**
Phase 1 (crash diagnosis and resource audit). This is the most likely primary cause of the silent crash. Unbounded texture/canvas accumulation will eventually exhaust GPU memory or trigger Chromium's renderer process OOM killer, which terminates the renderer silently.

---

### Pitfall 2: Graphics Objects Created for Spark Particles Are Leaked on Container Destruction

**What goes wrong:**
The `AmbientParticles` class spawns spark particles dynamically (up to `SPARK_COUNT` at a time). Each spark creates a `new Graphics()` object, draws a circle, and adds it to the container. When the spark's lifetime expires, `s.gfx.destroy()` is called -- this is correct for individual spark lifecycle. However, if the entire `AmbientParticles` container is ever destroyed (app shutdown, error recovery), the in-flight spark particles' `Graphics` objects are destroyed via the `children: true` flag in `Container.destroy()`, which is correct.

The actual problem is more subtle: the `Building` chimney smoke particles follow the same pattern. Each building creates `new Graphics()` for every smoke puff. Buildings tick continuously (4 buildings x smoke particles per building). At night, `SMOKE_NIGHT_COUNT_BONUS` increases the max particle count. Each smoke puff has a `CHIMNEY_SMOKE_LIFETIME_MS` lifecycle. The `Building.tick()` method correctly destroys expired particles with `p.gfx.destroy()`.

BUT: in PixiJS v8, `Graphics.clear()` followed by redraw (used in `SpeechBubble.show()` and `Building.setToolLabel()`) had a known memory leak regression in versions prior to 8.12.0 ([PixiJS issue #11550](https://github.com/pixijs/pixijs/issues/11550)). Since Agent World uses PixiJS 8.16.0 (released Feb 2026), this specific regression should be fixed. However, the `SpeechBubble.show()` method calls `this.bubble.clear()` then redraws on every activity change, and `Building.setToolLabel()` calls `this.toolBanner.clear()` then redraws on every tool change. Over hours of running, these repeated clear+redraw cycles on long-lived Graphics objects could still accumulate internal WebGL buffer state if the fix was incomplete.

**Why it happens:**
PixiJS Graphics objects maintain internal geometry context that tracks WebGL buffer allocations. The `clear()` method resets the drawing commands but historically did not fully release the underlying GPU buffers. The fix in 8.12.0+ addressed the regression, but the pattern of clearing and redrawing the same Graphics object thousands of times over hours is still not a well-tested path in the PixiJS community.

**How to avoid:**
1. For `SpeechBubble`: instead of clearing and redrawing the same `Graphics` object, create a small pool of pre-drawn bubble backgrounds at common widths and swap visibility. Alternatively, create a new `Graphics`, destroy the old one, and swap the reference.
2. For `Building.setToolLabel()`: same approach -- destroy the old banner Graphics and create a new one rather than calling `.clear()` on a long-lived instance.
3. Add a periodic memory health check that logs `performance.memory` (if available) or `process.memoryUsage()` via IPC to detect slow growth patterns.

**Warning signs:**
- WebGL buffer count visible in DevTools "Application > Frames" grows monotonically
- GPU process memory in Electron's `app.getAppMetrics()` increases over hours
- Smoke/speech bubble rendering becomes slower over time (draw calls accumulate)

**Phase to address:**
Phase 1 (resource audit). Audit all `Graphics.clear()` call sites and evaluate whether destroy+recreate is safer than clear+redraw for long-running operation.

---

### Pitfall 3: The DayNightCycle Elapsed Timer Loses Float Precision After Days of Running

**What goes wrong:**
`DayNightCycle.elapsed` is a plain `number` that accumulates `deltaMs` on every tick. At 30fps with 33.3ms per frame, after 24 hours `elapsed` reaches ~86,400,000ms. After 72 hours it reaches ~259,200,000ms. JavaScript `number` is a 64-bit IEEE 754 double, which has 53 bits of mantissa precision. At 259 million, the precision is still fine (doubles can represent integers up to 2^53 exactly). However, the modulo operation `this.elapsed % DAY_NIGHT_CYCLE_MS` (where `DAY_NIGHT_CYCLE_MS` = 600,000ms for a 10-minute cycle) starts accumulating floating-point rounding errors from the repeated additions. After thousands of cycles, `getProgress()` may drift, causing the day/night transitions to subtly desync or produce unexpected values in the sine-wave calculation.

More critically, `this.elapsed` grows without bound. While this will not overflow a JavaScript `number` in any reasonable timeframe, it does mean the modulo operation operates on increasingly large operands, which can cause subtle floating-point issues in the downstream `Math.sin(2 * Math.PI * p - Math.PI / 2)` calculation when `p` is computed from a very large `elapsed` value.

**Why it happens:**
Accumulating a timer indefinitely is the simplest implementation. It works perfectly for sessions under an hour. The issue only manifests after the timer accumulates enough that `elapsed % cycleMs` starts drifting from expected values due to floating-point arithmetic on large numbers.

**How to avoid:**
Wrap the elapsed timer using modulo on each tick:
```typescript
tick(deltaMs: number): void {
  this.elapsed = (this.elapsed + deltaMs) % DAY_NIGHT_CYCLE_MS;
}
```
This keeps `elapsed` bounded to [0, 600000) and eliminates precision drift. The `getProgress()` method already divides by `DAY_NIGHT_CYCLE_MS`, so this change is transparent.

Apply the same pattern to the `AmbientParticle.phase` accumulators, which also grow without bound.

**Warning signs:**
- Day/night transitions appear to stutter or jump after 12+ hours of running
- The sine-wave color temperature produces unexpected tint values
- `getNightIntensity()` returns values outside [0, 1] (should never happen with correct math, but floating-point edge cases could produce values like 1.0000000001)

**Phase to address:**
Phase 2 (hardening pass). Low severity but easy fix. Apply bounded accumulation to all unbounded timers: `DayNightCycle.elapsed`, `AmbientParticle.phase`, agent `breathTimer`, agent `frameTimer`.

---

### Pitfall 4: The dismissedSessions Set Grows Without Bound

**What goes wrong:**
`World.dismissedSessions` is a `Set<string>` that collects session IDs of agents that have been removed after fade-out. Its purpose is to prevent "resurrection" from stale IPC data. Session IDs are added in `removeAgent()` and only deleted if the same session ID reappears with a non-idle status. For sessions that end permanently (Claude Code session closed), the session ID remains in the set forever. Over days of running, hundreds of session IDs accumulate. While each string is small (~36 bytes for a UUID), the set is checked on every `updateSessions()` call with `this.dismissedSessions.has(session.sessionId)`, creating a linear scan through discovered sessions that checks against an ever-growing set.

This is a minor memory concern but a diagnostic red herring: when investigating memory leaks, this growing set looks suspicious and can waste investigation time.

**Why it happens:**
The set was added as a defensive fix to prevent a specific bug (agent resurrection) without considering the long-running cleanup case. There is no pruning mechanism.

**How to avoid:**
Replace the `Set<string>` with a `Map<string, number>` that records the dismissal timestamp. On each `updateSessions()` call, prune entries older than `STALE_SESSION_MS` (30 minutes). This bounds the set to at most the number of sessions that ended within the last 30 minutes.

```typescript
// In updateSessions(), before processing:
const now = Date.now();
for (const [sid, dismissedAt] of this.dismissedSessions) {
  if (now - dismissedAt > STALE_SESSION_MS) {
    this.dismissedSessions.delete(sid);
  }
}
```

**Warning signs:**
- `this.dismissedSessions.size` in console shows hundreds of entries after a day of running
- IPC-triggered `updateSessions()` takes longer over time (unlikely to be noticeable but conceptually wrong)

**Phase to address:**
Phase 2 (hardening pass). Quick fix, low risk.

---

### Pitfall 5: Readline Streams in readUsageTotals May Not Be Properly Cleaned Up on Error

**What goes wrong:**
The `readUsageTotals()` function in `jsonl-reader.ts` creates a `fs.createReadStream()` and a `readline.createInterface()`. If the function throws during iteration (e.g., from a filesystem error mid-read, or if the calling code's `Promise` is abandoned), the `readline` interface and the underlying file stream may not be properly closed. Node.js `readline` with `for await...of` is supposed to handle cleanup via the async iterator protocol, but there are documented edge cases ([Node.js issue #1834](https://github.com/nodejs/node/issues/1834)) where file descriptors leak when streams are interrupted.

In Agent World, `readUsageTotals()` is called from `UsageAggregator.getUsage()`, which is called for *every session* on *every poll cycle* when the session's mtime changes. If there are JSONL files that are actively being written by Claude Code (creating race conditions), parsing errors could cause the async iterator to bail early. The outer `catch` block swallows errors silently, but the stream may still be open.

Over hours, file descriptor leaks accumulate until the process hits the OS limit (typically 4096 on Windows via MSVCRT, or the Windows handle limit). When the limit is reached, all subsequent `fs.openSync()`, `fs.createReadStream()`, and `fs.statSync()` calls fail, causing the session detector to return empty results and the dashboard to stop updating. The app appears "frozen" but is actually running with no data.

**Why it happens:**
The `try/catch` in `readUsageTotals` catches errors to prevent crashes, but does not explicitly destroy the stream in a `finally` block. The `for await...of` protocol should close the stream on break/throw, but this behavior has had reliability issues across Node.js versions, especially in Electron's embedded Node.js.

**How to avoid:**
Explicitly destroy the stream in a `finally` block:
```typescript
const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
try {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    // ... parse
  }
} catch {
  // swallow
} finally {
  stream.destroy();  // Ensure file descriptor is released
}
```

Also add periodic logging of `process._getActiveHandles().length` in the main process to detect handle accumulation.

**Warning signs:**
- Console shows `EMFILE: too many open files` errors after hours of running
- Session detector returns empty arrays despite active sessions existing
- Dashboard stops updating while the PixiJS animation continues running normally
- `process._getActiveHandles().length` grows monotonically when logged

**Phase to address:**
Phase 1 (crash diagnosis). File descriptor exhaustion is a known cause of "silent" failures where the app continues rendering but stops receiving data. The existing `readUsageTotals` code already captures `stream` in a variable but does not call `stream.destroy()` in the finally block -- this is a one-line fix.

---

### Pitfall 6: Silent Renderer Crash Has No Diagnostic Trail

**What goes wrong:**
The app crashes silently after hours. There is no crash log, no error dialog, no console output at the moment of death. The Electron window simply disappears. This happens because:

1. **No `window.onerror` or `unhandledrejection` handler** in the renderer process. If a PixiJS operation throws (e.g., WebGL context lost, out of memory), the error propagates to the top of the call stack and may crash the renderer process without being caught.
2. **No `crashReporter` initialization**. Electron's crashReporter must be started in both main and renderer processes to capture native crashes (GPU memory exhaustion, WebGL context loss). Without it, Chromium's renderer process OOM killer terminates the process silently.
3. **No `process.on('uncaughtException')` in the main process** to catch and log main-process errors before exit.
4. **No `webContents.on('render-process-gone')` handler** to detect when the renderer process dies and log the reason.

The user sees the window vanish and has no information about why. This makes diagnosis impossible without instrumentation.

**Why it happens:**
Error handling infrastructure is typically added in a "hardening" phase after core features ship. The app went from v1.0 to v2.0 in 7 days -- there was no hardening pass. The `main().catch()` in renderer `index.ts` catches initialization errors but does not catch runtime errors in the ticker callback (which runs in `requestAnimationFrame` and is not wrapped in a try/catch).

**How to avoid:**
Add comprehensive crash telemetry before attempting to fix the leak:

```typescript
// In main process (index.ts):
process.on('uncaughtException', (err) => {
  fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'),
    `[${new Date().toISOString()}] MAIN UNCAUGHT: ${err.stack}\n`);
  app.quit();
});

mainWindow.webContents.on('render-process-gone', (event, details) => {
  fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'),
    `[${new Date().toISOString()}] RENDERER GONE: ${details.reason} exit=${details.exitCode}\n`);
});

// In renderer process:
window.onerror = (msg, source, line, col, error) => {
  console.error(`[CRASH] ${msg} at ${source}:${line}:${col}`, error?.stack);
};
window.onunhandledrejection = (event) => {
  console.error(`[CRASH] Unhandled promise: ${event.reason}`);
};
```

The `render-process-gone` event's `details.reason` field will be one of: `clean-exit`, `abnormal-exit`, `killed`, `crashed`, `oom`, or `launch-failed`. The `oom` reason confirms a memory exhaustion crash. The `crashed` reason indicates a native GPU/WebGL crash.

**Warning signs:**
- The app has been running for 2+ hours with no issues, then suddenly vanishes
- No crash dialog appears (Electron's default crash dialog is disabled by the frameless window config)
- The Windows Event Viewer shows the process terminated with exit code != 0
- Task Manager shows renderer process memory climbing steadily before the crash

**Phase to address:**
Phase 1 (crash diagnosis). This must be the FIRST thing implemented -- before any leak fixes. Without crash telemetry, you cannot confirm whether the silent crash is caused by OOM, GPU context loss, an uncaught exception, or something else entirely. Fix instrumentation first, reproduce the crash, read the log, then fix the cause.

---

### Pitfall 7: LevelUpEffect Creates GlowFilter That Is Never Removed from GPU Pipeline

**What goes wrong:**
Each `LevelUpEffect` instance creates a `new GlowFilter()` and assigns it to `this.filters = [glowFilter]`. When the celebration ends, `agent.removeChild(this.levelUpEffect)` is called, followed by `this.levelUpEffect.destroy({ children: true })`. The `destroy({ children: true })` call destroys all children (sparkle Graphics, column Graphics) but does **not** automatically destroy the filters applied to the container. The `GlowFilter` shader program and its associated render textures remain in the PixiJS renderer's shader cache.

In PixiJS 8, filters create GPU shader programs and intermediate render textures. These are cached by the renderer system and are NOT automatically cleaned up when the container is destroyed. For always-on operation where agents celebrate dozens of times per day, this means GlowFilter GPU resources accumulate.

Additionally, the `FillGradient` used for the light column creates a texture resource that is also not explicitly destroyed.

**Why it happens:**
PixiJS's `Container.destroy()` with `children: true` destroys child display objects but does not call `destroy()` on the container's `filters` array elements. This is a PixiJS design decision (filters may be shared between containers), but it means filter cleanup is the application's responsibility.

**How to avoid:**
Explicitly destroy the GlowFilter before destroying the LevelUpEffect:
```typescript
// In Agent.ts, before destroying the level-up effect:
if (this.levelUpEffect) {
  // Destroy filters explicitly (PixiJS does not auto-destroy filters on container.destroy)
  if (this.levelUpEffect.filters) {
    for (const filter of this.levelUpEffect.filters) {
      filter.destroy();
    }
    this.levelUpEffect.filters = [];
  }
  this.removeChild(this.levelUpEffect);
  this.levelUpEffect.destroy({ children: true });
  this.levelUpEffect = null;
}
```

Apply the same pattern in `World.init()` for the stage-level `ColorMatrixFilter` if the app is ever destroyed and reinitialized.

**Warning signs:**
- GPU memory in Task Manager increases after each celebration event
- WebGL "shader programs" count grows (visible in WebGL Inspector extensions)
- After many celebrations, rendering performance degrades

**Phase to address:**
Phase 1 (resource audit). Every `new Filter()` must have a corresponding `filter.destroy()`. Audit all filter creation sites.

---

### Pitfall 8: Diagnosing the Wrong Leak -- Confusing JavaScript Heap Growth with GPU/Native Memory Growth

**What goes wrong:**
A developer takes a JavaScript heap snapshot in DevTools, sees heap is stable at 40MB, and concludes "no memory leak." But the silent crash is caused by GPU memory exhaustion (texture uploads, WebGL buffers, shader programs) or native memory growth (canvas elements, file descriptors), neither of which appear in the JavaScript heap snapshot. The developer wastes days adding `WeakRef` wrappers and optimizing JavaScript object allocation while the actual leak is in GPU-uploaded textures from the palette swap system.

**Why it happens:**
JavaScript heap snapshots are the most accessible debugging tool and the one developers reach for first. They show JavaScript object retention. But PixiJS operates primarily in GPU memory space (textures, buffers, shaders). GPU memory is managed by the WebGL/WebGPU backend, not the JavaScript garbage collector. A texture that has been uploaded to the GPU and then dereferenced in JavaScript will be collected by the JS GC, but its GPU memory remains allocated until `texture.destroy()` or `texture.unload()` is explicitly called (or until PixiJS's TextureGCSystem collects it after ~1 minute of non-use at 60fps -- but at 5fps idle, that is 12 minutes).

Native memory (DOM elements like `<canvas>`, file handles, Node.js buffers) also does not appear in JavaScript heap snapshots.

**How to avoid:**
Use multiple diagnostic tools in parallel:
1. **JavaScript Heap**: DevTools Memory > Heap snapshot (finds JS object leaks)
2. **GPU Memory**: `performance.memory` (Chrome-specific) or `app.getAppMetrics()` (Electron) to track GPU process memory
3. **Native Memory**: `process.memoryUsage().rss` via IPC from main process (total resident set including native allocations)
4. **File Descriptors**: `process._getActiveHandles().length` and `process._getActiveRequests().length` in main process
5. **DOM Elements**: `document.querySelectorAll('canvas').length` in renderer to detect orphaned canvas elements from palette swaps
6. **PixiJS Internals**: Log `renderer.texture.managedTextures.length` (if accessible) to track PixiJS's texture count

Create a periodic health reporter (every 60 seconds) that logs all of these values. Plot them over time. The metric that grows monotonically reveals which system is leaking.

**Warning signs:**
- Heap snapshot shows stable memory, but Task Manager shows process memory growing
- GPU process memory in `app.getAppMetrics()` climbs while JS heap stays flat
- `document.querySelectorAll('canvas').length` returns more canvases than expected

**Phase to address:**
Phase 1 (crash diagnosis). Build the health reporter BEFORE attempting any fixes. Without multi-dimensional diagnostics, you will fix the wrong thing.

---

### Pitfall 9: Fixing One Leak Can Mask Another -- The Whack-a-Mole Problem

**What goes wrong:**
The developer finds and fixes the palette swap texture leak (Pitfall 1). Memory growth slows from 20MB/hour to 5MB/hour. They declare victory. But the remaining 5MB/hour comes from a different source (Graphics.clear() accumulation, GlowFilter leaks, or file descriptor exhaustion). The app still crashes, just later -- after 16 hours instead of 4 hours. The developer is confused because they "already fixed the memory leak."

**Why it happens:**
Long-running apps often have multiple independent leak sources. Fixing the largest leak makes the smaller leaks harder to detect because the growth rate is slower. Each leak may have a different time-to-crash threshold.

**How to avoid:**
1. Establish a baseline: run the app for 1 hour and record memory metrics every 60 seconds. Plot the growth rate.
2. After each fix, re-run the 1-hour baseline test. The growth rate must drop to near zero (< 1MB/hour for the renderer process).
3. If growth rate is still positive, do not declare the fix complete. Continue investigating.
4. Set a hard pass/fail criterion: the app must run for 8 hours continuously with < 50MB total memory growth in the renderer process.

**Warning signs:**
- Memory growth rate decreased but did not reach zero
- The crash still happens, just later
- Different memory metrics grow at different rates (GPU memory stable but RSS growing, or vice versa)

**Phase to address:**
Phase 3 (verification and soak testing). This is a testing discipline, not a code fix. The soak test must be part of the definition of done for this milestone.

---

### Pitfall 10: The Mtime Cache in UsageAggregator and SessionDetector Accumulates Entries for Deleted Sessions

**What goes wrong:**
Both `FilesystemSessionDetector.mtimeCache` and `UsageAggregator.cache` are `Map<string, ...>` instances that grow as new sessions are discovered. When a session's JSONL file is deleted (Claude Code cleanup), the session is no longer discovered by the detector, but the cache entry persists in the Map. Over days, hundreds of stale cache entries accumulate.

Each `mtimeCache` entry in the session detector holds `{ mtimeMs, sessionInfo, hasToolUse }` -- the `sessionInfo` object includes the full file path string. Each `UsageAggregator.cache` entry holds `{ mtimeMs, totals }`. While individually small, these Maps are never pruned.

Similarly, `FilesystemSessionDetector.cwdCache` maps sessionId to `{ projectPath, projectName }` and is never pruned.

**Why it happens:**
The caches were designed for performance (skip re-reading unchanged files) without considering the lifecycle of the cached data. There is no "session ended" signal that would trigger cache eviction.

**How to avoid:**
Add periodic cache pruning that removes entries for session IDs not seen in the last N poll cycles:

```typescript
// In SessionStore.poll() or as a separate cleanup timer:
private pruneCaches(activeSessionIds: Set<string>): void {
  for (const sessionId of this.detector.mtimeCache.keys()) {
    if (!activeSessionIds.has(sessionId)) {
      this.detector.mtimeCache.delete(sessionId);
      this.detector.cwdCache.delete(sessionId);
      this.usageAggregator.clearSession(sessionId);
    }
  }
}
```

Note: `UsageAggregator` already has a `clearSession()` method, but nothing calls it.

**Warning signs:**
- Cache sizes grow monotonically (inspect via logging or debugger)
- Main process RSS grows at 1-2MB/hour even when no sessions are active
- Session detection poll time increases over days

**Phase to address:**
Phase 2 (hardening pass). Small fix, low risk. The `UsageAggregator.clearSession()` method already exists but is never called -- wire it up.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| No `texture.destroy()` on palette swap cache eviction | Simpler cache implementation | GPU memory grows unbounded; silent OOM crash after hours | Never -- lifecycle must match creation |
| `Graphics.clear()` + redraw instead of destroy+recreate | Avoids allocation churn | Potential WebGL buffer accumulation in long-running PixiJS 8 apps | Acceptable if growth rate is verified to be zero in soak testing |
| Unbounded timer accumulators (elapsed, phase, breathTimer) | Simplest implementation | Floating-point precision drift after days | Never for production always-on app |
| No `stream.destroy()` in finally block for JSONL parsing | Fewer lines of code | File descriptor leak on parsing errors | Never -- always clean up streams |
| No crash telemetry (no crashReporter, no error handlers) | Faster development | Impossible to diagnose production crashes | Never for always-on applications |
| Module-level `swapCache` Map with no eviction | Cache always hits, fast lookups | Memory grows with total unique agents over app lifetime | Acceptable for short sessions, not for always-on |
| `dismissedSessions` Set with no pruning | Correct resurrection prevention | Minor unbounded growth | Acceptable for short sessions, not for always-on |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PixiJS `Container.destroy({ children: true })` | Assuming filters are destroyed with the container | Explicitly destroy all filters before calling container.destroy() |
| PixiJS `AnimatedSprite.textures = newTextures` | Assuming old textures are automatically cleaned up | Destroy old textures if they were created outside the PixiJS asset system |
| PixiJS `Graphics.clear()` in v8 | Assuming clear() fully releases GPU resources | Prefer destroy+recreate for Graphics that are cleared frequently over long periods |
| Node.js `readline` + `createReadStream` | Assuming `for await...of` cleans up the stream on error | Explicitly call `stream.destroy()` in a `finally` block |
| Electron `render-process-gone` | Not listening for this event | Register handler to log the crash reason (`oom`, `crashed`, etc.) |
| Electron `webContents.on('console-message')` | Relying on it for crash diagnosis | Console messages may not be emitted if the renderer crashes; use `render-process-gone` instead |
| PixiJS TextureGCSystem at low FPS | Assuming textures are GC'd after 1 minute | At 5fps idle, the 3600-frame GC threshold is 12 minutes, not 1 minute |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Palette swap textures never destroyed | GPU memory grows 5-20MB/hour | Destroy textures when agents are removed; prune swapCache | After 4-8 hours depending on agent churn |
| GlowFilter not destroyed after celebration | GPU shader/texture accumulation per celebration event | Explicitly destroy filters before container.destroy() | After 20+ celebrations (depends on GPU memory) |
| Unbounded timer accumulators | Subtle day/night drift; potential NaN from precision loss | Use modulo-bounded accumulators | After 24-72 hours of continuous running |
| File descriptor leak from readline streams | Session detection stops working; dashboard freezes | Always destroy streams in finally blocks | After hundreds of JSONL parse errors (depends on error rate) |
| Canvas elements from palette swap not released | Browser memory grows with orphaned DOM canvases | Destroy ImageSource when evicting from swap cache | After dozens of unique agents pass through system |

---

## "Looks Done But Isn't" Checklist

- [ ] **Crash telemetry:** `render-process-gone` handler is wired and logging -- verify by deliberately crashing renderer (e.g., `webContents.executeJavaScript('process.crash()')`)
- [ ] **Texture cleanup:** After an agent is removed, verify `document.querySelectorAll('canvas').length` does not increase permanently
- [ ] **Soak test:** App ran for 8 hours continuously with < 50MB renderer process memory growth -- verify via Task Manager at start and end
- [ ] **Filter cleanup:** After a celebration completes, verify the GlowFilter's GPU resources are released (no increasing GPU memory per celebration)
- [ ] **Stream cleanup:** Corrupt a JSONL file mid-read, verify no `EMFILE` errors appear after 100+ poll cycles
- [ ] **Timer bounds:** After 24 hours of running, verify day/night cycle still transitions smoothly (no stutter, no jump)
- [ ] **Cache pruning:** After sessions end, verify `UsageAggregator.cache.size` and `dismissedSessions.size` decrease over time
- [ ] **Health reporter:** Periodic memory metrics are being logged every 60 seconds to a file or console for post-mortem analysis

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Palette swap texture leak | MEDIUM | Add `destroySwappedTextures()` to palette-swap.ts; call from `removeAgent()`; flush swapCache entries for removed agents |
| GlowFilter not destroyed | LOW | Add explicit `filter.destroy()` before each `LevelUpEffect.destroy()`; one-line fix in two locations (Agent.ts celebrating state, Agent.startFadeOut) |
| Unbounded timers | LOW | Change `elapsed += deltaMs` to `elapsed = (elapsed + deltaMs) % CYCLE_MS` in DayNightCycle; similar for particle phases |
| No crash telemetry | LOW | Add 4 event handlers (2 in main, 2 in renderer); takes 30 minutes |
| File descriptor leak | LOW | Add `finally { stream.destroy() }` to readUsageTotals; one-line fix |
| dismissedSessions growth | LOW | Replace Set with Map<string, number>; add pruning in updateSessions |
| Cache accumulation | LOW | Call existing `clearSession()` method; add pruning loop in poll() |
| Wrong diagnostic approach | HIGH | Build multi-dimensional health reporter; requires understanding which metrics to track |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| No crash telemetry (Pitfall 6) | Phase 1: Diagnosis infrastructure | Deliberately crash renderer; verify crash.log contains reason |
| Health reporter (Pitfall 8) | Phase 1: Diagnosis infrastructure | Health metrics logged every 60s; plot shows stable or decreasing values |
| Palette swap texture leak (Pitfall 1) | Phase 1: Resource audit + fix | 1-hour soak test: renderer RSS growth < 5MB |
| File descriptor leak (Pitfall 5) | Phase 1: Resource audit + fix | Corrupt JSONL; verify no EMFILE after 100 polls |
| GlowFilter leak (Pitfall 7) | Phase 1: Resource audit + fix | Trigger 10 celebrations; GPU memory returns to baseline |
| Graphics.clear accumulation (Pitfall 2) | Phase 2: Hardening | 4-hour soak test with frequent tool changes; renderer RSS stable |
| Unbounded timers (Pitfall 3) | Phase 2: Hardening | 8-hour soak test; day/night cycle smooth throughout |
| dismissedSessions growth (Pitfall 4) | Phase 2: Hardening | Run with 10+ sessions cycling; Set size bounded |
| Cache accumulation (Pitfall 10) | Phase 2: Hardening | Verify caches shrink when sessions end |
| Whack-a-mole (Pitfall 9) | Phase 3: Soak testing | 8-hour soak test with < 50MB total growth; all metrics stable |

---

## Sources

- [PixiJS Issue #11407 -- AnimatedSprite lacks destroyTexture option in v8](https://github.com/pixijs/pixijs/issues/11407) -- Confirmed: assigning new textures to AnimatedSprite does not destroy old ones (HIGH confidence, May 2025)
- [PixiJS Issue #10549 -- Redrawing Graphics leaks memory](https://github.com/pixijs/pixijs/issues/10549) -- Root cause: `_needsContextNeedsRebuild` array grows unbounded; fixed in PR #10560 (HIGH confidence, May 2024)
- [PixiJS Issue #11550 -- Memory leak regression in Graphics WebGL](https://github.com/pixijs/pixijs/issues/11550) -- Regression in 8.11.0+; fixed in PR #11753 (HIGH confidence, Nov 2025)
- [PixiJS Issue #10586 -- Memory leak in Graphics destruction in v8](https://github.com/pixijs/pixijs/issues/10586) -- Rapidly creating/destroying Graphics leaks memory (HIGH confidence, May 2024)
- [PixiJS Issue #11331 -- Severe VRAM Management Degradation in v8](https://github.com/pixijs/pixijs/issues/11331) -- VRAM management issues in v8 (MEDIUM confidence)
- [PixiJS Garbage Collection Guide](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- TextureGCSystem: removes unused textures after 3600 frames (HIGH confidence, official docs)
- [Electron crashReporter Docs](https://www.electronjs.org/docs/latest/api/crash-reporter) -- Must start before renderer creation; does not capture JS exceptions (HIGH confidence, official docs)
- [Electron render-process-gone Event](https://www.electronjs.org/docs/latest/api/web-contents#event-render-process-gone) -- Reports crash reason including `oom` (HIGH confidence, official docs)
- [Node.js Issue #1834 -- createReadStream file descriptor leak](https://github.com/nodejs/node/issues/1834) -- File descriptor leak on stream abort (MEDIUM confidence)
- [Electron Issue #7010 -- Renderer process OOM crash](https://github.com/electron/electron/issues/7010) -- Complex apps crash when renderer runs low on memory (MEDIUM confidence)
- [PixiJS Issue #11592 -- Canvas leak after Application.destroy](https://github.com/pixijs/pixijs/issues/11592) -- Canvas elements not cleaned up on destroy (MEDIUM confidence)
- Direct codebase analysis of Agent World src/ (HIGH confidence -- primary source)

---
*Pitfalls research for: Agent World v2.1 -- Hardening and Crash Diagnosis (memory leak detection, silent crash fixes, codebase hardening)*
*Researched: 2026-03-16*

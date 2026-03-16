# Stack Research: v2.1 Hardening & Crash Diagnosis

**Domain:** Electron app stability, memory leak detection, crash diagnosis
**Researched:** 2026-03-16
**Confidence:** HIGH (Electron built-in APIs) / MEDIUM (PixiJS GC specifics)

---

## Context

Agent World is a long-running Electron 40.6.1 + PixiJS 8.16.0 app that experiences silent crashes after hours of operation. This research covers ONLY the stack additions needed for crash diagnosis, memory leak detection, and stability hardening. The existing validated stack (Electron, PixiJS, TypeScript, Webpack, etc.) is not re-evaluated.

**Bottom line:** Two new npm dependencies (`electron-log`, `electron-unhandled`). Everything else uses built-in Electron/Node.js APIs and existing PixiJS features that are already available in the installed version.

---

## Recommended Stack Additions

### New Dependencies (Runtime)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `electron-log` | ^5.4 | Persistent file logging across main + renderer processes | No dependencies, 540K weekly downloads. Auto-catches `did-fail-load`, `plugin-crashed`, `preload-error` events. File transport with rotation (log + log.old) so crash context survives process death. Built specifically for Electron's dual-process model with IPC-based renderer-to-main log transport. |
| `electron-unhandled` | ^5.0.0 | Catch uncaughtException + unhandledRejection in both processes | Requires Electron 30+ (we have 40.6.1). Prevents silent exits from unhandled promise rejections -- the most common cause of "silent crashes" in Node.js. Sindre Sorhus maintained, minimal footprint. |

### Memory Monitoring (Built-in -- No New Dependencies)

| API | Process | Purpose | Notes |
|-----|---------|---------|-------|
| `process.getHeapStatistics()` | Both | V8 heap stats (totalHeapSize, usedHeapSize, heapSizeLimit) in KB | Primary signal for detecting JS-side memory leaks. Call on an interval, log growth trends. |
| `process.getProcessMemoryInfo()` | Both | Process-level memory (residentSet, private, shared) in KB | Captures native/C++ memory that heap stats miss. Returns a Promise. Useful because PixiJS GPU buffers won't appear in V8 heap stats. |
| `process.getBlinkMemoryInfo()` | Renderer | Blink/DOM allocated + total memory | Catches DOM-related leaks (detached DOM nodes, orphaned event listeners in dashboard panel). |
| `app.getAppMetrics()` | Main | Per-process CPU + memory for all Electron processes | Returns workingSetSize, peakWorkingSetSize, privateBytes, percentCPUUsage per process. Distinguishes main vs renderer vs GPU process resource usage. |

### Crash Detection & Recovery (Built-in -- No New Dependencies)

| API | Purpose | Notes |
|-----|---------|-------|
| `crashReporter.start({ uploadToServer: false })` | Local crash dump collection via Crashpad | Generates minidump files in `app.getPath('crashDumps')` without needing a remote server. Captures native crashes that JS error handlers miss entirely. Must be called before `app.on('ready')`. |
| `webContents.on('render-process-gone')` | Detect renderer crashes with reason codes | Provides structured `details.reason`: `crashed`, `oom`, `killed`, `abnormal-exit`, `clean-exit`, `memory-eviction`. Critical for distinguishing OOM from other crash types. Replaces deprecated `crashed` event. |
| `webContents.on('unresponsive')` | Detect renderer hangs | Fires when the renderer event loop stops responding. Paired with `responsive` event for recovery detection. Log both for post-mortem analysis. |

### PixiJS Resource Management (Already Available in 8.16.0)

| Feature | Purpose | Notes |
|---------|---------|-------|
| Unified `GCSystem` | Automatic GPU resource cleanup | PixiJS 8.15 deprecated `TextureGCSystem` and `RenderableGCSystem` in favor of unified `GCSystem`. Version 8.16.0 (installed) includes this. Configure via `gcActive`, `gcMaxUnusedTime`, `gcFrequency` at app init. Currently unconfigured in the codebase -- defaults are tuned for 60fps apps, not a 5-30fps long-running app. |
| `texture.unload()` | Manual GPU memory release | For textures that should be freed immediately rather than waiting for GC cycle. |
| `container.destroy({ children: true })` | Recursive GPU resource cleanup | Already used in agent removal (`world.ts:477`). Audit all other destroy calls to ensure `{ children: true }` is consistently passed. |

---

## Installation

```bash
# New runtime dependencies (only 2 packages)
npm install electron-log electron-unhandled

# No new dev dependencies needed
```

---

## Integration Points

### Main Process (src/main/index.ts)

```typescript
// === ADD BEFORE app.on('ready') ===
import { crashReporter } from 'electron';
import log from 'electron-log';
import unhandled from 'electron-unhandled';

// 1. Start local crash dump collection (must be before ready)
crashReporter.start({ uploadToServer: false });

// 2. Catch unhandled errors -- prevents silent exits
unhandled({ logger: log.error, showDialog: false });

// 3. Initialize electron-log IPC for renderer logging
log.initialize();

// 4. Configure log file
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB, rotates to log.old
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// 5. Catch unhandled errors in main process
log.errorHandler.startCatching();
```

```typescript
// === ADD AFTER mainWindow creation ===

// 6. Listen for renderer crashes
mainWindow.webContents.on('render-process-gone', (_event, details) => {
  log.error('[crash] Renderer process gone:', details.reason, 'exit:', details.exitCode);
  // If OOM or crash, could attempt recovery by reloading
});

mainWindow.webContents.on('unresponsive', () => {
  log.warn('[hang] Renderer became unresponsive');
});

mainWindow.webContents.on('responsive', () => {
  log.info('[hang] Renderer recovered');
});
```

### Renderer Process (src/renderer/index.ts)

```typescript
import log from 'electron-log/renderer';
// All log.info(), log.warn(), log.error() calls now persist to file
// via IPC to the main process file transport
```

### Preload Script (src/preload/preload.ts)

```typescript
// Add IPC channel for renderer health metrics
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing channels ...
  reportHealth: (data: HealthMetrics) => ipcRenderer.send('health-report', data),
});
```

### PixiJS GC Configuration (src/renderer/world.ts)

```typescript
await this.app.init({
  // ... existing options (width, height, backgroundColor, etc.) ...

  // GC configuration for long-running stability (PixiJS 8.15+ unified GC)
  // Tighter than defaults because this app runs for hours at 5-30fps
  gcActive: true,
  gcMaxUnusedTime: 30_000,  // 30 seconds (default ~60s at 60fps)
  gcFrequency: 15_000,      // Check every 15 seconds (default ~10s at 60fps)
});
```

---

## New Module: Health Monitor (src/main/health-monitor.ts)

A lightweight service that periodically samples memory metrics and logs them. No external dependencies beyond `electron-log`.

```typescript
// Samples every 60 seconds
// Logs every 5 minutes (or immediately when heap exceeds warning threshold)
// Tracks:
//   - Main process: V8 heap stats via getHeapStatistics()
//   - All processes: CPU + memory via app.getAppMetrics()
//   - Renderer: heap + blink memory via IPC health-report channel
```

Key design decisions:
- 60-second sample interval is low overhead (< 1ms per sample)
- Only logs every 5th sample (5 minutes) unless threshold exceeded -- keeps log files manageable
- Warning threshold at 512MB heap, critical at 1024MB -- logged at error level for easy grep
- Renderer metrics arrive via IPC, logged alongside main process metrics

### New Module: Health Reporter (src/renderer/health-reporter.ts)

```typescript
// Runs in renderer, sends metrics to main via IPC every 60 seconds
// Reports: V8 heap (getHeapStatistics), Blink memory (getBlinkMemoryInfo)
// Main process logs these alongside its own metrics
```

---

## Identified Memory Leak Risks in Current Codebase

These are NOT stack additions but critical findings from codebase analysis that inform the hardening work. They explain the likely cause of the silent crash.

### 1. Unbounded Cache Growth (HIGH risk -- probable crash cause)

| Location | Cache | Growth Pattern | Severity |
|----------|-------|----------------|----------|
| `session-detector.ts:31` | `cwdCache: Map` | Entries added per session, never pruned | HIGH |
| `session-detector.ts:33` | `mtimeCache: Map` | Entries added per session, never pruned | HIGH |
| `usage-aggregator.ts:11` | `cache: Map` | `clearSession()` exists but is never called | HIGH |
| `world.ts:106` | `dismissedSessions: Set` | Entries added on agent removal, only cleared on reactivation of same sessionId | MEDIUM |

Over hours of use, as sessions come and go, these Maps/Sets grow unboundedly. Each entry is small (~1-2KB), but with ~10-20 sessions cycling per day over hours, this accumulates. More importantly, the `mtimeCache` holds references to `SessionInfo` objects which reference file paths and parsed data.

**Fix pattern:** Prune entries for sessions not returned by the current poll cycle. Add a `pruneStale()` method called at the end of each poll that removes entries for sessionIds not in the current `discoveredIds` set. For `dismissedSessions`, cap at 100 entries with LRU eviction or time-based expiry.

### 2. Graphics Object Churn (HIGH risk -- probable crash cause)

| Location | Pattern | Objects/Hour (est.) |
|----------|---------|---------------------|
| `building.ts:354-404` chimney smoke | `new Graphics()` per particle, `destroy()` on expire | ~720/building x 4 buildings = ~2,880/hr |
| `ambient-particles.ts:212-242` sparks | `new Graphics()` per spark, `destroy()` on expire | ~480/hr |
| `building.ts:232` `setToolLabel()` | `toolBanner.clear()` + re-draw on each tool change | Variable, low frequency |

PixiJS v8 had a documented memory leak in Graphics destruction (GitHub issue #10586, fixed August 2024). The fix was included in later 8.x releases, and 8.16.0 includes further GC improvements (PR #11581, September 2025). However, the original reporter noted residual leaks even after the fix. At ~3,360 Graphics create-destroy cycles per hour, even a small per-object leak compounds over hours.

**Fix pattern:** Object pooling for smoke and spark particles. Pre-create a fixed pool of Graphics objects at initialization, reuse them by resetting position/alpha/scale, and return to pool instead of destroying. This eliminates the create-destroy cycle entirely.

### 3. Palette-Swapped Texture Creation (LOW risk)

`createPaletteSwappedTextures()` is called from `Agent.setAnimation()` every time animation state changes (`agent.ts:267-275`). If the palette swap cache is working correctly, textures are reused. If not, new Textures are created on every animation transition, accumulating GPU memory.

**Fix pattern:** Verify the palette swap cache key includes (characterClass, paletteIndex, animState). Add a cache hit/miss counter to validate during testing.

### 4. Event Listener Accumulation (LOW risk)

The `console-message` listener on `webContents` (`index.ts:49`) and the window drag interval (`index.ts:85-96`) are properly managed. However, the `ipcMain.on()` handlers registered in `ipc-handlers.ts` are never cleaned up -- in theory this is fine since they persist for app lifetime, but worth auditing.

---

## electron-log Configuration Details

```typescript
import log from 'electron-log';
import * as path from 'path';
import { app } from 'electron';

// File transport: auto-rotates at 5MB (current.log + current.old.log)
log.transports.file.maxSize = 5 * 1024 * 1024;

// Format: timestamp + level + message
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Log location: default is platform-specific
// Windows: C:\Users\{user}\AppData\Roaming\{app}\logs\main.log
// Can override with resolvePathFn if needed

// Catch unhandled errors automatically
log.errorHandler.startCatching();

// Optional: save critical Electron events
log.eventLogger.startLogging(); // Logs did-fail-load, plugin-crashed, etc.
```

**Log file location:** By default, `electron-log` writes to `{userData}/logs/main.log`. For Agent World on Windows, this is `C:\Users\{user}\AppData\Roaming\agent-world\logs\main.log`. The log file is human-readable and grep-friendly.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `electron-log` | `winston` | If you need multiple simultaneous transport targets (database, remote endpoint, etc.). Winston's transport plugin system is powerful but overkill for file + console logging. |
| `electron-log` | `pino` | If you need structured JSON logging for machine parsing. `electron-log` outputs human-readable text which is better for manual diagnosis. |
| `electron-unhandled` | Manual `process.on('uncaughtException')` | Only if you need custom error dialog behavior or want to avoid any dependency. `electron-unhandled` handles both processes and edge cases (serialization across IPC). |
| Built-in `crashReporter` | Sentry (`@sentry/electron`) | If this were a distributed app with remote users who can't share logs. Sentry adds ~500KB, requires account/DSN, sends data remotely. Not appropriate for a local-only single-user tool. |
| Built-in `crashReporter` | BugSplat | Same rationale as Sentry -- cloud crash reporting for a local desktop tool is overengineered. |
| Periodic heap sampling | `heapdump` npm | If you need full heap snapshots for deep investigation. `heapdump` is a native addon with Electron build complications and generates 100MB+ files. Use Chrome DevTools manual profiling instead when sampling identifies growth. |
| Periodic heap sampling | `node-memwatch` | Abandoned/unmaintained, native addon incompatible with Electron's V8 build. |
| Object pooling for particles | PixiJS `ParticleContainer` | `ParticleContainer` is faster for large particle counts (1000+) but only supports Sprites, not Graphics. Smoke/spark particles use Graphics for circles. Pooling the existing Graphics approach fixes the leak without changing rendering behavior. |
| PixiJS unified GC | Manual `texture.destroy()` everywhere | The unified GC handles most cases automatically. Manual destroy is only needed for known high-churn paths (particle systems). Don't litter the codebase with manual destroy calls when GC can handle steady-state cleanup. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@sentry/electron` | Cloud crash reporting for a local-only app. 500KB+ bundle, requires remote account, sends data externally. | `electron-log` + `crashReporter({ uploadToServer: false })` |
| BugSplat | Same problem as Sentry -- cloud service for a local tool. | Local crash dumps via Crashpad |
| `node-memwatch` / `memwatch-next` | Native addon, abandoned, compilation issues on Windows, incompatible with Electron's V8. | `process.getHeapStatistics()` (built-in, zero-friction) |
| `heapdump` npm | Native addon with Electron rebuild requirements. 100MB+ snapshots unsuitable for continuous monitoring. | Periodic metric sampling to log file; manual DevTools profiling when needed |
| `electron-local-crash-reporter` | Depends on deprecated breakpad-server. Modern Electron uses Crashpad natively. | `crashReporter.start({ uploadToServer: false })` |
| Custom dashboard for metrics | Over-engineering. The goal is crash diagnosis, not a monitoring UI. | Log file + manual review. Add dashboard in a future milestone if needed. |
| APM tools (New Relic, Datadog) | Enterprise monitoring for a personal desktop app. | Built-in APIs + `electron-log` |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `electron-log` | ^5.4 | Electron 13+ | We have 40.6.1. v5 uses IPC for renderer-to-main log transport. No native addons. |
| `electron-unhandled` | ^5.0.0 | Electron 30+ | We have 40.6.1. Pure JS, no native dependencies. |
| PixiJS GCSystem (unified) | Built into 8.15+ | PixiJS 8.16.0 | Already installed. Old `textureGCActive` config still works but is deprecated. Use new `gcActive`/`gcMaxUnusedTime`/`gcFrequency` options. |
| `crashReporter` | Electron built-in | Electron 1.x+ | Stable API, available since early Electron. Crashpad backend on all platforms. |
| `app.getAppMetrics()` | Electron built-in | Electron 7+ | Returns ProcessMetric objects with CPU and memory per process. |
| `process.getHeapStatistics()` | Electron built-in | All versions | V8 heap stats in KB. Available in both main and sandboxed renderer. |

---

## Sources

- [Electron crashReporter API docs](https://www.electronjs.org/docs/latest/api/crash-reporter) -- `uploadToServer: false` for local dumps, Crashpad storage path, HIGH confidence
- [Electron process API docs](https://www.electronjs.org/docs/latest/api/process) -- getHeapStatistics, getProcessMemoryInfo, getBlinkMemoryInfo, HIGH confidence
- [Electron webContents API docs](https://www.electronjs.org/docs/latest/api/web-contents) -- render-process-gone, unresponsive events, HIGH confidence
- [Electron RenderProcessGoneDetails](https://www.electronjs.org/docs/latest/api/structures/render-process-gone-details) -- reason codes (crashed, oom, killed, abnormal-exit, clean-exit, memory-eviction), HIGH confidence
- [Electron app.getAppMetrics() docs](https://www.electronjs.org/docs/latest/api/app) -- per-process CPU/memory metrics, HIGH confidence
- [PixiJS 8.x Garbage Collection Guide](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- TextureGCSystem/GCSystem config, HIGH confidence
- [PixiJS v8 Graphics memory leak (issue #10586)](https://github.com/pixijs/pixijs/issues/10586) -- Graphics destroy leak in v8, fixed Aug 2024 but residual leaks reported, MEDIUM confidence
- [PixiJS renderer memory leaks fix (PR #11581)](https://github.com/pixijs/pixijs/pull/11581) -- PoolCollector singleton for cleanup on destroy, merged Sep 2025, HIGH confidence
- [PixiJS v8.16.0 release blog](https://pixijs.com/blog/8.16.0) -- GC marks renderGroups dirty, VAO cache preservation, HIGH confidence
- [PixiJS 8.15 GCSystem migration](https://pixijs.download/dev/docs/rendering.GCSystemOptions.html) -- unified gcActive/gcMaxUnusedTime/gcFrequency replacing deprecated options, HIGH confidence
- [electron-log on GitHub](https://github.com/megahertz/electron-log) -- v5 features, errorHandler.startCatching(), eventLogger, file transport rotation, HIGH confidence
- [electron-unhandled on GitHub](https://github.com/sindresorhus/electron-unhandled) -- v5.0.0, Electron 30+ requirement, both process support, HIGH confidence
- [Debugging Electron Memory Usage (Seena Burns)](https://seenaburns.com/debugging-electron-memory-usage/) -- process.memoryUsage RSS vs heap distinction, MEDIUM confidence
- [Electron Performance docs](https://www.electronjs.org/docs/latest/tutorial/performance) -- official performance best practices, HIGH confidence

---
*Stack research for: Agent World v2.1 -- Hardening & Crash Diagnosis*
*Researched: 2026-03-16*

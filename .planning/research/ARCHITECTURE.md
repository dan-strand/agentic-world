# Architecture Research: Crash Prevention & Resource Management

**Domain:** Electron + PixiJS always-on desktop app hardening
**Researched:** 2026-03-16
**Confidence:** HIGH (full codebase audit + official docs + known issue tracking)

## Existing Architecture Overview

```
MAIN PROCESS                                 RENDERER PROCESS
+-----------------------------------+        +---------------------------------------------+
| index.ts (entry)                  |        | index.ts (entry)                            |
|   FilesystemSessionDetector       |  IPC   |   World (scene graph root)                  |
|   SessionStore (3s poll interval) | =====> |     tilemapLayer (static canvas)             |
|   UsageAggregator (mtime cache)   |        |     buildingsContainer                      |
|   HistoryStore (atomic JSON)      |        |       4x Building (smoke particles)         |
|   Window drag interval (16ms)     |        |       campfire Sprite                       |
|                                   |        |     sceneryLayer (96 static sprites)        |
| IPC Channels:                     |        |     nightGlowLayer (19 Graphics glows)      |
|   sessions-update (push)          |        |     AmbientParticles (25+15+6+8 particles)  |
|   dashboard-update (push)         |        |     agentsContainer (dynamic agents)        |
|   get-initial-sessions (invoke)   |        |       Agent (AnimatedSprite + gear + bubble) |
|   get-history (invoke)            |        |         LevelUpEffect (celebration)         |
|   window-minimize/close/drag      |        |         SpeechBubble (Graphics + BitmapText)|
+-----------------------------------+        |                                             |
                                             |   GameLoop (adaptive ticker 5/30 fps)       |
                                             |   DayNightCycle (10-min sine wave)           |
                                             |   ColorMatrixFilter (stage-level)            |
                                             |   DashboardPanel (vanilla DOM, below canvas) |
                                             |   SoundManager (HTML5 Audio singleton)       |
                                             +---------------------------------------------+
```

### Scene Graph Children Count (steady state)

| Layer | Objects | Type | Static? |
|-------|---------|------|---------|
| tilemapLayer | 1 | Sprite (canvas) | Yes |
| buildingsContainer | 5 | Sprite + Container | Yes (smoke particles dynamic) |
| sceneryLayer | ~96 | Sprite | Yes |
| nightGlowLayer | ~19 | Graphics | Yes (alpha varies) |
| AmbientParticles | ~54 | Graphics | Mostly (sparks cycle) |
| agentsContainer | 0-10 | Container (Agent) | No -- dynamic lifecycle |
| stage filters | 1 | ColorMatrixFilter | Yes (matrix updates per tick) |

## Leak Analysis: What Is Most Likely Crashing

### CRITICAL: Chimney Smoke Particles (Building.tick)

**Severity: HIGH -- Almost certainly the primary leak**

Each of the 4 buildings continuously creates and destroys `Graphics` objects for smoke:
- Spawn rate: one puff every `CHIMNEY_SMOKE_SPAWN_MS` (varies with night, likely ~300-500ms)
- At night: `SMOKE_NIGHT_COUNT_BONUS` extra particles, spawn rate multiplied by `SMOKE_NIGHT_SPAWN_MULT`
- Each puff: `new Graphics()` -> `circle().fill()` -> `addChild()` -> later `removeChild()` + `destroy()`
- **4 buildings x continuous operation = hundreds of Graphics create/destroy cycles per hour**

In PixiJS 8 versions before ~8.12.0, this pattern (rapid Graphics create/destroy) caused a confirmed memory leak (issue #10549, #10586, #11550). While PixiJS 8.16.0 includes fixes for the most severe regressions, the pattern of frequent Graphics allocation remains inefficient and may still accumulate minor overhead over many hours.

**Evidence:** The project runs PixiJS 8.16.0, which is post-fix for the severe Graphics leak. However, the `clear()`-and-redraw pattern in `Building.setToolLabel()` (line 226-237) also repeatedly clears and redraws the `toolBanner` Graphics, which is a secondary concern.

### CRITICAL: Forge Spark Particles (AmbientParticles.tick)

**Severity: HIGH -- Same pattern as smoke**

Sparks near Training Grounds follow identical create/destroy pattern:
- `new Graphics()` -> `circle().fill()` -> `addChild()` -> later `removeChild()` + `destroy()`
- Capped at `SPARK_COUNT` (8), spawning every `SPARK_SPAWN_MS`
- Each spark lives `SPARK_LIFETIME_MS` then is destroyed
- Continuous operation = ~8 create/destroy cycles per spark lifetime period

### MODERATE: Palette Swap Texture Cache (palette-swap.ts)

**Severity: MODERATE -- Grows unboundedly**

The `swapCache` Map at module level caches palette-swapped textures forever:
- Key: `${characterClass}_${paletteIndex}_${firstTextureUid}`
- Each cache entry holds `Texture[]` with `ImageSource` wrapping offscreen `<canvas>` elements
- New entries created whenever `setAnimation()` transitions trigger `createPaletteSwappedTextures()`
- **Never cleaned up** -- the cache grows with every unique class+palette+animation combo encountered
- With 4 classes x 25 palettes x 4 animation states = up to 400 cache entries, each holding multiple Textures backed by canvas elements
- In practice bounded by the session count, but the cache holds references to destroyed agent textures indefinitely

### MODERATE: dismissedSessions Set (World class)

**Severity: MODERATE -- Unbounded growth over days**

The `dismissedSessions` Set tracks removed session IDs to prevent resurrection:
- Added on agent removal (line 499)
- Only cleared when a session re-activates (line 522)
- **Never pruned** -- grows by ~1 entry per completed Claude session
- Not a direct memory issue (UUIDs are small), but symptomatic of no lifecycle cleanup
- Over 24 hours with many sessions, this set grows indefinitely

### MODERATE: Dashboard DOM Recreation (DashboardPanel.renderSessions)

**Severity: MODERATE -- DOM churn with event listener accumulation**

Every session update replaces the entire session list DOM:
- `this.sessionList.innerHTML = ''` clears children
- New elements created with `addEventListener('click', ...)` for each session row
- Event listeners on old DOM nodes should be garbage collected when the DOM is cleared, but this pattern is suboptimal
- With 3-second polling and dashboard updates on change, this adds up

### LOW: IPC Message Overhead (SessionStore polling)

**Severity: LOW -- but documented Electron issue**

The SessionStore polls every 3 seconds and sends IPC messages:
- `webContents.send()` for `sessions-update` and `dashboard-update`
- Documented Electron issue: `setInterval` + `ipc.send()` can leak 10-15MB/hour in the browser process
- The 3-second interval is relatively slow, reducing impact
- The `mainWindow.isDestroyed()` guard (line 128) prevents sending to destroyed windows

### LOW: UsageAggregator Stream Not Explicitly Closed

**Severity: LOW -- likely auto-closed but fragile**

`readUsageTotals()` in `jsonl-reader.ts` creates a `ReadStream` via `createReadStream()`:
- The `readline.createInterface` consumes it via `for await`
- Default `autoClose: true` should close the stream when exhausted
- **But**: if the `for await` loop throws after partial consumption, the stream may remain open
- The outer `try/catch` catches errors but does not explicitly destroy the stream
- Over many polls re-parsing changed files, leaked file handles could exhaust OS limits

### LOW: AgentFactory slotCache Not Pruned

**Severity: LOW -- small objects, bounded by session count**

The `AgentFactory` has a `slotCache` Map that is cleaned per-agent via `releaseSlot()`, but the World class also instantiates its own `agentFactory` (line 80) separate from the singleton export (line 45 of agent-factory.ts). The World's instance is cleaned correctly via `removeAgent()`, but the module-level singleton is never used -- potential confusion but not a leak.

## Integration Points for Hardening

### New Components to Add

| Component | Location | Purpose |
|-----------|----------|---------|
| `HealthMonitor` | `src/main/health-monitor.ts` | Periodic memory/heap sampling, log to console, detect growth trends |
| `CrashGuard` | `src/main/index.ts` (integrated) | `webContents.on('render-process-gone')` handler with auto-restart |
| `ResourcePool<Graphics>` | `src/renderer/resource-pool.ts` | Object pool for particle Graphics to avoid create/destroy churn |
| Cleanup sweep | `src/renderer/world.ts` (integrated) | Periodic pruning of stale Maps (dismissedSessions, caches) |

### Modified Components

| Component | File | Changes |
|-----------|------|---------|
| `Building` | `src/renderer/building.ts` | Pool smoke Graphics instead of create/destroy; reuse via reset |
| `AmbientParticles` | `src/renderer/ambient-particles.ts` | Pool spark Graphics instead of create/destroy |
| `palette-swap.ts` | `src/renderer/palette-swap.ts` | Add cache size limit or LRU eviction; destroy textures on evict |
| `World` | `src/renderer/world.ts` | Prune dismissedSessions periodically; add error boundary to tick() |
| `DashboardPanel` | `src/renderer/dashboard-panel.ts` | Diff-update DOM instead of full replacement |
| `main/index.ts` | `src/main/index.ts` | Add renderer crash recovery, memory monitoring |
| `session-store.ts` | `src/main/session-store.ts` | Guard against sending to destroyed webContents more robustly |
| `jsonl-reader.ts` | `src/main/jsonl-reader.ts` | Ensure stream cleanup in error paths of `readUsageTotals()` |
| `LevelUpEffect` | `src/renderer/level-up-effect.ts` | Ensure GlowFilter is destroyed when effect ends |

## Architectural Patterns for Hardening

### Pattern 1: Graphics Object Pool

**What:** Pre-allocate a fixed pool of Graphics objects for particles. Instead of `new Graphics()` + `destroy()`, borrow from pool and return when done.

**When to use:** Any recurring create/destroy pattern for short-lived Graphics (smoke, sparks).

**Trade-offs:**
- Pro: Eliminates GPU resource allocation churn entirely
- Pro: No risk of PixiJS Graphics memory leak bugs
- Con: Pool size must be tuned (set to max concurrent particles)
- Con: Must reset all Graphics state on return to pool (position, alpha, scale, visible)

**Example:**
```typescript
class GraphicsPool {
  private available: Graphics[] = [];
  private inUse: Set<Graphics> = new Set();

  constructor(private createFn: () => Graphics, initialSize: number) {
    for (let i = 0; i < initialSize; i++) {
      this.available.push(createFn());
    }
  }

  borrow(): Graphics | null {
    const gfx = this.available.pop();
    if (!gfx) return null; // Pool exhausted
    gfx.visible = true;
    this.inUse.add(gfx);
    return gfx;
  }

  return(gfx: Graphics): void {
    gfx.visible = false;
    gfx.alpha = 1;
    gfx.scale.set(1, 1);
    gfx.position.set(0, 0);
    this.inUse.delete(gfx);
    this.available.push(gfx);
  }

  get activeCount(): number { return this.inUse.size; }
}
```

### Pattern 2: Renderer Crash Recovery

**What:** Listen for `render-process-gone` events on `webContents` and automatically reload the renderer. The main process survives renderer crashes -- it just needs to reload the window.

**When to use:** Always-on applications that must survive GPU crashes, OOM events, or WebGL context loss.

**Trade-offs:**
- Pro: App auto-recovers from crashes without user intervention
- Pro: Main process state (session data) is preserved across renderer restarts
- Con: Brief visual interruption during reload (~1-2 seconds)
- Con: Must handle the delay between crash and recovery (use `setTimeout` to avoid Electron crash-on-immediate-loadURL bug)

**Example:**
```typescript
mainWindow.webContents.on('render-process-gone', (_event, details) => {
  console.error(`[main] Renderer crashed: ${details.reason} (exit ${details.exitCode})`);
  // Delay reload to avoid Electron bug with immediate loadURL in crash handler
  setTimeout(() => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    }
  }, 1000);
});
```

### Pattern 3: Memory Health Monitor

**What:** Periodically sample `process.memoryUsage()` in main process and `performance.memory` (if available) in renderer. Log to console and warn when growth exceeds threshold.

**When to use:** Always-on apps where gradual leaks manifest as crashes after hours.

**Trade-offs:**
- Pro: Provides diagnostic data to identify leak rate
- Pro: Can trigger proactive recovery before crash
- Con: Adds minimal overhead (one measurement per minute is negligible)
- Con: `performance.memory` is Chromium-only, not standard

**Example:**
```typescript
class HealthMonitor {
  private lastHeapUsed = 0;
  private interval: NodeJS.Timeout | null = null;

  start(intervalMs = 60_000): void {
    this.interval = setInterval(() => {
      const mem = process.memoryUsage();
      const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
      const delta = mem.heapUsed - this.lastHeapUsed;
      const deltaMB = (delta / 1024 / 1024).toFixed(2);
      console.log(`[health] Heap: ${heapMB}MB, RSS: ${rssMB}MB, Delta: ${deltaMB}MB`);

      if (mem.heapUsed > 500 * 1024 * 1024) {
        console.warn('[health] WARNING: Heap exceeds 500MB');
      }
      this.lastHeapUsed = mem.heapUsed;
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
  }
}
```

### Pattern 4: Error Boundary in Animation Loop

**What:** Wrap `World.tick()` in try/catch so a single bad frame doesn't kill the entire app. Log the error, skip the frame, and continue.

**When to use:** Any `requestAnimationFrame`/ticker callback that processes dynamic data.

**Trade-offs:**
- Pro: Prevents runtime exceptions from crashing the renderer
- Pro: App continues operating even with degraded visuals
- Con: Could mask bugs that should be fixed (use sparingly, log all errors)

**Example:**
```typescript
// In GameLoop.start():
this.tickerCallback = (ticker: { deltaMS: number }) => {
  try {
    this.world.tick(ticker.deltaMS);
  } catch (err) {
    console.error('[game-loop] Tick error (skipping frame):', err);
  }
};
```

### Pattern 5: Periodic Cache Pruning

**What:** On a timer (e.g., every 5 minutes), prune stale entries from tracking Maps and caches.

**When to use:** Any Map/Set that tracks entities with lifecycles (sessions, agents).

**Trade-offs:**
- Pro: Prevents unbounded growth of tracking data structures
- Pro: Reclaims memory from stale texture caches
- Con: Pruning must not interfere with active state

**Example:**
```typescript
// In World class, called from tick every 5 minutes:
private pruneTimer = 0;
private pruneStaleState(deltaMs: number): void {
  this.pruneTimer += deltaMs;
  if (this.pruneTimer < 300_000) return; // 5 minutes
  this.pruneTimer = 0;

  // Prune dismissed sessions older than 30 minutes
  // (currently no timestamp, so just cap the set size)
  if (this.dismissedSessions.size > 50) {
    const arr = [...this.dismissedSessions];
    this.dismissedSessions = new Set(arr.slice(-20));
  }
}
```

## Data Flow Changes for Hardening

### Current Flow (no crash protection)

```
SessionDetector.discoverSessions()
    |
    v
SessionStore.poll() [3s interval]
    |
    v
webContents.send('sessions-update', data)
    |
    v (IPC bridge)
World.updateSessions(sessions)
    |
    v
GameLoop.tick() -> World.tick(deltaMs)
    |               |
    |               +-> Building.tick() [smoke particles: new Graphics/destroy]
    |               +-> AmbientParticles.tick() [sparks: new Graphics/destroy]
    |               +-> Agent.tick() [setAnimation -> createPaletteSwappedTextures]
    |
    v
[CRASH after hours -- no recovery]
```

### Proposed Flow (with hardening)

```
SessionDetector.discoverSessions()
    |
    v
SessionStore.poll() [3s interval, with isDestroyed guard]
    |
    v
webContents.send('sessions-update', data)
    |
    v (IPC bridge)
World.updateSessions(sessions)
    |
    v
GameLoop.tick() -> try { World.tick(deltaMs) } catch { log, skip }
    |               |
    |               +-> Building.tick() [smoke: POOL borrow/return, no alloc]
    |               +-> AmbientParticles.tick() [sparks: POOL borrow/return]
    |               +-> Agent.tick() [palette cache bounded with LRU eviction]
    |               +-> pruneStaleState() [every 5 min]
    |
    v
HealthMonitor [1 min sampling, warns at 500MB]
    |
    v
CrashGuard [render-process-gone -> delayed reload]
    |
    v
[RECOVERY: renderer reloads, main process preserves state]
```

## Anti-Patterns in Current Codebase

### Anti-Pattern 1: Create-and-Destroy Particle Graphics

**What the code does:** `Building.tick()` and `AmbientParticles.tick()` create `new Graphics()` for each particle, then `destroy()` it when lifetime expires.

**Why it's wrong:** PixiJS Graphics creation involves GPU buffer allocation. Even with v8.16.0 leak fixes, repeated allocation/deallocation fragments GPU memory and adds GC pressure. Over hours, this compounds.

**Do this instead:** Pre-allocate a pool of Graphics objects at initialization. Borrow when spawning a particle, return when it expires. Use `visible = false` + position reset instead of destroy.

### Anti-Pattern 2: Unbounded Module-Level Cache

**What the code does:** `palette-swap.ts` uses a module-level `Map` to cache palette-swapped textures with no eviction.

**Why it's wrong:** Each cache entry holds `Texture[]` backed by `<canvas>` elements and GPU texture memory. Entries are never removed even when agents are destroyed. Over a day with many sessions, this grows.

**Do this instead:** Either make the cache LRU-bounded (e.g., max 100 entries, evict oldest), or destroy cached textures when their associated agent is removed.

### Anti-Pattern 3: Full DOM Replacement on Every Update

**What the code does:** `DashboardPanel.renderSessions()` clears `innerHTML` and rebuilds the entire DOM tree on every session change.

**Why it's wrong:** Creates DOM churn and potentially leaks event listeners if any references are held externally. With 3-second polling, this rebuilds the DOM thousands of times per hour.

**Do this instead:** Diff the session list -- only add/remove/update rows that actually changed. Use `dataset.sessionId` to match existing rows.

### Anti-Pattern 4: No Error Boundary in Tick Loop

**What the code does:** `GameLoop.start()` adds a ticker callback that calls `world.tick()` with no error handling.

**Why it's wrong:** Any unhandled exception in `tick()` (e.g., accessing a destroyed Graphics, null reference from race condition) kills the ticker permanently. The app appears frozen with no recovery.

**Do this instead:** Wrap in try/catch, log the error, skip the frame, and continue ticking.

## Suggested Build Order

Based on dependency analysis and impact, the recommended implementation order:

1. **HealthMonitor + crash logging** (diagnostic foundation -- need data before fixing)
   - Add `process.memoryUsage()` logging to main process
   - Add `performance.memory` logging to renderer via IPC
   - Add `render-process-gone` crash recovery handler
   - No dependencies on other changes

2. **Error boundary in GameLoop** (immediate crash prevention)
   - Wrap `world.tick()` in try/catch
   - Trivial change, high safety impact
   - No dependencies

3. **Graphics object pool** (address primary leak suspect)
   - Create `ResourcePool<Graphics>` utility
   - Refactor `Building.tick()` smoke particles to use pool
   - Refactor `AmbientParticles.tick()` spark particles to use pool
   - Requires pool implementation before building/particle refactor

4. **Palette swap cache bounding** (address secondary leak)
   - Add LRU eviction or explicit cleanup to `swapCache`
   - Properly destroy evicted Texture objects (call `texture.destroy(true)`)
   - Independent of pool work

5. **Stream cleanup hardening** (prevent file handle leaks)
   - Add explicit stream destruction in error paths of `readUsageTotals()`
   - Guard `webContents.send()` more robustly in SessionStore
   - Independent of renderer changes

6. **Dashboard DOM optimization** (reduce churn)
   - Implement diff-update for session list
   - Lowest priority -- DOM churn is unlikely to cause crashes, just wastes CPU

7. **Stale state pruning** (prevent long-term growth)
   - Add periodic pruning of `dismissedSessions`, stale caches
   - Cap `swapCache` size
   - Final cleanup pass after main fixes

## Sources

- [PixiJS 8.x Garbage Collection Guide](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- HIGH confidence
- [PixiJS #10549: Redrawing Graphics leaks memory](https://github.com/pixijs/pixijs/issues/10549) -- HIGH confidence, fixed in PixiJS 8
- [PixiJS #11550: Memory leak regression in PIXI.Graphics (WebGL)](https://github.com/pixijs/pixijs/issues/11550) -- HIGH confidence, fixed in 8.12.0
- [PixiJS #10586: Memory leak in Graphics destruction in v8](https://github.com/pixijs/pixijs/issues/10586) -- HIGH confidence
- [PixiJS 8.x Graphics Guide](https://pixijs.com/8.x/guides/components/scene-objects/graphics) -- HIGH confidence
- [PixiJS 8.x Performance Tips](https://pixijs.com/8.x/guides/production/performance-tips/) -- HIGH confidence
- [Electron crashReporter API](https://www.electronjs.org/docs/latest/api/crash-reporter) -- HIGH confidence
- [Electron RenderProcessGoneDetails](https://www.electronjs.org/docs/latest/api/structures/render-process-gone-details) -- HIGH confidence
- [Electron #705: IPC memory leak with setInterval](https://github.com/electron/electron/issues/705) -- MEDIUM confidence (old issue, may be improved)
- [Electron #19887: App crash after render process crash](https://github.com/electron/electron/issues/19887) -- HIGH confidence
- [Electron #7604: Render process crashes after couple of hours](https://github.com/electron/electron/issues/7604) -- MEDIUM confidence
- [Diagnosing Memory Leaks in Electron Applications](https://www.mindfulchase.com/explore/troubleshooting-tips/frameworks-and-libraries/diagnosing-and-fixing-memory-leaks-in-electron-applications.html) -- MEDIUM confidence
- [Debugging Electron Memory Usage](https://seenaburns.com/debugging-electron-memory-usage/) -- MEDIUM confidence
- [Node.js #1180: CreateReadStream doesn't close the file](https://github.com/nodejs/node/issues/1180) -- MEDIUM confidence

---
*Architecture research for: Agent World v2.1 Hardening and Crash Diagnosis*
*Researched: 2026-03-16*

# Stack Research: v2.2 Performance Optimization

**Domain:** PixiJS rendering optimization, Node.js async I/O, Electron main-process performance
**Researched:** 2026-03-18
**Confidence:** HIGH (PixiJS 8 APIs verified via official docs) / HIGH (Node.js fs.promises verified via docs)

---

## Context

Agent World v2.2 targets CPU, GPU, and I/O inefficiencies identified by a 4-agent performance audit. This research covers ONLY the specific APIs and patterns needed for the optimization work. No new npm dependencies are required -- every optimization uses existing PixiJS 8.16.0 and Node.js APIs.

**Bottom line:** Zero new dependencies. The entire performance milestone is achievable with APIs already available in the installed stack. The three highest-impact changes are: (1) replace stage-level ColorMatrixFilter with Container.tint, (2) apply cacheAsTexture to static layers, and (3) convert synchronous fs calls in session-detector to fs.promises.

---

## No New Dependencies Required

This milestone adds zero packages. Every optimization uses APIs already available in PixiJS 8.16.0 and Node.js (bundled with Electron 40.6.1).

| What | API | Already Available |
|------|-----|-------------------|
| Stage tinting | `Container.tint` | PixiJS 8.0.0+ |
| Static layer caching | `Container.cacheAsTexture()` | PixiJS 8.x |
| Async file I/O | `fs.promises` / `fs/promises` | Node.js 10+ |
| Incremental file read | `fs.createReadStream({ start })` | Node.js 0.x+ |
| Ticker FPS control | `app.ticker.maxFPS` | PixiJS 8.x (already used) |

---

## GPU Optimization APIs

### 1. Container.tint (Replaces Stage-Level ColorMatrixFilter)

**Current problem:** `world.ts:252-292` applies a `ColorMatrixFilter` to `app.stage` for day/night color temperature. This forces the GPU to render the entire scene to an off-screen texture, apply the filter pass, then composite back -- effectively doubling GPU work every frame.

**Solution:** PixiJS 8 added `tint` as an inherited property on Container. Setting `app.stage.tint` applies a per-channel color multiply to all children (Sprites, Graphics, text -- everything) without a filter pass. Tints propagate down the scene graph automatically.

**API details (verified from official PixiJS 8 docs):**

```typescript
// Container.tint accepts any ColorSource:
container.tint = 0xRRGGBB;        // hex integer
container.tint = '#RRGGBB';       // hex string
container.tint = 'rgb(r, g, b)';  // CSS format
container.tint = [r, g, b];       // array (0-1 range)

// Default value: 0xFFFFFF (white = no tinting)
// Inheritance: children inherit parent tint unless they set their own
```

**Why this works for day/night color temperature:**

The current ColorMatrixFilter matrix is a diagonal-only transform:
```
[r, 0, 0, 0, 0,  0, g, 0, 0, 0,  0, 0, b, 0, 0,  0, 0, 0, 1, 0]
```
This is mathematically identical to a per-channel color multiply, which is exactly what `tint` does. The RGB multipliers from `DayNightCycle.getTintRGB()` (e.g., `[1.0, 0.91, 0.75]` for day, `[0.4, 0.5, 0.8]` for night) can be encoded as a hex color:

```typescript
const [r, g, b] = this.dayNightCycle.getTintRGB();
this.app.stage.tint = (Math.round(r * 255) << 16)
                    | (Math.round(g * 255) << 8)
                    | Math.round(b * 255);
```

**Performance impact:** Eliminates the entire filter render pass. The tint is applied during the normal draw call for each sprite/graphics at zero additional GPU cost. This is the single highest-impact optimization.

**Caveats:**
- `tint` is a color multiply only -- it can darken or shift colors but cannot brighten. The current day/night system only uses multipliers <= 1.0, so this is not a limitation.
- Children that set their own `tint` (e.g., agent status tinting) will NOT inherit the stage tint -- they use their own value instead. Status tinting on agents must be adjusted to pre-multiply the day/night color with the status color.
- Graphics fill colors are tinted by the inherited tint value. The night glow layer's warm/window glow colors will be modulated by the day/night tint, which is correct behavior (glows should look warmer in day, cooler at night).

**Confidence:** HIGH -- verified via [PixiJS 8 Container API docs](https://pixijs.download/dev/docs/scene.Container.html), [PixiJS Scene Objects guide](https://pixijs.com/8.x/guides/components/scene-objects), and [PixiJS v8 launch blog](https://pixijs.com/blog/pixi-v8-launches) confirming tint inheritance is new in v8.

### 2. Container.cacheAsTexture() (Static Layer Optimization)

**Current problem:** Static layers (tilemap container, scenery container, building exteriors, night glow container) are re-rendered every frame even though their contents never change (or change very infrequently). Each layer contributes draw calls that the GPU processes unnecessarily.

**Solution:** `cacheAsTexture()` renders a container and all its children to a single GPU texture. Subsequent frames render just that one texture instead of all individual children.

**API (verified from [PixiJS 8 cacheAsTexture guide](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture)):**

```typescript
// Enable caching (defaults)
container.cacheAsTexture();
container.cacheAsTexture(true);

// Enable with options
container.cacheAsTexture({
  resolution: 1,       // Match renderer resolution (default)
  antialias: false,    // false for pixel art (saves GPU)
});

// Disable caching
container.cacheAsTexture(false);

// Force re-render cached texture (when content changes)
container.updateCacheTexture();
```

**Candidate layers for caching:**

| Layer | Children | Changes When | Cache Strategy |
|-------|----------|-------------|----------------|
| Tilemap container | Canvas-rendered ground tiles | Never (static after init) | `cacheAsTexture()` once at init. Never update. |
| Scenery container | ~96 outdoor sprites (trees, bushes, flowers, props) | Never (static after init) | `cacheAsTexture()` once at init. Never update. |
| Building exteriors | 4 buildings with roof, chimney, signs, windows | Never (static interiors drawn at init) | `cacheAsTexture()` once at init. Never update. |
| Night glow container | ~19 Graphics circles | Every tick (alpha changes with nightIntensity) | Do NOT cache -- updates every frame. |

**Layers NOT to cache:**

| Layer | Reason |
|-------|--------|
| Agents container | Agents move, animate, and reparent between containers every frame |
| Night glow layer | Alpha updates every tick based on nightIntensity |
| Ambient particles | Continuously animating (fireflies, sparks, dust, leaves, smoke) |
| Building agentsLayers | Agents inside buildings are reparented here dynamically |

**Performance impact:** Reduces per-frame draw calls from ~100+ (tilemap tiles + scenery sprites + building elements) to ~3 cached textures for static content. Trades GPU rendering time for GPU memory (~3 textures at 1024x768 resolution).

**Caveats:**
- Cached textures consume GPU memory. At 1024x768 with 4 bytes/pixel, each cache is ~3MB. Three static layers = ~9MB additional GPU memory. This is trivial for any modern GPU.
- Containers cached as textures cannot exceed ~4096x4096 pixels. The world is 1024x768, well within limits.
- Do NOT frequently toggle caching on/off -- the re-caching cost is significant.
- For pixel art, set `antialias: false` to avoid sub-pixel blending artifacts.
- The tint inheritance from `app.stage.tint` (day/night cycle) will still apply to cached textures during compositing -- the cache captures the untinted content, and the parent tint is applied when the cached texture is drawn. This is correct behavior.

**Confidence:** HIGH -- verified via [PixiJS cacheAsTexture guide](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture) and [PR #11031](https://github.com/pixijs/pixijs/pull/11031).

### 3. Night Glow Alpha Threshold Guard

**Current problem:** `updateNightGlowLayer()` sets `glow.gfx.alpha` on all ~19 glow sprites every tick, even when nightIntensity is 0 (full daylight) and all alphas are already 0.

**Solution:** Guard the loop with a threshold check and skip when alpha would not visibly change.

```typescript
// Pattern: gate on meaningful change
const GLOW_THRESHOLD = 0.01;

function updateNightGlowLayer(glows: GlowSprite[], nightIntensity: number): void {
  // Skip entirely during daytime (nightIntensity near 0)
  if (nightIntensity < GLOW_THRESHOLD) {
    // Set all to 0 once, then early-return on subsequent calls
    for (const glow of glows) {
      if (glow.gfx.alpha !== 0) glow.gfx.alpha = 0;
    }
    return;
  }
  for (const glow of glows) {
    glow.gfx.alpha = glow.maxAlpha * nightIntensity;
  }
}
```

**No new API needed.** This is a logic optimization pattern, not an API change.

**Confidence:** HIGH -- standard optimization pattern.

---

## I/O Optimization APIs

### 4. fs.promises for Session Discovery (Replace Sync Calls)

**Current problem:** `session-detector.ts` uses `fs.existsSync`, `fs.readdirSync`, `fs.statSync` in `discoverSessions()`. These block the Electron main process event loop during every poll cycle (default 3-second interval). Each call blocks until the OS completes the I/O operation. With ~10 project directories and ~30 JSONL files, this can block for 10-50ms per poll.

**Solution:** Convert to `fs.promises` equivalents. Change `discoverSessions()` from synchronous to async.

**API mapping (verified from [Node.js fs docs](https://nodejs.org/api/fs.html)):**

| Current (sync) | Replacement (async) | Notes |
|-----------------|---------------------|-------|
| `fs.existsSync(path)` | `fs.promises.access(path).then(() => true).catch(() => false)` | Or wrap stat in try/catch |
| `fs.readdirSync(path, opts)` | `await fs.promises.readdir(path, opts)` | Same options, returns Promise |
| `fs.statSync(path)` | `await fs.promises.stat(path)` | Same return shape (Stats object) |

**Interface change required:**

```typescript
// Before (sync)
discoverSessions(): SessionInfo[]

// After (async)
async discoverSessions(): Promise<SessionInfo[]>
```

This change propagates to `SessionStore` and the IPC poll handler. The poll interval callback already runs asynchronously (setInterval), so the async conversion is straightforward.

**Performance impact:** Unblocks the main process event loop during I/O. The actual I/O time is unchanged, but the main process can process IPC messages, respond to window events, and handle other callbacks while awaiting file system responses. Particularly important during startup when many files are scanned.

**Caveats:**
- `fs.promises.stat()` has slightly higher per-call overhead than `fs.statSync()` due to Promise creation. For the ~30-50 stat calls per poll cycle, the overhead is negligible (<1ms total) and vastly outweighed by the non-blocking benefit.
- Error handling changes from try/catch-around-sync to try/catch-around-await (same pattern, just async).
- The `readLastJsonlLine()` and `readLastToolUse()` functions in `jsonl-reader.ts` use `fs.openSync`/`fs.readSync`/`fs.fstatSync`/`fs.closeSync` for the tail-buffer read. These CAN be converted to async using `fs.promises.open()` returning a `FileHandle`, but the benefit is marginal -- each read is a single 4KB buffer operation that completes in <1ms. Convert for consistency, but this is low priority.

**Confidence:** HIGH -- [Node.js fs.promises docs](https://nodejs.org/api/fs.html), [Electron performance guide](https://www.electronjs.org/docs/latest/tutorial/performance) explicitly recommends async I/O in main process.

### 5. Incremental JSONL Usage Parsing (Offset-Based)

**Current problem:** `readUsageTotals()` in `jsonl-reader.ts` reads the entire JSONL file from byte 0 on every call when mtime changes, even though most of the file was already parsed in the previous call. JSONL files can be 2-18MB. The `UsageAggregator` caches the result, but on mtime change, the entire file is re-streamed.

**Solution:** Track the byte offset of the last read position. On subsequent reads, use `fs.createReadStream({ start: lastOffset })` to read only the new bytes appended since the last parse.

**API (verified from [Node.js fs docs](https://nodejs.org/api/fs.html)):**

```typescript
// Read from a specific byte offset
const stream = fs.createReadStream(filePath, {
  encoding: 'utf-8',
  start: lastByteOffset,  // Resume from where we left off
});

const rl = readline.createInterface({
  input: stream,
  crlfDelay: Infinity,
});

for await (const line of rl) {
  // Parse only NEW lines
}
```

**Cache structure change:**

```typescript
// Before: cache stores final totals only
private cache = new Map<string, { mtimeMs: number; totals: TokenUsageTotals }>();

// After: cache stores totals + byte offset for incremental reads
private cache = new Map<string, {
  mtimeMs: number;
  totals: TokenUsageTotals;
  byteOffset: number;  // Position after last read
}>();
```

**Edge cases to handle:**
- File truncation (new file with same path): detect when `stat.size < cachedByteOffset` and reset to full re-read.
- First line after resume may be partial (if previous read ended mid-line): the readline interface handles this gracefully -- partial first lines are skipped by the JSON.parse try/catch.
- JSONL files are append-only during a session, so offset-based resumption is safe. Files are never rewritten mid-session.

**Performance impact:** Reduces per-poll I/O from reading 2-18MB to reading only the delta (typically 1-50KB of new entries). For a session with a 10MB JSONL file getting 5KB of new entries per poll, this is a 200x reduction in bytes read.

**Confidence:** HIGH -- `createReadStream({ start })` is a stable Node.js API. The JSONL append-only invariant is guaranteed by Claude Code's write pattern.

---

## Rendering Optimization Patterns (No New APIs)

### 6. Day/Night Filter Value Caching (Threshold Gate)

**Current problem:** `world.ts:287-292` sets `this.stageFilter.matrix` to a new array literal every tick. At 30fps, this creates 108,000 array allocations per hour. The ColorMatrixFilter internally converts this to a Float32Array, causing GC pressure.

**After replacing ColorMatrixFilter with Container.tint** (optimization #1), the equivalent issue becomes: computing and setting `app.stage.tint` every tick even when the value hasn't changed.

**Solution:** Cache the last-set tint value and only update when the new value differs.

```typescript
// Pattern: threshold-gated tint update
private lastStageTint = 0xFFFFFF;

tick(deltaMs: number): void {
  this.dayNightCycle.tick(deltaMs);
  const [r, g, b] = this.dayNightCycle.getTintRGB();
  const tint = (Math.round(r * 255) << 16)
             | (Math.round(g * 255) << 8)
             | Math.round(b * 255);

  if (tint !== this.lastStageTint) {
    this.app.stage.tint = tint;
    this.lastStageTint = tint;
  }
}
```

At 30fps over a 10-minute cycle, the tint value changes ~50 times per cycle (each RGB channel shifting by 1/255). The remaining ~17,950 ticks per cycle skip the assignment entirely.

**Confidence:** HIGH -- standard optimization pattern.

### 7. Ambient Particle Throttling at Idle FPS

**Current problem:** Ambient particles (fireflies, sparks, dust, leaves, smoke) update every tick even at idle FPS (5fps). At 5fps, particle animations look choppy anyway, and the CPU time updating invisible or barely-moving particles is wasted.

**Solution:** Skip particle systems that are not visually impactful at low FPS. The GameLoop already tracks `isIdle` state.

**Pattern:**

```typescript
// In world.tick():
// Only update ambient particles at active FPS rates
if (!this.gameLoop.isIdle) {
  this.ambientParticles.tick(deltaMs);
  this.updateBuildingSmoke(deltaMs);
}
```

**No new API needed.** The `GameLoop.isIdle` flag is already available.

**Confidence:** HIGH -- the game loop already distinguishes idle/active states.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Stage color temperature | `Container.tint` on `app.stage` | Keep `ColorMatrixFilter` but cache matrix values | ColorMatrixFilter always forces a full-scene off-screen render pass regardless of caching. The filter pass itself is the cost, not the matrix update. Tint eliminates the pass entirely. |
| Static layer optimization | `cacheAsTexture()` | `ParticleContainer` for scenery sprites | ParticleContainer only supports Sprites with uniform properties. Scenery uses mixed Sprite types with individual positions/scales. cacheAsTexture handles any Container content. |
| Async I/O | `fs.promises` | `fs` callback API | `fs.promises` is cleaner with async/await and avoids callback nesting. Callback API has marginally lower overhead but the difference is negligible for 30-50 calls per poll cycle. |
| Incremental file read | `createReadStream({ start })` | `FileHandle.read(buffer, offset, length, position)` | FileHandle.read is lower-level and requires manual buffer management and line splitting. createReadStream + readline handles line boundaries automatically, matching the existing readUsageTotals pattern. |
| Particle throttling | Skip at idle FPS | Reduce particle count at idle | Skipping is simpler and has zero visual impact since idle means no active sessions to observe. Reducing count requires managing two particle budgets. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@pixi/tilemap` | Incompatible with Electron Webpack (documented in v1.1 decision). Canvas-rendered tilemap + cacheAsTexture achieves the same performance. | `cacheAsTexture()` on the existing tilemap container |
| WebGL shader for day/night | Custom shaders are fragile across GPU vendors and add maintenance burden. Container.tint is built-in and hardware-accelerated. | `Container.tint` with RGB-encoded color temperature |
| `worker_threads` for JSONL parsing | Overkill for append-only incremental reads. Worker overhead (serialization, message passing) exceeds the time saved for 1-50KB delta reads. | `createReadStream({ start })` with offset tracking |
| `better-sqlite3` for usage data | Adding a database for what is currently a simple mtime-cached Map is over-engineering. The JSONL files ARE the source of truth. | Incremental offset-based parsing with in-memory cache |
| PixiJS `RenderTexture` (manual) | Lower-level API that requires manual management. `cacheAsTexture()` wraps this with proper lifecycle management and pool integration. | `cacheAsTexture()` |
| `requestIdleCallback` for particle updates | Not available in Electron's renderer in all configurations. The existing ticker-based approach with FPS gating is more predictable. | FPS-gated particle skip via `GameLoop.isIdle` |

---

## Version Compatibility Verification

| API | Minimum Version | Installed Version | Status |
|-----|-----------------|-------------------|--------|
| `Container.tint` (inherited) | PixiJS 8.0.0 | 8.16.0 | Available |
| `Container.cacheAsTexture()` | PixiJS 8.x | 8.16.0 | Available |
| `Container.updateCacheTexture()` | PixiJS 8.x | 8.16.0 | Available |
| `fs.promises.readdir()` | Node.js 10.0.0 | Node.js 20.x (Electron 40) | Available |
| `fs.promises.stat()` | Node.js 10.0.0 | Node.js 20.x (Electron 40) | Available |
| `fs.promises.access()` | Node.js 10.0.0 | Node.js 20.x (Electron 40) | Available |
| `fs.createReadStream({ start })` | Node.js 0.x | Node.js 20.x (Electron 40) | Available |
| `app.ticker.maxFPS` | PixiJS 8.x | 8.16.0 | Already in use |

---

## Installation

```bash
# No new packages needed
# All optimizations use existing PixiJS 8.16.0 and Node.js built-in APIs
```

---

## Sources

- [PixiJS 8 Container API docs](https://pixijs.download/dev/docs/scene.Container.html) -- tint property, inherited by children, accepts ColorSource. HIGH confidence.
- [PixiJS 8 Scene Objects guide](https://pixijs.com/8.x/guides/components/scene-objects) -- "tint is inherited by child objects unless they specify their own", blend modes and tints now inherited in v8. HIGH confidence.
- [PixiJS 8 cacheAsTexture guide](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture) -- full API: cacheAsTexture(options), updateCacheTexture(), resolution/antialias params. HIGH confidence.
- [PixiJS cacheAsTexture PR #11031](https://github.com/pixijs/pixijs/pull/11031) -- implementation details, texture pool integration. HIGH confidence.
- [PixiJS 8 Color guide](https://pixijs.com/8.x/guides/components/color) -- ColorSource formats (hex, string, array, object). HIGH confidence.
- [PixiJS v8 launch blog](https://pixijs.com/blog/pixi-v8-launches) -- confirmation that tint inheritance is new in v8. HIGH confidence.
- [Node.js fs API docs](https://nodejs.org/api/fs.html) -- fs.promises equivalents, FileHandle.read(), createReadStream start option. HIGH confidence.
- [Electron Performance guide](https://www.electronjs.org/docs/latest/tutorial/performance) -- "prefer async and non-blocking I/O variant" in main process. HIGH confidence.
- [PixiJS Performance Deep Dive (Medium)](https://medium.com/@turkmergin/maximising-performance-a-deep-dive-into-pixijs-optimization-6689688ead93) -- cacheAsTexture patterns, sprite vs graphics performance. MEDIUM confidence.

---
*Stack research for: Agent World v2.2 -- Performance Optimization*
*Researched: 2026-03-18*

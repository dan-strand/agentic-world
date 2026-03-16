# Phase 24: Resource Leak Fixes - Research

**Researched:** 2026-03-16
**Domain:** PixiJS 8 GPU resource management, Electron long-running process stability, object pooling
**Confidence:** HIGH

## Summary

Phase 24 eliminates every identified source of unbounded memory/GPU/handle growth in Agent World so it can run indefinitely. Six requirements (LEAK-01 through LEAK-04, STAB-01, STAB-02) address four distinct leak categories: GPU allocation churn from particle systems, unbounded texture caches, un-destroyed GPU filter resources, and monotonically growing JavaScript collections/timers. Phase 23 (just completed) provides the crash logging, error boundary, and memory monitoring infrastructure needed to verify each fix works.

The codebase has been audited file-by-file. Every leak source has been identified with its exact location, magnitude, and fix pattern. The fixes are mutually independent -- they can be implemented in any order and verified individually using the Phase 23 MemoryMonitor. The highest-impact fix is LEAK-01 (particle object pooling), which eliminates ~3,360 Graphics create/destroy cycles per hour across smoke and spark systems. The simplest fixes are STAB-01 (modulo wrap on 5 timer accumulators) and STAB-02 (one-line `stream.destroy()` in finally block).

**Primary recommendation:** Implement a shared `GraphicsPool` utility, then refactor `Building.tick()` and `AmbientParticles.tick()` to borrow/return from the pool instead of creating/destroying Graphics objects. Address all other fixes in the same phase since they are independent and each is small.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEAK-01 | Smoke and spark particles use object pooling instead of creating/destroying Graphics objects every tick | GraphicsPool pattern verified with PixiJS 8 GraphicsContext sharing; exact code sites identified in building.ts:358-401 and ambient-particles.ts:215-241 |
| LEAK-02 | Palette swap texture cache destroys textures when agents are removed and uses LRU eviction | palette-swap.ts swapCache (line 11) grows unboundedly; PixiJS 8 texture.destroy() destroys source; canvas cleanup needed; World.removeAgent() is the cleanup trigger point |
| LEAK-03 | GlowFilter GPU resources are explicitly destroyed after celebration effects complete | GlowFilter extends Filter extends Shader; Shader.destroy(destroyPrograms?) releases GPU programs; Container.destroy() does NOT destroy filters; fix needed in Agent.ts:234-237 and Agent.ts:399-403 |
| LEAK-04 | Stale entries in dismissedSessions, mtimeCache, cwdCache, and usageAggregator cache are pruned periodically | dismissedSessions (world.ts:106) is Set with no pruning; mtimeCache/cwdCache (session-detector.ts:30-33) never pruned; UsageAggregator.clearSession() exists but is never called |
| STAB-01 | Timer accumulators use modulo wrap to prevent floating-point precision drift | DayNightCycle.elapsed (day-night-cycle.ts:25), AmbientParticle.phase, DustMote.phase, LeafParticle.phase, Agent.breathTimer -- all grow without bound |
| STAB-02 | JSONL readline streams are properly cleaned up with finally { stream.destroy() } | readUsageTotals (jsonl-reader.ts:146-188) has stream variable but no finally block; existing catch swallows errors without destroying stream |
</phase_requirements>

## Standard Stack

### Core (already installed, no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | 8.16.0 | Graphics, Texture, Container, Shader API for resource management | Already installed; provides destroy(), GraphicsContext sharing, TextureGCSystem |
| pixi-filters | (installed) | GlowFilter extends Shader -- has destroy() method | Already used for LevelUpEffect |
| electron-log | ^5.4 | Phase 23 crash logging infrastructure -- used to verify leak fixes | Already installed from Phase 23 |

### No New Dependencies Needed

All fixes use existing PixiJS 8 and Node.js APIs. No additional npm packages required.

## Architecture Patterns

### Recommended Project Structure

No new files except one utility class:

```
src/renderer/
  graphics-pool.ts       # NEW: GraphicsPool utility for particle reuse
  building.ts            # MODIFY: smoke particles use pool borrow/return
  ambient-particles.ts   # MODIFY: spark particles use pool borrow/return
  palette-swap.ts        # MODIFY: add destroySwappedTextures(), expose cache cleanup
  level-up-effect.ts     # MODIFY: destroy GlowFilter in cleanup method
  agent.ts               # MODIFY: call filter.destroy() before LevelUpEffect destroy
  world.ts               # MODIFY: call palette swap cleanup on removeAgent(), periodic pruning
  day-night-cycle.ts     # MODIFY: modulo wrap in tick()
src/main/
  jsonl-reader.ts        # MODIFY: add finally { stream.destroy() } in readUsageTotals
  session-detector.ts    # MODIFY: expose cache pruning method
  session-store.ts       # MODIFY: call cache pruning periodically
```

### Pattern 1: Graphics Object Pool

**What:** Pre-allocate a fixed pool of Graphics objects. Particles borrow from pool on spawn, return on expiry. No `new Graphics()` or `destroy()` during normal operation.

**When to use:** Any recurring create/destroy pattern for short-lived Graphics (smoke puffs, forge sparks).

**Why this approach over GraphicsContext sharing:** GraphicsContext sharing (PixiJS 8 recommended pattern) is ideal when all instances look identical. Smoke particles change position, alpha, and scale independently, so each needs its own Graphics instance. The pool eliminates allocation/deallocation while allowing independent transforms.

**Example:**
```typescript
// Source: PixiJS 8 performance docs + standard object pool pattern
export class GraphicsPool {
  private available: Graphics[] = [];
  private active: Set<Graphics> = new Set();

  constructor(
    private createFn: () => Graphics,
    initialSize: number,
    private parent: Container,
  ) {
    for (let i = 0; i < initialSize; i++) {
      const gfx = createFn();
      gfx.visible = false;
      parent.addChild(gfx);
      this.available.push(gfx);
    }
  }

  borrow(): Graphics | null {
    const gfx = this.available.pop();
    if (!gfx) return null;
    gfx.visible = true;
    this.active.add(gfx);
    return gfx;
  }

  return(gfx: Graphics): void {
    gfx.visible = false;
    gfx.alpha = 1;
    gfx.scale.set(1, 1);
    gfx.position.set(0, 0);
    this.active.delete(gfx);
    this.available.push(gfx);
  }

  get activeCount(): number { return this.active.size; }
  get totalSize(): number { return this.available.length + this.active.size; }
}
```

**Key reset properties for smoke/spark Graphics:**
- `visible`: false (hide when returned)
- `alpha`: 1 (smoke fades; reset on return)
- `scale`: (1, 1) (smoke grows; reset on return)
- `position`: (0, 0) (reposition on borrow)

**Pool sizing:**
- Smoke: `CHIMNEY_SMOKE_COUNT + SMOKE_NIGHT_COUNT_BONUS` per building = 8 per building x 4 buildings = 32 total
- Sparks: `SPARK_COUNT` = 8 total
- Total: 40 pre-allocated Graphics objects (trivial memory cost)

### Pattern 2: Palette Swap Cache Lifecycle

**What:** When an agent is removed, destroy all cached textures for that agent's characterClass+paletteIndex combo if no other active agent uses the same combo.

**When to use:** When agents are removed via `World.removeAgent()`.

**Implementation detail for PixiJS 8 texture destruction:**
```typescript
// In palette-swap.ts:
export function destroyCachedTextures(
  characterClass: CharacterClass,
  paletteIndex: number,
): void {
  const prefix = `${characterClass}_${paletteIndex}_`;
  for (const [key, textures] of swapCache) {
    if (key.startsWith(prefix)) {
      for (const tex of textures) {
        // destroy(true) in PixiJS 7 destroyed base texture
        // In PixiJS 8: texture.source.destroy() releases the GPU upload
        tex.source?.destroy();
        tex.destroy();
      }
      swapCache.delete(key);
    }
  }
}

// Expose cache size for monitoring
export function getSwapCacheSize(): number {
  return swapCache.size;
}
```

**Important PixiJS 8 detail:** In v8, `Texture.destroy()` does not automatically destroy the `TextureSource` (unlike v7's `BaseTexture`). Must explicitly call `tex.source.destroy()` to release the GPU upload and the backing canvas element. Verified via PixiJS 8 API docs: `texture.source.unload()` removes from GPU while keeping source in memory; `texture.source.destroy()` fully releases it.

### Pattern 3: Filter Cleanup Before Container Destroy

**What:** Explicitly call `filter.destroy()` on all filters before calling `container.destroy()`.

**When to use:** Any time a Container with filters is destroyed (LevelUpEffect cleanup).

**Example:**
```typescript
// In agent.ts, celebration cleanup:
if (this.levelUpEffect) {
  // Destroy filters explicitly -- PixiJS Container.destroy() does NOT destroy filters
  const filters = this.levelUpEffect.filters;
  if (filters) {
    for (const filter of filters) {
      (filter as Filter).destroy();
    }
    this.levelUpEffect.filters = [];
  }
  this.removeChild(this.levelUpEffect);
  this.levelUpEffect.destroy({ children: true });
  this.levelUpEffect = null;
}
```

**Technical detail:** GlowFilter extends Filter extends Shader. `Shader.destroy(destroyPrograms?: boolean)` releases shader program GPU resources. Default is `destroyPrograms = true` when called without arguments. This must happen at both cleanup sites in agent.ts: the `celebrating` state timeout (line 234-237) and `startFadeOut()` (line 399-403).

### Pattern 4: Timer Modulo Wrap

**What:** Replace `accumulator += delta` with `accumulator = (accumulator + delta) % PERIOD` for all bounded-cycle timers.

**When to use:** Any timer that drives a periodic function (sine wave, phase cycle) and has no need to track total elapsed time.

**Affected accumulators (5 total):**

| Accumulator | File | Period Constant | Current Behavior |
|-------------|------|-----------------|------------------|
| `DayNightCycle.elapsed` | day-night-cycle.ts:25 | `DAY_NIGHT_CYCLE_MS` (600,000) | Grows forever; modulo only in getProgress() |
| `AmbientParticle.phase` | ambient-particles.ts:190 | `2 * Math.PI` (~6.283) | Grows forever; used in sin() |
| `DustMote.phase` | ambient-particles.ts:246 | `2 * Math.PI` (~6.283) | Grows forever; used in sin() |
| `LeafParticle.phase` | ambient-particles.ts:266 | `2 * Math.PI` (~6.283) | Grows forever; used in sin() |
| `Agent.breathTimer` | agent.ts:361 | `2 * Math.PI` (~6.283) | Grows forever; used in sin() |

**Note:** `frameTimer` in agent.ts (line 158) already wraps via subtraction (`-= ANIMATION_FRAME_MS`). `smokeTimer` in building.ts (line 355) also wraps via subtraction. These are fine as-is.

### Anti-Patterns to Avoid

- **Do NOT call `global.gc()` or force garbage collection** -- masks root causes, causes animation jank (10-50ms stall)
- **Do NOT destroy and recreate Graphics on every tick** -- this is the pattern we're fixing, not introducing
- **Do NOT use `Graphics.clear()` for pooled particles** -- clearing resets geometry commands but historically had leak issues in PixiJS 8; instead, pre-draw the shape once and only change position/alpha/scale/visible on reuse
- **Do NOT cap swapCache by size alone** -- use session-aware eviction (destroy textures for removed agents) rather than blind LRU, since active agents need their textures

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Particle graphics lifecycle | Manual create/destroy on each tick | GraphicsPool (borrow/return pattern) | PixiJS 8 Graphics allocation involves GPU buffer creation; pooling eliminates this entirely |
| Texture GPU release | Setting textures to null and hoping GC catches them | `texture.source.destroy()` then `texture.destroy()` | PixiJS TextureGCSystem only collects textures unused for 3600 frames (~12 minutes at 5fps idle); explicit destroy is immediate |
| Filter GPU release | Relying on Container.destroy({ children: true }) | Explicit `filter.destroy()` before container.destroy() | Container.destroy() does NOT destroy filters -- PixiJS design decision because filters may be shared |
| Stream cleanup | Hoping `for await...of` closes the stream | `finally { stream.destroy() }` | Node.js async iterator cleanup has documented edge cases; explicit destroy is the only reliable approach |

## Common Pitfalls

### Pitfall 1: Pre-drawing Graphics Shapes at Wrong Time

**What goes wrong:** Creating the pool with `gfx.circle().fill()` in the constructor, then trying to change the shape later by calling `clear()` + `circle()` + `fill()` on borrow -- this is the create/destroy pattern we're avoiding.

**Why it happens:** Developers think pooled Graphics need to be "blank" when returned.

**How to avoid:** Pre-draw the shape (circle with correct color) at pool creation time. On borrow, only change position/alpha/scale/visible. The geometry is immutable across the pool lifecycle. Smoke and sparks are simple circles -- same geometry, different transforms.

**Warning signs:** If you find yourself calling `clear()` on pooled Graphics, you're doing it wrong.

### Pitfall 2: Texture Source vs Texture Destroy in PixiJS 8

**What goes wrong:** Calling only `texture.destroy()` without `texture.source.destroy()` leaves the `ImageSource` (and its backing canvas element) alive in memory. The GPU upload is also retained.

**Why it happens:** In PixiJS 7, `texture.destroy(true)` destroyed the BaseTexture. In PixiJS 8, the Texture and TextureSource are separate objects with independent lifecycles.

**How to avoid:** Always destroy in order: `texture.source.destroy()` then `texture.destroy()`. Or: `texture.destroy(true)` which should propagate in v8 -- but verify in the actual installed version.

**Warning signs:** `document.querySelectorAll('canvas').length` grows after agents are removed.

### Pitfall 3: Destroying Textures Still in Use by Another Agent

**What goes wrong:** Two agents share the same characterClass + paletteIndex (unlikely but possible with the slot system). Destroying the swap cache on the first agent's removal destroys textures the second agent is actively rendering.

**Why it happens:** The swapCache is keyed by class+palette+textureUid -- if two agents have the same class and palette, they share cached textures.

**How to avoid:** Before destroying cached textures, check if any other active agent uses the same class+palette combo. Track reference counts or check the agents Map.

**Warning signs:** Second agent renders as a white/missing rectangle after first agent with same palette is removed.

### Pitfall 4: Missing Filter Cleanup on Agent.startFadeOut()

**What goes wrong:** Only cleaning up the GlowFilter in the `celebrating` state timeout handler (line 234-237), but missing the `startFadeOut()` path (line 399-403) which also destroys the LevelUpEffect.

**Why it happens:** There are two code paths that destroy LevelUpEffect -- easy to fix one and miss the other.

**How to avoid:** Extract a helper method `cleanupLevelUpEffect()` that handles both filter destruction and container destruction. Call it from both the celebrating timeout and startFadeOut().

### Pitfall 5: Pool Size Underestimate Causing Silent Particle Loss

**What goes wrong:** Pool is sized for daytime max particles, but at night `SMOKE_NIGHT_COUNT_BONUS` adds extra particles per building. Pool exhaustion means `borrow()` returns null, and particles silently stop spawning.

**Why it happens:** Night increases max particles from 5 to 8 per building.

**How to avoid:** Size pool to nighttime maximum: `(CHIMNEY_SMOKE_COUNT + SMOKE_NIGHT_COUNT_BONUS) * 4 buildings = 32` for smoke. The `borrow()` returning null is the correct behavior (graceful degradation), but the pool should be large enough that it never happens under normal operation.

## Code Examples

### Smoke Particle Refactoring (Building.tick)

```typescript
// Current pattern (creates/destroys Graphics every tick):
const gfx = new Graphics();
gfx.circle(0, 0, CHIMNEY_SMOKE_SIZE_MIN);
gfx.fill({ color: CHIMNEY_SMOKE_COLOR, alpha: baseAlpha });
// ... later:
p.gfx.destroy();

// New pattern (borrows from pre-allocated pool):
const gfx = this.smokePool.borrow();
if (!gfx) return; // Pool exhausted -- skip this puff
gfx.position.set(chimneyPos.x, chimneyPos.y);
gfx.alpha = baseAlpha;
gfx.scale.set(1, 1);
// ... later:
this.smokePool.return(p.gfx);
// No destroy() call -- Graphics stays alive in pool
```

### DayNightCycle Modulo Fix

```typescript
// Current (grows forever):
tick(deltaMs: number): void {
  this.elapsed += deltaMs;
}

// Fixed (bounded to one cycle):
tick(deltaMs: number): void {
  this.elapsed = (this.elapsed + deltaMs) % DAY_NIGHT_CYCLE_MS;
}

// getProgress() simplifies too:
getProgress(): number {
  return this.elapsed / DAY_NIGHT_CYCLE_MS;
  // No longer needs modulo -- elapsed is already bounded
}
```

### Stream Cleanup Fix (readUsageTotals)

```typescript
// Current (missing finally block):
let stream: fs.ReadStream | null = null;
try {
  stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) { /* ... */ }
} catch {
  // swallows error, stream may not be closed
}

// Fixed (explicit stream.destroy in finally):
let stream: fs.ReadStream | null = null;
try {
  stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) { /* ... */ }
} catch {
  // File doesn't exist, permission error, etc.
} finally {
  if (stream) stream.destroy();
}
```

### Cache Pruning (World.ts periodic cleanup)

```typescript
// Add to World class:
private pruneTimer = 0;
private static readonly PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Call from tick():
private pruneStaleState(deltaMs: number): void {
  this.pruneTimer += deltaMs;
  if (this.pruneTimer < World.PRUNE_INTERVAL_MS) return;
  this.pruneTimer = 0;

  // Prune dismissedSessions older than 30 minutes
  const now = Date.now();
  const cutoff = now - 30 * 60 * 1000;
  // Convert to Map<string, number> to track timestamps (see implementation)

  // Note: mtimeCache and cwdCache pruning happens in main process
  // via session-store.ts calling detector methods
}
```

### Palette Swap Cleanup on Agent Removal

```typescript
// In World.removeAgent(), after agent.destroy():
// Clean up palette swap texture cache for this agent's palette
// Only if no other active agent uses the same class+palette
const shouldCleanup = ![...this.agents.values()].some(
  a => a !== agent &&
    a.characterClass === agent.characterClass &&
    a.paletteIndex === agent.paletteIndex
);
if (shouldCleanup) {
  destroyCachedTextures(agent.characterClass, agent.paletteIndex);
}
```

**Note:** Agent's `characterClass` and `paletteIndex` are currently private. They need to be exposed (readonly properties or getter methods) for World.removeAgent() to use them in cleanup.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PixiJS 7 `BaseTexture.destroy()` | PixiJS 8 `texture.source.destroy()` + `texture.destroy()` | v8.0 (2024) | Must destroy source separately in v8 |
| PixiJS 7 `texture.destroy(true)` destroys base | PixiJS 8 `texture.destroy()` does NOT destroy source by default | v8.0 (2024) | Silent leak if using v7 patterns |
| Graphics.clear() + redraw for reuse | GraphicsContext sharing or object pooling | v8.0 (2024) | clear() had memory leak regressions in v8; pooling avoids the issue entirely |
| PixiJS 7 filters auto-cleanup | PixiJS 8 Container.destroy() does NOT destroy filters | v8.0 (2024) | Must explicitly destroy filters before container |

**Deprecated/outdated:**
- `@pixi-essentials/object-pool`: Third-party pool package -- not needed; simple custom pool is sufficient for 40 objects
- `global.gc()` for memory management: Anti-pattern; masks leaks, causes jank

## Open Questions

1. **Does `texture.destroy(true)` propagate to source in PixiJS 8.16.0?**
   - What we know: v8 API docs say `texture.destroy()` does not destroy source by default. The `true` parameter behavior in v8 is unclear from docs.
   - What's unclear: Whether passing `true` to `texture.destroy(true)` in v8 also calls `texture.source.destroy()`.
   - Recommendation: Explicitly call `texture.source.destroy()` then `texture.destroy()` to be safe. Verify during implementation by checking `swapCache` entries after cleanup -- the canvas element count should decrease.

2. **Can smoke Graphics be pre-drawn with a fixed alpha, then have alpha changed via the property?**
   - What we know: Graphics fill alpha is part of the geometry context. The `gfx.alpha` property is a Container-level alpha multiplier applied during rendering.
   - What's unclear: Whether changing `gfx.alpha` on a pre-drawn circle produces the same visual result as drawing with `{ alpha: 0.6 }` in the fill.
   - Recommendation: Pre-draw with `alpha: 1` in fill, then use `gfx.alpha = baseAlpha * (1 - lifeT)` for runtime fade. The container alpha multiplies the fill alpha, so pre-drawing at alpha 1 and using container alpha gives the same result.

3. **Should `dismissedSessions` be converted from `Set<string>` to `Map<string, number>` for timestamp-based pruning?**
   - What we know: Current Set has no timestamps. Pruning by age requires knowing when each entry was added.
   - What's unclear: Whether simple size-based pruning (cap at N entries) is sufficient vs. time-based pruning.
   - Recommendation: Convert to `Map<string, number>` (sessionId -> dismissalTimestamp). Prune entries older than 30 minutes on each updateSessions() call. This is a minor change -- the Map API is nearly identical to Set for `has()` and `delete()`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via Electron Forge) |
| Config file | Built into forge.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEAK-01 | GraphicsPool borrow/return cycle maintains fixed pool size | unit | `npm test -- --testPathPattern=graphics-pool` | No -- Wave 0 |
| LEAK-01 | Smoke particles use pool (no new Graphics in tick) | manual-only | Inspect DevTools: no increasing Graphics count | N/A |
| LEAK-02 | destroyCachedTextures removes entries and destroys sources | unit | `npm test -- --testPathPattern=palette-swap` | No -- Wave 0 |
| LEAK-02 | Cache size decreases after agent removal | manual-only | Log swapCache.size before/after removeAgent | N/A |
| LEAK-03 | LevelUpEffect cleanup destroys filters | unit | `npm test -- --testPathPattern=level-up` | No -- Wave 0 |
| LEAK-04 | dismissedSessions prunes entries older than threshold | unit | `npm test -- --testPathPattern=world` | No -- Wave 0 |
| STAB-01 | DayNightCycle.elapsed stays bounded after many ticks | unit | `npm test -- --testPathPattern=day-night` | No -- Wave 0 |
| STAB-02 | readUsageTotals destroys stream on error | unit | `npm test -- --testPathPattern=jsonl-reader` | Yes -- jsonl-reader.test.ts exists |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual verification of memory stability

### Wave 0 Gaps
- [ ] `src/renderer/graphics-pool.test.ts` -- covers LEAK-01 pool mechanics
- [ ] `src/renderer/palette-swap.test.ts` -- covers LEAK-02 cache cleanup (may need mocking for PixiJS Texture)
- [ ] `src/renderer/day-night-cycle.test.ts` -- covers STAB-01 modulo wrap
- [ ] Extend `src/main/jsonl-reader.test.ts` -- covers STAB-02 stream cleanup on error

Note: Several tests require PixiJS mocking (Graphics, Texture, Container) since tests run in Node.js, not a browser. Phase 23 tests (game-loop.test.ts, memory-monitor.test.ts) established patterns for mocking PixiJS -- follow the same approach.

## Sources

### Primary (HIGH confidence)
- [PixiJS 8.x Graphics API](https://pixijs.com/8.x/guides/components/scene-objects/graphics) -- GraphicsContext sharing, destroy() options
- [PixiJS 8.x Garbage Collection Guide](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- TextureGCSystem config (textureGCActive, textureGCMaxIdle=3600 frames, textureGCCheckCountMax=600 frames)
- [PixiJS 8.x Textures Guide](https://pixijs.com/8.x/guides/components/textures) -- texture.destroy(), texture.source.destroy(), Assets.unload()
- [PixiJS Shader.destroy() API](node_modules/pixi.js/lib/rendering/renderers/shared/shader/Shader.d.ts) -- `destroy(destroyPrograms?: boolean)` confirmed in installed v8.16.0 type definitions
- [PixiJS Graphics.destroy() API](node_modules/pixi.js/lib/scene/graphics/shared/Graphics.d.ts) -- `destroy(options?: DestroyOptions)` with context option; confirmed `clear()` warning about continuous clear/redraw
- Direct codebase analysis of all source files in `src/` -- exact line numbers for every leak site

### Secondary (MEDIUM confidence)
- [PixiJS #11407](https://github.com/pixijs/pixijs/issues/11407) -- AnimatedSprite lacks destroyTexture option in v8 (confirmed: assigning new textures does not destroy old ones)
- [PixiJS #10549](https://github.com/pixijs/pixijs/issues/10549) -- Graphics clear()+redraw memory leak (fixed in 8.12.0)
- [PixiJS #11550](https://github.com/pixijs/pixijs/issues/11550) -- Graphics WebGL memory leak regression (fixed in 8.12.0+)
- [Node.js #1834](https://github.com/nodejs/node/issues/1834) -- createReadStream file descriptor leak on abort

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all fixes use existing installed APIs verified against type definitions
- Architecture: HIGH -- every leak source identified with exact file:line references; fix patterns verified against PixiJS 8 API
- Pitfalls: HIGH -- five pitfalls identified from codebase analysis and PixiJS v7->v8 API changes; each has prevention strategy
- Validation: MEDIUM -- unit tests require PixiJS mocking; manual verification of GPU memory is subjective; Phase 23 MemoryMonitor provides objective heap tracking

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain; PixiJS 8 API is settled)

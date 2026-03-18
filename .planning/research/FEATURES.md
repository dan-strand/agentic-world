# Feature Research

**Domain:** Performance optimization for Electron + PixiJS 8 always-on desktop visualizer
**Researched:** 2026-03-18
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Must-Fix for Performance Milestone)

These are the optimizations that address measurable, high-impact inefficiencies. Skipping any of these would make the "performance milestone" label misleading.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Replace stage ColorMatrixFilter with per-container tints | Stage-level filter forces an extra GPU render pass every frame (render scene to texture, apply filter, composite back). PixiJS 8 Container.tint is inherited by children and costs zero extra render passes -- it multiplies color during the existing batch draw. This is the single highest GPU cost in the app. | MEDIUM | PixiJS 8 tint accepts hex values. Day tint ~0xFFE8C0, night tint ~0x8090CC. Convert DayNightCycle.getTintRGB() output to a single hex tint and apply to worldContainer. Requires careful color math: tint is multiplicative (R*tint_r/255, etc.), which is exactly what the ColorMatrixFilter matrix was doing. |
| Day/night threshold-gated updates | Currently recalculates and reassigns ColorMatrixFilter matrix + all glow alphas on every frame (30fps = 30 recalcs/sec). Night intensity changes by ~0.0005 per frame -- imperceptible. Gate updates on a delta threshold (e.g., 0.01 change) to skip 98% of frames. | LOW | Store lastNightIntensity, compare abs(current - last) > threshold before applying. Trivial implementation, meaningful GPU savings from avoiding tint/glow updates on frames where nothing visibly changed. |
| Particle throttling at idle FPS | At idle (5fps), ambient particles (fireflies, sparks, dust motes, leaves = 54 objects) still run full physics simulation every frame. At 5fps the visual quality is already degraded, so updating particles every other frame or skipping subsystems entirely wastes CPU for invisible benefit. | LOW | Add frame counter or check ticker FPS. When idle, either skip particle tick entirely (freeze in place) or update every Nth frame. Sparks and smoke especially waste cycles when nobody is watching closely. |
| Combined JSONL file reads | Session detector reads the same JSONL file twice per poll: once via readLastJsonlLine() for status detection, once via readLastToolUse() for activity type. Both open the file, read 64KB from the tail, parse lines, and close. Combining into a single read eliminates one open/read/close syscall per session per poll cycle. | LOW | Refactor to a single readSessionTail() that returns both lastEntry and lastToolName from one 64KB buffer read. Straightforward extraction. |
| Async session discovery | discoverSessions() uses fs.existsSync, fs.readdirSync, fs.statSync -- all synchronous and blocking the main Electron process event loop. With many project directories and JSONL files, this blocks IPC, timers, and all async I/O for the duration of the scan. | MEDIUM | Convert to fs.promises.readdir, fs.promises.stat, etc. Requires changing the SessionDetector interface from sync to async (returns Promise<SessionInfo[]>), and updating SessionStore.poll() accordingly. The poll() method is already async so the change propagates naturally. |
| Incremental JSONL usage parsing | readUsageTotals() reads the entire JSONL file (2-18MB) from byte 0 on every mtime change. For an active session that changes every few seconds, this means re-parsing megabytes of already-processed data. Store the byte offset of the last parse and resume from there on next read. | MEDIUM | Track { mtimeMs, byteOffset, partialTotals } in UsageAggregator cache. On mtime change, open file, seek to byteOffset, read only new bytes, parse new lines, accumulate into partialTotals. Falls back to full re-read if file shrinks (truncation). Saves 90%+ of I/O for active sessions. |

### Differentiators (High-Value, Nice-to-Have)

These optimizations address real inefficiencies but are lower impact. They improve the "always-on viability" story and prevent future scaling issues.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Night glow change guards | updateNightGlowLayer() iterates 19+ glow sprites and sets alpha every frame. When nightIntensity hasn't changed (gated by threshold above), these writes are wasteful. Guard with a dirty flag. | LOW | Already gated if day/night threshold is implemented -- this becomes a natural consequence. Apply the same threshold check before calling updateNightGlowLayer(). Near-zero additional code. |
| Per-agent state consolidation | Each agent tracks idle timers, waiting timers, reminder flags, and debounce state across 6+ separate Maps in World (idleTimers, waitingTimers, hasPlayedReminder, hasPlayedWaitingReminder, lastCommittedStatus, statusDebounce). Map lookups per agent per frame add up. Consolidate into a single Map<string, AgentTickState>. | LOW | Create AgentTickState interface with all per-agent timing fields. Single Map lookup per agent per tick instead of 6+. Reduces hash computations and improves cache locality. No behavioral change. |
| Building highlight caching | Every frame, the tick loop iterates all agents to build an activeBuildings Set, then iterates all buildings to set tint. Most frames the set is identical. Cache the previous set and skip if unchanged. | LOW | Store previous activeBuildings set. Compare size + membership before applying tints. Skip the building tint loop on ~99% of frames. |
| Poll interval backoff | Session store polls every 3s regardless of activity. When no sessions exist or all are idle, polling at 3s wastes filesystem I/O. Back off to 10-15s when idle, snap back to 3s when activity detected. | LOW | Track consecutive no-change polls. After N consecutive idle polls, increase interval. Reset on any change detection. Use clearInterval/setInterval swap or dynamic setTimeout chain. |
| Swap-and-pop particle removal | Smoke particles and spark particles use Array.splice(i, 1) for removal, which is O(n) -- shifts all subsequent elements. Swap with last element and pop() is O(1). For particle arrays of 8-15 elements this is micro-optimization, but it is the correct pattern. | LOW | Replace `this.smokeParticles.splice(i, 1)` with `this.smokeParticles[i] = this.smokeParticles[this.smokeParticles.length - 1]; this.smokeParticles.pop();`. Particle order does not matter for rendering. Applied in both Building.tick() and AmbientParticles.tick(). |
| DOM diffing for dashboard | DashboardPanel.renderSessions() calls `sessionList.innerHTML = ''` and rebuilds all DOM elements from scratch on every update. With 3-8 sessions updating every 3s, this triggers full layout reflow. Targeted updates (modify existing elements) avoid reflow. | MEDIUM | Two approaches: (1) Keyed update -- keep references to session row elements, update text content in-place when data changes, only add/remove rows for new/removed sessions. (2) Use morphdom library for automatic DOM diffing. Approach (1) is preferred -- no dependency, simpler, and the session list is small enough that manual keying works well. |

### Anti-Features (Commonly Suggested, Often Problematic)

Features that seem like good performance optimizations but create problems in this specific context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| PixiJS ParticleContainer for ambient effects | PixiJS 8 ParticleContainer is optimized for thousands of particles with minimal overhead. Seems like a natural fit for fireflies/sparks. | The app has only 54 total particles (25 fireflies + 8 sparks + 15 dust motes + 6 leaves). ParticleContainer strips features (no nested children, limited blend modes, no Graphics -- only Sprites). Converting Graphics particles to Sprites requires texture atlas changes. The overhead of ParticleContainer setup exceeds savings at this scale. | Keep current Graphics-based particles with GraphicsPool. The pool already eliminates create/destroy churn. Focus on throttling updates at idle FPS instead. |
| Web Workers for JSONL parsing | Move JSONL parsing off the main thread to avoid blocking. | Electron's main process already runs Node.js I/O on the threadpool for async operations. The real problem is synchronous fs calls, not CPU-bound parsing. Worker threads add serialization overhead for transferring results back. readUsageTotals already uses streaming readline which is non-blocking. | Convert sync fs calls to async (the actual blocker). Incremental parsing reduces the total work regardless of thread. |
| cacheAsTexture for static layers | PixiJS 8 supports cacheAsTexture() which renders a container to a texture for reuse. Seems ideal for the static tilemap and scenery. | The tilemap is already a canvas-rendered static sprite (single texture). Scenery layer has 96 sprites but they're already batched efficiently by PixiJS. cacheAsTexture adds VRAM cost for the cached texture and prevents any future modifications. The day/night tint needs to apply to these layers, which would require re-caching on every tint change. | Keep current structure. The tilemap is already effectively cached. Apply tint to containers (inherited tint works without caching). |
| RequestAnimationFrame throttling bypass | Override PixiJS ticker to use custom RAF scheduling for finer FPS control. | PixiJS 8's ticker already supports maxFPS which does exactly this. The app already has adaptive FPS (30/5/0). Custom RAF adds complexity for no benefit. | Continue using app.ticker.maxFPS with the existing GameLoop adaptive system. |
| Debouncing all IPC messages | Batch and debounce all renderer-bound IPC to reduce message frequency. | The app already only sends IPC updates when data changes (SessionStore.poll checks hasChanges). Dashboard updates are coupled to session changes, not to a timer. Adding debouncing would delay status updates and make the visualizer feel laggy. | Keep the current change-detection-gated IPC. The real improvement is reducing the work done per poll (async I/O, combined reads), not the frequency of IPC messages. |
| Offscreen canvas for day/night tinting | Pre-render the entire scene to an offscreen canvas and apply color matrix there. | This reimplements what ColorMatrixFilter already does, just in software instead of GPU. It would be slower, not faster. The actual fix (Container.tint) eliminates the need for any post-processing. | Use PixiJS 8 Container.tint which applies tinting during the normal render batch at zero additional cost. |

## Feature Dependencies

```
[Replace ColorMatrixFilter with tints]
    |
    +--enables--> [Day/night threshold-gated updates]
    |                  |
    |                  +--enables--> [Night glow change guards]
    |
    +--independent-of--> [Particle throttling at idle FPS]
    +--independent-of--> [Combined JSONL file reads]
    +--independent-of--> [Async session discovery]
    +--independent-of--> [Incremental JSONL parsing]

[Combined JSONL file reads]
    +--should-precede--> [Async session discovery]
         (refactor reads first, then make them async)

[Incremental JSONL parsing]
    +--independent-of--> [Combined JSONL file reads]
         (different files: tail buffer vs full-file usage parsing)

[Per-agent state consolidation]
    +--independent-of--> all other features
    +--simplifies--> [Building highlight caching]
         (both touch the per-tick agent iteration loop)

[Swap-and-pop particle removal]
    +--independent-of--> [Particle throttling at idle FPS]
         (can be applied together or separately)

[DOM diffing for dashboard]
    +--independent-of--> all GPU/renderer optimizations
    +--independent-of--> all I/O optimizations

[Poll interval backoff]
    +--should-follow--> [Async session discovery]
         (backoff logic is simpler with async polling)
```

### Dependency Notes

- **ColorMatrixFilter removal enables threshold gating:** The tint approach changes the mechanism from setting a 20-element float matrix to setting a single hex integer. Threshold gating works with either approach, but the tint path makes it trivially cheap to skip (one comparison vs matrix comparison).
- **Combined JSONL reads should precede async conversion:** Refactoring the read logic into a single function first, then converting that function to async, is cleaner than converting two separate sync functions to async and then combining them.
- **Incremental parsing is independent of combined reads:** readUsageTotals parses the entire file for token aggregation (different from the 64KB tail buffer reads for status/tool detection). These are separate code paths targeting different files at different frequencies.
- **DOM diffing is fully independent:** Dashboard runs in the renderer DOM, completely separate from the PixiJS canvas and main process I/O. Can be implemented in any order.

## Phased Implementation Recommendation

### Phase A: High-Impact GPU + Rendering (Do First)

Eliminates the most visible performance issue (GPU render pass) and gates all subsequent visual optimizations.

- [x] Replace stage ColorMatrixFilter with per-container tints
- [x] Day/night threshold-gated updates (including night glow guards)
- [x] Building highlight caching

### Phase B: I/O Optimization (Do Second)

Reduces filesystem pressure in the main process, which is the primary source of event loop blocking.

- [x] Combined JSONL file reads
- [x] Async session discovery
- [x] Incremental JSONL usage parsing
- [x] Poll interval backoff

### Phase C: Micro-Optimizations (Do Last)

Smaller gains that clean up code patterns. Low risk, low effort.

- [x] Particle throttling at idle FPS
- [x] Per-agent state consolidation
- [x] Swap-and-pop particle removal
- [x] DOM diffing for dashboard

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Replace ColorMatrixFilter with tints | HIGH | MEDIUM | P1 |
| Day/night threshold-gated updates | HIGH | LOW | P1 |
| Async session discovery | HIGH | MEDIUM | P1 |
| Incremental JSONL parsing | HIGH | MEDIUM | P1 |
| Combined JSONL file reads | MEDIUM | LOW | P1 |
| Night glow change guards | MEDIUM | LOW | P2 |
| Particle throttling at idle FPS | MEDIUM | LOW | P2 |
| Per-agent state consolidation | LOW | LOW | P2 |
| Building highlight caching | LOW | LOW | P2 |
| Poll interval backoff | MEDIUM | LOW | P2 |
| Swap-and-pop particle removal | LOW | LOW | P3 |
| DOM diffing for dashboard | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Addresses the highest-impact bottlenecks (GPU doubling, main process blocking, redundant I/O)
- P2: Meaningful improvement, should be included in milestone
- P3: Correct pattern but minimal real-world impact at current scale

## Existing Patterns to Preserve

These patterns are already well-implemented and should not be modified during the optimization pass:

| Pattern | Where | Why Keep |
|---------|-------|----------|
| Adaptive FPS (30/5/0) | GameLoop | Already optimal. 0fps when minimized is excellent for always-on. |
| GraphicsPool particle pooling | GraphicsPool, AmbientParticles, Building | Eliminates GC churn. Pool sizes are correctly tuned. |
| Mtime-based file caching | SessionDetector, UsageAggregator | Correct pattern. Optimization builds on top of this (incremental parsing). |
| Palette swap texture cache | palette-swap.ts | Textures cached after first creation. No redundant work. |
| Static tilemap as single sprite | tilemap-builder.ts | Already effectively a cached texture. No optimization needed. |
| eventMode='none' on static layers | night-glow-layer.ts, scenery | Prevents event system traversal. Correct pattern. |
| Status debouncing (2.5s) | World.tick | Prevents visual flickering. Timing is well-tuned. |
| Streaming readline for usage | jsonl-reader.ts readUsageTotals | Non-blocking I/O. Incremental parsing improves this further. |

## Sources

- [PixiJS 8 Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) -- Official guidance on filter costs, batching, interactiveChildren
- [PixiJS 8 Filters Guide](https://pixijs.com/8.x/guides/components/filters) -- Filter render pipeline: breaks batch, measures bounds, renders to texture, composites back
- [PixiJS 8 Scene Objects](https://pixijs.com/8.x/guides/components/scene-objects) -- Container.tint is inherited by children, no extra render pass
- [PixiJS 8 Container API](https://pixijs.download/release/docs/scene.Container.html) -- tint property accepts ColorSource, getGlobalTint() method
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance) -- Avoid sync I/O in main process, use fs.promises
- [Swap-and-Pop Pattern](https://www.30secondsofcode.org/js/s/fast-remove-array-element/) -- O(1) removal for unordered arrays
- [morphdom DOM Diffing](https://github.com/patrick-steele-idem/morphdom) -- Lightweight DOM diffing library (reference only, manual keying preferred)

---
*Feature research for: v2.2 Performance Optimization milestone*
*Researched: 2026-03-18*

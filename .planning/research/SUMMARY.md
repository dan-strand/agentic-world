# Project Research Summary

**Project:** Agent World v2.2 — Performance Optimization
**Domain:** Electron + PixiJS 8 always-on desktop visualizer — rendering and I/O optimization
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

Agent World v2.2 targets a well-scoped set of performance inefficiencies uncovered by a prior 4-agent audit. The work falls into two independent tracks: GPU/rendering optimizations in the PixiJS renderer process, and I/O optimizations in the Electron main process. Every optimization uses APIs already available in the installed stack (PixiJS 8.16.0, Node.js 20.x via Electron 40.6.1) — zero new dependencies are required. The research identifies 12 concrete changes, of which 5 are P1 (highest-impact bottlenecks), 6 are P2 (meaningful improvements), and 1 is P3 (correct pattern, marginal impact at current scale).

The highest-impact single change is replacing the stage-level `ColorMatrixFilter` with `Container.tint`. Any filter on `app.stage` forces PixiJS to render the entire scene to an off-screen framebuffer, apply a shader pass, then composite back to screen — doubling GPU work every frame. PixiJS 8's inherited `Container.tint` applies color multiplication during the normal draw batch at zero additional cost. On the I/O side, the main process blocks its event loop with synchronous `readdirSync`/`statSync`/`readSync` calls every 3 seconds; converting to `fs.promises` equivalents unblocks IPC, timers, and all async I/O without changing the logical flow. Incremental JSONL parsing (reading only newly appended bytes instead of the full 2–18MB file on each mtime change) is the second major I/O win.

The primary risks are visual regressions from the filter-to-tint migration, and correctness regressions in incremental JSONL parsing. Both are fully manageable with targeted mitigation: screenshot baselines at 5+ day/night cycle points before replacing the filter, and truncation/inode detection built before the offset logic. The implementation order should prioritize I/O changes first (isolated to the main process, no visual risk) before touching the GPU pipeline.

## Key Findings

### Recommended Stack

No new packages are needed. All 12 optimizations use existing APIs verified against official documentation.

**Core APIs in use:**
- `Container.tint` (PixiJS 8.0.0+): Replaces `ColorMatrixFilter` — inherited by all children, applied during the normal draw batch with no additional render pass. Accepts hex integers, strings, or RGB arrays.
- `Container.cacheAsTexture()` (PixiJS 8.x): Renders static containers to a single GPU texture. Appropriate for tilemap and scenery layers (never change after init); NOT for the night glow layer (updates every tick).
- `fs.promises` (Node.js 10+): Async equivalents of every sync call in `session-detector.ts`. Same API shape, non-blocking.
- `fs.createReadStream({ start: offset })` (Node.js 0.x+): Enables incremental JSONL parsing by seeking to the byte position of the last completed read.
- `app.ticker.maxFPS` (PixiJS 8.x): Already in use for adaptive FPS. The existing `GameLoop.isIdle` flag gates particle throttling decisions with no new infrastructure.

**Version compatibility:** All APIs confirmed available against installed versions. No version-gating required.

### Expected Features

**Must have (table stakes for the performance milestone):**
- Replace stage `ColorMatrixFilter` with `Container.tint` — eliminates the double render pass; the single highest-impact GPU optimization
- Day/night threshold-gated updates — skip ~98% of frames where nightIntensity change is imperceptible (threshold 0.005)
- Async session discovery — unblocks main process event loop during the 3-second poll cycle
- Incremental JSONL usage parsing — reduces per-poll I/O from 2–18MB full re-stream to typically 1–50KB delta read
- Combined JSONL tail reads — single `readSessionTail()` replaces two separate file opens per session per poll

**Should have (meaningful, included in milestone):**
- Night glow change guards — dirty flag prevents 19+ alpha writes per tick when intensity is unchanged
- Building highlight caching — `highlightsDirty` flag prevents per-tick agent iteration on stable state
- Poll interval backoff — reduce idle polling to 5–10s maximum (with immediate reset on activity detection)
- Particle throttling at idle FPS — skip smoke and spark subsystems at idle; keep the 54 ambient particles running (54 particles is too cheap to throttle)
- Swap-and-pop particle removal — O(1) vs. O(n) splice for small particle arrays
- DOM diffing for dashboard — in-place text updates instead of `innerHTML = ''` full rebuild

**Defer (P3 / post-milestone):**
- Per-agent state consolidation into `AgentTrackingState` — correct refactor but touches 13+ Maps and dozens of access sites; do after all other optimizations are stable to avoid merge conflicts

**Anti-features confirmed by research (do not implement):**
- `@pixi/tilemap` — incompatible with Electron Webpack (v1.1 decision); `cacheAsTexture` achieves the same result
- Web Workers for JSONL parsing — the bottleneck is sync I/O, not CPU; worker serialization overhead exceeds savings for delta reads
- `ParticleContainer` for ambient effects — only 54 particles; `ParticleContainer` strips features and its setup cost exceeds gains at this scale
- Combining detector tail-reads with aggregator full-reads — different data volumes, different cache semantics; combining risks cache coherence bugs and forces O(n) cost on every poll

### Architecture Approach

The 12 optimizations divide cleanly along process boundaries. I/O changes live entirely in the main process (`session-detector.ts`, `jsonl-reader.ts`, `usage-aggregator.ts`, `session-store.ts`) and carry no visual risk. GPU/rendering changes live in the renderer process (`world.ts`, `day-night-cycle.ts`, `night-glow-layer.ts`) and require visual regression testing. The dependency graph is shallow: the only hard ordering constraint is that the combined JSONL read refactor (#5) should precede the async conversion (#6) — refactor first, then make it async.

**Major components and what touches them:**

1. `FilesystemSessionDetector` / `jsonl-reader.ts` — Combined tail read, async conversion, incremental parsing. The hot path for main-process I/O.
2. `UsageAggregator` — Incremental parsing with extended cache shape: `{ mtimeMs, totals, byteOffset, ino }`.
3. `SessionStore` — Dynamic poll interval with `consecutiveEmpty` counter and `setTimeout` chain replacing `setInterval`.
4. `World` / `DayNightCycle` — Filter removal, tint update with threshold gate, glow guards, building highlight dirty flag. The hot path for renderer CPU/GPU.
5. `AmbientParticles` / `Building` — Idle throttling for smoke/sparks; swap-and-pop removal.
6. `DashboardPanel` — In-place DOM updates with event delegation preserving click-to-expand state.

### Critical Pitfalls

1. **Visual regression from filter-to-tint migration** — `ColorMatrixFilter` operates post-composite on the full stage; `Container.tint` is applied per-child before compositing. The night tint uses `NIGHT_TINT_B = 1.1` (boosting blue above 1.0), which `tint` cannot reproduce (clamped to 0–1). Screenshot baseline at 5+ cycle points before any code changes; clamp RGB multipliers to 1.0; apply day/night tint to a world container that excludes the agents container (or compensate agent status tints).

2. **Compound tint multiplication darkens agent status colors** — Parent day/night tint multiplies with child status tints: warm day tint × agent waiting-blue = muddy result; dark night tint × active building warm-highlight = near-invisible. Decide tinting strategy before Phase 2: either apply day/night tint only to the background containers (tilemap, buildings, scenery) and exempt agents, or accept the color shift and verify distinguishability at all 5 cycle points.

3. **Async I/O race conditions in session discovery** — Converting `readdirSync` to `await readdir` introduces TOCTOU windows and non-deterministic ordering. Use sequential `for...of` + `await` (not `Promise.all`) for the outer project-directory scan; handle `ENOENT` at every `await stat`/`await read` site; capture mtime from a single `stat()` call and use it atomically for both the cache check and cache write.

4. **Incremental JSONL offset tracking breaks on truncation and file replacement** — Stored offset points past end-of-file after truncation; new file content is silently skipped after rotation (delete + create). Check `stat.size < storedOffset` (truncation) AND `stat.ino !== cachedIno` (replacement) before every incremental read; fall back to full re-parse on either condition.

5. **Dirty-flag threshold too large causes visible color stepping at dawn/dusk** — The sine-wave derivative peaks at transitions; a threshold of 0.01 produces visible jumps during the 30–60 second transition windows. Use threshold 0.005 or a per-channel integer comparison (update when any 0–255 channel value changes by >= 1). Verify with a screen recording at 2x speed through a full 10-minute cycle.

## Implications for Roadmap

Based on research, the process-boundary isolation, dependency graph, and risk profiles suggest a 4-phase structure. This matches both the FEATURES.md phased recommendation and the ARCHITECTURE.md build order.

### Phase 1: I/O Pipeline (Main Process)

**Rationale:** Main process changes are fully isolated from the renderer. No visual risk. Unblocking the event loop benefit is immediately measurable. Doing I/O first also establishes a stable async foundation before the higher-risk renderer changes.

**Delivers:** Non-blocking session polling; 50% reduction in per-session syscalls per poll; 90%+ reduction in bytes read for usage aggregation on large JSONL files; adaptive idle polling reducing filesystem pressure to near-zero.

**Implements from FEATURES.md:** Combined JSONL tail read (`readSessionTail()`), async `discoverSessions()` with `fs.promises`, incremental usage parsing, poll backoff (5–10s hard cap, instant reset on activity).

**Avoids:** TOCTOU race conditions (sequential `for...of` over project dirs), cache desync between detector and aggregator reads (keep them separate), offset corruption after truncation/rotation (size + inode checks before every incremental read), excessive backoff latency (5–10s cap prevents the session-appears-to-be-broken UX pitfall).

### Phase 2: GPU / Render Pipeline

**Rationale:** Highest visual impact (eliminates double render pass every frame) but highest visual regression risk. Must be done with a screenshot baseline in place. Independent of Phase 1 — could run in parallel if desired, but sequential is safer.

**Delivers:** Elimination of the off-screen framebuffer render pass; threshold-gated tint updates reducing GPU writes by ~98% on plateau frames; glow layer updates skipped when intensity is unchanged; static layers cached to single textures.

**Implements from FEATURES.md:** Remove `ColorMatrixFilter` from `app.stage`; add `DayNightCycle.getTintHex()`; apply day/night tint to world container (not stage, not agents container); cache last tint hex and skip assignment when unchanged; night glow alpha guard; `cacheAsTexture()` for tilemap and scenery layers.

**Avoids:** Visual regression from filter vs. tint compositing difference (screenshot baseline + 5-point comparison after migration), compound tint multiplication on agent status colors (world-container-level tint, agents exempted), color stepping at transitions (threshold <= 0.005), mistakenly caching the night glow layer (updates every tick — do not cache).

### Phase 3: CPU Tick Loop Micro-Optimizations

**Rationale:** Smaller individual gains but cumulative benefit for the always-on steady-state. Low risk. Can be reviewed as a single pass.

**Delivers:** Building highlight iteration eliminated on ~99% of ticks; ambient particle subsystems (smoke, sparks) skipped at idle FPS; O(1) particle removal; dashboard renders without full reflow on every 3-second update.

**Implements from FEATURES.md:** Building highlight `highlightsDirty` flag, `ambientParticles.tick(deltaMs, nightIntensity, isIdle)` with idle skip for smoke/sparks only (NOT fireflies/dust/leaves — too cheap to throttle and visually jerky if skipped), `swapRemove()` helper with reverse-iteration invariant, dashboard in-place DOM updates with event delegation.

**Avoids:** Particle jerkiness from over-throttling (do NOT skip fireflies/dust/leaves — 54 particles costs < 1ms/frame), swap-and-pop in forward-iteration loops (extract helper, enforce reverse-loop invariant comment), dashboard click-to-expand state loss (event delegation + in-place text mutation, not element replacement; expanded rows must survive 3+ data update cycles).

### Phase 4: Structural Refactor (Agent State Consolidation)

**Rationale:** Correctness improvement and maintenance simplification, but touches 13+ Maps and dozens of access sites in `world.ts`. Must come last to avoid merge conflicts with the tick-loop changes in Phase 3.

**Delivers:** Single `Map<string, AgentTrackingState>` replacing 13+ separate Maps; single `this.agentStates.delete(sessionId)` replacing 13 individual deletes on agent removal; improved cache locality for per-agent tick operations.

**Implements from FEATURES.md:** `AgentTrackingState` interface bundling agent, speechBubble, timers, debounce, and status fields; all tick-loop access sites updated to read through the consolidated object.

**Avoids:** Merge conflicts with Phase 3 changes (must be last); behavioral regressions from the wide refactor (no logic changes, only data structure consolidation).

### Phase Ordering Rationale

- **I/O before GPU:** Main process isolation means Phase 1 can be validated and confirmed stable before introducing the higher-risk renderer changes in Phase 2. The async refactor also has no visual side effects to debug in parallel with color regression investigations.
- **Combined read before async conversion:** Refactor `readSessionTail()` into a single-file-open function first, then convert that one function to async — cleaner than converting two separate sync functions to async and then merging them.
- **GPU before CPU micro-opts:** The filter removal changes the tint update mechanism. Threshold-gating and glow guards build directly on the new tint path; implementing them on the old filter path would require rework.
- **State consolidation last:** Widest code surface area in the codebase. Every other optimization that touches `world.ts` should be committed and stable before this refactor.

### Research Flags

Phases needing care during implementation (not additional research, but deliberate decisions):

- **Phase 2 (GPU — visual regression):** Requires a screenshot baseline at 5+ day/night cycle points before any code changes. The compound tint multiplication with agent status tints requires a deliberate design decision (exempt agents container from day/night tint, or accept color shift and verify distinguishability). Decide before writing any code.
- **Phase 1 (I/O — incremental parsing):** Truncation and inode detection must be implemented before the offset logic, not after. The truncation fallback is the safety net for everything else in the incremental path.

Phases with standard patterns (no additional research needed):

- **Phase 1 (async I/O):** `fs.promises` is well-documented with official examples. The sequential-`for...of` pattern for async directory scanning is established.
- **Phase 3:** Dirty flags, swap-and-pop, idle FPS gating, and DOM in-place updates are all documented patterns with clear implementations in ARCHITECTURE.md.
- **Phase 4:** Straightforward interface extraction and Map consolidation. No novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs verified against official PixiJS 8 docs and Node.js docs. Zero new dependencies. Version compatibility confirmed for all 8 APIs used. |
| Features | HIGH | Prioritization grounded in measured bottlenecks from prior audit. Anti-features validated with technical rationale. P1/P2/P3 distinctions are defensible. |
| Architecture | HIGH | Based on direct source code analysis of all affected files plus official documentation. Integration points and data flow changes specify actual line numbers. |
| Pitfalls | HIGH | 11 pitfalls identified, each verified against official documentation or primary source analysis. Includes concrete warning signs, verification steps, and recovery strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Acceptable visual delta for night colors:** The filter-to-tint migration will produce slightly less-vivid night colors (blue channel cannot exceed 1.0 with tint). Whether to compensate with brighter night glow halos or accept the visual change is a product decision. Decide before Phase 2 begins.
- **Agent tint strategy during day/night:** Three options exist — (1) exempt agents container from day/night tint, (2) accept compound multiplication and verify status-color distinguishability at all cycle points, or (3) compensate agent status tints mathematically. Research identifies all three as viable; the right choice depends on visual preference. Decide before Phase 2 implementation.
- **`cacheAsTexture` discrepancy:** STACK.md recommends it for static layers; FEATURES.md lists it as an anti-feature citing day/night tint interaction. The correct resolution: `cacheAsTexture` works correctly with parent-tint inheritance (the cache stores untinted content; the parent tint is applied at compositing time). FEATURES.md's concern is moot once day/night tint is applied at the container level rather than via a stage filter. Implement `cacheAsTexture` for tilemap and scenery layers in Phase 2.

## Sources

### Primary (HIGH confidence)
- [PixiJS 8 Container API docs](https://pixijs.download/dev/docs/scene.Container.html) — tint property, cacheAsTexture()
- [PixiJS 8 Scene Objects guide](https://pixijs.com/8.x/guides/components/scene-objects) — tint inheritance in v8, cacheAsTexture options
- [PixiJS 8 cacheAsTexture guide](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture) — full API, texture pool integration
- [PixiJS cacheAsTexture PR #11031](https://github.com/pixijs/pixijs/pull/11031) — implementation details confirming compositing behavior
- [PixiJS v8 launch blog](https://pixijs.com/blog/pixi-v8-launches) — tint inheritance confirmed new in v8
- [PixiJS 8 Filters Guide](https://pixijs.com/8.x/guides/components/filters) — filter pipeline: breaks batch, renders to framebuffer, composites back
- [PixiJS Issue #2288](https://github.com/pixijs/pixijs/issues/2288) — confirmed: any filter on stage doubles render passes
- [Node.js fs API docs](https://nodejs.org/api/fs.html) — fs.promises equivalents, createReadStream start option, FileHandle API
- [Electron Performance guide](https://www.electronjs.org/docs/latest/tutorial/performance) — prefer async I/O in main process
- [Game Programming Patterns — Dirty Flag](https://gameprogrammingpatterns.com/dirty-flag.html) — threshold and dirty-flag semantics
- Direct source code analysis of Agent World `src/` — world.ts, day-night-cycle.ts, session-detector.ts, usage-aggregator.ts, jsonl-reader.ts, ambient-particles.ts, building.ts, graphics-pool.ts, agent.ts, game-loop.ts, dashboard-panel.ts

### Secondary (MEDIUM confidence)
- [PixiJS Performance Deep Dive (Medium)](https://medium.com/@turkmergin/maximising-performance-a-deep-dive-into-pixijs-optimization-6689688ead93) — cacheAsTexture patterns, sprite vs. Graphics performance
- [Swap-and-Pop vs Splice](https://tomoharutsutsumi.medium.com/instead-of-splice-use-swap-and-pop-javascript-22103d90bf5c) — O(1) vs. O(n) removal, ordering implications
- [melonJS Performance Issue #192](https://github.com/melonjs/melonJS/issues/192) — Array.splice is slow in game loops

### Tertiary (reference only)
- [Elastic Filebeat — Log Rotation](https://www.elastic.co/guide/en/beats/filebeat/current/file-log-rotation.html) — offset tracking across truncation and rotation (pattern reference for incremental parsing)
- [morphdom DOM diffing](https://github.com/patrick-steele-idem/morphdom) — alternative to manual keying (not recommended for this use case; manual in-place updates preferred)

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*

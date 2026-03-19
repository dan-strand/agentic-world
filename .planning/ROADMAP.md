# Roadmap: Agent World

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Fantasy RPG Aesthetic** - Phases 4-7 (shipped 2026-02-26)
- ✅ **v1.2 Activity Monitoring & Labeling** - Phases 8-10 (shipped 2026-02-26)
- ✅ **v1.3 Audio & Status Reliability** - Phases 11, 13 (shipped 2026-02-27)
- ✅ **v1.4 Enhanced Session Workspaces** - Phases 14-16 (shipped 2026-02-27)
- ✅ **v1.5 Usage Dashboard** - Phases 17-19 (shipped 2026-03-01)
- ✅ **v2.0 World & Character Detail** - Phases 20-22 (shipped 2026-03-03)
- Parked **v2.1 Hardening and Bug Fixes** - Phases 23-25 (Phase 25 soak test pending)
- 🚧 **v2.2 Performance Optimization** - Phases 26-29 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-02-25</summary>

- [x] **Phase 1: Foundation and Detection** - Electron app with session detection, IPC bridge, and adaptive game loop
- [x] **Phase 2: Visual World** - PixiJS scene with animated spy agents, world locations, labels, and speech bubbles (completed 2026-02-25)
- [x] **Phase 3: Status and Lifecycle** - Visual status states, celebration animation, and walk-back-to-HQ completion flow (completed 2026-02-25)

See: [`.planning/milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.1 Fantasy RPG Aesthetic (Phases 4-7) — SHIPPED 2026-02-26</summary>

- [x] **Phase 4: Asset Pipeline and World Ground** - Sprite atlas loading, tilemap ground with paths, fixed 1024x768 window with hidden title bar
- [x] **Phase 5: Buildings and World Layout** - Guild Hall and four quest zone buildings positioned as one cohesive connected world
- [x] **Phase 6: Agent Sprite Overhaul** - AnimatedSprite adventurers with character classes, vehicle system removed, walk/idle/work animations
- [x] **Phase 7: Effects and Atmosphere** - Level-up celebration, ambient particles, zone glow highlights, warm lighting tint

See: [`.planning/milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.2 Activity Monitoring & Labeling (Phases 8-10) — SHIPPED 2026-02-26</summary>

- [x] **Phase 8: Dynamic Building Labels** - Buildings show active project folder names; revert to RPG names when vacant
- [x] **Phase 9: Speech Bubbles and Project Routing** - Speech bubbles trigger on all meaningful activity changes; project-based building assignment
- [x] **Phase 10: Agent Fade-Out Lifecycle** - Completed agents fade out at Guild Hall; stale sessions cleaned up properly (completed 2026-02-26)

</details>

<details>
<summary>✅ v1.3 Audio & Status Reliability (Phases 11, 13) — SHIPPED 2026-02-27</summary>

- [x] **Phase 11: Status & Visibility Audit** - Status transitions accurate, agents always visible, edge cases handled including tool_use detection (completed 2026-02-27)
- ~~Phase 12: Jobs Done Global Signal~~ - REMOVED (per-session sounds preferred; already working)
- [x] **Phase 13: Ready to Work Reminders** - Per-session reminder timers from waiting state, throttled so sounds never stack (completed 2026-02-27)

See: [`.planning/milestones/v1.3-ROADMAP.md`](milestones/v1.3-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.4 Enhanced Session Workspaces (Phases 14-16) — SHIPPED 2026-02-27</summary>

- [x] **Phase 14: World Layout Reorganization** - 2x2 grid layout, 464x336 buildings, campfire waypoint, star-pattern paths (completed 2026-02-27)
- [x] **Phase 15: Workspace Interior Art** - Detailed top-down interiors for all four workspace types (completed 2026-02-27)
- [x] **Phase 16: Agent Stations and Info Overlay** - Agents at themed stations with wander, tool name overlays (completed 2026-02-27)

See: [`.planning/milestones/v1.4-ROADMAP.md`](milestones/v1.4-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.5 Usage Dashboard (Phases 17-19) — SHIPPED 2026-03-01</summary>

- [x] **Phase 17: Window Layout and Parsing Infrastructure** - Expanded window with dashboard div, streaming JSONL usage parser with mtime caching (completed 2026-03-01)
- [x] **Phase 18: Live Dashboard with Cost Estimation** - Session list, token breakdowns, cost calculation, today's totals, and cache savings display (completed 2026-03-01)
- [x] **Phase 19: Historical Persistence** - Daily aggregate storage with 30-day retention and dashboard history view (completed 2026-03-01)

See: [`.planning/milestones/v1.5-ROADMAP.md`](milestones/v1.5-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v2.0 World & Character Detail (Phases 20-22) — SHIPPED 2026-03-03</summary>

- [x] **Phase 20: World & Building Art** - Outdoor scenery, village props, building exterior enhancements across the entire world (completed 2026-03-03)
- [x] **Phase 21: Character Identity** - Unique agent appearances with color palettes, gear, and class-specific animations (completed 2026-03-03)
- [x] **Phase 22: Day/Night Cycle & Atmosphere** - Lighting cycle, night glow effects, color temperature shifts, enhanced particles (completed 2026-03-03)

See: [`.planning/milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>Parked: v2.1 Hardening and Bug Fixes (Phases 23-25)</summary>

- [x] **Phase 23: Crash Diagnosis Infrastructure** - Crash event handlers, error boundaries, persistent logging, and memory health monitoring (completed 2026-03-16)
- [x] **Phase 24: Resource Leak Fixes** - Object pooling, texture cache lifecycle, filter cleanup, collection pruning, timer wrapping, and stream hardening (completed 2026-03-16)
- [ ] **Phase 25: Soak Testing and Verification** - 8-hour continuous run proving all leaks are eliminated

</details>

### v2.2 Performance Optimization (In Progress)

**Milestone Goal:** Eliminate the highest-impact CPU, GPU, and I/O inefficiencies so the always-on app uses fewer resources with no visual or behavioral regression.

- [x] **Phase 26: I/O Pipeline** - Non-blocking session discovery, combined file reads, incremental JSONL parsing, adaptive poll backoff (completed 2026-03-18)
- [x] **Phase 27: GPU Rendering** - Replace stage filter with container tint, threshold-gated updates, static layer caching, glow guards (completed 2026-03-19)
- [x] **Phase 28: CPU Tick Loop** - Particle throttling, swap-and-pop removal, dirty-flag highlights, state transition guards, DOM diffing, allocation cleanup, dependency removal (completed 2026-03-19)
- [ ] **Phase 29: Agent State Consolidation** - Unify 13+ per-agent Maps into single AgentTrackingState structure

## Phase Details

### Phase 26: I/O Pipeline
**Goal**: The main process never blocks its event loop during session polling, reads the minimum bytes necessary per poll cycle, and backs off polling when idle
**Depends on**: Phase 25 (v2.1 parked -- no hard dependency; can proceed independently)
**Requirements**: IO-01, IO-02, IO-03, IO-04
**Success Criteria** (what must be TRUE):
  1. Session discovery completes without blocking IPC, timers, or other async operations on the main process event loop (no synchronous fs calls in the poll path)
  2. Each changed session triggers one file open instead of two -- `readLastJsonlLine` and `readLastToolUse` consolidated into a single pass
  3. UsageAggregator reads only newly-appended bytes from JSONL files (not the full 2-18MB) and correctly falls back to full re-parse on file truncation or inode change
  4. When no sessions are active for consecutive poll cycles, the poll interval stretches to 10-30s; when a session becomes active, polling resets to the normal 3s interval immediately
**Plans**: 3 plans
Plans:
- [ ] 26-01-PLAN.md -- Combined JSONL tail read + async session discovery (IO-01, IO-02)
- [ ] 26-02-PLAN.md -- Incremental offset-based JSONL usage parsing (IO-03)
- [ ] 26-03-PLAN.md -- Adaptive poll backoff with setTimeout recursion (IO-04)

### Phase 27: GPU Rendering
**Goal**: The renderer draws the scene in a single pass (no off-screen framebuffer) with threshold-gated updates that skip GPU writes on 98% of frames during day/night plateaus
**Depends on**: Phase 26
**Requirements**: GPU-01, GPU-02, GPU-03, GPU-04
**Success Criteria** (what must be TRUE):
  1. The day/night color shift renders correctly across all 5 cycle points (dawn, day, dusk, night, midnight) with no stage-level filter -- visual comparison against pre-migration screenshot baseline shows acceptable match
  2. Day/night tint values only update when the computed value changes by more than the perceptible threshold (~0.005); plateau frames perform zero tint writes
  3. Static scenery and tilemap layers are cached as single GPU textures and do not re-render their children each frame
  4. Night glow alpha values only update when nightIntensity changes beyond threshold; unchanged ticks skip all 19+ glow object writes
**Plans**: 2 plans
Plans:
- [ ] 27-01-PLAN.md -- WorldContainer tint migration + threshold-gated updates (GPU-01, GPU-02)
- [ ] 27-02-PLAN.md -- Static layer caching + glow threshold guard (GPU-03, GPU-04)

### Phase 28: CPU Tick Loop
**Goal**: Per-tick CPU work is minimized through dirty flags, idle-aware throttling, efficient data structures, and in-place DOM updates
**Depends on**: Phase 27
**Requirements**: CPU-01, CPU-02, CPU-03, CPU-05, DOM-01, DOM-02, DOM-03
**Success Criteria** (what must be TRUE):
  1. Smoke and spark particle subsystems skip their update logic at idle FPS (5fps); fireflies, dust, and leaves continue updating at all times (too cheap to throttle, too visible to skip)
  2. Particle removal uses O(1) swap-and-pop instead of O(n) Array.splice; no forward-iteration loop uses this pattern (reverse-only invariant)
  3. Building highlight tints only recompute when agent occupancy changes (dirty flag set on state transitions), not on every frame
  4. Agent reparenting between containers and setAnimation calls happen inside state transition handlers, not in the per-frame tick poll
  5. Dashboard session list updates existing DOM elements in place (text content mutation, not element replacement); click-to-expand state survives data refreshes
**Plans**: 3 plans
Plans:
- [ ] 28-01-PLAN.md -- Particle idle throttling + swap-and-pop removal (CPU-01, CPU-02)
- [ ] 28-02-PLAN.md -- Dirty-flag highlights + state-driven reparenting + allocation cleanup (CPU-03, CPU-05, DOM-02)
- [ ] 28-03-PLAN.md -- Dashboard in-place DOM updates + chokidar removal (DOM-01, DOM-03)

### Phase 29: Agent State Consolidation
**Goal**: Per-agent tracking data lives in one Map instead of 13+, making agent lifecycle operations (create, update, delete) access a single location
**Depends on**: Phase 28
**Requirements**: CPU-04
**Success Criteria** (what must be TRUE):
  1. A single `Map<string, AgentTrackingState>` replaces the 13+ separate Maps in world.ts; no per-agent data remains in standalone Maps
  2. Agent removal executes one `agentStates.delete(sessionId)` instead of 13 individual Map deletes
  3. All existing agent behaviors (status transitions, speech bubbles, wander, celebrate, fade-out) work identically after the refactor -- no logic changes, only data structure consolidation
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 26 → 27 → 28 → 29

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Detection | v1.0 | 3/3 | Complete | 2026-02-25 |
| 2. Visual World | v1.0 | 4/4 | Complete | 2026-02-25 |
| 3. Status and Lifecycle | v1.0 | 2/2 | Complete | 2026-02-25 |
| 4. Asset Pipeline and World Ground | v1.1 | 2/2 | Complete | 2026-02-26 |
| 5. Buildings and World Layout | v1.1 | 3/3 | Complete | 2026-02-26 |
| 6. Agent Sprite Overhaul | v1.1 | 2/2 | Complete | 2026-02-26 |
| 7. Effects and Atmosphere | v1.1 | 2/2 | Complete | 2026-02-26 |
| 8. Dynamic Building Labels | v1.2 | 2/2 | Complete | 2026-02-26 |
| 9. Speech Bubbles and Project Routing | v1.2 | 1/1 | Complete | 2026-02-26 |
| 10. Agent Fade-Out Lifecycle | v1.2 | 1/1 | Complete | 2026-02-26 |
| 11. Status & Visibility Audit | v1.3 | 3/3 | Complete | 2026-02-27 |
| 12. Jobs Done Global Signal | v1.3 | - | REMOVED | - |
| 13. Ready to Work Reminders | v1.3 | 1/1 | Complete | 2026-02-27 |
| 14. World Layout Reorganization | v1.4 | 2/2 | Complete | 2026-02-27 |
| 15. Workspace Interior Art | v1.4 | 2/2 | Complete | 2026-02-27 |
| 16. Agent Stations and Info Overlay | v1.4 | 2/2 | Complete | 2026-02-27 |
| 17. Window Layout and Parsing Infrastructure | v1.5 | 2/2 | Complete | 2026-03-01 |
| 18. Live Dashboard with Cost Estimation | v1.5 | 2/2 | Complete | 2026-03-01 |
| 19. Historical Persistence | v1.5 | 2/2 | Complete | 2026-03-01 |
| 20. World & Building Art | v2.0 | 3/3 | Complete | 2026-03-03 |
| 21. Character Identity | v2.0 | 2/2 | Complete | 2026-03-03 |
| 22. Day/Night Cycle & Atmosphere | v2.0 | 2/2 | Complete | 2026-03-03 |
| 23. Crash Diagnosis Infrastructure | v2.1 | 2/2 | Complete | 2026-03-16 |
| 24. Resource Leak Fixes | v2.1 | 2/2 | Complete | 2026-03-16 |
| 25. Soak Testing and Verification | v2.1 | 0/1 | Parked | - |
| 26. I/O Pipeline | v2.2 | 3/3 | Complete | 2026-03-18 |
| 27. GPU Rendering | v2.2 | 2/2 | Complete | 2026-03-19 |
| 28. CPU Tick Loop | 3/3 | Complete    | 2026-03-19 | - |
| 29. Agent State Consolidation | v2.2 | 0/? | Not started | - |

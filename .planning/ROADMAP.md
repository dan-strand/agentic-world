# Roadmap: Agent World

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Fantasy RPG Aesthetic** - Phases 4-7 (shipped 2026-02-26)
- ✅ **v1.2 Activity Monitoring & Labeling** - Phases 8-10 (shipped 2026-02-26)
- ✅ **v1.3 Audio & Status Reliability** - Phases 11, 13 (shipped 2026-02-27)
- ✅ **v1.4 Enhanced Session Workspaces** - Phases 14-16 (shipped 2026-02-27)
- ✅ **v1.5 Usage Dashboard** - Phases 17-19 (shipped 2026-03-01)
- ✅ **v2.0 World & Character Detail** - Phases 20-22 (shipped 2026-03-03)
- 🚧 **v2.1 Hardening and Bug Fixes** - Phases 23-25 (in progress)

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

### v2.1 Hardening and Bug Fixes (In Progress)

**Milestone Goal:** Fix the silent crash that occurs after hours of running by instrumenting crash detection, eliminating all identified resource leaks, and proving stability with an 8-hour soak test.

- [x] **Phase 23: Crash Diagnosis Infrastructure** - Crash event handlers, error boundaries, persistent logging, and memory health monitoring (completed 2026-03-16)
- [ ] **Phase 24: Resource Leak Fixes** - Object pooling, texture cache lifecycle, filter cleanup, collection pruning, timer wrapping, and stream hardening
- [ ] **Phase 25: Soak Testing and Verification** - 8-hour continuous run proving all leaks are eliminated

## Phase Details

### Phase 23: Crash Diagnosis Infrastructure
**Goal**: The app captures and logs every crash, exception, and memory anomaly so no failure is ever silent again
**Depends on**: Phase 22
**Requirements**: DIAG-01, DIAG-02, DIAG-03, DIAG-04
**Success Criteria** (what must be TRUE):
  1. When the renderer process crashes or goes unresponsive, the crash reason and timestamp are written to a log file that survives the crash
  2. When a single exception occurs inside the game loop tick, the world continues running (the error is logged, not propagated)
  3. Crash log file at a known location contains timestamped entries with stack traces that can be read after a restart
  4. Memory health stats (heap size, RSS, process memory) are periodically logged, and a sustained upward trend triggers a warning entry in the log
**Plans:** 2/2 plans complete
Plans:
- [ ] 23-01-PLAN.md -- Crash logging infrastructure: electron-log, CrashLogger class, IPC channels, preload bridge, crash event handlers
- [ ] 23-02-PLAN.md -- Error boundary and memory monitor: game loop try/catch, MemoryMonitor, renderer global error handlers

### Phase 24: Resource Leak Fixes
**Goal**: Every identified source of unbounded memory/GPU/handle growth is eliminated so the app can run indefinitely without resource exhaustion
**Depends on**: Phase 23
**Requirements**: LEAK-01, LEAK-02, LEAK-03, LEAK-04, STAB-01, STAB-02
**Success Criteria** (what must be TRUE):
  1. Smoke and spark particles reuse a fixed pool of Graphics objects -- no new Graphics are created or destroyed during normal operation
  2. When an agent is removed, its palette-swapped textures are destroyed and freed from the cache; the cache does not grow without bound
  3. After a celebration effect completes, GPU resources (GlowFilter shaders, render textures) are fully released -- triggering 50 celebrations does not increase baseline GPU memory
  4. Stale entries in dismissedSessions, mtimeCache, cwdCache, and usageAggregator cache are pruned on a periodic schedule; collections do not grow monotonically
  5. Timer accumulators (DayNightCycle.elapsed, particle phase, breathTimer) wrap via modulo and never exceed one cycle period; JSONL readline streams are destroyed in a finally block on every code path
**Plans:** 1/2 plans executed
Plans:
- [ ] 24-01-PLAN.md -- GPU resource leak fixes: GraphicsPool for particles, palette swap cache lifecycle, GlowFilter explicit destruction
- [ ] 24-02-PLAN.md -- Stability fixes: collection pruning, timer modulo wraps, stream cleanup

### Phase 25: Soak Testing and Verification
**Goal**: The app proves it can run for 8 continuous hours without meaningful memory growth, confirming all leaks are fixed
**Depends on**: Phase 24
**Requirements**: STAB-03
**Success Criteria** (what must be TRUE):
  1. The app runs continuously for 8 hours without crashing, freezing, or becoming unresponsive
  2. Total renderer process memory growth over the 8-hour run is less than 50MB
  3. Health monitor logs show no monotonically increasing metric -- all resource counters are stable or periodic
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 23 → 24 → 25

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
| 23. Crash Diagnosis Infrastructure | 2/2 | Complete    | 2026-03-16 | - |
| 24. Resource Leak Fixes | 1/2 | In Progress|  | - |
| 25. Soak Testing and Verification | v2.1 | 0/? | Not started | - |

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
- ✅ **v2.2 Performance Optimization** - Phases 26-29 (shipped 2026-03-19)
- 🚧 **v2.3 Performance Polish** - Phases 30-31 (in progress)

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

<details>
<summary>✅ v2.2 Performance Optimization (Phases 26-29) — SHIPPED 2026-03-19</summary>

- [x] **Phase 26: I/O Pipeline** - Non-blocking session discovery, combined file reads, incremental JSONL parsing, adaptive poll backoff (completed 2026-03-18)
- [x] **Phase 27: GPU Rendering** - Replace stage filter with container tint, threshold-gated updates, static layer caching, glow guards (completed 2026-03-19)
- [x] **Phase 28: CPU Tick Loop** - Particle throttling, swap-and-pop removal, dirty-flag highlights, state transition guards, DOM diffing, allocation cleanup, dependency removal (completed 2026-03-19)
- [x] **Phase 29: Agent State Consolidation** - Unify 13+ per-agent Maps into single AgentTrackingState structure (completed 2026-03-19)

</details>

### v2.3 Performance Polish (In Progress)

**Milestone Goal:** Address remaining LOW-priority performance audit items -- GPU texture consolidation, glow sprite replacement, minor tick-loop and DOM allocation cleanup, and async startup.

- [ ] **Phase 30: GPU and Renderer Cleanup** - Atlas agent textures, replace glow Graphics with sprites, gate smoke on nightIntensity, throttle console.warn, eliminate spread allocation, cache escapeHtml element
- [ ] **Phase 31: I/O and Startup Cleanup** - Pass mtime to eliminate redundant statSync, defer sync constructors to after app.ready

## Phase Details

### Phase 30: GPU and Renderer Cleanup
**Goal**: The renderer uses fewer GPU textures per agent, replaces dynamic Graphics glow objects with static sprites, and eliminates unnecessary per-tick allocations in the render path
**Depends on**: Phase 29 (v2.2 complete)
**Requirements**: TEX-01, TEX-02, TICK-01, TICK-02, TICK-03, DOMCL-01
**Success Criteria** (what must be TRUE):
  1. Each agent's palette-swapped animation frames are consolidated into a single GPU texture atlas instead of individual textures per frame -- GPU texture count drops from ~12-16 per agent to 1 per agent
  2. Night glow points render as pre-built radial gradient sprites instead of concentric circle Graphics objects -- the 80 fill operations per glow update are replaced by 20 sprite alpha changes
  3. Building smoke particles skip their baseAlpha/maxSmoke/spawnInterval updates when nightIntensity is below the 0.005 threshold (same guard pattern used by glow alpha)
  4. Console.warn calls in the visibility check are throttled to at most once per second per agent, and the removeAgent spread operator is replaced with a for-of early-return loop (zero temporary array allocations)
  5. The escapeHtml utility reuses a single cached div element across all calls instead of creating a new element per invocation
**Plans**: 2 plans
Plans:
- [ ] 30-01-PLAN.md -- GPU texture atlas consolidation and gradient sprite glow replacement
- [ ] 30-02-PLAN.md -- Smoke threshold gate, warn throttle, spread removal, escapeHtml cache

### Phase 31: I/O and Startup Cleanup
**Goal**: The main process eliminates a redundant filesystem stat call per session per poll cycle and defers synchronous module-level constructors to after Electron's app.ready event
**Depends on**: Phase 30
**Requirements**: IOCL-01, IOCL-02
**Success Criteria** (what must be TRUE):
  1. SessionDetector passes lastModified through SessionInfo so UsageAggregator can skip its own statSync -- one fewer synchronous fs call per active session per poll cycle
  2. Module-level sync constructors (HistoryStore.load, CrashLogger.checkPreviousCrash) execute after app.ready instead of at import time -- Electron's ready event is never blocked by file I/O during startup
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 30 → 31

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
| 28. CPU Tick Loop | v2.2 | 3/3 | Complete | 2026-03-19 |
| 29. Agent State Consolidation | v2.2 | 1/1 | Complete | 2026-03-19 |
| 30. GPU and Renderer Cleanup | v2.3 | 0/2 | Not started | - |
| 31. I/O and Startup Cleanup | v2.3 | 0/? | Not started | - |

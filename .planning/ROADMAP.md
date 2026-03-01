# Roadmap: Agent World

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Fantasy RPG Aesthetic** - Phases 4-7 (shipped 2026-02-26)
- ✅ **v1.2 Activity Monitoring & Labeling** - Phases 8-10 (shipped 2026-02-26)
- ✅ **v1.3 Audio & Status Reliability** - Phases 11, 13 (shipped 2026-02-27)
- ✅ **v1.4 Enhanced Session Workspaces** - Phases 14-16 (shipped 2026-02-27)
- **v1.5 Usage Dashboard** - Phases 17-19 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-3) - SHIPPED 2026-02-25</summary>

- [x] **Phase 1: Foundation and Detection** - Electron app with session detection, IPC bridge, and adaptive game loop
- [x] **Phase 2: Visual World** - PixiJS scene with animated spy agents, world locations, labels, and speech bubbles (completed 2026-02-25)
- [x] **Phase 3: Status and Lifecycle** - Visual status states, celebration animation, and walk-back-to-HQ completion flow (completed 2026-02-25)

See: [`.planning/milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>v1.1 Fantasy RPG Aesthetic (Phases 4-7) - SHIPPED 2026-02-26</summary>

- [x] **Phase 4: Asset Pipeline and World Ground** - Sprite atlas loading, tilemap ground with paths, fixed 1024x768 window with hidden title bar
- [x] **Phase 5: Buildings and World Layout** - Guild Hall and four quest zone buildings positioned as one cohesive connected world
- [x] **Phase 6: Agent Sprite Overhaul** - AnimatedSprite adventurers with character classes, vehicle system removed, walk/idle/work animations
- [x] **Phase 7: Effects and Atmosphere** - Level-up celebration, ambient particles, zone glow highlights, warm lighting tint

See: [`.planning/milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md) for full phase details.

</details>

<details>
<summary>v1.2 Activity Monitoring & Labeling (Phases 8-10) - SHIPPED 2026-02-26</summary>

- [x] **Phase 8: Dynamic Building Labels** - Buildings show active project folder names; revert to RPG names when vacant
- [x] **Phase 9: Speech Bubbles and Project Routing** - Speech bubbles trigger on all meaningful activity changes; project-based building assignment
- [x] **Phase 10: Agent Fade-Out Lifecycle** - Completed agents fade out at Guild Hall; stale sessions cleaned up properly (completed 2026-02-26)

</details>

<details>
<summary>v1.3 Audio & Status Reliability (Phases 11, 13) - SHIPPED 2026-02-27</summary>

- [x] **Phase 11: Status & Visibility Audit** - Status transitions accurate, agents always visible, edge cases handled including tool_use detection (completed 2026-02-27)
- ~~Phase 12: Jobs Done Global Signal~~ - REMOVED (per-session sounds preferred; already working)
- [x] **Phase 13: Ready to Work Reminders** - Per-session reminder timers from waiting state, throttled so sounds never stack (completed 2026-02-27)

See: [`.planning/milestones/v1.3-ROADMAP.md`](milestones/v1.3-ROADMAP.md) for full phase details.

</details>

<details>
<summary>v1.4 Enhanced Session Workspaces (Phases 14-16) - SHIPPED 2026-02-27</summary>

- [x] **Phase 14: World Layout Reorganization** - 2x2 grid layout, 464x336 buildings, campfire waypoint, star-pattern paths (completed 2026-02-27)
- [x] **Phase 15: Workspace Interior Art** - Detailed top-down interiors for all four workspace types (completed 2026-02-27)
- [x] **Phase 16: Agent Stations and Info Overlay** - Agents at themed stations with wander, tool name overlays (completed 2026-02-27)

See: [`.planning/milestones/v1.4-ROADMAP.md`](milestones/v1.4-ROADMAP.md) for full phase details.

</details>

### v1.5 Usage Dashboard (In Progress)

**Milestone Goal:** Add a usage dashboard below the RPG world showing live session details, token usage, cost estimates, and 30-day historical trends.

- [x] **Phase 17: Window Layout and Parsing Infrastructure** - Expanded window with dashboard div, streaming JSONL usage parser with mtime caching (completed 2026-03-01)
- [x] **Phase 18: Live Dashboard with Cost Estimation** - Session list, token breakdowns, cost calculation, today's totals, and cache savings display (completed 2026-03-01)
- [ ] **Phase 19: Historical Persistence** - Daily aggregate storage with 30-day retention and dashboard history view

## Phase Details

### Phase 17: Window Layout and Parsing Infrastructure
**Goal**: Users see an expanded window with the RPG world on top and an empty dashboard area below, while the system can extract token usage from every session's JSONL files without blocking the animation
**Depends on**: Phase 16 (v1.4 complete)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, PARSE-01, PARSE-02, PARSE-03
**Success Criteria** (what must be TRUE):
  1. Application window is taller than before with a visible dashboard region below the RPG world
  2. The RPG world animation continues to render at the same size and position with no visual changes
  3. The dashboard region is an HTML div (not PixiJS) that can display text content
  4. Token usage totals (input, output, cache read, cache write) can be extracted from any session's JSONL file
  5. Parsing a large JSONL file does not cause visible animation stutter in the RPG world above
**Plans**: TBD

Plans:
- [ ] 17-01: TBD
- [ ] 17-02: TBD

### Phase 18: Live Dashboard with Cost Estimation
**Goal**: Users can see all active sessions, their token usage, estimated costs, and today's aggregate totals in the dashboard panel -- the primary daily-use feature
**Depends on**: Phase 17
**Requirements**: COST-01, COST-02, COST-03, COST-04, DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Dashboard shows a compact row for every active session with its project name, status, duration, and current tool
  2. Clicking a session row expands it to reveal a full token breakdown (input, output, cache read, cache write) and a cost estimate displayed as ~$X.XX
  3. A totals bar at the top of the dashboard shows today's aggregate input tokens, output tokens, estimated cost, and session count
  4. Cache savings are displayed showing how much money was saved by cache reads versus full-price input
  5. Cost estimates correctly differentiate between Opus, Sonnet, and Haiku pricing, and unrecognized models show an estimate indicator rather than $0
**Plans**: 2 plans

Plans:
- [ ] 18-01-PLAN.md -- Main process wiring: pricing constants, cost calculation, IPC channel, preload bridge
- [ ] 18-02-PLAN.md -- Renderer dashboard UI: session rows, expandable detail, totals bar, cache savings

### Phase 19: Historical Persistence
**Goal**: Users can see their usage trends over time, with daily aggregates persisted across application restarts and a 30-day historical view in the dashboard
**Depends on**: Phase 18
**Requirements**: HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. Closing and reopening the application preserves today's usage totals and past daily aggregates
  2. The dashboard shows a 30-day aggregate summary of total tokens and total cost
  3. Historical data older than 30 days is automatically pruned without user intervention
**Plans**: TBD

Plans:
- [ ] 19-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 17 -> 18 -> 19

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
| 14. World Layout Reorganization | v1.4 | Complete | Complete | 2026-02-27 |
| 15. Workspace Interior Art | v1.4 | Complete | Complete | 2026-02-27 |
| 16. Agent Stations and Info Overlay | v1.4 | 2/2 | Complete | 2026-02-27 |
| 17. Window Layout and Parsing Infrastructure | 2/2 | Complete    | 2026-03-01 | - |
| 18. Live Dashboard with Cost Estimation | 2/2 | Complete   | 2026-03-01 | - |
| 19. Historical Persistence | v1.5 | 0/TBD | Not started | - |

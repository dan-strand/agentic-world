# Roadmap: Agent World

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Fantasy RPG Aesthetic** - Phases 4-7 (shipped 2026-02-26)
- ✅ **v1.2 Activity Monitoring & Labeling** - Phases 8-10 (shipped 2026-02-26)
- ✅ **v1.3 Audio & Status Reliability** - Phases 11, 13 (shipped 2026-02-27)
- **v1.4 Enhanced Session Workspaces** - Phases 14-16 (in progress)

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

### v1.4 Enhanced Session Workspaces (Phases 14-16)

**Milestone Goal:** Replace small building exteriors with large, detailed interior workspaces that show agents working inside with current tool info -- making each workspace a rich visual status dashboard.

- [x] **Phase 14: World Layout Reorganization** - Restructure 1024x768 world for large workspace buildings; Guild Hall becomes small waypoint; tilemap paths updated (completed 2026-02-27)
- [ ] **Phase 15: Workspace Interior Art** - Replace 96x96 building sprites with larger detailed interior scenes for all four workspace types
- [ ] **Phase 16: Agent Stations and Info Overlay** - Agents work at themed stations inside interiors; current tool name displayed per workspace

## Phase Details

### Phase 14: World Layout Reorganization
**Goal**: World layout restructured to maximize workspace building screen space within fixed 1024x768 window
**Depends on**: Phase 13 (existing world layout)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03
**Success Criteria** (what must be TRUE):
  1. Four workspace buildings are visibly larger than the old 96x96 sprites and dominate the screen area
  2. Guild Hall is a small waypoint element (not a full-sized building) used only for celebrations and transitions
  3. Dirt paths connect the Guild Hall waypoint to all four workspace buildings
  4. The entire world fits within 1024x768 with no clipping or overlap between buildings
**Plans**: 2 plans
Plans:
- [x] 14-01-PLAN.md -- Layout constants and sprite assets (building atlas at new size + campfire sprite)
- [x] 14-02-PLAN.md -- World integration (tilemap paths, building class, world.ts with campfire waypoint)

### Phase 15: Workspace Interior Art
**Goal**: Each workspace building displays a rich, themed interior scene with identifiable work stations
**Depends on**: Phase 14 (new building sizes and positions established)
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05
**Success Criteria** (what must be TRUE):
  1. Wizard Tower shows an arcane study interior with visible enchanting table, scroll desk, and rune bench
  2. Training Grounds shows an arena/workshop interior with visible target dummy, obstacle course, and potion station
  3. Ancient Library shows a study hall interior with visible crystal ball, bookshelves, and map table
  4. Tavern shows a gathering space interior with visible bar counter, notice board, and pigeon roost
  5. All four interiors are clearly distinguishable at a glance and read well at the new larger building size
**Plans**: TBD

### Phase 16: Agent Stations and Info Overlay
**Goal**: Agents visibly work at themed stations inside workspace interiors and workspaces display current tool info
**Depends on**: Phase 15 (interior art with identifiable stations)
**Requirements**: AGENT-01, AGENT-02, WORK-06
**Success Criteria** (what must be TRUE):
  1. Agents are drawn inside workspace interiors (not outside/on top of buildings) when in the working state
  2. Each agent's work position corresponds to a specific themed station within that building's interior
  3. Current tool name is displayed as a text overlay on each workspace that has an active session
**Plans**: TBD

## Progress

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
| 14. World Layout Reorganization | v1.4 | Complete    | 2026-02-27 | 2026-02-27 |
| 15. Workspace Interior Art | v1.4 | 0/? | Not started | - |
| 16. Agent Stations and Info Overlay | v1.4 | 0/? | Not started | - |

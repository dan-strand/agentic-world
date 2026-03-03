# Roadmap: Agent World

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Fantasy RPG Aesthetic** - Phases 4-7 (shipped 2026-02-26)
- ✅ **v1.2 Activity Monitoring & Labeling** - Phases 8-10 (shipped 2026-02-26)
- ✅ **v1.3 Audio & Status Reliability** - Phases 11, 13 (shipped 2026-02-27)
- ✅ **v1.4 Enhanced Session Workspaces** - Phases 14-16 (shipped 2026-02-27)
- ✅ **v1.5 Usage Dashboard** - Phases 17-19 (shipped 2026-03-01)
- 🚧 **v2.0 World & Character Detail** - Phases 20-22 (in progress)

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

### 🚧 v2.0 World & Character Detail (In Progress)

**Milestone Goal:** Make the world feel alive and each agent visually unique -- richer outdoor scenery, building detail, day/night cycle, and distinct character identities.

- [x] **Phase 20: World & Building Art** - Outdoor scenery, village props, building exterior enhancements across the entire world (completed 2026-03-03)
- [ ] **Phase 21: Character Identity** - Unique agent appearances with color palettes, gear, names, and class-specific animations
- [ ] **Phase 22: Day/Night Cycle & Atmosphere** - Lighting cycle, night glow effects, color temperature shifts, enhanced particles

## Phase Details

### Phase 20: World & Building Art
**Goal**: The world outside buildings looks like a living fantasy village, not empty space with paths
**Depends on**: Phase 19 (v1.5 complete)
**Requirements**: SCEN-01, SCEN-02, SCEN-03, SCEN-04, BLDG-01, BLDG-02, BLDG-03, BLDG-04
**Success Criteria** (what must be TRUE):
  1. Trees, bushes, and flowers fill the gaps between buildings so the world feels forested and lush
  2. Village props (fences, barrels, crates, well, signposts) are visible near buildings creating a lived-in feel
  3. Paths are visually improved and a water feature (pond or stream) is visible in the world
  4. Lanterns, torches, or street lamps are placed throughout the world as lighting fixtures
  5. Each building has distinct exterior detail -- roof/chimney features, hanging signs, glowing windows, and surrounding elements (gardens, awnings, doorsteps)
**Plans**: 3 plans

Plans:
- [x] 20-01-PLAN.md -- Scenery sprite atlas generation and enhanced tilemap (paths, pond)
- [x] 20-02-PLAN.md -- Building exterior art enhancements and chimney smoke particles
- [x] 20-03-PLAN.md -- Wire scenery into world, place trees/props/lanterns, visual verification

### Phase 21: Character Identity
**Goal**: Every agent on screen is visually distinct and has a name, so you can tell sessions apart at a glance
**Depends on**: Phase 20
**Requirements**: CHAR-01, CHAR-02, CHAR-03, CHAR-04
**Success Criteria** (what must be TRUE):
  1. Each agent displays a unique color palette that distinguishes it from every other active agent
  2. Agents wear visible accessories or gear (hats, capes, weapons, shields) adding visual variety
  3. A fantasy name is displayed above each agent character
  4. Each RPG class has distinct animations for idle, working, and celebrating states (not shared across classes)
**Plans**: 2 plans

Plans:
- [ ] 21-01-PLAN.md -- Identity data layer: character atlas celebrate frames, gear atlas, palette definitions, fantasy names, type system expansion
- [ ] 21-02-PLAN.md -- Renderer integration: runtime palette swap, gear overlays, name labels, celebrate animation wiring, visual verification

### Phase 22: Day/Night Cycle & Atmosphere
**Goal**: The world breathes with a day/night rhythm -- lighting shifts, fixtures glow at night, and enhanced particle effects create atmosphere
**Depends on**: Phase 20 (lighting props and glowing windows must exist to illuminate at night)
**Requirements**: DNCL-01, DNCL-02, DNCL-03, ATMO-01, ATMO-02
**Success Criteria** (what must be TRUE):
  1. The world cycles through day and night in roughly 10 minutes with smooth, continuous lighting transitions
  2. At night, lanterns, torches, windows, and the campfire visibly glow as light sources
  3. Daylight is warm-toned and nighttime shifts to cool blue, with the transition clearly visible
  4. Additional particle effects beyond fireflies are visible (sparks near the forge, dust motes, drifting leaves)
  5. The campfire glow and smoke visibly intensify at night compared to daytime
**Plans**: TBD

Plans:
- [ ] 22-01: TBD
- [ ] 22-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 20 → 21 → 22

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
| 20. World & Building Art | v2.0 | Complete    | 2026-03-03 | 2026-03-03 |
| 21. Character Identity | 1/2 | In Progress|  | - |
| 22. Day/Night Cycle & Atmosphere | v2.0 | 0/? | Not started | - |

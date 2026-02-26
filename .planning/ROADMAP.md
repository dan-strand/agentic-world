# Roadmap: Agent World

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Fantasy RPG Aesthetic** - Phases 4-7 (shipped 2026-02-26)
- 🚧 **v1.2 Activity Monitoring & Labeling** - Phases 8-10 (in progress)

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

### v1.2 Activity Monitoring & Labeling (In Progress)

- [x] **Phase 8: Dynamic Building Labels** - Buildings show active project folder names; revert to RPG names when vacant
- [ ] **Phase 9: Speech Bubbles and Project Routing** - Speech bubbles trigger on all meaningful activity changes; project-based building assignment
- [ ] **Phase 10: Agent Fade-Out Lifecycle** - Completed agents fade out at Guild Hall; stale sessions cleaned up properly

## Phase Details

### Phase 8: Dynamic Building Labels
**Goal**: Buildings reflect which projects are active -- users see project folder names on occupied buildings and RPG names on vacant ones
**Depends on**: Phase 7 (existing building and label infrastructure)
**Requirements**: LABEL-01, LABEL-02, LIFE-03
**Success Criteria** (what must be TRUE):
  1. When a Claude session is working at a building, that building's label shows the session's project folder name instead of the RPG name
  2. When all sessions for a project end or leave a building, the label reverts to the original RPG name (e.g., "Wizard Tower")
  3. Only the first 4 active projects get assigned to buildings; any additional project sessions remain at Guild Hall without a dedicated building
  4. Project folder names longer than ~15 characters are truncated with ellipsis so labels stay readable
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md -- Building label infrastructure: MAX_LABEL_CHARS constant, BitmapFont ASCII expansion, Building setLabel/resetLabel methods
- [x] 08-02-PLAN.md -- Project-to-building routing: replace activity-based routing with project-based assignment, dynamic label updates, slot release

### Phase 9: Speech Bubbles and Project Routing
**Goal**: Agents communicate their current activity through speech bubbles that appear on meaningful changes and fade naturally, with agents routed to buildings by project rather than activity type
**Depends on**: Phase 8 (building label infrastructure, project-to-building mapping)
**Requirements**: BUBBLE-01, BUBBLE-02, BUBBLE-03
**Success Criteria** (what must be TRUE):
  1. When an agent first leaves Guild Hall for a building, a speech bubble appears showing its current activity
  2. When an agent's activity changes while already at a building (e.g., switches from reading to editing), a new speech bubble appears
  3. Speech bubbles fade out automatically after a few seconds without user intervention
  4. Agents from the same project go to the same building, so building labels accurately reflect which project is working there
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

### Phase 10: Agent Fade-Out Lifecycle
**Goal**: Completed agents gracefully leave the world instead of accumulating at Guild Hall forever
**Depends on**: Phase 9 (project routing and activity tracking must be stable before adding lifecycle cleanup)
**Requirements**: LIFE-01, LIFE-02
**Success Criteria** (what must be TRUE):
  1. After an agent celebrates and walks back to Guild Hall, it lingers briefly then fades out and disappears
  2. Faded-out agents do not reappear due to stale session polling -- only genuinely reactivated sessions create new agents
  3. After running for 30+ minutes with sessions completing, no invisible agents accumulate in memory (Guild Hall area stays clean)
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 9 -> 10

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
| 9. Speech Bubbles and Project Routing | v1.2 | 0/? | Not started | - |
| 10. Agent Fade-Out Lifecycle | v1.2 | 0/? | Not started | - |

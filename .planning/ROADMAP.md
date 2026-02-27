# Roadmap: Agent World

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Fantasy RPG Aesthetic** - Phases 4-7 (shipped 2026-02-26)
- ✅ **v1.2 Activity Monitoring & Labeling** - Phases 8-10 (shipped 2026-02-26)
- 🚧 **v1.3 Audio & Status Reliability** - Phases 11-13 (in progress)

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

### v1.3 Audio & Status Reliability (In Progress)

- [ ] **Phase 11: Status & Visibility Audit** - Verify status transitions are accurate, agents always visible when they should be, edge cases handled (gap closure in progress)
- [ ] **Phase 12: Jobs Done Global Signal** - "Jobs done" sound fires only when ALL sessions are waiting, not per-session
- [ ] **Phase 13: Ready to Work Reminders** - Per-session reminder timers from waiting state, throttled so sounds never stack

## Phase Details

### Phase 11: Status & Visibility Audit
**Goal**: The status pipeline and agent visibility are bulletproof -- every session is accurately tracked and always has a visible agent when it should
**Depends on**: Phase 10 (existing status and lifecycle infrastructure)
**Requirements**: STATUS-01, STATUS-02, STATUS-03, VIS-01, VIS-02, VIS-03
**Success Criteria** (what must be TRUE):
  1. When a Claude session transitions between active, waiting, and idle states, the agent's visual status updates correctly every time -- no stuck or wrong states
  2. Rapid status changes (e.g., active-waiting-active within seconds) are debounced without dropping the final committed state
  3. A session that reactivates after being dismissed (faded out) reappears as a fully functional agent at the correct building
  4. Every active or waiting session always has a visible agent on screen -- no invisible or missing agents under any circumstance
  5. Sessions where tool detection fails still route to a building (not left stranded at Guild Hall as if idle)
**Plans**: 3 plans
Plans:
- [x] 11-01-PLAN.md -- Fix system entry status and stale session filter
- [x] 11-02-PLAN.md -- Harden renderer status pipeline and agent visibility
- [ ] 11-03-PLAN.md -- Fix false "job's done" during active tool execution (gap closure)

### Phase 12: Jobs Done Global Signal
**Goal**: The "jobs done" sound is a single all-clear signal meaning every session has finished its current task -- not per-session noise
**Depends on**: Phase 11 (status transitions must be reliable before audio logic depends on them)
**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03
**Success Criteria** (what must be TRUE):
  1. When all non-idle sessions are simultaneously in "waiting" status, the "jobs done" sound plays exactly once
  2. When a single session transitions from active to waiting while other sessions are still active, no sound plays
  3. After "jobs done" plays, it does not play again until at least one session goes back to "active" and then all sessions return to "waiting"
**Plans**: TBD

### Phase 13: Ready to Work Reminders
**Goal**: Each waiting session gets a gentle audio nudge after sitting unattended, without sounds piling up across multiple sessions
**Depends on**: Phase 12 (jobs-done and reminder share SoundManager; jobs-done logic settled first avoids conflicting audio changes)
**Requirements**: AUDIO-04, AUDIO-05, AUDIO-06, AUDIO-07
**Success Criteria** (what must be TRUE):
  1. A session that enters "waiting" status gets a reminder sound after ~1 minute of waiting, not from "idle" status
  2. Two sessions that enter "waiting" within seconds of each other do not both play reminder sounds simultaneously -- at least ~30 seconds gap between any two reminder plays
  3. A session's reminder does not repeat after playing once until that session goes back to "active" and returns to "waiting" again
  4. Each session's waiting timer is independent -- one session going active does not reset another session's timer
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 11 -> 12 -> 13

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
| 11. Status & Visibility Audit | 2/2 | Complete    | 2026-02-27 | - |
| 12. Jobs Done Global Signal | v1.3 | 0/? | Not started | - |
| 13. Ready to Work Reminders | v1.3 | 0/? | Not started | - |

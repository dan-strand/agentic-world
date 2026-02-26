---
phase: 10-agent-fade-out-lifecycle
plan: 01
subsystem: renderer
tags: [pixi.js, fsm, agent-lifecycle, fade-out, memory-cleanup]

# Dependency graph
requires:
  - phase: 09-speech-bubbles-project-routing
    provides: Speech bubbles, project routing, 5-state agent FSM
provides:
  - 6-state agent FSM with fading_out terminal state
  - removeAgent() single cleanup method for all tracking Maps + scene graph
  - dismissedSessions resurrection guard
  - hasActiveAnimations() for GameLoop FPS awareness
  - releaseSlot() method on AgentFactory
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deferred removal (collect-then-remove) for safe Map mutation during iteration"
    - "Resurrection guard Set for stale IPC data prevention"
    - "Animation-aware FPS determination (GameLoop checks World.hasActiveAnimations())"

key-files:
  created: []
  modified:
    - src/shared/constants.ts
    - src/renderer/agent.ts
    - src/renderer/agent-factory.ts
    - src/renderer/world.ts
    - src/renderer/game-loop.ts

key-decisions:
  - "Used early continue in manageAgents() for fading_out guard rather than adding to idle else-block (TS type narrowing made the else-block guard unreachable)"
  - "2000ms linger delay + 2000ms fade duration for natural visual timing"

patterns-established:
  - "Deferred removal: collect sessionIds of agents to remove, then delete outside iteration loop"
  - "Resurrection guard: dismissedSessions Set blocks stale IPC, only genuine reactivation (non-idle + active) clears it"

requirements-completed: [LIFE-01, LIFE-02]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 10 Plan 01: Agent Fade-Out Lifecycle Summary

**6-state agent FSM with fading_out terminal state, deferred removal pipeline cleaning all 7 tracking Maps, and dismissedSessions resurrection guard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T18:31:21Z
- **Completed:** 2026-02-26T18:34:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended agent FSM from 5 to 6 states with fading_out as a terminal state triggered after celebration walkback
- Built removeAgent() single cleanup method that destroys PixiJS container and cleans all 7 tracking Maps + factory slot cache
- Added dismissedSessions Set preventing stale IPC polling from resurrecting removed agents
- Made GameLoop animation-aware so fade-out renders at 30fps even when all sessions report idle

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent FSM extension with fading_out state and fade-out constants** - `0310fc2` (feat)
2. **Task 2: World removal pipeline, resurrection guard, and GameLoop animation-aware FPS** - `36f40f7` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/shared/constants.ts` - Added AGENT_FADEOUT_DELAY_MS (2000) and AGENT_FADEOUT_DURATION_MS (2000) constants
- `src/renderer/agent.ts` - Extended to 6-state FSM with fading_out, hasCompletedTask flag, fadeOutTimer, isFadedOut() check, guards on assignToCompound/assignToHQ/applyStatusVisuals
- `src/renderer/agent-factory.ts` - Added releaseSlot(sessionId) method for cleanup
- `src/renderer/world.ts` - Added removeAgent(), dismissedSessions Set, deferred removal in tick(), speech bubble hiding for fading agents, hasActiveAnimations(), resurrection guard in manageAgents()
- `src/renderer/game-loop.ts` - Made hasActive check include world.hasActiveAnimations() for smooth fade rendering

## Decisions Made
- Used early `continue` in manageAgents() for fading_out guard rather than adding to the idle else-block, because TypeScript type narrowing after the `continue` made the else-block guard unreachable (TS2367 error)
- Chose 2000ms for both linger delay and fade duration as a starting point (tunable via constants)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unreachable fading_out guard in idle routing else-block**
- **Found during:** Task 2 (World removal pipeline)
- **Issue:** Plan specified adding `agentState !== 'fading_out'` to the idle routing guard, but the early `continue` for fading_out agents (also specified in the plan) causes TypeScript to narrow the type, making the comparison unreachable (TS2367)
- **Fix:** Kept only the early `continue` guard which covers all routing paths, removed the redundant guard in the else-block
- **Files modified:** src/renderer/world.ts
- **Verification:** TypeScript compiles cleanly with `npx tsc --noEmit`
- **Committed in:** 36f40f7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial adjustment due to TypeScript type narrowing. Same behavior achieved via early continue. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent fade-out lifecycle is complete and ready for visual testing
- All phases in v1.2 milestone are now complete
- Manual verification recommended: watch an agent celebrate, walk back to Guild Hall, linger 2s, fade out over 2s, and confirm no ghost/flicker

## Self-Check: PASSED

All 5 modified files exist. Both task commits (0310fc2, 36f40f7) verified. All must-have artifacts confirmed: AGENT_FADEOUT constants, fading_out state, releaseSlot, dismissedSessions, hasActiveAnimations. All 4 key_links verified: isFadedOut() in world.ts, dismissedSessions.has in world.ts, hasActiveAnimations in world.ts and game-loop.ts, releaseSlot in world.ts.

---
*Phase: 10-agent-fade-out-lifecycle*
*Completed: 2026-02-26*

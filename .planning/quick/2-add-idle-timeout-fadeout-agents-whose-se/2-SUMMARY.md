---
phase: quick-2
plan: 01
subsystem: renderer
tags: [pixi.js, agent-lifecycle, idle-timeout, fade-out]

# Dependency graph
requires:
  - phase: 10-agent-fade-out-lifecycle
    provides: startFadeOut(), fading_out state, removeAgent pipeline
provides:
  - IDLE_TIMEOUT_MS constant (5 min continuous idle before fade-out)
  - Agent.cancelFadeOut() method for reactivation recovery
  - Per-agent idle duration tracking in World.tick()
  - Idle-timeout fade cancellation on session reactivation
affects: [agent-lifecycle, world-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns: [cancellable-fade-out, idle-timer-tracking]

key-files:
  created: []
  modified:
    - src/shared/constants.ts
    - src/renderer/agent.ts
    - src/renderer/world.ts

key-decisions:
  - "Idle timeout uses committed status (post-debounce) to avoid premature fade triggers from raw status flicker"
  - "Cancellation condition checks both activityType and status to catch any form of reactivation"

patterns-established:
  - "Cancellable fade-out: idle-timeout fades can be cancelled via cancelFadeOut(), session-gone fades cannot"
  - "Timer tracking in tick() with Map cleanup in both removeAgent() and manageAgents() cleanup block"

requirements-completed: [IDLE-TIMEOUT-FADEOUT]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Quick Task 2: Add Idle Timeout Fadeout Summary

**5-minute idle timeout triggers existing fade-out lifecycle with cancellation on session reactivation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T21:26:41Z
- **Completed:** 2026-02-26T21:28:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Agents whose sessions are continuously idle for 5 minutes now fade out and get cleaned up via existing lifecycle
- Reactivated sessions cancel in-progress idle-timeout fades, restoring agent to idle_at_hq with full alpha
- Existing session-disappearance fade-out behavior preserved unchanged
- Idle timer resets when agent becomes non-idle, preventing premature fade-out

## Task Commits

Each task was committed atomically:

1. **Task 1: Add IDLE_TIMEOUT_MS constant and Agent.cancelFadeOut() method** - `989bb6b` (feat)
2. **Task 2: Add idle duration tracking and timeout trigger to World** - `268cdfc` (feat)

## Files Created/Modified
- `src/shared/constants.ts` - Added IDLE_TIMEOUT_MS = 300000 (5 min) constant
- `src/renderer/agent.ts` - Added cancelFadeOut() method that restores fading_out agents to idle_at_hq
- `src/renderer/world.ts` - Added idleTimers Map, tick() idle tracking, manageAgents() cancellation logic, cleanup in removeAgent() and cleanup block

## Decisions Made
- Idle timeout uses committed status (post-debounce) rather than raw status, preventing premature fade triggers from brief status flicker
- Cancellation condition checks both activityType !== 'idle' OR status !== 'idle' to catch any form of reactivation (covers edge case where status changes before activityType or vice versa)
- After cancelFadeOut(), agent falls through to normal routing logic so it gets properly re-routed to its building

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx electron-vite build` failed due to missing electron-vite in node_modules (project uses electron-forge, not electron-vite). This is a pre-existing environment issue, not caused by changes. TypeScript compilation (`npx tsc --noEmit`) passed cleanly, validating code correctness.

## User Setup Required

None - no external service configuration required.

---
*Quick Task: 2-add-idle-timeout-fadeout*
*Completed: 2026-02-26*

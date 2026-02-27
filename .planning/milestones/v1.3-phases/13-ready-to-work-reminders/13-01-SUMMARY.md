---
phase: 13-ready-to-work-reminders
plan: 01
subsystem: audio
tags: [reminder, throttle, waiting-status, pixi, timer]

# Dependency graph
requires:
  - phase: 11-status-visibility-audit
    provides: Reliable committed status detection for waiting/active/idle states
provides:
  - Per-session waiting reminder timers with global throttle
  - WAITING_REMINDER_MS and REMINDER_THROTTLE_MS constants
  - Active-cycle guard preventing reminder repeats without active transition
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global reminder throttle via lastReminderPlayTime field (shared across idle and waiting reminders)"
    - "Active-cycle guard: hasPlayedWaitingReminder only resets on committed === 'active' transition"

key-files:
  created: []
  modified:
    - src/shared/constants.ts
    - src/renderer/world.ts

key-decisions:
  - "Waiting reminder flag consumed even when throttled -- prevents retry, lets next session fire naturally"
  - "Idle reminders updated to share global throttle with waiting reminders"
  - "Only 'active' status clears the waiting reminder played flag (not idle/error/other)"

patterns-established:
  - "Global sound throttle: single lastReminderPlayTime field on World class prevents any two reminder sounds within REMINDER_THROTTLE_MS"

requirements-completed: [AUDIO-04, AUDIO-05, AUDIO-06, AUDIO-07]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 13 Plan 01: Ready-to-Work Reminders Summary

**Per-session waiting reminder timers with 30s global throttle and active-cycle guard preventing repeats**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T04:09:40Z
- **Completed:** 2026-02-27T04:11:17Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added WAITING_REMINDER_MS (60s) and REMINDER_THROTTLE_MS (30s) constants
- Implemented per-session waiting timer that fires reminder after 1 minute of continuous waiting status
- Global throttle ensures no two reminder sounds (idle or waiting) play within 30 seconds of each other
- Active-cycle guard requires session to go active before reminder can fire again

## Task Commits

Each task was committed atomically:

1. **Task 1: Add waiting reminder constants and waiting timer state** - `bb20d56` (feat)
2. **Task 2: Implement waiting reminder timer logic with throttle and active-cycle guard** - `7ba0853` (feat)

## Files Created/Modified
- `src/shared/constants.ts` - Added WAITING_REMINDER_MS and REMINDER_THROTTLE_MS constants
- `src/renderer/world.ts` - Added waitingTimers/hasPlayedWaitingReminder Maps, lastReminderPlayTime field, waiting reminder timer block in tick(), updated idle reminder to share global throttle

## Decisions Made
- Waiting reminder flag is consumed even when throttled by the global timer -- this prevents the same session from retrying and instead lets the next session's natural timer fire when the throttle window opens
- Idle reminders were updated to also respect the global throttle (shared lastReminderPlayTime field)
- Only the 'active' committed status clears hasPlayedWaitingReminder -- transitioning to idle, error, or any other state does NOT reset it, requiring a full active cycle before reminder can fire again

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Waiting reminder logic is complete and integrated with existing idle reminder system
- Both reminder types share the global throttle, preventing sound stacking
- No further phases depend on this plan

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 13-ready-to-work-reminders*
*Completed: 2026-02-27*

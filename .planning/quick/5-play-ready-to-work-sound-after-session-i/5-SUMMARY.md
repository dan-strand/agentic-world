---
phase: quick-5
plan: 01
subsystem: audio
tags: [html5-audio, idle-reminder, sound-manager, game-loop]

# Dependency graph
requires:
  - phase: quick-3
    provides: SoundManager singleton with volume/mute controls and jobs-done sound
provides:
  - playReminder() method on SoundManager with dedicated Audio element
  - Per-agent idle reminder tracking in World tick loop (hasPlayedReminder Map)
  - IDLE_REMINDER_MS constant (60000ms) for configurable reminder threshold
affects: [sound-manager, world-tick-loop, idle-behavior]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual HTMLAudioElement pattern for independent sound effects with shared volume/mute"
    - "One-shot flag Map (hasPlayedReminder) for per-agent event deduplication in tick loop"

key-files:
  created:
    - assets/sounds/ready-to-work.mp3
  modified:
    - src/shared/constants.ts
    - src/renderer/sound-manager.ts
    - src/renderer/world.ts

key-decisions:
  - "Separate Audio element per sound effect rather than re-using single element (prevents interrupting jobs-done with reminder)"
  - "Renamed audio -> jobsDoneAudio for clarity when adding second Audio element"

patterns-established:
  - "Multi-sound SoundManager: each sound gets own Audio element, shared volume/mute propagation"
  - "Per-agent one-shot event tracking: Map<string, boolean> flag set on trigger, deleted on state reset"

requirements-completed: [QUICK-5]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Quick Task 5: Play Ready-to-Work Sound Summary

**Idle reminder sound plays once per agent after 1 minute of continuous idle, with shared volume/mute controls**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T22:24:10Z
- **Completed:** 2026-02-26T22:25:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Ready-to-work.mp3 bundled in assets/sounds/ (auto-copied by CopyWebpackPlugin)
- SoundManager extended with playReminder() using dedicated Audio element for ready-to-work.mp3
- Volume slider and mute toggle affect both jobs-done and reminder sounds identically
- World tick loop tracks per-agent idle duration and plays reminder once at 1-minute threshold
- Reminder flag resets when agent becomes active, enabling sound on next idle period
- All cleanup paths (removeAgent, manageAgents, fade-out, active reset) properly delete tracking state

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy sound file and add constant** - `789bebd` (chore)
2. **Task 2: Extend SoundManager with playReminder() and add idle reminder tracking to World** - `a056b02` (feat)

## Files Created/Modified
- `assets/sounds/ready-to-work.mp3` - Ready-to-work reminder sound file (copied from project root)
- `src/shared/constants.ts` - Added IDLE_REMINDER_MS = 60000 constant
- `src/renderer/sound-manager.ts` - Added reminderAudio element, playReminder() method, updated volume/mute to both elements
- `src/renderer/world.ts` - Added hasPlayedReminder Map, idle reminder logic in tick(), cleanup in removeAgent/manageAgents

## Decisions Made
- Separate Audio element per sound rather than re-using single element -- prevents jobs-done sound from being interrupted by reminder
- Renamed `audio` to `jobsDoneAudio` for clarity when adding second Audio element

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sound infrastructure supports easy addition of future sound effects (pattern: add Audio element + play method)
- Reminder threshold is configurable via IDLE_REMINDER_MS constant

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: quick-5*
*Completed: 2026-02-26*

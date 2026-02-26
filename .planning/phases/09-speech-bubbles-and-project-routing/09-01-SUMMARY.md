---
phase: 09-speech-bubbles-and-project-routing
plan: 01
subsystem: ui
tags: [pixi.js, bitmaptext, speech-bubble, activity-labels]

# Dependency graph
requires:
  - phase: 08-dynamic-building-labels
    provides: BitmapFont PixelSignpost and Building BitmapText pattern
provides:
  - ACTIVITY_DISPLAY_NAMES constant mapping ActivityType to display strings
  - BitmapText labels in speech bubbles with auto-sizing background
  - Two new bubble trigger points (Guild Hall departure + same-building activity change)
affects: [09-speech-bubbles-and-project-routing]

# Tech tracking
tech-stack:
  added: []
  patterns: [dynamic-width speech bubble with BitmapText + icon]

key-files:
  created: []
  modified:
    - src/shared/constants.ts
    - src/renderer/speech-bubble.ts
    - src/renderer/world.ts

key-decisions:
  - "Used bubbleLabel property name to avoid PixiJS Container.label collision (consistent with 08-01 labelText pattern)"
  - "Removed unnecessary assignToCompound in working-state activity change since project routing keeps agent at same building"

patterns-established:
  - "Speech bubble auto-sizing: clear + redraw bubble Graphics on each show() with dynamic width calculation"

requirements-completed: [BUBBLE-01, BUBBLE-02, BUBBLE-03]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 9 Plan 1: Speech Bubble Text Labels Summary

**BitmapText activity labels in auto-sized speech bubbles with dual trigger points (Guild Hall departure + activity change)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T18:14:30Z
- **Completed:** 2026-02-26T18:15:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added ACTIVITY_DISPLAY_NAMES constant mapping all 5 ActivityTypes to capitalized display strings
- Enhanced SpeechBubble with BitmapText label showing activity name alongside icon, with auto-sizing bubble background
- Added speech bubble trigger on initial Guild Hall departure (idle_at_hq -> walking_to_building)
- Cleaned up working-state activity change to only show bubble without unnecessary assignToCompound call

## Task Commits

Each task was committed atomically:

1. **Task 1: Add activity display names constant and enhance SpeechBubble with BitmapText label and auto-sizing** - `f8721b3` (feat)
2. **Task 2: Add speech bubble triggers for Guild Hall departure and same-building activity changes** - `9c7125a` (feat)

## Files Created/Modified
- `src/shared/constants.ts` - Added ACTIVITY_DISPLAY_NAMES Record mapping ActivityType to display strings
- `src/renderer/speech-bubble.ts` - Added BitmapText label, dynamic bubble width calculation, re-centering on show()
- `src/renderer/world.ts` - Added bubble.show() trigger in idle_at_hq block, simplified working-state activity change

## Decisions Made
- Used `bubbleLabel` as property name instead of `label` to avoid collision with PixiJS Container.label (consistent with 08-01 decision to use `labelText`)
- Removed `assignToCompound` and `agentBuilding.set` from working-state activity change path since project-based routing ensures agent is already at the correct building

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- No `npm run build` script available (Electron Forge uses `start` for dev builds). Verified via `tsc --noEmit` which passed cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Speech bubbles now show text labels and trigger on both departure and activity change
- Ready for any remaining Phase 09 plans or Phase 10

## Self-Check: PASSED

All files exist, all commits verified (f8721b3, 9c7125a). TypeScript compiles with zero errors.

---
*Phase: 09-speech-bubbles-and-project-routing*
*Completed: 2026-02-26*

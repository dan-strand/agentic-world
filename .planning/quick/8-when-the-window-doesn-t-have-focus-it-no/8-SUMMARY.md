---
phase: quick-8
plan: 1
subsystem: audio
tags: [electron, backgroundThrottling, ipc, audio, visibilitychange]

# Dependency graph
requires: []
provides:
  - Background audio playback when window is unfocused
  - IPC-based minimize/restore event forwarding from main to renderer
  - Ticker continues running on focus loss (only stops on minimize)
affects: [game-loop, sound-manager]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IPC event forwarding for window state (minimize/restore) instead of visibilitychange"
    - "backgroundThrottling: false for always-on monitoring apps"

key-files:
  created: []
  modified:
    - src/main/index.ts
    - src/shared/types.ts
    - src/preload/preload.ts
    - src/renderer/index.ts

key-decisions:
  - "Used backgroundThrottling: false to prevent Chromium from suppressing timers and audio when window is not visible"
  - "Replaced visibilitychange with Electron IPC minimize/restore events so ticker only stops on actual minimize, not on focus loss"

patterns-established:
  - "IPC minimize/restore: Main process forwards BrowserWindow minimize/restore events via IPC_CHANNELS, renderer listens via preload callbacks"

requirements-completed: [QUICK-8]

# Metrics
duration: 1min
completed: 2026-03-17
---

# Quick Task 8: Background Audio Fix Summary

**Disabled Chromium backgroundThrottling and replaced visibilitychange with IPC minimize/restore events so audio notifications play when the window is unfocused**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-17T04:21:11Z
- **Completed:** 2026-03-17T04:22:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Disabled Chromium backgroundThrottling so audio and timers are not suppressed when window is behind other windows
- Replaced visibilitychange listener with IPC-based minimize/restore events so the game ticker only pauses on actual window minimize, not on simple focus loss
- Audio notifications (session completion, idle reminders) now play reliably regardless of window focus state

## Task Commits

Each task was committed atomically:

1. **Task 1: Disable background throttling and add IPC minimize/restore events** - `2f112e8` (feat)
2. **Task 2: Switch renderer from visibilitychange to IPC minimize/restore** - `2c31f80` (fix)

## Files Created/Modified
- `src/main/index.ts` - Added backgroundThrottling: false, added minimize/restore IPC event forwarding
- `src/shared/types.ts` - Added WINDOW_MINIMIZED/WINDOW_RESTORED to IPC_CHANNELS, added onWindowMinimized/onWindowRestored to IAgentWorldAPI
- `src/preload/preload.ts` - Added onWindowMinimized/onWindowRestored callbacks exposed to renderer via contextBridge
- `src/renderer/index.ts` - Replaced visibilitychange listener with IPC-based minimize/restore callbacks

## Decisions Made
- Used backgroundThrottling: false to prevent Chromium from suppressing timers and audio when window is not visible -- appropriate for a monitoring tool that must run in the background
- Replaced visibilitychange (which fires on any focus loss) with Electron IPC minimize/restore events (which fire only on actual minimize/restore) so the ticker keeps running when the window is simply behind another window

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

All 4 modified files verified present. Both commit hashes (2f112e8, 2c31f80) verified in git log. backgroundThrottling, WINDOW_MINIMIZED, onWindowMinimized all confirmed in their respective files. TypeScript compiles cleanly.

---
*Phase: quick-8*
*Completed: 2026-03-17*

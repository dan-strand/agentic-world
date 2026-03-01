---
phase: 17-window-layout-and-parsing-infrastructure
plan: 01
subsystem: ui
tags: [electron, html, css, flexbox, layout, pixi]

# Dependency graph
requires:
  - phase: 16-agent-stations-and-info-overlay
    provides: "PixiJS world rendering at 1024x768 with buildings, agents, and effects"
provides:
  - "1024x1080 Electron window with flex column layout"
  - "DASHBOARD_HEIGHT (312) and WINDOW_HEIGHT (1080) shared constants"
  - "#dashboard HTML div with dark background below RPG canvas"
  - "Audio controls repositioned above dashboard boundary"
affects: [18-usage-aggregation-and-dashboard-rendering, 19-persistence-and-lifecycle-management]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Flex column layout separating PixiJS canvas from HTML dashboard"]

key-files:
  created: []
  modified:
    - src/shared/constants.ts
    - src/main/index.ts
    - src/renderer/index.html

key-decisions:
  - "Dashboard is a plain HTML div below the PixiJS canvas, not embedded in the PixiJS scene"
  - "Audio controls use fixed positioning at bottom: 320px to stay above dashboard boundary"
  - "Body uses explicit 1024x1080 dimensions with flex-direction: column instead of percentage sizing"

patterns-established:
  - "Flex column layout: #app (768px, flex-shrink: 0) + #dashboard (312px, flex-shrink: 0)"
  - "Dashboard styling: #0f0f1a background, #2a2a3e border-top, #c9a96e text, Segoe UI font at 13px"

requirements-completed: [LAYOUT-01, LAYOUT-02, LAYOUT-03]

# Metrics
duration: 5min
completed: 2026-03-01
---

# Phase 17 Plan 01: Window Layout Summary

**Electron window expanded to 1024x1080 with flex column layout: 768px PixiJS canvas pinned on top, 312px dark HTML dashboard panel below**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-01T18:27:33Z
- **Completed:** 2026-03-01T18:32:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added DASHBOARD_HEIGHT (312) and WINDOW_HEIGHT (1080) layout constants to shared/constants.ts
- Expanded BrowserWindow from 768 to 1080 height (width stays 1024)
- Created #dashboard div with dark background, border-top, and placeholder text below the RPG canvas
- Restructured HTML body to flex column layout with pinned heights preventing PixiJS stretching
- Repositioned audio controls above dashboard boundary (bottom: 320px)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dashboard layout constants** - `d07c862` (feat)
2. **Task 2: Expand window and add dashboard div** - `2a6e219` (feat)

## Files Created/Modified
- `src/shared/constants.ts` - Added DASHBOARD_HEIGHT = 312 and WINDOW_HEIGHT = 1080 constants
- `src/main/index.ts` - BrowserWindow height/minHeight/maxHeight changed from 768 to 1080
- `src/renderer/index.html` - Flex column layout, #app pinned at 768px, #dashboard at 312px, audio controls repositioned

## Decisions Made
- Used explicit pixel dimensions (1024x1080) on html/body instead of percentages to prevent any layout ambiguity
- Audio controls repositioned to bottom: 320px (312px dashboard + 8px margin) using fixed positioning
- Dashboard placeholder uses muted #665533 text color to be subtle until real content arrives in Phase 18

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in `src/main/jsonl-reader.test.ts` (references unexported `readUsageTotals`) -- confirmed pre-existing by checking out clean state. Not caused by this plan's changes, not in scope.
- Initial `npm run make` failed with EPERM file lock on `.webpack/renderer` -- resolved by clearing webpack cache and retrying. Transient Windows file system issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Window layout ready for Phase 18 dashboard rendering -- #dashboard div exists and is styled
- DASHBOARD_HEIGHT and WINDOW_HEIGHT constants available for import by any module
- PixiJS world unchanged at 1024x768, no regression risk

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both task commits verified (d07c862, 2a6e219)
- DASHBOARD_HEIGHT constant present in constants.ts
- WINDOW_HEIGHT constant present in constants.ts
- 1080 height value present in main/index.ts
- #dashboard element present in index.html
- 768px height pinning present in index.html

---
*Phase: 17-window-layout-and-parsing-infrastructure*
*Completed: 2026-03-01*

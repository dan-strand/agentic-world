---
phase: 02-visual-world
plan: 03
subsystem: renderer
tags: [pixi.js, bitmap-font, graphics-context, radial-layout, speech-bubble, compound]

# Dependency graph
requires:
  - phase: 02-visual-world
    provides: "ActivityType, compound/animation constants, COMPOUND_WIDTH/HEIGHT, HQ_WIDTH/HEIGHT, SPEECH_BUBBLE_DURATION/FADE_MS"
provides:
  - "installPixelFont() for PixelSignpost BitmapFont"
  - "initActivityIcons() + getActivityIcon() for 5 activity icon GraphicsContexts"
  - "SpeechBubble Container with show/tick/fade behavior"
  - "HQ Container with building facade, idle position calculator"
  - "Compound Container with fence, gate, signpost, 4 sub-location markers"
  - "calculateCompoundPositions() radial layout with single/double ring"
  - "calculateRoadPath() for HQ-to-compound road spokes"
affects: [02-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["BitmapFont.install() for pixel art text", "GraphicsContext pre-built icons for speech bubbles", "Radial single/double ring layout algorithm"]

key-files:
  created:
    - src/renderer/bitmap-font.ts
    - src/renderer/activity-icons.ts
    - src/renderer/speech-bubble.ts
    - src/renderer/hq.ts
    - src/renderer/compound.ts
    - src/renderer/compound-layout.ts

key-decisions:
  - "Signpost text truncated at 12 chars with ellipsis for long project names"
  - "HQ anchor at bottom-center so door/entrance is at origin for agent positioning"
  - "Double ring layout staggers outer ring by half-step to avoid overlap with inner compounds"
  - "Sub-location markers drawn with detailed Graphics primitives (colored books on shelf, LED lights on server rack)"

patterns-established:
  - "Static scene elements drawn once in constructor -- no per-frame redraw"
  - "BitmapText with PixelSignpost font for all in-world text labels"
  - "GraphicsContext icon swap pattern for speech bubble activity changes"
  - "Local coordinate positions returned from getSubLocationPosition/getEntrancePosition/getVehicleParkPosition"

requirements-completed: [WORLD-01, WORLD-04, WORLD-05]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 2 Plan 3: World Scene Infrastructure Summary

**HQ building, fenced project compounds with signpost/sub-locations, radial layout algorithm, BitmapFont pixel text, and icon-based speech bubbles with auto-fade**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T19:07:28Z
- **Completed:** 2026-02-25T19:09:59Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- Built complete world scene infrastructure with HQ building (200x120) featuring facade details, windows, door, antenna, guard booth, and BitmapText "HQ" label
- Created project compound system (160x120) with fence, gate opening, signpost using PixelSignpost BitmapFont, and 4 visually distinct sub-location markers (workbench, bookshelf, server rack, antenna)
- Implemented radial layout algorithm with single ring for 1-6 compounds and double ring for 7+ compounds, with staggered outer ring positioning
- Built speech bubble system with GraphicsContext icon swapping and configurable auto-fade timing
- Created 5 pre-built activity icon GraphicsContexts (wrench, magnifier, gear, antenna, pause bars)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bitmap font, activity icons, and speech bubble system** - `fb96758` (feat)
2. **Task 2: Create HQ building, project compound, and radial layout algorithm** - `9d5fbaf` (feat)

## Files Created/Modified
- `src/renderer/bitmap-font.ts` - installPixelFont() creates PixelSignpost BitmapFont with nearest scaleMode for crisp pixel text
- `src/renderer/activity-icons.ts` - initActivityIcons() pre-builds 5 GraphicsContext icons; getActivityIcon() retrieves by ActivityType
- `src/renderer/speech-bubble.ts` - SpeechBubble Container with show(activity), tick(deltaMs), auto-fade after 4s visible + 1s fade
- `src/renderer/hq.ts` - HQ Container with building facade, windows, door, antenna, guard booth, BitmapText label, getIdlePosition()
- `src/renderer/compound.ts` - Compound Container with fence, gate, signpost, 4 sub-location markers, getSubLocationPosition/getEntrancePosition/getVehicleParkPosition
- `src/renderer/compound-layout.ts` - calculateCompoundPositions() radial layout, calculateRoadPath() for road spokes

## Decisions Made
- Signpost text truncated at 12 characters with ".." suffix for long project names -- prevents signpost overflow while remaining readable
- HQ anchor at bottom-center (door at origin) so idle agents position naturally in front of entrance
- Double ring layout staggers outer ring compounds by half an angular step relative to inner ring, preventing radial overlap
- Sub-location markers use detailed Graphics primitives (colored book spines on bookshelf, LED indicator lights on server rack) for visual distinction without labels

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 world scene modules ready for composition in Plan 04 (world.ts rewrite)
- installPixelFont() must be called before any BitmapText creation (before Compound/HQ construction)
- initActivityIcons() must be called before any SpeechBubble.show() usage
- calculateCompoundPositions() returns positions ready for direct use as Container x/y coordinates
- Compound.getSubLocationPosition() returns local coordinates -- world layer adds compound.position for global coords

## Self-Check: PASSED

- All 6 source files exist
- All 2 task commits verified (fb96758, 9d5fbaf)
- SUMMARY.md exists at expected path

---
*Phase: 02-visual-world*
*Completed: 2026-02-25*

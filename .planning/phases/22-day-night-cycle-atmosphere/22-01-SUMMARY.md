---
phase: 22-day-night-cycle-atmosphere
plan: 01
subsystem: renderer
tags: [pixi.js, day-night-cycle, color-temperature, lighting, glow-effects]

# Dependency graph
requires:
  - phase: 20-scenery-and-world-detail
    provides: scenery layer with lantern/torch sprite positions
  - phase: 14-ambient-particles-and-effects
    provides: ColorMatrixFilter warm tint on app.stage
provides:
  - DayNightCycle manager with smooth sine-wave time-of-day progression
  - Night glow layer with 23 radial glow sprites at light source positions
  - Dynamic stage ColorMatrixFilter driven by cycle (warm golden to cool blue)
  - Exported LIGHT_SOURCE_POSITIONS array for future lighting consumers
affects: [22-02-PLAN, ambient-particles, campfire-smoke]

# Tech tracking
tech-stack:
  added: []
  patterns: [sine-wave-with-power-curve for smooth day/night transitions, concentric-circles for soft radial glow without filters]

key-files:
  created:
    - src/renderer/day-night-cycle.ts
    - src/renderer/night-glow-layer.ts
  modified:
    - src/shared/constants.ts
    - src/renderer/world.ts
    - src/renderer/scenery-layer.ts

key-decisions:
  - "Sine wave with pow(1.5) sharpening for natural day-dominant cycle"
  - "Concentric circles for glow sprites instead of PixiJS blur filters for performance"
  - "Night glow layer placed between scenery and ambient particles in z-order"
  - "Stage filter matrix set directly via 4x5 row-major array for per-channel RGB scaling"

patterns-established:
  - "Time-of-day driven rendering: DayNightCycle.tick() in world.tick() drives global lighting state"
  - "Light source registry: LIGHT_SOURCE_POSITIONS exported for reuse across lighting systems"

requirements-completed: [DNCL-01, DNCL-02, DNCL-03]

# Metrics
duration: ~8min
completed: 2026-03-03
---

# Phase 22 Plan 01: Day/Night Cycle Core Summary

**Smooth 10-minute day/night cycle with sine-wave color temperature transitions and 23 radial glow sprites at lanterns, torches, campfire, and building windows**

## Performance

- **Duration:** ~8 min (across checkpoint pause)
- **Started:** 2026-03-03T13:28:00Z
- **Completed:** 2026-03-03T14:46:22Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 5

## Accomplishments
- DayNightCycle manager with continuous sine-wave progression producing smooth day-to-night transitions over 10 minutes
- Dynamic stage ColorMatrixFilter replacing static warm tint, interpolating between warm golden (0xFFE8C0) daytime and cool blue (0x6680CC) nighttime
- Night glow layer with 23 glow sprites (6 lanterns, 8 torches, 1 campfire, 4 building windows, 4 additional lanterns) that fade in at dusk and out at dawn
- Exported LIGHT_SOURCE_POSITIONS registry from scenery-layer.ts for reuse by future lighting systems

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DayNightCycle manager and add constants** - `a32ad82` (feat)
2. **Task 2: Create night glow layer, integrate cycle into world, export light positions** - `77b4d79` (feat)
3. **Task 3: Visual verification of day/night cycle and glow effects** - checkpoint:human-verify (approved)

## Files Created/Modified
- `src/renderer/day-night-cycle.ts` - DayNightCycle class with tick(), getProgress(), getNightIntensity(), getTintRGB()
- `src/renderer/night-glow-layer.ts` - buildNightGlowLayer() and updateNightGlowLayer() with concentric-circle radial glow sprites
- `src/shared/constants.ts` - DAY_NIGHT_CYCLE_MS, color temperature RGB constants, glow radius/color/alpha constants
- `src/renderer/world.ts` - Integrated DayNightCycle and night glow layer into init() and tick(), replaced static warm filter with dynamic color matrix
- `src/renderer/scenery-layer.ts` - Exported LIGHT_SOURCE_POSITIONS array with type-tagged light source definitions

## Decisions Made
- Sine wave with pow(1.5) power curve creates day-dominant cycle (~50% daylight, ~30% night, ~20% transition) for a pleasant visual rhythm
- Used concentric circles with decreasing alpha (4 steps) for glow sprites instead of PixiJS blur filters, avoiding GPU-intensive filter passes
- Night glow layer placed between scenery and ambient particles in scene z-order for natural layering
- ColorMatrixFilter.matrix set directly as 4x5 row-major array for precise per-channel RGB scaling without using tint() convenience method

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DayNightCycle manager ready for Plan 02 (atmosphere enhancements) to consume getNightIntensity() for particle behavior changes
- LIGHT_SOURCE_POSITIONS exported and available for future lighting effects
- Stage filter pipeline established for additional atmospheric effects

## Self-Check: PASSED

All 5 files verified on disk. Both task commits (a32ad82, 77b4d79) verified in git log.

---
*Phase: 22-day-night-cycle-atmosphere*
*Completed: 2026-03-03*

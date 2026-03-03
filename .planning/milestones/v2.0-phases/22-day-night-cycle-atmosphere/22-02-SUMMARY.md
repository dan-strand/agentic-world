---
phase: 22-day-night-cycle-atmosphere
plan: 02
subsystem: renderer
tags: [pixi, particles, atmosphere, day-night, ambient, smoke]

# Dependency graph
requires:
  - phase: 22-01
    provides: "DayNightCycle manager with getNightIntensity(), night glow layer, stage color filter"
provides:
  - "Enhanced ambient particle system with sparks, dust motes, and drifting leaves"
  - "Night-modulated firefly brightness (alpha boost at night)"
  - "Night-modulated chimney smoke (denser, more opaque, faster spawn at night)"
  - "nightIntensity flow from DayNightCycle through world.ts to all particle/smoke systems"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["nightIntensity parameter threading through tick() methods", "dynamic particle lifecycle with spawn/age/destroy", "day-inverse particle visibility (dust motes fade at night)"]

key-files:
  created: []
  modified:
    - src/shared/constants.ts
    - src/renderer/ambient-particles.ts
    - src/renderer/building.ts
    - src/renderer/world.ts

key-decisions:
  - "Sparks use dynamic spawn/destroy lifecycle unlike pre-created fireflies"
  - "Dust motes fade at night using inverse nightIntensity for daytime visibility"
  - "Leaves use small rectangles (2.5x1.5) instead of circles for elongated leaf shape"
  - "Building smoke night modulation uses three independent multipliers (count, opacity, spawn rate)"

patterns-established:
  - "nightIntensity parameter threading: tick(deltaMs, nightIntensity) pattern for all visual systems"
  - "Dynamic particle lifecycle: spawn timer, age tracking, auto-destroy on lifetime expiry"

requirements-completed: [ATMO-01, ATMO-02, DNCL-01, DNCL-02, DNCL-03]

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 22 Plan 02: Enhanced Atmosphere & Night Effects Summary

**Sparks, dust motes, and drifting leaves added to ambient particles with night-modulated firefly brightness and chimney smoke density**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T14:46:00Z
- **Completed:** 2026-03-03T14:52:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Three new particle types: forge sparks near Training Grounds, cream-colored dust motes during daytime, and drifting leaves with green/amber/brown colors
- Firefly alpha boosted at night via FIREFLY_NIGHT_ALPHA_BOOST constant for brighter nighttime visibility
- Chimney smoke intensifies at night with increased max count (5 to 8), higher opacity (1.5x), and faster spawn rate (0.6x interval)
- nightIntensity value flows from DayNightCycle through world.ts tick() to ambient particles and building systems

## Task Commits

Each task was committed atomically:

1. **Task 1: Add enhanced particles and night-modulated atmosphere constants** - `f7675f5` (feat)
2. **Task 2: Visual verification of enhanced atmosphere and night effects** - checkpoint:human-verify (approved, no commit needed)

## Files Created/Modified
- `src/shared/constants.ts` - Added 30+ constants for sparks, dust motes, leaves, and night modulation multipliers
- `src/renderer/ambient-particles.ts` - Extended from firefly-only to 4 particle types (fireflies, sparks, dust motes, leaves) with nightIntensity modulation
- `src/renderer/building.ts` - Chimney smoke modulated by nightIntensity (count, opacity, spawn rate)
- `src/renderer/world.ts` - Passes nightIntensity to ambientParticles.tick() and building.tick()

## Decisions Made
- Sparks use dynamic spawn/destroy lifecycle (not pre-created) since they have short lifetimes and are visually transient
- Dust motes fade at night using inverse nightIntensity (1 - nightIntensity * 0.8) for daytime emphasis
- Leaves rendered as small rectangles (2.5x1.5px) rather than circles for elongated leaf appearance
- Building smoke night modulation uses three independent multipliers for fine-grained control

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 22 complete: full day/night cycle with atmospheric particle effects
- All v2.0 World & Character Detail milestone phases are complete
- World features rich visual atmosphere with time-of-day variation

## Self-Check: PASSED

- FOUND: src/shared/constants.ts
- FOUND: src/renderer/ambient-particles.ts
- FOUND: src/renderer/building.ts
- FOUND: src/renderer/world.ts
- FOUND: commit f7675f5

---
*Phase: 22-day-night-cycle-atmosphere*
*Completed: 2026-03-03*

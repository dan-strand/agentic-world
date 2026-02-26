---
phase: 07-effects-and-atmosphere
plan: 01
subsystem: renderer
tags: [pixi-filters, glow-filter, particles, effects, fill-gradient, level-up]

# Dependency graph
requires:
  - phase: 06-character-sprites
    provides: Agent tick/isDone lifecycle pattern from fireworks.ts
provides:
  - LevelUpEffect class with golden light column, sparkle shower, and GlowFilter halo
  - AmbientParticles class with 25 drifting firefly particles
  - LEVEL_UP_* and AMBIENT_* constants in shared/constants.ts
  - pixi-filters@6.1.5 dependency installed
affects: [07-02-world-integration]

# Tech tracking
tech-stack:
  added: [pixi-filters@6.1.5]
  patterns: [FillGradient vertical gradient for light column, GlowFilter halo on Container]

key-files:
  created:
    - src/renderer/level-up-effect.ts
    - src/renderer/ambient-particles.ts
  modified:
    - src/shared/constants.ts
    - package.json

key-decisions:
  - "FillGradient with rgba CSS color stops for gradient alpha transparency"
  - "GlowFilter quality 0.3 for rough/pixelated halo consistent with pixel art"

patterns-established:
  - "FillGradient with textureSpace 'global' for pixel-coordinate gradient fills"
  - "Ambient effect class with tick() but no isDone() for persistent effects"

requirements-completed: [FX-01, FX-02, ENV-03]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 7 Plan 01: Effect Classes Summary

**LevelUpEffect with golden light column, GlowFilter halo, and sparkle shower plus AmbientParticles firefly system using pixi-filters**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T15:31:41Z
- **Completed:** 2026-02-26T15:34:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed pixi-filters@6.1.5 as new dependency for GlowFilter
- Replaced all FIREWORK_* constants with LEVEL_UP_* and AMBIENT_* constants
- Created LevelUpEffect class with FillGradient light column, sparkle shower, and GlowFilter halo
- Created AmbientParticles class with 25 drifting firefly particles (sine-wave bob, alpha cycling, edge wrapping)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install pixi-filters and update constants** - `c85d33b` (chore)
2. **Task 2: Create LevelUpEffect and AmbientParticles classes** - `fc659d4` (feat)

## Files Created/Modified
- `src/renderer/level-up-effect.ts` - Golden light column + sparkle shower celebration effect with GlowFilter halo (155 lines)
- `src/renderer/ambient-particles.ts` - Persistent ambient floating particle system with 25 fireflies (104 lines)
- `src/shared/constants.ts` - Replaced FIREWORK_* with LEVEL_UP_* (9 constants) and AMBIENT_* (10 constants)
- `package.json` - Added pixi-filters@^6.1.5 dependency
- `package-lock.json` - Lock file updated

## Decisions Made
- Used FillGradient with rgba CSS color stops and textureSpace 'global' for the light column gradient (pixel-coordinate based, not normalized 0-1)
- Set GlowFilter quality to 0.3 for a rough/pixelated halo that fits the pixel art aesthetic
- AmbientParticles has tick() but no isDone() since it runs persistently (unlike LevelUpEffect which has a finite duration)
- Kept CELEBRATION_DURATION_MS separate from LEVEL_UP_DURATION_MS even though values match -- CELEBRATION controls agent state timing, LEVEL_UP controls visual effect timing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Expected TypeScript compilation errors in fireworks.ts due to removed FIREWORK_* constants. This is by design -- fireworks.ts will be deleted in Plan 02 when LevelUpEffect is wired into the world.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- LevelUpEffect and AmbientParticles are ready for Plan 02 to wire into world.ts
- Plan 02 will swap Fireworks -> LevelUpEffect in agent.ts, add ambient particles to world, add warm filter and zone highlights
- fireworks.ts still exists with broken imports -- Plan 02 handles deletion

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 07-effects-and-atmosphere*
*Completed: 2026-02-26*

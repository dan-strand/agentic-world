---
phase: 30-gpu-and-renderer-cleanup
plan: 01
subsystem: renderer
tags: [pixi.js, gpu-textures, atlas, sprite, gradient, performance]

# Dependency graph
requires:
  - phase: 22-day-night-cycle
    provides: "Night glow layer and GlowSprite interface"
provides:
  - "Atlas-consolidated palette swap with single ImageSource per animation state"
  - "Sprite-based night glow using pre-rendered gradient textures"
  - "Gradient texture cache (createGradientTexture helper)"
affects: [agent-rendering, night-cycle-visuals]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Atlas consolidation via offscreen canvas with Rectangle frame regions", "Pre-rendered gradient texture cache for radial glow effects"]

key-files:
  created: []
  modified:
    - src/renderer/palette-swap.ts
    - src/renderer/palette-swap.test.ts
    - src/renderer/night-glow-layer.ts
    - src/renderer/night-glow-layer.test.ts
    - src/renderer/world.ts

key-decisions:
  - "Kept GlowSprite field name as 'gfx' (now Sprite instead of Graphics) for minimal diff in world.ts"
  - "Used putImageData on atlas canvas per-frame instead of drawImage to preserve pixel-level accuracy"
  - "Destroy shared source via first texture reference rather than tracking separately"

patterns-established:
  - "Atlas consolidation: create single offscreen canvas, putImageData per-frame, share one ImageSource across Texture[] with Rectangle frames"
  - "Gradient texture cache: key by radius_color, create once via canvas radialGradient, reuse across all sprites of same type"

requirements-completed: [TEX-01, TEX-02]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 30 Plan 01: GPU and Renderer Cleanup Summary

**Atlas-consolidated palette swaps (4 GPU textures to 1 per animation) and sprite-based night glow (92 fill ops to 4 gradient textures)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T03:37:50Z
- **Completed:** 2026-03-19T03:43:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- GPU texture count per agent animation state reduced from 4 separate ImageSources to 1 shared atlas ImageSource with Rectangle frame regions
- Night glow layer replaced 92 Graphics fill operations with 4 cached gradient textures rendered to Sprites
- All 17 tests pass (9 palette-swap, 8 night-glow) including new atlas consolidation and gradient cache tests
- TypeScript compiles cleanly with no errors
- Function signatures unchanged -- no modifications needed in consumer files (agent.ts uses same Texture[] API)

## Task Commits

Each task was committed atomically:

1. **Task 1: Atlas-consolidate palette-swapped textures** - `133237f` (test: RED), `33e37c7` (feat: GREEN)
2. **Task 2: Replace Graphics-based night glow with gradient sprites** - `96a3690` (test: RED), `fecfbd3` (feat: GREEN)

_Note: TDD tasks have multiple commits (test -> feat)_

## Files Created/Modified
- `src/renderer/palette-swap.ts` - Atlas canvas consolidation, Rectangle frame regions, single ImageSource per animation
- `src/renderer/palette-swap.test.ts` - Tests for shared source, frame offsets, single destroy call, cache behavior
- `src/renderer/night-glow-layer.ts` - Sprite-based glow with createGradientTexture helper and texture cache
- `src/renderer/night-glow-layer.test.ts` - Tests for gradient texture cache export and structure
- `src/renderer/world.ts` - Updated nightGlows type from Graphics to Sprite, removed Graphics import

## Decisions Made
- Kept GlowSprite field name as `gfx` (now typed as Sprite instead of Graphics) to minimize diff in world.ts -- only type annotation and import needed updating
- Used temporary per-frame canvas for pixel manipulation before writing to atlas canvas, ensuring correct color swap before putImageData at atlas offset
- In destroyCachedTextures, destroy shared source via first texture's `.source` reference rather than maintaining separate source tracking

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing destroyCachedTextures test for shared-source behavior**
- **Found during:** Task 1 GREEN phase
- **Issue:** Existing test created mock textures with separate source objects (source1, source2) and expected both destroyed. With atlas consolidation, textures share a single source, so destroy is called once.
- **Fix:** Updated test to use a shared source mock and verify single destroy call
- **Files modified:** src/renderer/palette-swap.test.ts
- **Verification:** All 9 palette-swap tests pass
- **Committed in:** 33e37c7 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix in test)
**Impact on plan:** Test update necessary to reflect new shared-source semantics. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GPU texture consolidation complete for both palette swaps and night glow
- Phase 30-02 (tick-loop and DOM micro-optimizations) already completed
- Both plans in phase 30 are now done

## Self-Check: PASSED

All 5 modified/created files verified on disk. All 4 task commits (133237f, 33e37c7, 96a3690, fecfbd3) verified in git log.

---
*Phase: 30-gpu-and-renderer-cleanup*
*Completed: 2026-03-18*

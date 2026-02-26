---
phase: 06-agent-sprite-overhaul
plan: 02
subsystem: renderer
tags: [pixi.js, animated-sprite, state-machine, character-animation, walk-only]

# Dependency graph
requires:
  - phase: 06-agent-sprite-overhaul
    provides: "Character atlas, characterAnimations export, CharacterClass type system, hashSessionId"
provides:
  - "AnimatedSprite-based Agent class with 5-state walk-only machine"
  - "getCharacterAnimation() accessor for character atlas textures"
  - "Staggered frame offsets for non-lockstep agent animation"
  - "Preserved status visual effects (tint crossfade, breathing, shake) on AnimatedSprite"
affects: [06-03, world-integration, agent-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AnimatedSprite with manual tick control (autoUpdate=false) for status-speed-modulated animation"
    - "Walk-only state machine: idle_at_hq -> walking_to_building -> walking_to_workspot -> working -> celebrating"
    - "Thin accessor pattern: getCharacterAnimation() over characterAnimations record"

key-files:
  created: []
  modified:
    - src/renderer/agent-sprites.ts
    - src/renderer/agent.ts
    - src/renderer/agent-factory.ts

key-decisions:
  - "AnimatedSprite.autoUpdate=false with manual frame advancement for status-speed-modulated animation"
  - "5-state walk-only machine eliminates all vehicle/driving states (walking_to_building replaces driving_to_compound)"
  - "Public API signatures unchanged for world.ts backward compatibility -- Plan 03 will update world.ts"
  - "hashSessionId modulo totalFrames for staggered start frame offset"

patterns-established:
  - "AnimatedSprite manual tick: frameTimer accumulation with ANIMATION_FRAME_MS threshold and status speed multiplier"
  - "Null workSpotTarget signals HQ destination in walking_to_building state"

requirements-completed: [AGENT-01, AGENT-02, AGENT-03, THEME-01, THEME-04]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 6 Plan 02: Agent AnimatedSprite and Walk-Only State Machine Summary

**AnimatedSprite-based agent rendering with 5-state walk-only machine replacing Graphics+GraphicsContext frame-swapping and 7-state vehicle/driving system**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T14:55:43Z
- **Completed:** 2026-02-26T14:58:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Rewrote agent-sprites.ts from 273-line GraphicsContext factory (104 pre-built objects) to 23-line thin accessor over characterAnimations atlas textures
- Rewrote agent.ts from Graphics+GraphicsContext 7-state machine with vehicle/driving to AnimatedSprite 5-state walk-only machine (485 -> 306 lines)
- Preserved all status visual effects (tint crossfade, breathing alpha, error shake), celebration with Fireworks, and public API signatures for world.ts compatibility
- Added staggered frame offsets via hashSessionId for non-lockstep animation across multiple agents

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite agent-sprites.ts as animation accessor** - `8146df7` (feat)
2. **Task 2: Rewrite agent.ts with AnimatedSprite and simplified state machine** - `e79b617` (feat)

## Files Created/Modified
- `src/renderer/agent-sprites.ts` - Thin accessor: getCharacterAnimation() over characterAnimations from asset-loader
- `src/renderer/agent.ts` - AnimatedSprite-based Agent with 5-state walk-only machine, staggered frame offsets, preserved status visuals
- `src/renderer/agent-factory.ts` - Updated JSDoc to reflect CharacterClass-based slots (no functional change)

## Decisions Made
- AnimatedSprite.autoUpdate set to false with manual frame advancement in tick() to support status-speed-modulated animation (idle agents animate slower, error agents freeze)
- Null workSpotTarget used as signal that agent is walking to HQ (not to a building work spot), enabling clean state reuse in walking_to_building handler
- Public API method names (assignToCompound, assignToHQ, updateActivity, setHQPosition, getState) kept unchanged so world.ts compiles without changes; Plan 03 will rename and update

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent rendering now uses AnimatedSprite from character atlas -- visual upgrade from code-drawn shapes
- world.ts still references old state names (driving_to_compound, driving_to_hq, walking_to_entrance) in !== guards -- these are safe (conditions pass through) but Plan 03 will update
- world.ts getBuildingWorkPosition checks for 'walking_to_sublocation' which is now 'walking_to_workspot' -- minor position counting mismatch, fixed in Plan 03
- vehicle.ts is now dead code (not imported by agent.ts) -- can be deleted in Plan 03

## Self-Check: PASSED

All 3 modified files verified present. Both task commits (8146df7, e79b617) verified in git log.

---
*Phase: 06-agent-sprite-overhaul*
*Completed: 2026-02-26*

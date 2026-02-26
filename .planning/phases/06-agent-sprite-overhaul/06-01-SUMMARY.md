---
phase: 06-agent-sprite-overhaul
plan: 01
subsystem: renderer
tags: [pngjs, spritesheet, pixi.js, atlas, character-animation]

# Dependency graph
requires:
  - phase: 05-buildings-world-layout
    provides: "Asset pipeline pattern (pngjs generation + JSON descriptor + Assets.load + Spritesheet)"
provides:
  - "128x384 character atlas PNG with 48 frames (4 classes x 3 states x 4 frames)"
  - "characters.json spritesheet descriptor with frames and 12 animation sequences"
  - "CharacterClass type replacing VehicleType/AccessoryType in type system"
  - "CHARACTER_CLASSES constant and updated getAgentSlot() mapping sessionId to character class"
  - "characterAnimations export in asset-loader for AnimatedSprite creation"
affects: [06-02, 06-03, agent-rendering, agent-state-machine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Character atlas pipeline: pngjs generation -> JSON descriptor with animations field -> parallel Assets.load"
    - "Spritesheet.animations for named animation texture arrays (PixiJS native)"

key-files:
  created:
    - scripts/generate-characters.js
    - assets/sprites/characters.json
    - assets/sprites/characters.png
  modified:
    - src/shared/types.ts
    - src/shared/constants.ts
    - src/renderer/asset-loader.ts

key-decisions:
  - "Script generates both PNG and JSON in single run for consistency"
  - "CharacterClass replaces both VehicleType and AccessoryType (simplification)"
  - "Dead code removed: COMPOUND_*, HQ_*, AGENT_DRIVE_SPEED, VEHICLE_TYPES, ACCESSORIES"

patterns-established:
  - "Spritesheet animations field: named animation sequences referencing frame names"
  - "characterAnimations Record<string, Texture[]> for AnimatedSprite texture arrays"

requirements-completed: [THEME-01, THEME-04]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 6 Plan 01: Character Atlas and Type System Summary

**4-class character sprite atlas (mage/warrior/ranger/rogue) with 48 animated frames, spritesheet descriptor with animations, and CharacterClass type system replacing spy-themed VehicleType/AccessoryType**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T14:48:58Z
- **Completed:** 2026-02-26T14:53:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Generated 128x384 character atlas with 4 visually distinct character classes, each with idle/walk/work animations at 4 frames each
- Created spritesheet JSON descriptor with 48 frame entries and 12 named animation sequences for PixiJS Spritesheet.animations
- Replaced VehicleType/AccessoryType with CharacterClass throughout type system, cleaned up dead compound/HQ/drive constants
- Extended asset loader to load character atlas in parallel with tiles and buildings, exporting characterAnimations map

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate character atlas and spritesheet descriptor** - `ccad642` (feat)
2. **Task 2: Update types, constants, and asset loader for character system** - `778df4c` (feat)

## Files Created/Modified
- `scripts/generate-characters.js` - Programmatic character sprite atlas generation with 4 classes (mage, warrior, ranger, rogue), 3 states each, 4 frames per state
- `assets/sprites/characters.png` - Generated 128x384 character atlas image
- `assets/sprites/characters.json` - Spritesheet descriptor with 48 frames and 12 animation sequences
- `src/shared/types.ts` - CharacterClass type replacing VehicleType/AccessoryType, updated AgentSlot interface
- `src/shared/constants.ts` - CHARACTER_CLASSES array, updated getAgentSlot(), removed dead code (COMPOUND_*, HQ_*, AGENT_DRIVE_SPEED, VEHICLE_TYPES, ACCESSORIES)
- `src/renderer/asset-loader.ts` - Extended parallel loading with characterAnimations export

## Decisions Made
- Script generates both PNG and JSON in a single run to ensure frame coordinates are always consistent
- CharacterClass replaces both VehicleType and AccessoryType as a single union type (simplification from spy theme to RPG theme)
- Removed all compound/HQ/vehicle dead code constants in same commit to keep clean separation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Character atlas and animation textures ready for Plan 02 to build AnimatedSprite-based agent rendering
- TypeScript compilation has expected errors in agent.ts, vehicle.ts, compound.ts, hq.ts, agent-sprites.ts -- these files still reference removed types/constants and will be rewritten in Plan 02
- characterAnimations map ready for AnimatedSprite creation in agent rendering

## Self-Check: PASSED

All 6 files verified present. Both task commits (ccad642, 778df4c) verified in git log.

---
*Phase: 06-agent-sprite-overhaul*
*Completed: 2026-02-26*

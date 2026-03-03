---
phase: 21-character-identity
plan: 01
subsystem: renderer
tags: [pngjs, atlas, sprites, animation, palette, identity]

# Dependency graph
requires:
  - phase: 20-world-building-art
    provides: character atlas pipeline, asset-loader pattern
provides:
  - Expanded character atlas with 64 frames (4 classes x 4 states including celebrate)
  - Gear overlay atlas with 16 frames (4 gear variants per class)
  - 25 color palette definitions with per-class template color mapping
  - 80 fantasy name pool for deterministic agent naming
  - Extended AgentSlot type with paletteIndex, gearIndex, agentName
  - Gear texture loading in asset-loader
affects: [21-02-character-identity, agent-renderer, celebrate-animation]

# Tech tracking
tech-stack:
  added: []
  patterns: [gear-overlay-atlas, palette-swap-constants, bit-shifted-hash-distribution]

key-files:
  created:
    - scripts/generate-gear.js
    - assets/sprites/gear.png
    - assets/sprites/gear.json
  modified:
    - scripts/generate-characters.js
    - assets/sprites/characters.png
    - assets/sprites/characters.json
    - src/shared/constants.ts
    - src/shared/types.ts
    - src/renderer/asset-loader.ts
    - src/renderer/agent-sprites.ts

key-decisions:
  - "Used bit-shifting (>>> 4/8/12) on session hash for independent palette/gear/name distribution"
  - "25 palettes across 5 categories (warm/cool/earth/jewel/neutral) for maximum visual separation"
  - "Gear drawn as head overlays at character head region (y=2-10) for compositing alignment"

patterns-established:
  - "Gear overlay atlas: separate spritesheet for class-themed accessories composited on character sprites"
  - "Template color mapping: TEMPLATE_COLORS defines base atlas RGB values that palette swap replaces per-class"

requirements-completed: [CHAR-01, CHAR-02, CHAR-03, CHAR-04]

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 21 Plan 01: Character Identity Data Layer Summary

**64-frame character atlas with class-specific celebrate animations, 16-frame gear overlay atlas, 25 color palettes, and 80 fantasy names for deterministic agent identity**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T13:51:00Z
- **Completed:** 2026-03-03T13:57:01Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Expanded character atlas from 48 to 64 frames with celebrate animations for all 4 classes (mage staff burst, warrior fist pump, ranger salute, rogue dagger flip)
- Created gear overlay atlas with 16 head accessory variants (pointy hats, helms, hoods, crowns, masks)
- Defined 25 distinct color palettes with template color mapping per class for palette swap system
- Extended AgentSlot and getAgentSlot() for full identity derivation (palette, gear, name) from session hash

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand character atlas with celebrate frames and create gear atlas** - `a3bb0ab` (feat)
2. **Task 2: Add palette defs, fantasy names, gear constants, and update types** - `31763d6` (feat)

## Files Created/Modified
- `scripts/generate-characters.js` - Expanded from 12 to 16 rows with celebrate draw functions per class
- `scripts/generate-gear.js` - New gear overlay atlas generator (4 variants x 4 classes)
- `assets/sprites/characters.png` - 128x512 atlas (was 128x384)
- `assets/sprites/characters.json` - 64 frames, 16 animations (was 48/12)
- `assets/sprites/gear.png` - 128x128 gear overlay atlas
- `assets/sprites/gear.json` - 16 frame entries (mage_gear_0..3, warrior_gear_0..3, etc.)
- `src/shared/constants.ts` - PALETTE_DEFS (25), TEMPLATE_COLORS, FANTASY_NAMES (80), GEAR_VARIANTS_PER_CLASS, updated getAgentSlot()
- `src/shared/types.ts` - AgentSlot extended with paletteIndex, gearIndex, agentName
- `src/renderer/asset-loader.ts` - Added gearTextures export and gear.json loading
- `src/renderer/agent-sprites.ts` - Exported AnimState with 'celebrate' variant

## Decisions Made
- Used bit-shifting (>>> 4/8/12) on the djb2 session hash to pick palette, gear, and name from different bit ranges, avoiding correlation between identity dimensions
- Designed 25 palettes across 5 visual categories (warm, cool, earth, jewel, neutral) for maximum distinction at 32x32 scale
- Gear items drawn as head overlays positioned at the character head region (y=2-10, x=10-22) for alignment with base sprites during compositing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data layer foundations in place for Plan 02 to wire palette swap rendering, gear overlay compositing, name labels, and celebrate animation triggers into the Agent class
- Character atlas, gear atlas, palette definitions, and identity types all verified and ready for renderer integration

## Self-Check: PASSED

All 10 files verified present. Both commits (a3bb0ab, 31763d6) verified in git log.

---
*Phase: 21-character-identity*
*Completed: 2026-03-03*

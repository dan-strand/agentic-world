# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Instantly see the status of all Claude Code sessions so you know which one needs attention next.
**Current focus:** Phase 14 - World Layout Reorganization (v1.4 Enhanced Session Workspaces)

## Current Position

Phase: 14 of 16 (World Layout Reorganization)
Plan: 1 of 2 in current phase
Status: Executing
Last activity: 2026-02-27 -- Completed 14-01 (grid constants & sprite assets)

Progress: [########################..] 81% (13/16 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 27 (v1.0: 9, v1.1: 9, v1.2: 4, v1.3: 4, v1.4: 1)
- Total execution time: ~3 days

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v1.0 Phases 1-3 | 9 | ~1 day | -- |
| v1.1 Phases 4-7 | 9 | ~1 day | -- |
| v1.2 Phases 8-10 | 4 | ~2 hrs | -- |
| v1.3 Phase 11 | 3 | ~5 min | ~2 min |
| v1.3 Phase 13 | 1 | ~2 min | ~2 min |
| v1.4 Phase 14 | 1 | ~7 min | ~7 min |

## Shipped Milestones

- **v1.0 MVP** (2026-02-25): Session detection, spy-themed world, status lifecycle
- **v1.1 Fantasy RPG Aesthetic** (2026-02-26): Tilemap, buildings, animated sprites, effects
- **v1.2 Activity Monitoring & Labeling** (2026-02-26): Building labels, speech bubbles, fade-out lifecycle
- **v1.3 Audio & Status Reliability** (2026-02-27): Status pipeline hardening, tool_use detection, waiting reminders

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Key context for v1.4:
- Buildings now 464x336 landscape (was 96x96), filling 2x2 grid within 1024x768
- BuildingType 'guild_hall' replaced with 'campfire' throughout constants and world.ts
- Campfire is separate sprite atlas (campfire.json/png) loaded alongside buildings
- GUILD_HALL_POS kept as legacy alias to CAMPFIRE_POS until Plan 02 cleans up references
- Work spots scaled to x=+/-140, y=-100/-40 for larger building interiors
- Plan 02 next: wire up actual world layout with new positions and tilemap paths

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 14-01-PLAN.md
Resume file: .planning/phases/14-world-layout-reorganization/14-01-SUMMARY.md

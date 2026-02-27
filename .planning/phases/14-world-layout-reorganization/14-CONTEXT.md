# Phase 14: World Layout Reorganization - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the 1024x768 world layout to give workspace buildings maximum screen space. Replace the current small building layout with a 2x2 grid of large workspace interiors. Guild Hall becomes a small central campfire waypoint. Tilemap paths updated to match new positions.

</domain>

<decisions>
## Implementation Decisions

### Building arrangement
- 2x2 grid layout filling edge-to-edge within the 1024x768 window
- Comfortable spacing between buildings (~64-96px gaps) for paths and breathing room
- Symmetric layout — Claude picks which building goes in which quadrant
- Minimize margins on all sides to maximize building size

### Building dimensions
- Rectangular landscape orientation (~400x280 or whatever fits best in the grid)
- All 4 buildings the same size — uniform grid, equal visual weight
- Full bleed interior scenes — no visible building walls/frame, interior fills the entire rectangle
- Labels (building name / project name) integrated into the interior scene (like a sign or banner inside), not floating above

### Guild Hall waypoint
- Central campfire/bonfire at the center of the 2x2 grid (in the crossroads gap)
- Medium size (~64x64) — campfire with surrounding stones/seating area
- Celebration animation (golden light column) stays at the campfire — agents walk back, celebrate, then fade
- Campfire serves as the hub where all paths converge

### Path network
- Star pattern — 4 paths radiating from the central campfire to each building
- Paths lead to the center-bottom edge of each building (like a doorway entrance)
- Narrower paths (~1 tile wide) since buildings are much larger now — footpath feel
- Scattered ground decoration (small rocks, flowers, grass tufts) in gaps between paths and buildings

### Claude's Discretion
- Exact pixel dimensions for buildings (optimize within the grid constraints)
- Exact campfire sprite design
- Specific ground decoration placement and variety
- Path routing (straight diagonal vs slight curves)
- Building quadrant assignments

</decisions>

<specifics>
## Specific Ideas

- The campfire should feel like a cozy gathering spot — warm, inviting center of the world
- Full bleed interiors mean the building IS the interior scene — no "looking into a box" feel
- Labels as part of the scene (banner, sign on wall) rather than floating UI text
- 1-tile-wide paths feel like footpaths through a village, not roads

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-world-layout-reorganization*
*Context gathered: 2026-02-27*

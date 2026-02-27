# Phase 15: Workspace Interior Art - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Phase 14 placeholder building sprites with rich, themed interior scenes. Each 464x336 building shows a detailed top-down interior with identifiable work stations and ambient furniture. This phase creates the visual art — agent placement at stations is Phase 16.

</domain>

<decisions>
## Implementation Decisions

### Interior composition
- Top-down perspective (bird's eye view) — consistent with RPG tilemap feel
- Well-furnished interiors (~60-70% floor coverage). Rooms feel busy and lived-in
- Visible floor with thin wall border — clearly reads as "inside a room"
- Loosely divided areas within each room — visual separators (rugs, floor color changes, low walls) suggest zones rather than hard partitions

### Visual style and detail
- Fine detail level: furniture and stations at ~32-48px each. Crystal balls gleam, books have spines, etc.
- Themed lighting per building: Wizard Tower blue/purple glow, Tavern warm amber, Library cool white, Training Grounds natural daylight. Achieved through tinted floor/wall colors and object highlighting
- Shading and highlights on furniture — darker edges, lighter highlights for depth and dimension
- Textured floors — stone cracks/mortar lines, wood grain, marble veining. Adds richness and helps differentiate buildings

### Station identifiability
- Stations are large focal points (~48-64px each) — the biggest objects in each room
- Design alone distinguishes stations from ambient furniture (no glowing outlines or markers)
- Stations spread around the room in different areas/zones — agents should mill about the space, not cluster on one spot
- Theme-consistent ambient furniture fills remaining space (Wizard Tower: candles, potions, spell circles; Library: reading nooks, globes; Tavern: barrels, mugs; Training Grounds: weapon racks, training dummies)

### Theme differentiation
- Strongly distinct interiors — each building immediately recognizable at a glance
- Floor materials (classic RPG):
  - Wizard Tower: dark stone
  - Training Grounds: packed dirt/sand
  - Ancient Library: polished marble
  - Tavern: wooden planks
- Wall styles (matching theme):
  - Wizard Tower: dark stone with rune carvings
  - Training Grounds: wooden palisade
  - Ancient Library: marble columns
  - Tavern: timber beams
- Strong color identity per building:
  - Wizard Tower: purple/blue
  - Training Grounds: red/brown
  - Ancient Library: teal/gold
  - Tavern: amber/orange

### Claude's Discretion
- Exact furniture placement and arrangement within each room
- Specific ambient decoration items beyond those listed
- How loosely-divided areas are implemented (rugs vs floor color vs low walls)
- Exact shading technique in pngjs generators
- How themed lighting is rendered (tinted base colors vs overlay)

</decisions>

<specifics>
## Specific Ideas

- Agents should be "milling about the area" not stacked on each other — stations spread out gives room for agent movement in Phase 16
- Each building's 3 named stations per the requirements:
  - Wizard Tower: enchanting table, scroll desk, rune bench
  - Training Grounds: target dummy, obstacle course, potion station
  - Ancient Library: crystal ball, bookshelves, map table
  - Tavern: bar counter, notice board, pigeon roost
- "Well-furnished" means the rooms feel alive — not just 3 stations in empty space

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-workspace-interior-art*
*Context gathered: 2026-02-27*

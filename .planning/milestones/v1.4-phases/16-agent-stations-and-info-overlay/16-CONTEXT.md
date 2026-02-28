# Phase 16: Agent Stations and Info Overlay - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Make agents visibly work at themed stations inside workspace interiors and display current tool info per workspace. This phase wires agents into the Phase 15 interior scenes and adds an info overlay — no new art generation or building layout changes.

</domain>

<decisions>
## Implementation Decisions

### Agent positioning inside buildings
- Agents move about around their assigned station area — not fixed in one spot
- Medium wander radius (~32-48px) around the station. Lively movement, covers the zone
- Agents walk all the way from campfire through the building to their station position (continuous walk, no teleport)
- First 3 agents each get their own station. 4th+ agents share a station area (wander radius prevents exact overlap)

### Tool name display
- RPG-styled label at the bottom of each building — text with small background banner/plate matching the building's theme color
- Show the most recent tool name only (across all sessions in that building), not all active tools
- Hidden when no active sessions in the building — no "Idle" or "Vacant" indicator
- Tool names are the actual tool being used (e.g., "Edit", "Bash", "Read", "Grep", "Write")

### Station assignment logic
- Random station assignment — each agent picks a random available station when entering the building
- Agents switch stations on tool change — when the active tool changes (Edit → Bash → Read), agent moves to a new random station within the building
- Stations immediately freed when an agent leaves (session completes, walks back to campfire)
- No cooldown or reservation system

### Visual integration
- Agents render behind tall furniture (bookshelves, walls) but in front of floors/rugs — depth-based z-ordering
- Walk animation while moving between stations, work animation when stopped at a station
- Agents scaled up to ~48x48 when inside buildings (1.5x normal 32x32) for readability in the large interiors
- No extra labels, name tags, or icons on agents inside buildings

### Claude's Discretion
- Exact station coordinate positions within each building (based on Phase 15 interior art layout)
- How z-ordering layers are implemented (container hierarchy, zIndex, etc.)
- Wander movement pattern (linear drift, random walk, etc.)
- Walk speed inside buildings
- How tool name text is created (BitmapText, Text, etc.)
- Banner/plate sizing and exact position within the bottom area

</decisions>

<specifics>
## Specific Ideas

- Agent wander gives life to the workspace — they should look like they're working in different parts of the room, not sitting still
- Tool change → station switch creates visual activity that mirrors real session activity
- The ~48x48 scale-up is important — at 32x32 inside a 464x336 room, agents would be tiny dots
- "Behind tall furniture" depth ordering makes agents feel like they're IN the room, not pasted on top

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-agent-stations-and-info-overlay*
*Context gathered: 2026-02-27*

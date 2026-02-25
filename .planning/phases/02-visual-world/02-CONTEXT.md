# Phase 2: Visual World - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform placeholder agents into a living 2D pixel art spy world. Each detected session becomes a distinct animated agent character working at project-based mission compounds. Includes vehicle travel, working animations, project signposts, and activity icon bubbles. Status differentiation (colors/effects for active/waiting/idle/error) and celebration/completion lifecycle belong in Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Agent Character Design
- 48x48 pixel sprite resolution
- Drawn programmatically with PixiJS Graphics primitives (no external sprite sheets)
- Each agent distinguished by BOTH color-coded outfit AND unique accessories
- 8-color palette for agent differentiation (supports up to 8 unique agents)
- Beyond 8 agents: recycle colors with number badges
- Accessories vary per agent slot (e.g., sunglasses, briefcase, hat, scarf, goggles, earpiece, badge, tie)

### World Locations & Layout
- **Locations ARE projects** — each detected project gets its own mission compound on the map
- HQ is the central hub; project compounds radiate outward from center
- Compounds spawn dynamically when a project is detected, despawn when no sessions remain for that project
- Each compound is a small fenced mission compound with a signpost showing the project name
- Sub-locations inside each compound for activity types (workbench for coding, antenna/comms for API calls, bookshelf for reading, server rack for tests)
- Agents at HQ are idle/completed — waiting for their next mission

### Animation & Movement
- Agents travel between HQ and project compounds via vehicles (driving animation along roads/paths)
- Mix of vehicle types as another agent distinguishing trait: car, motorcycle, van, helicopter (assigned per agent slot)
- Agents walk between sub-locations within their project compound when activity type changes
- Active working animations at each sub-location (typing at workbench, adjusting antenna, flipping pages, monitoring server) — 3-4 frame loops
- Vehicle parks at compound entrance while agent works inside

### Labels & Speech Bubbles
- Project name displayed on a signpost/marquee at each compound entrance
- Pixel bitmap font for signpost text (matches art style)
- Speech bubbles use minimal icons instead of text (wrench for editing, magnifying glass for reading, gear for running, etc.)
- Bubbles flash on activity change (appear for 3-5 seconds then fade) — not persistent
- No label above individual agents (compound signpost handles project identification)

### Claude's Discretion
- Exact compound layout algorithm (how to arrange compounds around central HQ as count changes)
- Sub-location positioning within compounds
- Vehicle animation frame count and speed
- Specific icon designs for activity types
- Road/path visual style between HQ and compounds
- How compound spawn/despawn animates (fade in? build animation?)

</decisions>

<specifics>
## Specific Ideas

- Spy compound aesthetic: small fenced areas with a gate, signpost at entrance, equipment inside
- Vehicles match agent color — a teal agent drives a teal car, an amber agent rides an amber motorcycle
- HQ should feel like a proper headquarters — larger than project compounds, central and prominent
- Sub-locations should be visually distinct enough that you can tell what type of work is happening without reading labels
- The world should feel alive even when watching passively — agents driving around, working at stations, walking between sub-areas

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-visual-world*
*Context gathered: 2026-02-25*

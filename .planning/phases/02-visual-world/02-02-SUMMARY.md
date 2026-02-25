---
phase: 02-visual-world
plan: 02
subsystem: renderer, animation
tags: [pixi.js, graphics-context, state-machine, animation, pixel-art, vehicle]

# Dependency graph
requires:
  - phase: 02-visual-world
    plan: 01
    provides: "AgentSlot, ActivityType, AGENT_COLORS, getAgentSlot, ANIMATION_FRAME_MS"
provides:
  - "48x48 pixel art agent sprites via GraphicsContext frame-swapping"
  - "96 pre-built body frames (8 colors x 3 states x 4 frames)"
  - "8 pre-built accessory contexts (sunglasses, briefcase, hat, scarf, goggles, earpiece, badge, tie)"
  - "Agent class with 6-state FSM: idle_at_hq, driving_to_compound, walking_to_sublocation, working, walking_to_entrance, driving_to_hq"
  - "Vehicle class with 4 vehicle types (car, motorcycle, van, helicopter) and driving animation"
  - "AgentFactory singleton for deterministic slot caching"
affects: [02-03-PLAN, 02-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["GraphicsContext frame-swapping for zero-cost animation", "Composited body+accessory layers to avoid combinatorial explosion", "deltaMs-based linear interpolation for frame-rate independent movement"]

key-files:
  created:
    - src/renderer/agent-sprites.ts
    - src/renderer/agent-factory.ts
    - src/renderer/agent.ts
    - src/renderer/vehicle.ts

key-decisions:
  - "Composited body+accessory layers (96+8=104 contexts) instead of full combination (1024 contexts) -- avoids memory explosion"
  - "GraphicsContext frame-swapping in tick with no graphics.clear() -- per research anti-pattern guidance"
  - "Vehicle frames built per-instance in constructor (color varies) vs pre-cached body frames (shared across agents)"
  - "1px arrival tolerance in hasArrived() for robust state transitions"

patterns-established:
  - "GraphicsContext pre-build at init, swap via .context in tick -- all future animated objects follow this pattern"
  - "State machine pattern: switch on state in tick(), transition handlers as private methods"
  - "Public API pattern: assignToCompound/assignToHQ/updateActivity for external control by World"

requirements-completed: [WORLD-02, WORLD-03]

# Metrics
duration: 4min
completed: 2026-02-25
---

# Phase 2 Plan 2: Agent Sprite System and State Machine Summary

**48x48 programmatic pixel art agents with GraphicsContext frame-swapping animation, 6-state FSM (idle/driving/walking/working), and 4 vehicle types drawn with PixiJS Graphics primitives**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T19:07:25Z
- **Completed:** 2026-02-25T19:11:09Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Built complete agent sprite system with 104 pre-built GraphicsContext objects (96 body + 8 accessory) covering all color/state/frame combinations
- Created 6-state agent FSM with frame-rate independent movement via deltaMs linear interpolation
- Implemented 4 visually distinct vehicle types (car, motorcycle, van, helicopter) with 3-frame driving animation each
- Ensured zero graphics.clear() calls in any tick method -- all animation via context swapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent sprite system and factory** - `a41edc9` (feat)
2. **Task 2: Create agent state machine with movement and vehicle system** - `4c3c285` (feat)

## Files Created/Modified
- `src/renderer/agent-sprites.ts` - Pre-built GraphicsContext frames for all agent animation states, exports initAgentSprites(), getBodyFrames(), getAccessoryContext()
- `src/renderer/agent-factory.ts` - AgentFactory class with deterministic slot caching, exports singleton agentFactory
- `src/renderer/agent.ts` - Agent Container with 6-state FSM, movement interpolation, animation tick, public API for world integration
- `src/renderer/vehicle.ts` - Vehicle Container with 4 vehicle type drawings and driving animation frames

## Decisions Made
- Used composited body+accessory layers (104 total contexts) instead of full combination approach (would be 1024) -- dramatic reduction in memory and init time
- Vehicle frames built per-instance since vehicle color varies per agent, while body frames are shared via module-level cache
- Used 1px arrival tolerance in hasArrived() rather than exact position comparison -- prevents floating-point rounding issues from causing missed transitions
- Accessory contexts don't animate independently (follow body offset) -- single context per accessory type is sufficient

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Agent and Vehicle classes ready to be instantiated by World scene in Plan 04
- initAgentSprites() must be called once during app init before creating Agent objects
- AgentFactory.getSlot() provides the slot data needed for Agent constructor
- Agent public API (assignToCompound, assignToHQ, updateActivity) ready for World to call on session updates
- Vehicle is created internally by Agent -- World only interacts via Agent API

## Self-Check: PASSED

- All 4 source files exist (agent-sprites.ts, agent-factory.ts, agent.ts, vehicle.ts)
- All 2 task commits verified (a41edc9, 4c3c285)
- SUMMARY.md exists at expected path

---
*Phase: 02-visual-world*
*Completed: 2026-02-25*

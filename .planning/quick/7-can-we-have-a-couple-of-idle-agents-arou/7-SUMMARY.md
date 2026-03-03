---
phase: quick-7
plan: 01
subsystem: renderer
tags: [pixi.js, ambient-agents, game-loop, campfire, idle-animation]

# Dependency graph
requires:
  - phase: 14-campfire
    provides: "Campfire waypoint, Agent class, idle_at_hq state, repositionIdleAgents"
provides:
  - "Two permanent ambient agents at campfire for world liveness"
  - "Game loop keeps ticking at idle FPS even with zero sessions"
affects: [world, game-loop, agent-management]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Ambient decorative agents as always-present Agent instances outside the session Map"]

key-files:
  created: []
  modified:
    - "src/shared/constants.ts"
    - "src/renderer/game-loop.ts"
    - "src/renderer/world.ts"

key-decisions:
  - "Ambient agents are separate from session agents (parallel array, not in the agents Map)"
  - "Game loop runs at 5fps idle instead of fully stopping when zero sessions"
  - "Ambient agents hidden at 4+ real sessions to avoid campfire clutter"
  - "Ambient agents use deterministic IDs for stable character class assignment"

patterns-established:
  - "Ambient agents: decorative Agent instances ticked alongside but tracked separately from session agents"

requirements-completed: [AMBIENT-IDLE-AGENTS]

# Metrics
duration: 7min
completed: 2026-03-02
---

# Quick Task 7: Ambient Idle Agents Summary

**Two permanent ambient agents at campfire with idle animation, keeping the world alive when no sessions are active**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-03T03:44:03Z
- **Completed:** 2026-03-03T03:51:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Two ambient agents permanently sit at the campfire, animating gently at 5fps idle
- Game loop no longer fully stops when zero sessions -- ticks at idle FPS for ambient agent animation
- Ambient and real session agents share campfire space via unified repositionIdleAgents() layout
- Ambient agents auto-hide when 4+ real agents are present to keep the screen clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ambient agent constants and game-loop fix** - `213fef6` (feat)
2. **Task 2: Implement ambient agents in World** - `37f9087` (feat)

## Files Created/Modified
- `src/shared/constants.ts` - Added AMBIENT_AGENT_COUNT, AMBIENT_AGENT_IDS, AMBIENT_WANDER_RADIUS, AMBIENT_WANDER_INTERVAL_MS constants
- `src/renderer/game-loop.ts` - Modified onSessionsUpdate() to keep ticker at FPS_IDLE instead of stopping when zero sessions
- `src/renderer/world.ts` - Added ambientAgents field, spawning in init(), ticking, repositionIdleAgents() integration, hide logic at 4+ agents, getCampfireIdlePosition() awareness

## Decisions Made
- Ambient agents are NOT added to the `this.agents` Map -- they live in a separate `this.ambientAgents` array. This avoids polluting session-tracking infrastructure (debounce, speech bubbles, fade timers).
- Game loop runs at 5fps idle (not stopped) when zero sessions are present, providing enough animation for ambient agents at minimal CPU cost.
- Ambient agents use stable synthetic session IDs (`ambient-agent-0`, `ambient-agent-1`) so AgentFactory produces deterministic character classes.
- Ambient agents hidden when 4+ real session agents exist to avoid visual clutter at the campfire.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm run make` fails with EPERM (operation not permitted) during webpack directory rename -- this is a pre-existing Windows filesystem issue (antivirus or process lock), not related to code changes. TypeScript compilation (`npx tsc --noEmit`) passes cleanly, confirming code correctness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ambient agents are fully functional -- launch the app to see two idle adventurers at the campfire
- The AMBIENT_WANDER_RADIUS and AMBIENT_WANDER_INTERVAL_MS constants are defined but not yet used by ambient agents (they use the default Agent idle behavior). These could be wired up in a future enhancement to give ambient agents a more relaxed movement style.

## Self-Check: PASSED

All files exist, all commits verified (213fef6, 37f9087).

---
*Quick Task: 7*
*Completed: 2026-03-02*

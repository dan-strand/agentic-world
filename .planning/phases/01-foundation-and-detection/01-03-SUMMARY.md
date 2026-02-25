---
phase: 01-foundation-and-detection
plan: 03
subsystem: renderer
tags: [pixi.js, game-loop, adaptive-fps, electron-renderer, 2d-graphics]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Electron shell, shared types (SessionInfo, SessionStatus), constants (STATUS_COLORS, BACKGROUND_COLOR, FPS_ACTIVE, FPS_IDLE), IPC bridge"
  - phase: 01-02
    provides: "SessionDetector, SessionStore with polling, IPC push of SessionInfo[] to renderer"
provides:
  - "PixiJS 8 world with bird's-eye spy compound background (5 buildings, paths, courtyard)"
  - "PlaceholderAgent visual: colored silhouette with name label, status label, bobbing animation"
  - "Agent layout algorithm: grid-based courtyard positioning, pure function"
  - "Adaptive GameLoop: 30fps active, 5fps idle, 0fps minimized"
  - "Complete IPC-to-visual pipeline: sessions -> world -> agents"
affects: [02-01, 02-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [PixiJS 8 async init, Graphics-based compound scene, adaptive ticker management, visibility-change-based minimize detection]

key-files:
  created:
    - src/renderer/world.ts
    - src/renderer/placeholder-agent.ts
    - src/renderer/agent-layout.ts
    - src/renderer/game-loop.ts
  modified:
    - src/renderer/index.ts

key-decisions:
  - "PixiJS 8 async init pattern with definite assignment assertions for strict TS compatibility"
  - "Compound background drawn with single Graphics object per redraw for performance"
  - "Agent positions recalculated only on count change, not every tick"
  - "Visibility change API for minimize detection (more reliable than Electron blur/focus)"

patterns-established:
  - "PixiJS world init: async Application.init() with backgroundContainer + agentContainer layering"
  - "Adaptive frame rate: GameLoop manages ticker.maxFPS based on session activity state"
  - "Agent lifecycle: Map<sessionId, PlaceholderAgent> with create-on-first-see, update-on-revisit, persist-on-disappear"
  - "Pure layout function: calculateAgentPositions(count, width, height) with grid distribution"

requirements-completed: [APP-02]

# Metrics
duration: 4min
completed: 2026-02-25
---

# Phase 1 Plan 03: PixiJS Visual World Summary

**Spy compound scene with placeholder agents, adaptive game loop (30/5/0 fps), and full IPC-to-visual pipeline rendering 52 detected sessions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T16:34:26Z
- **Completed:** 2026-02-25T16:37:55Z
- **Tasks:** 2/2 (Task 3 is checkpoint:human-verify -- awaiting user)
- **Files modified:** 5

## Accomplishments
- Built bird's-eye spy compound background with 5 buildings (HQ, Comms, Barracks, Armory, Garage), connecting paths, courtyard, and accent details (guard post, crates, vehicle)
- Created PlaceholderAgent visual with colored silhouette (circle head + rectangle body), project name label above, status text below, and gentle bobbing animation with random phase offsets
- Implemented adaptive GameLoop that starts at 5fps, ramps to 30fps when active sessions exist, and stops ticker entirely when window is minimized
- Wired complete pipeline: IPC SessionInfo[] -> World.updateSessions() -> PlaceholderAgent creation/update -> GameLoop frame rate adaptation
- Verified live: app launches, detects 52 sessions, renders compound with agents

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PixiJS world with spy compound background, placeholder agent visuals, and layout algorithm** - `18efccb` (feat)
2. **Task 2: Wire adaptive game loop, connect IPC to visuals, and verify resource budget** - `0dd3273` (feat)

## Files Created/Modified
- `src/renderer/world.ts` - PixiJS Application with spy compound background, agent container management, session-to-visual mapping
- `src/renderer/placeholder-agent.ts` - PlaceholderAgent Container with colored silhouette, name/status labels, bobbing animation
- `src/renderer/agent-layout.ts` - Pure function calculateAgentPositions for grid-based courtyard distribution
- `src/renderer/game-loop.ts` - Adaptive ticker: 30fps active, 5fps idle, stopped when minimized
- `src/renderer/index.ts` - Complete wiring: World + GameLoop + IPC listeners + resize + visibility change

## Decisions Made
- Used PixiJS 8 async init pattern (`new Application()` then `await app.init()`) with definite assignment assertions (`!:`) on class properties for TypeScript strict mode compatibility
- Drew compound background as a single Graphics object per redraw rather than multiple persistent objects -- simpler cleanup on resize
- Agent positions recalculated only when agent count changes (not on every session update) to avoid visual jitter
- Used `document.visibilitychange` for minimize/restore detection instead of Electron-specific blur/focus events (more reliable across OS window managers)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 visual layer is complete: compound background + placeholder agents + adaptive frame rate
- All 52 detected sessions render as PlaceholderAgents with correct project names and status colors
- Phase 2 will replace placeholder silhouettes with pixel art sprites, add locations/speech bubbles
- GameLoop adaptive pattern is established and ready for Phase 2 animation complexity
- Awaiting human-verify checkpoint (Task 3) to confirm visual correctness before marking Phase 1 complete

## Self-Check: PASSED

All 5 files verified present. Both commit hashes (18efccb, 0dd3273) confirmed in git log.

---
*Phase: 01-foundation-and-detection*
*Completed: 2026-02-25*

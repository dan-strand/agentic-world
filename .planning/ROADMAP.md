# Roadmap: Agent World

## Milestones

- ✅ **v1.0 MVP** - Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Fantasy RPG Aesthetic** - Phases 4-7 (shipped 2026-02-26)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-3) - SHIPPED 2026-02-25</summary>

- [x] **Phase 1: Foundation and Detection** - Electron app with session detection, IPC bridge, and adaptive game loop
- [x] **Phase 2: Visual World** - PixiJS scene with animated spy agents, world locations, labels, and speech bubbles (completed 2026-02-25)
- [x] **Phase 3: Status and Lifecycle** - Visual status states, celebration animation, and walk-back-to-HQ completion flow (completed 2026-02-25)

### Phase 1: Foundation and Detection
**Goal**: User can launch a lightweight desktop app that automatically discovers all running Claude Code sessions and displays their project names and status data
**Depends on**: Nothing (first phase)
**Requirements**: APP-01, APP-02, APP-03, DETECT-01, DETECT-02, DETECT-03, DETECT-04
**Success Criteria** (what must be TRUE):
  1. User can launch the app and see an Electron window appear with a themed background
  2. User can see placeholder representations of each running Claude Code session appear automatically without any configuration
  3. Each detected session displays its project directory name and current status (active/waiting/idle/error)
  4. App uses under 100MB RAM and under 2% CPU when sessions are idle (verified via Task Manager)
  5. App closes cleanly with no orphaned processes remaining
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold Electron app, shared types/constants, IPC bridge
- [x] 01-02-PLAN.md -- Session detection pipeline (filesystem scanning, JSONL reading, status determination, polling store)
- [x] 01-03-PLAN.md -- PixiJS world with placeholder agents, adaptive game loop, visual verification

### Phase 2: Visual World
**Goal**: User sees a living 2D pixel art spy world where each session is a distinct animated agent character working at themed locations
**Depends on**: Phase 1
**Requirements**: WORLD-01, WORLD-02, WORLD-03, WORLD-04, WORLD-05, WORLD-06
**Success Criteria** (what must be TRUE):
  1. User sees a 2D pixel art world with an HQ building and distinct mission locations (Lab, Server Room, Library)
  2. Each detected session appears as a unique animated pixel art spy agent with idle, walking, and working animations
  3. Agents are positioned at different locations based on their current activity type
  4. Each agent displays its project name as a visible label and shows a speech bubble with current activity (e.g., "Reading files", "Running tests")
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md -- Shared types/constants extensions, activity detection from JSONL tool_use, agent identity slot system
- [x] 02-02-PLAN.md -- Agent sprites (GraphicsContext frames), factory, state machine, vehicle system
- [x] 02-03-PLAN.md -- HQ building, project compounds, radial layout, bitmap font, speech bubbles, activity icons
- [x] 02-04-PLAN.md -- Integration: wire world.ts with compounds/agents/roads, remove placeholders, visual verification

### Phase 3: Status and Lifecycle
**Goal**: User can distinguish agent status at a glance and sees satisfying lifecycle animations when sessions complete
**Depends on**: Phase 2
**Requirements**: STATUS-01, STATUS-02, STATUS-03
**Success Criteria** (what must be TRUE):
  1. User can visually distinguish active, waiting, idle, and error agents through distinct appearance or animation differences
  2. When a session completes its task, the corresponding agent plays a celebration animation
  3. After celebrating, the agent walks back to the HQ building and remains there
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- Status constants, agent visual differentiation (tint/breathing/shake/speed), fireworks particle class
- [x] 03-02-PLAN.md -- World integration: status debouncing, completion detection, celebration trigger, compound lifecycle, visual verification

</details>

<details>
<summary>v1.1 Fantasy RPG Aesthetic (Phases 4-7) - SHIPPED 2026-02-26</summary>

- [x] **Phase 4: Asset Pipeline and World Ground** - Sprite atlas loading, tilemap ground with paths, fixed 1024x768 window with hidden title bar
- [x] **Phase 5: Buildings and World Layout** - Guild Hall and four quest zone buildings positioned as one cohesive connected world
- [x] **Phase 6: Agent Sprite Overhaul** - AnimatedSprite adventurers with character classes, vehicle system removed, walk/idle/work animations
- [x] **Phase 7: Effects and Atmosphere** - Level-up celebration, ambient particles, zone glow highlights, warm lighting tint

See: [`.planning/milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md) for full phase details.

</details>

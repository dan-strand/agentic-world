# Roadmap: Agent World

## Overview

Agent World goes from zero to a working always-on desktop visualizer in three phases. Phase 1 builds the Electron shell, session detection pipeline, and resource-safe game loop -- the highest-risk work and the foundation everything else depends on. Phase 2 layers in the PixiJS visual world with animated spy agents, locations, labels, and speech bubbles. Phase 3 completes the experience with visual status differentiation, celebration animations, and the walk-back-to-HQ lifecycle.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Detection** - Electron app with session detection, IPC bridge, and adaptive game loop
- [ ] **Phase 2: Visual World** - PixiJS scene with animated spy agents, world locations, labels, and speech bubbles
- [ ] **Phase 3: Status and Lifecycle** - Visual status states, celebration animation, and walk-back-to-HQ completion flow

## Phase Details

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
- [ ] 01-01-PLAN.md -- Scaffold Electron app, shared types/constants, IPC bridge
- [ ] 01-02-PLAN.md -- Session detection pipeline (filesystem scanning, JSONL reading, status determination, polling store)
- [ ] 01-03-PLAN.md -- PixiJS world with placeholder agents, adaptive game loop, visual verification

### Phase 2: Visual World
**Goal**: User sees a living 2D pixel art spy world where each session is a distinct animated agent character working at themed locations
**Depends on**: Phase 1
**Requirements**: WORLD-01, WORLD-02, WORLD-03, WORLD-04, WORLD-05, WORLD-06
**Success Criteria** (what must be TRUE):
  1. User sees a 2D pixel art world with an HQ building and distinct mission locations (Lab, Server Room, Library)
  2. Each detected session appears as a unique animated pixel art spy agent with idle, walking, and working animations
  3. Agents are positioned at different locations based on their current activity type
  4. Each agent displays its project name as a visible label and shows a speech bubble with current activity (e.g., "Reading files", "Running tests")
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Status and Lifecycle
**Goal**: User can distinguish agent status at a glance and sees satisfying lifecycle animations when sessions complete
**Depends on**: Phase 2
**Requirements**: STATUS-01, STATUS-02, STATUS-03
**Success Criteria** (what must be TRUE):
  1. User can visually distinguish active, waiting, idle, and error agents through distinct appearance or animation differences
  2. When a session completes its task, the corresponding agent plays a celebration animation
  3. After celebrating, the agent walks back to the HQ building and remains there
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Detection | 0/3 | Planned | - |
| 2. Visual World | 0/0 | Not started | - |
| 3. Status and Lifecycle | 0/0 | Not started | - |

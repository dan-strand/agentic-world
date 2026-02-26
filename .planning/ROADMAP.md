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

### v1.1 Fantasy RPG Aesthetic (SHIPPED 2026-02-26)

**Milestone Goal:** Replace the spy/secret agent theme with a Fantasy RPG aesthetic -- guild hall, quest zones, 32x32 sprite sheets, tilemap environment, level-up celebrations, and a clean fixed-size window.

- [x] **Phase 4: Asset Pipeline and World Ground** - Sprite atlas loading, tilemap ground with paths, fixed 1024x768 window with hidden title bar (completed 2026-02-26)
- [x] **Phase 5: Buildings and World Layout** - Guild Hall and four quest zone buildings positioned as one cohesive connected world (completed 2026-02-26)
- [x] **Phase 6: Agent Sprite Overhaul** - AnimatedSprite adventurers with character classes, vehicle system removed, walk/idle/work animations (completed 2026-02-26)
- [x] **Phase 7: Effects and Atmosphere** - Level-up celebration, ambient particles, zone glow highlights, warm lighting tint (completed 2026-02-26)

## Phase Details

### Phase 4: Asset Pipeline and World Ground
**Goal**: User sees a pixel-art tilemap world with grass terrain and dirt paths in a clean fixed-size window, with all sprite assets loaded and rendering crisply
**Depends on**: Phase 3
**Requirements**: ENV-01, ENV-02, THEME-05
**Success Criteria** (what must be TRUE):
  1. User sees a 1024x768 window with no menus and only native minimize/close buttons in a hidden title bar
  2. User sees a grass tilemap ground with visible tile variation (not wallpaper repetition) and dirt paths connecting location areas
  3. All pixel art renders crisp at integer scaling with no blurriness at any Windows DPI setting (100%, 125%, 150%)
  4. The world layout feels like one connected environment with paths leading between defined areas, not isolated floating regions
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Fixed window config, asset pipeline (deps, webpack, tile atlas), renderer init with nearest-neighbor scaling
- [x] 04-02-PLAN.md -- Tilemap builder with grass variants and dirt paths, World scene integration, visual verification

### Phase 5: Buildings and World Layout
**Goal**: User sees a cohesive Fantasy RPG world with a central Guild Hall and four distinct quest zone buildings connected by the path network
**Depends on**: Phase 4
**Requirements**: THEME-02, THEME-03
**Success Criteria** (what must be TRUE):
  1. User sees a Guild Hall building sprite at the world center where idle agents gather
  2. User sees four visually distinct quest zone buildings: Wizard Tower, Training Grounds, Ancient Library, and Tavern
  3. Buildings are positioned along the dirt path network so the world reads as one connected village, not scattered boxes
  4. The old dynamic compound system and HQ are fully replaced -- no spy-themed visuals remain in the world
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md -- Building atlas generation, spritesheet descriptor, asset loader extension, building constants
- [x] 05-02-PLAN.md -- Building class, world refactoring (replace compounds/HQ with static buildings), visual verification

### Phase 6: Agent Sprite Overhaul
**Goal**: User sees Fantasy RPG adventurer characters walking between locations with smooth sprite-sheet animations, replacing the old code-drawn spy agents and vehicles
**Depends on**: Phase 5
**Requirements**: THEME-01, THEME-04, AGENT-01, AGENT-02, AGENT-03
**Success Criteria** (what must be TRUE):
  1. Each agent appears as a 32x32 sprite-sheet adventurer character (not code-drawn Graphics) with distinct walk, idle, and working animation states
  2. Different agents display as different character classes (mage, warrior, ranger, rogue) so they are visually distinguishable
  3. Agents walk/run between the Guild Hall and quest zones with no vehicles -- movement animation speed matches travel speed (no sliding)
  4. Multiple agents animate naturally with staggered frame offsets rather than moving in lockstep synchronization
  5. Status tint system (active/waiting/idle/error colors) works correctly on sprite-based agents
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md -- Character atlas generation, spritesheet descriptor, CharacterClass type system, constants cleanup
- [x] 06-02-PLAN.md -- Agent AnimatedSprite rewrite with 5-state walk-only state machine, staggered frame offsets
- [x] 06-03-PLAN.md -- World integration (state check updates), dead code cleanup (vehicle/compound/hq), visual verification

### Phase 7: Effects and Atmosphere
**Goal**: User sees polished visual effects that complete the RPG atmosphere -- level-up celebrations, ambient particles, zone highlights, and warm lighting
**Depends on**: Phase 6
**Requirements**: FX-01, FX-02, FX-03, ENV-03, ENV-04
**Success Criteria** (what must be TRUE):
  1. When a session completes a task, the agent's celebration displays a golden light column with sparkle shower (not the old fireworks explosion)
  2. The level-up light column has a visible glow halo effect for visual impact
  3. Ambient floating particles (fireflies or magic dust) drift through the world adding atmosphere
  4. Quest zones show a glow or highlight effect when an agent is actively working at that location
  5. The entire world has a warm ambient color tint that gives it a cohesive RPG feel
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md -- Install pixi-filters, new constants, LevelUpEffect and AmbientParticles classes
- [x] 07-02-PLAN.md -- World integration (warm filter, zone highlights, ambient particles), agent celebration swap, fireworks deletion, visual verification

## Progress

**Execution Order:**
Phases execute in numeric order: 4 -> 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Detection | v1.0 | 3/3 | Complete | 2026-02-25 |
| 2. Visual World | v1.0 | 4/4 | Complete | 2026-02-25 |
| 3. Status and Lifecycle | v1.0 | 2/2 | Complete | 2026-02-25 |
| 4. Asset Pipeline and World Ground | v1.1 | 2/2 | Complete | 2026-02-26 |
| 5. Buildings and World Layout | v1.1 | 2/2 | Complete | 2026-02-26 |
| 6. Agent Sprite Overhaul | v1.1 | 3/3 | Complete | 2026-02-26 |
| 7. Effects and Atmosphere | v1.1 | 2/2 | Complete | 2026-02-26 |

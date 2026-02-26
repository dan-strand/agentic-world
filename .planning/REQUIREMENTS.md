# Requirements: Agent World

**Defined:** 2026-02-25
**Core Value:** Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Session Detection

- [x] **DETECT-01**: App auto-detects running Claude Code sessions from local filesystem and process list without user configuration
- [x] **DETECT-02**: App tracks each session's status: active (Claude working), waiting for input, idle, or error
- [x] **DETECT-03**: App detects when a session completes its current task
- [x] **DETECT-04**: App maps each detected session to its project directory name

### Visual World

- [x] **WORLD-01**: App renders a 2D pixel art world with an HQ building and distinct mission locations
- [x] **WORLD-02**: Each detected session appears as a unique animated pixel art spy agent character
- [x] **WORLD-03**: Agents animate through states: idle stance, walking between locations, working at a location
- [x] **WORLD-04**: Each agent displays its project name as a label
- [x] **WORLD-05**: Agents show speech bubbles indicating current activity type (e.g., "Reading files", "Running tests")
- [x] **WORLD-06**: Agents work at different locations based on activity type (Lab for coding, Server Room for tests, Library for reading)

### Status & Lifecycle

- [x] **STATUS-01**: Active, waiting, idle, and error states are visually distinct through agent appearance or animation
- [x] **STATUS-02**: Agents play a celebration animation when their session completes a task
- [ ] **STATUS-03**: After celebration, agents walk back to the HQ building and remain there

### Desktop Application

- [x] **APP-01**: App runs as an always-on local Electron desktop window
- [x] **APP-02**: App uses under 100MB RAM and under 2% CPU when agents are idle (adaptive frame rate)
- [x] **APP-03**: App starts cleanly and shuts down without orphaned processes

## v1.1 Requirements

Requirements for the Fantasy RPG Aesthetic milestone. Each maps to roadmap phases.

### Visual Theme

- [x] **THEME-01**: Agents display as Fantasy RPG adventurer characters using 32x32 sprite sheet animations from CC0 public packs
- [x] **THEME-02**: Central HQ is replaced with a Guild Hall building sprite where idle agents rest
- [x] **THEME-03**: Mission locations are replaced with 4 themed quest zone buildings: Wizard Tower (coding), Training Grounds (testing), Ancient Library (reading), Tavern (comms)
- [x] **THEME-04**: Each agent has a distinct character class appearance (mage, warrior, ranger, rogue) based on slot assignment
- [ ] **THEME-05**: Buildings feel connected as part of one cohesive world layout, not disjointed isolated boxes

### World Environment

- [ ] **ENV-01**: Ground is rendered as a tilemap with grass tile variants and dirt paths connecting the Guild Hall to each quest zone
- [x] **ENV-02**: Window is fixed at 1024x768 with no resize, no menus, hidden title bar with native minimize/close buttons
- [ ] **ENV-03**: Ambient floating particles (fireflies, magic dust) add atmosphere to the world
- [ ] **ENV-04**: Quest zones show a glow/highlight effect when an agent is actively working there

### Agent System

- [ ] **AGENT-01**: Agents use AnimatedSprite with walk, idle, and working animation states replacing Graphics frame-swapping
- [ ] **AGENT-02**: Vehicle system is removed entirely — agents walk/run between all locations
- [ ] **AGENT-03**: Each agent starts on a randomized animation frame offset for natural, non-synchronized movement

### Celebration & Effects

- [ ] **FX-01**: Task completion triggers a golden light column + sparkle shower effect replacing the fireworks explosion
- [ ] **FX-02**: Level-up light column has a GlowFilter halo effect for visual impact
- [ ] **FX-03**: World has a warm ambient lighting tint (ColorMatrixFilter) for RPG atmosphere

## v2 Requirements

### Enhanced Detection

- **DETECT-05**: Integrate Claude Code hooks for real-time session event detection
- **DETECT-06**: Detect and display sub-agents spawned within parent sessions

### Visual Polish

- **WORLD-07**: Multiple distinguishable spy character sprites (different trenchcoat colors, accessories)
- **STATUS-04**: Needs-attention visual alarm (flashing/bouncing) when session waits for user input
- **STATUS-05**: Session duration badge displayed per agent

### Desktop Enhancements

- **APP-04**: Remember and restore window position between launches
- **APP-05**: System tray icon with minimize-to-tray support
- **APP-06**: Day/night ambient cycle in the world background

## Out of Scope

| Feature | Reason |
|---------|--------|
| Click-to-interact / session switching | Transforms visualizer into session manager; different product entirely |
| Audio / sound effects | Annoying in always-on apps; users close apps that make noise |
| Token/cost tracking overlay | Duplicates existing tools; distracts from visual status purpose |
| Session control (start/stop/restart) | Out of scope — this is a viewer, not a controller |
| Web hosting / remote access | Local-only by design |
| 3D graphics | Strictly 2D pixel art |
| Mobile support | Desktop-only tool |
| Transparent/click-through window | Windows Electron bugs; opaque window for v1 |
| Custom/hand-drawn pixel art | Using public CC0 packs only for v1.1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1.0 (Phases 1-3)

| Requirement | Phase | Status |
|-------------|-------|--------|
| DETECT-01 | Phase 1 | Complete |
| DETECT-02 | Phase 1 | Complete |
| DETECT-03 | Phase 1 | Complete |
| DETECT-04 | Phase 1 | Complete |
| WORLD-01 | Phase 2 | Complete |
| WORLD-02 | Phase 2 | Complete |
| WORLD-03 | Phase 2 | Complete |
| WORLD-04 | Phase 2 | Complete |
| WORLD-05 | Phase 2 | Complete |
| WORLD-06 | Phase 2 | Complete |
| STATUS-01 | Phase 3 | Complete |
| STATUS-02 | Phase 3 | Complete |
| STATUS-03 | Phase 3 | Pending |
| APP-01 | Phase 1 | Complete |
| APP-02 | Phase 1 | Complete |
| APP-03 | Phase 1 | Complete |

### v1.1 (Phases 4-7)

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | Phase 4 | Pending |
| ENV-02 | Phase 4 | Complete |
| THEME-05 | Phase 4 | Pending |
| THEME-02 | Phase 5 | Complete |
| THEME-03 | Phase 5 | Complete |
| THEME-01 | Phase 6 | Complete |
| THEME-04 | Phase 6 | Complete |
| AGENT-01 | Phase 6 | Pending |
| AGENT-02 | Phase 6 | Pending |
| AGENT-03 | Phase 6 | Pending |
| FX-01 | Phase 7 | Pending |
| FX-02 | Phase 7 | Pending |
| FX-03 | Phase 7 | Pending |
| ENV-03 | Phase 7 | Pending |
| ENV-04 | Phase 7 | Pending |

**Coverage:**
- v1.0 requirements: 16 total, 16 mapped, 0 unmapped
- v1.1 requirements: 15 total, 15 mapped, 0 unmapped

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after v1.1 roadmap created*

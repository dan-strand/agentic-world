# Agent World

## What This Is

A locally-run animated 2D visualizer that shows your active Claude Code sessions as pixel-art secret agents on missions. Each agent represents a running Claude session, working at different locations in a spy-themed world. When sessions complete, agents celebrate and return to HQ. It's a persistent, always-on dashboard that gives you an at-a-glance view of which sessions are active, idle, or waiting for input.

## Core Value

Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## Current Milestone: v1.1 Fantasy RPG Aesthetic

**Goal:** Replace the spy/secret agent theme with a Fantasy RPG aesthetic — guild hall, quest zones, 32x32 sprite sheets, tilemap environment, level-up celebrations, and a clean fixed-size window.

**Target features:**
- Fantasy RPG theme: adventurers at a guild hall, questing at themed locations
- 32x32 pixel art sprite sheets from public packs (replacing code-drawn Graphics primitives)
- Tilemap ground with grass tiles and dirt paths between locations
- Quest zone locations: Wizard Tower (coding), Training Grounds (testing), Ancient Library (reading), Tavern (comms)
- Level-up celebration effect replacing fireworks (golden light column, sparkles)
- No vehicles — adventurers walk/run everywhere
- Fixed 1024x768 window with no menus, just title bar with minimize/close
- Ambient lighting and particle effects

## Requirements

### Validated

- ✓ Auto-detect running Claude Code sessions — v1.0 Phase 1
- ✓ Display each session as an animated character in a 2D world — v1.0 Phase 2
- ✓ Status visual differentiation (active/waiting/idle/error) — v1.0 Phase 3
- ✓ Celebration animation on task completion — v1.0 Phase 3
- ✓ Walk-back-to-HQ lifecycle — v1.0 Phase 3
- ✓ Always-on lightweight desktop application — v1.0 Phase 1

### Active

- [ ] Fantasy RPG theme: adventurers, guild hall, quest zones
- [ ] 32x32 pixel art sprite sheets from public packs (replacing code-drawn primitives)
- [ ] Tilemap ground with grass tiles and dirt paths
- [ ] Quest zone locations: Wizard Tower, Training Grounds, Ancient Library, Tavern
- [ ] Level-up celebration effect (golden light column, sparkles)
- [ ] Remove vehicle system — adventurers walk/run everywhere
- [ ] Fixed 1024x768 window, no menus, title bar with minimize/close only
- [ ] Ambient lighting and particle effects

### Out of Scope

- Web hosting or remote access — local only
- Click-to-interact or session control from the visualizer
- Sound effects or audio
- 3D graphics — strictly 2D pixel art
- Mobile support
- Custom/hand-drawn pixel art — using public packs only for v1.1

## Context

- User runs multiple Claude Code sessions simultaneously in different bash terminals on Windows (MINGW64/Git Bash)
- Claude Code is a CLI tool that runs in terminal sessions
- Sessions can be detected via running processes, Claude's internal state files, or filesystem artifacts
- The visualizer needs read-only access to session metadata — it doesn't control sessions
- Electron or similar local app framework would provide desktop window + canvas for animation
- Pixel art assets can be generated programmatically or from sprite sheets

## Constraints

- **Platform**: Windows (MINGW64_NT) — must run natively on user's system
- **Runtime**: Local only — no server, no cloud, no browser hosting
- **Access**: Needs to read local process info and Claude session state
- **Performance**: Lightweight enough to run always-on without impacting system resources
- **Dependencies**: Minimize external dependencies — should be easy to install and run

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| View-only (no interaction) | Keeps scope manageable, user just needs visual status | ✓ Good |
| Spy/agent theme | Fits the "Agent World" concept, makes it fun and distinctive | ⚠️ Revisit — switching to Fantasy RPG in v1.1 |
| Local desktop app (not terminal UI) | Needed for rich 2D animation and pixel art rendering | ✓ Good |
| Auto-detect sessions | Hands-free operation, no manual registration | ✓ Good |
| Fantasy RPG theme (v1.1) | More engaging, better visual vocabulary for quest/mission metaphor | — Pending |
| 32x32 public sprite packs (v1.1) | Faster than hand-drawing, higher quality than code-drawn primitives | — Pending |
| Fixed 1024x768 window (v1.1) | Clean look, no resize complexity, fits as always-on dashboard | — Pending |

---
*Last updated: 2026-02-25 after v1.1 milestone start*

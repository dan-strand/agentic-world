# Agent World

## What This Is

A locally-run animated 2D visualizer that shows your active Claude Code sessions as Fantasy RPG adventurers in a pixel-art world. Each agent represents a running Claude session — mages, warriors, rangers, and rogues walk between a central Guild Hall and themed quest zone buildings. When sessions complete, agents celebrate with a golden light column and return to the guild. It's a persistent, always-on dashboard that gives you an at-a-glance view of which sessions are active, idle, or waiting for input.

## Core Value

Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## Requirements

### Validated

- ✓ Auto-detect running Claude Code sessions — v1.0 Phase 1
- ✓ Display each session as an animated character in a 2D world — v1.0 Phase 2
- ✓ Status visual differentiation (active/waiting/idle/error) — v1.0 Phase 3
- ✓ Celebration animation on task completion — v1.0 Phase 3
- ✓ Walk-back-to-Guild-Hall lifecycle — v1.0 Phase 3, updated v1.1 Phase 5
- ✓ Always-on lightweight desktop application — v1.0 Phase 1
- ✓ Fantasy RPG theme: adventurers, guild hall, quest zones — v1.1 Phases 4-7
- ✓ 32x32 pixel art sprite sheets (pngjs-generated, replacing code-drawn primitives) — v1.1 Phase 6
- ✓ Tilemap ground with grass tiles and dirt paths — v1.1 Phase 4
- ✓ Quest zone buildings: Wizard Tower, Training Grounds, Ancient Library, Tavern — v1.1 Phase 5
- ✓ Level-up celebration effect (golden light column, sparkles, GlowFilter) — v1.1 Phase 7
- ✓ Vehicle system removed — adventurers walk everywhere — v1.1 Phase 6
- ✓ Fixed 1024x768 window, hidden title bar with minimize/close only — v1.1 Phase 4
- ✓ Ambient lighting (warm tint) and particle effects (fireflies) — v1.1 Phase 7

### Active

## Current Milestone: v1.2 Activity Monitoring & Labeling

**Goal:** Make the world reflect what's actually happening — buildings show project names, speech bubbles show real-time activity with auto-fade, and agents disappear after finishing instead of piling up.

**Target features:**
- Buildings labeled with active project folder names (max 4 projects)
- Building labels revert to RPG names when project sessions end
- Speech bubbles show current activity text, auto-fade after a few seconds
- Agents fade out at Guild Hall after celebrating instead of accumulating

### Out of Scope

- Web hosting or remote access — local only
- Click-to-interact or session control from the visualizer
- Sound effects or audio — annoying in always-on apps
- 3D graphics — strictly 2D pixel art
- Mobile support — desktop-only tool
- Custom/hand-drawn pixel art — using pngjs-generated sprites

## Context

- User runs multiple Claude Code sessions simultaneously in different bash terminals on Windows (MINGW64/Git Bash)
- Shipped v1.0 MVP (session detection, spy-themed world) and v1.1 (Fantasy RPG overhaul) in 2 days
- Codebase: 2,587 LOC TypeScript, 22 source files, 3 pngjs generator scripts
- Tech stack: Electron 40.6.1, PixiJS 8.16.0, TypeScript 5.7, pixi-filters 6.1.5, Webpack (Electron Forge)
- Atlas-first asset pipeline: pngjs generates PNG atlases, JSON descriptors, loadAllAssets() with Promise.all
- 5-state agent machine: idle_at_hq, walking_to_building, walking_to_workspot, working, celebrating
- Canvas-rendered static tilemap ground, static Building instances, AnimatedSprite agents
- Minor dead code remains from v1.0→v1.1 migration (STATUS_COLORS, DEFAULT_WINDOW_*, unused methods)

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
| Local desktop app (not terminal UI) | Needed for rich 2D animation and pixel art rendering | ✓ Good |
| Auto-detect sessions | Hands-free operation, no manual registration | ✓ Good |
| Fantasy RPG theme (v1.1) | More engaging, better visual vocabulary for quest/mission metaphor | ✓ Good |
| pngjs-generated sprites (v1.1) | Deterministic, no external asset deps, consistent style | ✓ Good |
| Fixed 1024x768 window (v1.1) | Clean look, no resize complexity, fits as always-on dashboard | ✓ Good |
| Atlas-first asset pipeline (v1.1) | Avoids PixiJS Cache/Texture.from issues, single draw calls | ✓ Good |
| Canvas-rendered tilemap (v1.1) | @pixi/tilemap incompatible with Electron webpack; canvas equally efficient for static ground | ✓ Good |
| Walk-only movement (v1.1) | Simpler state machine, fits RPG theme, vehicles felt out of place | ✓ Good |
| pixi-filters GlowFilter (v1.1) | Only viable glow option for PixiJS 8; quality 0.3 matches pixel art | ✓ Good |

---
*Last updated: 2026-02-26 after v1.2 milestone started*

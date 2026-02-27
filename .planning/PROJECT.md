# Agent World

## What This Is

A locally-run animated 2D visualizer that shows your active Claude Code sessions as Fantasy RPG adventurers in a pixel-art world. Each agent represents a running Claude session — mages, warriors, rangers, and rogues walk between a central Guild Hall and themed quest zone buildings. When sessions complete, agents celebrate with a golden light column and return to the guild. Waiting sessions get gentle audio nudges after sitting unattended. It's a persistent, always-on dashboard that gives you an at-a-glance view of which sessions are active, idle, or waiting for input.

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
- ✓ Dynamic building labels with project names — v1.2 Phase 8
- ✓ Speech bubbles on activity changes — v1.2 Phase 9
- ✓ Agent fade-out lifecycle — v1.2 Phase 10
- ✓ Job completion sound effect — v1.2 Quick Task 3
- ✓ Ready-to-work reminder sound — v1.2 Quick Task 5
- ✓ Volume slider and mute button — v1.2 Quick Task 3
- ✓ RPG-themed work spots per building — v1.2 Quick Task 4
- ✓ Idle timeout agent fadeout (5 min) — v1.2 Quick Task 2
- ✓ Accurate status transitions (active/waiting/idle) from JSONL files — v1.3 Phase 11
- ✓ Status debounce commits transitions without dropping state changes — v1.3 Phase 11
- ✓ Reactivated sessions after fade-out properly reappear as agents — v1.3 Phase 11
- ✓ All active/waiting sessions always have a visible agent on screen — v1.3 Phase 11
- ✓ Tool_use detection prevents false "job's done" during active execution — v1.3 Phase 11
- ✓ Stale session filter preserves actively-working sessions — v1.3 Phase 11
- ✓ Per-session waiting reminder from "waiting" status (not idle) — v1.3 Phase 13
- ✓ Reminder sounds throttled with ~30s minimum gap — v1.3 Phase 13
- ✓ Reminder requires active-cycle before repeating — v1.3 Phase 13

### Active

## Current Milestone: v1.4 Enhanced Session Workspaces

**Goal:** Replace small building exteriors with large, detailed activity-themed interior workspaces that show agents working inside, current focus, and recent activity — making each workspace a rich visual status dashboard.

**Target features:**
- Reorganize 1024x768 layout to give workspace buildings much more screen space
- Replace 96x96 building sprites with larger detailed interior scenes (wizard's study, arena, library, tavern)
- Agents visibly work inside themed workspace interiors at stations
- Current file/tool and recent activity displayed as text overlays on workspaces
- Workspaces grouped per project (multiple sessions share a workspace)
- Guild Hall reduced to small waypoint for celebrations/transitions only
- Rich visuals AND information density at a glance

### Out of Scope

- Web hosting or remote access — local only
- Click-to-interact or session control from the visualizer
- 3D graphics — strictly 2D pixel art
- Mobile support — desktop-only tool
- Custom/hand-drawn pixel art — using pngjs-generated sprites
- Per-session sound selection — over-engineering for current use case
- Global "all-waiting" sound — user prefers per-session sounds

## Context

- User runs multiple Claude Code sessions simultaneously in different bash terminals on Windows (MINGW64/Git Bash)
- Shipped v1.0 through v1.3 in 3 days (2026-02-25 → 2026-02-27)
- Codebase: 3,269 LOC TypeScript, 22 source files, 3 pngjs generator scripts
- Tech stack: Electron 40.6.1, PixiJS 8.16.0, TypeScript 5.7, pixi-filters 6.1.5, Webpack (Electron Forge)
- Atlas-first asset pipeline: pngjs generates PNG atlases, JSON descriptors, loadAllAssets() with Promise.all
- 6-state agent machine: idle_at_hq, walking_to_building, walking_to_workspot, working, celebrating, fading_out
- Canvas-rendered static tilemap ground, static Building instances, AnimatedSprite agents
- SoundManager singleton with HTML5 Audio API for jobs-done and ready-to-work sounds
- Status debounce (2.5s) prevents visual flickering; dual-gate completion detection (status transition + system entry)
- Session status lifecycle: active → waiting → idle (waiting = task done, idle = dormant)
- tool_use content inspection keeps sessions active during multi-tool execution
- Per-session waiting reminders (60s timer, 30s global throttle, active-cycle guard)

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
| Per-session sounds, not global (v1.3) | User explicitly prefers individual session sounds over all-waiting signal | ✓ Good |
| Status audit before audio (v1.3) | Audio logic depends on reliable status detection; fix pipeline first | ✓ Good |
| tool_use content inspection (v1.3) | Prevents false waiting during tool execution; uses existing JSONL structure | ✓ Good |
| Dual-gate completion detection (v1.3) | Requires both status transition AND system entry; defense-in-depth | ✓ Good |
| Reminder from waiting, not idle (v1.3) | "Waiting" is the actionable state; "idle" is dormant | ✓ Good |
| 30s reminder throttle (v1.3) | Prevents audio spam when multiple sessions finish close together | ✓ Good |
| Active-cycle guard for reminders (v1.3) | Session must go active before reminder can fire again; prevents nagging | ✓ Good |

---
*Last updated: 2026-02-27 after v1.4 milestone started*

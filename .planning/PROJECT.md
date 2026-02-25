# Agent World

## What This Is

A locally-run animated 2D visualizer that shows your active Claude Code sessions as pixel-art secret agents on missions. Each agent represents a running Claude session, working at different locations in a spy-themed world. When sessions complete, agents celebrate and return to HQ. It's a persistent, always-on dashboard that gives you an at-a-glance view of which sessions are active, idle, or waiting for input.

## Core Value

Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Auto-detect running Claude Code sessions from local system
- [ ] Display each session as an animated pixel-art spy agent in a 2D world
- [ ] Show agent info: project name, current activity, duration, status (active/waiting/idle/error)
- [ ] Agents work at different locations based on their activity
- [ ] Celebration animation when a session completes its task
- [ ] Completed agents walk back to HQ building
- [ ] Agents waiting for user input visually distinguished (so you know where to go)
- [ ] Spy/secret agent theme — trenchcoats, briefcases, sunglasses
- [ ] Speech bubbles or labels showing what the agent is currently doing
- [ ] Always-on local desktop application (no browser/hosting required)
- [ ] Support 2-4 simultaneous sessions comfortably, scale to more
- [ ] View-only — no click interaction needed, pure visual dashboard

### Out of Scope

- Web hosting or remote access — local only
- Click-to-interact or session control from the visualizer
- Sound effects or audio
- 3D graphics — strictly 2D pixel art
- Mobile support

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
| View-only (no interaction) | Keeps scope manageable, user just needs visual status | — Pending |
| Spy/agent theme | Fits the "Agent World" concept, makes it fun and distinctive | — Pending |
| Local desktop app (not terminal UI) | Needed for rich 2D animation and pixel art rendering | — Pending |
| Auto-detect sessions | Hands-free operation, no manual registration | — Pending |

---
*Last updated: 2026-02-25 after initialization*

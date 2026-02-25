# Phase 1: Foundation and Detection - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Electron desktop app shell with Claude Code session auto-detection, IPC data bridge, and adaptive game loop. Delivers a working window that discovers all running sessions and displays placeholder agents with project names and status. Pixel art sprites, speech bubbles, and location mapping come in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Session Detection
- Filesystem polling as primary detection mechanism — watch `~/.claude/projects/` for JSONL file changes
- Poll interval: 3-5 seconds
- Track ALL Claude Code sessions on the machine — no filtering by directory
- Completed/ended sessions stay visible at HQ until the app is restarted (not auto-removed)
- Abstract detection behind a `SessionDetector` interface for future format changes

### Window Appearance
- Resizable window — user can drag to any size
- Normal window behavior (NOT always-on-top) — behaves like a standard desktop app
- Standard Windows titlebar with minimize/maximize/close (no custom frameless chrome)
- Background: outdoor spy compound — bird's-eye view with buildings, paths, and open areas for agents

### Placeholder Display
- Before pixel art sprites exist, show detected sessions as basic colored silhouettes/stick figures
- Gentle bobbing idle animation so the scene feels alive
- Each placeholder shows: project name label above, status text below
- Agent positioning: Claude's discretion — auto-distribute so they don't overlap

### Status Definitions
- Four statuses: active, waiting for input, idle, error
- Idle threshold: 30 seconds since last JSONL file modification
- Primary visual distinction: active vs idle (most important at a glance)
- Spy-themed color scheme:
  - Teal = active (mission go)
  - Amber = waiting for input (standby)
  - Dark/muted = idle (off-duty)
  - Red = error (compromised)
- Ambiguous/unknown states default to "active" (optimistic assumption)

### Claude's Discretion
- Placeholder agent positioning algorithm (spread evenly, avoid overlap)
- Exact bobbing animation parameters (speed, amplitude)
- Default window size on first launch
- Background scene composition details (building placement, path layout)
- Game loop tick rate and adaptive frame rate thresholds

</decisions>

<specifics>
## Specific Ideas

- The outdoor compound should feel like a bird's-eye spy base — buildings for different "missions" that agents will eventually walk between (Phase 2 will add location mapping)
- Completed agents gathering at HQ creates a visual "mission debrief" feel — you can see how many sessions finished while you were away
- The 30-second idle threshold is intentionally quick — if Claude hasn't written to the JSONL in 30 seconds, the session is probably waiting for something

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-detection*
*Context gathered: 2026-02-25*

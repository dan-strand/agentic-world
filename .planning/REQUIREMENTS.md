# Requirements: Agent World

**Defined:** 2026-02-26
**Core Value:** Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## v1.3 Requirements

Requirements for Audio & Status Reliability milestone. Each maps to roadmap phases.

### Audio — Jobs Done

- [ ] **AUDIO-01**: "Jobs done" sound plays only when ALL non-idle sessions are simultaneously in "waiting" status
- [ ] **AUDIO-02**: "Jobs done" sound does not play per-session on individual active→waiting transitions
- [ ] **AUDIO-03**: "Jobs done" sound does not re-trigger until at least one session has gone back to "active" and all return to "waiting" again

### Audio — Ready to Work

- [ ] **AUDIO-04**: "Ready to work" reminder timer starts from "waiting" status (not "idle")
- [ ] **AUDIO-05**: Each session gets its own independent 1-minute waiting timer
- [ ] **AUDIO-06**: Reminder sounds are throttled with ~30s minimum gap between any two reminder plays
- [ ] **AUDIO-07**: Reminder does not repeat for a session until that session returns to "active" and goes back to "waiting"

### Status Reliability

- [ ] **STATUS-01**: Session status transitions (active→waiting→idle) are accurately detected from JSONL files
- [ ] **STATUS-02**: Status debounce correctly commits transitions without dropping or duplicating state changes
- [ ] **STATUS-03**: Sessions that reactivate after being dismissed (faded out) properly reappear as agents

### Session Visibility

- [ ] **VIS-01**: All active/waiting sessions always have a visible agent on screen (no invisible or missing agents)
- [ ] **VIS-02**: Active sessions with failed tool detection default to a building (not guild hall)
- [ ] **VIS-03**: Stale session filter (30 min) does not incorrectly remove actively-working sessions

## Future Requirements

### Audio

- **AUDIO-08**: Distinct sound when all sessions complete simultaneously vs staggered
- **AUDIO-09**: Per-session sound selection

### Building Labels (from v1.2)

- **LABEL-03**: Label crossfade animation when project name changes
- **LABEL-04**: Agent count suffix on building label

### Speech Bubbles (from v1.2)

- **BUBBLE-04**: Show specific tool names instead of activity categories

## Out of Scope

| Feature | Reason |
|---------|--------|
| New sound effects | Existing jobs-done and ready-to-work sounds are sufficient |
| Visual redesign | Visuals are fine when working; focus is reliability |
| New status states | active/waiting/idle/error covers all Claude Code states |
| Per-session sound selection | Over-engineering for current use case |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIO-01 | — | Pending |
| AUDIO-02 | — | Pending |
| AUDIO-03 | — | Pending |
| AUDIO-04 | — | Pending |
| AUDIO-05 | — | Pending |
| AUDIO-06 | — | Pending |
| AUDIO-07 | — | Pending |
| STATUS-01 | — | Pending |
| STATUS-02 | — | Pending |
| STATUS-03 | — | Pending |
| VIS-01 | — | Pending |
| VIS-02 | — | Pending |
| VIS-03 | — | Pending |

**Coverage:**
- v1.3 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13 ⚠️

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*

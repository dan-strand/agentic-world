# Requirements: Agent World

**Defined:** 2026-02-26
**Core Value:** Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## v1.2 Requirements

Requirements for v1.2 Activity Monitoring & Labeling. Each maps to roadmap phases.

### Building Labels

- [ ] **LABEL-01**: Buildings display the active project's folder name instead of the RPG building name
- [ ] **LABEL-02**: Building label reverts to its RPG name when all sessions for that project end

### Speech Bubbles

- [ ] **BUBBLE-01**: Speech bubbles display the agent's current activity as text
- [ ] **BUBBLE-02**: Speech bubbles auto-fade after a few seconds
- [ ] **BUBBLE-03**: Speech bubbles re-appear on any activity change, not just building transitions

### Agent Lifecycle

- [ ] **LIFE-01**: Agents fade out at Guild Hall after celebrating instead of persisting indefinitely
- [ ] **LIFE-02**: Faded-out agents are not resurrected by session polling unless the session genuinely reactivates
- [ ] **LIFE-03**: Only 4 projects are visualized with buildings; additional projects are not shown

## Future Requirements

### Building Labels

- **LABEL-03**: Label crossfade animation when project name changes
- **LABEL-04**: Agent count suffix on building label ("Agent World (+1)")

### Speech Bubbles

- **BUBBLE-04**: Show specific tool names (e.g. "Read", "Edit") instead of activity categories

## Out of Scope

| Feature | Reason |
|---------|--------|
| Expanded BitmapFont charset | Project folder names use basic alphanumeric; defer unless needed |
| Sound effects on activity changes | Audio excluded from project scope |
| Click-to-interact with buildings | View-only app — no interaction |
| More than 4 project slots | User confirmed 4 max is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LABEL-01 | — | Pending |
| LABEL-02 | — | Pending |
| BUBBLE-01 | — | Pending |
| BUBBLE-02 | — | Pending |
| BUBBLE-03 | — | Pending |
| LIFE-01 | — | Pending |
| LIFE-02 | — | Pending |
| LIFE-03 | — | Pending |

**Coverage:**
- v1.2 requirements: 8 total
- Mapped to phases: 0
- Unmapped: 8

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*

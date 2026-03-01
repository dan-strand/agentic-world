# Requirements: Agent World

**Defined:** 2026-03-01
**Core Value:** Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## v1.5 Requirements

Requirements for Usage Dashboard milestone. Each maps to roadmap phases.

### Layout

- [ ] **LAYOUT-01**: Window expands from 1024x768 to 1024x1080 with dashboard panel below the RPG world
- [ ] **LAYOUT-02**: PixiJS canvas remains pinned at exactly 1024x768 — no scene graph changes
- [ ] **LAYOUT-03**: Dashboard panel renders as HTML/CSS div below the canvas

### Parsing

- [ ] **PARSE-01**: JSONL usage parser extracts input_tokens, output_tokens, cache_creation_input_tokens, and cache_read_input_tokens from assistant entries
- [ ] **PARSE-02**: Parser uses streaming readline to avoid blocking the main process
- [ ] **PARSE-03**: Parser caches results by file mtime to skip unchanged files on subsequent polls

### Dashboard

- [ ] **DASH-01**: Live session list shows compact rows with project name, status badge, duration, and current tool
- [ ] **DASH-02**: Clicking a session row expands to show full 4-field token breakdown and cost estimate
- [ ] **DASH-03**: Today's totals bar shows aggregate input tokens, output tokens, estimated cost, and session count
- [ ] **DASH-04**: Cache savings display shows estimated money saved via cache reads

### Cost

- [ ] **COST-01**: Bundled pricing table covers Opus, Sonnet, and Haiku model families with correct per-token rates
- [ ] **COST-02**: Cache read tokens priced at 0.1x input rate, cache write tokens at 1.25x input rate
- [ ] **COST-03**: Model auto-detected from JSONL message.model field
- [ ] **COST-04**: Cost displayed as ~$X.XX to signal estimate status

### History

- [ ] **HIST-01**: Daily aggregates persisted to a JSON file for 30-day retention
- [ ] **HIST-02**: Dashboard shows 30-day aggregate total (tokens and cost)

## Future Requirements

### Dashboard Polish (v1.6+)

- **CHART-01**: 30-day daily breakdown bar chart via Chart.js
- **CHART-02**: Cost-by-model stacked bars (Opus/Sonnet/Haiku colors)
- **DASH-05**: Session completion count in totals bar
- **BUDGET-01**: Budget threshold coloring with configurable limits
- **EXPORT-01**: Data export to CSV

## Out of Scope

| Feature | Reason |
|---------|--------|
| Daily breakdown chart | Deferred to v1.6 — ship live dashboard first |
| Real-time token streaming counter | JSONL files only written at message boundaries, not during streaming |
| Per-project historical view | Project-to-session mapping is currently fuzzy |
| Cloud sync | Violates local-only constraint |
| Budget alerts | Requires settings system that doesn't exist yet |
| Data export | Users have direct JSONL filesystem access; ccusage CLI covers this |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | — | Pending |
| LAYOUT-02 | — | Pending |
| LAYOUT-03 | — | Pending |
| PARSE-01 | — | Pending |
| PARSE-02 | — | Pending |
| PARSE-03 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| COST-01 | — | Pending |
| COST-02 | — | Pending |
| COST-03 | — | Pending |
| COST-04 | — | Pending |
| HIST-01 | — | Pending |
| HIST-02 | — | Pending |

**Coverage:**
- v1.5 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16 ⚠️

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after initial definition*

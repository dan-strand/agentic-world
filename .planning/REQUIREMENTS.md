# Requirements: Agent World

**Defined:** 2026-03-16
**Core Value:** Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## v2.1 Requirements

Requirements for hardening and bug fix release. Each maps to roadmap phases.

### Crash Diagnosis

- [ ] **DIAG-01**: App captures crash events (render-process-gone, uncaughtException, window.onerror) and logs them to a persistent file
- [ ] **DIAG-02**: Game loop tick is wrapped in an error boundary so a single exception doesn't silently freeze the app
- [ ] **DIAG-03**: Crash events are logged to a persistent file via electron-log with timestamps and stack traces
- [ ] **DIAG-04**: Memory health monitor periodically logs heap statistics to detect growing memory before crash

### Resource Leak Fixes

- [ ] **LEAK-01**: Smoke and spark particles use object pooling instead of creating/destroying Graphics objects every tick
- [ ] **LEAK-02**: Palette swap texture cache destroys textures when agents are removed and uses LRU eviction
- [ ] **LEAK-03**: GlowFilter GPU resources are explicitly destroyed after celebration effects complete
- [ ] **LEAK-04**: Stale entries in dismissedSessions, mtimeCache, cwdCache, and usageAggregator cache are pruned periodically

### Long-Running Stability

- [ ] **STAB-01**: Timer accumulators (DayNightCycle.elapsed, particle phase, breathTimer) use modulo wrap to prevent floating-point precision drift
- [ ] **STAB-02**: JSONL readline streams are properly cleaned up with finally { stream.destroy() }
- [ ] **STAB-03**: Milestone passes an 8-hour soak test with less than 50MB total memory growth

## Future Requirements

### Observability

- **OBS-01**: Dashboard displays uptime counter and current memory usage
- **OBS-02**: Health heartbeat pings to detect frozen renderer

## Out of Scope

| Feature | Reason |
|---------|--------|
| Crash upload/telemetry service | Local-only app, no server infrastructure |
| Automated restart on crash | Over-engineering; fix the root cause instead |
| Performance profiling UI | Dev tooling, not user-facing |
| PixiJS version upgrade | 8.16.0 already includes Graphics leak fixes; upgrade risk not justified |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIAG-01 | — | Pending |
| DIAG-02 | — | Pending |
| DIAG-03 | — | Pending |
| DIAG-04 | — | Pending |
| LEAK-01 | — | Pending |
| LEAK-02 | — | Pending |
| LEAK-03 | — | Pending |
| LEAK-04 | — | Pending |
| STAB-01 | — | Pending |
| STAB-02 | — | Pending |
| STAB-03 | — | Pending |

**Coverage:**
- v2.1 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after initial definition*

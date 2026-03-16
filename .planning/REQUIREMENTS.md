# Requirements: Agent World

**Defined:** 2026-03-16
**Core Value:** Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## v2.1 Requirements

Requirements for hardening and bug fix release. Each maps to roadmap phases.

### Crash Diagnosis

- [x] **DIAG-01**: App captures crash events (render-process-gone, uncaughtException, window.onerror) and logs them to a persistent file
- [x] **DIAG-02**: Game loop tick is wrapped in an error boundary so a single exception doesn't silently freeze the app
- [x] **DIAG-03**: Crash events are logged to a persistent file via electron-log with timestamps and stack traces
- [x] **DIAG-04**: Memory health monitor periodically logs heap statistics to detect growing memory before crash

### Resource Leak Fixes

- [x] **LEAK-01**: Smoke and spark particles use object pooling instead of creating/destroying Graphics objects every tick
- [x] **LEAK-02**: Palette swap texture cache destroys textures when agents are removed and uses LRU eviction
- [x] **LEAK-03**: GlowFilter GPU resources are explicitly destroyed after celebration effects complete
- [x] **LEAK-04**: Stale entries in dismissedSessions, mtimeCache, cwdCache, and usageAggregator cache are pruned periodically

### Long-Running Stability

- [x] **STAB-01**: Timer accumulators (DayNightCycle.elapsed, particle phase, breathTimer) use modulo wrap to prevent floating-point precision drift
- [x] **STAB-02**: JSONL readline streams are properly cleaned up with finally { stream.destroy() }
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
| DIAG-01 | Phase 23 | Complete |
| DIAG-02 | Phase 23 | Complete |
| DIAG-03 | Phase 23 | Complete |
| DIAG-04 | Phase 23 | Complete |
| LEAK-01 | Phase 24 | Complete |
| LEAK-02 | Phase 24 | Complete |
| LEAK-03 | Phase 24 | Complete |
| LEAK-04 | Phase 24 | Complete |
| STAB-01 | Phase 24 | Complete |
| STAB-02 | Phase 24 | Complete |
| STAB-03 | Phase 25 | Pending |

**Coverage:**
- v2.1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after roadmap creation*

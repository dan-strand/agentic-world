# Requirements: Agent World

**Defined:** 2026-03-18
**Core Value:** Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## v2.2 Requirements

Requirements for performance optimization release. Each maps to roadmap phases.

### GPU Rendering

- [ ] **GPU-01**: Stage-level ColorMatrixFilter replaced with Container.tint for day/night coloring (eliminates double render pass)
- [ ] **GPU-02**: Day/night tint and filter values only update when change exceeds perceptible threshold (~0.005)
- [ ] **GPU-03**: Static layers (scenery, building exteriors) use cacheAsTexture for single-draw rendering
- [ ] **GPU-04**: Night glow layer alpha updates gated on nightIntensity change threshold

### I/O Pipeline

- [x] **IO-01**: readLastJsonlLine and readLastToolUse combined into single file open/read/parse pass
- [x] **IO-02**: discoverSessions converted from synchronous to async fs.promises (unblocks main process)
- [x] **IO-03**: UsageAggregator uses incremental offset-based JSONL parsing instead of full file re-read
- [x] **IO-04**: Poll interval backs off to 10-30s when no active sessions detected for consecutive cycles

### CPU Tick Loop

- [ ] **CPU-01**: Ambient particle subsystems throttled or skipped at idle FPS (5fps) and when invisible (dust at night, fireflies at day)
- [ ] **CPU-02**: Array.splice in particle removal loops replaced with swap-and-pop O(1) pattern
- [ ] **CPU-03**: Building highlight tint tracked incrementally on state transitions instead of recomputed every frame
- [ ] **CPU-04**: Per-agent tracking consolidated from 13+ separate Maps into single AgentTrackingState map
- [ ] **CPU-05**: Agent reparenting and setAnimation moved to state transition handlers instead of per-frame polling

### DOM / Memory

- [ ] **DOM-01**: Dashboard session list uses DOM diffing (update in place) instead of full innerHTML rebuild
- [ ] **DOM-02**: Per-tick temporary allocations eliminated (reusable arrays, Sets, filter matrix, tint tuple)
- [ ] **DOM-03**: Unused chokidar dependency removed from package.json

## v2.1 Requirements (Parked)

Carried from v2.1, pending soak test verification.

- **STAB-03**: Milestone passes an 8-hour soak test with less than 50MB total memory growth

## Future Requirements

### Observability

- **OBS-01**: Dashboard displays uptime counter and current memory usage
- **OBS-02**: Health heartbeat pings to detect frozen renderer

## Out of Scope

| Feature | Reason |
|---------|--------|
| PixiJS version upgrade | 8.16.0 already has needed APIs; upgrade risk not justified |
| Web Workers for parsing | Bottleneck is sync I/O blocking, not CPU; wrong solution |
| ParticleContainer | Only 54 particles; restrictions outweigh benefits at this scale |
| Worker threads for file I/O | Async fs.promises is sufficient; worker thread overhead not justified |
| Crash upload/telemetry service | Local-only app, no server infrastructure |
| Performance profiling UI | Dev tooling, not user-facing |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GPU-01 | Phase 27 | Pending |
| GPU-02 | Phase 27 | Pending |
| GPU-03 | Phase 27 | Pending |
| GPU-04 | Phase 27 | Pending |
| IO-01 | Phase 26 | Complete |
| IO-02 | Phase 26 | Complete |
| IO-03 | Phase 26 | Complete |
| IO-04 | Phase 26 | Complete |
| CPU-01 | Phase 28 | Pending |
| CPU-02 | Phase 28 | Pending |
| CPU-03 | Phase 28 | Pending |
| CPU-04 | Phase 29 | Pending |
| CPU-05 | Phase 28 | Pending |
| DOM-01 | Phase 28 | Pending |
| DOM-02 | Phase 28 | Pending |
| DOM-03 | Phase 28 | Pending |

**Coverage:**
- v2.2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation*

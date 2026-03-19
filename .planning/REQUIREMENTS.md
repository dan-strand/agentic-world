# Requirements: Agent World

**Defined:** 2026-03-19
**Core Value:** Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## v2.3 Requirements

Requirements for performance polish release. Each maps to roadmap phases.

### GPU Texture

- [x] **TEX-01**: Palette-swapped animation frames atlased into single GPU texture per agent (reduces GPU texture count from ~12-16 per agent to 1)
- [x] **TEX-02**: Night glow concentric circle Graphics replaced with pre-rendered radial gradient sprites (80 fills → 20 sprite draws)

### Tick Efficiency

- [x] **TICK-01**: Building smoke baseAlpha/maxSmoke/spawnInterval gated on nightIntensity threshold (same 0.005 pattern as glow guard)
- [x] **TICK-02**: Console.warn in visibility check throttled to once per second per agent
- [x] **TICK-03**: Spread operator in removeAgent replaced with for-of early-return loop

### I/O Cleanup

- [x] **IOCL-01**: Redundant statSync in UsageAggregator eliminated by passing lastModified from SessionDetector through SessionInfo
- [x] **IOCL-02**: Module-level sync constructors (HistoryStore.load, CrashLogger.checkPreviousCrash) deferred to after app.ready

### DOM Cleanup

- [x] **DOMCL-01**: escapeHtml caches a single reusable div element instead of creating one per call

## Future Requirements

### Observability

- **OBS-01**: Dashboard displays uptime counter and current memory usage
- **OBS-02**: Health heartbeat pings to detect frozen renderer

### Stability (Parked from v2.1)

- **STAB-03**: Milestone passes an 8-hour soak test with less than 50MB total memory growth

## Out of Scope

| Feature | Reason |
|---------|--------|
| SpeechBubble Graphics pre-caching | Event-driven, infrequent — not worth the complexity |
| Building banner Graphics caching | Event-driven, infrequent — fires only on tool name change |
| Set in assignStation | 3-element array, linear scan is faster than Set construction |
| LevelUpEffect sparkle pooling | Celebrations are rare (seconds apart at most) |
| repositionIdleAgents temp arrays | Runs every 3s, agent count is 1-8 |
| Window drag 60fps→30fps polling | Only during drag, imperceptible difference |
| ParticleContainer | Only 54 particles; restrictions outweigh benefits |
| PixiJS version upgrade | 8.16.0 has all needed APIs |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEX-01 | Phase 30 | Complete |
| TEX-02 | Phase 30 | Complete |
| TICK-01 | Phase 30 | Complete |
| TICK-02 | Phase 30 | Complete |
| TICK-03 | Phase 30 | Complete |
| DOMCL-01 | Phase 30 | Complete |
| IOCL-01 | Phase 31 | Complete |
| IOCL-02 | Phase 31 | Complete |

**Coverage:**
- v2.3 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*

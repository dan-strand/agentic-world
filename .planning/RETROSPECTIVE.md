# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.3 — Audio & Status Reliability

**Shipped:** 2026-02-27
**Phases:** 2 | **Plans:** 4 | **Tasks:** 8

### What Was Built
- Bulletproof status pipeline: system entry detection, stale session preservation, tool_use-aware status
- Dual-gate completion detection preventing false "job's done" celebrations
- Hardened renderer: cancelFadeOut full state reset, debounce reinitialization, visibility safeguard
- Per-session waiting reminder timers with 30s global throttle and active-cycle guard

### What Worked
- UAT-driven gap closure: Phase 11 UAT caught a real user-facing bug (false celebrations during tool execution), diagnosed it systematically, and fixed it with a targeted gap closure plan
- Status audit before audio: building audio features on a reliable status pipeline meant Phase 13 was straightforward
- Phase 12 removal: catching the design mismatch early (global vs per-session) saved execution time on unwanted work

### What Was Inefficient
- Phase 12 was planned, plan-created, and nearly executed before user clarified it was unwanted — discuss-phase or earlier questioning could have caught the preference mismatch
- Milestone audit ran twice (once before phases 12-13 were done, once after) — the first audit was premature

### Patterns Established
- JSONL content inspection: looking beyond entry type to message.content for finer-grained status
- Dual-gate completion: require both status transition AND entry type validation before triggering effects
- State machine interrupt pattern: fully reset all accumulated visual state when interrupting a terminal state
- Global sound throttle: single field shared across all reminder types prevents any two sounds within threshold

### Key Lessons
1. Discuss user preferences for audio/notification behavior before planning — "global vs per-session" is a UX decision, not a technical one
2. UAT is the most effective gap-finder: the false celebration bug was invisible in code review but obvious in real usage
3. Defense-in-depth pays off: the dual-gate completion fix (two independent checks) means both must fail for a false positive

### Cost Observations
- Model mix: 100% quality profile (opus for all agents)
- Sessions: ~4 in milestone
- Notable: All 4 plans executed in ~2 min each — reliability fixes are fast when the codebase is well-understood

---

## Milestone: v1.5 — Usage Dashboard

**Shipped:** 2026-03-01
**Phases:** 3 | **Plans:** 6 | **Tasks:** 12

### What Was Built
- Expanded window to 1024x1080 with flex column layout separating RPG world (768px) from dashboard (312px)
- Streaming JSONL parser with mtime-cached UsageAggregator for token usage extraction
- MODEL_PRICING table with 4-step resolution chain covering all Claude model families
- Live dashboard with compact session rows, click-to-expand token breakdowns, and ~$X.XX cost estimates
- Today's aggregate totals bar (In/Out/Cost/Saved/Sessions) updated every poll cycle
- HistoryStore with atomic JSON persistence, 30-day retention pruning, and 30-day summary display

### What Worked
- Parallel plan execution: Phase 17's two plans (layout + parser) ran simultaneously since they had no dependencies
- Research-first approach: Domain research before each phase caught key details (PixiJS resize bug #11427, Opus 4.6 pricing at $5/$25 not $15, 6 model name formats)
- Existing patterns reused: mtime caching from session-detector, IPC push from sessions-update, vanilla DOM from renderer — zero new patterns needed for core architecture
- Zero deviations: All 6 plans executed exactly as written with no rework

### What Was Inefficient
- JSONL data discovery required multiple attempts (Python not available, Node.js stdin issues on Windows, tilde expansion in paths) — could have gone straight to Node.js with absolute path
- gsd-tools commit command failed due to argument quoting — fell back to direct git commands

### Patterns Established
- HTML dashboard below PixiJS canvas with flex column layout (separate rendering domains)
- Streaming readline for JSONL parsing with mtime-based cache invalidation
- Atomic JSON file writes with Windows EPERM/EBUSY copyFile fallback
- Separate IPC channels per concern (sessions-update vs dashboard-update)
- Model pricing resolution chain: bare alias → exact → prefix → default fallback

### Key Lessons
1. Research catches pricing/API discrepancies before they become bugs — the $15 vs $5 Opus pricing would have been wrong in production
2. Parallel plan execution in Wave 1 saves significant time when plans touch different files
3. Windows file system quirks (EPERM on rename, no /dev/stdin, tilde expansion) need explicit handling — always test with absolute paths

### Cost Observations
- Model mix: 100% quality profile (opus for all agents)
- Sessions: ~6 in milestone (research + 3 plan + 3 execute)
- Notable: Average plan execution of ~2.7 min across 6 plans — well-scoped plans with clear file boundaries execute fast

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 MVP | 3 | 9 | Foundation — establish patterns |
| v1.1 RPG | 4 | 9 | Visual overhaul — atlas pipeline |
| v1.2 Activity | 3 | 4 | Feature additions — speech, labels, fade |
| v1.3 Reliability | 2 | 4 | Quality pass — audit, fix, harden |
| v1.4 Workspaces | 3 | 6 | Interior detail — buildings, stations, z-order |
| v1.5 Dashboard | 3 | 6 | New subsystem — HTML dashboard, JSONL parsing, cost estimation |

### Top Lessons (Verified Across Milestones)

1. Build features first, then do a reliability pass — v1.3 was fast because v1.0-v1.2 established the architecture
2. UAT catches bugs that code review misses — real usage reveals timing-dependent issues
3. User preference questions (UX choices) should happen before technical planning
4. Research-first catches data discrepancies before they become bugs — verified across v1.5 (pricing, model formats)
5. Parallel plan execution in wave-based scheduling saves significant time for independent work

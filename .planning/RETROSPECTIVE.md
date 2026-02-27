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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 MVP | 3 | 9 | Foundation — establish patterns |
| v1.1 RPG | 4 | 9 | Visual overhaul — atlas pipeline |
| v1.2 Activity | 3 | 4 | Feature additions — speech, labels, fade |
| v1.3 Reliability | 2 | 4 | Quality pass — audit, fix, harden |

### Top Lessons (Verified Across Milestones)

1. Build features first, then do a reliability pass — v1.3 was fast because v1.0-v1.2 established the architecture
2. UAT catches bugs that code review misses — real usage reveals timing-dependent issues
3. User preference questions (UX choices) should happen before technical planning

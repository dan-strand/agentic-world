---
phase: 24
slug: resource-leak-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) + existing test patterns |
| **Config file** | None — uses `npx tsx --test` directly |
| **Quick run command** | `npx tsx --test src/renderer/graphics-pool.test.ts` |
| **Full suite command** | `npx tsx --test src/main/*.test.ts src/renderer/*.test.ts` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run relevant test file
- **After every plan wave:** Run `npx tsx --test src/main/*.test.ts src/renderer/*.test.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | LEAK-01 | unit | `npx tsx --test src/renderer/graphics-pool.test.ts` | No — W0 | ⬜ pending |
| 24-01-02 | 01 | 1 | LEAK-02 | unit | `npx tsx --test src/renderer/palette-swap.test.ts` | No — W0 | ⬜ pending |
| 24-01-03 | 01 | 1 | LEAK-03 | unit | `npx tsx --test src/renderer/level-up-effect.test.ts` | No — W0 | ⬜ pending |
| 24-02-01 | 02 | 2 | LEAK-04 | unit | `npx tsx --test src/renderer/collection-pruning.test.ts` | No — W0 | ⬜ pending |
| 24-02-02 | 02 | 2 | STAB-01 | unit | `npx tsx --test src/renderer/day-night-cycle.test.ts` | No — W0 | ⬜ pending |
| 24-02-03 | 02 | 2 | STAB-02 | unit | `npx tsx --test src/main/jsonl-reader.test.ts` | Yes | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/renderer/graphics-pool.test.ts` — stubs for LEAK-01 (pool borrow/return/capacity)
- [ ] `src/renderer/palette-swap.test.ts` — stubs for LEAK-02 (cache cleanup, texture destruction)
- [ ] `src/renderer/level-up-effect.test.ts` — stubs for LEAK-03 (GlowFilter destroy)
- [ ] `src/renderer/collection-pruning.test.ts` — stubs for LEAK-04 (dismissedSessions, cache pruning)
- [ ] `src/renderer/day-night-cycle.test.ts` — stubs for STAB-01 (modulo wrap)

*Follow Phase 23 test patterns from `game-loop.test.ts` and `memory-monitor.test.ts`. PixiJS objects need mocking in Node.js context.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smoke particles use pool visually | LEAK-01 | Visual rendering in PixiJS canvas | Run app, verify smoke still renders correctly |
| Memory stays stable over time | ALL | Requires extended runtime | Check MemoryMonitor logs after 1+ hour run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

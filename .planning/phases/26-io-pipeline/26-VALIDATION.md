---
phase: 26
slug: io-pipeline
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-18
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (via `npx tsx --test`) |
| **Config file** | N/A (node:test built-in, tsx for TypeScript) |
| **Quick run command** | `npx tsx --test <changed-file.test.ts>` |
| **Full suite command** | `npx tsx --test src/main/*.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx --test <changed-file.test.ts>`
- **After every plan wave:** Run `npx tsx --test src/main/*.test.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | IO-01 | unit | `npx tsx --test src/main/jsonl-reader.test.ts` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | IO-02 | unit | `npx tsx --test src/main/session-detector.test.ts` | ❌ W0 | ⬜ pending |
| 26-02-01 | 02 | 2 | IO-03 | unit | `npx tsx --test src/main/jsonl-reader.test.ts src/main/usage-aggregator.test.ts` | ❌ W0 | ⬜ pending |
| 26-02-02 | 02 | 2 | IO-03 | unit | `npx tsx --test src/main/usage-aggregator.test.ts` | ❌ W0 | ⬜ pending |
| 26-03-01 | 03 | 3 | IO-04 | grep | `grep -n "MAX_POLL_INTERVAL_MS\|BACKOFF_STEP_MS" src/shared/constants.ts` | ✅ | ⬜ pending |
| 26-03-02 | 03 | 3 | IO-04 | unit | `npx tsx --test src/main/session-store.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/jsonl-reader.test.ts` — tests for combined readSessionTail + readUsageTotalsIncremental
- [ ] `src/main/session-detector.test.ts` — tests for async discoverSessions
- [ ] `src/main/usage-aggregator.test.ts` — tests for incremental parsing
- [ ] `src/main/session-store.test.ts` — tests for poll backoff

*Note: Test files are created by their respective TDD tasks within each plan.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IPC responsiveness during polling | IO-02 | Requires running Electron app with active sessions | Start app, run multiple sessions, verify no UI jank during poll cycles |
| Poll backoff observable behavior | IO-04 | Requires watching timer intervals over time | Start app with no sessions, observe poll frequency decreasing in logs |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 26
slug: io-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (via ts-jest, already configured) |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --testPathPattern="<changed-file>" --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="<changed-file>" --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | IO-01 | unit | `npx jest --testPathPattern="jsonl-reader" --no-coverage` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | IO-02 | unit | `npx jest --testPathPattern="session-detector" --no-coverage` | ❌ W0 | ⬜ pending |
| 26-02-01 | 02 | 1 | IO-03 | unit | `npx jest --testPathPattern="usage-aggregator" --no-coverage` | ❌ W0 | ⬜ pending |
| 26-02-02 | 02 | 1 | IO-04 | unit | `npx jest --testPathPattern="session-store" --no-coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/jsonl-reader.test.ts` — tests for combined readSessionTail
- [ ] `scripts/session-detector.test.ts` — tests for async discoverSessions
- [ ] `scripts/usage-aggregator.test.ts` — tests for incremental parsing
- [ ] `scripts/session-store.test.ts` — tests for poll backoff

*Note: Task IDs are preliminary — planner may adjust.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IPC responsiveness during polling | IO-02 | Requires running Electron app with active sessions | Start app, run multiple sessions, verify no UI jank during poll cycles |
| Poll backoff observable behavior | IO-04 | Requires watching timer intervals over time | Start app with no sessions, observe poll frequency decreasing in logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

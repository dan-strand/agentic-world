---
phase: 23
slug: crash-diagnosis-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | None — uses `node --test` directly |
| **Quick run command** | `npx tsx --test src/main/crash-logger.test.ts` |
| **Full suite command** | `npx tsx --test src/main/*.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx --test src/main/crash-logger.test.ts`
- **After every plan wave:** Run `npx tsx --test src/main/*.test.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | DIAG-01 | unit | `npx tsx --test src/main/crash-logger.test.ts` | No — W0 | ⬜ pending |
| 23-01-02 | 01 | 1 | DIAG-03 | unit | `npx tsx --test src/main/crash-logger.test.ts` | No — W0 | ⬜ pending |
| 23-01-03 | 01 | 1 | DIAG-02 | unit | `npx tsx --test src/renderer/game-loop.test.ts` | No — W0 | ⬜ pending |
| 23-01-04 | 01 | 1 | DIAG-04 | unit | `npx tsx --test src/renderer/memory-monitor.test.ts` | No — W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/crash-logger.test.ts` — stubs for DIAG-01, DIAG-03 (log file creation, format, rotation)
- [ ] `src/renderer/game-loop.test.ts` — stubs for DIAG-02 (error boundary rapid-repeat counter logic)
- [ ] `src/renderer/memory-monitor.test.ts` — stubs for DIAG-04 (sliding window, threshold detection)

*Follow existing test pattern from `jsonl-reader.test.ts` and `usage-aggregator.test.ts` using `os.tmpdir()` for temp files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Renderer crash logs to file | DIAG-01 | Requires Electron renderer process crash simulation | Trigger `webContents.forcefullyCrashRenderer()` in dev, verify log entry |
| Game loop continues after exception | DIAG-02 | Requires PixiJS Application ticker running | Inject throw into world.tick(), verify animation continues |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

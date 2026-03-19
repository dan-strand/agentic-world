---
phase: 27
slug: gpu-rendering
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-18
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (via `npx tsx --test`) |
| **Config file** | N/A (node:test built-in, tsx for TypeScript) |
| **Quick run command** | `npx tsx --test <changed-file.test.ts>` |
| **Full suite command** | `npx tsx --test src/renderer/*.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx --test <changed-file.test.ts>`
- **After every plan wave:** Run `npx tsx --test src/renderer/*.test.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | GPU-01, GPU-02 | unit + grep | `npx tsx --test src/renderer/day-night-cycle.test.ts` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | GPU-01 | grep | `grep -n "stageFilter\|ColorMatrixFilter" src/renderer/world.ts` | ✅ | ⬜ pending |
| 27-02-01 | 02 | 2 | GPU-03 | grep | `grep -n "cacheAsTexture" src/renderer/world.ts` | ✅ | ⬜ pending |
| 27-02-02 | 02 | 2 | GPU-04 | unit | `npx tsx --test src/renderer/night-glow-layer.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/renderer/day-night-cycle.test.ts` — tests for getTintHex, threshold gating
- [ ] `src/renderer/night-glow-layer.test.ts` — tests for threshold-gated alpha updates

*Note: Test files are created by their respective TDD tasks within each plan.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Day/night visual parity after filter removal | GPU-01 | Requires visual comparison of rendered scene | Take screenshots at dawn/day/dusk/night/midnight before and after migration; compare side-by-side |
| Static layer caching visual correctness | GPU-03 | Requires visual inspection that cached layers render correctly | Verify tilemap and scenery render identically after cacheAsTexture is applied |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

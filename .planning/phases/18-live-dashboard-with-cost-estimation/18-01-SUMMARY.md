---
phase: 18-live-dashboard-with-cost-estimation
plan: 01
subsystem: api
tags: [ipc, electron, pricing, cost-estimation, usage-tracking]

# Dependency graph
requires:
  - phase: 17-window-layout-and-parsing-infrastructure
    provides: "UsageAggregator, readUsageTotals, JSONL streaming parser, dashboard panel layout"
provides:
  - "MODEL_PRICING table with 10 Claude model entries"
  - "resolveModelPricing with bare name, exact, prefix, and fallback resolution"
  - "calculateCost and calculateCacheSavings functions"
  - "DashboardData, DashboardSession, TodayTotals types"
  - "dashboard-update IPC channel pushing cost-enriched data to renderer"
  - "onDashboardUpdate preload bridge method"
affects: [18-02, dashboard-ui, renderer]

# Tech tracking
tech-stack:
  added: []
  patterns: ["IPC push channel for dashboard data separate from sessions-update", "Cost enrichment via UsageAggregator.getUsageWithCost wrapping getUsage"]

key-files:
  created: []
  modified:
    - src/shared/constants.ts
    - src/shared/types.ts
    - src/main/usage-aggregator.ts
    - src/main/session-store.ts
    - src/main/session-detector.ts
    - src/main/index.ts
    - src/preload/preload.ts

key-decisions:
  - "Separate dashboard-update IPC channel from sessions-update to keep concerns isolated"
  - "filePath added to SessionInfo for main-process use (renderer ignores it)"
  - "Sonnet-rate fallback for unknown models with isEstimate flag"

patterns-established:
  - "Cost enrichment pattern: getUsageWithCost wraps getUsage + resolveModelPricing"
  - "Model resolution chain: bare alias -> exact match -> prefix match -> default fallback"

requirements-completed: [COST-01, COST-02, COST-03, COST-04, DASH-03, DASH-04]

# Metrics
duration: 3min
completed: 2026-03-01
---

# Phase 18 Plan 01: Main-Process Data Pipeline Summary

**Model pricing table with cost calculation, UsageAggregator cost enrichment, and dashboard-update IPC push to renderer via onDashboardUpdate bridge**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T18:58:11Z
- **Completed:** 2026-03-01T19:00:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- MODEL_PRICING table with 10 entries covering all Claude model families (Opus 4.6/4.5/4.1/4/3, Sonnet 4/3, Haiku 4/3.5/3)
- Cost enrichment pipeline: resolveModelPricing -> calculateCost/calculateCacheSavings -> getUsageWithCost
- SessionStore pushes DashboardData (per-session usage + todayTotals) via dashboard-update IPC every poll cycle
- Renderer can subscribe via window.agentWorld.onDashboardUpdate()

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pricing constants, cost functions, and DashboardData types** - `7b738d3` (feat)
2. **Task 2: Wire UsageAggregator into SessionStore with dashboard-update IPC** - `779843a` (feat)

## Files Created/Modified
- `src/shared/constants.ts` - MODEL_PRICING table, resolveModelPricing, calculateCost, calculateCacheSavings, getModelDisplayName
- `src/shared/types.ts` - DashboardSession, TodayTotals, DashboardData interfaces; DASHBOARD_UPDATE IPC channel; filePath on SessionInfo; onDashboardUpdate on IAgentWorldAPI
- `src/main/usage-aggregator.ts` - getUsageWithCost method returning cost-enriched token data
- `src/main/session-store.ts` - pushDashboardUpdate method; accepts UsageAggregator; async poll
- `src/main/session-detector.ts` - filePath field added to SessionInfo construction
- `src/main/index.ts` - UsageAggregator instantiation and injection into SessionStore
- `src/preload/preload.ts` - onDashboardUpdate callback exposed via contextBridge

## Decisions Made
- Separate dashboard-update IPC channel from sessions-update to keep concerns isolated -- dashboard data flows through its own channel
- filePath added to SessionInfo for main-process use -- simpler than maintaining a separate lookup map, renderer receives but ignores it
- Sonnet-rate fallback for unknown models with isEstimate: true flag -- conservative default that's neither cheapest nor most expensive

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DashboardData payload is fully formed and pushed to renderer every poll cycle
- Renderer can subscribe via window.agentWorld.onDashboardUpdate(callback)
- Ready for Plan 02 to build the dashboard UI that consumes this data

## Self-Check: PASSED

All 7 modified files verified present. Both task commits (7b738d3, 779843a) verified in git log.

---
*Phase: 18-live-dashboard-with-cost-estimation*
*Completed: 2026-03-01*

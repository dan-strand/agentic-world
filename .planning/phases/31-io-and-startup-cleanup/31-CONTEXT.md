# Phase 31: I/O and Startup Cleanup - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase eliminates a redundant statSync in UsageAggregator (by passing lastModified through SessionInfo) and defers module-level sync constructors to after app.ready.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase with well-defined targets from the performance audit.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- SessionInfo type in src/shared/types.ts already has lastModified field
- UsageAggregator already uses mtime-based cache (src/main/usage-aggregator.ts)
- SessionDetector already stats each file during discovery

### Established Patterns
- Async fs.promises used throughout session-detector.ts (v2.2 Phase 26)
- Module initialization pattern in src/main/index.ts

### Integration Points
- session-detector.ts → types.ts (SessionInfo interface)
- usage-aggregator.ts → reads SessionInfo.lastModified
- index.ts → HistoryStore constructor, CrashLogger.checkPreviousCrash

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 31-io-and-startup-cleanup*
*Context gathered: 2026-03-19 via autonomous smart discuss (infrastructure skip)*

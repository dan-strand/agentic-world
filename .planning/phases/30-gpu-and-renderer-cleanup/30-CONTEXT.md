# Phase 30: GPU and Renderer Cleanup - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase addresses remaining LOW-priority renderer optimizations: consolidating GPU textures per agent, replacing Graphics-based glow with gradient sprites, gating smoke on night threshold, throttling warnings, eliminating spread allocations, and caching DOM helper elements.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase with well-defined targets from the performance audit.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `swapRemove` helper pattern already in ambient-particles.ts and building.ts (v2.2 Phase 28)
- Night intensity threshold guard pattern at 0.005 already in world.ts (v2.2 Phase 27)
- Palette swap cache in palette-swap.ts with `swapCache: Map<string, Texture[]>`

### Established Patterns
- Threshold guards: `Math.abs(current - last) >= 0.005` pattern from night glow
- Object reuse: class-level fields with `.length = 0` or `.clear()` reset (v2.2 Phase 28)
- TDD: write failing tests first, then implement

### Integration Points
- palette-swap.ts createSwappedTextures() — current per-frame texture creation
- night-glow-layer.ts createNightGlowLayer() — current concentric circle Graphics
- building.ts tick() — smoke parameter calculations
- world.ts tick() — visibility console.warn, removeAgent spread
- dashboard-panel.ts — escapeHtml utility

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

*Phase: 30-gpu-and-renderer-cleanup*
*Context gathered: 2026-03-19 via autonomous smart discuss (infrastructure skip)*

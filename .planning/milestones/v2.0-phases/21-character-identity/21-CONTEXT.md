# Phase 21: Character Identity - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Make every agent visually distinct and identifiable at a glance. Each session gets a unique color palette, class-themed gear/accessories, a fantasy name displayed above, and class-specific animations including celebrate. No new agent states or behaviors — purely visual identity enhancements.

</domain>

<decisions>
## Implementation Decisions

### Color & Visual Identity
- Palette swap per agent — different pixel colors for character regions, not just a flat tint overlay
- Deterministic from session hash — same session always produces the same palette
- Status effects (breathing alpha, error shake, tint shifts) still overlay on top of the base palette
- Large enough pool (~20-30 palettes) so duplicates are rare but collisions possible

### Claude's Discretion: Color Regions
- Claude picks which character regions get palette colors (e.g., body/robe, hair, accent) — optimize for readability at 32x32

### Gear & Accessories
- Class-themed gear pool — each class has 3-4 gear options specific to its theme (mage: pointy hat/circlet/hood, warrior: helmet/horned helm/crown, etc.)
- Deterministic from session hash — same session always wears the same gear
- Claude decides implementation approach (baked atlas variants vs overlay sprites vs hybrid) based on what works best for 32x32 pngjs-generated sprites
- Claude decides piece count per agent — balance readability vs visual variety at 32x32 scale

### Name Display
- Procedural fantasy names (e.g., "Eldric", "Thessa", "Kael") — sounds like RPG characters
- Always visible above the agent character — no hover/proximity trigger
- Deterministic from session hash — same session is always "Eldric"
- Claude picks label style (simple text with shadow, RPG nameplate, etc.) to fit the pixel art world

### Animation Variety
- Class-specific celebrate animation — mage raises staff with magic, warrior pumps fist, ranger salutes, rogue flips dagger — plays alongside the existing LevelUpEffect golden column
- No concern about atlas size growth — visual payoff is worth it
- Claude decides how distinct class poses should be for idle/walk/work at 32x32 with 4-frame animations
- Claude decides whether idle fidget animations are worth the atlas complexity

</decisions>

<specifics>
## Specific Ideas

- Identity should be stable — the user wants to recognize "the blue mage with the pointy hat" and know that's their project X session
- Everything deterministic from session hash: palette, gear, name, class — same session always looks and is named the same
- Celebrate needs its own sprite animation now (not just the effect) — class-specific celebration poses

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentFactory` + `getAgentSlot()`: Already maps sessionId → deterministic identity (colorIndex, characterClass). Extend with palette index and gear index.
- `generate-characters.js`: pngjs generator for 128x384 atlas (4 classes × 3 states × 4 frames). Needs expansion for celebrate state and potentially palette variants or gear overlays.
- `agent-sprites.ts`: Resolves `{class}_{state}` keys to texture arrays. Needs celebrate state support.
- `hashSessionId()`: Deterministic hash function already used for slot assignment — reuse for name/gear/palette selection.

### Established Patterns
- Atlas-first pipeline: pngjs generates PNG + JSON descriptor, asset-loader loads with Promise.all
- AnimatedSprite for character rendering — texture swap on state change
- Status visual effects (tint crossfade, breathing, shake) in Agent class — palette system must coexist
- 1.5x scale inside buildings, 1x outside — names/gear must work at both scales

### Integration Points
- `Agent` class: Add name label (PixiJS Text or BitmapText child), celebrate animation state, palette/gear visual components
- `agent-sprites.ts`: Add `celebrate` to AnimState type, expand animation key resolution
- `generate-characters.js`: Expand atlas with celebrate frames, potentially palette variant rows or gear overlay sprites
- `constants.ts`: Add fantasy name pool, gear definitions per class, palette definitions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-character-identity*
*Context gathered: 2026-03-03*

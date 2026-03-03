# Phase 22: Day/Night Cycle & Atmosphere - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a day/night lighting cycle and enhanced atmospheric particle effects to the world. The world should smoothly transition between warm daylight and cool blue nighttime over roughly 10 minutes. At night, existing lighting fixtures (lanterns, torches, windows, campfire) should glow visibly. Additional particle effects beyond the current fireflies should enhance atmosphere (sparks, dust motes, drifting leaves). The campfire glow and smoke should intensify at night.

No new game mechanics, agent behaviors, or world layout changes -- purely visual/atmospheric enhancements.

</domain>

<decisions>
## Implementation Decisions

### Day/Night Cycle Timing
- ~10 minute full cycle (configurable via constant)
- Smooth continuous transitions, not abrupt switches
- Time progresses independently of session activity (always running)

### Lighting Approach
- Use PixiJS ColorMatrixFilter on app.stage for global color temperature shift (currently a warm tint filter already exists at `0xFFE8C0`)
- Replace the static warm filter with a dynamic one that shifts between warm daylight and cool blue night
- Keep transitions smooth using sine-wave or similar easing for natural feel

### Night Glow Sources
- Lanterns and torches (from scenery-layer.ts) should emit visible glow at night
- Building windows (glowing window art from Phase 20 BLDG-03) should brighten at night
- Campfire sprite should have enhanced glow at night
- Implementation approach: Additive blend glow sprites or GlowFilter on light source positions

### Color Temperature
- Daytime: Warm golden tone (current `0xFFE8C0` or similar)
- Nighttime: Cool blue tone (e.g., `0x6688CC` or `0x4466AA`)
- Dawn/dusk: Brief intermediate transitions

### Enhanced Particles
- Sparks near forge/Training Grounds building (small orange particles rising)
- Dust motes in sunlight (visible during daytime, fade at night)
- Drifting leaves (slow horizontal drift with gentle bob, seasonal feel)
- These supplement existing fireflies, not replace them

### Campfire Intensification
- Campfire smoke particles increase in count and opacity at night
- Campfire sprite glow radius/intensity increases at night
- Visible difference between day and night campfire appearance

### Claude's Discretion
- Exact color values for day/night transitions
- Glow sprite sizes and intensities for light sources
- Particle counts and behaviors for sparks, dust, leaves
- Whether to use GlowFilter vs additive blend sprites for light sources
- How to technically implement window brightening at night

</decisions>

<specifics>
## Specific Ideas

- The day/night cycle should feel natural -- gradual transitions like real lighting, not a sudden toggle
- Light sources becoming visible at night is the key visual payoff -- the world should feel cozy and lit up
- The existing warm ColorMatrixFilter on app.stage is the natural hook for the global lighting shift
- Campfire is the heart of the world -- its nighttime glow should be the most prominent light source
- Fireflies should feel more visible at night (maybe increase their alpha range when dark)
- The game loop already has an adaptive tick rate -- the day/night cycle should work at both 5fps idle and 30fps active

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `world.ts`: Scene hierarchy with stage -> tilemap -> buildings -> scenery -> ambientParticles -> agents. Stage has a `ColorMatrixFilter` for warm tint.
- `ambient-particles.ts`: 25 firefly particles with drift, bob, and alpha cycling. Good pattern for new particle types.
- `scenery-layer.ts`: Places lanterns at 6 positions and torches at 8 positions (2 per building entrance). These are the night glow sources.
- `building.ts`: Has chimney smoke particle system with spawn timer, lifetime, fade. Also has `CHIMNEY_POSITIONS` per building.
- `game-loop.ts`: Adaptive frame rate (30fps active, 5fps idle). Day/night must tick at both rates.
- `constants.ts`: All tuning values centralized here. Day/night constants should follow this pattern.

### Established Patterns
- Particle systems: `AmbientParticles` (fireflies) and building smoke both use Graphics objects with tick(deltaMs) pattern
- Scene hierarchy: New visual layers added as children of app.stage at specific z-order positions
- Constants-driven: All tuning values in shared/constants.ts for easy adjustment
- Container-based: Visual groups organized as PixiJS Containers

### Integration Points
- `world.ts init()`: Replace static ColorMatrixFilter with dynamic day/night-aware filter
- `world.ts tick()`: Call day/night cycle update each frame
- `scenery-layer.ts`: Need positions of lanterns/torches for night glow placement
- `ambient-particles.ts`: Potentially modulate firefly intensity based on time-of-day
- `building.ts tick()`: Modulate chimney smoke intensity based on time-of-day
- `constants.ts`: Add day/night cycle timing constants, color values, particle parameters

### Key Positions (from scenery-layer.ts)
Lantern positions:
- (482, 354), (542, 354), (482, 414), (542, 414) -- path intersections
- (512, 300), (512, 468) -- center cross paths

Torch positions (2 per building entrance, 8 total):
- Near each building at entranceY = bPos.y + BUILDING_HEIGHT/2 + 12, offset +/- 16 from bPos.x

Campfire: (512, 384)

</code_context>

<deferred>
## Deferred Ideas

None -- scope is well-bounded to lighting cycle and particles.

</deferred>

---

*Phase: 22-day-night-cycle-atmosphere*
*Context gathered: 2026-03-03*

# Project Research Summary

**Project:** Agent World v1.1 — Fantasy RPG Aesthetic Overhaul
**Domain:** Animated 2D pixel-art desktop process visualizer (Electron + PixiJS 8, Windows)
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

Agent World v1.1 is a focused aesthetic overhaul of a fully working v1.0 system — not a rewrite. The core Electron + PixiJS 8 + TypeScript architecture remains intact; the work is replacing code-drawn `Graphics` primitives with real sprite-sheet art, swapping the flat-color background for a `@pixi/tilemap` tilemap, replacing dynamic project compounds with four fixed-position fantasy quest zones, and upgrading the celebration effect from Fireworks to a golden light column. This scope is well-defined, all required libraries are confirmed PixiJS 8 compatible, and the build order follows clear layer-by-layer dependencies. The single most consequential upstream decision is committing to an atlas-first asset pipeline from day one — every critical pitfall around VRAM, scale mode, and particle rendering flows from whether assets are packed into atlases or loaded as individual files.

The recommended stack adds exactly two new npm packages: `@pixi/tilemap@^5.0.2` (tilemap rendering, confirmed PixiJS 8.16.0 compatible) and optionally `pixi-filters@^6.1.5` (GlowFilter for the level-up celebration only). All other v1.1 features — sprite animation, ambient lighting, particle effects — are implemented with PixiJS 8 built-in APIs. Two commonly attempted libraries are confirmed incompatible with PixiJS 8: `pixi-lights` (last release July 2023, targets v7) and `@pixi/particle-emitter` (GitHub issue #211 open since March 2024, no v8 support). Using either would cause integration failures. Assets should be exclusively CC0-licensed (Kenney.nl, OpenGameArt CC0 packs) and packed with Free Texture Packer before integration.

The key risk is not technical — it is asset visual cohesion and the ordering of rendering setup. All sprite assets must be sourced and packed into atlases before any code integration begins, because the `TextureStyle.defaultOptions.scaleMode = 'nearest'` call must be placed before the first `Assets.load()`, and the VRAM behavior (known PixiJS 8 regression, issue #11331) is undetectable if you only load a few test textures with individual files. The eight-phase build order defined in ARCHITECTURE.md (assets first, tilemap second, buildings third, agent sprites fourth, cleanup fifth, effects sixth, world simplification seventh, polish last) is the correct approach and should be followed without reordering. Each phase produces a runnable, testable app state.

## Key Findings

### Recommended Stack

The validated v1.0 stack (Electron 40.6.1, PixiJS 8.16.0, TypeScript 5.7, Webpack/Electron Forge) is unchanged. V1.1 adds minimal new dependencies, relying on PixiJS 8 built-in APIs for the majority of new features. See `STACK.md` for full code patterns and alternatives considered.

**Core technologies:**
- **Electron 40.6.1**: Desktop shell — `titleBarStyle: 'hidden'` with `titleBarOverlay` for native Windows controls; `resizable: false` plus `min/maxWidth/Height` for reliable fixed-size window at 1024x768
- **PixiJS 8.16.0**: Rendering engine — `AnimatedSprite` (sprite sheet animation), `ParticleContainer` + `Particle` (level-up effects), `FillGradient` + ADD blend mode (ambient lighting), all built-in; no separate packages needed for these features
- **@pixi/tilemap ^5.0.2**: Tilemap rendering — `CompositeTilemap` batches ~768 grass/dirt tiles into a single draw call; the only new required npm package for this milestone
- **pixi-filters ^6.1.5**: GlowFilter for level-up column (optional; add only if celebration glow is required); confirmed PixiJS 8 compatible via official GitHub compatibility table
- **Free Texture Packer** (free-tex-packer.com): Asset pipeline tool for packing CC0 sprites into PixiJS JSON atlases; no npm install needed

**What NOT to use:**
- `pixi-lights`: PixiJS 7 only (v4.1.0, July 2023). No v8 path. Use native `FillGradient` radial gradients with ADD blend mode instead.
- `@pixi/particle-emitter`: No PixiJS 8 support as of February 2026 (GitHub issue #211, open since March 2024). Use native `ParticleContainer` + `Particle`.
- `@barvynkoa/particle-emitter`: Unofficial unmaintained community fork. Same verdict as above.
- `pixi-tilemap` (old package name): Incompatible with PixiJS 8. Must use `@pixi/tilemap`.

### Expected Features

V1.1 is not adding new functional features to the Claude Code session monitoring system — it is replacing the visual layer. Session detection, IPC pipeline, agent FSM, and status display are all unchanged. See `FEATURES.md` for the full v1.0 feature analysis.

**Must have (table stakes for v1.1 milestone):**
- Real sprite-sheet characters replacing code-drawn `Graphics` agents — the visual identity of the product
- Grass/dirt tilemap ground replacing the solid-color background — world feel instead of dashboard feel
- Four fixed themed quest zone buildings (Wizard Tower, Training Grounds, Ancient Library, Tavern) replacing dynamic project compounds
- Guild Hall building sprite replacing the Graphics-drawn spy HQ
- Golden light column celebration replacing the Fireworks particle explosion

**Should have (quality threshold):**
- At least 2-3 grass tile variants for visual texture (no wallpaper tiling)
- Walk animation speed tied to movement speed (no character sliding)
- Status tint system verified working with sprite art (critical regression risk from v1.0)
- Agents rendered at 2x or 3x integer scale (32x32 source at 64-96px display size for visibility)

**Defer (post-v1.1):**
- Ambient particle effects (fireflies, dust) — architecture supports it, Phase 8 item if time allows
- Quest zone "active" glow aura when agent is present — Phase 8 polish
- Day/night ambient cycle — v2+ feature from original FEATURES.md

**Anti-features (confirmed out of scope — do not build):**
- Click-to-interact with sessions
- Audio/sound effects
- 3D graphics
- Token/cost tracking overlay
- Session control (start/stop/restart)
- Plugin/extension system
- Web-hosted or remote access

### Architecture Approach

V1.1 is a renderer-only change. `src/main/`, `src/preload/`, and the IPC boundary (SessionInfo, SessionStatus, ActivityType interfaces) are all unchanged. All work is in `src/renderer/`. The existing 7-state Agent FSM is preserved; only state names change (`driving_to_compound` → `walking_to_zone`, `driving_to_hq` → `walking_to_guild`) and the visual rendering layer changes (GraphicsContext frame-swapping → AnimatedSprite). See `ARCHITECTURE.md` for the complete file-by-file migration map.

**Scene hierarchy change (the core structural shift):**
```
Before: backgroundContainer → roadsContainer → hq → compoundsContainer → agentsContainer
After:  tilemapLayer → buildingsLayer → agentsLayer → particlesLayer → uiLayer
```

**Major components:**

1. **asset-loader.ts (new)** — Centralizes `Assets.load()` for all four sprite atlases (characters, buildings, tiles, particles) before game starts; all other modules receive textures from cache synchronously after this runs
2. **tilemap-builder.ts (new)** — Generates `CompositeTilemap` once at `World.init()` with grass field, seeded random variants, and Bresenham dirt paths from Guild Hall to each quest zone; static after creation
3. **sprite-loader.ts (new, replaces agent-sprites.ts)** — Extracts LPC-format texture arrays per direction and state from character atlas; provides `AnimatedSprite`-ready arrays keyed by `(colorIndex, state, direction)`
4. **quest-zone.ts (new, replaces compound.ts)** — Four fixed-position themed building sprites; positions hardcoded in `constants.ts` for fixed 1024x768 window; same `getEntrancePosition()` / `getSubLocationPosition()` API as Compound
5. **guild-hall.ts (new, replaces hq.ts)** — Guild Hall building sprite with identical `getIdlePosition()` API
6. **level-up-effect.ts (new, replaces fireworks.ts)** — Golden light column + sparkle shower via `ParticleContainer`; same 2500ms duration lifecycle as Fireworks
7. **agent.ts (significant modification)** — `bodyGfx`/`accessoryGfx` → `sprite: AnimatedSprite`; Vehicle import removed; container hierarchy preserved for tint inheritance
8. **world.ts (significant modification)** — `manageCompounds()` / `recalculateCompoundPositions()` replaced by `initQuestZones()` / `routeAgentToQuestZone()`; `resize()` removed; `particlesLayer` added

**Files deleted in this milestone:** `vehicle.ts`, `fireworks.ts`, `agent-sprites.ts`, `compound.ts`, `hq.ts`, `compound-layout.ts`

**Key routing simplification:** Dynamic compound lifecycle (does a compound exist for this project?) is replaced by fixed zone routing (every `activityType` always has a corresponding quest zone). Simpler, no edge cases.

### Critical Pitfalls

1. **TextureStyle.defaultOptions.scaleMode must be set before any Assets.load call** — Set `TextureStyle.defaultOptions.scaleMode = 'nearest'` as the very first line after PixiJS import, before `Application.init()` or any `Assets.load()`. Setting it after any texture loads silently has no effect on those textures, producing blurry pixel art that is hard to diagnose because it may appear correct for some textures and not others.

2. **VRAM explosion from per-frame individual texture loading** — PixiJS 8 has a known regression (issue #11331) where loading sprites as individual files causes VRAM up to 28x higher than expected. Commit to atlas-first loading from Phase 1: all frames packed into atlases, all loading through `Assets.load([atlas.json, ...])`, never through per-frame `Texture.from()` calls. Validate with GPU memory in Chrome DevTools after loading all assets — target under 50MB.

3. **AnimatedSprite.destroy() texture leak on older PixiJS 8 releases** — `AnimatedSprite.destroy()` in some v8 versions does not destroy its frame textures (issue #11407, fixed in PR #11544). Always use `sprite.destroy({ texture: true, textureSource: false })` — destroys the texture slice but not the shared atlas source. Wrap in a `destroyAnimatedSprite()` helper used everywhere. Validate by cycling 10 agents through creation/destruction and confirming GPU memory returns to baseline.

4. **Tint system breaks if sprite hierarchy is restructured** — The existing `Container.tint` status color system (active/waiting/idle/error) works through parent-chain tint inheritance. If `AnimatedSprite` is moved to a separate top-level layer instead of remaining a child of the Agent Container, tint inheritance silently breaks and all agents show the wrong status color. Keep the sprite as a child of the Agent Container (not a sibling on a separate sprites layer). Test all four status states explicitly after sprite replacement.

5. **Electron DPI scaling causes PixiJS dimension mismatch on Windows** — At 125%-175% display scaling (common on Windows laptops), `BrowserWindow` dimensions may be in physical vs. logical pixels, causing scene clipping or black borders. Use `resolution: window.devicePixelRatio` in PixiJS init, set `minWidth/minHeight/maxWidth/maxHeight` equal to target size (more reliable than `resizable: false` alone on Windows), and test at 100%, 125%, and 150% DPI before declaring rendering complete.

6. **@pixi/tilemap requires version lock and renderGroup notification after mutation** — Install as `npm install @pixi/tilemap@^5.0.2` (not unpinned, not the old `pixi-tilemap` package name). After any `tilemap.clean()` call, `app.stage.renderGroup.onChildUpdate(tilemap)` must be called or tiles will not appear (WebGL GL_INVALID_OPERATION error). Since the tilemap is static in v1.1, wrap all tilemap mutation in a helper that includes this notification call.

7. **ParticleContainer requires all particles to share one TextureSource** — All particles in a `ParticleContainer` must reference textures from the same atlas PNG. If the level-up effect uses textures from two different source files, only one particle type renders. Design the effects atlas in Phase 1 to include all particle frame types (column slice, sparkle, glow dot) in a single PNG.

8. **Visual style clash from mixing incompatible pixel art packs** — Characters, tiles, and buildings from different artists will clash visually (different outline weights, color counts, shading directions) even at the same 32x32 pixel grid size. Commit to a single source pack family (LPC characters on OpenGameArt, Kenney fantasy tilesets) and verify visual compatibility before integration. Use only CC0-licensed packs — GPL packs carry share-alike obligations that are legally ambiguous for shipped software.

## Implications for Roadmap

The ARCHITECTURE.md build order is grounded in dependency analysis, tested against phase deliverables, and should be adopted directly as the phase structure. Each phase produces a runnable app. Reordering breaks the dependency chain: assets must exist before anything renders; tilemap must exist before buildings are placed on top; buildings must exist before agent navigation targets are defined.

### Phase 1: Asset Pipeline and Foundation

**Rationale:** Every subsequent phase depends on assets being available and correctly configured. The most dangerous pitfalls (scale mode timing, VRAM, DPI, tilemap version, backgroundThrottling architecture) are all Phase 1 concerns. Getting the foundation wrong cascades through all later phases at increasing cost.

**Delivers:** All four sprite atlases loading correctly in Electron DevTools, `TextureStyle.defaultOptions.scaleMode = 'nearest'` confirmed before any load call, DPI validated at 125%+ on actual hardware, Electron window config locked (`titleBarStyle: 'hidden'` + `titleBarOverlay`), `asset-loader.ts` written and tested, asset license audit complete (`ASSET_CREDITS.md`), state polling loop confirmed independent from render loop.

**Addresses:** Table-stakes sprite art sourcing, visual identity foundation, Electron window fixed-size configuration

**Avoids:** Blurry sprites (Pitfall 1 — scale mode config), VRAM explosion (Pitfall 2 — atlas-first commitment), DPI mismatch on Windows (Pitfall 9), GPL license exposure (Pitfall 8), visual style clash (Pitfall 7), backgroundThrottling/minimize loop coupling (Pitfall 10)

**Research flag:** STANDARD — all patterns documented with code examples in STACK.md and ARCHITECTURE.md. No additional research needed.

### Phase 2: Tilemap Ground Layer

**Rationale:** The background tilemap must exist before buildings are positioned on top of it. This phase confirms `@pixi/tilemap` integration works before any other rendering changes compound the complexity.

**Delivers:** `tilemap-builder.ts`, grass field with seeded random variants (minimum 2-3 types), dirt paths from Guild Hall to four zone quadrant positions, existing `drawGround()` and `drawRoads()` removed from `world.ts`. App shows the tilemap world instead of a solid-color background.

**Uses:** `@pixi/tilemap@^5.0.2`, `CompositeTilemap`, hardcoded zone positions from `constants.ts`, Bresenham line path generation

**Avoids:** Tilemap renderGroup notification omission (Pitfall 4), pixi-tilemap wrong package name (Pitfall 5), wallpaper grass tiling (UX pitfall)

**Research flag:** STANDARD — tilemap pattern fully documented with code in STACK.md.

### Phase 3: Guild Hall and Quest Zone Buildings

**Rationale:** Buildings define the landmark positions that agent navigation targets. Agent movement cannot be correctly tested until destination coordinates come from `QuestZone.getEntrancePosition()` calls against real building positions.

**Delivers:** `guild-hall.ts`, `quest-zone.ts` with all four themed zones (Wizard Tower, Training Grounds, Ancient Library, Tavern), `World.initQuestZones()` replacing `manageCompounds()`, positions finalized in `constants.ts`. App shows all buildings at correct positions on the tilemap.

**Implements:** Fixed-layout quest zone architecture pattern; eliminates dynamic compound lifecycle from `world.ts`

**Avoids:** Re-implementing dynamic compound layout for quest zones (architecture anti-pattern — quest zones are map features, not per-project allocations)

**Research flag:** STANDARD — building sprite integration is straightforward. Positions are hardcoded constants for the fixed 1024x768 window.

### Phase 4: Agent Sprite Replacement

**Rationale:** Agent visual swap is the highest-risk code change because it must preserve the FSM, status tint system, and movement math while replacing the entire rendering layer. Isolating it in its own phase enables clean rollback if needed and clear attribution in git history.

**Delivers:** `sprite-loader.ts`, `Agent` class updated with `sprite: AnimatedSprite`, walk/idle/work animation states per LPC format (64x64 frames, 8 walk frames per direction), agents navigating between Guild Hall and quest zones with walking animation. Vehicle references removed from Agent class (but `vehicle.ts` file deletion is Phase 5).

**Implements:** LPC spritesheet frame extraction (compute texture sub-rects from known grid layout); AnimatedSprite as leaf node within Agent Container (not as parent with children — PixiJS 8 breaking change)

**Avoids:** AnimatedSprite texture leak (Pitfall 3 — write `destroyAnimatedSprite()` helper before any agent creation), tint system breakage (Pitfall 6 — test all four status states before declaring phase complete), AnimatedSprite-with-children mistake (Anti-Pattern 3 from ARCHITECTURE.md)

**Research flag:** STANDARD — migration path fully documented in ARCHITECTURE.md with before/after code. One empirical validation needed: verify the downloaded LPC spritesheet matches the documented row/column layout before writing `sprite-loader.ts`.

### Phase 5: Vehicle System Removal

**Rationale:** Clean deletion of dead code after Phase 4 confirms sprite replacement works correctly. Separating deletion from replacement makes Phase 4 rollback cleaner and produces a clear, reviewable diff for the vehicle removal.

**Delivers:** `vehicle.ts` deleted, all vehicle imports removed from `agent.ts`, state machine renamed to 6-state FSM (`walking_to_zone` / `walking_to_guild` instead of `driving_to_compound` / `driving_to_hq`), `AgentSlot` type updated (`vehicleType` removed, `characterClass` added), `AGENT_DRIVE_SPEED` constant removed.

**Avoids:** Dead code confusion in FSM state handling (Anti-Pattern 5 from ARCHITECTURE.md)

**Research flag:** STANDARD — straightforward deletion with no new patterns or libraries.

### Phase 6: Level-Up Celebration Effect

**Rationale:** Self-contained visual feature with no upstream dependencies beyond the agent system working. Replacing Fireworks with the golden light column is the last new visual component.

**Delivers:** `level-up-effect.ts` using `ParticleContainer` (native PixiJS 8), golden column + sparkle shower effect, `Agent.startCelebration()` using `LevelUpEffect` instead of `Fireworks`, `particlesLayer` added to World scene hierarchy above agents layer.

**Uses:** Native PixiJS 8 `ParticleContainer` + `Particle` (NOT `@pixi/particle-emitter` — incompatible with PixiJS 8), optionally `pixi-filters` GlowFilter for the halo effect

**Avoids:** ParticleContainer TextureSource mismatch (Pitfall 11 — all particle textures must be in the same atlas PNG, designed in Phase 1), `boundsArea` omission on ParticleContainer (performance trap), using `@pixi/particle-emitter`

**Research flag:** STANDARD — ParticleContainer v8 API documented with working code examples in STACK.md and ARCHITECTURE.md.

### Phase 7: World Simplification

**Rationale:** Architectural cleanup that is safe only after all prior phases are verified working. Removing the dynamic compound lifecycle from `world.ts` is a refactor enabled by the fixed quest zones already in place from Phase 3.

**Delivers:** `manageCompounds()`, `recalculateCompoundPositions()`, `CompoundEntry` interface, `compounds` Map, and `resize()` all removed from `world.ts`. Agent routing uses simplified `agentZoneAssignment: Map<string, ActivityType>`. Session-to-zone routing verified end-to-end with real Claude Code sessions. `compound-layout.ts` file deleted.

**Avoids:** Stale compound lifecycle code persisting as dead branches; `resize()` method that is meaningless on a fixed-size window

**Research flag:** STANDARD — cleanup follows naturally from Phase 3 architectural decisions. No new patterns.

### Phase 8: Polish and Ambient Effects (Conditional)

**Rationale:** Ambient visual polish that is purely additive — no architecture changes. Only pursue if Phase 7 is complete and milestone scope allows. All patterns are documented; this phase has no research dependency.

**Delivers (if pursued):** Ambient particle effect (floating fireflies or magical dust motes), quest zone "active" aura sprite when an agent is present, optional `ColorMatrixFilter` for warm color tone on the whole scene, final DPI and frame-rate verification, end-to-end test with real Claude Code sessions at 30fps and 5fps adaptive rates.

**Research flag:** LOW PRIORITY — defer if milestone scope is tight. No blocking decisions required.

### Phase Ordering Rationale

- **Assets before everything**: Scale mode config, VRAM behavior, and atlas structure problems are cheapest to discover in Phase 1. A texture atlas format mismatch discovered in Phase 4 requires retroactive changes to every module that loaded textures.
- **Tilemap before buildings**: Z-order dependency — the ground layer must exist before buildings are placed on top of it.
- **Buildings before agents**: Agents navigate to building positions. Without `questZone.getEntrancePosition()` returning real coordinates, agent movement targets are undefined.
- **Sprite replacement before cleanup**: Confirm the AnimatedSprite system works before deleting the vehicle system that previously coexisted with agents. Clean rollback path if Phase 4 hits an unexpected issue.
- **Effects after agents**: The celebration effect fires from an Agent; the agent system must be complete and verified first.
- **World simplification before polish**: World.ts refactor is a behavior change and should be verified with real sessions before adding cosmetic layers.

### Research Flags

No phase requires `/gsd:research-phase` during planning. All patterns are documented with working code examples in STACK.md and ARCHITECTURE.md. The two major dead ends (pixi-lights, @pixi/particle-emitter) are identified and their alternatives are specified.

Empirical validation needed during execution (not research, but testing gates):

- **Phase 1**: DPI behavior at 125%+ must be tested on actual Windows hardware. VRAM after loading all four atlases must be measured in Chrome DevTools (target: under 50MB).
- **Phase 4**: Verify downloaded LPC spritesheet frame layout matches the documented 64x64 grid (row 2 = walk, 9 columns, 4 directions) before writing `sprite-loader.ts`.
- **Phase 4**: AnimatedSprite destroy memory baseline — cycle 10 agents through creation/destruction and confirm GPU memory returns to baseline.
- **Phase 6**: Confirm the effects atlas (designed in Phase 1) has all particle frame types needed for the level-up effect before starting ParticleContainer implementation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions confirmed via official GitHub releases and npm. Two incompatible libraries (pixi-lights, @pixi/particle-emitter) confirmed dead via GitHub issues with open dates and maintainer non-response. PixiJS 8 built-in APIs confirmed via official documentation. @pixi/tilemap v5.0.2 confirmed compatible with PixiJS 8.16.0 via GitHub release notes (released July 2025). |
| Features | MEDIUM-HIGH | V1.1 feature scope is clearly defined (aesthetic overhaul — replace Graphics with sprites). Functional feature set (session detection, status display) is unchanged from validated v1.0 baseline. Main uncertainty is exact building sprite availability in consistent CC0 packs — requires art curation, not research. |
| Architecture | HIGH | Comprehensive file-by-file migration plan grounded in direct analysis of the existing codebase. Build order tested against dependency graph. Anti-patterns identified with specific PixiJS 8 breaking changes (AnimatedSprite leaf node constraint, tint inheritance behavior). All new module APIs defined with signatures. |
| Pitfalls | HIGH | All critical pitfalls sourced from official PixiJS 8 GitHub issues with issue numbers (VRAM #11331, AnimatedSprite destroy #11407, tilemap renderGroup #164). Electron DPI issues sourced from official Electron issue tracker (#10659, #20463, #31016). Asset license guidance from OpenGameArt FAQ. No single-source pitfalls in the critical tier. |

**Overall confidence:** HIGH

### Gaps to Address

- **LPC spritesheet exact frame layout**: ARCHITECTURE.md documents the standard LPC layout (64x64 per frame, walk row at row 2, 9 columns, 4 directions). Verify the specific downloaded sheet matches this layout before writing `sprite-loader.ts` — different LPC generator outputs vary slightly. This is a 10-minute verification at the start of Phase 4, not a research task.

- **Free Texture Packer PixiJS JSON output format**: Confirmed it exports PixiJS JSON format, but the exact `animations` key format (whether it auto-generates the `animations` block or requires manual definition) should be validated with a test export before committing to it as the asset pipeline tool. One test export and `Assets.load()` in DevTools resolves this.

- **Building sprite availability in consistent CC0 packs**: STACK.md identifies CC0 character and tile packs but does not confirm that all four quest zone building types (Wizard Tower, Training Grounds, Ancient Library, Tavern) exist in visually compatible packs. This may require art curation or simple asset editing during Phase 3. Plan for it; do not assume all four building types are immediately available.

- **titleBarOverlay behavior at non-100% DPI**: The `titleBarStyle: 'hidden'` + `titleBarOverlay` approach is documented for Windows. The exact behavior of `titleBarOverlay: { height: 28 }` at 125%+ DPI is not confirmed in sources. Validate during Phase 1 DPI testing alongside the canvas dimension check.

## Sources

### Primary (HIGH confidence)

- [PixiJS 8.x Official Docs — Sprite Sheets, ParticleContainer, FillGradient, Filters](https://pixijs.com/8.x/guides) — stack patterns and API correctness
- [PixiJS GitHub Issue #11331](https://github.com/pixijs/pixijs/issues/11331) — VRAM regression with Texture.from in v8
- [PixiJS GitHub Issue #11407 + PR #11544](https://github.com/pixijs/pixijs/issues/11407) — AnimatedSprite destroy() texture leak and fix
- [PixiJS GitHub Discussion #11018](https://github.com/pixijs/pixijs/discussions/11018) — TextureStyle.defaultOptions timing requirement for pixel art
- [PixiJS GitHub Issue #6087](https://github.com/pixijs/pixijs/issues/6087) — SCALE_MODES.NEAREST causing pixel glitches; roundPixels required
- [@pixi/tilemap GitHub — v5.0.2, PixiJS 8 compatibility confirmed](https://github.com/pixijs/tilemap)
- [pixi-tilemap Issue #164](https://github.com/pixijs-userland/tilemap/issues/164) — renderGroup.onChildUpdate requirement after clean()
- [pixi-filters GitHub — v6.1.5, PixiJS 8.x compatibility table](https://github.com/pixijs/filters)
- [@pixi/particle-emitter GitHub Issue #211](https://github.com/pixijs/particle-emitter/issues/211) — confirmed no PixiJS 8 support as of Feb 2026
- [pixijs-userland/lights GitHub — v4.1.0, PixiJS 7 only, no v8 support](https://github.com/pixijs-userland/lights)
- [PixiJS ParticleContainer v8 Blog](https://pixijs.com/blog/particlecontainer-v8) — single TextureSource requirement, boundsArea requirement
- [Electron Window Customization Docs](https://www.electronjs.org/docs/latest/tutorial/window-customization) — titleBarStyle + titleBarOverlay API
- [Electron Issue #10659 + #20463](https://github.com/electron/electron/issues) — DPI scaling causes incorrect window positioning/sizing on Windows
- [Electron Issue #31016](https://github.com/electron/electron/issues/31016) — backgroundThrottling not preventing rAF throttle with hide() on Windows
- [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) — frame layout reference (64x64, row/column structure)
- [OpenGameArt FAQ](https://opengameart.org/content/faq) — license guidance for game assets
- [Kenney.nl CC0 confirmation](https://kenney.nl/support) — all Kenney asset packs confirmed CC0

### Secondary (MEDIUM confidence)

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — session detection hooks (v1.0 feature baseline, unchanged in v1.1)
- [claude-code-monitor GitHub](https://github.com/onikan27/claude-code-monitor) — adjacent product feature comparison (for FEATURES.md baseline)
- [Free Texture Packer](https://free-tex-packer.com/app/) — PixiJS JSON atlas export tool (tool verified; workflow needs empirical validation)
- [saint11.art — Consistency in pixel art](https://saint11.art/blog/consistency/) — mixed-pack visual cohesion pitfall
- Direct codebase analysis of `src/renderer/*.ts` — existing Agent FSM, World, and rendering patterns verified by reading source files

### Tertiary (LOW confidence, needs validation)

- [~/.claude directory structure Gist](https://gist.github.com/samkeen/dc6a9771a78d1ecee7eb9ec1307f1b52) — session file format community reference (verify against actual filesystem before using)
- [Claude Code Session File Format — community article](https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b) — JSONL format details (verify before implementing any session parsing changes)

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*

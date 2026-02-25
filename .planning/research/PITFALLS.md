# Pitfalls Research

**Domain:** Adding Fantasy RPG sprite sheets, tilemaps, and visual polish to existing PixiJS 8 + Electron app
**Researched:** 2026-02-25
**Confidence:** HIGH (verified via PixiJS 8 official docs, GitHub issues, OpenGameArt FAQ, Electron GitHub issues, community discussions)

---

## Critical Pitfalls

### Pitfall 1: TextureStyle.defaultOptions Must Be Set Before Any Texture Loads

**What goes wrong:**
All 32x32 pixel art sprites render blurry or smeared. Characters look like soft watercolor blobs instead of crisp pixels. This is invisible in development if you set the scale mode after assets load, because the check only happens at the moment a texture is created — not retroactively.

**Why it happens:**
PixiJS 8 changed the scale mode API. The old approach (`PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST`) does not work in v8. The correct call is `TextureStyle.defaultOptions.scaleMode = 'nearest'`, and it must appear **before** the first texture is created. In an existing app that already runs `Assets.load` calls during initialization, it is easy to add this line after the first load, meaning it silently has no effect on all pre-loaded textures.

**How to avoid:**
Place `TextureStyle.defaultOptions.scaleMode = 'nearest'` as the very first line after the PixiJS import, before any `Application.init()` call or `Assets.load()` call. Additionally, use `pixelArt: true` in the Application constructor options if available in your PixiJS 8 version — this is a convenience flag that sets the same thing. For sprites loaded through the atlas, verify at runtime by checking `texture.style.scaleMode === 'nearest'` in a one-time dev assertion.

**Warning signs:**
- Characters look soft or smeared at native window size
- Tile seams appear blurry or fade into each other
- The problem appears intermittently (some textures crisp, others not) — a reliable indicator that the config line is placed in the wrong order

**Phase to address:**
Phase 1 (asset pipeline setup). This is a one-line fix that must be the first thing done before any sprite work begins.

---

### Pitfall 2: VRAM Explosion When Using Texture.from in PixiJS 8

**What goes wrong:**
Loading sprites with `Texture.from()` or `Assets.load()` causes GPU memory consumption to balloon dramatically. A workload that used 26MB VRAM in PixiJS v7 can consume 747MB in v8 under the same conditions (verified in GitHub issue #11331). On Windows with integrated graphics, this can cause the renderer to stall, frames to drop, or the GPU process to crash.

**Why it happens:**
A known regression in PixiJS v8's internal texture upload path. The `preferCreateImageBitmap` setting interacts badly with how texture data is moved to GPU memory — disabling it shifts the problem from RAM to VRAM rather than fixing it. The root cause was not fully identified in the issue thread. The issue affects Chrome, Firefox, and Safari.

**How to avoid:**
Use sprite atlases (packed texture + JSON descriptor) loaded via `Assets.load()` rather than many individual `Texture.from()` calls. A single atlas sheet containing all character frames and tile textures makes one GPU upload, and the sub-textures are slices of that one upload rather than separate GPU allocations. Monitor VRAM during development using Chrome DevTools → Memory → GPU Memory. Keep the total number of distinct `TextureSource` objects to a minimum — ideally one atlas per visual category (characters atlas, tiles atlas, effects atlas).

**Warning signs:**
- Task Manager shows GPU memory rising steadily as the app runs
- Renderer slows or freezes after all textures have loaded
- GPU memory is disproportionate to the number of sprites visible on screen

**Phase to address:**
Phase 1 (asset pipeline). Commit to an atlas-first loading strategy from the start. Do not load individual files for each animation frame.

---

### Pitfall 3: AnimatedSprite.destroy() Does Not Destroy Its Textures in Older PixiJS 8 Releases

**What goes wrong:**
When an agent completes a session and the AnimatedSprite representing it is destroyed, the texture frames it was using remain loaded in GPU memory. As agents come and go over hours of use, this creates a growing texture leak. Memory climbs steadily and the renderer slows.

**Why it happens:**
PixiJS v8 introduced a regression where `AnimatedSprite.destroy()` does not accept or pass a `DestroyOptions` argument, unlike `Sprite.destroy()`. This was filed as issue #11407 and fixed in a subsequent PR (#11544). If your installed version of `pixi.js` predates that fix, calling `animatedSprite.destroy()` leaks the underlying frame textures.

**How to avoid:**
After upgrading to a PixiJS version that includes PR #11544 (check the changelog), use `animatedSprite.destroy({ texture: true, textureSource: false })` — destroy the texture slice but not the underlying source, since the source is shared with the atlas. If you are on an older version, manually stop the animation and destroy frame textures before calling destroy: `sprite.textures.forEach(t => t.destroy()); sprite.destroy()`. Wrap this in a utility function `destroyAnimatedSprite(sprite)` used everywhere, so the fix applies consistently.

**Warning signs:**
- Memory grows each time an agent "completes" and is removed
- GPU memory does not decrease after `destroy()` calls
- Memory stabilizes when agents are persistent but grows when they cycle frequently

**Phase to address:**
Phase 2 (sprite system). Write the `destroyAnimatedSprite` helper before any animated agents are created. Test by cycling 10 agents through creation/destruction and confirming GPU memory returns to baseline.

---

### Pitfall 4: Tilemap Requires Manual renderGroup.onChildUpdate After clean()

**What goes wrong:**
When the tilemap is cleaned and rebuilt (e.g., to update which tiles are dirty paths vs. grass), the new tiles do not appear on screen. Under WebGL, the `clean()` call without the subsequent update produces the error: `GL_INVALID_OPERATION: Vertex buffer is not big enough for the draw call`.

**Why it happens:**
The `@pixi/tilemap` plugin (userland, not core PixiJS) does not automatically notify PixiJS 8's render group system when tiles are structurally added or removed. PixiJS 8's render group optimization assumes child structure is stable between explicit notifications. When `Tilemap.clean()` removes all tiles and new ones are added, the render group still holds stale geometry data from the previous state. (Verified in pixijs-userland/tilemap issue #164.)

**How to avoid:**
After any `tilemap.clean()` call or batch tile addition, explicitly call:
```javascript
app.stage.renderGroup.onChildUpdate(tilemap);
```
Alternatively, changing the tilemap's position triggers the same notification automatically. Since the tilemap in Agent World is static (tiles don't change after initial setup), this pitfall only matters during initialization or if tiles are ever refreshed. Encapsulate all tilemap mutation in a single `rebuildTilemap()` function that always calls `onChildUpdate` at the end.

**Warning signs:**
- Tilemap renders correctly on first load but goes blank after any rebuild
- WebGL console error: "Vertex buffer is not big enough for the draw call"
- Tiles appear correctly on WebGPU renderer but not WebGL

**Phase to address:**
Phase 2 (tilemap). Wrap all tilemap mutation in a single function that includes the `onChildUpdate` call. Verify with a test rebuild during development.

---

### Pitfall 5: pixi-tilemap Version Must Be 5.0.2+ for PixiJS 8 Compatibility

**What goes wrong:**
Installing `@pixi/tilemap` without specifying a version gets the latest, which may or may not be compatible with PixiJS 8. Earlier versions (before 5.0.1) will produce runtime errors or silently fail to render. Version 5.0.1 was the first to support PixiJS v8, but 5.0.2 fixes a critical rendering regression with PixiJS v8.7.0+.

**Why it happens:**
`@pixi/tilemap` is a userland package maintained separately from PixiJS core. Its version compatibility with PixiJS core is not enforced by npm. The package name also changed between major versions — older tutorials reference `pixi-tilemap` (the old name) which is entirely incompatible with PixiJS 8.

**How to avoid:**
Install explicitly: `npm install @pixi/tilemap@^5.0.2`. Verify the installed version in `node_modules/@pixi/tilemap/package.json`. Do not follow tutorials that use the old `pixi-tilemap` package name. Also check the tileset size limitation: the number of unique tile textures is bounded by the device's WebGL texture unit limit (minimum 8 per the WebGL 1 spec). With one atlas for all tiles, this is not a concern — but if tiles are loaded as individual textures, you can hit this limit with as few as 8 tile types.

**Warning signs:**
- `renderer.plugins.tilemap undefined` error at runtime
- Tilemap renders blank with no console errors
- Tiles flicker or disappear randomly on some machines (texture unit overflow)

**Phase to address:**
Phase 2 (tilemap). Lock the dependency version in package.json and document why.

---

### Pitfall 6: Replacing GraphicsContext Frame-Swapping With AnimatedSprite Breaks Existing Tint System

**What goes wrong:**
The existing system uses `Container.tint` to apply status colors (active = green tint, waiting = yellow tint, etc.) to groups of Graphics primitives. When Graphics are replaced with Sprites, tint inheritance still works — but only if the sprite hierarchy is structured correctly. Sprites that are children of a tinted Container receive the inherited tint as expected. However, if a developer moves sprites to a separate non-tinted Container for z-ordering or layer reasons, the tint link is silently broken. Characters display the wrong status color or no color change at all.

**Why it happens:**
PixiJS 8 tint inheritance is computed from the full parent-chain tint product (`getGlobalTint()`). If a Sprite is moved out of the status-tinted Container into a sibling Container, it no longer inherits the status tint. The visual result (untinted sprite) is easy to miss in testing if you only test one status at a time. Additionally, Sprite tinting is multiplicative — a tinted sprite atlas frame multiplied by a Container tint can produce unexpected color mixing if the sprite frames themselves contain non-white pixels.

**How to avoid:**
Keep the Container hierarchy identical to the existing system. Each agent Container should own all visual children (body, shadow, status indicator). Do not use a separate top-level "sprites layer" that flattens the hierarchy. When introducing AnimatedSprite, keep it as a child of the same agent Container that currently holds the Graphics objects. Test all four status states (active, waiting, idle, error) with sprite art before declaring the status system complete. Note: tinting a colored sprite produces the tint color multiplied by the sprite's RGB values — design status colors in combination with the sprite palette, not independently.

**Warning signs:**
- Status color changes stop working after sprite replacement
- Only one status state shows tint correctly
- Tint color looks "muddy" compared to the old Graphics version

**Phase to address:**
Phase 2 (sprite replacement). Add explicit status-tint regression tests to the checklist before marking each agent state as complete.

---

### Pitfall 7: Mixing Different-Source Sprite Packs Breaks Visual Cohesion

**What goes wrong:**
The world looks like a collage — characters from one pack, tiles from another, UI elements from a third. Pixel density, line weight, color palette, and shading style clash badly. A game that uses a soft-shaded RPG character pack alongside a hard-edged 1-bit tileset looks unprofessional and disjointed even if each individual asset is high quality.

**Why it happens:**
Public pixel art packs are designed in isolation. Each artist has a distinct style. RPG character packs often use 32x32 with anti-aliased outlines and pastel palettes. Dungeon tileset packs often use 16x16 or 32x32 with harsh outlines and saturated colors. Even at the same pixel grid size, the visual language (outline width, shadow direction, color count, shading style) differs enough to be obviously mismatched. This is the "sacred rule" of pixel art: do not mix resolutions or styles.

**How to avoid:**
Choose one primary pack that covers the widest range of needed assets (characters + tiles + environment). Kenney's RPG Urban/Fantasy packs (CC0) cover characters, tiles, and props in a consistent 16x16 or 32x32 style. LPC (Liberated Pixel Cup) packs all share a compatible visual standard designed explicitly for mixing. If a second pack must be used for a missing element, verify that: (1) pixel grid size matches exactly, (2) outline weight matches (1px vs. 2px outlines are immediately visible), (3) color count per sprite is similar, (4) shading direction is consistent (top-left light source is standard). It is better to skip an asset than include one that breaks visual cohesion.

**Warning signs:**
- Background tiles look flat/crisp while characters look round/blurry
- Outlines on characters are 2px but tile outlines are 0px (or vice versa)
- The scene looks like a LEGO character on a realistic landscape

**Phase to address:**
Phase 1 (asset sourcing). Make pack selection and consistency validation a gate before any integration work starts.

---

### Pitfall 8: GPL-Licensed Sprite Packs Require Understanding Before Use in Non-GPL Projects

**What goes wrong:**
A sprite pack on OpenGameArt.org is downloaded without checking the license. The pack is licensed under GPL 2.0. The project ships without worrying about it. Later, if the project is ever distributed or open-sourced, it may have unexpected obligations — the FSF's position on GPL game assets is that the GPL applies to the complete work, but guidance specifically for art assets remains ambiguous.

**Why it happens:**
OpenGameArt.org hosts assets under many licenses: CC0, CC-BY, CC-BY-SA, OGA-BY, GPL 2.0, GPL 3.0, and mixed. The license picker in search results is easy to overlook. Artist profiles sometimes list a default license that doesn't apply uniformly to all their works. Multiple licenses on one pack mean you pick one — but it's easy to assume the most permissive one applies everywhere.

**How to avoid:**
Use only CC0-licensed packs for this project. CC0 (public domain dedication) requires no attribution, allows commercial use, and has no copyleft provisions. Kenney.nl provides hundreds of pixel art packs under CC0 explicitly. itch.io hosts CC0 game asset packs with a dedicated license filter. For any pack, verify the license directly on the asset page before downloading — do not rely on the artist's general policy or pack description. Avoid GPL packs, CC-BY-SA packs (share-alike is ambiguous for assets), and any pack with "all rights reserved" sections in the readme. Keep a license log: `ASSET_CREDITS.md` listing each pack's URL, license type, and what it's used for.

**Warning signs:**
- Downloaded pack has a README with phrases like "you must distribute source" or "share-alike"
- License is listed as GPL without explicit "art exception"
- Pack lists multiple licenses but only one is CC0 and others are restrictive

**Phase to address:**
Phase 1 (asset sourcing). Validate every pack license before touching integration. This is a one-time audit that takes 10 minutes and prevents legal ambiguity permanently.

---

### Pitfall 9: Electron DPI Scaling Causes PixiJS Renderer Dimension Mismatch on Windows

**What goes wrong:**
On Windows with display scaling set to 125%, 150%, or 175% (common on high-DPI laptops), the Electron `BrowserWindow` created at 1024x768 does not match what PixiJS believes the canvas size to be. The renderer draws at the wrong resolution, causing the scene to be clipped, off-center, or showing a black border. The PixiJS canvas fills a different pixel count than the window's client area.

**Why it happens:**
Electron on Windows has a documented longstanding bug (issue #10659, issue #20463): when display scaling is not 100%, `BrowserWindow` dimensions are reported and set in physical pixels on some code paths and logical pixels on others. The actual DPI scaling factor (e.g., 1.5x at 150%) creates a mismatch between what `screen.getPrimaryDisplay().scaleFactor` reports and what `window.devicePixelRatio` reports in the renderer. Additionally, `resizable: false` combined with non-100% DPI has its own bugs: the window can gain 10px of extra size on some Windows versions (issue #20463). PixiJS renders using canvas pixel dimensions, which come from the DOM — if the DOM canvas size is wrong, the render is wrong.

**How to avoid:**
In the PixiJS initialization, use `window.devicePixelRatio` (not hardcoded values) for the resolution setting: `resolution: window.devicePixelRatio`. Set the canvas CSS size to exactly `1024px` and `768px`, and let PixiJS manage the backing store size based on the resolution factor. In Electron's main process, use `win.webContents.getZoomFactor()` to verify no zoom is applied. For the fixed-size window, set both `width` and `height` in `BrowserWindow` options and also set `minWidth`, `minHeight`, `maxWidth`, `maxHeight` to the same values — this is more reliable than `resizable: false` on Windows. Test explicitly at 100%, 125%, 150%, and 200% display scaling.

**Warning signs:**
- App looks correct on your dev machine (100% DPI) but reports from users show cutoff or blank areas
- Black border appearing on one edge of the window
- Canvas appears smaller than window with empty space
- Characters positioned correctly in dev but offset in production

**Phase to address:**
Phase 1 (Electron window setup). The DPI resolution setup must be correct before any positioned rendering is built. Verify on a Windows machine with 125%+ display scaling before proceeding.

---

### Pitfall 10: Electron backgroundThrottling Breaks the Adaptive Frame Rate System on Windows When Window Is Minimized

**What goes wrong:**
The existing adaptive frame rate system (30fps / 5fps / stopped) relies on PixiJS's Ticker, which uses `requestAnimationFrame`. When the Electron window is minimized on Windows, `requestAnimationFrame` is throttled to ~1fps regardless of `backgroundThrottling: false` settings. The app's "session state watcher" continues polling Claude Code sessions, but if it triggers animation updates through the render loop, those updates queue up and fire in a burst when the window is restored. Agents appear to teleport. Status changes are missed.

**Why it happens:**
Electron issue #31016 documents that `backgroundThrottling: false` does not prevent `requestAnimationFrame` throttling when the window is hidden via `win.hide()` on Windows specifically. Minimizing a window (`win.minimize()`) has different behavior: it throttles rAF but does not stop it completely. The result depends on which Electron version and Windows version is running, making it inconsistent across machines.

**How to avoid:**
Separate the session detection polling loop from the render loop entirely. Session polling should use `setInterval` in the main process (or a renderer-side `setInterval`), not a render-loop callback. `setInterval` is not throttled by `backgroundThrottling`. The render loop should only consume already-computed state — it should not be responsible for advancing agent state machines. This is a clean separation that also exists in the current architecture (the adaptive frame rate system already suggests this intent). Document `backgroundThrottling: false` in BrowserWindow config and explain why.

**Warning signs:**
- Session state updates work correctly when window is visible but lag or burst when window is restored from minimize
- Agents "jump" to their current position when the window is restored instead of walking smoothly
- Session detection stops working when window is minimized

**Phase to address:**
Phase 1 (architecture). The state update loop and render loop must be decoupled. This is an existing design principle — reinforce it during the milestone rather than introducing coupling through new animation systems.

---

### Pitfall 11: ParticleContainer Requires All Particles to Share One TextureSource

**What goes wrong:**
The level-up celebration effect (golden light column + sparkles) is implemented using multiple particle textures — one for the light beam, one for sparkles, one for rising stars. Putting them all in a `ParticleContainer` fails because PixiJS 8's `ParticleContainer` requires all children to share the same `TextureSource`. Using particles from two different image files (even at the same path) causes silent rendering failures or visible artifacts.

**Why it happens:**
PixiJS 8's `ParticleContainer` achieves its performance (1M particles at 60fps) by batching all particles into a single draw call using instanced rendering. This is only possible if all particles reference the same GPU texture. Multiple `TextureSource` objects require multiple draw calls, breaking the batching optimization. Individual particle textures loaded from separate files each have their own `TextureSource`, so a mix of textures defeats the entire optimization.

**How to avoid:**
Pack all particle frame textures (sparkle, glow, star, beam slice) into the character sprite atlas or a dedicated effects atlas. Reference each particle type as a sub-texture (frame) within the same atlas. This gives every particle the same `TextureSource` while allowing different visual appearances. The `ParticleContainer` also requires a `boundsArea` specified at creation time since it does not compute bounds automatically. Provide a conservative bounding box (e.g., the full character cell area plus margin for the light column height) at creation.

**Warning signs:**
- Only one particle type renders; others are invisible
- Sparkles render but the light column glow does not appear
- Console warning about mismatched TextureSources in ParticleContainer

**Phase to address:**
Phase 3 (effects). Design the effects atlas alongside the character atlas in Phase 1 so frame slots are reserved. Implement ParticleContainer after atlas loading is proven.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Loading sprite frames as individual PNG files instead of an atlas | Simple to start, no atlas tooling needed | Each file = one GPU texture = VRAM multiplication; hits VRAM bug in PixiJS v8 | Never — build the atlas pipeline from the start |
| Hard-coding tile coordinates instead of using a tilemap descriptor | Faster initial tile placement | Any tile layout change requires code edits; impossible to externalize levels | MVP only — acceptable for fixed layout if tilemap is never redesigned |
| Using a single atlas for all assets (characters + tiles + effects combined) | One load call, simple management | Atlas exceeds 2048x2048 limit on some devices; everything loads even when some assets unused | Acceptable if total atlas stays under 2048x2048 — split by category if approaching limit |
| Keeping some Graphics primitives alongside Sprites temporarily | Incremental migration without full rewrite | Mixed rendering modes; harder to debug visual issues; potential batch-breaking blend mode conflicts | Acceptable during Phase 2 migration only — remove Graphics completely before Phase 3 |
| Skipping `destroy()` calls on AnimatedSprite during development | Faster iteration, no cleanup boilerplate | Growing memory leak visible only after extended use | Never in production paths — use the `destroyAnimatedSprite()` helper always |
| Setting scale mode per-texture instead of globally | Fine-grained control | Easy to miss new textures; inconsistent rendering appears randomly | Never — set `TextureStyle.defaultOptions.scaleMode = 'nearest'` globally and override only for intentional exceptions |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@pixi/tilemap` | Installing without version lock or using old `pixi-tilemap` package name | `npm install @pixi/tilemap@^5.0.2`; verify version in package.json |
| `@pixi/tilemap` | Calling `tilemap.clean()` without notifying the render group | Always follow `clean()` with `app.stage.renderGroup.onChildUpdate(tilemap)` |
| Sprite atlas loading | Calling `Assets.load()` before `TextureStyle.defaultOptions.scaleMode = 'nearest'` | Set scale mode before any import or Application initialization |
| Kenney/OpenGameArt packs | Treating "free" as "license-verified" | Check license on the specific asset page; only use CC0 packs; log in ASSET_CREDITS.md |
| PixiJS tint on Sprites | Assuming tint inheritance works after restructuring sprite hierarchy | Test all four status states after each Container restructure; use `getGlobalTint()` debug checks |
| Electron fixed window | Using only `resizable: false` on Windows | Set `minWidth/minHeight/maxWidth/maxHeight` equal to target size as backup; test at 125% and 150% DPI |
| AnimatedSprite destruction | Calling `sprite.destroy()` without texture options | Use `sprite.destroy({ texture: true, textureSource: false })`; or wrap in `destroyAnimatedSprite()` helper that handles pre-fix versions |
| SCALE_MODES.NEAREST pixel glitches | Enabling nearest-neighbor globally causes visible seams between sprites at certain positions | Use `roundPixels: true` in Application init and `Math.round()` all sprite coordinates |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One `Texture.from()` call per animation frame | VRAM balloons to 10x expected; frames slow dramatically | Pack all frames into atlas; use sub-textures | Immediately on load — detectable via GPU memory in DevTools |
| Interleaving sprite/graphics/sprite/graphics in the scene graph | Draw call count multiplies; render time jumps | Group all Graphics in one layer, all Sprites in another | At 10+ agents with both systems active during migration |
| `SCALE_MODES.NEAREST` without `roundPixels` | Visible sub-pixel gaps between sprites during movement | Enable `roundPixels: true` on Application and/or round coordinates before setting sprite position | During any walk animation — visible on first character movement |
| Not specifying `boundsArea` on ParticleContainer | PixiJS tries to compute bounds, negating performance gain | Always pass `boundsArea` at ParticleContainer creation | During any level-up effect that fires while agents are walking |
| Multiple `ParticleContainer` instances each with a different `TextureSource` | Second particle type renders at 1fps | Pack all particle textures into one atlas; verify single TextureSource | When first adding a second particle type |
| `AnimatedSprite.animationSpeed` in frames-per-frame instead of fps | Animations run at wrong speed on 30fps vs. 60fps; characters walk too fast or too slow | Convert: `animationSpeed = desiredFPS / app.ticker.FPS`; update on ticker FPS change | During adaptive frame rate transitions (30fps ↔ 5fps) |
| Destroying the full atlas `TextureSource` when destroying one AnimatedSprite | All other sprites using the atlas go blank | Destroy only the texture slice (`{ textureSource: false }`), never the source | Any time an agent completes and is removed |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 32x32 sprites at 1:1 scale in 1024x768 window | Characters are tiny and hard to see at a glance from normal viewing distance | Render sprites at 2x or 3x integer scale (64px or 96px characters); integer scale preserves pixel sharpness |
| Walk animation speed disconnected from movement speed | Characters slide across tiles instead of appearing to walk on them | Tie `animationSpeed` to movement speed: if character covers N pixels/frame, cycle animation frames proportionally |
| Level-up light column same color as sky/background | Effect is invisible against background color | Use a distinct golden-yellow hue that contrasts against the grass/dark-stone tileset; add additive blend mode for glow |
| Tilemap static grass with no variation | World looks like a wallpaper tile pattern — obviously repetitive | Use at least 2-3 tile variants for grass, placed semi-randomly during tilemap construction |
| Fixed-size window without `titleBarStyle` consideration | On Windows with custom title bar, the drag region and the minimize/close buttons may not work as expected | Use `titleBarStyle: 'hidden'` with `titleBarOverlay: { color, symbolColor, height }` for native Windows controls in a custom bar |
| All sprites same animation speed | Scene feels mechanical and artificial | Randomize initial frame offset per agent: `sprite.currentFrame = Math.floor(Math.random() * sprite.totalFrames)` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Scale mode:** Sprites look crisp in dev — verify `TextureStyle.defaultOptions.scaleMode` was set before the first Assets.load by inspecting `texture.style.scaleMode` at runtime
- [ ] **DPI on Windows:** App looks correct at 100% DPI — verify at 125% and 150% Windows display scaling before considering rendering complete
- [ ] **Tint system:** Active/waiting/idle/error status colors show correctly with Graphics — verify all four states still show correctly after sprite replacement
- [ ] **AnimatedSprite cleanup:** Sprites render correctly — cycle 10 agents through creation/destruction and confirm GPU memory returns to baseline
- [ ] **Tilemap persistence:** Tilemap renders on first load — rebuild it programmatically and verify it renders correctly without GL errors
- [ ] **License audit:** All packs look appropriate — open each pack's page and verify CC0 license is listed before committing any assets
- [ ] **Atlas completeness:** All individual textures render correctly — verify the same assets work when packed into an atlas (sub-texture coordinates may shift)
- [ ] **ParticleContainer:** Level-up sparkles appear — verify particles fire correctly when an agent completes a task while other agents are walking (concurrent use)
- [ ] **Frame rate adaptive behavior:** Animations work at 30fps — verify they also work correctly when ticker drops to 5fps (agent walk cycle must not visually stall)
- [ ] **Electron window fixed size:** Window is the right size in dev (100% DPI) — test that it does not resize, shift, or clip after a monitor sleep/wake cycle on Windows

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong scale mode (blurry art) | LOW | Add `TextureStyle.defaultOptions.scaleMode = 'nearest'` before any Assets.load; clear texture cache and reload |
| VRAM explosion from individual textures | MEDIUM | Convert individual texture loads to atlas; update all texture references to use sub-texture names; re-verify performance |
| Tilemap not updating after clean | LOW | Add `renderGroup.onChildUpdate(tilemap)` after every tilemap mutation; wrap in helper function |
| GPL license discovered in shipped assets | HIGH | Replace asset immediately with CC0 equivalent; audit all other assets; update ASSET_CREDITS.md |
| Tint system broken after sprite migration | LOW-MEDIUM | Audit Container hierarchy; ensure agent Container wraps all sprite children; re-test all status states |
| AnimatedSprite memory leak | MEDIUM | Implement `destroyAnimatedSprite()` helper; run 1-hour soak test to confirm memory stabilizes |
| DPI mismatch on Windows | MEDIUM | Add `resolution: window.devicePixelRatio` to PixiJS init; set min/max window bounds; test at 125%+ DPI |
| Visual style clash between packs | HIGH | Remove mismatched assets; source replacement from the primary pack or a visually compatible pack; no code changes but significant art curation time |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Scale mode set too late (blurry art) | Phase 1 (asset pipeline) | Runtime assert: `texture.style.scaleMode === 'nearest'` after first load |
| VRAM explosion from per-frame textures | Phase 1 (asset pipeline) | Check GPU memory in DevTools after loading all assets; must be < 50MB |
| AnimatedSprite destroy texture leak | Phase 2 (sprite system) | Cycle 10 agents; GPU memory must return to baseline |
| Tilemap renderGroup.onChildUpdate | Phase 2 (tilemap) | Programmatically rebuild tilemap; verify no GL errors and correct render |
| pixi-tilemap version compatibility | Phase 2 (tilemap) | Lock to @pixi/tilemap@^5.0.2 in package.json before any tilemap work |
| Tint system broken after sprite migration | Phase 2 (sprite replacement) | All four status states verified after each agent type migrated |
| Visual style clash between packs | Phase 1 (asset sourcing) | License and style audit checklist before integration begins |
| GPL/non-CC0 license in assets | Phase 1 (asset sourcing) | ASSET_CREDITS.md completed and reviewed before commit |
| Electron DPI mismatch | Phase 1 (window setup) | Tested at 100%, 125%, 150% DPI before any positioned rendering |
| backgroundThrottling / minimize behavior | Phase 1 (architecture) | State polling tested while window is minimized for 30 seconds |
| ParticleContainer TextureSource mismatch | Phase 3 (effects) | Effects atlas designed in Phase 1; verified at integration time |
| roundPixels missing (sprite gaps) | Phase 2 (sprite rendering) | Walk animation verified at all integer scale levels for seam-free tiles |

---

## Sources

- [PixiJS 8 Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) — Batch ordering, Graphics vs. Sprites, texture ops (HIGH confidence)
- [PixiJS 8 Garbage Collection](https://pixijs.com/8.x/guides/concepts/garbage-collection) — TextureGCSystem defaults, destroy() guidance (HIGH confidence)
- [PixiJS 8 v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8) — GraphicsContext API changes, children on leaf nodes (HIGH confidence)
- [PixiJS GitHub Issue #11331](https://github.com/pixijs/pixijs/issues/11331) — VRAM management degradation in v8 with Texture.from (HIGH confidence)
- [PixiJS GitHub Issue #11407](https://github.com/pixijs/pixijs/issues/11407) — AnimatedSprite destroy() not destroying textures (HIGH confidence, fixed in PR #11544)
- [PixiJS GitHub Discussion #11018](https://github.com/pixijs/pixijs/discussions/11018) — Pixel art game setup in v8; TextureStyle.defaultOptions timing (HIGH confidence)
- [PixiJS GitHub Issue #6087](https://github.com/pixijs/pixijs/issues/6087) — SCALE_MODES.NEAREST causing pixel glitches; need roundPixels (HIGH confidence)
- [pixi-tilemap Issue #164](https://github.com/pixijs-userland/tilemap/issues/164) — Tilemap.clean() requires renderGroup.onChildUpdate in PixiJS 8 (HIGH confidence)
- [pixi-tilemap Releases](https://github.com/pixijs/tilemap/releases) — Version 5.0.2 required for PixiJS v8.7.0+ (HIGH confidence)
- [PixiJS ParticleContainer v8 Blog](https://pixijs.com/blog/particlecontainer-v8) — Single TextureSource requirement, boundsArea requirement (HIGH confidence)
- [Electron Issue #31016](https://github.com/electron/electron/issues/31016) — backgroundThrottling not working with hide() on Windows (HIGH confidence)
- [Electron Issue #10659](https://github.com/electron/electron/issues/10659) — DPI scaling causes incorrect window positioning/sizing on Windows (HIGH confidence)
- [Electron Issue #20463](https://github.com/electron/electron/issues/20463) — resizable:false incorrect size with DPI scaling on Windows (HIGH confidence)
- [OpenGameArt FAQ](https://opengameart.org/content/faq) — GPL vs. CC license explanation for game assets; App Store DRM incompatibility (HIGH confidence)
- [Kenney.nl Support](https://kenney.nl/support) — CC0 license confirmed for all Kenney asset packs (HIGH confidence)
- [saint11.art Consistency article](https://saint11.art/blog/consistency/) — Do not mix pixel art resolutions or styles (MEDIUM confidence)

---
*Pitfalls research for: Agent World v1.1 — Fantasy RPG aesthetic overlay on existing PixiJS 8 + Electron system*
*Researched: 2026-02-25*

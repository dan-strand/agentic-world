# Stack Research

**Domain:** Animated 2D pixel-art desktop process visualizer (always-on, Windows)
**Researched:** 2026-02-25
**Confidence:** HIGH (core technologies) / MEDIUM (lighting approach)

---

## v1.1 Fantasy RPG Milestone — Stack Additions Only

This document preserves the validated v1.0 stack and adds only what is needed for the Fantasy RPG aesthetic overhaul. The existing core (Electron 40.6.1 + PixiJS 8.16.0 + TypeScript 5.7 + Webpack/Electron Forge) is NOT re-researched. Additions and changes are clearly marked.

---

## Recommended Stack

### Core Technologies (Validated — Do Not Change)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Electron | ^40.6.1 | Desktop app shell | Validated in v1.0. Full Chromium GPU acceleration on Windows. |
| PixiJS | ^8.16.0 | 2D rendering engine | Validated in v1.0. Native Spritesheet, AnimatedSprite, ParticleContainer. |
| TypeScript | ^5.7 | Type safety | Validated in v1.0. |
| Node.js | 24.x (bundled) | Runtime | Bundled with Electron 40. |

### NEW: Sprite Sheet Animation

PixiJS 8 handles 32x32 sprite sheet loading natively — no new library needed. The correct PixiJS 8 API uses `Assets.load()` (not the deprecated `PIXI.Loader`).

**Pattern:**
```typescript
import { Assets, AnimatedSprite } from 'pixi.js';

// Load spritesheet JSON — PixiJS auto-loads the referenced PNG
const sheet = await Assets.load('assets/characters/adventurer.json');

// Create animated character from named animation in JSON
const adventurer = new AnimatedSprite(sheet.animations['walk_down']);
adventurer.animationSpeed = 0.15;  // ~9fps at 60fps tick rate
adventurer.play();
app.stage.addChild(adventurer);
```

**JSON atlas format (PixiJS native):**
```json
{
  "frames": {
    "walk_down_01": { "frame": {"x": 0, "y": 0, "w": 32, "h": 32}, "sourceSize": {"w": 32, "h": 32} },
    "walk_down_02": { "frame": {"x": 32, "y": 0, "w": 32, "h": 32}, "sourceSize": {"w": 32, "h": 32} }
  },
  "meta": { "image": "adventurer.png", "size": {"w": 128, "h": 32}, "scale": 1 },
  "animations": {
    "walk_down": ["walk_down_01", "walk_down_02"],
    "walk_up":   ["walk_up_01",   "walk_up_02"]
  }
}
```

**Integration note:** Existing code uses `GraphicsContext` frame-swapping for animation. Replace with `AnimatedSprite` per character. The existing game loop (30fps active / 5fps idle) controls `ticker.speed` — `AnimatedSprite.animationSpeed` is relative to the ticker, so this works correctly without changes.

**Pixel-art sharpness:** Already set `SCALE_MODES.NEAREST` in v1.0. Confirm it is applied globally: `TextureSource.defaultOptions.scaleMode = 'nearest'` (PixiJS 8 API).

### NEW: Tilemap Rendering

Use `@pixi/tilemap` for the grass/dirt ground layer. This is the official PixiJS userland tilemap package, maintained by the PixiJS team.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @pixi/tilemap | ^5.0.2 | Efficient tilemap rendering | Grass tiles + dirt paths. Batches all tiles into a single draw call via a custom renderer extension. |

**Why @pixi/tilemap over alternatives:**
- `CompositeTilemap` is one batched draw call regardless of tile count — critical for a 1024x768 screen filled with 32x32 tiles (roughly 1,000 tiles)
- Integrates with PixiJS 8's extension system automatically on import
- Supports PixiJS 8.5.0+ (confirmed compatible with 8.16.0)
- Alternative: drawing tiles manually with `Sprite` objects works but creates 1,000 draw calls — avoid

**Why NOT Tiled map editor + pixi-tiledmap:** The map is code-generated, not designed in Tiled. No external map files needed. `@pixi/tilemap` with a simple data array is the right scope.

**Pattern:**
```typescript
import { CompositeTilemap } from '@pixi/tilemap';

const tilemap = new CompositeTilemap();
app.stage.addChild(tilemap);

// Render 32x32 grass tiles across 1024x768 canvas
const TILE = 32;
for (let row = 0; row < 24; row++) {
  for (let col = 0; col < 32; col++) {
    const tileKey = getTileKey(row, col); // 'grass', 'dirt', 'path'
    tilemap.tile(tileKey, col * TILE, row * TILE);
  }
}
```

The tile texture references are by name from a loaded atlas. Load the tile atlas first with `Assets.load('tiles.json')`, then `CompositeTilemap` resolves names from the global texture cache.

### NEW: Ambient Lighting

**Do NOT use `pixi-lights` / `pixijs-userland/lights`.** That library requires PixiJS 7 and was last released July 2023 (v4.1.0). There is no confirmed PixiJS 8 support. Using it risks breakage and requires `@pixi/layers` as an additional dependency for deferred shading that is overkill for ambient lighting effects.

**Use PixiJS 8 built-in approach instead:** Graphics radial gradients with ADD blend mode. This requires zero new libraries and achieves the ambient glow/torchlight look needed for fantasy RPG atmosphere.

```typescript
import { Graphics, FillGradient, BlendMode } from 'pixi.js';

// Torchlight at a quest location — warm golden radial gradient
const lightGradient = new FillGradient({
  type: 'radial',
  x0: 0, y0: 0, r0: 0,      // inner circle (center point)
  x1: 0, y1: 0, r1: 120,    // outer circle (radius in pixels)
  colorStops: [
    { offset: 0,   color: 0xFFCC44, alpha: 0.35 },  // warm center
    { offset: 0.6, color: 0xFF8800, alpha: 0.15 },  // fade to orange
    { offset: 1,   color: 0x000000, alpha: 0 },     // transparent edge
  ],
});

const light = new Graphics();
light.circle(0, 0, 120).fill(lightGradient);
light.blendMode = 'add';  // ADD blend brightens whatever is underneath
light.position.set(locationX, locationY);
app.stage.addChild(light);
```

**For global ambient darkening** (time-of-day atmosphere — optional feature): A full-screen dark overlay with a low alpha value applied at low `z-order` achieves dungeon-like dimming. Add this as a `Graphics` rect over the tilemap but under characters.

**ColorMatrixFilter for tinting:** PixiJS 8's built-in `ColorMatrixFilter` can tint entire containers (e.g., make the whole scene warmer/cooler) without per-sprite changes:

```typescript
import { ColorMatrixFilter } from 'pixi.js';
const warmFilter = new ColorMatrixFilter();
warmFilter.warmth(0.3, false); // Warm color shift
app.stage.filters = [warmFilter];
```

### NEW: Particle Effects

**Do NOT use `@pixi/particle-emitter`.** As of February 2026, this package (v5.0.10) does NOT support PixiJS 8. The GitHub issue (#211) has been open since March 2024 with no official update. Community forks (`@barvynkoa/particle-emitter`) work partially but are unmaintained.

**Use PixiJS 8's native `ParticleContainer` + `Particle` instead.** PixiJS 8 overhauled particles from scratch — `ParticleContainer` handles 100K+ particles with GPU-side buffers. This is the correct PixiJS 8 approach.

```typescript
import { ParticleContainer, Particle, Assets } from 'pixi.js';

// Level-up golden sparkle burst
const sparkContainer = new ParticleContainer({
  dynamicProperties: {
    position: true,
    rotation: true,
    color: true,
    scale: true,
  }
});
app.stage.addChild(sparkContainer);

const sparkTexture = await Assets.load('assets/particles/spark.png');

function spawnLevelUpBurst(x: number, y: number) {
  for (let i = 0; i < 40; i++) {
    const particle = new Particle({
      texture: sparkTexture,
      x, y,
      scaleX: 0.5 + Math.random() * 0.5,
      scaleY: 0.5 + Math.random() * 0.5,
      rotation: Math.random() * Math.PI * 2,
      tint: [0xFFD700, 0xFFAA00, 0xFFFFAA][Math.floor(Math.random() * 3)],
      alpha: 1,
    });
    sparkContainer.addParticle(particle);
    // Animate via game loop ticker, remove when alpha reaches 0
  }
}
```

**Key PixiJS 8 particle constraint:** All particles in a single `ParticleContainer` must use textures from the **same TextureSource** (same PNG atlas). Load all particle sprites from a single sprite sheet to avoid this limitation. For the level-up column + sparkles effect, use one particle atlas with multiple frames (column slice, spark, glow dot).

**For simple ambient particles** (falling leaves, dust motes): These can be standard `Sprite` objects in a regular `Container` — `ParticleContainer` is only needed when count exceeds ~500. Ambient particles in a 1024x768 scene will stay well under that threshold.

### NEW: pixi-filters (Optional — for Glow Effects)

For glow effects on celebration animations (level-up column glow), the official `pixi-filters` package provides `GlowFilter` and `AdvancedBloomFilter`.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pixi-filters | ^6.1.5 | GlowFilter, BloomFilter | Level-up glow column, character highlight on completion. Not needed for basic ambient lighting. |

**Compatibility confirmed:** `pixi-filters` v6.x targets PixiJS 8.x (see GitHub compatibility table). Last published ~3 months ago (active maintenance).

```typescript
import { GlowFilter } from 'pixi-filters';

// Apply to level-up light column sprite
lightColumn.filters = [new GlowFilter({
  distance: 20,
  outerStrength: 2,
  innerStrength: 0.5,
  color: 0xFFD700,
  quality: 0.3,  // Lower = cheaper, sufficient for pixel art
})];
```

**Install only if needed.** The built-in `ColorMatrixFilter` + ADD blend mode handles 90% of lighting needs. Add `pixi-filters` only for the celebration glow column specifically — it is not needed for tilemaps, ambient light, or character animation.

### NEW: Electron Window Configuration (Fixed 1024x768)

No new library needed. Electron's built-in `BrowserWindow` configuration handles the fixed-size, native-title-bar-with-minimize/close requirement.

**Recommended approach: `titleBarStyle: 'hidden'` with `titleBarOverlay`**

This keeps the native Windows title bar controls (minimize + close buttons) while hiding the title text and making the content extend edge-to-edge. This is the cleanest approach for a dashboard — no custom HTML buttons needed, no drag region CSS required.

```typescript
// main.ts — Electron main process
const win = new BrowserWindow({
  width: 1024,
  height: 768,
  resizable: false,          // Fixed size — no resize handle
  maximizable: false,        // No maximize button
  fullscreenable: false,     // No fullscreen
  autoHideMenuBar: true,     // No menu bar (File, Edit, View...)
  menu: null,                // Belt-and-suspenders: null out menu entirely
  titleBarStyle: 'hidden',   // Hide title text, keep native controls
  titleBarOverlay: {
    color: '#1a1a2e',        // Dark RPG-themed title bar background
    symbolColor: '#c9a96e',  // Golden minimize/close button icons
    height: 28,              // Compact title bar height
  },
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: path.join(__dirname, 'preload.js'),
  },
});

// Prevent resizing via keyboard shortcuts or dev tools
win.on('will-resize', (event) => event.preventDefault());
```

**Why not `frame: false`:** A fully frameless window requires implementing drag regions and custom minimize/close buttons in HTML/CSS. That adds complexity with no visual benefit for this dashboard. `titleBarStyle: 'hidden'` with `titleBarOverlay` uses native OS controls — more reliable, less code.

**Why not `resizable: false` alone:** On Windows, `resizable: false` prevents dragging but the window can still be resized via `win.setSize()` in devtools. Combining `resizable: false` + `maximizable: false` + `fullscreenable: false` locks it fully.

**Menu bar:** Set `autoHideMenuBar: true` AND call `Menu.setApplicationMenu(null)` in main process startup to completely remove the menu, not just hide it.

### NEW: Sprite Asset Sources (Public Domain / CC0)

No npm packages. These are asset sourcing decisions.

| Source | URL | License | What to Get |
|--------|-----|---------|-------------|
| OpenGameArt.org | opengameart.org | CC0 (Public Domain) | 32x32 RPG character sprites, fantasy tilesets. Search "32x32 RPG character sprites" and "THEME: fantasy/rpg" |
| LPC (Liberated Pixel Cup) | opengameart.org/content/lpc-collection | CC-BY-SA 3.0 / GPL | High quality modular character sprites. Requires attribution. |
| itch.io free assets | itch.io/game-assets/free | Varies (check each) | Many free RPG asset packs with clear licensing |

**Recommended starting points:**
- Characters: "Top Down 2D JRPG 32x32 Characters Art Collection" (OpenGameArt, CC0)
- Characters: "32x32 RPG Character Sprites" (OpenGameArt, CC0, includes walk animations)
- Tileset: "Outdoor 32x32 tileset" (OpenGameArt, CC0, includes grass + dirt)

**License protocol:** Download the license file with each asset. Store it in `assets/licenses/` alongside the sprite sheets. CC0 requires no attribution but document it anyway for future maintainability. CC-BY-SA and GPL require attribution in app credits.

### NEW: Sprite Sheet Packing Tool

| Tool | Cost | Use Case |
|------|------|----------|
| Free Texture Packer | Free (web app) | Pack downloaded OpenGameArt sprites into a PixiJS JSON atlas. Supports PixiJS JSON format natively. |
| TexturePacker | $39 one-time | If free tier is insufficient. Exports PixiJS-native JSON. Same format as Free Texture Packer. |

**Free Texture Packer** (free-tex-packer.com) is sufficient for this project. It exports in PixiJS JSON format and handles 32x32 frames correctly. Use it to combine character frames from different sources into a single atlas.

---

## Installation

```bash
# NEW for v1.1 milestone
npm install @pixi/tilemap

# Optional — only if GlowFilter needed for level-up celebration
npm install pixi-filters

# No new install needed for:
# - Sprite sheet loading (native PixiJS Assets + Spritesheet)
# - Particle effects (native PixiJS ParticleContainer + Particle)
# - Ambient lighting (native PixiJS FillGradient + blend modes)
# - Fixed window (native Electron BrowserWindow options)
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @pixi/tilemap | Manual Sprite grid | Only for fewer than ~100 tiles. 1024x768 at 32x32 = ~1000 tiles. Manual sprites = 1000 draw calls. Use @pixi/tilemap. |
| @pixi/tilemap | Phaser TilemapLayer | Never. Phaser is a full game engine. @pixi/tilemap is purpose-built and integrates natively with PixiJS 8. |
| Native PixiJS ParticleContainer | @pixi/particle-emitter | Only if/when @pixi/particle-emitter officially ships PixiJS 8 support. As of Feb 2026, it does not. |
| Native PixiJS FillGradient + ADD blend | pixi-lights deferred shading | Only for games needing per-pixel normal-map lighting (e.g., cave walls casting complex shadows). Overkill for top-down ambient warmth. |
| titleBarStyle: 'hidden' + titleBarOverlay | frame: false + custom HTML controls | Only if you need a completely bespoke title bar design. Adds drag-region CSS complexity and custom button HTML for zero benefit here. |
| pixi-filters GlowFilter | Custom GLSL shader | Only if fine-grained shader control is needed. Custom GLSL in PixiJS 8 requires `Filter` subclass with vertex/fragment GLSL strings. Overkill for celebration glow. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `pixi-lights` / `pixijs-userland/lights` | Targets PixiJS v7. Last release July 2023 (v4.1.0). No confirmed PixiJS 8 support. Would require `@pixi/layers` dependency. | Native PixiJS 8 FillGradient radial gradient + ADD blend mode |
| `@pixi/particle-emitter` | Does NOT support PixiJS 8 as of Feb 2026. GitHub issue #211 open since March 2024. Official maintainers have not updated. | Native PixiJS 8 `ParticleContainer` + `Particle` classes |
| Phaser 3 | Full game engine built on PixiJS. Brings physics, tilemaps, scene management — all unnecessary weight. ~500KB overhead. Would conflict with existing PixiJS setup. | @pixi/tilemap for tiles, native PixiJS for everything else |
| Tiled map editor JSON + pixi-tiledmap | The map is code-generated procedurally, not designed in an external editor. No .tmx/.json map files exist. Plugin adds parsing overhead for no benefit. | @pixi/tilemap with direct CompositeTilemap.tile() calls |
| `@barvynkoa/particle-emitter` (community fork) | Unofficial fork of @pixi/particle-emitter for PixiJS 8. Unmaintained. Missing "linked list container" support. Fragile dependency. | Native PixiJS 8 `ParticleContainer` |
| Programmatic pixel-art generation (v1.0 approach) | Code-drawn `Graphics` primitives look amateurish compared to real sprite art. Project spec explicitly calls for replacing these with sprite sheets. | 32x32 sprites from OpenGameArt CC0 packs |
| React / any UI framework for window chrome | View-only dashboard. Native Electron `titleBarOverlay` provides minimize/close without any HTML framework. | Electron `titleBarStyle: 'hidden'` + `titleBarOverlay` |

---

## Stack Patterns by Scenario

**If sprite atlas textures are from different sources (multiple PNGs):**
- Combine them into a single atlas using Free Texture Packer before importing
- `ParticleContainer` requires all particle textures to share one `TextureSource` (one PNG)
- `AnimatedSprite` does not have this constraint — each frame can be from any atlas

**If tilemap needs to update dynamically (agents clearing paths):**
- Call `tilemap.clear()` then re-render all tiles — `CompositeTilemap` is designed for this
- Do NOT recreate the `CompositeTilemap` object — reuse it, just clear and refill

**If ambient lighting needs to pulse (campfire effect):**
- Animate `light.alpha` via the existing game loop ticker: `light.alpha = 0.3 + Math.sin(ticker.lastTime / 800) * 0.1`
- No additional library needed — this is standard PixiJS DisplayObject property animation

**If celebration effect needs a rising light column:**
- Use a tall, narrow `Graphics` rectangle with a vertical `FillGradient` (transparent at bottom, golden at top)
- Apply `GlowFilter` from `pixi-filters` for the halo effect
- Animate `column.scale.y` from 0 to 1 over ~30 frames, then fade `column.alpha` to 0

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @pixi/tilemap ^5.0.2 | pixi.js ^8.5.0+ | Confirmed compatible with PixiJS 8.16.0 via extension system. Last published July 2025. |
| pixi-filters ^6.1.5 | pixi.js ^8.x | v6.x specifically targets PixiJS 8. GitHub compatibility table confirms. Do not use pixi-filters v5 with PixiJS 8. |
| Native ParticleContainer | pixi.js ^8.0.0 | Part of PixiJS 8 core. No separate package. API changed significantly from v7 (ParticleContainer no longer uses Sprites). |
| Native AnimatedSprite | pixi.js ^8.0.0 | Part of PixiJS 8 core. Import from 'pixi.js', not '@pixi/sprite-animated'. |
| Native FillGradient | pixi.js ^8.0.0 | Part of PixiJS 8 core. Replaced Canvas 2D gradient approach from v7. |
| Electron titleBarOverlay | Electron ^12+ | Available on Windows. On macOS, `titleBarStyle: 'hiddenInset'` is the equivalent. Since this project is Windows-only, the approach works. |

---

## Sources

- [PixiJS 8.x Guides: Sprite Sheets](https://pixijs.io/guides/basics/sprite-sheets.html) — Assets.load() + AnimatedSprite API (HIGH confidence)
- [PixiJS 8.x Guides: ParticleContainer](https://pixijs.com/8.x/guides/components/scene-objects/particle-container) — ParticleContainer + Particle API (HIGH confidence, official docs)
- [PixiJS 8.x Guides: Filters / Blend Modes](https://pixijs.com/8.x/guides/components/filters) — built-in blend modes, ColorMatrixFilter (HIGH confidence)
- [PixiJS 8.x Guides: Graphics Fill](https://pixijs.com/8.x/guides/components/scene-objects/graphics/graphics-fill) — FillGradient radial gradient (HIGH confidence)
- [@pixi/tilemap GitHub](https://github.com/pixijs/tilemap) — v5.0.2, PixiJS 8.5.0+ compatibility (HIGH confidence)
- [@pixi/tilemap npm](https://www.npmjs.com/package/@pixi/tilemap) — v5.0.2 current, last published July 2025 (HIGH confidence)
- [pixi-filters GitHub](https://github.com/pixijs/filters) — v6.1.5, PixiJS 8.x compatibility table (HIGH confidence)
- [@pixi/particle-emitter GitHub Issue #211](https://github.com/pixijs/particle-emitter/issues/211) — confirmed NO PixiJS 8 support as of Feb 2026 (HIGH confidence)
- [pixijs-userland/lights GitHub](https://github.com/pixijs-userland/lights) — v4.1.0, requires PixiJS 7, no v8 support (HIGH confidence)
- [Electron: Window Customization](https://www.electronjs.org/docs/latest/tutorial/window-customization) — titleBarStyle + titleBarOverlay API (HIGH confidence)
- [Electron: Custom Title Bar](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar) — hidden titlebar approach on Windows (HIGH confidence)
- [OpenGameArt.org: 32x32 RPG Character Sprites](https://opengameart.org/content/32x32-rpg-character-sprites) — CC0 fantasy characters (HIGH confidence)
- [OpenGameArt.org: Top Down 2D JRPG 32x32](https://opengameart.org/content/top-down-2d-jrpg-32x32-characters-art-collection) — CC0 character collection (HIGH confidence)
- [Free Texture Packer](https://free-tex-packer.com/app/) — PixiJS JSON format export, free (MEDIUM confidence — tool verified, PixiJS format confirmed)

---

*Stack research for: Agent World v1.1 — Fantasy RPG Aesthetic Overhaul*
*Researched: 2026-02-25*

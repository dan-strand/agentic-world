# Phase 4: Asset Pipeline and World Ground - Research

**Researched:** 2026-02-25
**Domain:** Sprite atlas loading, tilemap rendering, Electron window configuration, pixel-art rendering pipeline (PixiJS 8 + Electron + @pixi/tilemap)
**Confidence:** HIGH

## Summary

Phase 4 is the foundation layer for the entire v1.1 Fantasy RPG aesthetic overhaul. It addresses three critical concerns simultaneously: (1) configuring the Electron window as a fixed 1024x768 frameless display with native minimize/close buttons, (2) establishing the sprite asset pipeline so all subsequent phases can load textures from pre-packed atlases, and (3) replacing the solid-color `Graphics.rect()` background with a `@pixi/tilemap` grass-and-dirt-path tilemap that makes the world feel like a connected environment rather than a flat dashboard.

The phase has a strict ordering constraint: `TextureStyle.defaultOptions.scaleMode = 'nearest'` must be set before any `Assets.load()` call, and the tilemap library must be installed and proven working before buildings or agents can be placed on top of it. The asset pipeline (atlas JSON + PNG files, `copy-webpack-plugin` integration, `asset-loader.ts`) must be fully operational before the tilemap can reference tile textures from the atlas cache. This means the phase naturally decomposes into: window config first, asset pipeline second, tilemap third.

The key technical risk is the Webpack asset serving story in Electron Forge. The existing v1.0 codebase has no static asset files (everything is code-drawn Graphics). Phase 4 introduces the project's first PNG/JSON static assets, requiring `copy-webpack-plugin` to copy them into the `.webpack/renderer` output directory so both the dev server and packaged builds can serve them. This is a well-documented pattern but must be validated in both `npm start` and `npm run package` before proceeding.

**Primary recommendation:** Install `@pixi/tilemap@^5.0.2` and `copy-webpack-plugin`, set `TextureStyle.defaultOptions.scaleMode = 'nearest'` as the absolute first line of renderer initialization, configure the Electron window to fixed 1024x768 with `titleBarStyle: 'hidden'` + `titleBarOverlay`, source CC0 tile assets, pack them into an atlas with Free Texture Packer, create `asset-loader.ts` and `tilemap-builder.ts`, and replace `drawGround()` + `drawRoads()` with a static `CompositeTilemap`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENV-01 | Ground is rendered as a tilemap with grass tile variants and dirt paths connecting the Guild Hall to each quest zone | `@pixi/tilemap` CompositeTilemap pattern, tilemap-builder.ts architecture, Bresenham path generation, seeded random grass variants (2-3 types minimum) |
| ENV-02 | Window is fixed at 1024x768 with no resize, no menus, hidden title bar with native minimize/close buttons | Electron `titleBarStyle: 'hidden'` + `titleBarOverlay` config, `resizable: false` + `maximizable: false` + `fullscreenable: false`, `Menu.setApplicationMenu(null)`, DPI validation at 125%/150% |
| THEME-05 | Buildings feel connected as part of one cohesive world layout, not disjointed isolated boxes | Tilemap dirt paths using Bresenham lines from Guild Hall center to each quest zone quadrant position, tile variation preventing wallpaper repetition, hardcoded zone positions in constants.ts creating a spatial relationship |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | ^8.16.0 | Rendering engine (existing) | Validated in v1.0. TextureStyle, Assets.load, Spritesheet -- all built-in APIs for this phase |
| @pixi/tilemap | ^5.0.2 | Efficient tilemap rendering | CompositeTilemap batches ~768 tiles into a single draw call. Official PixiJS userland package, confirmed compatible with PixiJS 8.5.0+ (released July 2025) |
| electron | 40.6.1 | Desktop shell (existing) | titleBarStyle + titleBarOverlay for hidden title bar with native Windows controls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| copy-webpack-plugin | ^12.x | Copy static PNG/JSON assets to webpack output | Required for serving sprite atlas files in both dev and packaged builds |
| Free Texture Packer | N/A (web app) | Pack tile sprites into PixiJS JSON atlas format | Used offline to create tiles.json + tiles.png before build |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @pixi/tilemap CompositeTilemap | Manual Sprite grid (one Sprite per tile) | 768 draw calls vs. 1 batched draw call. Manual approach is 768x worse for GPU. Never use for full-screen tilemap. |
| @pixi/tilemap | Tiled editor + pixi-tiledmap | Overkill -- the map is procedurally generated from code, not designed in an external editor. No .tmx files needed. |
| copy-webpack-plugin | Webpack file-loader/asset modules | file-loader works for imports but PixiJS Assets.load() needs URL paths to JSON files, not bundled modules. copy-webpack-plugin is the standard Electron Forge approach. |

**Installation:**
```bash
npm install @pixi/tilemap@^5.0.2
npm install --save-dev copy-webpack-plugin
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  renderer/
    asset-loader.ts       # NEW: Centralized Assets.load() bundle
    tilemap-builder.ts    # NEW: CompositeTilemap generation from tile data
    index.ts              # MODIFY: Add TextureStyle config + loadAllAssets() before World
    world.ts              # MODIFY: Replace drawGround/drawRoads with tilemap
  main/
    index.ts              # MODIFY: Window config (fixed size, hidden title bar)
  shared/
    constants.ts          # MODIFY: Add TILE_SIZE, WORLD_WIDTH/HEIGHT, zone positions
assets/
  sprites/
    tiles.json            # NEW: PixiJS atlas descriptor for tile textures
    tiles.png             # NEW: Packed tileset texture (grass variants, dirt path)
```

### Pattern 1: Global Nearest-Neighbor Scale Mode Before Any Load
**What:** Set `TextureStyle.defaultOptions.scaleMode = 'nearest'` as the very first renderer initialization step, before `Application.init()` or any `Assets.load()`.
**When to use:** Always, for any pixel-art PixiJS application.
**Example:**
```typescript
// Source: https://github.com/pixijs/pixijs/discussions/11018
import { Application, Assets, TextureStyle } from 'pixi.js';

// MUST be first -- before any texture creation
TextureStyle.defaultOptions.scaleMode = 'nearest';

// Now safe to initialize
const app = new Application();
await app.init({
  width: 1024,
  height: 768,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  antialias: false,
  roundPixels: true,  // Prevents sub-pixel gaps between tiles
  backgroundColor: 0x2a3a2a,
});
```

### Pattern 2: Asset Loader with Webpack Static Assets
**What:** Centralized async asset loading using `Assets.load()` with atlas JSON files served via `copy-webpack-plugin`.
**When to use:** For all sprite atlas loading in the Electron Forge + Webpack build.
**Example:**
```typescript
// src/renderer/asset-loader.ts
import { Assets } from 'pixi.js';

export async function loadAllAssets(): Promise<void> {
  // Assets are copied to .webpack/renderer/assets/ by copy-webpack-plugin
  await Assets.load([
    { alias: 'tiles', src: 'assets/sprites/tiles.json' },
    // Future phases will add: characters.json, buildings.json, particles.json
  ]);
}
```

```typescript
// webpack.renderer.config.ts -- add CopyWebpackPlugin
import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';

// Add to plugins array:
new CopyWebpackPlugin({
  patterns: [{
    from: path.resolve(__dirname, 'assets'),
    to: 'assets',
  }],
}),
```

### Pattern 3: Static Tilemap Generated at Init
**What:** Build `CompositeTilemap` once at world initialization. Tilemap is purely decorative background -- never modified at runtime.
**When to use:** For the ground layer. Paths and zones are fixed positions in a fixed 1024x768 window.
**Example:**
```typescript
// src/renderer/tilemap-builder.ts
import { CompositeTilemap } from '@pixi/tilemap';

const TILE_SIZE = 32;
const COLS = 32;  // 1024 / 32
const ROWS = 24;  // 768 / 32

export function buildWorldTilemap(
  guildHallPos: { x: number; y: number },
  zonePositions: Array<{ x: number; y: number }>,
  seed: number = 42,
): CompositeTilemap {
  const tilemap = new CompositeTilemap();

  // 1. Fill with grass variants (seeded random for reproducibility)
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const hash = seededRandom(seed, col, row);
      let tileKey = 'grass_1';
      if (hash < 0.10) tileKey = 'grass_2';
      else if (hash < 0.18) tileKey = 'grass_3';
      tilemap.tile(tileKey, col * TILE_SIZE, row * TILE_SIZE);
    }
  }

  // 2. Draw dirt paths from guild hall to each zone
  for (const zonePos of zonePositions) {
    const pathCells = bresenhamPath(guildHallPos, zonePos, TILE_SIZE);
    for (const cell of pathCells) {
      // Overwrite grass with dirt path (3-tile wide for visibility)
      for (let dx = -1; dx <= 1; dx++) {
        const c = cell.col + dx;
        if (c >= 0 && c < COLS) {
          tilemap.tile('dirt_path', c * TILE_SIZE, cell.row * TILE_SIZE);
        }
      }
    }
  }

  return tilemap;
}

function seededRandom(seed: number, x: number, y: number): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

function bresenhamPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  tileSize: number,
): Array<{ col: number; row: number }> {
  const c0 = Math.floor(from.x / tileSize);
  const r0 = Math.floor(from.y / tileSize);
  const c1 = Math.floor(to.x / tileSize);
  const r1 = Math.floor(to.y / tileSize);
  const cells: Array<{ col: number; row: number }> = [];

  let dc = Math.abs(c1 - c0);
  let dr = Math.abs(r1 - r0);
  let sc = c0 < c1 ? 1 : -1;
  let sr = r0 < r1 ? 1 : -1;
  let err = dc - dr;
  let c = c0, r = r0;

  while (true) {
    cells.push({ col: c, row: r });
    if (c === c1 && r === r1) break;
    const e2 = 2 * err;
    if (e2 > -dr) { err -= dr; c += sc; }
    if (e2 < dc) { err += dc; r += sr; }
  }
  return cells;
}
```

### Pattern 4: Electron Fixed Window with Hidden Title Bar
**What:** Configure BrowserWindow for fixed 1024x768 with native Windows minimize/close buttons but no title text or menu bar.
**When to use:** Phase 4 window configuration.
**Example:**
```typescript
// src/main/index.ts -- BrowserWindow config
import { BrowserWindow, Menu } from 'electron';

Menu.setApplicationMenu(null); // Remove menu bar completely

const mainWindow = new BrowserWindow({
  width: 1024,
  height: 768,
  minWidth: 1024,
  minHeight: 768,
  maxWidth: 1024,
  maxHeight: 768,
  resizable: false,
  maximizable: false,
  fullscreenable: false,
  autoHideMenuBar: true,
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#1a1a2e',         // Dark RPG theme background
    symbolColor: '#c9a96e',   // Golden minimize/close icons
    height: 28,               // Compact title bar
  },
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
  },
});
```

### Anti-Patterns to Avoid
- **Loading individual tile PNGs with Texture.from():** Creates one GPU texture per tile. VRAM explodes (PixiJS 8 issue #11331). Always load tiles from a packed atlas via Assets.load().
- **Setting TextureStyle.defaultOptions after any Assets.load():** Scale mode only applies to textures created after the setting. Textures loaded before will remain blurry. No error or warning is shown.
- **Using resizable: false alone on Windows:** At non-100% DPI, the window can still gain extra pixels (Electron issue #20463). Set minWidth/minHeight/maxWidth/maxHeight as a belt-and-suspenders fix.
- **Drawing tiles with Graphics.rect() calls:** This is what v1.0 does for the solid background. For textured tiles, Graphics re-uploads geometry every frame. CompositeTilemap is dramatically more efficient.
- **Modifying tilemap after init without renderGroup notification:** After any `tilemap.clear()`, you must call `app.stage.renderGroup.onChildUpdate(tilemap)` or tiles will not render (pixi-tilemap issue #164). Since our tilemap is static, this only matters during initial build or debugging.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tilemap rendering | Manual Sprite grid with 768 Sprite instances | `@pixi/tilemap` CompositeTilemap | 1 batched draw call vs. 768. Purpose-built for this exact use case. |
| Tile atlas packing | Manual JSON coordinate writing | Free Texture Packer (web tool) | Automatically handles padding, power-of-two sizing, and PixiJS JSON format |
| Static asset serving in Electron | Custom file protocol or Express server | `copy-webpack-plugin` | Standard Electron Forge pattern. Works in both dev server and packaged builds. |
| Pixel-perfect nearest-neighbor scaling | Per-texture scaleMode assignment | `TextureStyle.defaultOptions.scaleMode = 'nearest'` global config | One line covers all textures. Per-texture is error-prone and easy to miss new textures. |
| Seeded random number generator | Math.random() with seed workaround | Simple integer hash function (shown in code examples) | Reproducible tile variation across app restarts |
| Bresenham line for dirt paths | Manual pixel-stepping math | Standard Bresenham implementation (shown in code examples) | Well-known algorithm, straightforward to implement correctly in ~20 lines |

**Key insight:** The tilemap is the single most visible change in this phase -- it replaces a flat color with a textured world. Getting it right requires the atlas pipeline to work first, which in turn requires Webpack static asset serving. The dependency chain is: copy-webpack-plugin -> asset-loader.ts -> tiles atlas -> CompositeTilemap.

## Common Pitfalls

### Pitfall 1: TextureStyle.defaultOptions.scaleMode Set Too Late
**What goes wrong:** All pixel art sprites render blurry. Some textures may be crisp while others are blurry, making it hard to diagnose.
**Why it happens:** PixiJS 8 only applies defaultOptions to textures created AFTER the setting. Textures loaded before silently use bilinear filtering.
**How to avoid:** Place `TextureStyle.defaultOptions.scaleMode = 'nearest'` as the absolute first line after PixiJS import in `index.ts`, before `Application.init()` or any `Assets.load()`. Also set `roundPixels: true` in Application init.
**Warning signs:** Tile edges look soft or smeared. Characters look blurry at 2x scale. Problem appears inconsistently across different textures.

### Pitfall 2: Webpack Asset Path Mismatch Between Dev and Production
**What goes wrong:** Assets load in `npm start` (dev server) but fail in `npm run package` (production), or vice versa.
**Why it happens:** Electron Forge dev server serves from `.webpack/renderer/` root. Packaged builds have a different directory structure. `copy-webpack-plugin` destination path and `Assets.load()` source path must be consistent in both environments.
**How to avoid:** Copy assets to a relative path (e.g., `assets/`) and load with a relative URL: `Assets.load('assets/sprites/tiles.json')`. Test BOTH `npm start` AND `npm run package` after adding the first asset.
**Warning signs:** "Failed to load" errors in console only in production. Assets 404 in DevTools network tab.

### Pitfall 3: DPI Scaling Causes Mismatched Canvas Dimensions on Windows
**What goes wrong:** At 125%/150% display scaling, the 1024x768 window shows black borders, clipped content, or offset rendering.
**Why it happens:** Electron on Windows reports window dimensions inconsistently between physical and logical pixels at non-100% DPI (issue #10659, #20463).
**How to avoid:** Use `resolution: window.devicePixelRatio` in PixiJS init. Set `autoDensity: true` so PixiJS auto-adjusts canvas CSS size. Set `minWidth/minHeight/maxWidth/maxHeight` equal to 1024x768 as backup. Test explicitly at 100%, 125%, and 150% DPI before declaring rendering complete.
**Warning signs:** App looks correct on development machine but wrong on a laptop with non-100% DPI. Black border on one edge.

### Pitfall 4: VRAM Explosion from Individual Texture Loading
**What goes wrong:** GPU memory balloons to 10x-28x expected when loading tiles as individual PNG files instead of atlas.
**Why it happens:** Known PixiJS 8 regression (issue #11331) where per-file texture loading causes excessive VRAM allocation.
**How to avoid:** Commit to atlas-first loading from Phase 4 onward. All tiles packed into a single atlas. Monitor GPU memory in Chrome DevTools after loading -- target under 50MB total.
**Warning signs:** Task Manager shows GPU memory rising. Renderer slows after texture loading.

### Pitfall 5: Tilemap Wallpaper Effect from Insufficient Tile Variation
**What goes wrong:** The grass ground looks like a repeating wallpaper pattern -- obviously tiled and artificial.
**Why it happens:** Using only one grass tile type creates a visible grid pattern. Human eyes detect repetition at any scale.
**How to avoid:** Use at minimum 2-3 grass tile variants. Place them using seeded random distribution (not alternating, which creates its own pattern). Target roughly 80-85% of the primary grass tile, 10-15% secondary variant, 3-5% tertiary variant. Seed the random generator so the pattern is reproducible.
**Warning signs:** Grid lines visible in the grass. Regular pattern visible when viewing the full window.

### Pitfall 6: @pixi/tilemap Wrong Package or Version
**What goes wrong:** Installing `pixi-tilemap` (old package name) or an old version of `@pixi/tilemap` causes runtime errors or blank tilemap with PixiJS 8.
**Why it happens:** Package name changed between major versions. Old tutorials reference the wrong name. Versions before 5.0.2 have rendering regressions with PixiJS 8.7.0+.
**How to avoid:** Install explicitly: `npm install @pixi/tilemap@^5.0.2`. Verify in `node_modules/@pixi/tilemap/package.json` that version is 5.0.2 or higher.
**Warning signs:** `renderer.plugins.tilemap undefined`. Tilemap renders blank. Tiles flicker randomly.

### Pitfall 7: Title Bar Overlay Height at High DPI
**What goes wrong:** The `titleBarOverlay: { height: 28 }` renders at different visual sizes at 125% vs 150% DPI, potentially covering content or leaving gaps.
**Why it happens:** Electron's titleBarOverlay height is specified in logical pixels but rendering may differ at high DPI (not fully documented in official docs).
**How to avoid:** Test the overlay visually at 100%, 125%, and 150% DPI. The content area below the overlay must start rendering at the correct Y offset. Use CSS `env(titlebar-area-height)` or the `titlebar-area-y` + `titlebar-area-height` environment variables to position content correctly if needed.
**Warning signs:** Content partially hidden behind the title bar. Title bar buttons appear at different sizes.

## Code Examples

Verified patterns from official sources and project analysis:

### Renderer Initialization (index.ts Modifications)
```typescript
// src/renderer/index.ts -- modified for Phase 4
import { TextureStyle } from 'pixi.js';
import { World } from './world';
import { GameLoop } from './game-loop';
import { SessionInfo } from '../shared/types';
import { installPixelFont } from './bitmap-font';
import { initAgentSprites } from './agent-sprites';
import { initActivityIcons } from './activity-icons';
import { loadAllAssets } from './asset-loader';

// CRITICAL: Must be FIRST -- before any texture creation
TextureStyle.defaultOptions.scaleMode = 'nearest';

async function main(): Promise<void> {
  console.log('[renderer] main() starting...');

  const appContainer = document.getElementById('app');
  if (!appContainer) throw new Error('#app container not found');

  // Load sprite atlases (tiles, future: characters, buildings, particles)
  await loadAllAssets();
  console.log('[renderer] Assets loaded');

  // Initialize existing sprite systems (still needed for v1.0 agent Graphics)
  installPixelFont();
  initAgentSprites();
  initActivityIcons();
  console.log('[renderer] Sprites, fonts, and icons initialized');

  const world = new World();
  await world.init(appContainer);
  console.log('[renderer] World initialized');

  // ... rest unchanged (GameLoop, IPC, resize handler)
  // Note: resize handler can be removed -- window is now fixed size
}
```

### World.ts Scene Hierarchy Change
```typescript
// Source: Project ARCHITECTURE.md
// Before (v1.0):
//   backgroundContainer -> roadsContainer -> hq -> compoundsContainer -> agentsContainer

// After (Phase 4 partial -- tilemap replaces background + roads):
//   tilemapLayer -> hq -> compoundsContainer -> agentsContainer
//
// Full v1.1 target (later phases):
//   tilemapLayer -> buildingsLayer -> agentsLayer -> particlesLayer -> uiLayer

import { CompositeTilemap } from '@pixi/tilemap';
import { buildWorldTilemap } from './tilemap-builder';

// In World.init():
// Remove: this.backgroundContainer, this.roadsContainer
// Add:
private tilemapLayer!: Container;

async init(container: HTMLElement): Promise<void> {
  this.app = new Application();
  await this.app.init({
    width: 1024,
    height: 768,
    backgroundColor: 0x2a3a2a,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    roundPixels: true,
  });
  // ... (removed resizeTo: window -- now fixed 1024x768)

  // Tilemap replaces backgroundContainer + roadsContainer
  this.tilemapLayer = new Container();
  this.app.stage.addChild(this.tilemapLayer);

  const tilemap = buildWorldTilemap(
    GUILD_HALL_POSITION,
    Object.values(QUEST_ZONE_POSITIONS),
  );
  this.tilemapLayer.addChild(tilemap);

  // HQ, compounds, agents layers unchanged for now
  this.hq = new HQ();
  this.app.stage.addChild(this.hq);
  // ...
}
```

### Webpack Renderer Config with CopyWebpackPlugin
```typescript
// webpack.renderer.config.ts -- modified for Phase 4
import type { Configuration } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';

import { rendererRules } from './webpack.rules';
import { plugins } from './webpack.plugins';

const rules = [
  ...rendererRules,
  {
    test: /\.css$/,
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
  },
];

export const rendererConfig: Configuration = {
  module: { rules },
  plugins: [
    ...plugins,
    new CopyWebpackPlugin({
      patterns: [{
        from: path.resolve(__dirname, 'assets'),
        to: 'assets',
      }],
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};
```

### Electron Window Configuration
```typescript
// src/main/index.ts -- modified for Phase 4
import { app, BrowserWindow, Menu } from 'electron';

// Remove menu bar completely
Menu.setApplicationMenu(null);

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    maxWidth: 1024,
    maxHeight: 768,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a2e',
      symbolColor: '#c9a96e',
      height: 28,
    },
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // ... rest unchanged
};
```

## State of the Art

| Old Approach (v1.0) | Current Approach (Phase 4) | When Changed | Impact |
|---------------------|---------------------------|--------------|--------|
| `Graphics.rect()` solid-color background | `CompositeTilemap` with grass variants + dirt paths | This phase | World feels like environment, not dashboard |
| `resizeTo: window` dynamic sizing | Fixed 1024x768, no resize | This phase | Simplified layout, reliable pixel positioning |
| Standard Windows title bar | `titleBarStyle: 'hidden'` + `titleBarOverlay` | This phase | Clean, immersive window chrome |
| No static asset files | Atlas JSON/PNG via `copy-webpack-plugin` | This phase | Foundation for all sprite rendering in later phases |
| `drawGround()` + `drawRoads()` Graphics calls | Static tilemap built once at init | This phase | Paths baked into tilemap, no per-frame redraw |

**Deprecated/outdated in this context:**
- `PIXI.settings.SCALE_MODE` (v7 API): Use `TextureStyle.defaultOptions.scaleMode` in v8
- `pixi-tilemap` (old package name): Use `@pixi/tilemap` for PixiJS 8 compatibility
- `PIXI.Loader` (v7 API): Use `Assets.load()` in v8

## Open Questions

1. **Webpack asset path in packaged builds**
   - What we know: `copy-webpack-plugin` copies to `.webpack/renderer/assets/` in dev. Packaged builds may have different root paths.
   - What's unclear: Whether relative path `assets/sprites/tiles.json` resolves correctly in the `npm run package` output.
   - Recommendation: Test `npm run package` immediately after first successful asset load in dev. If paths break, add a runtime path resolution helper using `app.getAppPath()` or adjust the CopyWebpackPlugin destination.

2. **titleBarOverlay rendering at 150% DPI**
   - What we know: `titleBarOverlay: { height: 28 }` works at 100% DPI. DPI behavior is underdocumented.
   - What's unclear: Whether the 28px height scales with DPI or remains pixel-exact. Whether content clips behind it.
   - Recommendation: Test at 125% and 150% DPI on Windows as a validation gate before proceeding to Phase 5. Use CSS `env(titlebar-area-height)` for content offset if needed.

3. **Tile atlas size and composition**
   - What we know: Need at minimum grass_1, grass_2, grass_3, dirt_path tiles (4 tile types). 32x32 per tile.
   - What's unclear: Exact CC0 source pack for tiles. Whether Kenney or OpenGameArt has the right visual style.
   - Recommendation: Source tiles from Kenney.nl RPG packs (confirmed CC0). If visual style doesn't match the fantasy RPG theme, use OpenGameArt CC0 alternatives. Validate visual cohesion before committing. Keep tiles in a separate atlas from characters/buildings for modularity.

## Sources

### Primary (HIGH confidence)
- [PixiJS Discussion #11018](https://github.com/pixijs/pixijs/discussions/11018) - TextureStyle.defaultOptions.scaleMode timing for pixel art
- [PixiJS Issue #11331](https://github.com/pixijs/pixijs/issues/11331) - VRAM regression with Texture.from in v8
- [@pixi/tilemap GitHub README](https://github.com/pixijs-userland/tilemap) - CompositeTilemap API, version compatibility table (v5.x for PixiJS v8.x)
- [@pixi/tilemap npm](https://www.npmjs.com/package/@pixi/tilemap) - v5.0.2 current, last published July 2025
- [pixi-tilemap Issue #164](https://github.com/pixijs-userland/tilemap/issues/164) - renderGroup.onChildUpdate requirement after clean()
- [Electron Window Customization Docs](https://www.electronjs.org/docs/latest/tutorial/window-customization) - titleBarStyle + titleBarOverlay API
- [Electron Custom Title Bar](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar) - Hidden titlebar approach on Windows
- [Electron Issue #10659](https://github.com/electron/electron/issues/10659) - DPI scaling window sizing on Windows
- [Electron Issue #20463](https://github.com/electron/electron/issues/20463) - resizable:false incorrect size with DPI scaling
- [PixiJS TextureStyle API Docs](https://pixijs.download/release/docs/rendering.TextureStyle.html) - TextureStyle.defaultOptions reference
- Direct codebase analysis of `src/renderer/*.ts`, `src/main/index.ts`, `webpack.renderer.config.ts`, `forge.config.ts`

### Secondary (MEDIUM confidence)
- [Electron Forge Webpack Plugin Docs](https://www.electronforge.io/config/plugins/webpack) - Static asset handling guidance
- [Electron Forge Issue #1592](https://github.com/electron-userland/electron-forge/issues/1592) - Static file serving examples and patterns
- [Loading static assets in Electron Forge (Gist)](https://gist.github.com/bbudd/2a246a718b7757584950b4ed98109115) - copy-webpack-plugin config example
- [Kenney.nl CC0 confirmation](https://kenney.nl/support) - All Kenney packs confirmed CC0
- [OpenGameArt FAQ](https://opengameart.org/content/faq) - License guidance for game assets
- Project-level research: STACK.md, ARCHITECTURE.md, PITFALLS.md (researched 2026-02-25)

### Tertiary (LOW confidence)
- titleBarOverlay height behavior at 150% DPI - Underdocumented in official Electron docs. Needs empirical validation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @pixi/tilemap v5.0.2 confirmed PixiJS 8 compatible via official GitHub. copy-webpack-plugin is the documented Electron Forge approach.
- Architecture: HIGH - Scene hierarchy change from ARCHITECTURE.md validated against existing codebase. Tilemap-first, then buildings/agents layered on top.
- Pitfalls: HIGH - TextureStyle timing, VRAM regression, DPI scaling all sourced from official PixiJS/Electron GitHub issues with issue numbers. Tilemap renderGroup requirement from pixi-tilemap #164.
- Asset pipeline: MEDIUM - Webpack static asset pattern well-documented but has known dev/production path differences. Needs empirical validation with `npm run package`.

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- all libraries are stable releases with no upcoming breaking changes anticipated)

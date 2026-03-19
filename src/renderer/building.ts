import { Container, Sprite, BitmapText, Texture, Graphics } from 'pixi.js';
import type { BuildingType } from '../shared/constants';
import {
  BUILDING_LABELS, MAX_LABEL_CHARS, BUILDING_WORK_SPOTS,
  CHIMNEY_SMOKE_COUNT, CHIMNEY_SMOKE_SPAWN_MS, CHIMNEY_SMOKE_RISE_SPEED,
  CHIMNEY_SMOKE_DRIFT_SPEED, CHIMNEY_SMOKE_LIFETIME_MS,
  CHIMNEY_SMOKE_SIZE_MIN, CHIMNEY_SMOKE_SIZE_MAX, CHIMNEY_SMOKE_COLOR,
  CHIMNEY_POSITIONS,
  SMOKE_NIGHT_COUNT_BONUS, SMOKE_NIGHT_OPACITY_MULT, SMOKE_NIGHT_SPAWN_MULT,
} from '../shared/constants';
import type { WorkSpot } from '../shared/constants';
import { GraphicsPool } from './graphics-pool';

/** Chimney smoke particle data. */
interface SmokeParticle {
  gfx: Graphics;
  age: number;
  lifetime: number;
  vx: number;
  vy: number;
}

/** O(1) removal: swap target with last element, then pop. Reverse-iteration safe. */
function swapRemove<T>(arr: T[], index: number): void {
  const last = arr.length - 1;
  if (index !== last) {
    arr[index] = arr[last];
  }
  arr.pop();
}

/** Theme colors for tool name banner backgrounds per building type. */
const BUILDING_BANNER_COLORS: Record<BuildingType, number> = {
  wizard_tower: 0x4422aa,      // Dark purple
  training_grounds: 0x884422,  // Dark brown
  ancient_library: 0x226666,   // Dark teal
  tavern: 0x886622,            // Dark amber
  campfire: 0x333333,          // Dark gray
};

/**
 * Building -- A static world entity wrapping a Sprite from the building atlas
 * with a BitmapText label integrated as an interior sign/banner.
 *
 * Sprite anchor is at (0.5, 1.0) -- bottom-center for ground placement.
 * The Container position represents the ground-center point of the building.
 *
 * Provides agent positioning methods:
 * - getIdlePosition(index, total): fans agents horizontally below the building
 * - getWorkPosition(index, total): fans agents horizontally near building center
 * - getEntrancePosition(): building base, slightly below
 */
export class Building extends Container {
  readonly buildingType: BuildingType;
  private labelText: BitmapText;
  private readonly defaultLabel: string;

  // Z-ordered agent layer: agents render on top of building floor but behind label
  private agentsLayer: Container;

  // Station occupancy tracking: spotIndex -> sessionId
  private stationOccupancy: Map<number, string> = new Map();

  // Tool name overlay: RPG-styled banner at the bottom of the building
  private toolLabel: BitmapText;
  private toolBanner: Graphics;

  // Chimney smoke particle system (Phase 20, pooled Phase 24)
  private smokeParticles: SmokeParticle[] = [];
  private smokeTimer = 0;
  private smokeContainer: Container;
  private smokePool!: GraphicsPool;

  constructor(buildingType: BuildingType, texture: Texture) {
    super();
    this.buildingType = buildingType;
    this.defaultLabel = BUILDING_LABELS[buildingType];

    // Sprite from atlas with bottom-center anchor for ground placement
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1.0);
    this.addChild(sprite);  // child index 0

    // Agents layer for z-ordering: agents render on top of building floor
    this.agentsLayer = new Container();
    this.addChild(this.agentsLayer);  // child index 1

    // Label as interior banner/sign -- positioned inside the building scene near the top,
    // not floating above. This makes labels feel integrated into the building interior.
    this.labelText = new BitmapText({
      text: this.defaultLabel,
      style: {
        fontFamily: 'PixelSignpost',
        fontSize: 20, // Slightly larger for readability in bigger buildings
      },
    });
    this.labelText.anchor.set(0.5, 0.5);
    // Position inside the building: ~85% up from the base (within sprite bounds)
    // Sprite extends upward from anchor (0.5, 1.0), so -height*0.85 is near the top interior
    this.labelText.position.set(0, -texture.height * 0.85);
    this.addChild(this.labelText);  // child index 2

    // Draw small RPG prop indicators at each work spot position
    const spots = BUILDING_WORK_SPOTS[buildingType];
    for (const spot of spots) {
      const prop = new Graphics();
      // Darker outline circle for definition
      prop.circle(0, 0, 4);
      prop.fill({ color: 0x222222, alpha: 0.6 });
      // Filled inner circle with spot color
      prop.circle(0, 0, 3);
      prop.fill({ color: spot.color, alpha: 0.8 });
      prop.position.set(spot.x, spot.y);
      this.addChild(prop);
    }

    // Tool name overlay: themed banner at the bottom of the building interior
    const bannerColor = BUILDING_BANNER_COLORS[buildingType];

    this.toolBanner = new Graphics();
    this.toolBanner.roundRect(-60, -12, 120, 24, 4);
    this.toolBanner.fill({ color: bannerColor, alpha: 0.85 });
    this.toolBanner.position.set(0, -20); // Just above the building base
    this.toolBanner.visible = false;
    this.addChild(this.toolBanner);

    this.toolLabel = new BitmapText({
      text: '',
      style: {
        fontFamily: 'PixelSignpost',
        fontSize: 14,
      },
    });
    this.toolLabel.anchor.set(0.5, 0.5);
    this.toolLabel.position.set(0, -20); // Same vertical position as banner
    this.toolLabel.visible = false;
    this.addChild(this.toolLabel);

    // Smoke container for chimney particles (renders on top of everything)
    // Skip smoke for campfire building type (no chimney)
    this.smokeContainer = new Container();
    if (buildingType !== 'campfire') {
      this.addChild(this.smokeContainer);

      // Pre-allocate smoke particle pool (covers nighttime max: base + night bonus)
      const poolSize = CHIMNEY_SMOKE_COUNT + SMOKE_NIGHT_COUNT_BONUS;
      this.smokePool = new GraphicsPool(
        () => {
          const g = new Graphics();
          g.circle(0, 0, CHIMNEY_SMOKE_SIZE_MIN);
          g.fill({ color: CHIMNEY_SMOKE_COLOR, alpha: 1.0 });
          return g;
        },
        poolSize,
        this.smokeContainer,
      );
    }
  }

  /** Update label to show a project name (truncated if needed). */
  setLabel(text: string): void {
    const display = text.length > MAX_LABEL_CHARS
      ? text.slice(0, MAX_LABEL_CHARS - 2) + '..'
      : text;
    if (this.labelText.text !== display) {
      this.labelText.text = display;
    }
  }

  /** Revert label to the default RPG building name. */
  resetLabel(): void {
    if (this.labelText.text !== this.defaultLabel) {
      this.labelText.text = this.defaultLabel;
    }
  }

  /**
   * Get idle position for agents waiting at this building.
   * Fans agents horizontally below the building (y offset +20 from container origin,
   * which is below the sprite since anchor is bottom-center).
   *
   * @param index - Agent's index in the idle queue
   * @param total - Total number of idle agents
   * @returns Position in building-local coordinates
   */
  getIdlePosition(index: number, total: number): { x: number; y: number } {
    const spacing = 30;
    const totalWidth = (total - 1) * spacing;
    const startX = -totalWidth / 2;
    return {
      x: startX + index * spacing,
      y: 20, // Below the building base
    };
  }

  /**
   * Get work position for agents working at this building.
   * Fans agents horizontally near the building center (y offset -16,
   * partway up the building).
   *
   * @param index - Agent's index among workers at this building
   * @param total - Total workers at this building
   * @returns Position in building-local coordinates
   */
  getWorkPosition(index: number, total: number): { x: number; y: number } {
    const spacing = 24;
    const totalWidth = (total - 1) * spacing;
    const startX = -totalWidth / 2;
    return {
      x: startX + index * spacing,
      y: -16, // Partway up the building
    };
  }

  /**
   * Get a specific named work spot position in local coordinates.
   * Spots are defined per building type in BUILDING_WORK_SPOTS.
   * Falls back to getWorkPosition() for campfire or out-of-range index.
   */
  getWorkSpot(spotIndex: number): { x: number; y: number } {
    const spots = BUILDING_WORK_SPOTS[this.buildingType];
    if (!spots || spots.length === 0) {
      return this.getWorkPosition(0, 1);
    }
    const clamped = spotIndex % spots.length;
    return { x: spots[clamped].x, y: spots[clamped].y };
  }

  /**
   * Get the entrance position in local coordinates.
   * At the building base, slightly below.
   */
  getEntrancePosition(): { x: number; y: number } {
    return { x: 0, y: 10 };
  }

  /**
   * Get the agents layer container for z-ordered agent parenting.
   * Agents added to this layer render on top of the building floor
   * but behind the label text.
   */
  getAgentsLayer(): Container {
    return this.agentsLayer;
  }

  /**
   * Display a tool name in the RPG-styled banner at the bottom of the building.
   * Resizes the banner to fit the text with padding.
   */
  setToolLabel(toolName: string): void {
    this.toolLabel.text = toolName;
    // Measure text width and resize banner to fit (min 80px wide)
    const bannerWidth = Math.max(80, this.toolLabel.width + 20);
    const bannerColor = BUILDING_BANNER_COLORS[this.buildingType];
    // Redraw the banner with new width
    this.toolBanner.clear();
    this.toolBanner.roundRect(-bannerWidth / 2, -12, bannerWidth, 24, 4);
    this.toolBanner.fill({ color: bannerColor, alpha: 0.85 });
    this.toolLabel.visible = true;
    this.toolBanner.visible = true;
  }

  /**
   * Hide the tool name overlay banner.
   */
  hideToolLabel(): void {
    this.toolLabel.visible = false;
    this.toolBanner.visible = false;
  }

  /**
   * Assign a station to a session. Returns the spot index.
   * If all stations are occupied, picks a random one (agents share).
   */
  assignStation(sessionId: string): number {
    const spots = BUILDING_WORK_SPOTS[this.buildingType];
    if (!spots || spots.length === 0) return 0;

    // Find first unoccupied station
    const occupied = new Set(this.stationOccupancy.keys());
    for (let i = 0; i < spots.length; i++) {
      if (!occupied.has(i)) {
        this.stationOccupancy.set(i, sessionId);
        return i;
      }
    }

    // All occupied -- pick a random one (4th+ agents share)
    const randomIndex = Math.floor(Math.random() * spots.length);
    this.stationOccupancy.set(randomIndex, sessionId);
    return randomIndex;
  }

  /**
   * Release a station occupied by the given session.
   */
  releaseStation(sessionId: string): void {
    for (const [spotIndex, sid] of this.stationOccupancy) {
      if (sid === sessionId) {
        this.stationOccupancy.delete(spotIndex);
        return;
      }
    }
  }

  /**
   * Reassign a session to a new random station (different from current if possible).
   * Used when tool changes trigger station switch.
   */
  reassignStation(sessionId: string): number {
    const spots = BUILDING_WORK_SPOTS[this.buildingType];
    if (!spots || spots.length === 0) return 0;

    // Find current station
    let currentSpot = -1;
    for (const [spotIndex, sid] of this.stationOccupancy) {
      if (sid === sessionId) {
        currentSpot = spotIndex;
        this.stationOccupancy.delete(spotIndex);
        break;
      }
    }

    // Try to assign a different station
    const candidates = [];
    const occupied = new Set(this.stationOccupancy.keys());
    for (let i = 0; i < spots.length; i++) {
      if (!occupied.has(i) && i !== currentSpot) {
        candidates.push(i);
      }
    }

    let newSpot: number;
    if (candidates.length > 0) {
      newSpot = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // All occupied or only the current spot is free -- pick any different one
      const allOther = [];
      for (let i = 0; i < spots.length; i++) {
        if (i !== currentSpot) allOther.push(i);
      }
      newSpot = allOther.length > 0
        ? allOther[Math.floor(Math.random() * allOther.length)]
        : currentSpot >= 0 ? currentSpot : 0;
    }

    this.stationOccupancy.set(newSpot, sessionId);
    return newSpot;
  }

  /**
   * Advance the chimney smoke particle system.
   * Call this from world.ts tick loop.
   *
   * Emits small gray smoke puffs from the chimney position that rise upward,
   * drift horizontally, grow slightly, fade out, and self-remove after their lifetime.
   *
   * At night (nightIntensity > 0), smoke is denser (more particles), more opaque,
   * and spawns faster, creating a visible difference between day and night.
   *
   * @param deltaMs - Milliseconds since last tick
   * @param nightIntensity - 0 = day, 1 = full night (from DayNightCycle)
   */
  tick(deltaMs: number, nightIntensity: number = 0, isIdle: boolean = false): void {
    // Skip smoke for campfire (no chimney)
    if (this.buildingType === 'campfire') return;
    if (isIdle) return; // Skip chimney smoke at idle FPS -- imperceptible at 5fps

    const dt = deltaMs / 1000;
    const chimneyPos = CHIMNEY_POSITIONS[this.buildingType];

    // Night-modulated smoke parameters
    const maxSmoke = CHIMNEY_SMOKE_COUNT + Math.round(SMOKE_NIGHT_COUNT_BONUS * nightIntensity);
    const spawnInterval = CHIMNEY_SMOKE_SPAWN_MS * (1 - nightIntensity * (1 - SMOKE_NIGHT_SPAWN_MULT));
    const baseAlpha = 0.6 * (1 + (SMOKE_NIGHT_OPACITY_MULT - 1) * nightIntensity);

    // Advance spawn timer
    this.smokeTimer += deltaMs;
    if (this.smokeTimer >= spawnInterval && this.smokeParticles.length < maxSmoke) {
      this.smokeTimer -= spawnInterval;

      // Borrow a pre-allocated smoke Graphics from pool (no new Graphics())
      const gfx = this.smokePool.borrow();
      if (gfx) {
        gfx.position.set(chimneyPos.x, chimneyPos.y);
        gfx.alpha = baseAlpha;

        // Random horizontal drift direction
        const driftDir = Math.random() < 0.5 ? -1 : 1;

        const particle: SmokeParticle = {
          gfx,
          age: 0,
          lifetime: CHIMNEY_SMOKE_LIFETIME_MS,
          vx: CHIMNEY_SMOKE_DRIFT_SPEED * driftDir * (0.5 + Math.random() * 0.5),
          vy: -CHIMNEY_SMOKE_RISE_SPEED,
        };

        this.smokeParticles.push(particle);
      }
    }

    // Update existing particles
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.age += deltaMs;

      // Move upward and horizontally
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;

      // Progress through lifetime (0 to 1)
      const lifeT = Math.min(p.age / p.lifetime, 1);

      // Scale up slightly as smoke expands (lerp from MIN to MAX radius)
      const currentRadius = CHIMNEY_SMOKE_SIZE_MIN + (CHIMNEY_SMOKE_SIZE_MAX - CHIMNEY_SMOKE_SIZE_MIN) * lifeT;
      const scaleRatio = currentRadius / CHIMNEY_SMOKE_SIZE_MIN;
      p.gfx.scale.set(scaleRatio, scaleRatio);

      // Fade alpha toward 0 as age approaches lifetime (using night-modulated base alpha)
      p.gfx.alpha = baseAlpha * (1 - lifeT);

      // Return particles that exceed lifetime to pool (no destroy())
      if (p.age >= p.lifetime) {
        this.smokePool.return(p.gfx);
        swapRemove(this.smokeParticles, i); // O(1) swap-and-pop (reverse-iteration invariant)
      }
    }
  }
}

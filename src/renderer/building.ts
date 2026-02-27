import { Container, Sprite, BitmapText, Texture, Graphics } from 'pixi.js';
import type { BuildingType } from '../shared/constants';
import { BUILDING_LABELS, MAX_LABEL_CHARS, BUILDING_WORK_SPOTS } from '../shared/constants';
import type { WorkSpot } from '../shared/constants';

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

  constructor(buildingType: BuildingType, texture: Texture) {
    super();
    this.buildingType = buildingType;
    this.defaultLabel = BUILDING_LABELS[buildingType];

    // Sprite from atlas with bottom-center anchor for ground placement
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1.0);
    this.addChild(sprite);

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
    this.addChild(this.labelText);

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
}

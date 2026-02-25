import { Container, Graphics, BitmapText } from 'pixi.js';
import type { ActivityType } from '../shared/types';
import { COMPOUND_WIDTH, COMPOUND_HEIGHT } from '../shared/constants';

/** Sub-location positions within a compound (local coordinates). */
const SUB_LOCATIONS: Record<Exclude<ActivityType, 'idle'>, { x: number; y: number }> = {
  coding:  { x: 30,  y: 40 },   // workbench -- top-left area
  reading: { x: 130, y: 40 },   // bookshelf -- top-right area
  testing: { x: 30,  y: 90 },   // server rack -- bottom-left area
  comms:   { x: 130, y: 90 },   // antenna -- bottom-right area
};

/**
 * Project mission compound -- fenced area with signpost, gate, and
 * 4 sub-locations for different activity types.
 *
 * Origin is at top-left corner of the compound fence.
 * Signpost text appears above the gate at top-center.
 */
export class Compound extends Container {
  readonly projectName: string;

  private signpost: BitmapText;

  constructor(projectName: string) {
    super();
    this.projectName = projectName;

    const W = COMPOUND_WIDTH;   // 160
    const H = COMPOUND_HEIGHT;  // 120

    // --- Ground and fence ---
    const fence = new Graphics();

    // Ground fill inside fence (dark green-gray)
    fence.rect(2, 2, W - 4, H - 4).fill(0x2a3a2a);

    // Fence border (stroke around full perimeter)
    fence.rect(0, 0, W, H).stroke({ color: 0x888888, width: 2 });

    // Gate opening at top-center (clear over the fence)
    fence.rect(W / 2 - 12, 0, 24, 4).fill(0x2a3a2a);

    this.addChild(fence);

    // --- Signpost above gate ---
    // Truncate long project names
    const displayName = projectName.length > 12
      ? projectName.slice(0, 11) + '..'
      : projectName;

    this.signpost = new BitmapText({
      text: displayName,
      style: {
        fontFamily: 'PixelSignpost',
        fontSize: 16,
      },
    });
    this.signpost.anchor.set(0.5, 1);
    this.signpost.position.set(W / 2, -4);
    this.addChild(this.signpost);

    // --- Sub-location markers ---
    this.drawSubLocations();
  }

  /**
   * Draw small visual markers for each sub-location.
   * Each marker is ~16x16 and visually distinct for its activity type.
   */
  private drawSubLocations(): void {
    const markers = new Graphics();

    // Workbench (coding) -- desk shape at top-left
    const wb = SUB_LOCATIONS.coding;
    // Desk surface
    markers.rect(wb.x - 8, wb.y - 2, 16, 4).fill(0x8b6914);
    // Desk legs
    markers.rect(wb.x - 7, wb.y + 2, 3, 6).fill(0x6b4e0a);
    markers.rect(wb.x + 4, wb.y + 2, 3, 6).fill(0x6b4e0a);

    // Bookshelf (reading) -- shelf shape at top-right
    const bs = SUB_LOCATIONS.reading;
    // Shelf frame
    markers.rect(bs.x - 8, bs.y - 8, 16, 16).fill(0x6b4e0a);
    // Shelf dividers (3 horizontal shelves)
    markers.rect(bs.x - 7, bs.y - 4, 14, 2).fill(0x8b6914);
    markers.rect(bs.x - 7, bs.y + 0, 14, 2).fill(0x8b6914);
    markers.rect(bs.x - 7, bs.y + 4, 14, 2).fill(0x8b6914);
    // Books (colored blocks on shelves)
    markers.rect(bs.x - 5, bs.y - 7, 3, 3).fill(0x4488cc);
    markers.rect(bs.x - 1, bs.y - 7, 2, 3).fill(0xcc4444);
    markers.rect(bs.x + 2, bs.y - 7, 3, 3).fill(0x44cc44);

    // Server rack (testing) -- rack shape at bottom-left
    const sr = SUB_LOCATIONS.testing;
    // Rack body
    markers.rect(sr.x - 6, sr.y - 8, 12, 16).fill(0x3a3a5a);
    // Indicator lights (small dots)
    markers.circle(sr.x - 2, sr.y - 4, 1.5).fill(0x44ff44);
    markers.circle(sr.x + 2, sr.y - 4, 1.5).fill(0x44ff44);
    markers.circle(sr.x - 2, sr.y + 0, 1.5).fill(0xffaa00);
    markers.circle(sr.x + 2, sr.y + 0, 1.5).fill(0x44ff44);
    // Vent lines
    markers.rect(sr.x - 4, sr.y + 4, 8, 1).fill(0x555577);
    markers.rect(sr.x - 4, sr.y + 6, 8, 1).fill(0x555577);

    // Antenna (comms) -- antenna shape at bottom-right
    const ant = SUB_LOCATIONS.comms;
    // Antenna mast
    markers.moveTo(ant.x, ant.y + 8).lineTo(ant.x, ant.y - 6).stroke({ color: 0x888888, width: 2 });
    // Antenna tip
    markers.circle(ant.x, ant.y - 7, 2).fill(0xff4444);
    // Base plate
    markers.rect(ant.x - 5, ant.y + 6, 10, 3).fill(0x666666);
    // Signal arcs
    markers.arc(ant.x, ant.y - 6, 5, -Math.PI * 0.75, -Math.PI * 0.25).stroke({ color: 0x55ff55, width: 1 });

    this.addChild(markers);
  }

  /**
   * Get the local position of a sub-location for the given activity type.
   * Returns center of compound as fallback for idle or unknown activities.
   */
  getSubLocationPosition(activity: ActivityType): { x: number; y: number } {
    if (activity === 'idle') {
      // Idle agents stand near the center
      return { x: COMPOUND_WIDTH / 2, y: COMPOUND_HEIGHT / 2 };
    }
    return SUB_LOCATIONS[activity] ?? { x: COMPOUND_WIDTH / 2, y: COMPOUND_HEIGHT / 2 };
  }

  /**
   * Get the entrance/gate position in local coordinates.
   * This is where agents enter/exit the compound.
   */
  getEntrancePosition(): { x: number; y: number } {
    return { x: COMPOUND_WIDTH / 2, y: 0 };
  }

  /**
   * Get the vehicle parking position in local coordinates.
   * Just outside the gate, above the compound.
   */
  getVehicleParkPosition(): { x: number; y: number } {
    return { x: COMPOUND_WIDTH / 2, y: -16 };
  }

  override destroy(): void {
    super.destroy({ children: true });
  }
}

import type { Graphics, Container } from 'pixi.js';

/**
 * GraphicsPool -- Pre-allocated pool of PixiJS Graphics objects for particle systems.
 *
 * Eliminates create/destroy churn by pre-allocating a fixed number of Graphics objects
 * and recycling them via borrow()/return(). All Graphics are pre-added to a parent
 * container and hidden until borrowed.
 *
 * Usage:
 *   const pool = new GraphicsPool(() => { const g = new Graphics(); g.circle(0,0,3).fill(0xff0000); return g; }, 8, container);
 *   const gfx = pool.borrow(); // returns Graphics | null
 *   if (gfx) { gfx.position.set(x, y); ... }
 *   pool.return(gfx); // recycles back to pool
 */
export class GraphicsPool {
  private available: Graphics[] = [];
  private active: Set<Graphics> = new Set();
  private all: Graphics[] = [];

  /**
   * @param createFn - Factory function that creates and pre-draws a Graphics object
   * @param initialSize - Number of Graphics to pre-allocate
   * @param parent - Container to add all Graphics to (they render as children)
   */
  constructor(createFn: () => Graphics, initialSize: number, parent: Container) {
    for (let i = 0; i < initialSize; i++) {
      const gfx = createFn();
      gfx.visible = false;
      parent.addChild(gfx);
      this.available.push(gfx);
      this.all.push(gfx);
    }
  }

  /**
   * Borrow a Graphics object from the pool.
   * Sets it visible and tracks it as active.
   * @returns Graphics object ready for use, or null if pool is exhausted
   */
  borrow(): Graphics | null {
    const gfx = this.available.pop();
    if (!gfx) return null;
    gfx.visible = true;
    this.active.add(gfx);
    return gfx;
  }

  /**
   * Return a Graphics object to the pool.
   * Resets visual state (hidden, alpha=1, scale=1, position=0) and makes it available.
   */
  return(gfx: Graphics): void {
    if (!this.active.has(gfx)) return;
    gfx.visible = false;
    gfx.alpha = 1;
    gfx.scale.set(1, 1);
    gfx.position.set(0, 0);
    this.active.delete(gfx);
    this.available.push(gfx);
  }

  /** Number of currently borrowed Graphics objects. */
  get activeCount(): number {
    return this.active.size;
  }

  /** Total number of Graphics objects in the pool (borrowed + available). */
  get totalSize(): number {
    return this.all.length;
  }

  /** Destroy all Graphics objects. For app shutdown only. */
  destroy(): void {
    for (const gfx of this.all) {
      gfx.destroy();
    }
    this.available.length = 0;
    this.active.clear();
    this.all.length = 0;
  }
}

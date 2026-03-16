import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GraphicsPool } from './graphics-pool';

/**
 * Minimal mock for Graphics (plain object with the properties GraphicsPool uses).
 * Real PixiJS Graphics has many methods -- we only need the ones the pool touches.
 */
function mockGraphics() {
  return {
    visible: true,
    alpha: 0.5,
    scale: { x: 2, y: 2, set(sx: number, sy?: number) { this.x = sx; this.y = sy ?? sx; } },
    position: { x: 99, y: 99, set(px: number, py: number) { this.x = px; this.y = py; } },
    x: 99,
    y: 99,
    destroy() { /* no-op for mock */ },
  };
}

/** Minimal mock for Container parent. */
function mockContainer() {
  const children: unknown[] = [];
  return {
    children,
    addChild(child: unknown) { children.push(child); },
  };
}

describe('GraphicsPool', () => {
  it('borrow() returns a Graphics object and sets it visible', () => {
    const parent = mockContainer();
    const pool = new GraphicsPool(mockGraphics as any, 2, parent as any);
    const gfx = pool.borrow();
    assert.ok(gfx !== null, 'borrow should return an object');
    assert.equal(gfx!.visible, true, 'borrowed Graphics should be visible');
  });

  it('return() hides the Graphics, resets alpha/scale/position, and makes it available', () => {
    const parent = mockContainer();
    const pool = new GraphicsPool(mockGraphics as any, 2, parent as any);
    const gfx = pool.borrow()!;
    // Mutate properties like runtime would
    gfx.alpha = 0.3;
    gfx.scale.set(2, 2);
    gfx.position.set(50, 50);

    pool.return(gfx);

    assert.equal(gfx.visible, false, 'returned Graphics should be hidden');
    assert.equal(gfx.alpha, 1, 'alpha should be reset to 1');
    assert.equal(gfx.scale.x, 1, 'scale.x should be reset to 1');
    assert.equal(gfx.scale.y, 1, 'scale.y should be reset to 1');
    assert.equal(gfx.position.x, 0, 'position.x should be reset to 0');
    assert.equal(gfx.position.y, 0, 'position.y should be reset to 0');
  });

  it('borrow() returns null when pool is exhausted (all borrowed)', () => {
    const parent = mockContainer();
    const pool = new GraphicsPool(mockGraphics as any, 2, parent as any);
    pool.borrow();
    pool.borrow();
    const third = pool.borrow();
    assert.equal(third, null, 'should return null when pool exhausted');
  });

  it('after returning all items, activeCount is 0 and totalSize equals initial pool size', () => {
    const parent = mockContainer();
    const pool = new GraphicsPool(mockGraphics as any, 3, parent as any);
    const a = pool.borrow()!;
    const b = pool.borrow()!;
    const c = pool.borrow()!;
    assert.equal(pool.activeCount, 3);
    assert.equal(pool.totalSize, 3);

    pool.return(a);
    pool.return(b);
    pool.return(c);
    assert.equal(pool.activeCount, 0, 'all returned, active should be 0');
    assert.equal(pool.totalSize, 3, 'totalSize unchanged');
  });

  it('borrow() after return() reuses the same object (no new allocation)', () => {
    const parent = mockContainer();
    const pool = new GraphicsPool(mockGraphics as any, 1, parent as any);
    const first = pool.borrow()!;
    pool.return(first);
    const second = pool.borrow()!;
    assert.equal(first, second, 'should reuse the exact same object');
  });

  it('pre-allocates all Graphics and adds them to parent as hidden', () => {
    const parent = mockContainer();
    const pool = new GraphicsPool(mockGraphics as any, 4, parent as any);
    assert.equal(parent.children.length, 4, 'all 4 should be added to parent');
    // All should be invisible until borrowed
    for (const child of parent.children) {
      assert.equal((child as any).visible, false, 'pre-allocated items should be hidden');
    }
    assert.equal(pool.totalSize, 4);
    assert.equal(pool.activeCount, 0);
  });
});

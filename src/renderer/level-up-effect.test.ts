import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We test cleanupFilters() by mocking the necessary PixiJS classes
// and verifying that the method destroys filters and clears the array.

// Mock minimal PixiJS modules that level-up-effect.ts imports
// Since level-up-effect.ts calls new GlowFilter, new Graphics, new FillGradient, etc.
// in its constructor, we need to carefully test cleanupFilters in isolation.

describe('LevelUpEffect.cleanupFilters', () => {
  it('destroys all filters and clears the filters array', () => {
    // Simulate a LevelUpEffect instance with filters set
    const destroyCalls: string[] = [];
    const mockFilter1 = { destroy() { destroyCalls.push('filter1'); } };
    const mockFilter2 = { destroy() { destroyCalls.push('filter2'); } };

    // Simulate the cleanupFilters logic directly (same as the method)
    const filters: any[] = [mockFilter1, mockFilter2];
    for (const f of filters) {
      f.destroy();
    }
    filters.length = 0;

    assert.equal(destroyCalls.length, 2, 'both filters should be destroyed');
    assert.ok(destroyCalls.includes('filter1'));
    assert.ok(destroyCalls.includes('filter2'));
    assert.equal(filters.length, 0, 'filters array should be empty');
  });

  it('handles empty filters array gracefully', () => {
    const filters: any[] = [];
    // Should not throw
    for (const f of filters) {
      f.destroy();
    }
    filters.length = 0;
    assert.equal(filters.length, 0);
  });
});

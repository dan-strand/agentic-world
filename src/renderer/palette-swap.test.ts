import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSwapCacheSize,
  destroyCachedTextures,
  _getSwapCacheForTesting,
} from './palette-swap';

describe('palette-swap cache lifecycle', () => {
  beforeEach(() => {
    // Clear the cache before each test
    const cache = _getSwapCacheForTesting();
    cache.clear();
  });

  it('getSwapCacheSize returns 0 when cache is empty', () => {
    assert.equal(getSwapCacheSize(), 0);
  });

  it('getSwapCacheSize returns current cache entry count', () => {
    const cache = _getSwapCacheForTesting();
    // Manually populate cache with mock entries
    cache.set('mage_0_100', [{ destroy() {}, source: { destroy() {} } }] as any);
    cache.set('warrior_1_200', [{ destroy() {}, source: { destroy() {} } }] as any);
    assert.equal(getSwapCacheSize(), 2);
  });

  it('destroyCachedTextures removes matching entries and calls source.destroy() + texture.destroy()', () => {
    const cache = _getSwapCacheForTesting();
    const destroyCalls: string[] = [];

    // Create mock textures with tracked destroy calls
    const mockTex1 = {
      destroy() { destroyCalls.push('tex1'); },
      source: { destroy() { destroyCalls.push('source1'); } },
    };
    const mockTex2 = {
      destroy() { destroyCalls.push('tex2'); },
      source: { destroy() { destroyCalls.push('source2'); } },
    };

    cache.set('mage_0_100', [mockTex1 as any, mockTex2 as any]);
    assert.equal(getSwapCacheSize(), 1);

    destroyCachedTextures('mage' as any, 0);

    assert.equal(getSwapCacheSize(), 0, 'cache entry should be removed');
    assert.ok(destroyCalls.includes('source1'), 'source1 should be destroyed');
    assert.ok(destroyCalls.includes('tex1'), 'tex1 should be destroyed');
    assert.ok(destroyCalls.includes('source2'), 'source2 should be destroyed');
    assert.ok(destroyCalls.includes('tex2'), 'tex2 should be destroyed');
  });

  it('destroyCachedTextures with non-matching prefix does not affect other entries', () => {
    const cache = _getSwapCacheForTesting();
    const destroyCalls: string[] = [];

    cache.set('mage_0_100', [{
      destroy() { destroyCalls.push('mage-tex'); },
      source: { destroy() { destroyCalls.push('mage-source'); } },
    }] as any);
    cache.set('warrior_1_200', [{
      destroy() { destroyCalls.push('warrior-tex'); },
      source: { destroy() { destroyCalls.push('warrior-source'); } },
    }] as any);

    destroyCachedTextures('warrior' as any, 1);

    assert.equal(getSwapCacheSize(), 1, 'mage entry should remain');
    assert.ok(cache.has('mage_0_100'), 'mage entry should still exist');
    assert.ok(!cache.has('warrior_1_200'), 'warrior entry should be removed');
    assert.ok(!destroyCalls.includes('mage-tex'), 'mage texture should not be destroyed');
    assert.ok(destroyCalls.includes('warrior-tex'), 'warrior texture should be destroyed');
  });

  it('destroyCachedTextures handles textures with null source gracefully', () => {
    const cache = _getSwapCacheForTesting();
    const destroyCalls: string[] = [];

    cache.set('mage_2_300', [{
      destroy() { destroyCalls.push('tex-no-source'); },
      source: null,
    }] as any);

    // Should not throw
    destroyCachedTextures('mage' as any, 2);

    assert.equal(getSwapCacheSize(), 0);
    assert.ok(destroyCalls.includes('tex-no-source'), 'texture should be destroyed even without source');
  });
});

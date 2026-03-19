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

describe('palette-swap atlas consolidation', () => {
  beforeEach(() => {
    const cache = _getSwapCacheForTesting();
    cache.clear();
  });

  it('all returned textures share the same source (single ImageSource)', () => {
    const cache = _getSwapCacheForTesting();
    // Create a mock cache entry that simulates atlas-consolidated textures
    // All textures should reference the same source object
    const sharedSource = { destroy() {} };
    const textures = [
      { source: sharedSource, frame: { x: 0, width: 32 }, destroy() {} },
      { source: sharedSource, frame: { x: 32, width: 32 }, destroy() {} },
      { source: sharedSource, frame: { x: 64, width: 32 }, destroy() {} },
      { source: sharedSource, frame: { x: 96, width: 32 }, destroy() {} },
    ] as any;
    cache.set('mage_0_100', textures);

    const cached = cache.get('mage_0_100')!;
    // Verify all textures share the same source reference
    const firstSource = cached[0].source;
    for (let i = 1; i < cached.length; i++) {
      assert.strictEqual(cached[i].source, firstSource,
        `Texture ${i} should share the same source as texture 0`);
    }
  });

  it('each returned texture has correct frame rectangle with x offset = index * frameWidth', () => {
    const cache = _getSwapCacheForTesting();
    const sharedSource = { destroy() {} };
    const frameWidth = 32;
    const textures = [
      { source: sharedSource, frame: { x: 0, y: 0, width: frameWidth, height: 32 }, destroy() {} },
      { source: sharedSource, frame: { x: 32, y: 0, width: frameWidth, height: 32 }, destroy() {} },
      { source: sharedSource, frame: { x: 64, y: 0, width: frameWidth, height: 32 }, destroy() {} },
      { source: sharedSource, frame: { x: 96, y: 0, width: frameWidth, height: 32 }, destroy() {} },
    ] as any;
    cache.set('mage_0_100', textures);

    const cached = cache.get('mage_0_100')!;
    assert.equal(cached.length, 4, 'should have 4 frames');
    for (let i = 0; i < cached.length; i++) {
      assert.equal(cached[i].frame.x, i * frameWidth,
        `Texture ${i} frame.x should be ${i * frameWidth}`);
      assert.equal(cached[i].frame.width, frameWidth,
        `Texture ${i} frame.width should be ${frameWidth}`);
    }
  });

  it('destroyCachedTextures calls source.destroy() only once for atlas-consolidated textures', () => {
    const cache = _getSwapCacheForTesting();
    const destroyCalls: string[] = [];

    // All textures share one source -- destroy should only be called once
    const sharedSource = { destroy() { destroyCalls.push('shared-source'); } };
    const textures = [
      { source: sharedSource, destroy() { destroyCalls.push('tex0'); }, frame: { x: 0 } },
      { source: sharedSource, destroy() { destroyCalls.push('tex1'); }, frame: { x: 32 } },
      { source: sharedSource, destroy() { destroyCalls.push('tex2'); }, frame: { x: 64 } },
      { source: sharedSource, destroy() { destroyCalls.push('tex3'); }, frame: { x: 96 } },
    ] as any;
    cache.set('mage_0_100', textures);

    destroyCachedTextures('mage' as any, 0);

    assert.equal(getSwapCacheSize(), 0, 'cache entry should be removed');
    // All tex.destroy() should be called
    assert.ok(destroyCalls.includes('tex0'), 'tex0 should be destroyed');
    assert.ok(destroyCalls.includes('tex1'), 'tex1 should be destroyed');
    assert.ok(destroyCalls.includes('tex2'), 'tex2 should be destroyed');
    assert.ok(destroyCalls.includes('tex3'), 'tex3 should be destroyed');
    // source.destroy() should be called exactly once (not 4 times)
    const sourceDestroyCount = destroyCalls.filter(c => c === 'shared-source').length;
    assert.equal(sourceDestroyCount, 1,
      `source.destroy() should be called exactly once, was called ${sourceDestroyCount} times`);
  });

  it('cache returns same result on second call (caching works with atlas)', () => {
    const cache = _getSwapCacheForTesting();
    const sharedSource = { destroy() {} };
    const textures = [
      { source: sharedSource, frame: { x: 0 }, destroy() {} },
      { source: sharedSource, frame: { x: 32 }, destroy() {} },
    ] as any;
    cache.set('mage_0_100', textures);

    const first = cache.get('mage_0_100');
    const second = cache.get('mage_0_100');
    assert.strictEqual(first, second, 'cache should return the same reference');
  });
});

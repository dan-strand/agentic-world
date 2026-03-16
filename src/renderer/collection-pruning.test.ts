import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pruneByAge } from './world';

describe('pruneByAge', () => {
  it('entries older than maxAge are pruned, younger entries retained', () => {
    const map = new Map<string, number>();
    const now = 1000000;
    map.set('old-1', now - 40 * 60 * 1000); // 40 minutes ago (older than 30 min)
    map.set('young-1', now - 10 * 60 * 1000); // 10 minutes ago (younger than 30 min)

    const pruned = pruneByAge(map, 30 * 60 * 1000, now);

    assert.equal(pruned, 1, 'Should prune 1 entry');
    assert.equal(map.has('old-1'), false, 'Old entry should be removed');
    assert.equal(map.has('young-1'), true, 'Young entry should remain');
  });

  it('empty map returns 0 pruned', () => {
    const map = new Map<string, number>();
    const pruned = pruneByAge(map, 30 * 60 * 1000, Date.now());
    assert.equal(pruned, 0);
    assert.equal(map.size, 0);
  });

  it('all entries old -> all pruned, count matches', () => {
    const map = new Map<string, number>();
    const now = 1000000;
    map.set('a', now - 60 * 60 * 1000); // 60 min ago
    map.set('b', now - 45 * 60 * 1000); // 45 min ago
    map.set('c', now - 31 * 60 * 1000); // 31 min ago

    const pruned = pruneByAge(map, 30 * 60 * 1000, now);
    assert.equal(pruned, 3, 'Should prune all 3 entries');
    assert.equal(map.size, 0, 'Map should be empty');
  });

  it('mixed ages -> only old ones pruned', () => {
    const map = new Map<string, number>();
    const now = 1000000;
    map.set('old-a', now - 35 * 60 * 1000); // 35 min ago (old)
    map.set('young-a', now - 5 * 60 * 1000); // 5 min ago (young)
    map.set('old-b', now - 120 * 60 * 1000); // 120 min ago (old)
    map.set('young-b', now - 29 * 60 * 1000); // 29 min ago (young, just under threshold)

    const pruned = pruneByAge(map, 30 * 60 * 1000, now);
    assert.equal(pruned, 2, 'Should prune 2 old entries');
    assert.equal(map.size, 2, 'Should retain 2 young entries');
    assert.equal(map.has('young-a'), true);
    assert.equal(map.has('young-b'), true);
    assert.equal(map.has('old-a'), false);
    assert.equal(map.has('old-b'), false);
  });
});

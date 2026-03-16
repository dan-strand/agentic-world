import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkTrend, WINDOW_SIZE, GROWTH_THRESHOLD_MB } from './memory-monitor';

describe('checkTrend', () => {
  it('returns null when fewer than WINDOW_SIZE samples exist', () => {
    const samples = [100, 110, 120]; // only 3, WINDOW_SIZE is 10
    assert.equal(checkTrend(samples, GROWTH_THRESHOLD_MB), null);
  });

  it('returns null when growth is within threshold', () => {
    // 10 samples, newest - oldest = 30MB (under 50MB threshold)
    const samples = Array.from({ length: WINDOW_SIZE }, (_, i) => 100 + i * 3);
    assert.equal(checkTrend(samples, GROWTH_THRESHOLD_MB), null);
  });

  it('returns warning message when growth exceeds threshold', () => {
    // 10 samples, newest - oldest = 60MB (over 50MB threshold)
    const oldest = 100;
    const newest = 160;
    const samples = Array.from({ length: WINDOW_SIZE }, (_, i) =>
      oldest + ((newest - oldest) / (WINDOW_SIZE - 1)) * i
    );
    const result = checkTrend(samples, GROWTH_THRESHOLD_MB);
    assert.ok(result !== null, 'should return a warning message');
    assert.ok(typeof result === 'string', 'warning should be a string');
    assert.ok(result.includes('60.0'), 'should include growth amount');
  });

  it('returns null when growth is exactly at threshold', () => {
    // 10 samples, newest - oldest = 50MB (exactly at threshold, not over)
    const samples = Array.from({ length: WINDOW_SIZE }, (_, i) =>
      100 + (50 / (WINDOW_SIZE - 1)) * i
    );
    assert.equal(checkTrend(samples, GROWTH_THRESHOLD_MB), null);
  });

  it('returns warning when growth is just over threshold', () => {
    // newest - oldest = 50.1MB
    const oldest = 100;
    const newest = 150.1;
    const samples = Array.from({ length: WINDOW_SIZE }, (_, i) =>
      oldest + ((newest - oldest) / (WINDOW_SIZE - 1)) * i
    );
    const result = checkTrend(samples, GROWTH_THRESHOLD_MB);
    assert.ok(result !== null, 'should return a warning for growth > 50MB');
  });
});

describe('MemoryMonitor sliding window', () => {
  it('exports WINDOW_SIZE as 10', () => {
    assert.equal(WINDOW_SIZE, 10);
  });

  it('exports GROWTH_THRESHOLD_MB as 50', () => {
    assert.equal(GROWTH_THRESHOLD_MB, 50);
  });
});

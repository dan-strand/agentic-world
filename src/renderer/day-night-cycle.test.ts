import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// DAY_NIGHT_CYCLE_MS = 10 * 60 * 1000 = 600,000
const DAY_NIGHT_CYCLE_MS = 600_000;

// We can't import directly from the TS source without bundling, so we
// test via a lightweight stub that mirrors the class contract.
// The real verification is that the implementation file uses modulo wrap.
// However, we CAN import since the test runner uses tsx.
import { DayNightCycle } from './day-night-cycle';

describe('DayNightCycle', () => {
  it('elapsed stays bounded after accumulating more than one full cycle', () => {
    const cycle = new DayNightCycle();

    // Tick 1.5 cycles worth of time
    cycle.tick(DAY_NIGHT_CYCLE_MS * 1.5);

    // After modulo wrap, progress should be 0.5 (half a cycle)
    const progress = cycle.getProgress();
    assert.ok(
      Math.abs(progress - 0.5) < 0.001,
      `Expected progress ~0.5 after 1.5 cycles, got ${progress}`,
    );
  });

  it('getProgress returns correct value when elapsed is within one cycle', () => {
    const cycle = new DayNightCycle();

    // Tick 25% of a cycle
    cycle.tick(DAY_NIGHT_CYCLE_MS * 0.25);

    const progress = cycle.getProgress();
    assert.ok(
      Math.abs(progress - 0.25) < 0.001,
      `Expected progress ~0.25, got ${progress}`,
    );
  });

  it('getProgress returns correct value after many cycles (verifying modulo correctness)', () => {
    const cycle = new DayNightCycle();

    // Tick 100.3 cycles -- progress should be 0.3
    cycle.tick(DAY_NIGHT_CYCLE_MS * 100.3);

    const progress = cycle.getProgress();
    assert.ok(
      Math.abs(progress - 0.3) < 0.001,
      `Expected progress ~0.3 after 100.3 cycles, got ${progress}`,
    );
  });

  it('ticking exactly one full cycle returns progress back to ~0', () => {
    const cycle = new DayNightCycle();

    cycle.tick(DAY_NIGHT_CYCLE_MS);

    const progress = cycle.getProgress();
    assert.ok(
      progress < 0.001,
      `Expected progress ~0 after exactly one cycle, got ${progress}`,
    );
  });

  it('getNightIntensity returns a value between 0 and 1 inclusive', () => {
    const cycle = new DayNightCycle();

    // Test at many points throughout the cycle
    for (let i = 0; i <= 100; i++) {
      const testCycle = new DayNightCycle();
      testCycle.tick(DAY_NIGHT_CYCLE_MS * (i / 100));
      const intensity = testCycle.getNightIntensity();
      assert.ok(
        intensity >= 0 && intensity <= 1,
        `getNightIntensity at progress ${i / 100} returned ${intensity}, expected [0, 1]`,
      );
    }
  });
});

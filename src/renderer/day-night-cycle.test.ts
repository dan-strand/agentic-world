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

  it('getTintHex returns warm hex at dawn (progress 0)', () => {
    const cycle = new DayNightCycle();
    // At progress 0: R=Math.round(1.0*255)=255=0xFF, G=Math.round(0.91*255)=232=0xE8, B=Math.round(0.75*255)=191=0xBF
    const hex = cycle.getTintHex();
    assert.strictEqual(hex, 0xFFE8BF, `Expected 0xFFE8BF at dawn, got 0x${hex.toString(16).toUpperCase()}`);
  });

  it('getTintHex returns cool hex at peak night (progress 0.5)', () => {
    const cycle = new DayNightCycle();
    cycle.tick(DAY_NIGHT_CYCLE_MS * 0.5);
    const hex = cycle.getTintHex();
    const r = (hex >> 16) & 0xFF;
    const b = hex & 0xFF;
    assert.ok(r <= 0x66, `Expected R channel <= 0x66 at peak night, got 0x${r.toString(16)}`);
    assert.ok(b >= 0xCC, `Expected B channel >= 0xCC at peak night, got 0x${b.toString(16)}`);
  });

  it('getTintHex returns value in valid hex range for all cycle points', () => {
    for (let i = 0; i <= 100; i++) {
      const cycle = new DayNightCycle();
      cycle.tick(DAY_NIGHT_CYCLE_MS * (i / 100));
      const hex = cycle.getTintHex();
      assert.ok(hex >= 0x000000 && hex <= 0xFFFFFF,
        `getTintHex at progress ${i / 100} returned 0x${hex.toString(16)}, expected [0x000000, 0xFFFFFF]`);
    }
  });

  it('tint hex changes far fewer times than frames over full cycle', () => {
    const cycle = new DayNightCycle();
    const deltaMs = 600000 / 18000; // 33.33ms per tick at 30fps
    const uniqueHexValues = new Set<number>();
    for (let i = 0; i < 18000; i++) {
      cycle.tick(deltaMs);
      uniqueHexValues.add(cycle.getTintHex());
    }
    assert.ok(uniqueHexValues.size >= 30,
      `Expected at least 30 unique hex values, got ${uniqueHexValues.size}`);
    assert.ok(uniqueHexValues.size <= 300,
      `Expected at most 300 unique hex values, got ${uniqueHexValues.size}`);
  });
});

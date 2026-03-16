import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorTracker } from './game-loop';

describe('ErrorTracker', () => {
  it('first error in a new window returns log', () => {
    const tracker = new ErrorTracker();
    assert.equal(tracker.record(1000), 'log');
  });

  it('errors 2-4 within the same window return log', () => {
    const tracker = new ErrorTracker(10_000, 5);
    const now = 1000;
    tracker.record(now);     // 1st
    assert.equal(tracker.record(now + 100), 'log');   // 2nd
    assert.equal(tracker.record(now + 200), 'log');   // 3rd
    assert.equal(tracker.record(now + 300), 'log');   // 4th
  });

  it('5th error within the window returns critical', () => {
    const tracker = new ErrorTracker(10_000, 5);
    const now = 1000;
    tracker.record(now);         // 1st
    tracker.record(now + 100);   // 2nd
    tracker.record(now + 200);   // 3rd
    tracker.record(now + 300);   // 4th
    assert.equal(tracker.record(now + 400), 'critical');  // 5th
  });

  it('error after window expires starts a new window, returns log', () => {
    const tracker = new ErrorTracker(10_000, 5);
    const now = 1000;
    tracker.record(now);         // 1st in window 1
    tracker.record(now + 100);   // 2nd
    tracker.record(now + 200);   // 3rd
    tracker.record(now + 300);   // 4th
    // Window expires after 10 seconds
    assert.equal(tracker.record(now + 11_000), 'log');  // 1st in new window
  });

  it('reset clears count so next error returns log even if previous count was 4', () => {
    const tracker = new ErrorTracker(10_000, 5);
    const now = 1000;
    tracker.record(now);         // 1st
    tracker.record(now + 100);   // 2nd
    tracker.record(now + 200);   // 3rd
    tracker.record(now + 300);   // 4th
    tracker.reset();
    // After reset, next error should start fresh
    assert.equal(tracker.record(now + 400), 'log');   // treated as 1st
  });

  it('custom windowMs and threshold work', () => {
    const tracker = new ErrorTracker(100, 3);
    const now = 1000;
    tracker.record(now);         // 1st
    tracker.record(now + 10);    // 2nd
    assert.equal(tracker.record(now + 20), 'critical');  // 3rd hits threshold=3
  });

  it('6th error also returns critical (stays at critical)', () => {
    const tracker = new ErrorTracker(10_000, 5);
    const now = 1000;
    for (let i = 0; i < 5; i++) {
      tracker.record(now + i * 100);
    }
    assert.equal(tracker.record(now + 500), 'critical');  // 6th
  });
});

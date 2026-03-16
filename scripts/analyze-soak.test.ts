import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMemoryLine,
  analyzeGrowth,
  detectMonotonicTrend,
  countCrashEntries,
} from './analyze-soak';

describe('analyze-soak helpers', () => {
  describe('parseMemoryLine', () => {
    it('extracts heap and rss from a valid [MEMORY] log line', () => {
      const line = '[2026-03-16 19:45:00.123] [info] [MEMORY] heap=45.2MB rss=112.3MB';
      const result = parseMemoryLine(line);
      assert.ok(result, 'should return a result');
      assert.equal(result!.heapMB, 45.2);
      assert.equal(result!.rssMB, 112.3);
      assert.equal(result!.timestamp, '2026-03-16 19:45:00.123');
    });

    it('returns null for non-memory log lines', () => {
      const line = '[2026-03-16 19:45:00.123] [error] [CRASH] renderer: something broke';
      const result = parseMemoryLine(line);
      assert.equal(result, null);
    });
  });

  describe('analyzeGrowth', () => {
    it('returns pass when delta is below threshold', () => {
      const samples = [
        { heapMB: 40 },
        { heapMB: 42 },
        { heapMB: 45 },
        { heapMB: 50 },
        { heapMB: 48 },
      ];
      const result = analyzeGrowth(samples, 50);
      assert.equal(result.pass, true);
      assert.equal(result.firstHeap, 40);
      assert.equal(result.lastHeap, 48);
      assert.equal(result.delta, 8);
      assert.equal(result.min, 40);
      assert.equal(result.max, 50);
    });

    it('returns fail when delta exceeds threshold', () => {
      const samples = [
        { heapMB: 40 },
        { heapMB: 60 },
        { heapMB: 80 },
        { heapMB: 95 },
      ];
      const result = analyzeGrowth(samples, 50);
      assert.equal(result.pass, false);
      assert.equal(result.delta, 55);
    });
  });

  describe('detectMonotonicTrend', () => {
    it('returns isMonotonic=false for sawtooth pattern', () => {
      // Sawtooth: up, down, up, down -- clearly not monotonic
      const values = [10, 20, 15, 25, 18, 28, 22, 30, 25, 35];
      const result = detectMonotonicTrend(values);
      assert.equal(result.isMonotonic, false);
    });

    it('returns isMonotonic=true for strictly increasing values', () => {
      const values = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
      const result = detectMonotonicTrend(values);
      assert.equal(result.isMonotonic, true);
      assert.equal(result.increasingPct, 100);
    });
  });

  describe('countCrashEntries', () => {
    it('counts [CRASH] and [CRITICAL] entries separately', () => {
      const lines = [
        '[2026-03-16 19:45:00.123] [info] [MEMORY] heap=45.2MB rss=112.3MB',
        '[2026-03-16 19:45:01.123] [error] [CRASH] renderer: something broke',
        '[2026-03-16 19:45:02.123] [error] [CRITICAL] main: fatal issue',
        '[2026-03-16 19:45:03.123] [error] [CRASH] gpu: another crash',
        '[2026-03-16 19:45:04.123] [error] [ERROR] minor: not a crash',
      ];
      const result = countCrashEntries(lines);
      assert.equal(result.crashes, 2);
      assert.equal(result.criticals, 1);
      assert.equal(result.errors, 1);
    });

    it('returns zeros for clean log', () => {
      const lines = [
        '[2026-03-16 19:45:00.123] [info] [MEMORY] heap=45.2MB rss=112.3MB',
        '[2026-03-16 19:46:00.123] [info] [MEMORY] heap=46.0MB rss=113.0MB',
      ];
      const result = countCrashEntries(lines);
      assert.equal(result.crashes, 0);
      assert.equal(result.criticals, 0);
      assert.equal(result.errors, 0);
    });
  });
});

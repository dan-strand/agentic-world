import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { SessionStore } from './session-store';
import { POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS, BACKOFF_STEP_MS } from '../shared/constants';
import type { SessionInfo } from '../shared/types';

// -- Mock factories --

function createMockDetector(sessions: SessionInfo[] = []) {
  return {
    discoverSessions: mock.fn(async () => sessions),
    pruneStaleEntries: mock.fn((_ids: Set<string>) => {}),
  };
}

function createMockUsageAggregator() {
  return {
    getUsage: mock.fn(async () => null),
    getUsageWithCost: mock.fn(async () => null),
    clearSession: mock.fn(() => {}),
    pruneStaleEntries: mock.fn((_ids: Set<string>) => {}),
  };
}

function createMockHistoryStore() {
  return {
    recordTodayTotals: mock.fn(() => {}),
    getHistory: mock.fn(async () => []),
  };
}

function createMockWindow() {
  return {
    isDestroyed: () => false,
    webContents: {
      send: mock.fn(() => {}),
    },
  };
}

function makeSession(id: string): SessionInfo {
  return {
    sessionId: id,
    filePath: `/tmp/${id}.jsonl`,
    projectPath: `/home/user/project-${id}`,
    projectName: `Project ${id}`,
    status: 'active',
    lastModified: Date.now(),
    lastEntryType: 'assistant',
    activityType: 'coding',
    lastToolName: 'Edit',
  };
}

describe('SessionStore adaptive backoff', () => {
  let store: SessionStore;
  let detector: ReturnType<typeof createMockDetector>;
  let usageAgg: ReturnType<typeof createMockUsageAggregator>;
  let historyStore: ReturnType<typeof createMockHistoryStore>;
  let mockWindow: ReturnType<typeof createMockWindow>;

  beforeEach(() => {
    detector = createMockDetector([]);
    usageAgg = createMockUsageAggregator();
    historyStore = createMockHistoryStore();
    mockWindow = createMockWindow();
    store = new SessionStore(detector as any, usageAgg as any, historyStore as any);
  });

  afterEach(() => {
    store.stop();
  });

  it('getNextInterval returns POLL_INTERVAL_MS when consecutiveEmpty is 0', () => {
    (store as any).consecutiveEmpty = 0;
    const interval = (store as any).getNextInterval();
    assert.equal(interval, POLL_INTERVAL_MS);
  });

  it('getNextInterval returns POLL_INTERVAL_MS + 1*BACKOFF_STEP_MS when consecutiveEmpty is 1', () => {
    (store as any).consecutiveEmpty = 1;
    const interval = (store as any).getNextInterval();
    assert.equal(interval, POLL_INTERVAL_MS + 1 * BACKOFF_STEP_MS);
  });

  it('getNextInterval returns POLL_INTERVAL_MS + 2*BACKOFF_STEP_MS when consecutiveEmpty is 2', () => {
    (store as any).consecutiveEmpty = 2;
    const interval = (store as any).getNextInterval();
    assert.equal(interval, POLL_INTERVAL_MS + 2 * BACKOFF_STEP_MS);
  });

  it('getNextInterval caps at MAX_POLL_INTERVAL_MS', () => {
    (store as any).consecutiveEmpty = 100;
    const interval = (store as any).getNextInterval();
    assert.equal(interval, MAX_POLL_INTERVAL_MS);
  });

  it('consecutiveEmpty increments on empty poll', async () => {
    // detector returns empty array by default
    assert.equal((store as any).consecutiveEmpty, 0);
    store.start(mockWindow as any);
    // After start(), poll() runs immediately -- wait for it
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal((store as any).consecutiveEmpty, 1);
  });

  it('consecutiveEmpty resets on non-empty poll', async () => {
    (store as any).consecutiveEmpty = 5;
    detector.discoverSessions.mock.mockImplementation(async () => [makeSession('abc')]);
    (store as any).mainWindow = mockWindow;
    await (store as any).poll();
    assert.equal((store as any).consecutiveEmpty, 0);
  });

  it('stop clears pollTimeout', () => {
    store.start(mockWindow as any);
    assert.notEqual((store as any).pollTimeout, null);
    store.stop();
    assert.equal((store as any).pollTimeout, null);
  });
});

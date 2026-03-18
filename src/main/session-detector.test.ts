import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FilesystemSessionDetector } from './session-detector';

// Helper to create a temp directory structure mimicking ~/.claude/projects/
function createTempProjectDir(): { baseDir: string; cleanup: () => void } {
  const baseDir = path.join(os.tmpdir(), `test-detector-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(baseDir, { recursive: true });
  return {
    baseDir,
    cleanup: () => fs.rmSync(baseDir, { recursive: true, force: true }),
  };
}

// Helper to build an assistant entry with tool_use content
function assistantWithToolUse(toolName: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', name: toolName, input: {} }],
      model: 'claude-opus-4-6',
      usage: { input_tokens: 10, output_tokens: 5 },
    },
  });
}

// Valid UUID for test session files
const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('FilesystemSessionDetector', () => {
  const cleanups: Array<() => void> = [];

  after(() => {
    for (const cleanup of cleanups) {
      try { cleanup(); } catch { /* ignore */ }
    }
  });

  it('discoverSessions returns a Promise', async () => {
    const { baseDir, cleanup } = createTempProjectDir();
    cleanups.push(cleanup);

    const detector = new FilesystemSessionDetector(baseDir);
    const result = detector.discoverSessions();
    // Verify it's a Promise (thenable)
    assert.equal(typeof result.then, 'function');
    // Await it to ensure it resolves
    const sessions = await result;
    assert.ok(Array.isArray(sessions));
  });

  it('returns correct SessionInfo for a valid JSONL file with an assistant entry', async () => {
    const { baseDir, cleanup } = createTempProjectDir();
    cleanups.push(cleanup);

    // Create project subdirectory
    const projectDir = path.join(baseDir, 'C--Users-dlaws-Projects-TestProject');
    fs.mkdirSync(projectDir, { recursive: true });

    // Create a UUID.jsonl file with an assistant entry containing tool_use
    const jsonlFile = path.join(projectDir, `${TEST_UUID}.jsonl`);
    const entry = assistantWithToolUse('Edit');
    fs.writeFileSync(jsonlFile, entry + '\n', 'utf-8');

    const detector = new FilesystemSessionDetector(baseDir);
    const sessions = await detector.discoverSessions();

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].sessionId, TEST_UUID);
    assert.equal(sessions[0].lastEntryType, 'assistant');
    assert.equal(sessions[0].lastToolName, 'Edit');
    // File was just written so it should be active
    assert.equal(sessions[0].status, 'active');
  });

  it('handles empty projects directory (returns [])', async () => {
    const { baseDir, cleanup } = createTempProjectDir();
    cleanups.push(cleanup);

    const detector = new FilesystemSessionDetector(baseDir);
    const sessions = await detector.discoverSessions();
    assert.deepEqual(sessions, []);
  });

  it('handles nonexistent projects directory gracefully (returns [])', async () => {
    const nonexistentDir = path.join(os.tmpdir(), `nonexistent-detector-${Date.now()}`);
    const detector = new FilesystemSessionDetector(nonexistentDir);
    const sessions = await detector.discoverSessions();
    assert.deepEqual(sessions, []);
  });

  it('handles ENOENT when file deleted between readdir and stat', async () => {
    const { baseDir, cleanup } = createTempProjectDir();
    cleanups.push(cleanup);

    // Create project subdirectory with a JSONL file
    const projectDir = path.join(baseDir, 'C--Users-dlaws-Projects-Ephemeral');
    fs.mkdirSync(projectDir, { recursive: true });
    const jsonlFile = path.join(projectDir, `${TEST_UUID}.jsonl`);
    fs.writeFileSync(jsonlFile, assistantWithToolUse('Read') + '\n', 'utf-8');

    // Delete the file right after creating it (simulates race condition)
    fs.unlinkSync(jsonlFile);

    const detector = new FilesystemSessionDetector(baseDir);
    // Should not crash -- ENOENT during processSessionFile is caught
    const sessions = await detector.discoverSessions();
    assert.equal(sessions.length, 0);
  });

  it('skips non-JSONL files and subdirectories', async () => {
    const { baseDir, cleanup } = createTempProjectDir();
    cleanups.push(cleanup);

    const projectDir = path.join(baseDir, 'C--Users-dlaws-Projects-Mixed');
    fs.mkdirSync(projectDir, { recursive: true });

    // Create a valid UUID.jsonl file
    const validFile = path.join(projectDir, `${TEST_UUID}.jsonl`);
    fs.writeFileSync(validFile, assistantWithToolUse('Bash') + '\n', 'utf-8');

    // Create non-JSONL files that should be skipped
    fs.writeFileSync(path.join(projectDir, 'notes.txt'), 'not a jsonl file', 'utf-8');
    fs.writeFileSync(path.join(projectDir, 'config.json'), '{}', 'utf-8');
    fs.writeFileSync(path.join(projectDir, 'not-a-uuid.jsonl'), '{}', 'utf-8');

    // Create a subdirectory that should be skipped
    fs.mkdirSync(path.join(projectDir, 'subdir'), { recursive: true });

    const detector = new FilesystemSessionDetector(baseDir);
    const sessions = await detector.discoverSessions();

    // Only the valid UUID.jsonl file should be processed
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].sessionId, TEST_UUID);
  });

  it('determineStatus returns correct status for each entry type', () => {
    const { baseDir, cleanup } = createTempProjectDir();
    cleanups.push(cleanup);

    const detector = new FilesystemSessionDetector(baseDir);
    const now = Date.now();

    // Recent assistant without tool_use -- active (< 2s)
    assert.equal(detector.determineStatus('assistant', now - 500, now, false), 'active');
    // Older assistant without tool_use -- waiting
    assert.equal(detector.determineStatus('assistant', now - 5000, now, false), 'waiting');
    // Older assistant with tool_use -- active (tool executing)
    assert.equal(detector.determineStatus('assistant', now - 5000, now, true), 'active');
    // User entry -- active
    assert.equal(detector.determineStatus('user', now - 1000, now), 'active');
    // Progress entry -- active
    assert.equal(detector.determineStatus('progress', now - 1000, now), 'active');
    // System entry recent -- active
    assert.equal(detector.determineStatus('system', now - 1000, now), 'active');
    // System entry older -- waiting
    assert.equal(detector.determineStatus('system', now - 10000, now), 'waiting');
    // Anything beyond idle threshold -- idle
    assert.equal(detector.determineStatus('assistant', now - 60000, now), 'idle');
    assert.equal(detector.determineStatus('user', now - 60000, now), 'idle');
  });
});

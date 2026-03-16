import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateJsonlEntry, generateSessionId, parseArgs } from './soak-test';

describe('soak-test helpers', () => {
  describe('generateJsonlEntry', () => {
    it('generates valid JSON with type field for user entries', () => {
      const line = generateJsonlEntry('user');
      const parsed = JSON.parse(line);
      assert.equal(parsed.type, 'user');
      assert.ok(parsed.timestamp, 'should have timestamp');
      assert.ok(parsed.message, 'should have message');
    });

    it('generates assistant entries with message.usage structure', () => {
      const line = generateJsonlEntry('assistant');
      const parsed = JSON.parse(line);
      assert.equal(parsed.type, 'assistant');
      assert.ok(parsed.message, 'should have message');
      assert.ok(parsed.message.usage, 'should have usage');
      assert.equal(typeof parsed.message.usage.input_tokens, 'number');
      assert.equal(typeof parsed.message.usage.output_tokens, 'number');
    });

    it('generates progress entries with tool_name', () => {
      const line = generateJsonlEntry('progress', 'Edit');
      const parsed = JSON.parse(line);
      assert.equal(parsed.type, 'progress');
      assert.equal(parsed.tool_name, 'Edit');
      assert.ok(parsed.timestamp, 'should have timestamp');
    });
  });

  describe('generateSessionId', () => {
    it('returns a UUID-format string', () => {
      const id = generateSessionId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      assert.match(id, uuidRegex);
    });
  });

  describe('parseArgs', () => {
    it('returns defaults when given empty argv', () => {
      const result = parseArgs([]);
      assert.ok(result.dir.includes('.claude'), 'default dir should reference .claude');
      assert.equal(result.duration, 8);
      assert.equal(result.sessions, 4);
    });

    it('overrides duration and sessions from argv', () => {
      const result = parseArgs(['--duration', '2', '--sessions', '6']);
      assert.equal(result.duration, 2);
      assert.equal(result.sessions, 6);
    });
  });
});

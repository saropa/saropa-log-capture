import * as assert from 'node:assert';
import test from 'node:test';
import {
  classifySibling,
  type MirrorSnapshot,
} from '../../../modules/diagnostics/suite-connection-classify';

const present: MirrorSnapshot = { findingCount: 3, capturedCommit: 'abc123', generatedAt: '2026-06-14T00:00:00Z' };

test('classifySibling: not installed → notInstalled, no cause', () => {
  const c = classifySibling('advisor', false, undefined, 'abc123');
  assert.strictEqual(c.state, 'notInstalled');
  assert.strictEqual(c.cause, undefined);
});

test('classifySibling: installed but no mirror → silent / noMirror', () => {
  const c = classifySibling('lints', true, undefined, 'abc123');
  assert.strictEqual(c.state, 'silent');
  assert.strictEqual(c.cause, 'noMirror');
});

test('classifySibling: installed + fresh mirror at current commit → connected', () => {
  const c = classifySibling('advisor', true, present, 'abc123');
  assert.strictEqual(c.state, 'connected');
  assert.strictEqual(c.cause, undefined);
  assert.strictEqual(c.findingCount, 3);
  assert.strictEqual(c.capturedCommit, 'abc123');
});

test('classifySibling: mirror at a different commit → silent / stale', () => {
  const c = classifySibling('advisor', true, present, 'def456');
  assert.strictEqual(c.state, 'silent');
  assert.strictEqual(c.cause, 'stale');
  // facts still surfaced so the notice can say how old the data is
  assert.strictEqual(c.findingCount, 3);
  assert.strictEqual(c.capturedCommit, 'abc123');
});

test('classifySibling: current commit unknown → never guesses stale (connected)', () => {
  const c = classifySibling('advisor', true, present, undefined);
  assert.strictEqual(c.state, 'connected');
});

test('classifySibling: mirror has no captured commit → never guesses stale (connected)', () => {
  const noCommit: MirrorSnapshot = { findingCount: 0, generatedAt: '2026-06-14T00:00:00Z' };
  const c = classifySibling('lints', true, noCommit, 'abc123');
  assert.strictEqual(c.state, 'connected');
  assert.strictEqual(c.findingCount, 0);
});

test('classifySibling: present mirror with zero findings is connected (shared, nothing to report)', () => {
  const empty: MirrorSnapshot = { findingCount: 0, capturedCommit: 'abc123' };
  const c = classifySibling('lints', true, empty, 'abc123');
  assert.strictEqual(c.state, 'connected');
});

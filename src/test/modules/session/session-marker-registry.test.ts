/**
 * Tests for the in-memory marker registry backing `insertMarker`/`getSignalDelta` (PLAN 119).
 * Pure — the module only type-imports `vscode` (erased at compile time), so this runs under
 * plain `node --test` with no stub needed.
 *
 * Runs standalone via `node --test out/test/modules/session/session-marker-registry.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { MarkerRegistry } from '../../../modules/session/session-marker-registry';

function fields() {
    return {
        sessionKey: 'debug-session-1',
        baseFileName: '20260917_120000_myapp',
        logDirUri: { fsPath: '/fake/log/dir' } as unknown as import('vscode').Uri,
        partNumber: 0,
        physicalLineIndex: 42,
    };
}

test('record: returns an id that resolve() can look back up', () => {
    const registry = new MarkerRegistry();
    const id = registry.record(fields());
    const resolved = registry.resolve(id);
    assert.ok(resolved);
    assert.strictEqual(resolved.sessionKey, 'debug-session-1');
    assert.strictEqual(resolved.partNumber, 0);
    assert.strictEqual(resolved.physicalLineIndex, 42);
    assert.strictEqual(resolved.id, id);
});

test('resolve: unknown id returns undefined', () => {
    const registry = new MarkerRegistry();
    assert.strictEqual(registry.resolve('never-recorded'), undefined);
});

test('record: back-to-back calls in the same tick produce distinct ids', () => {
    const registry = new MarkerRegistry();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
        ids.add(registry.record({ ...fields(), physicalLineIndex: i }));
    }
    assert.strictEqual(ids.size, 50);
});

test('record: each marker keeps its own recorded fields independent of later markers', () => {
    const registry = new MarkerRegistry();
    const first = registry.record({ ...fields(), partNumber: 0, physicalLineIndex: 10 });
    const second = registry.record({ ...fields(), partNumber: 1, physicalLineIndex: 3 });
    assert.strictEqual(registry.resolve(first)?.partNumber, 0);
    assert.strictEqual(registry.resolve(first)?.physicalLineIndex, 10);
    assert.strictEqual(registry.resolve(second)?.partNumber, 1);
    assert.strictEqual(registry.resolve(second)?.physicalLineIndex, 3);
});

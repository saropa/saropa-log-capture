/**
 * Tests for the in-memory marker registry backing `insertMarker`/`getSignalDelta` (PLAN 119).
 * Pure — the module only type-imports `vscode` (erased at compile time), so this runs under
 * plain `node --test` with no stub needed.
 *
 * The two-phase record/settle shape is the point: a marker id has to be handed back synchronously
 * while its file position is only knowable once the append queue reaches the write, so the tests
 * below pin that a pending marker is visibly pending, that waiters are released on settle and on
 * discard (not just on timeout), and that the map does not grow without bound.
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
    };
}

test('record: returns an id that resolve() can look back up', () => {
    const registry = new MarkerRegistry();
    const id = registry.record(fields());
    const resolved = registry.resolve(id);
    assert.ok(resolved);
    assert.strictEqual(resolved.sessionKey, 'debug-session-1');
    assert.strictEqual(resolved.baseFileName, '20260917_120000_myapp');
    assert.strictEqual(resolved.id, id);
});

test('record: a fresh marker has no position until it is settled', () => {
    const registry = new MarkerRegistry();
    const id = registry.record(fields());
    assert.strictEqual(registry.resolve(id)?.position, undefined);

    registry.settle(id, { partNumber: 2, physicalLineIndex: 41 });
    assert.deepStrictEqual(registry.resolve(id)?.position, { partNumber: 2, physicalLineIndex: 41 });
});

test('settle: an unknown id is ignored rather than resurrected', () => {
    const registry = new MarkerRegistry();
    registry.settle('never-recorded', { partNumber: 0, physicalLineIndex: 1 });
    assert.strictEqual(registry.resolve('never-recorded'), undefined);
});

test('resolve: unknown id returns undefined', () => {
    const registry = new MarkerRegistry();
    assert.strictEqual(registry.resolve('never-recorded'), undefined);
});

test('discard: drops a reserved marker that will never be written', () => {
    const registry = new MarkerRegistry();
    const id = registry.record(fields());
    registry.discard(id);
    assert.strictEqual(registry.resolve(id), undefined);
});

test('waitForPosition: returns immediately when already settled', async () => {
    const registry = new MarkerRegistry();
    const id = registry.record(fields());
    registry.settle(id, { partNumber: 1, physicalLineIndex: 7 });

    const resolved = await registry.waitForPosition(id, 50);
    assert.deepStrictEqual(resolved?.position, { partNumber: 1, physicalLineIndex: 7 });
});

test('waitForPosition: resolves as soon as a pending marker settles', async () => {
    const registry = new MarkerRegistry();
    const id = registry.record(fields());
    // Generous timeout: the assertion is that settling releases the waiter, not that it times out.
    const pending = registry.waitForPosition(id, 5_000);
    setTimeout(() => registry.settle(id, { partNumber: 0, physicalLineIndex: 12 }), 5);

    const resolved = await pending;
    assert.deepStrictEqual(resolved?.position, { partNumber: 0, physicalLineIndex: 12 });
});

test('waitForPosition: releases on discard instead of hanging to the timeout', async () => {
    const registry = new MarkerRegistry();
    const id = registry.record(fields());
    const pending = registry.waitForPosition(id, 30_000);
    setTimeout(() => registry.discard(id), 5);

    assert.strictEqual(await pending, undefined);
});

test('waitForPosition: gives up on a marker that is never written', async () => {
    const registry = new MarkerRegistry();
    const id = registry.record(fields());

    const resolved = await registry.waitForPosition(id, 20);
    // Still known, just never written — the caller has to check for a position, not for the record.
    assert.ok(resolved);
    assert.strictEqual(resolved.position, undefined);
});

test('waitForPosition: an unknown id resolves undefined without waiting', async () => {
    const registry = new MarkerRegistry();
    assert.strictEqual(await registry.waitForPosition('never-recorded', 30_000), undefined);
});

test('record: back-to-back calls in the same tick produce distinct ids', () => {
    const registry = new MarkerRegistry();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) { ids.add(registry.record(fields())); }
    assert.strictEqual(ids.size, 50);
});

test('record: each marker keeps its own settled position independent of later markers', () => {
    const registry = new MarkerRegistry();
    const first = registry.record(fields());
    const second = registry.record(fields());
    registry.settle(first, { partNumber: 0, physicalLineIndex: 10 });
    registry.settle(second, { partNumber: 1, physicalLineIndex: 3 });

    assert.deepStrictEqual(registry.resolve(first)?.position, { partNumber: 0, physicalLineIndex: 10 });
    assert.deepStrictEqual(registry.resolve(second)?.position, { partNumber: 1, physicalLineIndex: 3 });
});

test('record: evicts oldest-first instead of growing without bound', () => {
    const registry = new MarkerRegistry();
    const ids: string[] = [];
    // Well past the internal cap — a command-catalog caller adds two markers per run, for the
    // lifetime of the window, so an unbounded map is a slow leak rather than a theoretical one.
    for (let i = 0; i < 1_200; i++) { ids.push(registry.record(fields())); }

    assert.ok(registry.size <= 500, `expected the registry to stay capped, saw ${registry.size}`);
    assert.strictEqual(registry.resolve(ids[0]), undefined, 'oldest marker should be evicted');
    assert.ok(registry.resolve(ids[ids.length - 1]), 'newest marker must survive');
});

test('eviction: a waiter on an evicted marker is released, not stranded', async () => {
    const registry = new MarkerRegistry();
    const first = registry.record(fields());
    const pending = registry.waitForPosition(first, 30_000);
    for (let i = 0; i < 600; i++) { registry.record(fields()); }

    assert.strictEqual(await pending, undefined);
});

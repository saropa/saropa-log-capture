/**
 * Tests for `getSignalDelta`'s entry-point guards (PLAN 119) — the checks that decide whether a
 * pair of marker ids can be turned into a window at all, before any log file is touched.
 *
 * These run against a stand-in for `SessionManagerImpl` exposing only the two members the function
 * actually uses, so the guards are exercised without an extension host. The disk read past them is
 * covered by `signal-delta.test.ts`; what matters here is that a request which cannot be answered
 * honestly returns `undefined` instead of a confident, wrong delta.
 *
 * Runs standalone via `node --test out/test/api/signal-delta-api.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { getSignalDelta } from '../../api-signal-delta';
import type { SessionManagerImpl } from '../../modules/session/session-manager';
import { MarkerRegistry, type MarkerPosition } from '../../modules/session/session-marker-registry';

const logDirUri = { fsPath: '/fake/log/dir' } as unknown as import('vscode').Uri;

/**
 * Minimal stand-in for the two `SessionManagerImpl` members `getSignalDelta` consumes, backed by a
 * real `MarkerRegistry` so the record/settle semantics under test are the production ones.
 */
function fakeManager(registry: MarkerRegistry, live?: { partNumber: number; physicalLineCount: number }) {
    return {
        waitForMarkerPosition: (id: string, timeoutMs: number) => registry.waitForPosition(id, timeoutMs),
        getLiveSessionState: () => live,
    } as unknown as SessionManagerImpl;
}

function addMarker(
    registry: MarkerRegistry,
    over: { sessionKey?: string; baseFileName?: string; position?: MarkerPosition } = {},
): string {
    const id = registry.record({
        sessionKey: over.sessionKey ?? 'session-a',
        baseFileName: over.baseFileName ?? '20260917_120000_myapp',
        logDirUri,
    });
    if (over.position) { registry.settle(id, over.position); }
    return id;
}

test('getSignalDelta: an unknown since marker returns undefined', async () => {
    const registry = new MarkerRegistry();
    const result = await getSignalDelta(fakeManager(registry), 'mk_never_recorded');
    assert.strictEqual(result, undefined);
});

test('getSignalDelta: a since marker whose write never landed returns undefined', async () => {
    // Recorded but never settled — the marker was refused or is stuck behind a paused queue. There
    // is no boundary to slice on, and guessing one would silently misattribute every signal.
    const registry = new MarkerRegistry();
    const since = addMarker(registry);
    const result = await getSignalDelta(fakeManager(registry), since);
    assert.strictEqual(result, undefined);
});

test('getSignalDelta: an unknown until marker returns undefined', async () => {
    const registry = new MarkerRegistry();
    const since = addMarker(registry, { position: { partNumber: 0, physicalLineIndex: 10 } });
    const result = await getSignalDelta(fakeManager(registry), since, 'mk_never_recorded');
    assert.strictEqual(result, undefined);
});

test('getSignalDelta: an unsettled until marker returns undefined', async () => {
    const registry = new MarkerRegistry();
    const since = addMarker(registry, { position: { partNumber: 0, physicalLineIndex: 10 } });
    const until = addMarker(registry);
    const result = await getSignalDelta(fakeManager(registry), since, until);
    assert.strictEqual(result, undefined);
});

test('getSignalDelta: markers from two different debug sessions are refused', async () => {
    // Reachable in normal use — a bracketed command (an install, a `pm clear`) can restart the app
    // and therefore the debug session. The second marker's offsets mean nothing against the first
    // session's files, so applying them would read an arbitrary slice.
    const registry = new MarkerRegistry();
    const since = addMarker(registry, { sessionKey: 'session-a', position: { partNumber: 0, physicalLineIndex: 10 } });
    const until = addMarker(registry, { sessionKey: 'session-b', position: { partNumber: 0, physicalLineIndex: 90 } });

    const result = await getSignalDelta(fakeManager(registry), since, until);
    assert.strictEqual(result, undefined);
});

test('getSignalDelta: markers naming two different log files are refused', async () => {
    // Same guard from the other direction: one debug session id, but the markers were recorded
    // against different base file names, so their line offsets are not comparable either.
    const registry = new MarkerRegistry();
    const since = addMarker(registry, { baseFileName: 'run_one', position: { partNumber: 0, physicalLineIndex: 10 } });
    const until = addMarker(registry, { baseFileName: 'run_two', position: { partNumber: 0, physicalLineIndex: 90 } });

    const result = await getSignalDelta(fakeManager(registry), since, until);
    assert.strictEqual(result, undefined);
});

test('getSignalDelta: two settled markers on one session get past the guards', async () => {
    // The disk read behind the guards finds nothing under the test stub, so this asserts the shape
    // rather than the contents: a delta was produced instead of a refusal.
    const registry = new MarkerRegistry();
    const since = addMarker(registry, { position: { partNumber: 0, physicalLineIndex: 10 } });
    const until = addMarker(registry, { position: { partNumber: 0, physicalLineIndex: 90 } });

    const result = await getSignalDelta(fakeManager(registry), since, until);
    assert.ok(result, 'expected a delta, not a refusal');
    assert.ok(Array.isArray(result.newSignals));
    assert.ok(Array.isArray(result.resolvedSignals));
});

test('getSignalDelta: omitting the until marker resolves against the live session', async () => {
    const registry = new MarkerRegistry();
    const since = addMarker(registry, { position: { partNumber: 0, physicalLineIndex: 10 } });
    const manager = fakeManager(registry, { partNumber: 0, physicalLineCount: 400 });

    const result = await getSignalDelta(manager, since);
    assert.ok(result, 'a live session supplies the "now" bound');
});

test('getSignalDelta: omitting the until marker works for an ended session too', async () => {
    // No live state — the bound comes from probing the last part on disk instead of throwing.
    const registry = new MarkerRegistry();
    const since = addMarker(registry, { position: { partNumber: 0, physicalLineIndex: 10 } });

    const result = await getSignalDelta(fakeManager(registry), since);
    assert.ok(result);
});

test('getSignalDelta: waits for a since marker that settles after the call starts', async () => {
    // The caller can legitimately ask before a very fast command's marker write has drained.
    const registry = new MarkerRegistry();
    const since = addMarker(registry);
    setTimeout(() => registry.settle(since, { partNumber: 0, physicalLineIndex: 10 }), 5);

    const result = await getSignalDelta(fakeManager(registry), since);
    assert.ok(result, 'a marker that settles during the call must not be treated as missing');
});

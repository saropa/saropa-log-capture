/**
 * Tests for the pure issue-snapshot history shaper. Pins the compaction (id + count only), the
 * collapse-identical-consecutive-states behavior (so rapid refreshes don't flood the history), and
 * the retention cap — the invariants regression / new-issue detection rely on.
 *
 * Runs standalone via `node --test out/test/modules/crashlytics/crashlytics-issue-history.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import {
    toSnapshot, appendSnapshot, newSinceLastSnapshot, selectAlerts,
} from '../../../modules/crashlytics/crashlytics-issue-history';
import type { IssueSnapshot } from '../../../modules/crashlytics/crashlytics-issue-history';
import type { CrashlyticsIssue } from '../../../modules/crashlytics/crashlytics-types';

function issue(id: string, eventCount: number): CrashlyticsIssue {
    return { id, title: id, subtitle: '', eventCount, userCount: 1, isFatal: true, state: 'UNKNOWN' };
}

/** Snapshot from a list of ids (counts irrelevant to the diff). */
function snap(cachedAt: number, ids: string[]): IssueSnapshot {
    return { cachedAt, issues: ids.map(id => ({ id, eventCount: 1 })) };
}

test('toSnapshot: keeps only id + eventCount', () => {
    const snap = toSnapshot([issue('a', 5)], 1000);
    assert.deepStrictEqual(snap, { cachedAt: 1000, issues: [{ id: 'a', eventCount: 5 }] });
});

test('appendSnapshot: grows when the id set changes', () => {
    const h0 = appendSnapshot([], toSnapshot([issue('a', 1)], 1));
    const h1 = appendSnapshot(h0, toSnapshot([issue('a', 1), issue('b', 1)], 2));
    assert.strictEqual(h1.length, 2);
});

test('appendSnapshot: replaces the last entry when the id set is unchanged', () => {
    const h0 = appendSnapshot([], toSnapshot([issue('a', 1)], 1));
    const h1 = appendSnapshot(h0, toSnapshot([issue('a', 9)], 2)); // same id 'a', new count/time
    assert.strictEqual(h1.length, 1);
    assert.strictEqual(h1[0].cachedAt, 2);
    assert.strictEqual(h1[0].issues[0].eventCount, 9);
});

test('appendSnapshot: caps to max, dropping the oldest', () => {
    let h: ReturnType<typeof appendSnapshot> = [];
    for (let i = 0; i < 5; i++) { h = appendSnapshot(h, toSnapshot([issue('id' + i, 1)], i), 3); }
    assert.strictEqual(h.length, 3);
    assert.strictEqual(h[0].cachedAt, 2, 'oldest two dropped');
    assert.strictEqual(h[2].cachedAt, 4, 'newest kept');
});

test('newSinceLastSnapshot: ids in the latest snapshot but not the previous one', () => {
    const news = newSinceLastSnapshot([snap(1, ['a']), snap(2, ['a', 'b'])]);
    assert.ok(news.has('b') && !news.has('a'));
    assert.strictEqual(newSinceLastSnapshot([snap(1, ['a'])]).size, 0, 'needs >=2 snapshots');
});

test('selectAlerts: alerts a new id once, not again while it persists', () => {
    const history = [snap(1, ['a']), snap(2, ['a', 'b'])];
    const first = selectAlerts(history, []);
    assert.deepStrictEqual(first.toAlert, ['b']);
    // Same history, b already alerted → nothing new.
    const second = selectAlerts(history, first.nextAlerted);
    assert.deepStrictEqual(second.toAlert, []);
});

test('selectAlerts: a vanished id is pruned from the gate, so its return re-alerts', () => {
    // Step 1: b present and already alerted, then b vanishes → pruned from the gate.
    const afterVanish = selectAlerts([snap(1, ['a', 'b']), snap(2, ['a'])], ['a', 'b']);
    assert.ok(!afterVanish.nextAlerted.includes('b'), 'b pruned when it vanishes');
    // Step 2: b returns → re-alerts because it is no longer in the gate.
    const afterReturn = selectAlerts([snap(2, ['a']), snap(3, ['a', 'b'])], afterVanish.nextAlerted);
    assert.deepStrictEqual(afterReturn.toAlert, ['b']);
});

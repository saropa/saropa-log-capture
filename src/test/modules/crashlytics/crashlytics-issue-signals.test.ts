/**
 * Tests for locally-derived issue signals (the "repetitive" tag). Pins that an issue spanning more
 * than one app version is flagged, and that single-version / missing-version issues are not — so a
 * future API mapping change can't silently turn the badge on or off for every issue.
 *
 * Uses the `node:test` API so it runs standalone via
 * `node --test out/test/modules/crashlytics/crashlytics-issue-signals.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { isRepetitive, detectRegressedIds, deriveIssueSignals } from '../../../modules/crashlytics/crashlytics-issue-signals';
import type { CrashlyticsIssue } from '../../../modules/crashlytics/crashlytics-types';
import type { IssueSnapshot } from '../../../modules/crashlytics/crashlytics-issue-history';

function issue(over: Partial<CrashlyticsIssue>): CrashlyticsIssue {
    return {
        id: 'apps/x/1', title: 't', subtitle: 's', eventCount: 1, userCount: 1,
        isFatal: true, state: 'UNKNOWN', ...over,
    };
}

/** Build a snapshot from a list of issue ids (counts are irrelevant to regression detection). */
function snap(cachedAt: number, ids: string[]): IssueSnapshot {
    return { cachedAt, issues: ids.map(id => ({ id, eventCount: 1 })) };
}

test('isRepetitive: true when first and last version differ', () => {
    assert.strictEqual(isRepetitive(issue({ firstVersion: '100', lastVersion: '105' })), true);
});

test('isRepetitive: false when versions are equal', () => {
    assert.strictEqual(isRepetitive(issue({ firstVersion: '105', lastVersion: '105' })), false);
});

test('isRepetitive: false when either version is missing', () => {
    assert.strictEqual(isRepetitive(issue({ firstVersion: '105' })), false);
    assert.strictEqual(isRepetitive(issue({ lastVersion: '105' })), false);
    assert.strictEqual(isRepetitive(issue({})), false);
});

test('deriveIssueSignals: sets repetitive without mutating the input', () => {
    const input = [issue({ firstVersion: '100', lastVersion: '105' }), issue({ firstVersion: '105', lastVersion: '105' })];
    const out = deriveIssueSignals(input);
    assert.strictEqual(out[0].repetitive, true);
    assert.strictEqual(out[1].repetitive, false);
    assert.strictEqual((input[0] as CrashlyticsIssue & { repetitive?: boolean }).repetitive, undefined, 'input not mutated');
});

test('detectRegressedIds: flags an id that was present, vanished, then returned', () => {
    // earlier: a present; previous: a absent; now: a back → regressed.
    const history = [snap(1, ['a', 'b']), snap(2, ['b']), snap(3, ['a', 'b'])];
    const regressed = detectRegressedIds(history);
    assert.ok(regressed.has('a'));
    assert.ok(!regressed.has('b'), 'b never went away — not regressed');
});

test('detectRegressedIds: needs >=3 states and a real gap', () => {
    assert.strictEqual(detectRegressedIds([snap(1, ['a']), snap(2, ['a'])]).size, 0, 'only 2 states');
    // a present in last two but never absent in the immediately-previous → not regressed.
    assert.strictEqual(detectRegressedIds([snap(1, ['a']), snap(2, ['a']), snap(3, ['a'])]).size, 0);
});

test('deriveIssueSignals: marks regressed issues from history', () => {
    const history = [snap(1, ['apps/x/1']), snap(2, []), snap(3, ['apps/x/1'])];
    const out = deriveIssueSignals([issue({})], history);
    assert.strictEqual(out[0].regressed, true);
});

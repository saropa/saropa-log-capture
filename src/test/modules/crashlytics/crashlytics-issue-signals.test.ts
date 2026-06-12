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
import { isRepetitive, deriveIssueSignals } from '../../../modules/crashlytics/crashlytics-issue-signals';
import type { CrashlyticsIssue } from '../../../modules/crashlytics/crashlytics-types';

function issue(over: Partial<CrashlyticsIssue>): CrashlyticsIssue {
    return {
        id: 'apps/x/1', title: 't', subtitle: 's', eventCount: 1, userCount: 1,
        isFatal: true, state: 'UNKNOWN', ...over,
    };
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

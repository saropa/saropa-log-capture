/**
 * Tests for `parseVersionDate` — deriving a release date from an Android versionCode.
 *
 * These pin the disambiguation precedence and the conservative "real calendar date or null" contract,
 * so a future change that starts mis-reading plain counters as dates is caught here rather than
 * silently mis-grouping issues in the Crashlytics panel.
 */

import * as assert from 'assert';
import { parseVersionDate } from '../../../modules/crashlytics/version-date';

suite('version-date: parseVersionDate', () => {
    test('reads yyyymmdd + 2-digit build seq from a 10-digit code', () => {
        const r = parseVersionDate('2026012501');
        assert.ok(r);
        assert.strictEqual(r?.ymd, '2026-01-25');
        assert.strictEqual(r?.format, 'yyyymmddNN');
        assert.strictEqual(r?.buildSeq, 1);
    });

    test('reads a plain 8-digit yyyymmdd code with no build seq', () => {
        const r = parseVersionDate('20260125');
        assert.strictEqual(r?.ymd, '2026-01-25');
        assert.strictEqual(r?.format, 'yyyymmdd');
        assert.strictEqual(r?.buildSeq, undefined);
    });

    test('falls back to ddmmyyyy when yyyymmdd is out of the year window', () => {
        // 2501… would be year 2501 (rejected) → ddmmyyyy reading is 25-01-2026.
        const r = parseVersionDate('25012026');
        assert.strictEqual(r?.ymd, '2026-01-25');
        assert.strictEqual(r?.format, 'ddmmyyyy');
    });

    test('falls back to mmddyyyy when yyyymmdd and ddmmyyyy are both invalid', () => {
        // 0125… year 0125 rejected; ddmmyyyy month 25 invalid; mmddyyyy = 01-25-2026.
        const r = parseVersionDate('01252026');
        assert.strictEqual(r?.ymd, '2026-01-25');
        assert.strictEqual(r?.format, 'mmddyyyy');
    });

    test('reads a 6-digit yymmdd code as 20yy', () => {
        const r = parseVersionDate('260125');
        assert.strictEqual(r?.ymd, '2026-01-25');
        assert.strictEqual(r?.format, 'yymmdd');
    });

    test('strips non-digit separators before parsing', () => {
        assert.strictEqual(parseVersionDate('2026.01.25-01')?.ymd, '2026-01-25');
    });

    test('honors leap years — Feb 29 valid in 2024, rejected in 2026', () => {
        assert.strictEqual(parseVersionDate('20240229')?.ymd, '2024-02-29');
        assert.strictEqual(parseVersionDate('20260229'), null);
    });

    test('rejects impossible month/day', () => {
        assert.strictEqual(parseVersionDate('20261301'), null); // month 13
        assert.strictEqual(parseVersionDate('20260132'), null); // day 32
    });

    test('returns null for plain counters and semantic versions', () => {
        assert.strictEqual(parseVersionDate('10402'), null);  // 5 digits, not a date layout
        assert.strictEqual(parseVersionDate('4521'), null);   // 4 digits
        assert.strictEqual(parseVersionDate('52'), null);     // tiny counter
        assert.strictEqual(parseVersionDate('123456789012'), null); // 12 digits, no layout
    });

    test('returns null for an 8-digit number that is no valid date in any layout', () => {
        // 99999999: every layout yields an impossible month/day or out-of-window year.
        assert.strictEqual(parseVersionDate('99999999'), null);
    });

    test('returns null for empty / undefined input', () => {
        assert.strictEqual(parseVersionDate(''), null);
        assert.strictEqual(parseVersionDate(undefined), null);
        assert.strictEqual(parseVersionDate(null), null);
    });
});

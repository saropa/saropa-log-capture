/**
 * Tests for the pure DAILY-rows → per-issue series shaper behind the list trend mini-chart. Pins
 * grouping by issueId, ordering by day (so the sparkline reads in time order regardless of row order),
 * and tolerance of missing dimensions/metrics.
 *
 * Runs standalone via `node --test out/test/modules/crashlytics/play-reporting-trends.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { buildTrends } from '../../../modules/crashlytics/play-reporting-trends';

/** A DAILY row for one issue on a given day-of-June-2026 with a given count. */
function row(issueId: string, day: number, count: number): Record<string, unknown> {
    return {
        dimensions: [{ dimension: 'issueId', stringValue: issueId }],
        startTime: { year: 2026, month: 6, day },
        metrics: [{ metric: 'errorReportCount', decimalValue: { value: String(count) } }],
    };
}

test('buildTrends: groups by issue and orders counts by day', () => {
    // Rows intentionally out of date order; output must be oldest→newest.
    const json = { rows: [row('a', 3, 5), row('a', 1, 2), row('b', 2, 9)] };
    const out = buildTrends(json);
    assert.deepStrictEqual(out.a, [2, 5]);
    assert.deepStrictEqual(out.b, [9]);
});

test('buildTrends: empty / missing input yields an empty map', () => {
    assert.deepStrictEqual(buildTrends(undefined), {});
    assert.deepStrictEqual(buildTrends({}), {});
    assert.deepStrictEqual(buildTrends({ rows: [] }), {});
});

test('buildTrends: rows without an issueId are skipped', () => {
    const json = { rows: [{ startTime: { year: 2026, month: 6, day: 1 }, metrics: [] }, row('a', 1, 4)] };
    const out = buildTrends(json);
    assert.deepStrictEqual(Object.keys(out), ['a']);
});

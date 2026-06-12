/**
 * Tests for the pure by-name Vitals metric extraction. Pins selection BY NAME (not "first metric")
 * now that the crash query returns both crashRate and userPerceivedCrashRate, percent conversion, and
 * tolerance of both response shapes (array of {metric,...} and name-keyed object).
 *
 * Runs standalone via `node --test out/test/modules/crashlytics/vitals-metrics.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { latestMetric, metricSeries } from '../../../modules/crashlytics/vitals-metrics';

// Array shape (as the error-count metric set returns metrics).
const arrayRows = {
    rows: [
        { metrics: [{ metric: 'crashRate', decimalValue: { value: '0.01' } }, { metric: 'userPerceivedCrashRate', decimalValue: { value: '0.02' } }] },
        { metrics: [{ metric: 'crashRate', decimalValue: { value: '0.03' } }, { metric: 'userPerceivedCrashRate', decimalValue: { value: '0.04' } }] },
    ],
};

// Name-keyed object shape.
const objectRows = {
    rows: [{ metrics: { crashRate: { decimalValue: { value: '0.05' } }, userPerceivedCrashRate: { decimalValue: { value: '0.06' } } } }],
};

test('latestMetric: selects the named metric and converts to percent', () => {
    assert.strictEqual(latestMetric(arrayRows as never, 'crashRate'), 3);
    assert.strictEqual(latestMetric(arrayRows as never, 'userPerceivedCrashRate'), 4);
});

test('latestMetric: works on the name-keyed object shape too', () => {
    assert.strictEqual(latestMetric(objectRows as never, 'crashRate'), 5);
    assert.strictEqual(latestMetric(objectRows as never, 'userPerceivedCrashRate'), 6);
});

test('metricSeries: returns the full per-day series of the named metric', () => {
    assert.deepStrictEqual(metricSeries(arrayRows as never, 'crashRate'), [1, 3]);
    assert.deepStrictEqual(metricSeries(arrayRows as never, 'userPerceivedCrashRate'), [2, 4]);
});

test('latestMetric: undefined for missing metric / empty data', () => {
    assert.strictEqual(latestMetric(arrayRows as never, 'anrRate'), undefined);
    assert.strictEqual(latestMetric(undefined, 'crashRate'), undefined);
    assert.strictEqual(latestMetric({ rows: [] } as never, 'crashRate'), undefined);
});

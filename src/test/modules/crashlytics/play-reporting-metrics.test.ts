/**
 * Tests for the error-count metric-set row parser (bug_008 / plan 054 device-OS breakdown).
 *
 * Pins the shape returned by errorCountMetricSet:query (verified live): each row has a `dimensions`
 * array (value in stringValue / int64Value) and a `metrics` array (errorReportCount.decimalValue.value).
 */

import * as assert from 'assert';
import { parseMetricRows } from '../../../modules/crashlytics/play-reporting-metrics';

function row(dim: string, value: Record<string, unknown>, count: string): Record<string, unknown> {
    return {
        dimensions: [{ dimension: 'reportType', stringValue: 'CRASH' }, { dimension: dim, ...value }],
        metrics: [{ metric: 'errorReportCount', decimalValue: { value: count } }],
    };
}

suite('play-reporting-metrics: parseMetricRows', () => {
    test('parses deviceBrand rows (stringValue) and sorts by count desc', () => {
        const json = { rows: [row('deviceBrand', { stringValue: 'Redmi' }, '2'), row('deviceBrand', { stringValue: 'samsung' }, '5')] };
        const entries = parseMetricRows(json, 'deviceBrand');
        assert.deepStrictEqual(entries, [{ name: 'samsung', count: 5 }, { name: 'Redmi', count: 2 }]);
    });

    test('parses apiLevel rows (int64Value)', () => {
        const json = { rows: [row('apiLevel', { int64Value: '33' }, '4')] };
        assert.deepStrictEqual(parseMetricRows(json, 'apiLevel'), [{ name: '33', count: 4 }]);
    });

    test('drops rows with no dimension value or zero count', () => {
        const json = { rows: [row('deviceBrand', { stringValue: '' }, '3'), row('deviceBrand', { stringValue: 'Pixel' }, '0')] };
        assert.deepStrictEqual(parseMetricRows(json, 'deviceBrand'), []);
    });

    test('returns [] for missing/empty rows', () => {
        assert.deepStrictEqual(parseMetricRows(undefined, 'deviceBrand'), []);
        assert.deepStrictEqual(parseMetricRows({}, 'deviceBrand'), []);
    });
});

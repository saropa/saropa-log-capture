import * as assert from 'assert';
import {
    formatSignalsSummaryToCsv,
    formatSignalsSummaryToJson,
} from '../../../modules/export/signals-export-formats';
import type { SignalsSummary } from '../../../modules/signals/signals-summary';

function minimalSummary(overrides?: Partial<SignalsSummary>): SignalsSummary {
    return {
        errors: [],
        files: [],
        meta: {
            sessionCount: 0,
            timeRange: 'all',
            exportedAt: '2024-01-15T10:00:00Z',
        },
        ...overrides,
    };
}

suite('InsightsExportFormats', () => {

    suite('formatSignalsSummaryToCsv', () => {
        test('should produce CSV with headers for empty summary', () => {
            const csv = formatSignalsSummaryToCsv(minimalSummary());
            assert.ok(csv.includes('errors'));
            assert.ok(csv.includes('signature,count,sessions'));
            assert.ok(csv.includes('files'));
            assert.ok(csv.includes('path,sessionCount'));
        });

        test('should include error rows', () => {
            const csv = formatSignalsSummaryToCsv(minimalSummary({
                errors: [{
                    signature: 'NullPointerException',
                    count: 5,
                    sessions: ['sess-1', 'sess-2'],
                    sampleLine: 'Error at line 42',
                    firstSeen: '2024-01-10',
                    lastSeen: '2024-01-15',
                }],
            }));
            assert.ok(csv.includes('NullPointerException'));
            assert.ok(csv.includes('5'));
            assert.ok(csv.includes('sess-1;sess-2'));
        });

        test('should include file rows', () => {
            const csv = formatSignalsSummaryToCsv(minimalSummary({
                files: [{ path: 'src/app.ts', sessionCount: 3 }],
            }));
            assert.ok(csv.includes('src/app.ts'));
            assert.ok(csv.includes('3'));
        });

        test('should escape CSV fields with commas', () => {
            const csv = formatSignalsSummaryToCsv(minimalSummary({
                errors: [{
                    signature: 'Error, with comma',
                    count: 1,
                    sessions: ['s1'],
                    sampleLine: 'line',
                    firstSeen: '2024-01-10',
                    lastSeen: '2024-01-15',
                }],
            }));
            assert.ok(csv.includes('"Error, with comma"'));
        });

        test('should include category when present', () => {
            const csv = formatSignalsSummaryToCsv(minimalSummary({
                errors: [{
                    signature: 'Err',
                    count: 1,
                    sessions: ['s1'],
                    sampleLine: 'line',
                    firstSeen: '2024-01-10',
                    lastSeen: '2024-01-15',
                    category: 'stderr',
                }],
            }));
            assert.ok(csv.includes('stderr'));
        });
    });

    suite('formatSignalsSummaryToJson', () => {
        test('should produce valid JSON for empty summary', () => {
            const json = formatSignalsSummaryToJson(minimalSummary());
            const parsed = JSON.parse(json);
            assert.ok(Array.isArray(parsed.errors));
            assert.ok(Array.isArray(parsed.files));
            assert.ok(parsed.meta);
        });

        test('should include errors in JSON', () => {
            const json = formatSignalsSummaryToJson(minimalSummary({
                errors: [{
                    signature: 'NPE',
                    count: 3,
                    sessions: ['s1'],
                    sampleLine: 'line',
                    firstSeen: '2024-01-10',
                    lastSeen: '2024-01-15',
                }],
            }));
            const parsed = JSON.parse(json);
            assert.strictEqual(parsed.errors.length, 1);
            assert.strictEqual(parsed.errors[0].signature, 'NPE');
            assert.strictEqual(parsed.errors[0].count, 3);
        });

        test('should include files in JSON', () => {
            const json = formatSignalsSummaryToJson(minimalSummary({
                files: [{ path: 'src/lib.ts', sessionCount: 7 }],
            }));
            const parsed = JSON.parse(json);
            assert.strictEqual(parsed.files.length, 1);
            assert.strictEqual(parsed.files[0].path, 'src/lib.ts');
        });

        test('should include meta in JSON', () => {
            const json = formatSignalsSummaryToJson(minimalSummary({
                meta: {
                    sessionCount: 10,
                    timeRange: '7d',
                    exportedAt: '2024-01-15T12:00:00Z',
                },
            }));
            const parsed = JSON.parse(json);
            assert.strictEqual(parsed.meta.sessionCount, 10);
            assert.strictEqual(parsed.meta.timeRange, '7d');
        });

        test('should produce pretty-printed JSON', () => {
            const json = formatSignalsSummaryToJson(minimalSummary());
            assert.ok(json.includes('\n'));
            assert.ok(json.includes('  '));
        });
    });
});

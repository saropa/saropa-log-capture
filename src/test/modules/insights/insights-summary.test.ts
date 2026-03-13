/**
 * Unit tests for insights summary and export formatters.
 */

import * as assert from 'assert';
import { buildInsightsSummary } from '../../../modules/insights/insights-summary';
import { formatInsightsSummaryToCsv, formatInsightsSummaryToJson } from '../../../modules/export/insights-export-formats';
import type { CrossSessionInsights } from '../../../modules/misc/cross-session-aggregator';

function mockInsights(overrides?: Partial<CrossSessionInsights>): CrossSessionInsights {
    return {
        hotFiles: [
            { filename: 'lib/foo.dart', sessionCount: 3, sessions: [] },
            { filename: 'lib/bar.dart', sessionCount: 2, sessions: [] },
        ],
        recurringErrors: [
            {
                hash: 'a1b2c3d4',
                normalizedText: 'Error: test',
                exampleLine: '[ERROR] Error: test at main',
                sessionCount: 2,
                totalOccurrences: 5,
                firstSeen: '20250301_120000.log',
                lastSeen: '20250302_120000.log',
                timeline: [
                    { session: '20250301_120000.log', count: 2 },
                    { session: '20250302_120000.log', count: 3 },
                ],
            },
        ],
        sessionCount: 2,
        platforms: [],
        sdkVersions: [],
        debugAdapters: [],
        queriedAt: Date.now(),
        ...overrides,
    };
}

suite('InsightsSummary', () => {
    suite('buildInsightsSummary', () => {
        test('builds summary from insights with default caps', () => {
            const insights = mockInsights();
            const summary = buildInsightsSummary(insights);
            assert.strictEqual(summary.errors.length, 1);
            assert.strictEqual(summary.errors[0].signature, 'a1b2c3d4');
            assert.strictEqual(summary.errors[0].count, 5);
            assert.deepStrictEqual(summary.errors[0].sessions, ['20250301_120000.log', '20250302_120000.log']);
            assert.strictEqual(summary.files.length, 2);
            assert.strictEqual(summary.files[0].path, 'lib/foo.dart');
            assert.strictEqual(summary.files[0].sessionCount, 3);
            assert.strictEqual(summary.meta.sessionCount, 2);
            assert.ok(summary.meta.exportedAt);
        });

        test('applies timeRangeLabel option', () => {
            const insights = mockInsights();
            const summary = buildInsightsSummary(insights, { timeRangeLabel: '7d' });
            assert.strictEqual(summary.meta.timeRange, '7d');
        });

        test('caps errors and files when over limit', () => {
            const manyErrors = Array.from({ length: 10 }, (_, i) => ({
                hash: `h${i}`,
                normalizedText: `err ${i}`,
                exampleLine: `line ${i}`,
                sessionCount: 1,
                totalOccurrences: 1,
                firstSeen: 's.log',
                lastSeen: 's.log',
                timeline: [{ session: 's.log', count: 1 }],
            }));
            const manyFiles = Array.from({ length: 10 }, (_, i) => ({
                filename: `f${i}.dart`,
                sessionCount: 1,
                sessions: [] as { filename: string; uri: string }[],
            }));
            const insights = mockInsights({ recurringErrors: manyErrors, hotFiles: manyFiles });
            const summary = buildInsightsSummary(insights, { maxErrors: 3, maxFiles: 2 });
            assert.strictEqual(summary.errors.length, 3);
            assert.strictEqual(summary.files.length, 2);
        });
    });

    suite('formatInsightsSummaryToCsv', () => {
        test('produces errors section then files section', () => {
            const insights = mockInsights();
            const summary = buildInsightsSummary(insights);
            const csv = formatInsightsSummaryToCsv(summary);
            assert.ok(csv.includes('errors'));
            assert.ok(csv.includes('signature,count,sessions,sampleLine,firstSeen,lastSeen,category'));
            assert.ok(csv.includes('a1b2c3d4'));
            assert.ok(csv.includes('files'));
            assert.ok(csv.includes('path,sessionCount'));
            assert.ok(csv.includes('lib/foo.dart'));
        });
    });

    suite('formatInsightsSummaryToJson', () => {
        test('produces valid JSON with errors, files, meta', () => {
            const insights = mockInsights();
            const summary = buildInsightsSummary(insights);
            const json = formatInsightsSummaryToJson(summary);
            const parsed = JSON.parse(json);
            assert.ok(Array.isArray(parsed.errors));
            assert.ok(Array.isArray(parsed.files));
            assert.strictEqual(parsed.meta.sessionCount, 2);
            assert.strictEqual(parsed.errors[0].signature, 'a1b2c3d4');
        });
    });
});

"use strict";
/**
 * Unit tests for insights summary and export formatters.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const insights_summary_1 = require("../../../modules/insights/insights-summary");
const insights_export_formats_1 = require("../../../modules/export/insights-export-formats");
function mockInsights(overrides) {
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
            const summary = (0, insights_summary_1.buildInsightsSummary)(insights);
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
            const summary = (0, insights_summary_1.buildInsightsSummary)(insights, { timeRangeLabel: '7d' });
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
                sessions: [],
            }));
            const insights = mockInsights({ recurringErrors: manyErrors, hotFiles: manyFiles });
            const summary = (0, insights_summary_1.buildInsightsSummary)(insights, { maxErrors: 3, maxFiles: 2 });
            assert.strictEqual(summary.errors.length, 3);
            assert.strictEqual(summary.files.length, 2);
        });
    });
    suite('formatInsightsSummaryToCsv', () => {
        test('produces errors section then files section', () => {
            const insights = mockInsights();
            const summary = (0, insights_summary_1.buildInsightsSummary)(insights);
            const csv = (0, insights_export_formats_1.formatInsightsSummaryToCsv)(summary);
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
            const summary = (0, insights_summary_1.buildInsightsSummary)(insights);
            const json = (0, insights_export_formats_1.formatInsightsSummaryToJson)(summary);
            const parsed = JSON.parse(json);
            assert.ok(Array.isArray(parsed.errors));
            assert.ok(Array.isArray(parsed.files));
            assert.strictEqual(parsed.meta.sessionCount, 2);
            assert.strictEqual(parsed.errors[0].signature, 'a1b2c3d4');
        });
    });
});
//# sourceMappingURL=insights-summary.test.js.map
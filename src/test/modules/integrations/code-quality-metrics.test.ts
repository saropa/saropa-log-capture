import * as assert from 'assert';
import {
    extractReferencedFiles,
    buildSummary,
} from '../../../modules/integrations/providers/code-quality-metrics';
import type { FileQualityMetrics } from '../../../modules/integrations/providers/quality-types';

suite('CodeQualityMetrics', () => {

    // --- extractReferencedFiles ---

    test('should extract file paths from Node stack frames', () => {
        const log = [
            'Error: something broke',
            '    at doStuff (src/utils/helper.ts:42:10)',
            '    at main (src/index.ts:15:3)',
            'Some other log line',
        ].join('\n');
        const files = extractReferencedFiles(log, '/workspace');
        assert.ok(files.includes('src/utils/helper.ts'));
        assert.ok(files.includes('src/index.ts'));
    });

    test('should extract file paths from Dart stack frames', () => {
        const log = [
            '#0  main (package:app/main.dart:15)',
            '#1  runApp (package:flutter/widgets.dart:20)',
        ].join('\n');
        const files = extractReferencedFiles(log, '/workspace');
        assert.ok(files.length > 0);
    });

    test('should skip non-stack-frame lines', () => {
        const log = [
            'INFO: Starting application',
            'DEBUG: Config loaded',
            'Done.',
        ].join('\n');
        const files = extractReferencedFiles(log, '/workspace');
        assert.strictEqual(files.length, 0);
    });

    test('should deduplicate file paths', () => {
        const log = [
            '    at foo (src/app.ts:10:5)',
            '    at bar (src/app.ts:20:3)',
        ].join('\n');
        const files = extractReferencedFiles(log, '/workspace');
        const unique = new Set(files);
        assert.strictEqual(files.length, unique.size);
    });

    test('should return empty array for empty log', () => {
        const files = extractReferencedFiles('', '/workspace');
        assert.strictEqual(files.length, 0);
    });

    // --- buildSummary ---

    test('should compute average line coverage', () => {
        const files: Record<string, FileQualityMetrics> = {
            'src/a.ts': { linePercent: 80 },
            'src/b.ts': { linePercent: 40 },
        };
        const summary = buildSummary(files);
        assert.strictEqual(summary.avgLineCoverage, 60);
        assert.strictEqual(summary.filesAnalyzed, 2);
    });

    test('should aggregate lint totals', () => {
        const files: Record<string, FileQualityMetrics> = {
            'src/a.ts': { lintWarnings: 3, lintErrors: 1 },
            'src/b.ts': { lintWarnings: 2, lintErrors: 0 },
        };
        const summary = buildSummary(files);
        assert.strictEqual(summary.totalLintWarnings, 5);
        assert.strictEqual(summary.totalLintErrors, 1);
    });

    test('should return undefined avgLineCoverage when no coverage data', () => {
        const files: Record<string, FileQualityMetrics> = {
            'src/a.ts': { lintWarnings: 1 },
        };
        const summary = buildSummary(files);
        assert.strictEqual(summary.avgLineCoverage, undefined);
    });

    test('should sort lowestCoverageFiles ascending', () => {
        const files: Record<string, FileQualityMetrics> = {
            'src/high.ts': { linePercent: 90 },
            'src/low.ts': { linePercent: 10 },
            'src/mid.ts': { linePercent: 50 },
        };
        const summary = buildSummary(files);
        assert.strictEqual(summary.lowestCoverageFiles[0].path, 'src/low.ts');
        assert.strictEqual(summary.lowestCoverageFiles[0].linePercent, 10);
    });

    test('should cap lowestCoverageFiles at 5', () => {
        const files: Record<string, FileQualityMetrics> = {};
        for (let i = 0; i < 10; i++) {
            files[`src/file${i}.ts`] = { linePercent: i * 10 };
        }
        const summary = buildSummary(files);
        assert.strictEqual(summary.lowestCoverageFiles.length, 5);
    });

    test('should handle empty files record', () => {
        const summary = buildSummary({});
        assert.strictEqual(summary.filesAnalyzed, 0);
        assert.strictEqual(summary.avgLineCoverage, undefined);
        assert.strictEqual(summary.totalLintWarnings, 0);
        assert.strictEqual(summary.totalLintErrors, 0);
        assert.strictEqual(summary.lowestCoverageFiles.length, 0);
    });
});

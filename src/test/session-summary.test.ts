import * as assert from 'assert';
import {
    generateSummary,
    formatDuration,
    formatBytes,
    defaultSessionStats,
} from '../modules/session-summary';

suite('SessionSummary', () => {

    suite('formatDuration', () => {

        test('should format milliseconds', () => {
            assert.strictEqual(formatDuration(500), '500ms');
        });

        test('should format seconds', () => {
            assert.strictEqual(formatDuration(5000), '5s');
        });

        test('should format minutes and seconds', () => {
            assert.strictEqual(formatDuration(90000), '1m 30s');
        });

        test('should format minutes only when no seconds', () => {
            assert.strictEqual(formatDuration(120000), '2m');
        });

        test('should format hours and minutes', () => {
            assert.strictEqual(formatDuration(5400000), '1h 30m');
        });

        test('should format hours only when no minutes', () => {
            assert.strictEqual(formatDuration(3600000), '1h');
        });
    });

    suite('formatBytes', () => {

        test('should format bytes', () => {
            assert.strictEqual(formatBytes(500), '500 B');
        });

        test('should format kilobytes', () => {
            const result = formatBytes(2048);
            assert.ok(result.includes('KB'));
        });

        test('should format megabytes', () => {
            const result = formatBytes(2 * 1024 * 1024);
            assert.ok(result.includes('MB'));
        });
    });

    suite('generateSummary', () => {

        test('should generate summary with basic stats', () => {
            const stats = {
                ...defaultSessionStats(),
                lineCount: 1234,
                bytesWritten: 50000,
                durationMs: 60000,
            };
            const summary = generateSummary('test.log', stats);
            assert.strictEqual(summary.title, 'Session Complete: test.log');
            assert.ok(summary.lines.some(l => l.includes('1,234')));
            assert.ok(summary.lines.some(l => l.includes('Duration')));
        });

        test('should include split count when multiple parts', () => {
            const stats = {
                ...defaultSessionStats(),
                partCount: 3,
            };
            const summary = generateSummary('test.log', stats);
            assert.ok(summary.lines.some(l => l.includes('3 parts')));
        });

        test('should include category breakdown', () => {
            const stats = {
                ...defaultSessionStats(),
                categoryCounts: { stdout: 100, stderr: 5 },
            };
            const summary = generateSummary('test.log', stats);
            assert.ok(summary.lines.some(l => l.includes('stdout')));
        });

        test('should include watch hits', () => {
            const stats = {
                ...defaultSessionStats(),
                watchHitCounts: { error: 10 },
            };
            const summary = generateSummary('test.log', stats);
            assert.ok(summary.lines.some(l => l.includes('error')));
        });
    });

    suite('defaultSessionStats', () => {

        test('should return all zero values', () => {
            const stats = defaultSessionStats();
            assert.strictEqual(stats.lineCount, 0);
            assert.strictEqual(stats.bytesWritten, 0);
            assert.strictEqual(stats.durationMs, 0);
            assert.strictEqual(stats.partCount, 1);
        });
    });
});

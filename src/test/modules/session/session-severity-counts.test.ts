import * as assert from 'assert';
import { countSeverities, extractBody } from '../../../ui/session/session-severity-counts';

suite('session-severity-counts', () => {
    suite('extractBody', () => {
        test('should extract body after header separator', () => {
            const text = '=== SAROPA LOG CAPTURE ===\nDate: 2025-01-01\n==================\n\n[10:00:00] [stdout] hello';
            const body = extractBody(text);
            assert.ok(body.includes('hello'));
            assert.ok(!body.includes('SAROPA LOG CAPTURE'));
        });

        test('should return full text when no header', () => {
            const text = 'just some log lines\nerror here';
            assert.strictEqual(extractBody(text), text);
        });
    });

    suite('countSeverities (classifyLevel-backed)', () => {
        test('should count strict structural error lines', () => {
            // Default strict mode requires structural shape: `Error:`, `_FooException`, etc.
            // A bare "fatal crash" matches the kwError keyword pattern.
            const body = 'normal line\nError: something broke\nfatal crash happened\nanother line';
            const counts = countSeverities(body);
            assert.strictEqual(counts.errors, 2);
            assert.strictEqual(counts.warnings, 0);
            assert.strictEqual(counts.perfs, 0);
            assert.strictEqual(counts.infos, 2);
        });

        test('should catch Flutter "Exception caught by" banner (V1 missed this)', () => {
            const body = '════ Exception caught by widgets library ════\nnormal output';
            const counts = countSeverities(body);
            assert.strictEqual(counts.errors, 1);
        });

        test('should count warning lines from keyword', () => {
            const body = 'Warning: low disk space\ncaution: overheating\nnormal line';
            const counts = countSeverities(body);
            assert.strictEqual(counts.warnings, 2);
            assert.strictEqual(counts.errors, 0);
            assert.strictEqual(counts.infos, 1);
        });

        test('should catch structural "could not / unable to / failed to" warnings (V1 missed these)', () => {
            const body = 'databaseDecode: could not decode payload\nrenderer: unable to render frame\nnormal output';
            const counts = countSeverities(body);
            assert.strictEqual(counts.warnings, 2);
        });

        test('should count performance lines (structural perf + ANR)', () => {
            const body = 'Skipped 45 frames!\nApplication Not Responding\nnormal';
            const counts = countSeverities(body);
            assert.strictEqual(counts.perfs, 2);
            assert.strictEqual(counts.anrs, 1);
            assert.strictEqual(counts.infos, 1);
        });

        test('should handle logcat error/warning prefixes', () => {
            const body = 'E/MediaCodec: Service not found\nW/System: Clock skew\nI/flutter: ok';
            const counts = countSeverities(body);
            assert.strictEqual(counts.errors, 1);
            assert.strictEqual(counts.warnings, 1);
            assert.strictEqual(counts.infos, 1);
        });

        test('should map logcat V/D to debug bucket (V1 lumped this in info/framework)', () => {
            const body = 'D/AudioManager: stream changed\nV/RenderThread: frame ready\nI/flutter: ok';
            const counts = countSeverities(body);
            assert.strictEqual(counts.debugs, 2);
            assert.strictEqual(counts.infos, 1);
        });

        test('should map non-flutter logcat I/ to info (V1 split as "framework")', () => {
            const body = 'I/ActivityManager: process started\nI/flutter: tap';
            const counts = countSeverities(body);
            assert.strictEqual(counts.infos, 2);
            assert.strictEqual(counts.debugs, 0);
        });

        test('should classify Drift SQL statements as database', () => {
            const body = 'Drift: Sent SELECT * FROM users\nDrift: Sent INSERT INTO logs VALUES(1)\nnormal';
            const counts = countSeverities(body);
            assert.strictEqual(counts.databases, 2);
            assert.strictEqual(counts.infos, 1);
        });

        test('should classify TODO/FIXME as todo', () => {
            const body = 'TODO: revisit this\nFIXME: race condition\nnormal';
            const counts = countSeverities(body);
            assert.strictEqual(counts.todos, 2);
            assert.strictEqual(counts.infos, 1);
        });

        test('should skip marker and separator lines', () => {
            const body = '---MARKER: test---\n=== SESSION END\nError: in normal line';
            const counts = countSeverities(body);
            assert.strictEqual(counts.errors, 1);
        });

        test('should return zeros for empty body', () => {
            const counts = countSeverities('');
            assert.strictEqual(counts.errors, 0);
            assert.strictEqual(counts.warnings, 0);
            assert.strictEqual(counts.perfs, 0);
            assert.strictEqual(counts.infos, 0);
            assert.strictEqual(counts.debugs, 0);
            assert.strictEqual(counts.databases, 0);
            assert.strictEqual(counts.todos, 0);
            assert.strictEqual(counts.notices, 0);
        });

        test('should not false-positive on error handling terms', () => {
            const body = 'error handler registered\nerror recovery complete\nerror logging enabled';
            const counts = countSeverities(body);
            assert.strictEqual(counts.errors, 0);
            assert.strictEqual(counts.infos, 3);
        });

        test('should strip timestamp prefix before matching', () => {
            const body = '[10:30:00.123] [stderr] connection failed';
            const counts = countSeverities(body);
            // "failed" is a kwWarn keyword — strict classifier routes to warning
            assert.strictEqual(counts.warnings, 1);
        });

        test('should classify every line into exactly one bucket', () => {
            const body = 'Error: crash\nWarning: low mem\nSkipped 30 frames!\nD/Zygote: init\nI/flutter: hello\nDrift: Sent SELECT * FROM x\nTODO: cleanup\nnormal output';
            const counts = countSeverities(body);
            const total = counts.errors + counts.warnings + counts.perfs + counts.infos
                + counts.debugs + counts.databases + counts.todos + counts.notices;
            assert.strictEqual(total, 8);
            assert.strictEqual(counts.errors, 1);
            assert.strictEqual(counts.warnings, 1);
            assert.strictEqual(counts.perfs, 1);
            assert.strictEqual(counts.debugs, 1);
            assert.strictEqual(counts.infos, 2);
            assert.strictEqual(counts.databases, 1);
            assert.strictEqual(counts.todos, 1);
        });
    });
});

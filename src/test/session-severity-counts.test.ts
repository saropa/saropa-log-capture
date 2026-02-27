import * as assert from 'assert';
import { countSeverities, extractBody } from '../ui/session-severity-counts';

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

    suite('countSeverities', () => {
        test('should count error lines', () => {
            const body = 'normal line\nError: something broke\nfatal crash happened\nanother line';
            const counts = countSeverities(body);
            assert.strictEqual(counts.errors, 2);
            assert.strictEqual(counts.warnings, 0);
            assert.strictEqual(counts.perfs, 0);
            assert.strictEqual(counts.infos, 2);
        });

        test('should count warning lines', () => {
            const body = 'Warning: low disk space\ncaution: overheating\nnormal line';
            const counts = countSeverities(body);
            assert.strictEqual(counts.warnings, 2);
            assert.strictEqual(counts.errors, 0);
            assert.strictEqual(counts.infos, 1);
        });

        test('should count performance lines', () => {
            const body = 'Skipped 45 frames! Application doing too much work\njank detected\nnormal';
            const counts = countSeverities(body);
            assert.strictEqual(counts.perfs, 2);
            assert.strictEqual(counts.infos, 1);
        });

        test('should handle logcat error prefixes', () => {
            const body = 'E/MediaCodec: Service not found\nW/System: Clock skew\nI/flutter: ok';
            const counts = countSeverities(body);
            assert.strictEqual(counts.errors, 1);
            assert.strictEqual(counts.warnings, 1);
            assert.strictEqual(counts.frameworks, 0);
            assert.strictEqual(counts.infos, 1);
        });

        test('should skip marker and separator lines', () => {
            const body = '---MARKER: test---\n=== SESSION END\nerror in normal line';
            const counts = countSeverities(body);
            assert.strictEqual(counts.errors, 1);
        });

        test('should return zeros for empty body', () => {
            const counts = countSeverities('');
            assert.strictEqual(counts.errors, 0);
            assert.strictEqual(counts.warnings, 0);
            assert.strictEqual(counts.perfs, 0);
            assert.strictEqual(counts.frameworks, 0);
            assert.strictEqual(counts.infos, 0);
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
            assert.strictEqual(counts.errors, 1);
        });

        test('should count framework logcat lines (non-flutter tags)', () => {
            const body = 'D/AudioManager: stream changed\nI/ActivityManager: process started\nV/RenderThread: frame ready';
            const counts = countSeverities(body);
            assert.strictEqual(counts.frameworks, 3);
            assert.strictEqual(counts.infos, 0);
            assert.strictEqual(counts.errors, 0);
        });

        test('should count flutter logcat lines as info, not framework', () => {
            const body = 'I/flutter: user tapped button\nD/flutter: rebuilding widget';
            const counts = countSeverities(body);
            assert.strictEqual(counts.infos, 2);
            assert.strictEqual(counts.frameworks, 0);
        });

        test('should count launch boilerplate as framework', () => {
            const body = 'Connecting to VM Service at ws://127.0.0.1:5678\nLaunching lib/main.dart in debug mode';
            const counts = countSeverities(body);
            assert.strictEqual(counts.frameworks, 2);
            assert.strictEqual(counts.infos, 0);
        });

        test('should classify all lines exhaustively', () => {
            const body = 'Error: crash\nWarning: low mem\nSkipped 30 frames!\nD/Zygote: init\nI/flutter: hello\nnormal output';
            const counts = countSeverities(body);
            const total = counts.errors + counts.warnings + counts.perfs + counts.frameworks + counts.infos;
            assert.strictEqual(total, 6);
            assert.strictEqual(counts.errors, 1);
            assert.strictEqual(counts.warnings, 1);
            assert.strictEqual(counts.perfs, 1);
            assert.strictEqual(counts.frameworks, 1);
            assert.strictEqual(counts.infos, 2);
        });
    });
});

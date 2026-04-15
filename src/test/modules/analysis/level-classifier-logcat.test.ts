/**
 * Tests for logcat prefix classification (E/, F/, A/, W/, V/, D/, I/).
 * Extracted from level-classifier.test.ts to keep files under the line limit.
 */
import * as assert from 'assert';
import { classifyLevel } from '../../../modules/analysis/level-classifier';

suite('LevelClassifier — logcat prefixes', () => {

    test('should classify E/ as error', () => {
        assert.strictEqual(classifyLevel('E/MediaCodec: error', 'stdout', true), 'error');
    });

    test('should classify F/ as error', () => {
        assert.strictEqual(classifyLevel('F/System: fatal crash', 'stdout', true), 'error');
    });

    test('should classify A/ as error', () => {
        assert.strictEqual(classifyLevel('A/libc: assertion failed', 'stdout', true), 'error');
    });

    test('should classify W/ as warning', () => {
        assert.strictEqual(classifyLevel('W/InputManager: slow event', 'stdout', true), 'warning');
    });

    test('should classify V/ as debug', () => {
        assert.strictEqual(classifyLevel('V/Verbose: trace info', 'stdout', true), 'debug');
    });

    test('should classify D/ as debug', () => {
        assert.strictEqual(classifyLevel('D/Debug: step through', 'stdout', true), 'debug');
    });

    test('should classify I/ with performance keyword as performance', () => {
        assert.strictEqual(
            classifyLevel('I/Choreographer: Skipped 30 frames', 'stdout', true),
            'performance',
        );
    });

    test('should classify I/ with TODO as todo', () => {
        assert.strictEqual(classifyLevel('I/App: TODO fix this', 'stdout', true), 'todo');
    });

    test('should classify I/ plain text as info', () => {
        assert.strictEqual(classifyLevel('I/App: started', 'stdout', true), 'info');
    });

    test('should classify I/flutter Drift SQL statements as database even with "ApplicationLogError" in args', () => {
        assert.strictEqual(
            classifyLevel(
                'I/flutter (5475): Drift: Sent DELETE FROM "activities" WHERE "activity_type_name" IN (?, ?, ?, ?, ?) with args [ApplicationLogTodo, ApplicationLogBreadcrumb, ApplicationLogInfo, ApplicationLogWarning, ApplicationLogError]',
                'stdout',
                true,
            ),
            'database',
        );
    });

    test('should classify capture-prefixed Drift SQL as database when logcat is not at line start', () => {
        assert.strictEqual(
            classifyLevel(
                '[12:00:00.000] [stdout] I/flutter (5475): Drift: Sent DELETE FROM "activities" WHERE "activity_type_name" IN (?, ?) with args [ApplicationLogTodo, ApplicationLogError]',
                'stdout',
                true,
            ),
            'database',
        );
    });

    test('should classify E/flutter Drift SQL as database, not runtime error', () => {
        assert.strictEqual(
            classifyLevel('E/flutter (1): Drift: Sent SELECT 1', 'stdout', true),
            'database',
        );
    });

    test('should classify DriftDebugInterceptor SELECT as database', () => {
        assert.strictEqual(
            classifyLevel('Drift SELECT: SELECT * FROM "contacts" WHERE "id" = ?; | args: [42]', 'stdout', true),
            'database',
        );
    });

    test('should classify DriftDebugInterceptor UPDATE as database', () => {
        assert.strictEqual(
            classifyLevel('Drift UPDATE: UPDATE "organizations" SET "version" = ?; | args: [null]', 'stdout', true),
            'database',
        );
    });
});

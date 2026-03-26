import * as assert from 'assert';
import { classifyLevel, isActionableLevel } from '../../../modules/analysis/level-classifier';

suite('LevelClassifier', () => {

    suite('classifyLevel — stderr', () => {

        test('should classify stderr category as error', () => {
            assert.strictEqual(classifyLevel('anything', 'stderr', true), 'error');
        });

        test('should classify stderr even for benign text', () => {
            assert.strictEqual(classifyLevel('all good', 'stderr', true), 'error');
        });
    });

    suite('classifyLevel — logcat prefixes', () => {

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

        test('should classify I/flutter Drift SQL statements as info even with "ApplicationLogError" in args', () => {
            assert.strictEqual(
                classifyLevel(
                    'I/flutter (5475): Drift: Sent DELETE FROM "activities" WHERE "activity_type_name" IN (?, ?, ?, ?, ?) with args [ApplicationLogTodo, ApplicationLogBreadcrumb, ApplicationLogInfo, ApplicationLogWarning, ApplicationLogError]',
                    'stdout',
                    true,
                ),
                'info',
            );
        });

        test('should classify capture-prefixed Drift SQL as info when logcat is not at line start', () => {
            assert.strictEqual(
                classifyLevel(
                    '[12:00:00.000] [stdout] I/flutter (5475): Drift: Sent DELETE FROM "activities" WHERE "activity_type_name" IN (?, ?) with args [ApplicationLogTodo, ApplicationLogError]',
                    'stdout',
                    true,
                ),
                'info',
            );
        });

        test('should classify E/flutter Drift SQL as warning, not runtime error', () => {
            assert.strictEqual(
                classifyLevel('E/flutter (1): Drift: Sent SELECT 1', 'stdout', true),
                'warning',
            );
        });
    });

    suite('classifyLevel — strict mode', () => {

        test('should detect error with colon suffix', () => {
            assert.strictEqual(classifyLevel('Error: something broke', 'stdout', true), 'error');
        });

        test('should detect exception with colon suffix', () => {
            assert.strictEqual(classifyLevel('NullPointerException: null', 'stdout', true), 'error');
        });

        test('should detect [error] bracket pattern', () => {
            assert.strictEqual(classifyLevel('[error] bad input', 'stdout', true), 'error');
        });

        test('should detect [fatal] bracket pattern', () => {
            assert.strictEqual(classifyLevel('[fatal] shutdown', 'stdout', true), 'error');
        });

        test('should detect failed keyword', () => {
            assert.strictEqual(classifyLevel('Build failed', 'stdout', true), 'error');
        });

        test('should detect failure keyword', () => {
            assert.strictEqual(classifyLevel('Connection failure', 'stdout', true), 'error');
        });

        test('should detect panic keyword', () => {
            assert.strictEqual(classifyLevel('panic: runtime error', 'stdout', true), 'error');
        });

        test('should not classify bare "error" as error in strict mode', () => {
            // In strict mode, bare "error" without structural context should not match
            assert.notStrictEqual(classifyLevel('log error handling', 'stdout', true), 'error');
        });
    });

    suite('classifyLevel — loose mode', () => {

        test('should detect bare "error" keyword', () => {
            assert.strictEqual(classifyLevel('an error happened', 'stdout', false), 'error');
        });

        test('should detect bare "exception" keyword', () => {
            assert.strictEqual(classifyLevel('unhandled exception', 'stdout', false), 'error');
        });

        test('should not match "error" followed by handler-like words', () => {
            // loose mode excludes "error handler", "error handling", etc.
            assert.notStrictEqual(classifyLevel('error handler active', 'stdout', false), 'error');
        });
    });

    suite('classifyLevel — non-error levels', () => {

        test('should classify warning keyword', () => {
            assert.strictEqual(classifyLevel('warning: deprecated API', 'stdout', true), 'warning');
        });

        test('should classify warn keyword', () => {
            assert.strictEqual(classifyLevel('WARN: slow query', 'stdout', true), 'warning');
        });

        test('should classify caution keyword', () => {
            assert.strictEqual(classifyLevel('caution: memory low', 'stdout', true), 'warning');
        });

        test('should classify performance keywords', () => {
            assert.strictEqual(classifyLevel('fps dropped to 15', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('jank detected', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('GC pause 200ms', 'stdout', true), 'performance');
        });

        test('should classify Flutter/Dart memory lines as performance only with Flutter/Dart context', () => {
            assert.strictEqual(classifyLevel('memory pressure warning', 'stdout', true), 'info');
            assert.strictEqual(classifyLevel('I/flutter (123): memory pressure warning', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('I/flutter: Memory: 120 MB', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('D/dart: old gen 80%', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('I/flutter: retained 1024 bytes', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('potential leak in Widget', 'stdout', true), 'info');
            assert.strictEqual(classifyLevel('I/flutter: potential leak in Widget', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('at package:flutter/src/widgets.dart:123: memory usage high', 'stdout', true), 'performance');
        });

        test('should classify TODO/FIXME/HACK', () => {
            assert.strictEqual(classifyLevel('TODO: fix this', 'stdout', true), 'todo');
            assert.strictEqual(classifyLevel('FIXME: broken', 'stdout', true), 'todo');
            assert.strictEqual(classifyLevel('HACK: workaround', 'stdout', true), 'todo');
        });

        test('should classify debug/trace', () => {
            assert.strictEqual(classifyLevel('debug: variable value', 'stdout', true), 'debug');
            assert.strictEqual(classifyLevel('trace: entering function', 'stdout', true), 'debug');
        });

        test('should classify notice/important', () => {
            assert.strictEqual(classifyLevel('notice: update available', 'stdout', true), 'notice');
            assert.strictEqual(classifyLevel('important: read this', 'stdout', true), 'notice');
        });

        test('should default to info for unclassified text', () => {
            assert.strictEqual(classifyLevel('hello world', 'stdout', true), 'info');
            assert.strictEqual(classifyLevel('starting server on port 3000', 'stdout', true), 'info');
        });
    });

    suite('classifyLevel — edge cases', () => {

        test('should handle empty string', () => {
            assert.strictEqual(classifyLevel('', 'stdout', true), 'info');
        });

        test('should handle empty category', () => {
            const result = classifyLevel('error: test', '', true);
            // Empty category is not stderr, so should classify by text
            assert.strictEqual(result, 'error');
        });

        test('should be case-insensitive for keywords', () => {
            assert.strictEqual(classifyLevel('WARNING: test', 'stdout', true), 'warning');
            assert.strictEqual(classifyLevel('Warning: test', 'stdout', true), 'warning');
        });
    });

    suite('classifyLevel — Dart/Flutter errors', () => {

        test('should detect _TypeError (Dart internal error)', () => {
            assert.strictEqual(
                classifyLevel('[log] _TypeError (Null check operator used on a null value)', 'stdout', true),
                'error',
            );
        });

        test('should detect _RangeError (Dart internal error)', () => {
            assert.strictEqual(
                classifyLevel('_RangeError (Invalid value)', 'stdout', true),
                'error',
            );
        });

        test('should detect _FormatException (Dart internal error)', () => {
            assert.strictEqual(
                classifyLevel('_FormatException (Unexpected character)', 'stdout', true),
                'error',
            );
        });

        test('should detect "Null check operator" message', () => {
            assert.strictEqual(
                classifyLevel('[log] Null check operator used on a null value', 'stdout', true),
                'error',
            );
        });

        test('should detect I/flutter with _TypeError as error', () => {
            assert.strictEqual(
                classifyLevel('I/flutter (10946): _TypeError (Null check operator used on a null value)', 'stdout', true),
                'error',
            );
        });

        test('should detect I/flutter with Null check operator as error', () => {
            assert.strictEqual(
                classifyLevel('I/flutter (10946): Potential Null Check Operator Error Detected: Null check operator used on a null value', 'stdout', true),
                'error',
            );
        });
    });

    suite('isActionableLevel', () => {

        test('should return true for error', () => {
            assert.strictEqual(isActionableLevel('error'), true);
        });

        test('should return true for warning', () => {
            assert.strictEqual(isActionableLevel('warning'), true);
        });

        test('should return true for performance', () => {
            assert.strictEqual(isActionableLevel('performance'), true);
        });

        test('should return true for todo', () => {
            assert.strictEqual(isActionableLevel('todo'), true);
        });

        test('should return false for info', () => {
            assert.strictEqual(isActionableLevel('info'), false);
        });

        test('should return false for debug', () => {
            assert.strictEqual(isActionableLevel('debug'), false);
        });

        test('should return false for notice', () => {
            assert.strictEqual(isActionableLevel('notice'), false);
        });
    });
});

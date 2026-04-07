import * as assert from 'assert';
import { classifyLevel } from '../../../modules/analysis/level-classifier';

suite('LevelClassifier (special formats)', () => {

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

    suite('classifyLevel — threadtime logcat format', () => {

        const tt = (level: string, tag: string, msg: string) =>
            `03-30 07:34:58.588  4457  4457 ${level} ${tag}: ${msg}`;

        test('should classify each logcat level prefix correctly', () => {
            assert.strictEqual(classifyLevel(tt('D', 'Android', 'subscribed'), 'stdout', true), 'debug');
            assert.strictEqual(classifyLevel(tt('V', 'Verbose', 'trace info'), 'stdout', true), 'debug');
            assert.strictEqual(classifyLevel(tt('I', 'App', 'started'), 'stdout', true), 'info');
            assert.strictEqual(classifyLevel(tt('W', 'InputManager', 'slow'), 'stdout', true), 'warning');
            assert.strictEqual(classifyLevel(tt('E', 'MediaCodec', 'not found'), 'stdout', true), 'error');
            assert.strictEqual(classifyLevel(tt('F', 'System', 'fatal crash'), 'stdout', true), 'error');
            assert.strictEqual(classifyLevel(tt('A', 'libc', 'assertion'), 'stdout', true), 'error');
        });

        test('should promote I with error keyword to error', () => {
            assert.strictEqual(
                classifyLevel(tt('I', 'flutter', '_TypeError (Null check operator used on a null value)'), 'stdout', true),
                'error',
            );
        });

        test('should classify D with TODO keyword as todo', () => {
            assert.strictEqual(
                classifyLevel(tt('D', 'App', 'TODO fix this later'), 'stdout', true),
                'todo',
            );
        });

        test('should classify I with performance keyword as performance', () => {
            assert.strictEqual(
                classifyLevel(tt('I', 'Choreographer', 'Skipped 30 frames'), 'stdout', true),
                'performance',
            );
        });

        test('should handle Drift SQL in threadtime format as database', () => {
            assert.strictEqual(
                classifyLevel(tt('I', 'flutter (5475)', 'Drift: Sent SELECT 1'), 'stdout', true),
                'database',
            );
        });

        test('should handle Drift SQL E/ in threadtime as database not error', () => {
            assert.strictEqual(
                classifyLevel(tt('E', 'flutter', 'Drift: Sent DELETE FROM activities'), 'stdout', true),
                'database',
            );
        });
    });

    suite('classifyLevel — generic SQL (non-Drift)', () => {

        test('should classify SELECT...FROM as database', () => {
            assert.strictEqual(classifyLevel('SELECT * FROM users WHERE id = ?', 'stdout', true), 'database');
        });

        test('should classify INSERT INTO as database', () => {
            assert.strictEqual(classifyLevel('INSERT INTO users (name) VALUES (?)', 'stdout', true), 'database');
        });

        test('should classify UPDATE...SET as database', () => {
            assert.strictEqual(classifyLevel('UPDATE users SET name = ? WHERE id = 1', 'stdout', true), 'database');
        });

        test('should classify DELETE FROM as database', () => {
            assert.strictEqual(classifyLevel('DELETE FROM sessions WHERE expired = 1', 'stdout', true), 'database');
        });

        test('should classify CREATE TABLE as database', () => {
            assert.strictEqual(classifyLevel('CREATE TABLE users (id INTEGER PRIMARY KEY)', 'stdout', true), 'database');
        });

        test('should classify PRAGMA as database', () => {
            assert.strictEqual(classifyLevel('PRAGMA journal_mode', 'stdout', true), 'database');
        });

        test('should not classify bare SELECT as database', () => {
            assert.strictEqual(classifyLevel('please select an option', 'stdout', true), 'info');
        });

        test('should not promote SQL to database when error pattern matches', () => {
            assert.strictEqual(
                classifyLevel('Error: SELECT * FROM users failed', 'stdout', true),
                'error',
            );
        });

        test('should classify generic SQL under logcat I/ prefix as database', () => {
            assert.strictEqual(
                classifyLevel('I/Room: SELECT id, name FROM users WHERE active = 1', 'stdout', true),
                'database',
            );
        });
    });

});

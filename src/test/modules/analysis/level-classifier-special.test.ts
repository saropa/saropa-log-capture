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

    suite('classifyLevel — DB vendor bracket tags and "Vendor:" prefixes', () => {

        // The three examples below are real lines from the contacts app debug
        // session that previously slipped through the level filter when the user
        // disabled the Database level. They now classify as 'database' so the
        // filter can group them with Drift SQL output.

        test('should classify "DRIFT:" colon prefix as database despite "failed" keyword', () => {
            assert.strictEqual(
                classifyLevel('DRIFT: VM Service WebSocket connect failed: Got fragment', 'stdout', true),
                'database',
            );
        });

        test('should classify "[IsarDriftRowCountAudit]" bracket tag as database', () => {
            assert.strictEqual(
                classifyLevel('[log] [IsarDriftRowCountAudit] contact_avatars: isar=n/a drift=0 (ContactAvatarDBModel)', 'stdout', true),
                'database',
            );
        });

        test('should classify "[Drift]" bare bracket tag as database', () => {
            assert.strictEqual(
                classifyLevel('[Drift] connection pool warming up', 'stdout', true),
                'database',
            );
        });

        test('should classify "Isar:" colon prefix as database', () => {
            assert.strictEqual(
                classifyLevel('Isar: opened collection contact_avatars', 'stdout', true),
                'database',
            );
        });

        test('should NOT promote mid-message "[Drift]" mention to database', () => {
            // Anchored matcher — bracket tag must be at line head.
            assert.strictEqual(
                classifyLevel('see [Drift] for migration details', 'stdout', true),
                'info',
            );
        });

        test('should still classify "[Drift] Error: lost" as error (error wins over annotation)', () => {
            assert.strictEqual(
                classifyLevel('[Drift] Error: lost connection to database', 'stdout', true),
                'error',
            );
        });

        test('should classify "[SqliteCache]" under I/flutter logcat as database', () => {
            assert.strictEqual(
                classifyLevel('I/flutter (12345): [SqliteCache] evicting stale entries', 'stdout', true),
                'database',
            );
        });

        test('should NOT regress: bare "DB" prefix does NOT promote (excluded vendor list)', () => {
            // Bare DB/SQL excluded to avoid false positives on common English.
            assert.strictEqual(
                classifyLevel('DB: this is just a regular message', 'stdout', true),
                'info',
            );
        });
    });

    suite('classifyLevel — lint-report false positives (snake_case, prose)', () => {

        // Saropa Lints reports embed yaml-style rule lists and code-comment frames
        // (`  | # …`) inside the log viewer. The pre-fix patterns hit three families
        // of false positive in these reports — verify each family stays as info.

        test('should not promote snake_case "_exception" rule name to error', () => {
            // Pre-fix: `_\w*Exception\b` matched because `\w` includes `_` — the
            // regex engine found `_catching_generic_exception` and treated it as a
            // Dart private type. Dart private types are `_PascalCase`, never snake_case.
            assert.strictEqual(
                classifyLevel('    - avoid_catching_generic_exception', 'stdout', true),
                'info',
            );
        });

        test('should not promote snake_case "_error" rule names to error', () => {
            assert.strictEqual(
                classifyLevel('    - avoid_clearing_form_on_error', 'stdout', true),
                'info',
            );
            assert.strictEqual(
                classifyLevel('    - avoid_print_error', 'stdout', true),
                'info',
            );
        });

        test('should not promote lowercase "error:" mid-sentence prose to error', () => {
            // Pre-fix: `\w*(?:error|exception)\s*[:\]!(]` with /i matched lowercase
            // "error:" anywhere. Dart label conventions are PascalCase ("Error:"),
            // so dropping /i on this branch keeps the label catcher real-label-only.
            assert.strictEqual(
                classifyLevel('  | # Structural classification error: rule lumps FutureBuilder, StreamBuilder,', 'stdout', true),
                'info',
            );
        });

        test('should still detect "Error:" / "TypeError:" / "Exception:" labels (PascalCase)', () => {
            // Regression guard: the case-sensitive tightening must preserve real labels.
            assert.strictEqual(classifyLevel('Error: something broke', 'stdout', true), 'error');
            assert.strictEqual(classifyLevel('TypeError: foo is not a function', 'stdout', true), 'error');
            assert.strictEqual(classifyLevel('NullPointerException: null', 'stdout', true), 'error');
            assert.strictEqual(
                classifyLevel('PermissionDeniedException (no OS grant on file)', 'stdout', true),
                'error',
            );
        });

        test('should still detect "_PascalCaseError" Dart private types', () => {
            assert.strictEqual(classifyLevel('_TypeError (null)', 'stdout', true), 'error');
            assert.strictEqual(classifyLevel('_HttpException: connection lost', 'stdout', true), 'error');
            assert.strictEqual(classifyLevel('_RangeError thrown', 'stdout', true), 'error');
        });

        test('should still detect bracket-tag error labels regardless of case', () => {
            // strictBracketErrorPattern keeps /i so [ERROR]/[error]/[fatal] all match.
            assert.strictEqual(classifyLevel('[error] bad input', 'stdout', true), 'error');
            assert.strictEqual(classifyLevel('[ERROR] system failure', 'stdout', true), 'error');
            assert.strictEqual(classifyLevel('[fatal] shutdown', 'stdout', true), 'error');
        });

        test('should not promote "cannot see/tell/think" prose to warning', () => {
            // Pre-fix: structuralWarnPattern matched any verb after cannot — "cannot
            // see the pair" in a code comment classified as warning. Negative
            // lookahead now excludes perception/cognition verbs.
            assert.strictEqual(
                classifyLevel("  | # hand off close to a caller; rule's single-method scope cannot see the pair.", 'stdout', true),
                'info',
            );
            assert.strictEqual(classifyLevel('we cannot tell which one matched', 'stdout', true), 'info');
            assert.strictEqual(classifyLevel('cannot know without inspecting the source', 'stdout', true), 'info');
        });

        test('should still detect "could not / cannot / unable to / failed to <action-verb>" failures', () => {
            // Regression guard: real actionable failures must still classify as warning.
            assert.strictEqual(
                classifyLevel('databaseDecode: could not decode "{…}" as DatabaseValueType.Json', 'stdout', true),
                'warning',
            );
            assert.strictEqual(classifyLevel('cannot open file: permission denied', 'stdout', true), 'warning');
            assert.strictEqual(classifyLevel('unable to connect to server', 'stdout', true), 'warning');
            assert.strictEqual(classifyLevel('failed to parse response', 'stdout', true), 'warning');
            assert.strictEqual(classifyLevel("couldn't allocate buffer", 'stdout', true), 'warning');
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

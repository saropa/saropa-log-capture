/**
 * Tests for app-emitted head bracket tags (`[db]`, `[perf:meta]`, …) that route a line
 * to a severity level via tag-level-dictionary.ts. Separate file because
 * level-classifier.test.ts is at the line limit.
 */
import * as assert from 'assert';
import { classifyLevel } from '../../../modules/analysis/level-classifier';

suite('LevelClassifier — app head tags', () => {

    // The reported bug: an app's own DB line with no vendor token / SQL keyword. Without a tag
    // it classifies as info and the DB filter dot can't hide it; the explicit [db] fixes that.
    test('should classify [db] app line as database', () => {
        assert.strictEqual(
            classifyLevel('[db] bulkPreload DRIFT WRITE DONE — wrote 185 rows', 'stdout', true),
            'database',
        );
    });

    // Explicit tag beats the "failed" keyword that would otherwise make this a warning.
    test('should let [db] win over the warning keyword sweep', () => {
        assert.strictEqual(classifyLevel('[db] bulkPreload failed mid-batch', 'stdout', true), 'database');
    });

    // A structural error still beats the tag — the error check runs first.
    test('should let a structural error beat [db]', () => {
        assert.strictEqual(classifyLevel('[db] Error: lost connection', 'stdout', true), 'error');
    });

    test('should classify [perf:metadata] as performance and ignore the metadata', () => {
        assert.strictEqual(classifyLevel('[perf:cold start] first frame 1840ms', 'stdout', true), 'performance');
    });

    test('should classify [todo] as todo', () => {
        assert.strictEqual(classifyLevel('[todo] backfill missing rows', 'stdout', true), 'todo');
    });

    test('should classify [warn] as warning', () => {
        assert.strictEqual(classifyLevel('[warn] disk space low', 'stdout', true), 'warning');
    });

    // Unrecognized tags must NOT be promoted — they stay info (and remain free-form source chips).
    test('should leave an unrecognized tag as info', () => {
        assert.strictEqual(classifyLevel('[unknowntag] hello world', 'stdout', true), 'info');
    });

    // Tag is recognized after a logcat prefix shell.
    test('should classify [db] behind a logcat prefix as database', () => {
        assert.strictEqual(classifyLevel('I/flutter ( 1): [db] preload done', 'stdout', true), 'database');
    });

    test('should classify [DB] case-insensitively', () => {
        assert.strictEqual(classifyLevel('[DB] preload done', 'stdout', true), 'database');
    });

    // Conservative free-text heuristic extension: new vendor name as a Vendor: prefix.
    test('should classify a Sqlite3 vendor prefix as database', () => {
        assert.strictEqual(classifyLevel('Sqlite3: opened database', 'stdout', true), 'database');
    });
});

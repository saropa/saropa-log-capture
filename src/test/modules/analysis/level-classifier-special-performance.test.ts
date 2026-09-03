import * as assert from 'assert';
import { classifyLevel } from '../../../modules/analysis/level-classifier';

// Split from level-classifier-special.test.ts to keep both files under the line limit.
suite('LevelClassifier (special formats — SQL and performance)', () => {

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

    suite('classifyLevel — quantified performance metrics', () => {

        test('should classify "took <n>ms" pattern as performance', () => {
            assert.strictEqual(classifyLevel('Database query took 2400ms', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('API request took 1850ms', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('Operation took 500ms to complete', 'stdout', true), 'performance');
        });

        test('should classify "took <n.m>s" (decimals) pattern as performance', () => {
            assert.strictEqual(classifyLevel('took 3.5s to execute', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('Processing took 2.1s', 'stdout', true), 'performance');
        });

        test('should classify "took <n> ms" (space before unit) pattern as performance', () => {
            assert.strictEqual(classifyLevel('Query took 500 ms to run', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('took 1200 ms for completion', 'stdout', true), 'performance');
        });

        test('should classify "duration: <n>ms" pattern as performance', () => {
            assert.strictEqual(classifyLevel('Elapsed duration: 1000ms', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('[log] duration: 2400ms for bulk insert', 'stdout', true), 'performance');
        });

        test('should classify "duration: <n.m>s" (decimals) pattern as performance', () => {
            assert.strictEqual(classifyLevel('duration: 1.5s for sync', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('Total duration: 3.2s', 'stdout', true), 'performance');
        });

        test('should classify "duration: <n> ms" (space before unit) pattern as performance', () => {
            assert.strictEqual(classifyLevel('duration: 750 ms processing', 'stdout', true), 'performance');
            assert.strictEqual(classifyLevel('Final duration: 2500 ms', 'stdout', true), 'performance');
        });

        test('should not promote bare "took" or "duration" mid-sentence to performance', () => {
            // Word boundary ensures "took" and "duration" don't match mid-word or without the quantified metric.
            assert.strictEqual(classifyLevel('overtook the lead', 'stdout', true), 'info');
            assert.strictEqual(classifyLevel('the duration of the event', 'stdout', true), 'info');
        });

        test('should still detect performance via [perf] bracket tag alongside quantified metrics', () => {
            // Tag-based perf wins regardless of whether quantified metric is present.
            assert.strictEqual(classifyLevel('[perf] operation complete (took 500ms)', 'stdout', true), 'performance');
        });

        test('should classify under logcat W/ with quantified metric as performance (not warning)', () => {
            // W/ normally promotes to warning, but perf patterns override.
            assert.strictEqual(
                classifyLevel('W/Choreographer: Skipped 12 frames (took 2400ms)', 'stdout', true),
                'performance',
            );
            assert.strictEqual(classifyLevel('W/NetworkLog: took 3500ms for connection', 'stdout', true), 'performance');
        });
    });

});

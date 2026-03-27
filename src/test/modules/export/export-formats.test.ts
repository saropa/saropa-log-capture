import * as assert from 'assert';
import { classifyLevel } from '../../../modules/analysis/level-classifier';
import { escapeCsvField } from '../../../modules/export/export-formats';

// Test the parsing and formatting logic
// Note: Full export tests require VS Code API mocking

suite('ExportFormats', () => {

    suite('CSV field escaping', () => {
        test('should not escape simple strings', () => {
            assert.strictEqual(escapeCsvField('hello'), 'hello');
            assert.strictEqual(escapeCsvField('simple message'), 'simple message');
        });

        test('should escape strings with commas', () => {
            assert.strictEqual(escapeCsvField('hello, world'), '"hello, world"');
        });

        test('should escape strings with quotes', () => {
            assert.strictEqual(escapeCsvField('say "hello"'), '"say ""hello"""');
        });

        test('should escape strings with newlines', () => {
            assert.strictEqual(escapeCsvField('line1\nline2'), '"line1\nline2"');
        });

        test('should escape strings with multiple special chars', () => {
            assert.strictEqual(escapeCsvField('a, "b", c'), '"a, ""b"", c"');
        });
    });

    suite('Level inference (classifyLevel aligned with export)', () => {
        test('stderr is info when stderrTreatAsError is false', () => {
            assert.strictEqual(classifyLevel('normal message', 'stderr', true, false), 'info');
        });

        test('stderr is error when stderrTreatAsError is true', () => {
            assert.strictEqual(classifyLevel('normal message', 'stderr', true, true), 'error');
        });

        test('should detect error from message content', () => {
            assert.strictEqual(classifyLevel('Error: something failed', 'stdout', false, false), 'error');
            assert.strictEqual(classifyLevel('Unhandled exception: null pointer', 'stdout', false, false), 'error');
            assert.strictEqual(classifyLevel('FATAL error occurred', 'stdout', false, false), 'error');
        });

        test('should detect warning from message content', () => {
            assert.strictEqual(classifyLevel('Warning: deprecated', 'stdout', false, false), 'warning');
            assert.strictEqual(classifyLevel('WARN: low memory', 'stdout', false, false), 'warning');
        });

        test('should detect debug from message content', () => {
            assert.strictEqual(classifyLevel('DEBUG: entering function', 'stdout', false, false), 'debug');
            assert.strictEqual(classifyLevel('trace: method called', 'stdout', false, false), 'debug');
        });

        test('should default to info for normal messages', () => {
            assert.strictEqual(classifyLevel('Application started', 'stdout', false, false), 'info');
            assert.strictEqual(classifyLevel('Processing request', 'console', false, false), 'info');
        });
    });

    suite('Line parsing patterns', () => {
        // Test regex patterns used in parseLine
        const withTimestampPattern = /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s+\[(\w+)\]\s+(.*)$/;
        const noTimestampPattern = /^\[(\w+)\]\s+(.*)$/;

        test('should match line with timestamp', () => {
            const line = '[10:30:45.123] [stdout] Hello world';
            const match = line.match(withTimestampPattern);
            assert.ok(match);
            assert.strictEqual(match[1], '10:30:45.123');
            assert.strictEqual(match[2], 'stdout');
            assert.strictEqual(match[3], 'Hello world');
        });

        test('should match line without timestamp', () => {
            const line = '[console] Application started';
            const match = line.match(noTimestampPattern);
            assert.ok(match);
            assert.strictEqual(match[1], 'console');
            assert.strictEqual(match[2], 'Application started');
        });

        test('should not match plain text with timestamp pattern', () => {
            const line = 'Just some plain text';
            const match = line.match(withTimestampPattern);
            assert.strictEqual(match, null);
        });
    });

    suite('Timestamp building', () => {
        test('should combine date from session start with time from line', () => {
            const sessionStart = '2024-01-15T00:00:00.000Z';
            const timeStr = '10:30:45.123';
            const dateMatch = sessionStart.match(/^(\d{4}-\d{2}-\d{2})/);
            const result = dateMatch ? `${dateMatch[1]}T${timeStr}Z` : timeStr;
            assert.strictEqual(result, '2024-01-15T10:30:45.123Z');
        });

        test('should return time only if no session start', () => {
            const timeStr = '10:30:45.123';
            const sessionStart = null;
            const result = sessionStart ? 'should not happen' : timeStr;
            assert.strictEqual(result, '10:30:45.123');
        });
    });
});

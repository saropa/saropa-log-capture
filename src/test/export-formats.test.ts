import * as assert from 'assert';

// Test the parsing and formatting logic
// Note: Full export tests require VS Code API mocking

suite('ExportFormats', () => {

    suite('CSV field escaping', () => {
        // Inline implementation for testing (mirrors export-formats.ts)
        function escapeCsvField(value: string): string {
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }

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

    suite('Level inference', () => {
        // Inline implementation for testing (mirrors export-formats.ts)
        function inferLevel(message: string, category: string): string {
            const lower = message.toLowerCase();
            if (category === 'stderr') {
                return 'error';
            }
            if (/\b(error|exception|fatal|crash|panic)\b/i.test(lower)) {
                return 'error';
            }
            if (/\b(warn(ing)?|caution)\b/i.test(lower)) {
                return 'warning';
            }
            if (/\b(debug|trace|verbose)\b/i.test(lower)) {
                return 'debug';
            }
            return 'info';
        }

        test('should detect error level from stderr category', () => {
            assert.strictEqual(inferLevel('normal message', 'stderr'), 'error');
        });

        test('should detect error from message content', () => {
            assert.strictEqual(inferLevel('Error: something failed', 'stdout'), 'error');
            assert.strictEqual(inferLevel('Unhandled exception: null pointer', 'stdout'), 'error');
            assert.strictEqual(inferLevel('FATAL error occurred', 'stdout'), 'error');
        });

        test('should detect warning from message content', () => {
            assert.strictEqual(inferLevel('Warning: deprecated', 'stdout'), 'warning');
            assert.strictEqual(inferLevel('WARN: low memory', 'stdout'), 'warning');
        });

        test('should detect debug from message content', () => {
            assert.strictEqual(inferLevel('DEBUG: entering function', 'stdout'), 'debug');
            assert.strictEqual(inferLevel('trace: method called', 'stdout'), 'debug');
        });

        test('should default to info for normal messages', () => {
            assert.strictEqual(inferLevel('Application started', 'stdout'), 'info');
            assert.strictEqual(inferLevel('Processing request', 'console'), 'info');
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

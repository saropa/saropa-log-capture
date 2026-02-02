import * as assert from 'assert';
import { formatLine, LineFormatContext, SourceLocation } from '../modules/log-session-helpers';

/** Build a LineFormatContext with sensible defaults, overriding as needed. */
function ctx(overrides: Partial<LineFormatContext> = {}): LineFormatContext {
    return {
        timestamp: new Date('2025-06-15T14:30:45.123Z'),
        includeTimestamp: true,
        includeSourceLocation: false,
        includeElapsedTime: false,
        ...overrides,
    };
}

suite('formatLine', () => {

    test('should format with timestamp and category', () => {
        const result = formatLine('Hello world', 'stdout', ctx());
        assert.ok(result.includes('[stdout]'));
        assert.ok(result.includes('Hello world'));
        assert.ok(result.includes('.123]'));
    });

    test('should format without timestamp when disabled', () => {
        const result = formatLine('Hello', 'console', ctx({ includeTimestamp: false }));
        assert.strictEqual(result, '[console] Hello');
    });

    test('should include source location when enabled and present', () => {
        const sourceLocation: SourceLocation = { path: '/home/user/app.ts', line: 42 };
        const result = formatLine('msg', 'stdout', ctx({ includeSourceLocation: true, sourceLocation }));
        assert.ok(result.includes('[app.ts:42]'));
    });

    test('should include column in source location when > 0', () => {
        const sourceLocation: SourceLocation = { path: '/home/user/app.ts', line: 42, column: 5 };
        const result = formatLine('msg', 'stdout', ctx({ includeSourceLocation: true, sourceLocation }));
        assert.ok(result.includes('[app.ts:42:5]'));
    });

    test('should omit source location when path is missing', () => {
        const sourceLocation: SourceLocation = { line: 42 };
        const result = formatLine('msg', 'stdout', ctx({ includeSourceLocation: true, sourceLocation }));
        assert.ok(!result.includes('['));
        assert.ok(result.includes('[stdout]'));
    });

    test('should omit source location when setting is off', () => {
        const sourceLocation: SourceLocation = { path: '/app.ts', line: 10 };
        const result = formatLine('msg', 'stdout', ctx({ includeSourceLocation: false, sourceLocation }));
        assert.ok(!result.includes('app.ts'));
    });

    test('should include elapsed time when enabled', () => {
        const result = formatLine('msg', 'stdout', ctx({ includeElapsedTime: true, elapsedMs: 125 }));
        assert.ok(result.includes('[+125ms]'));
    });

    test('should format elapsed time in seconds for >= 1000ms', () => {
        const result = formatLine('msg', 'stdout', ctx({ includeElapsedTime: true, elapsedMs: 1500 }));
        assert.ok(result.includes('[+1.5s]'));
    });

    test('should format elapsed time as rounded seconds for >= 10000ms', () => {
        const result = formatLine('msg', 'stdout', ctx({ includeElapsedTime: true, elapsedMs: 15432 }));
        assert.ok(result.includes('[+15s]'));
    });

    test('should clamp negative elapsed to +0ms', () => {
        const result = formatLine('msg', 'stdout', ctx({ includeElapsedTime: true, elapsedMs: -5 }));
        assert.ok(result.includes('[+0ms]'));
    });

    test('should omit elapsed when undefined', () => {
        const result = formatLine('msg', 'stdout', ctx({ includeElapsedTime: true }));
        assert.ok(!result.includes('+'));
    });

    test('should include all parts when all features enabled', () => {
        const sourceLocation: SourceLocation = { path: '/src/main.dart', line: 100, column: 3 };
        const result = formatLine('Connected', 'console', ctx({
            includeSourceLocation: true,
            includeElapsedTime: true,
            elapsedMs: 250,
            sourceLocation,
        }));
        assert.ok(result.includes('.123]'));
        assert.ok(result.includes('[+250ms]'));
        assert.ok(result.includes('[console]'));
        assert.ok(result.includes('[main.dart:100:3]'));
        assert.ok(result.includes('Connected'));
    });

    test('should handle Windows backslash paths in source location', () => {
        const sourceLocation: SourceLocation = { path: 'C:\\Users\\dev\\app.ts', line: 7 };
        const result = formatLine('msg', 'stdout', ctx({ includeSourceLocation: true, sourceLocation }));
        assert.ok(result.includes('[app.ts:7]'));
    });

    test('should show filename only when line is undefined', () => {
        const sourceLocation: SourceLocation = { path: '/src/app.ts' };
        const result = formatLine('msg', 'stdout', ctx({ includeSourceLocation: true, sourceLocation }));
        assert.ok(result.includes('[app.ts]'));
        assert.ok(!result.includes(':'));
    });

    test('should omit column when column is 0', () => {
        const sourceLocation: SourceLocation = { path: '/app.ts', line: 5, column: 0 };
        const result = formatLine('msg', 'stdout', ctx({ includeSourceLocation: true, sourceLocation }));
        assert.ok(result.includes('[app.ts:5]'));
        assert.ok(!result.includes(':0'));
    });
});

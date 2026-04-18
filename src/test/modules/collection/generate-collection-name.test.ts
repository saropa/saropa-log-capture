/**
 * Tests for generateCollectionName — converts filenames to human-readable collection names.
 */

import * as assert from 'assert';
import { generateCollectionName } from '../../../collection-commands-helpers';

suite('generateCollectionName', () => {
    test('should strip .log extension and title-case', () => {
        assert.strictEqual(
            generateCollectionName('flutter_debug.log'),
            'Flutter Debug',
        );
    });

    test('should preserve date hyphens (digit-hyphen-digit)', () => {
        assert.strictEqual(
            generateCollectionName('flutter_debug_2024-01-15.log'),
            'Flutter Debug 2024-01-15',
        );
    });

    test('should replace non-date hyphens with spaces', () => {
        assert.strictEqual(
            generateCollectionName('my-app-crash.log'),
            'My App Crash',
        );
    });

    test('should handle mixed underscores and hyphens', () => {
        assert.strictEqual(
            generateCollectionName('auth_timeout-bug.log'),
            'Auth Timeout Bug',
        );
    });

    test('should handle filename without extension', () => {
        assert.strictEqual(
            generateCollectionName('crash_report'),
            'Crash Report',
        );
    });

    test('should handle already-capitalized words', () => {
        assert.strictEqual(
            generateCollectionName('ANR_trace.log'),
            'ANR Trace',
        );
    });

    test('should trim whitespace', () => {
        assert.strictEqual(
            generateCollectionName(' _leading_trailing_ .log'),
            'Leading Trailing',
        );
    });

    test('should handle single word', () => {
        assert.strictEqual(
            generateCollectionName('crashlog.txt'),
            'Crashlog',
        );
    });

    test('should handle empty string', () => {
        assert.strictEqual(
            generateCollectionName(''),
            '',
        );
    });

    test('should handle multiple dots (only strip last extension)', () => {
        assert.strictEqual(
            generateCollectionName('app.2024-01-15.log'),
            'App.2024-01-15',
        );
    });
});

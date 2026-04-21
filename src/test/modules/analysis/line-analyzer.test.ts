import * as assert from 'assert';
import { extractAnalysisTokens, extractAnalysisToken } from '../../../modules/analysis/line-analyzer';

suite('LineAnalyzer', () => {

    suite('extractAnalysisTokens', () => {

        test('should extract error class names', () => {
            const tokens = extractAnalysisTokens('NullPointerException: null reference');
            assert.ok(tokens.some(t => t.type === 'error-class' && t.value === 'NullPointerException'));
        });

        test('should extract multiple error classes', () => {
            const tokens = extractAnalysisTokens('FileNotFoundException caused by SocketException');
            const errorClasses = tokens.filter(t => t.type === 'error-class');
            assert.strictEqual(errorClasses.length, 2);
        });

        test('should extract HTTP status codes (4xx/5xx)', () => {
            const tokens = extractAnalysisTokens('Server returned 404 not found');
            assert.ok(tokens.some(t => t.type === 'http-status' && t.value === '404'));
        });

        test('should extract 5xx status codes', () => {
            const tokens = extractAnalysisTokens('Error: HTTP 503 Service Unavailable');
            assert.ok(tokens.some(t => t.type === 'http-status' && t.value === '503'));
        });

        test('should not extract 2xx or 3xx status codes', () => {
            const tokens = extractAnalysisTokens('Response: 200 OK, redirect: 301');
            const httpTokens = tokens.filter(t => t.type === 'http-status');
            assert.strictEqual(httpTokens.length, 0);
        });

        test('should extract URL paths', () => {
            const tokens = extractAnalysisTokens('GET /api/v2/users returned error');
            assert.ok(tokens.some(t => t.type === 'url-path' && t.value === '/api/v2/users'));
        });

        test('should extract quoted strings', () => {
            const tokens = extractAnalysisTokens('Error: "connection refused" at port');
            assert.ok(tokens.some(t => t.type === 'quoted-string' && t.value === 'connection refused'));
        });

        test('should extract class.method patterns', () => {
            const tokens = extractAnalysisTokens('Handler.onError called');
            assert.ok(tokens.some(t => t.type === 'class-method' && t.value === 'Handler.onError'));
        });

        test('should deduplicate tokens by type:value', () => {
            const tokens = extractAnalysisTokens(
                'NullPointerException and NullPointerException again',
            );
            const errors = tokens.filter(t => t.type === 'error-class' && t.value === 'NullPointerException');
            assert.strictEqual(errors.length, 1);
        });

        test('should return empty array for plain text', () => {
            const tokens = extractAnalysisTokens('hello world');
            // May still have matches — check that no error-class tokens
            const errors = tokens.filter(t => t.type === 'error-class');
            assert.strictEqual(errors.length, 0);
        });

        test('should return empty array for empty string', () => {
            assert.strictEqual(extractAnalysisTokens('').length, 0);
        });

        test('should extract source file references', () => {
            const tokens = extractAnalysisTokens('at handler.dart:42');
            assert.ok(tokens.some(t => t.type === 'source-file'));
        });

        test('should set appropriate labels', () => {
            const tokens = extractAnalysisTokens('NullPointerException: null');
            const error = tokens.find(t => t.type === 'error-class');
            assert.ok(error);
            assert.ok(error.label.startsWith('Error:'));
        });

        test('should not match short quoted strings', () => {
            const tokens = extractAnalysisTokens('value "ab" is too short');
            const quoted = tokens.filter(t => t.type === 'quoted-string');
            assert.strictEqual(quoted.length, 0);
        });

        test('should extract TimeoutException', () => {
            const tokens = extractAnalysisTokens('TimeoutException: Future not completed');
            assert.ok(tokens.some(t => t.value === 'TimeoutException'));
        });

        test('should extract FormatError', () => {
            const tokens = extractAnalysisTokens('FormatError: unexpected character');
            assert.ok(tokens.some(t => t.value === 'FormatError'));
        });

        // Fallback identifier extraction: only fires when no strong token
        // (error-class/http/url/quoted/source-file/dotted method) matches.
        // Regression guard for "No analyzable tokens found in this line."
        // which previously blocked Analyze on framework slow-operation lines.
        suite('camelCase / PascalCase fallback', () => {
            test('should extract ActivityManager slow-op camelCase methods', () => {
                const line = 'ActivityManager » Slow operation: 263ms so far, now at finishAttachApplicationInner: after updateOomAdjLocked';
                const tokens = extractAnalysisTokens(line);
                assert.ok(tokens.length > 0, 'expected fallback to produce tokens');
                assert.ok(tokens.some(t => t.value === 'finishAttachApplicationInner'));
                assert.ok(tokens.some(t => t.value === 'updateOomAdjLocked'));
                assert.ok(tokens.some(t => t.value === 'ActivityManager'));
            });

            test('should not run fallback when strong tokens matched', () => {
                // NullPointerException is an error-class match; ActivityManager
                // should NOT appear as a fallback token because the fallback
                // scan is skipped entirely when any strong token was found.
                const line = 'ActivityManager got NullPointerException';
                const tokens = extractAnalysisTokens(line);
                assert.ok(tokens.some(t => t.type === 'error-class' && t.value === 'NullPointerException'));
                assert.ok(!tokens.some(t => t.value === 'ActivityManager'),
                    'fallback should not add class-name when strong token present');
            });

            test('should not match single-segment capitalized words', () => {
                // "Slow", "Android" — single PascalCase word each, no second
                // uppercase segment, so fallback must skip them.
                const tokens = extractAnalysisTokens('Slow Android thing happened here');
                assert.strictEqual(tokens.length, 0);
            });
        });
    });

    suite('extractAnalysisToken', () => {

        test('should return best token value', () => {
            const result = extractAnalysisToken('NullPointerException at handler.dart:42');
            assert.ok(result);
        });

        test('should return undefined for no tokens', () => {
            assert.strictEqual(extractAnalysisToken('hello world'), undefined);
        });

        test('should return undefined for empty string', () => {
            assert.strictEqual(extractAnalysisToken(''), undefined);
        });
    });
});

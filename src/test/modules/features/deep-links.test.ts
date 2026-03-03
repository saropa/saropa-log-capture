import * as assert from 'assert';
import * as vscode from 'vscode';
import { parseDeepLinkUri, generateDeepLink } from '../../../modules/features/deep-links';

suite('DeepLinks', () => {

    suite('parseDeepLinkUri', () => {
        test('should parse URI with session and line', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=test.log&line=42');
            const params = parseDeepLinkUri(uri);
            assert.ok(params);
            assert.strictEqual(params.session, 'test.log');
            assert.strictEqual(params.line, 42);
        });

        test('should parse URI with session only', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=test.log');
            const params = parseDeepLinkUri(uri);
            assert.ok(params);
            assert.strictEqual(params.session, 'test.log');
            assert.strictEqual(params.line, undefined);
        });

        test('should return undefined for wrong path', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/wrong?session=test.log');
            const params = parseDeepLinkUri(uri);
            assert.strictEqual(params, undefined);
        });

        test('should return undefined for missing session', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?line=42');
            const params = parseDeepLinkUri(uri);
            assert.strictEqual(params, undefined);
        });

        test('should handle invalid line number', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=test.log&line=abc');
            const params = parseDeepLinkUri(uri);
            assert.ok(params);
            assert.strictEqual(params.session, 'test.log');
            assert.strictEqual(params.line, undefined);
        });

        test('should handle URL-encoded session names', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=20260128_143200_my%20app.log&line=1');
            const params = parseDeepLinkUri(uri);
            assert.ok(params);
            assert.strictEqual(params.session, '20260128_143200_my app.log');
            assert.strictEqual(params.line, 1);
        });
    });

    suite('generateDeepLink', () => {
        test('should generate link with session and line', () => {
            const link = generateDeepLink('test.log', 42);
            assert.ok(link.includes('session=test.log'));
            assert.ok(link.includes('line=42'));
            assert.ok(link.startsWith('vscode://saropa.saropa-log-capture/open'));
        });

        test('should generate link with session only', () => {
            const link = generateDeepLink('test.log');
            assert.ok(link.includes('session=test.log'));
            assert.ok(!link.includes('line='));
        });

        test('should URL-encode special characters', () => {
            const link = generateDeepLink('my app.log', 1);
            assert.ok(link.includes('session=my+app.log') || link.includes('session=my%20app.log'));
        });

        test('should not include line parameter for zero or negative', () => {
            const link1 = generateDeepLink('test.log', 0);
            assert.ok(!link1.includes('line='));

            const link2 = generateDeepLink('test.log', -1);
            assert.ok(!link2.includes('line='));
        });

        test('should fallback session name when empty string', () => {
            const link = generateDeepLink('');
            assert.ok(link.includes('session=session.log'));
        });

        test('should trim session filename', () => {
            const link = generateDeepLink('  my.log  ', 1);
            assert.ok(link.includes('session=my.log'));
        });
    });

    suite('parseDeepLinkUri - defensive', () => {
        test('should return undefined for path traversal in session', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=../../../etc/passwd');
            assert.strictEqual(parseDeepLinkUri(uri), undefined);
        });

        test('should return undefined for session with backslash', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=..\\foo.log');
            assert.strictEqual(parseDeepLinkUri(uri), undefined);
        });

        test('should return undefined for session starting with slash', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=/absolute.log');
            assert.strictEqual(parseDeepLinkUri(uri), undefined);
        });

        test('should return undefined for empty session', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=');
            assert.strictEqual(parseDeepLinkUri(uri), undefined);
        });

        test('should clamp line to safe range (valid line accepted)', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=app.log&line=1');
            const params = parseDeepLinkUri(uri);
            assert.ok(params);
            assert.strictEqual(params.line, 1);
        });

        test('should drop line when zero', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=app.log&line=0');
            const params = parseDeepLinkUri(uri);
            assert.ok(params);
            assert.strictEqual(params.line, undefined);
        });

        test('should drop line when negative', () => {
            const uri = vscode.Uri.parse('vscode://saropa.saropa-log-capture/open?session=app.log&line=-1');
            const params = parseDeepLinkUri(uri);
            assert.ok(params);
            assert.strictEqual(params.line, undefined);
        });
    });
});

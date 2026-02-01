import * as assert from 'assert';
import * as vscode from 'vscode';
import { parseDeepLinkUri, generateDeepLink } from '../modules/deep-links';

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
    });
});

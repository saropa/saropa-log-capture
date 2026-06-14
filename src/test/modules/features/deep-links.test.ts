import * as assert from 'assert';
import * as vscode from 'vscode';
import { parseDeepLinkUri, generateDeepLink, createUriHandler } from '../../../modules/features/deep-links';
import { t } from '../../../l10n';

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

    // C1 hardening: a /import deep link writes downloaded files, so it must require explicit modal
    // consent (named source) before the import runs — VS Code's generic URI consent is not enough.
    suite('createUriHandler /import consent', () => {
        const originalWarn = vscode.window.showWarningMessage;
        teardown(() => {
            vscode.window.showWarningMessage = originalWarn;
        });

        function recordingHandlers(): { gist: string[]; url: string[]; handlers: {
            importFromGist: (id: string) => Promise<void>;
            importFromUrl: (u: string) => Promise<void>;
        }; } {
            const gist: string[] = [];
            const url: string[] = [];
            return {
                gist, url,
                handlers: {
                    importFromGist: async (id: string) => { gist.push(id); },
                    importFromUrl: async (u: string) => { url.push(u); },
                },
            };
        }

        function stubConsent(result: string | undefined): void {
            vscode.window.showWarningMessage = (async () => result) as typeof vscode.window.showWarningMessage;
        }

        test('declining the consent modal does not import the gist', async () => {
            stubConsent(undefined);
            const r = recordingHandlers();
            await createUriHandler(r.handlers).handleUri(
                vscode.Uri.parse('vscode://saropa.saropa-log-capture/import?gist=abc123'));
            assert.deepStrictEqual(r.gist, [], 'import must not run when consent is declined');
        });

        test('confirming the consent modal imports the gist', async () => {
            stubConsent(t('msg.confirmImport.proceed'));
            const r = recordingHandlers();
            await createUriHandler(r.handlers).handleUri(
                vscode.Uri.parse('vscode://saropa.saropa-log-capture/import?gist=abc123'));
            assert.deepStrictEqual(r.gist, ['abc123'], 'import runs with the gist id once consent is given');
        });

        test('declining the consent modal does not import the url', async () => {
            stubConsent(undefined);
            const r = recordingHandlers();
            await createUriHandler(r.handlers).handleUri(
                vscode.Uri.parse('vscode://saropa.saropa-log-capture/import?url=https://example.com/x.slc'));
            assert.deepStrictEqual(r.url, [], 'url import must not run when consent is declined');
        });
    });
});

import * as assert from 'assert';
import { buildViewerHtml, getNonce, getEffectiveViewerLines } from '../../ui/provider/viewer-content';

suite('Viewer HTML', () => {

    suite('getEffectiveViewerLines', () => {
        test('returns MAX_VIEWER_LINES (50000) when viewerMaxLines is 0', () => {
            assert.strictEqual(getEffectiveViewerLines(100_000, 0), 50_000);
            assert.strictEqual(getEffectiveViewerLines(30_000, 0), 50_000);
        });

        test('returns min(viewerMaxLines, maxLines) when viewerMaxLines > 0', () => {
            assert.strictEqual(getEffectiveViewerLines(100_000, 25_000), 25_000);
            assert.strictEqual(getEffectiveViewerLines(100_000, 80_000), 80_000);
        });

        test('caps at maxLines when viewerMaxLines exceeds maxLines', () => {
            assert.strictEqual(getEffectiveViewerLines(20_000, 50_000), 20_000);
            assert.strictEqual(getEffectiveViewerLines(10_000, 100_000), 10_000);
        });

        test('handles viewerMaxLines equal to maxLines', () => {
            assert.strictEqual(getEffectiveViewerLines(50_000, 50_000), 50_000);
        });
    });

    suite('buildViewerHtml viewerMaxLines', () => {
        test('injects viewerMaxLines into viewer script when provided', () => {
            const html = buildViewerHtml({ nonce: getNonce(), version: '0.0.0', viewerMaxLines: 25_000 });
            assert.ok(html.includes('var MAX_LINES = 25000'), 'viewer script should cap at 25000');
        });

        test('uses default MAX_VIEWER_LINES when viewerMaxLines omitted', () => {
            const html = buildViewerHtml({ nonce: getNonce(), version: '0.0.0' });
            assert.ok(html.includes('var MAX_LINES = 50000'), 'viewer script should default to 50000');
        });
    });

    suite('codicon stylesheet', () => {
        test('should include codicon link tag when URI provided', () => {
            const uri = 'https://file+.vscode-resource.test/media/codicons/codicon.css';
            const html = buildViewerHtml({ nonce: getNonce(), version: '0.0.0', cspSource: 'https://file+.vscode-resource.test', codiconCssUri: uri });
            assert.ok(html.includes(`<link rel="stylesheet" href="${uri}">`));
        });

        test('should omit codicon link tag when URI not provided', () => {
            const html = buildViewerHtml({ nonce: getNonce(), version: '0.0.0' });
            assert.ok(!html.includes('<link rel="stylesheet"'));
        });

        test('should add cspSource to style-src when provided', () => {
            const csp = 'https://file+.vscode-resource.test';
            const html = buildViewerHtml({ nonce: getNonce(), version: '0.0.0', cspSource: csp });
            assert.ok(html.includes(`style-src`));
            assert.ok(html.includes(csp));
        });
    });

    suite('script syntax', () => {
        test('should define stripTags null-safe so Copy All never throws on missing line.html', () => {
            const html = buildViewerHtml({ nonce: getNonce(), extensionUri: 'https://example.com', version: '0.0.0' });
            assert.ok(html.includes('function stripTags'), 'script should define stripTags');
            assert.ok(html.includes('html == null'), 'stripTags should guard against null/undefined');
        });

        test('should produce HTML with no script syntax errors', () => {
            const html = buildViewerHtml({ nonce: getNonce(), extensionUri: 'https://example.com', version: '0.0.0' });
            const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
            let match: RegExpExecArray | null;
            let blockIndex = 0;

            while ((match = scriptRegex.exec(html)) !== null) {
                const content = match[1];
                if (!content.trim()) { continue; }
                try {
                    new Function(content);
                } catch (e: unknown) {
                    const err = e as Error;
                    assert.fail(
                        `SyntaxError in script block ${blockIndex}: ${err.message}`,
                    );
                }
                blockIndex++;
            }

            assert.ok(blockIndex > 0, 'Expected at least one script block');
        });
    });
});

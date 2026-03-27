import * as assert from 'node:assert';
import { buildViewerHtml, getNonce, getEffectiveViewerLines } from '../../ui/provider/viewer-content';

suite('Viewer HTML', () => {

    suite('getEffectiveViewerLines', () => {
        test('returns maxLines when viewerMaxLines is 0', () => {
            assert.strictEqual(getEffectiveViewerLines(100_000, 0), 100_000);
            assert.strictEqual(getEffectiveViewerLines(30_000, 0), 30_000);
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

        test('uses default viewer cap when viewerMaxLines omitted', () => {
            const html = buildViewerHtml({ nonce: getNonce(), version: '0.0.0' });
            assert.ok(html.includes('var MAX_LINES = 100000'), 'viewer script should default to 100000');
        });

        test('defaults viewerPreserveAsciiBoxArt to true in embedded script', () => {
            const html = buildViewerHtml({ nonce: getNonce(), version: '0.0.0' });
            assert.ok(
                html.includes('var viewerPreserveAsciiBoxArt = true'),
                'banner preservation should default on',
            );
        });

        test('injects viewerPreserveAsciiBoxArt false when disabled', () => {
            const html = buildViewerHtml({
                nonce: getNonce(),
                version: '0.0.0',
                viewerPreserveAsciiBoxArt: false,
            });
            assert.ok(html.includes('var viewerPreserveAsciiBoxArt = false'));
        });

        test('injects SQL pattern chip thresholds when provided (DB_05)', () => {
            const html = buildViewerHtml({
                nonce: getNonce(),
                version: '0.0.0',
                viewerSqlPatternChipMinCount: 3,
                viewerSqlPatternMaxChips: 7,
            });
            assert.ok(html.includes('var sqlChipMinCount = 3'));
            assert.ok(html.includes('var sqlPatternMaxChips = 7'));
        });
    });

    suite('accessibility (a11y)', () => {
        test('log content has role=log and aria-label for screen readers', () => {
            const html = buildViewerHtml({ nonce: getNonce(), version: '0.0.0' });
            assert.ok(html.includes('role="log"'), 'log region should have role=log');
            assert.ok(html.includes('aria-label="Log content"'), 'log region should have aria-label');
        });

        test('main content has role=main and line-count has aria-live for announcements', () => {
            const html = buildViewerHtml({ nonce: getNonce(), version: '0.0.0' });
            assert.ok(html.includes('id="main-content" role="main"'), 'primary content should have main landmark');
            assert.ok(html.includes('id="line-count"') && html.includes('aria-live="polite"'), 'line-count should announce updates to screen readers');
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

        test('should decode HTML entities in stripTags', () => {
            const stripTags = new Function(`
                function stripTags(html) {
                    var s = (html == null ? '' : String(html)).replace(/<[^>]*>/g, '');
                    return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
                }
                return stripTags;
            `)() as (input: unknown) => string;

            assert.strictEqual(stripTags('&quot;hello&quot;'), '"hello"', 'should decode &quot;');
            assert.strictEqual(stripTags('a &amp; b'), 'a & b', 'should decode &amp;');
            assert.strictEqual(stripTags('&lt;div&gt;'), '<div>', 'should decode &lt; and &gt;');
            assert.strictEqual(stripTags('it&#39;s'), "it's", 'should decode &#39;');
            assert.strictEqual(stripTags('<b>&quot;bold&quot;</b>'), '"bold"', 'should strip tags then decode');
            assert.strictEqual(stripTags(null), '', 'should handle null');
            assert.strictEqual(stripTags(undefined), '', 'should handle undefined');
            assert.strictEqual(stripTags('&amp;quot;'), '&quot;', 'should not double-decode');
            assert.strictEqual(stripTags('plain text'), 'plain text', 'should pass through plain text');
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

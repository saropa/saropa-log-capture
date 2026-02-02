import * as assert from 'assert';
import { buildViewerHtml, getNonce } from '../ui/viewer-content';

suite('Viewer HTML', () => {

    suite('codicon stylesheet', () => {
        test('should include codicon link tag when URI provided', () => {
            const uri = 'https://file+.vscode-resource.test/media/codicons/codicon.css';
            const html = buildViewerHtml(getNonce(), undefined, '0.0.0', 'https://file+.vscode-resource.test', uri);
            assert.ok(html.includes(`<link rel="stylesheet" href="${uri}">`));
        });

        test('should omit codicon link tag when URI not provided', () => {
            const html = buildViewerHtml(getNonce(), undefined, '0.0.0');
            assert.ok(!html.includes('<link rel="stylesheet"'));
        });

        test('should add cspSource to style-src when provided', () => {
            const csp = 'https://file+.vscode-resource.test';
            const html = buildViewerHtml(getNonce(), undefined, '0.0.0', csp);
            assert.ok(html.includes(`style-src`));
            assert.ok(html.includes(csp));
        });
    });

    suite('script syntax', () => {
        test('should produce HTML with no script syntax errors', () => {
            const html = buildViewerHtml(getNonce(), 'https://example.com', '0.0.0');
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

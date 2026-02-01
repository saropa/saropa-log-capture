import * as assert from 'assert';
import { buildViewerHtml, getNonce } from '../ui/viewer-content';

suite('Viewer Script Syntax', () => {

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

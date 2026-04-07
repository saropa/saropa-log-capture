import * as assert from 'node:assert';
import { getCopyScript } from '../../ui/viewer/viewer-copy';
import { getViewerScriptMessageHandler } from '../../ui/viewer/viewer-script-messages';

/**
 * Before: copyAllToClipboard() sent 'copyToClipboard' (status bar feedback).
 * After: copyAllToClipboard() still sends 'copyToClipboard' (unchanged for
 * context menu / keyboard callers). New copyAllFilteredWithCount() sends
 * 'copyAllFiltered' with lineCount for the title bar button toast.
 */
suite('Copy All Filtered Lines', () => {

    suite('getCopyScript', () => {
        const script = getCopyScript();

        test('should define copyAllFilteredWithCount function', () => {
            assert.ok(
                script.includes('function copyAllFilteredWithCount()'),
                'copy script should define copyAllFilteredWithCount',
            );
        });

        test('should send copyAllFiltered message type with lineCount', () => {
            assert.ok(
                script.includes("type: 'copyAllFiltered'"),
                'copyAllFilteredWithCount should post copyAllFiltered message',
            );
            assert.ok(
                script.includes('lineCount: lines.length'),
                'copyAllFilteredWithCount should include lineCount',
            );
        });

        test('should preserve copyAllToClipboard with original copyToClipboard type', () => {
            assert.ok(
                script.includes('function copyAllToClipboard()'),
                'original copyAllToClipboard should still exist',
            );
            // Verify copyAllToClipboard still uses copyToClipboard, not copyAllFiltered
            const fnMatch = script.match(
                /function copyAllToClipboard\(\)\s*\{[\s\S]*?\n\}/,
            );
            assert.ok(fnMatch, 'should match copyAllToClipboard function body');
            assert.ok(
                fnMatch[0].includes("'copyToClipboard'"),
                'copyAllToClipboard should still post copyToClipboard',
            );
            assert.ok(
                !fnMatch[0].includes("'copyAllFiltered'"),
                'copyAllToClipboard must not post copyAllFiltered',
            );
        });

        test('should guard against empty lines in copyAllFilteredWithCount', () => {
            assert.ok(
                script.includes('if (lines.length === 0) return'),
                'should early-return when no lines match',
            );
        });
    });

    suite('getViewerScriptMessageHandler', () => {
        const handler = getViewerScriptMessageHandler();

        test('should handle triggerCopyAllFiltered message', () => {
            assert.ok(
                handler.includes("case 'triggerCopyAllFiltered':"),
                'message handler should include triggerCopyAllFiltered case',
            );
        });

        test('should call copyAllFilteredWithCount for triggerCopyAllFiltered', () => {
            assert.ok(
                handler.includes('copyAllFilteredWithCount'),
                'triggerCopyAllFiltered should invoke copyAllFilteredWithCount',
            );
        });
    });
});

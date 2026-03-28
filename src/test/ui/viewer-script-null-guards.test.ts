import * as assert from 'node:assert';
import { getViewerScriptMessageHandler } from '../../ui/viewer/viewer-script-messages';
import { getViewerScript } from '../../ui/viewer/viewer-script';
import { getPerformancePanelScript } from '../../ui/panels/viewer-performance-panel';
import { getErrorHandlerScript } from '../../ui/viewer-decorations/viewer-error-handler';

suite('Webview script null guards', () => {

    suite('viewer-script-messages', () => {
        const script = getViewerScriptMessageHandler();

        test('should guard footerEl.classList in clear handler', () => {
            // The clear case must not access footerEl.classList without a null check
            const clearBlock = script.slice(
                script.indexOf("case 'clear':"),
                script.indexOf("case 'updateFooter':"),
            );
            assert.ok(
                clearBlock.includes('if (footerEl) footerEl.classList'),
                'clear handler should guard footerEl.classList',
            );
        });

        test('should guard footerEl.classList in setPaused handler', () => {
            const pausedBlock = script.slice(
                script.indexOf("case 'setPaused':"),
                script.indexOf("case 'setViewingMode':"),
            );
            assert.ok(
                pausedBlock.includes('if (footerEl) footerEl.classList'),
                'setPaused handler should guard footerEl.classList',
            );
        });

        test('should guard footerTextEl in clear handler', () => {
            const clearBlock = script.slice(
                script.indexOf("case 'clear':"),
                script.indexOf("case 'updateFooter':"),
            );
            assert.ok(
                clearBlock.includes("if (footerTextEl) footerTextEl.textContent"),
                'clear handler should guard footerTextEl.textContent',
            );
        });

        test('should guard footerTextEl in updateFooter handler', () => {
            const footerBlock = script.slice(
                script.indexOf("case 'updateFooter':"),
                script.indexOf("case 'setPaused':"),
            );
            assert.ok(
                footerBlock.includes("if (footerTextEl) footerTextEl.textContent"),
                'updateFooter handler should guard footerTextEl.textContent',
            );
        });

        test('should guard jumpBtn.style in loadComplete handler', () => {
            const loadBlock = script.slice(
                script.indexOf("case 'loadComplete':"),
                script.indexOf("case 'loadComplete':") + 400,
            );
            assert.ok(
                loadBlock.includes('if (jumpBtn) jumpBtn.style'),
                'loadComplete handler should guard jumpBtn.style',
            );
        });
    });

    suite('viewer-script', () => {
        const script = getViewerScript(100_000);

        test('should guard logEl.classList in toggleWrap', () => {
            const wrapBlock = script.slice(
                script.indexOf('function toggleWrap'),
                script.indexOf('function toggleWrap') + 200,
            );
            assert.ok(
                wrapBlock.includes('if (logEl) logEl.classList'),
                'toggleWrap should guard logEl.classList',
            );
        });
    });

    suite('viewer-performance-panel switchTab', () => {
        const script = getPerformancePanelScript('insight-');

        test('should guard ppTabCurrent.classList in switchTab', () => {
            const tabBlock = script.slice(
                script.indexOf('function switchTab'),
                script.indexOf('function switchTab') + 400,
            );
            assert.ok(
                tabBlock.includes('if (ppTabCurrent) ppTabCurrent.classList'),
                'switchTab should guard ppTabCurrent.classList',
            );
        });

        test('should guard ppTabTrends.classList in switchTab', () => {
            const tabBlock = script.slice(
                script.indexOf('function switchTab'),
                script.indexOf('function switchTab') + 400,
            );
            assert.ok(
                tabBlock.includes('if (ppTabTrends) ppTabTrends.classList'),
                'switchTab should guard ppTabTrends.classList',
            );
        });
    });

    suite('error handler banner', () => {
        const script = getErrorHandlerScript();

        test('should include line and col in error banner text', () => {
            assert.ok(
                script.includes("'Script error (line ' + line"),
                'banner should show line number',
            );
            assert.ok(
                script.includes("col + '): '"),
                'banner should show column number',
            );
        });
    });
});

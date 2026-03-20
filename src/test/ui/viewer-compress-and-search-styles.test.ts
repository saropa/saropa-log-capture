/**
 * Regression tests for compress-lines viewer logic (embedded script strings) and
 * session-nav CSS scoping so the in-log find row is not styled as bordered nav buttons.
 *
 * These tests intentionally use string assertions (same pattern as viewer-context-menu.test.ts)
 * because behavior lives in webview JavaScript/CSS fragments, not TypeScript modules.
 */
import * as assert from 'node:assert';
import { getViewerDataScript } from '../../ui/viewer/viewer-data';
import { getViewerScriptMessageHandler } from '../../ui/viewer/viewer-script-messages';
import { getOverlayStyles } from '../../ui/viewer-styles/viewer-styles-overlays';
import { getSearchStyles } from '../../ui/viewer-styles/viewer-styles-search';
import { getOptionsPanelHtml } from '../../ui/viewer-panels/viewer-options-panel-html';
import { getLayoutScript } from '../../ui/provider/viewer-layout';
import { getViewerBodyHtml } from '../../ui/provider/viewer-content-body';

suite('Viewer compress lines (embedded script)', () => {
    const dataScript = getViewerDataScript();
    const messageHandler = getViewerScriptMessageHandler();

    test('defines applyCompressConsecutiveDedup and runs it at start of recalcHeights', () => {
        assert.ok(dataScript.includes('function applyCompressConsecutiveDedup'));
        const recalcIdx = dataScript.indexOf('function recalcHeights');
        const applyIdx = dataScript.indexOf('applyCompressConsecutiveDedup()');
        assert.ok(recalcIdx > 0 && applyIdx > 0, 'expected both functions');
        assert.ok(applyIdx < recalcIdx, 'compress pass must run before height loop');
    });

    test('clears compress flags on every pass before early return when mode is off', () => {
        assert.ok(
            dataScript.includes('if (cleared.compressDupHidden) cleared.compressDupHidden = false'),
            'must reset compressDupHidden so toggling mode off restores rows',
        );
        assert.ok(
            dataScript.includes("if (typeof compressLinesMode === 'undefined' || !compressLinesMode) return"),
            'must bail after clear when compress is disabled',
        );
    });

    test('addLines uses full recalc when compressLinesMode is on (not append-only prefix sums)', () => {
        assert.ok(
            messageHandler.includes('compressLinesMode') && messageHandler.includes('recalcHeights'),
            'message handler should branch on compress mode',
        );
        assert.ok(
            messageHandler.includes('Compress mode mutates heights'),
            'document why full recalc is required for streaming',
        );
        /* False positive guard: incremental path must stay in else branch when compress off */
        assert.ok(
            messageHandler.includes('appendPrefixSums'),
            'non-compress path should still support incremental prefix sums',
        );
    });
});

suite('Session nav overlay CSS (search strip not forced to nav-button chrome)', () => {
    const overlay = getOverlayStyles();

    test('does not use blanket #session-nav button selector (regression: find widget looked wrong)', () => {
        assert.ok(
            !overlay.includes('#session-nav button'),
            'bare #session-nav button styled Prev/Next chrome and leaked onto search controls',
        );
        assert.ok(
            overlay.includes('#session-nav .session-nav-controls button'),
            'nav chrome must be scoped to session-nav-controls only',
        );
    });
});

suite('Search strip and options (compress UI wiring)', () => {
    test('search styles use widget shadow token for popovers', () => {
        const css = getSearchStyles();
        assert.ok(css.includes('--vscode-widget-shadow'), 'popover should use theme widget shadow');
        assert.ok(css.includes('--vscode-editorWidget-background'), 'popover background should match editor widgets');
    });

    test('options panel includes compress checkbox id for sync', () => {
        const html = getOptionsPanelHtml();
        assert.ok(html.includes('id="opt-compress-lines"'), 'compress toggle must exist for syncOptionsPanelUi');
    });

    test('layout script exposes toggleCompressLines', () => {
        const layout = getLayoutScript();
        assert.ok(layout.includes('function toggleCompressLines'));
        assert.ok(layout.includes('compressLinesMode'));
    });

    test('layout syncs compress icon and suggestion banner helpers', () => {
        const layout = getLayoutScript();
        assert.ok(layout.includes('function syncCompressIconButton'));
        assert.ok(layout.includes('function showCompressSuggestionBanner'));
        assert.ok(layout.includes('function hideCompressSuggestionBanner'));
    });
});

suite('Viewer compress streak (embedded script)', () => {
    const dataScript = getViewerDataScript();

    test('tracks consecutive duplicate streak and threshold for suggestion', () => {
        assert.ok(dataScript.includes('COMPRESS_SUGGEST_STREAK'));
        assert.ok(dataScript.includes('updateCompressDupStreakAfterLine'));
        assert.ok(dataScript.includes('resetCompressDupStreak'));
    });

    test('streak updater does not run when compress mode is on (false positive guard)', () => {
        const i = dataScript.indexOf('function updateCompressDupStreakAfterLine');
        assert.ok(i >= 0);
        const block = dataScript.slice(i, i + 420);
        assert.ok(
            block.includes('compressLinesMode') && block.includes('return'),
            'must early-return when compressLinesMode so we never suggest while already compressing',
        );
    });

    test('clear log resets suggestion flags and streak (session reset)', () => {
        const mh = getViewerScriptMessageHandler();
        assert.ok(mh.includes('resetCompressDupStreak'));
        assert.ok(mh.includes('compressSuggestShown = false'));
        assert.ok(mh.includes('compressSuggestBannerDismissed = false'));
        assert.ok(mh.includes('hideCompressSuggestionBanner'));
    });
});

suite('Compress suggestion banner markup', () => {
    test('viewer body includes banner and enable/dismiss controls', () => {
        const html = getViewerBodyHtml({ version: '0' });
        assert.ok(html.includes('id="compress-suggest-banner"'));
        assert.ok(html.includes('id="compress-suggest-enable"'));
        assert.ok(html.includes('id="compress-suggest-dismiss"'));
    });
});

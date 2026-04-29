/**
 * Regression tests for compress-lines viewer logic (embedded script strings) and
 * session-nav CSS scoping so the in-log find row is not styled as bordered nav buttons.
 *
 * These tests intentionally use string assertions (same pattern as viewer-context-menu.test.ts)
 * because behavior lives in webview JavaScript/CSS fragments, not TypeScript modules.
 */
import * as assert from 'node:assert';
import { getViewerDataScript } from '../../ui/viewer/viewer-data';
import { getViewerScript } from '../../ui/viewer/viewer-script';
import { getViewerScriptMessageHandler } from '../../ui/viewer/viewer-script-messages';
import { getViewerStyles } from '../../ui/viewer-styles/viewer-styles';
import { getOverlayStyles } from '../../ui/viewer-styles/viewer-styles-overlays';
import { getSearchStyles } from '../../ui/viewer-styles/viewer-styles-search';
import { getToolbarStyles } from '../../ui/viewer-styles/viewer-styles-toolbar';
import { getOptionsPanelHtml } from '../../ui/viewer-panels/viewer-options-panel-html';
import { getLayoutScript } from '../../ui/provider/viewer-layout';
import { getViewerBodyHtml } from '../../ui/provider/viewer-content-body';
import { getReplayScript } from '../../ui/viewer/viewer-replay';

suite('Viewer compress lines (embedded script)', () => {
    const dataScript = getViewerDataScript();
    const messageHandler = getViewerScriptMessageHandler();

    test('defines applyCompressDedupModes and runs it at start of recalcHeights', () => {
        assert.ok(dataScript.includes('function applyCompressDedupModes'));
        const recalcIdx = dataScript.indexOf('function recalcHeights');
        const applyIdx = dataScript.indexOf('applyCompressDedupModes()');
        assert.ok(recalcIdx > 0 && applyIdx > 0, 'expected both functions');
        assert.ok(applyIdx < recalcIdx, 'compress pass must run before height loop');
    });

    test('clears compress flags on every pass before early return when mode is off', () => {
        assert.ok(
            dataScript.includes('if (cleared.compressDupHidden) cleared.compressDupHidden = false'),
            'must reset compressDupHidden so toggling mode off restores rows',
        );
        assert.ok(
            dataScript.includes('if (!useConsecutive && !useGlobal) return'),
            'must bail after clear when both compression modes are disabled',
        );
        assert.ok(
            dataScript.includes('typeof compressNonConsecutiveMode'),
            'dedupe logic should include non-consecutive mode',
        );
    });

    test('duplicate compress groups only filter-visible lines (level/source/blank collapse)', () => {
        assert.ok(
            dataScript.includes('function isLineEligibleForDupCompress'),
            'compress must gate grouping on the same visibility as layout (not raw file order)',
        );
        assert.ok(
            dataScript.includes('!isLineEligibleForDupCompress(item)'),
            'consecutive mode must break runs when a line is hidden by filters',
        );
        assert.ok(
            dataScript.includes('!isLineEligibleForDupCompress(globalItem)'),
            'global mode must ignore hidden lines for first-occurrence / count',
        );
        assert.ok(
            dataScript.includes('row.levelFiltered'),
            'level filter must affect duplicate grouping',
        );
        assert.ok(
            dataScript.includes('row.metadataFiltered'),
            'metadata filter must affect duplicate grouping (mirrors calcItemHeight)',
        );
    });

    test('lineDedupeKey strips structured prefix so identical message bodies match (fix: prefix mismatch)', () => {
        assert.ok(
            dataScript.includes('structuredLineParsing'),
            'lineDedupeKey must check structured-line parsing flag',
        );
        assert.ok(
            dataScript.includes('row.structuredPrefixLen'),
            'lineDedupeKey must use structuredPrefixLen to strip the prefix',
        );
        assert.ok(
            dataScript.includes('stripHtmlPrefix'),
            'lineDedupeKey must call stripHtmlPrefix for structured lines',
        );
        assert.ok(
            dataScript.includes('stripSourceTagPrefix'),
            'lineDedupeKey must fall back to source-tag bracket stripping',
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

    test('integrationsAdapters message updates footer quality report enabled state', () => {
        assert.ok(messageHandler.includes('applyFooterQualityReportState'));
    });
});

suite('Session nav overlay CSS (search strip not forced to nav-button chrome)', () => {
    const overlay = getOverlayStyles();

    test('nav button styles are scoped to split-breadcrumb and run-nav only (regression: find widget looked wrong)', () => {
        assert.ok(
            !overlay.includes('#session-nav button'),
            'old blanket #session-nav button selector must be removed',
        );
        assert.ok(
            overlay.includes('#split-breadcrumb button') && overlay.includes('#run-nav button'),
            'nav chrome must be scoped to split-breadcrumb and run-nav only',
        );
    });

    test('context menu disabled rows use is-disabled (muted + no hover highlight)', () => {
        assert.ok(overlay.includes('.context-menu-item.is-disabled'));
        assert.ok(overlay.includes('.context-menu-item.is-disabled:hover'));
        assert.ok(
            overlay.includes('background: transparent'),
            'disabled row hover should not use menu selection background',
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
        assert.ok(html.includes('id="opt-compress-lines-global"'), 'global compress toggle must exist for syncOptionsPanelUi');
    });

    test('layout script exposes toggleCompressLines', () => {
        const layout = getLayoutScript();
        assert.ok(layout.includes('function toggleCompressLines'));
        assert.ok(layout.includes('function toggleCompressNonConsecutiveLines'));
        assert.ok(layout.includes('compressLinesMode'));
        assert.ok(layout.includes('compressNonConsecutiveMode'));
    });

    test('layout exposes compress toggle and suggestion banner helpers', () => {
        const layout = getLayoutScript();
        assert.ok(!layout.includes('function syncCompressIconButton'));
        assert.ok(!layout.includes("getElementById('log-compress-toggle')"));
        assert.ok(layout.includes('function showCompressSuggestionBanner'));
        assert.ok(layout.includes('function hideCompressSuggestionBanner'));
    });

    test('viewer body does not include log-pane compress toggle button', () => {
        const html = getViewerBodyHtml({ version: '0' });
        assert.ok(!html.includes('id="log-compress-toggle"'));
    });

    test('footer Actions menu includes Open Quality Report with icon (session-wide)', () => {
        const html = getViewerBodyHtml({ version: '0' });
        assert.ok(html.includes('data-action="open-quality-report"'));
        assert.ok(html.includes('codicon-file-code'));
        assert.ok(html.includes('Open Quality Report'));
    });

    test('footer Actions menu order is Replay -> Open Quality Report -> Export with separators', () => {
        const html = getViewerBodyHtml({ version: '0' });
        const replayIdx = html.indexOf('data-action="replay"');
        const sep1Idx = html.indexOf('footer-actions-separator');
        const qualityIdx = html.indexOf('data-action="open-quality-report"');
        const sep2Idx = html.indexOf('footer-actions-separator', sep1Idx + 1);
        const exportIdx = html.indexOf('data-action="export"');
        assert.ok(replayIdx >= 0, 'Replay action should exist');
        assert.ok(sep1Idx > replayIdx, 'First separator should be after Replay');
        assert.ok(qualityIdx > sep1Idx, 'Open Quality Report should be after first separator');
        assert.ok(sep2Idx > qualityIdx, 'Second separator should be after Open Quality Report');
        assert.ok(exportIdx > sep2Idx, 'Export should be after second separator');
    });

    test('replay script wires footer quality report and integration sync', () => {
        const script = getReplayScript();
        assert.ok(script.includes('applyFooterQualityReportState'));
        assert.ok(script.includes("type: 'openQualityReport'"));
        assert.ok(script.includes('is-disabled'));
    });

    test('content styles no longer include removed compress button rules', () => {
        const css = getViewerStyles();
        assert.ok(!css.includes('#log-compress-toggle'));
        assert.ok(!css.includes('log-compress-toggle--on'));
    });
});

suite('Viewer main script (compress toggle wiring removed, false-positive guards)', () => {
    const mainScript = getViewerScript(5000);

    test('does not wire removed log-pane compress toggle button', () => {
        assert.ok(!mainScript.includes('log-compress-toggle'));
        assert.ok(!mainScript.includes('logCompressToggle.addEventListener'));
    });

    test('does not reference removed activity bar ib-compress control', () => {
        assert.ok(!mainScript.includes('ib-compress'));
    });

    test('syncJumpButtonInset guards on logEl only, styles jumpBtn when present', () => {
        const fn = mainScript.indexOf('function syncJumpButtonInset');
        assert.ok(fn >= 0);
        assert.ok(mainScript.slice(fn, fn + 1200).includes('if (!logEl) return'));
        assert.ok(mainScript.slice(fn, fn + 1200).includes('if (jumpBtn)'));
        assert.ok(
            !mainScript.slice(fn, fn + 1200).includes('if (!logEl || !jumpBtn) return'),
            'must not bail out before positioning jump buttons when jumpBtn missing',
        );
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
        assert.ok(
            dataScript.slice(i, i + 420).includes('compressLinesMode') && dataScript.slice(i, i + 420).includes('return'),
            'must early-return when compressLinesMode so we never suggest while already compressing',
        );
        assert.ok(
            dataScript.slice(i, i + 520).includes('compressNonConsecutiveMode'),
            'must also early-return when non-consecutive compression is enabled',
        );
    });

    test('blank lines always render at quarter height (not gated on toggle)', () => {
        const dataHelpers = getViewerDataScript();
        /* Blank lines are unconditionally compact — no hideBlankLines gate. */
        assert.ok(
            dataHelpers.includes('isLineContentBlank(item)') && dataHelpers.includes('ROW_HEIGHT / 4'),
            'calcItemHeight must return quarter height for blank lines unconditionally',
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

suite('Log viewer discoverability (body HTML)', () => {
    test('log content has hover title for line actions and session long-press hint', () => {
        const html = getViewerBodyHtml({ version: '0' });
        assert.ok(html.includes('id="log-content"'));
        assert.ok(html.includes('Right-click a line'));
        assert.ok(html.includes('long-press'));
    });
});

suite('Toolbar icon button disabled state CSS', () => {
    const css = getToolbarStyles();

    test('disabled buttons are visually dimmed', () => {
        assert.ok(
            css.includes('.toolbar-icon-btn:disabled'),
            'toolbar icon buttons must have a :disabled rule for visual feedback',
        );
        assert.ok(
            css.includes('opacity: 0.35'),
            'disabled buttons should be dimmed to 0.35 opacity',
        );
    });

    test('hover effect is suppressed on disabled buttons', () => {
        assert.ok(
            css.includes('.toolbar-icon-btn:hover:not(:disabled)'),
            'hover rule must exclude disabled buttons so they do not appear clickable',
        );
    });
});

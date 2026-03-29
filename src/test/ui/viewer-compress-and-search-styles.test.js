"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Regression tests for compress-lines viewer logic (embedded script strings) and
 * session-nav CSS scoping so the in-log find row is not styled as bordered nav buttons.
 *
 * These tests intentionally use string assertions (same pattern as viewer-context-menu.test.ts)
 * because behavior lives in webview JavaScript/CSS fragments, not TypeScript modules.
 */
const assert = __importStar(require("node:assert"));
const viewer_data_1 = require("../../ui/viewer/viewer-data");
const viewer_script_1 = require("../../ui/viewer/viewer-script");
const viewer_script_messages_1 = require("../../ui/viewer/viewer-script-messages");
const viewer_styles_1 = require("../../ui/viewer-styles/viewer-styles");
const viewer_styles_overlays_1 = require("../../ui/viewer-styles/viewer-styles-overlays");
const viewer_styles_search_1 = require("../../ui/viewer-styles/viewer-styles-search");
const viewer_options_panel_html_1 = require("../../ui/viewer-panels/viewer-options-panel-html");
const viewer_layout_1 = require("../../ui/provider/viewer-layout");
const viewer_content_body_1 = require("../../ui/provider/viewer-content-body");
const viewer_replay_1 = require("../../ui/viewer/viewer-replay");
suite('Viewer compress lines (embedded script)', () => {
    const dataScript = (0, viewer_data_1.getViewerDataScript)();
    const messageHandler = (0, viewer_script_messages_1.getViewerScriptMessageHandler)();
    test('defines applyCompressDedupModes and runs it at start of recalcHeights', () => {
        assert.ok(dataScript.includes('function applyCompressDedupModes'));
        const recalcIdx = dataScript.indexOf('function recalcHeights');
        const applyIdx = dataScript.indexOf('applyCompressDedupModes()');
        assert.ok(recalcIdx > 0 && applyIdx > 0, 'expected both functions');
        assert.ok(applyIdx < recalcIdx, 'compress pass must run before height loop');
    });
    test('clears compress flags on every pass before early return when mode is off', () => {
        assert.ok(dataScript.includes('if (cleared.compressDupHidden) cleared.compressDupHidden = false'), 'must reset compressDupHidden so toggling mode off restores rows');
        assert.ok(dataScript.includes('if (!useConsecutive && !useGlobal) return'), 'must bail after clear when both compression modes are disabled');
        assert.ok(dataScript.includes('typeof compressNonConsecutiveMode'), 'dedupe logic should include non-consecutive mode');
    });
    test('duplicate compress groups only filter-visible lines (level/source/blank collapse)', () => {
        assert.ok(dataScript.includes('function isLineEligibleForDupCompress'), 'compress must gate grouping on the same visibility as layout (not raw file order)');
        assert.ok(dataScript.includes('!isLineEligibleForDupCompress(item)'), 'consecutive mode must break runs when a line is hidden by filters');
        assert.ok(dataScript.includes('!isLineEligibleForDupCompress(globalItem)'), 'global mode must ignore hidden lines for first-occurrence / count');
        assert.ok(dataScript.includes('row.levelFiltered'), 'level filter must affect duplicate grouping');
    });
    test('addLines uses full recalc when compressLinesMode is on (not append-only prefix sums)', () => {
        assert.ok(messageHandler.includes('compressLinesMode') && messageHandler.includes('recalcHeights'), 'message handler should branch on compress mode');
        assert.ok(messageHandler.includes('Compress mode mutates heights'), 'document why full recalc is required for streaming');
        /* False positive guard: incremental path must stay in else branch when compress off */
        assert.ok(messageHandler.includes('appendPrefixSums'), 'non-compress path should still support incremental prefix sums');
    });
    test('integrationsAdapters message updates footer quality report enabled state', () => {
        assert.ok(messageHandler.includes('applyFooterQualityReportState'));
    });
});
suite('Session nav overlay CSS (search strip not forced to nav-button chrome)', () => {
    const overlay = (0, viewer_styles_overlays_1.getOverlayStyles)();
    test('nav button styles are scoped to split-breadcrumb and run-nav only (regression: find widget looked wrong)', () => {
        assert.ok(!overlay.includes('#session-nav button'), 'old blanket #session-nav button selector must be removed');
        assert.ok(overlay.includes('#split-breadcrumb button') && overlay.includes('#run-nav button'), 'nav chrome must be scoped to split-breadcrumb and run-nav only');
    });
    test('context menu disabled rows use is-disabled (muted + no hover highlight)', () => {
        assert.ok(overlay.includes('.context-menu-item.is-disabled'));
        assert.ok(overlay.includes('.context-menu-item.is-disabled:hover'));
        assert.ok(overlay.includes('background: transparent'), 'disabled row hover should not use menu selection background');
    });
});
suite('Search strip and options (compress UI wiring)', () => {
    test('search styles use widget shadow token for popovers', () => {
        const css = (0, viewer_styles_search_1.getSearchStyles)();
        assert.ok(css.includes('--vscode-widget-shadow'), 'popover should use theme widget shadow');
        assert.ok(css.includes('--vscode-editorWidget-background'), 'popover background should match editor widgets');
    });
    test('options panel includes compress checkbox id for sync', () => {
        const html = (0, viewer_options_panel_html_1.getOptionsPanelHtml)();
        assert.ok(html.includes('id="opt-compress-lines"'), 'compress toggle must exist for syncOptionsPanelUi');
        assert.ok(html.includes('id="opt-compress-lines-global"'), 'global compress toggle must exist for syncOptionsPanelUi');
    });
    test('layout script exposes toggleCompressLines', () => {
        const layout = (0, viewer_layout_1.getLayoutScript)();
        assert.ok(layout.includes('function toggleCompressLines'));
        assert.ok(layout.includes('function toggleCompressNonConsecutiveLines'));
        assert.ok(layout.includes('compressLinesMode'));
        assert.ok(layout.includes('compressNonConsecutiveMode'));
    });
    test('layout exposes compress toggle and suggestion banner helpers', () => {
        const layout = (0, viewer_layout_1.getLayoutScript)();
        assert.ok(!layout.includes('function syncCompressIconButton'));
        assert.ok(!layout.includes("getElementById('log-compress-toggle')"));
        assert.ok(layout.includes('function showCompressSuggestionBanner'));
        assert.ok(layout.includes('function hideCompressSuggestionBanner'));
    });
    test('viewer body does not include log-pane compress toggle button', () => {
        const html = (0, viewer_content_body_1.getViewerBodyHtml)({ version: '0' });
        assert.ok(!html.includes('id="log-compress-toggle"'));
    });
    test('footer Actions menu includes Open Quality Report with icon (session-wide)', () => {
        const html = (0, viewer_content_body_1.getViewerBodyHtml)({ version: '0' });
        assert.ok(html.includes('data-action="open-quality-report"'));
        assert.ok(html.includes('codicon-file-code'));
        assert.ok(html.includes('Open Quality Report'));
    });
    test('footer Actions menu order is Replay -> Open Quality Report -> Export with separators', () => {
        const html = (0, viewer_content_body_1.getViewerBodyHtml)({ version: '0' });
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
        const script = (0, viewer_replay_1.getReplayScript)();
        assert.ok(script.includes('applyFooterQualityReportState'));
        assert.ok(script.includes("type: 'openQualityReport'"));
        assert.ok(script.includes('is-disabled'));
    });
    test('content styles no longer include removed compress button rules', () => {
        const css = (0, viewer_styles_1.getViewerStyles)();
        assert.ok(!css.includes('#log-compress-toggle'));
        assert.ok(!css.includes('log-compress-toggle--on'));
    });
});
suite('Viewer main script (compress toggle wiring removed, false-positive guards)', () => {
    const mainScript = (0, viewer_script_1.getViewerScript)(5000);
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
        assert.ok(!mainScript.slice(fn, fn + 1200).includes('if (!logEl || !jumpBtn) return'), 'must not bail out before positioning jump buttons when jumpBtn missing');
    });
});
suite('Viewer compress streak (embedded script)', () => {
    const dataScript = (0, viewer_data_1.getViewerDataScript)();
    test('tracks consecutive duplicate streak and threshold for suggestion', () => {
        assert.ok(dataScript.includes('COMPRESS_SUGGEST_STREAK'));
        assert.ok(dataScript.includes('updateCompressDupStreakAfterLine'));
        assert.ok(dataScript.includes('resetCompressDupStreak'));
    });
    test('streak updater does not run when compress mode is on (false positive guard)', () => {
        const i = dataScript.indexOf('function updateCompressDupStreakAfterLine');
        assert.ok(i >= 0);
        assert.ok(dataScript.slice(i, i + 420).includes('compressLinesMode') && dataScript.slice(i, i + 420).includes('return'), 'must early-return when compressLinesMode so we never suggest while already compressing');
        assert.ok(dataScript.slice(i, i + 520).includes('compressNonConsecutiveMode'), 'must also early-return when non-consecutive compression is enabled');
    });
    test('blank-line hiding remains independent from compression modes', () => {
        const dataHelpers = (0, viewer_data_1.getViewerDataScript)();
        assert.ok(dataHelpers.includes("var hideBlanks = (typeof hideBlankLines !== 'undefined' && hideBlankLines);"), 'compression toggles must not implicitly hide blanks');
    });
    test('clear log resets suggestion flags and streak (session reset)', () => {
        const mh = (0, viewer_script_messages_1.getViewerScriptMessageHandler)();
        assert.ok(mh.includes('resetCompressDupStreak'));
        assert.ok(mh.includes('compressSuggestShown = false'));
        assert.ok(mh.includes('compressSuggestBannerDismissed = false'));
        assert.ok(mh.includes('hideCompressSuggestionBanner'));
    });
});
suite('Compress suggestion banner markup', () => {
    test('viewer body includes banner and enable/dismiss controls', () => {
        const html = (0, viewer_content_body_1.getViewerBodyHtml)({ version: '0' });
        assert.ok(html.includes('id="compress-suggest-banner"'));
        assert.ok(html.includes('id="compress-suggest-enable"'));
        assert.ok(html.includes('id="compress-suggest-dismiss"'));
    });
});
//# sourceMappingURL=viewer-compress-and-search-styles.test.js.map
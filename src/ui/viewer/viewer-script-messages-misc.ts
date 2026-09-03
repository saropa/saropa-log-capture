/**
 * Minimap, toolbar, capture, and keybinding host-message handlers for the
 * log viewer webview. Extracted from viewer-script-messages.ts to keep that
 * file under the line limit. Runs as a pre-handler (same pattern as
 * handleDbMessages / handleTypographyMessages) — returns true when it
 * dispatched the message so the caller's switch is skipped.
 */

export function getViewerScriptMiscMessageHandler(): string {
    return /* javascript */ `
function handleMiscViewerMessages(msg) {
    switch (msg.type) {
        case 'minimapShowInfo':
            minimapShowInfoMarkers = !!msg.show;
            if (typeof handleMinimapShowInfo === 'function') handleMinimapShowInfo(msg);
            return true;
        case 'minimapShowSqlDensity':
            if (typeof minimapShowSqlDensity !== 'undefined') minimapShowSqlDensity = msg.show !== false;
            if (typeof handleMinimapShowSqlDensity === 'function') handleMinimapShowSqlDensity(msg);
            if (typeof syncOptionsPanelUi === 'function') syncOptionsPanelUi();
            return true;
        case 'minimapProportionalLines':
            minimapProportionalLines = msg.show !== false;
            if (typeof handleMinimapProportionalLines === 'function') handleMinimapProportionalLines(msg);
            return true;
        case 'minimapViewportRedOutline':
            minimapViewportRedOutline = msg.show === true;
            if (typeof handleMinimapViewportRedOutline === 'function') handleMinimapViewportRedOutline(msg);
            return true;
        case 'minimapViewportOutsideArrow':
            minimapViewportOutsideArrow = msg.show === true;
            if (typeof handleMinimapViewportOutsideArrow === 'function') handleMinimapViewportOutsideArrow(msg);
            return true;
        case 'minimapWidth': if (typeof handleMinimapWidth === 'function') handleMinimapWidth(msg); return true;
        case 'minimapWidthPx': if (typeof handleMinimapWidthPx === 'function') handleMinimapWidthPx(msg); return true;
        case 'troubleRailWidthPx': if (typeof handleTroubleRailWidthPx === 'function') handleTroubleRailWidthPx(msg); return true;
        case 'scrollbarVisible': /* Apply showScrollbar setting + force Chromium scrollbar re-render */ applyScrollbarVisible(msg.show === true); return true;
        case 'searchMatchOptionsAlwaysVisible': document.body.classList.toggle('search-match-options-always', msg.always === true); return true;
        case 'iconBarPosition':
            document.body.dataset.iconBar = msg.position || 'left';
            syncJumpButtonInset();
            return true;
        case 'captureEnabled':
            window.captureEnabled = msg.enabled !== false;
            if (typeof syncCaptureEnabledUi === 'function') syncCaptureEnabledUi();
            return true;
        case 'diagnosticCapture':
            window.diagnosticCapture = msg.enabled === true;
            if (typeof syncDiagnosticCaptureUi === 'function') syncDiagnosticCaptureUi();
            return true;
        case 'setLearningOptions':
            learningEnabled = msg.enabled !== false;
            learningMaxLineLen = typeof msg.maxLineLength === 'number' && msg.maxLineLength >= 80 ? msg.maxLineLength : 2000;
            learningTrackScroll = msg.trackScroll === true;
            return true;
        case 'integrationsAdapters':
            window.integrationAdapters = Array.isArray(msg.adapterIds) ? msg.adapterIds : [];
            if (typeof syncIntegrationsUi === 'function') syncIntegrationsUi();
            syncCrashlyticsIconVisibility();
            var ibPerf = document.getElementById('ib-performance');
            if (ibPerf) ibPerf.classList.toggle('ib-integration-enabled', window.integrationAdapters.indexOf('performance') >= 0);
            if (typeof window.applyFooterQualityReportState === 'function') window.applyFooterQualityReportState();
            return true;
        case 'captureSources':
            if (typeof renderCaptureSources === 'function') renderCaptureSources(msg.sources);
            return true;
        case 'crashlyticsApplicable':
            // Library / package projects (no app evidence) keep the icon hidden even when the
            // crashlytics adapter is enabled, so the setup hint never nags where it cannot apply.
            window.crashlyticsApplicable = msg.applicable !== false;
            syncCrashlyticsIconVisibility();
            return true;
        case 'errorHoverData':
            if (typeof handleErrorHoverData === 'function') handleErrorHoverData(msg);
            return true;
        case 'setViewerKeybindings':
            if (msg.keyToAction && typeof msg.keyToAction === 'object') window.viewerKeyMap = msg.keyToAction;
            return true;
        case 'setErrorRateConfig':
            if (typeof msg.bucketSize === 'string') erBucketSizeSetting = msg.bucketSize;
            if (typeof msg.showWarnings === 'boolean') erShowWarnings = msg.showWarnings;
            if (typeof msg.detectSpikes === 'boolean') erDetectSpikes = msg.detectSpikes;
            return true;
        case 'viewerKeybindingRecordMode':
            window.viewerKeybindingRecordingFor = msg.active ? (msg.actionId || null) : null;
            return true;
        default:
            return false;
    }
}
`;
}

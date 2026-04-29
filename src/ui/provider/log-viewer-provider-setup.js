"use strict";
/**
 * Webview setup for LogViewerProvider. Extracted to keep log-viewer-provider.ts under the line limit.
 */
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
exports.setupLogViewerWebview = setupLogViewerWebview;
const vscode = __importStar(require("vscode"));
const viewer_content_1 = require("./viewer-content");
const config_1 = require("../../modules/config/config");
const drift_advisor_integration_1 = require("./drift-advisor-integration");
const helpers = __importStar(require("./viewer-provider-helpers"));
const viewer_keybindings_1 = require("../viewer/viewer-keybindings");
const learning_webview_options_1 = require("../../modules/learning/learning-webview-options");
const root_cause_hint_l10n_host_1 = require("../../modules/root-cause-hints/root-cause-hint-l10n-host");
const integration_adapter_constants_1 = require("../../modules/integrations/integration-adapter-constants");
function setupLogViewerWebview(target, webviewView) {
    const extUri = target.getExtensionUri();
    const audioUri = vscode.Uri.joinPath(extUri, 'audio');
    const codiconsUri = vscode.Uri.joinPath(extUri, 'media', 'codicons');
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [audioUri, codiconsUri] };
    const audioWebviewUri = webviewView.webview.asWebviewUri(audioUri).toString();
    const codiconCssUri = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(codiconsUri, 'codicon.css')).toString();
    const cfg = (0, config_1.getConfig)();
    const viewerMaxLines = (0, viewer_content_1.getEffectiveViewerLines)(cfg.maxLines, cfg.viewerMaxLines ?? 0);
    webviewView.webview.html = (0, viewer_content_1.buildViewerHtml)({
        nonce: (0, viewer_content_1.getNonce)(),
        extensionUri: audioWebviewUri,
        version: target.getVersion(),
        cspSource: webviewView.webview.cspSource,
        codiconCssUri,
        viewerMaxLines,
        viewerPreserveAsciiBoxArt: cfg.viewerPreserveAsciiBoxArt,
        viewerGroupAsciiArt: cfg.viewerGroupAsciiArt,
        viewerDetectAsciiArt: cfg.viewerDetectAsciiArt,
        viewerRepeatThresholds: cfg.viewerRepeatThresholds,
        viewerDbSignalsEnabled: cfg.viewerDbSignalsEnabled,
        staticSqlFromFingerprintEnabled: cfg.staticSqlFromFingerprintEnabled,
        viewerDbDetectorToggles: (0, config_1.viewerDbDetectorTogglesFromConfig)(cfg),
        viewerSlowBurstThresholds: cfg.viewerSlowBurstThresholds,
        signalSlowOpThresholdMs: cfg.signalSlowOpThresholdMs,
    });
    webviewView.webview.onDidReceiveMessage((msg) => target.handleMessage(msg));
    target.startBatchTimer();
    queueMicrotask(() => helpers.sendCachedConfig(target.getCachedPresets(), target.getCachedHighlightRules(), (msg) => target.postMessage(msg), target.getContext().workspaceState.get("saropaLogCapture.lastUsedPresetName")));
    queueMicrotask(() => {
        const c = (0, config_1.getConfig)();
        const aiOn = vscode.workspace.getConfiguration("saropaLogCapture.ai").get("enabled", false);
        target.sendIntegrationsAdapters((0, integration_adapter_constants_1.mergeIntegrationAdaptersForWebview)(c.integrationsAdapters, aiOn));
    });
    queueMicrotask(() => target.postMessage({ type: 'setDriftAdvisorAvailable', available: !!vscode.extensions.getExtension(drift_advisor_integration_1.DRIFT_ADVISOR_EXTENSION_ID) }));
    queueMicrotask(() => target.postMessage({ type: 'captureEnabled', enabled: (0, config_1.getConfig)().enabled }));
    /* Seed typography from user settings so webview boots with configured font size / line height
       instead of its hard-coded defaults. Handler on the webview also updates the reset target so
       Ctrl+0 / Ctrl+Shift+0 return to the *user's* configured value, not the hard-coded fallback. */
    queueMicrotask(() => target.postMessage({ type: 'setLogFontSize', size: (0, config_1.getConfig)().logFontSize }));
    queueMicrotask(() => target.postMessage({ type: 'setLogLineHeight', height: (0, config_1.getConfig)().logLineHeight }));
    queueMicrotask(() => target.postMessage({ type: 'minimapShowSqlDensity', show: (0, config_1.getConfig)().minimapShowSqlDensity }));
    queueMicrotask(() => target.postMessage({ type: 'minimapProportionalLines', show: (0, config_1.getConfig)().minimapProportionalLines }));
    queueMicrotask(() => target.postMessage({ type: 'minimapViewportRedOutline', show: (0, config_1.getConfig)().minimapViewportRedOutline }));
    queueMicrotask(() => target.postMessage({ type: 'minimapViewportOutsideArrow', show: (0, config_1.getConfig)().minimapViewportOutsideArrow }));
    queueMicrotask(() => target.postMessage({
        type: 'setViewerRepeatThresholds',
        thresholds: (0, config_1.getConfig)().viewerRepeatThresholds,
    }));
    queueMicrotask(() => target.postMessage({
        type: 'setViewerDbSignalsEnabled',
        enabled: (0, config_1.getConfig)().viewerDbSignalsEnabled,
    }));
    queueMicrotask(() => target.postMessage({
        type: 'setStaticSqlFromFingerprintEnabled',
        enabled: (0, config_1.getConfig)().staticSqlFromFingerprintEnabled,
    }));
    queueMicrotask(() => target.postMessage({
        type: 'setViewerSlowBurstThresholds',
        thresholds: (0, config_1.getConfig)().viewerSlowBurstThresholds,
    }));
    queueMicrotask(() => target.postMessage({
        type: 'setViewerDbDetectorToggles',
        ...(0, config_1.viewerDbDetectorTogglesFromConfig)((0, config_1.getConfig)()),
    }));
    queueMicrotask(() => {
        const erCfg = (0, config_1.errorRateConfigFromConfig)((0, config_1.getConfig)());
        target.postMessage({ type: 'setErrorRateConfig', bucketSize: erCfg.bucketSize, showWarnings: erCfg.showWarnings, detectSpikes: erCfg.detectSpikes });
    });
    queueMicrotask(() => target.postMessage({ type: 'setViewerKeybindings', keyToAction: (0, viewer_keybindings_1.getViewerKeybindingsFromConfig)() }));
    queueMicrotask(() => target.postMessage((0, learning_webview_options_1.getLearningWebviewOptions)()));
    queueMicrotask(() => target.postMessage({ type: 'setRootCauseHintL10n', strings: (0, root_cause_hint_l10n_host_1.getRootCauseHintViewerStrings)() }));
    queueMicrotask(() => {
        const c = (0, config_1.getConfig)();
        target.postMessage({
            type: 'errorClassificationSettings',
            suppressTransientErrors: c.suppressTransientErrors,
            breakOnCritical: c.breakOnCritical,
            levelDetection: c.levelDetection,
            stderrTreatAsError: c.stderrTreatAsError,
            severityKeywords: c.severityKeywords,
        });
    });
    const pending = target.getPendingLoadUri();
    if (pending) {
        queueMicrotask(() => { void target.loadFromFile(pending); });
    }
    else if (webviewView.visible) {
        queueMicrotask(() => target.onBecameVisible());
    }
    webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
            target.setVisibleView(webviewView);
            target.setUnreadWatchHits(0);
            helpers.updateBadge(webviewView, target.getUnreadWatchHits());
            target.onBecameVisible();
        }
    });
    webviewView.onDidDispose(() => {
        target.removeView(webviewView);
    });
}
//# sourceMappingURL=log-viewer-provider-setup.js.map
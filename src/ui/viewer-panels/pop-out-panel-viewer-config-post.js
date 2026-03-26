"use strict";
/**
 * Initial webview config posts for the pop-out viewer. Extracted to keep `pop-out-panel.ts` under max-lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.queuePopOutViewerConfigMicrotask = queuePopOutViewerConfigMicrotask;
const config_1 = require("../../modules/config/config");
const learning_webview_options_1 = require("../../modules/learning/learning-webview-options");
const root_cause_hint_l10n_host_1 = require("../../modules/root-cause-hints/root-cause-hint-l10n-host");
const viewer_keybindings_1 = require("../viewer/viewer-keybindings");
/** One microtask batch so the pop-out panel file stays small (ESLint max-lines). */
function queuePopOutViewerConfigMicrotask(post, cfg) {
    queueMicrotask(() => {
        post({ type: "setViewerKeybindings", keyToAction: (0, viewer_keybindings_1.getViewerKeybindingsFromConfig)() });
        post({ type: "setRootCauseHintL10n", strings: (0, root_cause_hint_l10n_host_1.getRootCauseHintViewerStrings)() });
        post({ type: "minimapShowSqlDensity", show: cfg.minimapShowSqlDensity });
        post({ type: "setViewerRepeatThresholds", thresholds: cfg.viewerRepeatThresholds });
        post({ type: "setViewerDbInsightsEnabled", enabled: cfg.viewerDbInsightsEnabled });
        post({ type: "setStaticSqlFromFingerprintEnabled", enabled: cfg.staticSqlFromFingerprintEnabled });
        post({ type: "setViewerSlowBurstThresholds", thresholds: cfg.viewerSlowBurstThresholds });
        post({ type: "setViewerDbDetectorToggles", ...(0, config_1.viewerDbDetectorTogglesFromConfig)(cfg) });
        post({
            type: "setViewerSqlPatternChipSettings",
            chipMinCount: cfg.viewerSqlPatternChipMinCount,
            chipMaxChips: cfg.viewerSqlPatternMaxChips,
        });
        const erCfg = (0, config_1.errorRateConfigFromConfig)(cfg);
        post({ type: "setErrorRateConfig", bucketSize: erCfg.bucketSize, showWarnings: erCfg.showWarnings, detectSpikes: erCfg.detectSpikes });
        post((0, learning_webview_options_1.getLearningWebviewOptions)());
    });
}
//# sourceMappingURL=pop-out-panel-viewer-config-post.js.map
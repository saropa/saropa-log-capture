/**
 * Initial webview config posts for the pop-out viewer. Extracted to keep `pop-out-panel.ts` under max-lines.
 */

import { getConfig, viewerDbDetectorTogglesFromConfig, errorRateConfigFromConfig } from "../../modules/config/config";
import { getLearningWebviewOptions } from "../../modules/learning/learning-webview-options";
import { getRootCauseHintViewerStrings } from "../../modules/root-cause-hints/root-cause-hint-l10n-host";
import { getViewerKeybindingsFromConfig } from "../viewer/viewer-keybindings";

/** One microtask batch so the pop-out panel file stays small (ESLint max-lines). */
export function queuePopOutViewerConfigMicrotask(
  post: (msg: unknown) => void,
  cfg: ReturnType<typeof getConfig>,
): void {
  queueMicrotask(() => {
    post({ type: "setViewerKeybindings", keyToAction: getViewerKeybindingsFromConfig() });
    post({ type: "setRootCauseHintL10n", strings: getRootCauseHintViewerStrings() });
    post({ type: "setLogFontSize", size: cfg.logFontSize });
    post({ type: "setLogLineHeight", height: cfg.logLineHeight });
    post({ type: "minimapShowSqlDensity", show: cfg.minimapShowSqlDensity });
    post({ type: "minimapProportionalLines", show: cfg.minimapProportionalLines });
    post({ type: "minimapViewportRedOutline", show: cfg.minimapViewportRedOutline });
    post({ type: "minimapViewportOutsideArrow", show: cfg.minimapViewportOutsideArrow });
    post({ type: "setViewerRepeatThresholds", thresholds: cfg.viewerRepeatThresholds });
    post({ type: "setViewerDbSignalsEnabled", enabled: cfg.viewerDbSignalsEnabled });
    post({ type: "setStaticSqlFromFingerprintEnabled", enabled: cfg.staticSqlFromFingerprintEnabled });
    post({ type: "setViewerSlowBurstThresholds", thresholds: cfg.viewerSlowBurstThresholds });
    post({ type: "setViewerDbDetectorToggles", ...viewerDbDetectorTogglesFromConfig(cfg) });

    const erCfg = errorRateConfigFromConfig(cfg);
    post({ type: "setErrorRateConfig", bucketSize: erCfg.bucketSize, showWarnings: erCfg.showWarnings, detectSpikes: erCfg.detectSpikes });
    post(getLearningWebviewOptions());
  });
}

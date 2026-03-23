/**
 * Initial webview config posts for the pop-out viewer. Extracted to keep `pop-out-panel.ts` under max-lines.
 */

import { getConfig, viewerDbDetectorTogglesFromConfig } from "../../modules/config/config";
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
    post({ type: "minimapShowSqlDensity", show: cfg.minimapShowSqlDensity });
    post({ type: "setViewerRepeatThresholds", thresholds: cfg.viewerRepeatThresholds });
    post({ type: "setViewerDbInsightsEnabled", enabled: cfg.viewerDbInsightsEnabled });
    post({ type: "setViewerSlowBurstThresholds", thresholds: cfg.viewerSlowBurstThresholds });
    post({ type: "setViewerDbDetectorToggles", ...viewerDbDetectorTogglesFromConfig(cfg) });
    post({
      type: "setViewerSqlPatternChipSettings",
      chipMinCount: cfg.viewerSqlPatternChipMinCount,
      chipMaxChips: cfg.viewerSqlPatternMaxChips,
    });
    post(getLearningWebviewOptions());
  });
}

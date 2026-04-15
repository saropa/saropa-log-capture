/**
 * Initial broadcaster configuration applied at activation time.
 *
 * Reads the current config snapshot and pushes all UI/behavior
 * settings to the broadcaster so webviews start with correct state.
 */

import type { SaropaLogCaptureConfig } from './modules/config/config-types';
import { viewerDbDetectorTogglesFromConfig, errorRateConfigFromConfig } from './modules/config/config';
import { loadPresets } from './modules/storage/filter-presets';
import type { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';

/** Apply initial config settings to the broadcaster at activation time. */
export function applyInitialBroadcasterConfig(
    broadcaster: ViewerBroadcaster,
    cfg: SaropaLogCaptureConfig,
): void {
    broadcaster.setPresets(loadPresets());
    if (cfg.highlightRules.length > 0) {
        broadcaster.setHighlightRules(cfg.highlightRules);
    }
    broadcaster.setIconBarPosition(cfg.iconBarPosition);
    broadcaster.setMinimapShowInfo(cfg.minimapShowInfoMarkers);
    broadcaster.setMinimapShowSqlDensity(cfg.minimapShowSqlDensity);
    broadcaster.setMinimapProportionalLines(cfg.minimapProportionalLines);
    broadcaster.setViewerRepeatThresholds(cfg.viewerRepeatThresholds);
    broadcaster.setViewerDbInsightsEnabled(cfg.viewerDbSignalsEnabled);
    broadcaster.setStaticSqlFromFingerprintEnabled(cfg.staticSqlFromFingerprintEnabled);
    broadcaster.setViewerDbDetectorToggles(viewerDbDetectorTogglesFromConfig(cfg));
    broadcaster.setViewerSlowBurstThresholds(cfg.viewerSlowBurstThresholds);

    broadcaster.setMinimapViewportRedOutline(cfg.minimapViewportRedOutline);
    broadcaster.setMinimapViewportOutsideArrow(cfg.minimapViewportOutsideArrow);
    broadcaster.setMinimapWidth(cfg.minimapWidth);
    broadcaster.setScrollbarVisible(cfg.showScrollbar);
    broadcaster.setSearchMatchOptionsAlwaysVisible(cfg.viewerAlwaysShowSearchMatchOptions);
    broadcaster.setErrorRateConfig(errorRateConfigFromConfig(cfg));
}

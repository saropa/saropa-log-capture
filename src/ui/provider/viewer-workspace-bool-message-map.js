"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAROPA_BOOL_SETTING_BY_MSG_TYPE = void 0;
/**
 * Maps webview `postMessage` `type` strings to `saropaLogCapture.*` boolean configuration keys.
 * Used by `viewer-message-handler-actions` (host) and unit tests; keeps one list for context menu
 * and options panel toggles without duplicating `getConfiguration().update` cases.
 */
exports.SAROPA_BOOL_SETTING_BY_MSG_TYPE = {
    setMinimapSqlDensity: "minimapShowSqlDensity",
    setMinimapProportionalLines: "minimapProportionalLines",
    setShowScrollbar: "showScrollbar",
    setMinimapShowInfoMarkers: "minimapShowInfoMarkers",
    setMinimapViewportRedOutline: "minimapViewportRedOutline",
    setMinimapViewportOutsideArrow: "minimapViewportOutsideArrow",
};
//# sourceMappingURL=viewer-workspace-bool-message-map.js.map
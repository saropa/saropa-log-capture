/**
 * Maps webview `postMessage` `type` strings to `saropaLogCapture.*` boolean configuration keys.
 * Used by `viewer-message-handler-actions` (host) and unit tests; keeps one list for context menu
 * and options panel toggles without duplicating `getConfiguration().update` cases.
 */
export const SAROPA_BOOL_SETTING_BY_MSG_TYPE: Readonly<Record<string, string>> = {
  setLogViewerVisualSpacing: "logViewerVisualSpacing",
  setMinimapSqlDensity: "minimapShowSqlDensity",
  setMinimapProportionalLines: "minimapProportionalLines",
  setShowScrollbar: "showScrollbar",
  setMinimapShowInfoMarkers: "minimapShowInfoMarkers",
  setMinimapViewportRedOutline: "minimapViewportRedOutline",
  setMinimapViewportOutsideArrow: "minimapViewportOutsideArrow",
};

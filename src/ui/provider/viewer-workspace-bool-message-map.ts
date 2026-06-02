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
  /* showElapsedTime: persisted via the same message type the host broadcasts
     to the webview on startup (extension-lifecycle.ts:71). When the options
     panel toggles the elapsed checkbox, the webview posts the bool here and
     this map routes it through getConfiguration().update so the next session
     starts with the same state. Without this entry the toggle was session-
     local and reset to the workspace default on every reload. */
  setShowElapsed: "showElapsedTime",
};

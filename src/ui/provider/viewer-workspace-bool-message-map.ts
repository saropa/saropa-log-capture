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

/**
 * Maps webview `postMessage` `type` strings to `saropaLogCapture.*` boolean keys that must be
 * written at the USER (Global) configuration level, not Workspace. The viewer's per-line Columns
 * (line numbers, timestamp, session elapsed, source tag) are a personal display preference the
 * user wants to follow them across projects: toggling a column in the viewer updates the user
 * default so every newly opened log shows the chosen layout. The host handler picks the Global
 * target for these (see viewer-message-handler-session-ui). Defaults are baked into the webview
 * at build time from these same settings (viewer-deco-settings.ts).
 */
export const SAROPA_GLOBAL_BOOL_SETTING_BY_MSG_TYPE: Readonly<Record<string, string>> = {
  setViewerColumnLineNumbers: "viewerColumnLineNumbers",
  setViewerColumnTimestamp: "viewerColumnTimestamp",
  setViewerColumnSessionElapsed: "viewerColumnSessionElapsed",
  setViewerColumnParsedTag: "viewerColumnParsedTag",
};

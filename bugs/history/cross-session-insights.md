# Cross-Session Insights Panel Bugs (Resolved)

## 1. Missing "Saropa" prefix in panel title
Panel tab and header said "Cross-Session Insights" instead of "Saropa Cross-Session Insights". Fixed the `createWebviewPanel` title and the HTML header. Applied the same prefix to all other singleton panels (Bug Report, Line Analysis, Log Timeline, Log Comparison).

## 2. Refresh resets window position
`ensurePanel()` called `panel.reveal(vscode.ViewColumn.Beside)` on every refresh, forcing the panel back to the Beside column. Fixed by removing the column argument from `reveal()` in the insights panel (refresh updates HTML in place). Other panels use `panel.reveal()` (no column) so they focus without repositioning.

## 3. "Checking production data..." never stops flashing
The Crashlytics bridge had no settled guard, so both the timeout and the async result could race. Added a `settled` flag, reduced timeout from 15 s to 10 s, and added output channel logging for all exit paths (timeout, not available, error, success with match count).

## 4. Panel auto-opens on project start
VS Code may attempt to restore webview panels from a previous session. Registered no-op `WebviewPanelSerializer` instances for all five singleton panel viewTypes that immediately dispose restored panels.

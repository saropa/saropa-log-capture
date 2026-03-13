# Overwrites the file given as first argument with a clean commit message (no trailers).
$msg = @"
feat: Auto-correlation detection (plan 024)

- Add correlation module: types, anomaly-detection, detector, store
- Timeline: detect after load, show Detecting correlations phase, race guard
- Timeline script: correlation badge on rows, click to highlight group
- Viewer: setCorrelationByLineIndex on load, badge in render
- Correlation panel: list for last timeline session, Jump to event
- Settings: correlation.enabled, windowMs, minConfidence, types, maxEvents
- L10n and package.nls for config and Correlations view
- Unit tests: meetsMinConfidence, deduplicateCorrelations, detectCorrelations
- CHANGELOG 3.3.0, plan 024 to history, cohesion index updated
"@
Set-Content -Path $args[0] -Value $msg -NoNewline
exit 0

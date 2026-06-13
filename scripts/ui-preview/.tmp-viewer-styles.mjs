// src/ui/viewer-styles/viewer-styles-content.ts
function getContentStyles() {
  return (
    /* css */
    `
/* --- Timing Markers --- */
.marker {
    border-top: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    border-bottom: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    background: var(--vscode-diffEditor-insertedLineBackground, rgba(40, 167, 69, 0.1));
    color: var(--vscode-editorGutter-addedBackground, #28a745);
    padding: 4px 8px 4px 16px;
    text-align: center;
    font-style: italic;
    line-height: 1.5;
}
/* DB_16 timestamp burst \u2014 green rail matches database level / gutter (same token as level-bar-database).
   Was cyan when Database itself was cyan; rotated to green alongside the Info=blue / Notice=cyan / DB=green palette swap. */
.marker.marker-db-ts-burst-edge {
    --db-ts-burst-ac: var(--vscode-charts-green, #4caf50);
    font-style: normal;
    background: color-mix(in srgb, var(--db-ts-burst-ac) 14%, transparent);
    color: var(--db-ts-burst-ac);
    border-left: 2px solid var(--db-ts-burst-ac);
    border-right: 2px solid var(--db-ts-burst-ac);
    border-top-color: transparent;
    border-bottom-color: transparent;
    padding-left: 10px;
    padding-right: 10px;
}
.marker.marker-db-ts-burst-edge.marker-db-ts-burst-top {
    border-top: 2px solid var(--db-ts-burst-ac);
    border-bottom: 1px dashed color-mix(in srgb, var(--db-ts-burst-ac) 50%, transparent);
}
.marker.marker-db-ts-burst-edge.marker-db-ts-burst-bottom {
    border-top: 1px dashed color-mix(in srgb, var(--db-ts-burst-ac) 50%, transparent);
    border-bottom: 2px solid var(--db-ts-burst-ac);
}
/* Member log lines framed between the two rails (virtualized flat rows; no DOM wrapper).
   Rail color follows level-bar-database (charts-green) so the rails stay visually
   aligned with the SQL rows they group. */
.line.db-ts-burst-member {
    --db-ts-burst-ac: var(--vscode-charts-green, #4caf50);
    border-left: 2px solid var(--db-ts-burst-ac);
    border-right: 2px solid var(--db-ts-burst-ac);
    background: color-mix(in srgb, var(--db-ts-burst-ac) 8%, transparent);
    box-sizing: border-box;
}
.line.db-ts-burst-member.db-ts-burst-first,
.line.db-ts-burst-member.db-ts-burst-mid {
    border-bottom: 1px dashed color-mix(in srgb, var(--db-ts-burst-ac) 30%, transparent);
}
.line.db-ts-burst-member:hover {
    background: color-mix(in srgb, var(--db-ts-burst-ac) 14%, transparent);
}
.slow-query-burst-marker {
    cursor: pointer;
    font-style: italic;
    text-decoration: underline;
    text-underline-offset: 2px;
}
.slow-query-burst-marker:hover {
    color: var(--vscode-textLink-activeForeground, var(--vscode-textLink-foreground));
}
/* Count badge for collapsed runs of adjacent identical db-signal markers
   (applyConsecutiveDbMarkerCollapse). Sits after the marker label; muted against the
   green marker background so it reads as a secondary count, not a second link. */
.marker-collapse-count {
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background, rgba(255, 255, 255, 0.12));
    color: var(--vscode-badge-foreground, inherit);
    font-style: normal;
    text-decoration: none;
    font-size: 0.85em;
    opacity: 0.85;
}

/* Drift SQL: dim the " with args [...]" suffix (drift-log-line-args-fold.ts) */
.drift-args-dim {
    opacity: 0.4;
}

/* --- Stack Trace Groups --- */
.stack-group { margin: 0; }
.stack-header {
    padding: 0 8px 0 16px;
    cursor: pointer;
    /* WHY inherit instead of error-red: the old default was
       var(--vscode-debugConsole-errorForeground) which made EVERY stack header
       look like an error unless a level-* override kicked in. Drift SQL
       interceptor traces (DriftDebugInterceptor) that correctly inherit
       level='database' still showed red because any gap in the CSS cascade
       (ANSI span stripped, level class missing, theme variable unset) fell
       back to the error color. Using inherit keeps unclassified headers
       neutral; the explicit .level-error rule below handles actual errors. */
    color: inherit;
    /* Match .line's row height. Was 1.5 (visual breathing room) but the
       severity-gutter chain stripe is anchored as a percentage of the parent
       row's height \u2014 when stack-header rows were taller than .line rows the
       chain stripe couldn't reach the next dot's middle, producing visible
       gaps at log-line \u2192 stack-header transitions. Stack headers are part
       of the same logical entry as the log line above them anyway, so a
       uniform compact height fits the "all-one-output" semantics. */
    line-height: var(--log-line-height, 1.1);
    white-space: pre;
    word-break: normal;
    overflow-wrap: normal;
    /* WHY user-select is intentionally NOT set to none here: the header row is
       clickable (click toggleStackGroup) AND users legitimately need to copy
       the error / function / path text inside it. Browsers distinguish click
       without drag (fires click event, toggle) from click-drag (text selection)
       natively, so both affordances coexist without a CSS override. The prior
       user-select:none rule (inherited from the original collapsible-stack
       commit with no documented rationale) blocked copying the header text
       entirely and was removed as part of the unified-line-collapsing rethink. */
}
/* Stack-header text color follows inherited level \u2014 same tokens as .line.level-* in viewer-styles-lines.ts.
   Error is explicit (not baked into .stack-header default) so non-error traces never flash red. */
.stack-header.level-error { color: var(--vscode-debugConsole-errorForeground, #f48771); }
.stack-header.level-warning { color: var(--vscode-debugConsole-warningForeground, #cca700); }
.stack-header.level-performance { color: var(--vscode-charts-purple, #a855f7); }
.stack-header.level-info { color: var(--vscode-charts-blue, #2196f3); }
.stack-header.level-debug { color: var(--vscode-terminal-ansiYellow, #dcdcaa); }
.stack-header.level-notice { color: var(--vscode-terminal-ansiCyan, #00bcd4); }
.stack-header.level-database { color: var(--vscode-charts-green, #4caf50); }
.stack-header:hover { background: var(--vscode-list-hoverBackground); }
/* When collapsed, hide all child frame lines */
.stack-group.collapsed .stack-frames { display: none; }
/* Individual stack frames are indented and dimmed */
.stack-frames .line {
    padding-left: 28px;
    color: var(--vscode-descriptionForeground);
    white-space: pre;
    word-break: normal;
    overflow-wrap: normal;
}
/* Dart SDK frame origin: the library URI ("dart:async") floats to a muted,
   right-aligned "source" position so the member leads. float (not flex) leaves every
   other frame's pre-formatted layout untouched; italic + low opacity mark it as origin
   metadata, not the call. */
.frame-lib-src { float: right; margin-left: 1.5em; opacity: 0.6; font-style: italic; }
/* Broken-chain glyph that replaces the raw "<asynchronous suspension>" text
   on Dart async stack frames. The wrapper holds the ORIGINAL phrase in a
   .async-gap-text span styled with the sr-only pattern: visually clipped to
   1px but kept in the DOM so getSelection().toString() and stripTags() still
   capture it on Ctrl+C. The visible icon comes from CSS ::before \u2014 pseudo-
   element content is never included in clipboard text, which is why the
   icon does not contaminate copies. Click toggles .expanded which swaps the
   icon for the readable text inline. */
.async-gap-glyph { display: inline-block; cursor: pointer; margin-left: 6px; position: relative; vertical-align: baseline; }
.async-gap-glyph::before { content: '\\26d3\\fe0f\\200d\\1f4a5'; opacity: 0.55; user-select: none; font-size: 0.85em; margin-right: 2px; }
.async-gap-glyph:hover::before { opacity: 0.85; }
.async-gap-glyph:focus { outline: 1px dotted var(--vscode-focusBorder); }
.async-gap-glyph .async-gap-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; user-select: text; color: transparent; }
.async-gap-glyph.expanded::before { content: ''; margin: 0; }
.async-gap-glyph.expanded .async-gap-text { position: static; width: auto; height: auto; overflow: visible; clip: auto; color: var(--vscode-descriptionForeground); opacity: 0.75; }
/* Thread header lines from Android/Java thread dumps */
.thread-header {
    color: var(--vscode-textLink-foreground);
    font-weight: 600;
    font-style: italic;
}
/* Thread dump summary marker injected before multi-thread dumps */
.thread-dump-summary {
    color: var(--vscode-debugConsole-warningForeground, #ff9800);
    font-weight: 700;
    font-size: 0.95em;
}
/* ANR pattern warning badge on blocking threads */
.anr-badge { color: var(--vscode-editorWarning-foreground, #fc0); margin-right: 4px; }
.anr-warning { color: var(--vscode-editorWarning-foreground, #fc0); }

/* Correlation badge: line is part of a detected correlation */
.correlation-badge { color: var(--vscode-textLink-foreground); cursor: pointer; margin-left: 2px; }
.correlation-badge:hover { text-decoration: underline; }

/* ===================================================================
   Jump-to-Top / Jump-to-Bottom Buttons
   Position and inset come from syncJumpButtonInset() (fixed + viewport rects). Opacity-only
   animation avoids transform on the buttons conflicting with compositor positioning.
   =================================================================== */
#log-content {
    position: relative;
}
@keyframes jump-btn-fade-in { from { opacity: 0; } to { opacity: 0.85; } }
#jump-btn, #jump-top-btn {
    display: none;
    position: fixed;
    left: auto;
    right: 8px;
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding: 4px 10px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 11px;
    opacity: 0.85;
    z-index: 15;
    transition: opacity 0.2s ease;
    animation: jump-btn-fade-in 0.2s ease-out;
    pointer-events: auto;
}
#jump-btn { bottom: 8px; }
#jump-top-btn { top: 8px; }
#jump-btn:hover, #jump-top-btn:hover {
    opacity: 1;
    background: var(--vscode-list-hoverBackground);
}

/* ===================================================================
   Annotations & Timing
   Visual indicators for deduplication notes, slow gaps between
   log lines, and per-line elapsed timestamps.
   =================================================================== */
/* Dedup annotation: "Error (x54)" style inline note */
.annotation {
    padding: 1px 8px 1px 32px;
    font-size: 11px;
    font-style: italic;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.04));
}
/* Dashed warning line shown when a time gap exceeds the threshold */
.slow-gap {
    text-align: center;
    color: var(--vscode-editorWarning-foreground, #fc0);
    font-size: 10px;
    padding: 2px 0;
    opacity: 0.7;
    border-top: 1px dashed var(--vscode-editorWarning-foreground, rgba(252, 192, 0, 0.3));
}
/* Per-line elapsed time label (e.g. "+1.2s"). text-align:right + min-width line up varying values ("17s", "3m 31s") on the "s". */
.elapsed-time {
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    min-width: 50px;
    display: inline-block;
    text-align: right;
    opacity: 0.7;
}

/* ===================================================================
   Stack Trace Intelligence
   Styles for framework frame dimming, app-only toggle, and
   deduplication badges on repeated stack traces.
   =================================================================== */
/* Framework/library frames are dimmed to highlight app code */
.framework-frame { opacity: 0.4; }
/* Badge showing how many times a stack trace was repeated */
.stack-dedup-badge {
    font-size: 10px;
    opacity: 0.7;
    margin-left: 4px;
}
/* Consecutive duplicate lines collapsed in compress mode (same styling family as stack dedup). */
.compress-dup-badge {
    font-size: 10px;
    opacity: 0.75;
    margin-right: 6px;
    color: var(--vscode-descriptionForeground);
    font-style: normal;
    vertical-align: baseline;
}

/* ===================================================================
   Repeat Notifications
   Real-time notifications when duplicate log lines are detected.
   Shows count and preview of repeated message.
   =================================================================== */
.repeat-notification {
    opacity: 0.75;
    font-style: italic;
    color: var(--vscode-descriptionForeground);
}
.repeat-preview {
    font-size: 0.95em;
    opacity: 0.9;
}

/* ===================================================================
   Output Channel Badge
   Small inline label showing the DAP category (stdout, stderr, etc.)
   for each line. Toggled from the Decoration Settings panel.
   =================================================================== */
.category-badge {
    display: inline-block;
    padding: 0 0.3em;
    margin-right: 0.3em;
    border-radius: 0.25em;
    font-size: 0.7em;
    font-weight: 600;
    vertical-align: middle;
    color: var(--cat-clr, #888);
    background: color-mix(in srgb, var(--cat-clr, #888) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--cat-clr, #888) 30%, transparent);
}

/* ===================================================================
   Visual Spacing (Breathing Room)
   Adds configurable margin before/after log sections for readability.
   =================================================================== */
.spacing-before {
    margin-top: 12px;
}
.spacing-after {
    margin-bottom: 12px;
}

`
  );
}

// src/ui/viewer-styles/viewer-styles-n-plus-one-signal.ts
function getNPlusOneSignalStyles() {
  return (
    /* css */
    `
/* Drift SQL N+1 heuristic signal row (see modules/db/drift-n-plus-one-detector.ts) */
.n1-signal {
    color: var(--vscode-editorWarning-foreground, #ffcc00);
    font-style: normal;
}
.n1-conf {
    font-size: 10px;
    border: 1px solid currentColor;
    border-radius: 3px;
    padding: 0 4px;
    margin: 0 4px;
}
.n1-conf-high { color: var(--vscode-errorForeground, #f48771); }
.n1-conf-medium { color: var(--vscode-editorWarning-foreground, #ffcc00); }
.n1-conf-low { color: var(--vscode-descriptionForeground, #9da3a6); }
.n1-fp {
    opacity: 0.85;
    color: var(--vscode-descriptionForeground);
}
.n1-actions {
    margin-left: 8px;
}
.n1-action {
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
}
.n1-action:hover {
    text-decoration-style: solid;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-sql-repeat-drilldown.ts
function getSqlRepeatDrilldownStyles() {
  return (
    /* css */
    `
.sql-repeat-drilldown-toggle {
    display: inline;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-style: italic;
    cursor: pointer;
    text-align: left;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
}
.sql-repeat-drilldown-toggle:hover {
    color: var(--vscode-textLink-foreground);
}
.sql-repeat-drilldown-detail {
    display: block;
    margin-top: 6px;
    margin-bottom: 2px;
    padding: 6px 8px 8px 10px;
    border-left: 2px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.12));
}
.sql-repeat-drilldown-meta {
    font-size: 0.92em;
    margin-bottom: 4px;
    color: var(--vscode-descriptionForeground);
}
.sql-repeat-drilldown-meta-label {
    font-weight: 600;
    margin-right: 4px;
}
.sql-repeat-drilldown-fp {
    font-size: 0.88em;
    word-break: break-all;
}
.sql-repeat-drilldown-snippet {
    margin: 6px 0 8px;
    padding: 6px 8px;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    line-height: 1.35;
    background: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.2));
    border-radius: 3px;
    max-height: 9.5em;
    overflow: auto;
}
.sql-repeat-drilldown-variant-title {
    font-size: 0.88em;
    font-weight: 600;
    margin: 4px 0 2px;
    color: var(--vscode-descriptionForeground);
}
.sql-repeat-drilldown-variant {
    font-size: 0.88em;
    margin: 2px 0;
    padding-left: 4px;
}
.sql-repeat-drilldown-variant-count {
    opacity: 0.85;
    margin-right: 6px;
    font-style: normal;
}
.sql-repeat-drilldown-more {
    font-size: 0.88em;
    font-style: italic;
    margin-top: 4px;
    color: var(--vscode-descriptionForeground);
}
.sql-repeat-drilldown-actions {
    margin-top: 8px;
}
.sql-repeat-static-sources {
    font-size: 11px;
    padding: 2px 8px;
    cursor: pointer;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 2px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.sql-repeat-static-sources:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
`
  );
}

// src/ui/viewer-search-filter/viewer-search-history.ts
function getSearchHistoryStyles() {
  return (
    /* css */
    `
.search-history:empty { display: none; }
.search-history-header {
    padding: 4px 8px 2px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
}
.search-history-item {
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.search-history-item:hover {
    background: var(--vscode-list-hoverBackground);
    color: var(--vscode-foreground);
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-search.ts
function getSearchStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Session nav \u2014 compact find row (align with editor find / input options)
   =================================================================== */
.session-nav-search-outer {
    position: relative;
    margin-left: auto;
    /* Shrink on one row; grows up to max-width when wrapping to its own line. */
    flex: 1 1 200px;
    min-width: min(120px, 100%);
    max-width: 350px;
    align-self: center;
}
.session-search-compact {
    width: 100%;
}
.session-search-input-shell {
    display: flex;
    align-items: stretch;
    min-height: 24px;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    overflow: hidden;
}
.session-search-input-shell:focus-within {
    border-color: var(--vscode-focusBorder);
}
#search-input {
    flex: 1;
    /* Floor the textbox so trailing controls (toggles + colored badge + nav + funnel)
       can't squeeze it down to a few characters; the shell still shrinks via the
       container's max-width when the panel is narrow. */
    min-width: 140px;
    background: transparent;
    color: var(--vscode-input-foreground);
    border: none;
    padding: 3px 4px 3px 6px;
    font-size: 13px;
    font-family: var(--vscode-font-family);
    line-height: 18px;
    outline: none;
}
.session-search-trailing {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 0;
    padding: 0 3px 0 0;
    border-left: 1px solid var(--vscode-input-border, var(--vscode-widget-border, rgba(127, 127, 127, 0.3)));
    margin-left: 2px;
    padding-left: 3px;
}
/* Case / whole word / regex \u2014 editor-style controls, shown only while searching (focus or active query) to keep the title bar calm. */
.session-search-toggles-inline {
    display: none;
    align-items: center;
    flex-shrink: 0;
    gap: 0;
    padding: 0 4px 0 2px;
    border-right: 1px solid var(--vscode-input-border, var(--vscode-widget-border, rgba(127, 127, 127, 0.3)));
    margin-right: 2px;
}
.session-search-input-shell:focus-within .session-search-toggles-inline,
.session-search-compact.has-search-query .session-search-toggles-inline {
    display: flex;
}
/* Workspace setting: always show case / whole word / regex (overrides progressive disclosure). */
body.search-match-options-always .session-search-toggles-inline {
    display: flex;
}
/* Colored pill badge \u2014 mirrors .toolbar-badge / .find-summary-count pattern so the count reads as
   a result indicator (badge_background) instead of dimmed body text. Empty span collapses so the
   gutter has no width when there is nothing to show. */
.session-search-match-count {
    font-size: 11px;
    line-height: 1;
    font-family: var(--vscode-font-family);
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
    white-space: nowrap;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 3px 8px;
    margin: 0 4px;
    border-radius: 10px;
    user-select: none;
    font-weight: 600;
}
.session-search-match-count:empty { display: none; }
/* Borderless icon buttons \u2014 same idea as find widget / workbench toolbar */
.session-search-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    margin: 0;
    border: 1px solid transparent;
    border-radius: 2px;
    box-sizing: border-box;
    background: transparent;
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
    cursor: pointer;
}
.session-search-icon-btn:hover {
    background: var(--vscode-toolbar-hoverBackground);
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
}
.session-search-icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
    background: transparent;
}
.session-search-icon-btn .codicon {
    font-size: 16px;
}
/* Clear button sits inside the input shell \u2014 reduce size to avoid stretching the row */
.search-clear-btn {
    flex-shrink: 0;
    opacity: 0.7;
}
.search-clear-btn:hover {
    opacity: 1;
}
.session-search-funnel-btn[aria-expanded="true"] {
    background: var(--vscode-toolbar-activeBackground, var(--vscode-button-secondaryBackground));
    color: var(--vscode-toolbar-activeForeground, var(--vscode-foreground));
}

/* Options popover (fixed position; coordinates from script) */
.search-options-popover {
    margin: 0;
    padding: 0;
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, var(--vscode-panel-border)));
    border-radius: 3px;
    box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.36));
}
.search-options-popover[hidden] {
    display: none !important;
}
.search-options-popover-inner {
    padding: 5px 6px 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.search-options-toggles {
    display: flex;
    align-items: center;
    gap: 2px;
}
.session-search-toggles-inline .search-input-btn,
.search-options-toggles .search-input-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
    cursor: pointer;
    padding: 2px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    box-sizing: border-box;
}
.session-search-toggles-inline .search-input-btn:hover,
.search-options-toggles .search-input-btn:hover {
    background: var(--vscode-toolbar-hoverBackground);
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
}
/* Match find-input-actions in find panel (not high-contrast inputOption pills unless theme sets them). */
.session-search-toggles-inline .search-input-btn.active,
.search-options-toggles .search-input-btn.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground);
    border-color: var(--vscode-focusBorder);
}
.session-search-toggles-inline .search-input-btn .codicon,
.search-options-toggles .search-input-btn .codicon {
    font-size: 16px;
}
.search-mode-toggle {
    display: block;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 12px;
    font-family: var(--vscode-font-family);
    line-height: 18px;
    padding: 4px 6px;
    border-radius: 2px;
}
.search-mode-toggle:hover {
    background: var(--vscode-toolbar-hoverBackground);
}
.search-mode-toggle.active {
    background: var(--vscode-toolbar-activeBackground, var(--vscode-button-secondaryBackground));
    color: var(--vscode-toolbar-activeForeground, var(--vscode-foreground));
}

/* Floating search history under the field */
.session-search-history:not(:empty) {
    overflow-y: auto;
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, var(--vscode-panel-border)));
    border-radius: 3px;
    box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.36));
}

/* --- Search match highlighting --- */
mark {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
    color: inherit;
    border-radius: 2px;
}
@keyframes match-pulse { 0% { box-shadow: 0 0 0 0 rgba(234, 92, 0, 0.4); } 100% { box-shadow: 0 0 0 4px transparent; } }
.current-match mark {
    background: var(--vscode-editor-findMatchBackground, rgba(255, 150, 50, 0.6));
    animation: match-pulse 0.4s ease-out;
}
.search-match {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.1));
}
` + getSearchHistoryStyles()
  );
}

// src/ui/viewer-context-menu/viewer-context-popover-styles.ts
function getContextPopoverStyles() {
  return (
    /* css */
    `
/* ===================================================================
   Context Popover
   Floating popover showing integration context for a log line.
   Positioned near the clicked line, dismissible via click outside or Esc.
   =================================================================== */
@keyframes popover-reveal {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.context-popover {
    position: fixed;
    z-index: 1000;
    min-width: 320px;
    max-width: 500px;
    max-height: 400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-focusBorder));
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    animation: popover-reveal 0.15s ease-out;
}

.popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--vscode-editorHoverWidget-statusBarBackground, rgba(0, 0, 0, 0.1));
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.popover-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.popover-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 14px;
    line-height: 1;
}
.popover-close:hover {
    color: var(--vscode-errorForeground, #f44);
}

.popover-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
}

.popover-section {
    padding: 0 12px;
    margin-bottom: 8px;
}
.popover-section:last-child {
    margin-bottom: 0;
}

.popover-section-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-foreground);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.popover-icon {
    font-size: 13px;
}

.popover-section-content {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    padding-left: 20px;
}

.popover-item {
    padding: 2px 0;
    line-height: 1.4;
}

.popover-more {
    font-style: italic;
    color: var(--vscode-descriptionForeground);
    opacity: 0.8;
    padding-top: 2px;
}

.popover-empty {
    padding: 16px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}

/* HTTP styles */
.http-item {
    font-family: var(--vscode-editor-font-family, monospace);
}
.http-method {
    font-weight: 600;
    color: var(--vscode-symbolIcon-methodForeground, #b180d7);
}
.http-url {
    color: var(--vscode-textLink-foreground);
}
.http-status.status-ok {
    color: var(--vscode-testing-iconPassed, #73c991);
}
.http-status.status-error {
    color: var(--vscode-errorForeground, #f44);
}
.http-status.status-redirect {
    color: var(--vscode-editorWarning-foreground, #cca700);
}
.http-duration {
    color: var(--vscode-descriptionForeground);
    opacity: 0.8;
}

/* Terminal styles */
.terminal-content {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
}
.terminal-line {
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Docker styles */
.docker-name {
    font-weight: 500;
}
.docker-status.status-ok {
    color: var(--vscode-testing-iconPassed, #73c991);
}
.docker-status.status-error {
    color: var(--vscode-errorForeground, #f44);
}

.popover-footer {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.popover-btn {
    padding: 4px 10px;
    font-size: 11px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 4px;
    cursor: pointer;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.popover-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.popover-btn.popover-full {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.popover-btn.popover-full:hover {
    background: var(--vscode-button-hoverBackground);
}

/* Line-local database signal (Drift SQL fingerprint + snippet) */
.popover-meta-label {
    font-weight: 600;
    color: var(--vscode-foreground);
    margin-right: 4px;
}
.popover-fingerprint {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
    word-break: break-all;
}
.popover-sql-wrap {
    display: block;
    margin-top: 4px;
}
.popover-sql-snippet {
    display: inline-block;
    max-width: 100%;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
    white-space: pre-wrap;
    word-break: break-all;
    user-select: text;
    cursor: text;
    color: var(--vscode-editor-foreground);
}
.popover-db-static-note {
    font-size: 11px;
    opacity: 0.88;
    margin-top: 6px;
    color: var(--vscode-descriptionForeground);
}
.popover-static-sql-open {
    margin-top: 4px;
}

/* Database queries (from .queries.json sidecar) */
.db-query-item {
    font-family: var(--vscode-editor-font-family, monospace);
    display: flex;
    align-items: baseline;
    gap: 4px;
}
.db-query-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
}
.popover-copy-query {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    opacity: 0.6;
    flex-shrink: 0;
}
.popover-copy-query:hover {
    opacity: 1;
}

/* Security / audit section */
.popover-security-note {
    font-style: italic;
    opacity: 0.8;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-ui.ts
function getUiStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Pinned Section
   Sticky area at the top of the viewport holding user-pinned lines.
   Scrollable with a max height so it doesn't dominate the view.
   Uses --vscode-panel-background to match the VS Code bottom panel.
   =================================================================== */
#pinned-section {
    display: none;
    position: sticky;
    top: 0;
    z-index: 5;
    /* Panel background blends with the VS Code bottom panel chrome */
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    max-height: 30vh;  /* cap height so pins don't eat all space */
    overflow-y: auto;
    flex-shrink: 0;
}
.pinned-header {
    font-size: 10px;
    padding: 2px 8px;
    color: var(--vscode-descriptionForeground);
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-panel-border);
}
@keyframes slide-in-left { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
.pinned-item {
    padding: 0 8px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    align-items: baseline;
    gap: 4px;
    cursor: pointer;  /* click to scroll to original line */
    animation: slide-in-left 0.15s ease-out;
}
.pinned-item:hover {
    background: var(--vscode-list-hoverBackground);
}
/* Small "x" button to remove a pinned line */
.unpin-btn {
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    flex-shrink: 0;
}
.unpin-btn:hover {
    color: var(--vscode-errorForeground, #f44);
}
.pinned-text {
    flex: 1;
    overflow: hidden;
}

/* --- Line selection highlight (click or keyboard nav) --- */
.line.selected, .stack-header.selected, .marker.selected {
    background: var(--vscode-editor-selectionBackground, rgba(38, 79, 120, 0.5));
}

/* ===================================================================
   Exclusion Controls
   Footer elements for the pattern-based line exclusion feature.
   =================================================================== */
#exclusion-count {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

/* ===================================================================
   Hidden Lines Counter
   Footer element showing count of manually hidden lines with peek toggle.
   =================================================================== */
.hidden-lines-counter {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0 4px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
}
.hidden-lines-counter:hover {
    color: var(--vscode-foreground);
}
.hidden-lines-counter.peeking {
    color: var(--vscode-inputValidation-infoForeground, #75beff);
}
.hidden-lines-counter.peeking .codicon::before {
    content: "\\eb99"; /* codicon-eye */
}
.hidden-lines-counter .codicon {
    font-size: 12px;
}

/* ===================================================================
   Inline Peek
   Expandable context view inserted inline after the viewport.
   Shows surrounding lines around a right-click \u2192 Show Context target.
   =================================================================== */
@keyframes peek-reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.inline-peek {
    border-top: 2px solid var(--vscode-focusBorder, #007acc);
    border-bottom: 2px solid var(--vscode-focusBorder, #007acc);
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
    margin: 4px 0;
    animation: peek-reveal 0.2s ease-out;
}
.peek-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
}
.peek-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
}
.peek-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.peek-target {
    background: var(--vscode-editor-lineHighlightBackground, rgba(255, 255, 0, 0.15));
    /* Accent rail via inset box-shadow, NOT border-left: a real 3px border-left
       adds to the row's box and shifts the jumped-to line's content (line number +
       message) 3px right of every other row, breaking the gutter column grid on
       exactly the line the user is looking at. box-shadow:inset paints the same
       stripe inside the row's left edge without changing its width, so columns stay
       straight. Same fix the AI rail uses (viewer-styles-ai.ts). */
    box-shadow: inset 3px 0 0 var(--vscode-editorLineNumber-activeForeground, #c6c6c6);
}
.peek-context { opacity: 0.7; }

/* --- Scrollbar Minimap: interactive panel replacing native scrollbar --- */
.scrollbar-minimap-column {
    flex: 0 0 auto;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    flex-shrink: 0;
    align-self: stretch;
}
.minimap-outside-arrow {
    flex: 0 0 12px;
    width: 12px;
    position: relative;
    align-self: stretch;
    pointer-events: none;
    overflow: visible;
}
.minimap-outside-arrow.u-hidden { display: none; }
/* Yellow triangle points at the vertical middle of the visible range (positioned by JS). */
.minimap-outside-arrow-glyph {
    position: absolute;
    left: 1px;
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-left: 9px solid #ffeb3b;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.9));
    transition: top 0.08s linear;
}
/* Drag-to-resize grip on the left edge of the minimap column */
.minimap-resize-handle {
    flex: 0 0 4px;
    width: 4px;
    cursor: col-resize;
    align-self: stretch;
    background: transparent;
    transition: background 0.15s;
    z-index: 1; /* above minimap canvas */
}
.minimap-resize-handle:hover {
    background: var(--vscode-sash-hoverBorder, rgba(0, 122, 204, 0.6));
}
/* Lock cursor to col-resize during drag so it does not flicker */
body.mm-resizing, body.mm-resizing * { cursor: col-resize !important; }
.scrollbar-minimap {
    flex: 0 0 auto;
    width: 60px;
    flex-shrink: 0;
    position: relative;
    align-self: stretch;
    overflow: hidden;
    cursor: pointer;
    border-left: 1px solid var(--vscode-editorOverviewRuler-border, rgba(127, 127, 127, 0.3));
}
.minimap-viewport {
    position: absolute; left: 0; right: 0; pointer-events: none; min-height: 10px;
    /* z-index ensures viewport renders above the canvas compositing layer */
    z-index: 1;
    /* Slightly more transparent than default theme slider so the log map shows through */
    background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.34));
    transition: top 0.08s linear;
    /* Reserve border space so toggling the outline doesn't shift size */
    border: 2px solid transparent;
    box-sizing: border-box;
}
.minimap-viewport.minimap-viewport--red-outline {
    border-color: rgba(239, 68, 68, 0.95);
    background: rgba(121, 121, 121, 0.30);
}
.scrollbar-minimap:hover .minimap-viewport { background: var(--vscode-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.58)); }
.scrollbar-minimap:hover .minimap-viewport.minimap-viewport--red-outline {
    background: rgba(100, 100, 100, 0.38);
    border-color: rgba(255, 82, 82, 1);
}
.scrollbar-minimap.mm-dragging .minimap-viewport { background: var(--vscode-scrollbarSlider-activeBackground, rgba(191, 191, 191, 0.32)); }
.scrollbar-minimap.mm-dragging .minimap-viewport.minimap-viewport--red-outline {
    border-color: rgba(255, 82, 82, 1);
}

/* ===================================================================
   Auto-Hide Modal
   Pattern management popup for auto-hide feature.
   =================================================================== */
.auto-hide-modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; }
.auto-hide-modal-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.4); }
.auto-hide-modal-content {
    position: relative; z-index: 1; width: 400px; max-height: 60vh;
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
    border-radius: 6px; display: flex; flex-direction: column; overflow: hidden;
}
.auto-hide-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; font-size: 13px; font-weight: 600;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.auto-hide-modal-close { background: none; border: none; color: var(--vscode-descriptionForeground); font-size: 18px; cursor: pointer; padding: 0 4px; }
.auto-hide-modal-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.auto-hide-modal-list { overflow-y: auto; max-height: 50vh; padding: 4px 0; }
.auto-hide-item {
    display: flex; align-items: center; gap: 6px; padding: 4px 12px; font-size: 12px;
}
.auto-hide-item:hover { background: var(--vscode-list-hoverBackground); }
.auto-hide-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.auto-hide-badge {
    font-size: 9px; padding: 1px 4px; border-radius: 3px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
}
.auto-hide-badge.session { opacity: 0.6; }
.auto-hide-remove { background: none; border: none; color: var(--vscode-descriptionForeground); font-size: 14px; cursor: pointer; padding: 0 2px; }
.auto-hide-remove:hover { color: var(--vscode-errorForeground, #f44); }
.auto-hide-modal-empty { padding: 16px; text-align: center; font-size: 12px; color: var(--vscode-descriptionForeground); }

`
  );
}

// src/ui/viewer-styles/viewer-styles-level.ts
function getLevelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Level Filter \u2014 Compact Dot Summary (footer trigger)
   Clickable dot groups toggle levels; label opens fly-up menu.
   =================================================================== */
.level-summary {
    display: inline-flex;
    gap: 2px;
    align-items: center;
    padding: 2px 4px;
    border-radius: 3px;
}
.level-dot-group {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
}
.level-dot-group:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.level-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    min-width: 12px;
    min-height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: opacity 0.2s ease;
}
.level-dot:not(.active) { opacity: 0.3; }
/* Dot palette matches .line.level-* text colors in viewer-styles-lines.ts and
   .level-bar-* in viewer-styles-decoration-bars.ts. Info=blue, Notice=cyan,
   Database=green \u2014 keep the three in lockstep when any one changes. */
.level-dot-info { background: #2196f3; }
.level-dot-warning { background: #ff9800; }
.level-dot-error { background: #f44336; }
.level-dot-performance { background: #9c27b0; }
.level-dot-todo { background: #bdbdbd; }
.level-dot-debug { background: #795548; }
.level-dot-notice { background: #00bcd4; }
.level-dot-database { background: #4caf50; }
/* Level letter chip \u2014 sits between the colored dot and the count.
   Why: 8 colors at 12px are unscannable on dense toolbar (color-blind users
   especially), and the toolbar footer was the only level-filter UI without
   any text label, diverging from the filter drawer's emoji+label+count
   chips. Per-level colors match the dot; inactive groups also lower letter
   opacity via :has(.level-dot:not(.active)) so state stays paired with the dot. */
.level-letter {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0;
    user-select: none;
    transition: opacity 0.2s ease;
    color: var(--vscode-descriptionForeground);
}
.level-dot-group:has(.level-dot:not(.active)) .level-letter { opacity: 0.45; }
.level-letter-error { color: #f44336; }
.level-letter-warning { color: #ff9800; }
.level-letter-info { color: #2196f3; }
.level-letter-performance { color: #9c27b0; }
.level-letter-todo { color: var(--vscode-descriptionForeground); }
.level-letter-debug { color: #a1887f; }
.level-letter-notice { color: #00bcd4; }
.level-letter-database { color: #4caf50; }
.dot-count {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    line-height: 1;
}
.dot-count:empty { display: none; }
.level-trigger-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-left: 2px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
}
.level-trigger-label:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* Level fly-up removed \u2014 level toggles are now in the toolbar filter drawer. */

/* ===================================================================
   Level Filter Circles (inside fly-up)
   Interactive toggles for each log level.
   =================================================================== */
.level-circle {
    background: none;
    border: 1px solid transparent;
    color: inherit;
    font-size: 11px;
    padding: 2px 6px;
    cursor: pointer;
    opacity: 1;
    transition: opacity 0.2s ease, background 0.15s ease;
    line-height: 1.2;
    border-radius: 3px;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    width: 100%;
    text-align: left;
}
.level-emoji { flex-shrink: 0; }
.level-label { flex: 1; text-align: left; }
.level-count {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    min-width: 20px;
    text-align: right;
}
.level-circle:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    border-color: var(--vscode-descriptionForeground);
}
/* Inactive (disabled) circles are dimmed and desaturated */
.level-circle:not(.active) {
    opacity: 0.25;
    filter: grayscale(0.8);
}
/* Context lines slider inside the level fly-up */
.level-flyup-context { border-top: 1px solid var(--vscode-panel-border); margin-top: 4px; padding: 4px 4px 2px; }
.level-flyup-context-label { font-size: 10px; color: var(--vscode-descriptionForeground); }
.level-flyup-context input[type="range"] { width: 100%; margin-top: 2px; }
.line.context-line { opacity: 0.4; }
.line.context-first { position: relative; }
.line.context-first::before { content: ''; position: absolute; top: 0; left: 8px; right: 8px; border-top: 1px dashed rgba(128,128,128,0.35); }

`
  );
}

// src/ui/viewer-styles/viewer-styles-components.ts
function getComponentStyles() {
  return getSearchStyles() + getUiStyles() + getLevelStyles();
}

// src/ui/viewer-styles/viewer-styles-context-menu.ts
function getContextMenuStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Context Menu
   Right-click menu for log lines. Provides actions like copy,
   pin, exclude, search codebase, etc.
   =================================================================== */
.context-menu {
    display: none;
    position: fixed;
    z-index: 200;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    min-width: 160px;
    width: max-content;
    padding: 4px 0;
    white-space: nowrap;
    /* positionContextMenu() caps max-height to the viewport; this lets a long menu on a
       short panel scroll instead of running off the bottom edge with no way to reach the rest. */
    overflow-y: auto;
    overscroll-behavior: contain; /* a scroll inside the menu must not bubble to the log list */
}
@keyframes menu-pop-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.context-menu.visible { display: block; animation: menu-pop-in 0.12s ease-out; }
.context-menu-item {
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
}
.context-menu-item:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.context-menu-item.is-disabled {
    opacity: 0.45;
    cursor: default;
}
.context-menu-item.is-disabled:hover {
    background: transparent;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
}
.context-menu-item .codicon {
    font-size: 14px;
    opacity: 0.8;
}
.context-menu-separator {
    height: 1px;
    background: var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
    margin: 4px 8px;
}

/* --- Submenu trigger row --- */
.context-menu-submenu {
    position: relative;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
}
.context-menu-submenu:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.context-menu-submenu .codicon { font-size: 14px; opacity: 0.8; }
.context-menu-arrow { margin-left: auto; font-size: 12px !important; opacity: 0.6; }

/* --- Submenu flyout panel ---
   left:100% / top:0 are only the pre-JS fallback. positionSubmenu() (viewer-context-menu-position.ts)
   switches the panel to position:fixed on each trigger's mouseenter and sets left/top in viewport
   coordinates so it spans the full viewport height and slides fully on-screen \u2014 not anchored to the
   trigger box. overflow-y:auto makes a flyout taller than the viewport scroll instead of clipping. */
.context-menu-submenu-content {
    display: none;
    position: absolute;
    left: 100%;
    top: 0;
    z-index: 201;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    min-width: 160px;
    width: max-content;
    padding: 4px 0;
    white-space: nowrap;
    overflow-y: auto;
    overscroll-behavior: contain; /* a scroll inside the flyout must not bubble to the log list */
}
.context-menu-submenu:hover > .context-menu-submenu-content { display: block; }

/* --- Toggle items (checkmark + label) --- */
/* Check sits left of the label (VS Code convention): icon \u2192 \u2713 \u2192 label.
   Previously absolute-positioned at right:8px, which looked like a submenu \u25B8 arrow
   and caused users to expect a flyout that never appeared. */
.context-menu-toggle { position: relative; }
.context-menu-toggle .context-menu-check {
    font-size: 14px;
    opacity: 0;
    margin-right: -4px; /* tighten gap between check and label */
}
.context-menu-toggle.checked .context-menu-check { opacity: 0.8; }
/* Explicit flex item so the text label is never collapsed by the flex layout.
   font-family inherits from .context-menu-item; override only if needed. */
.context-menu-label { flex: 1 1 auto; }
/* Right-aligned dimmed shortcut hint (VS Code convention: Ctrl+C sits right of the label).
   margin-left:auto pushes it to the far right; the label's flex:1 already fills the middle. */
.context-menu-shortcut {
    margin-left: 24px;
    opacity: 0.5;
    font-size: 11px;
    white-space: nowrap;
}

`
  );
}

// src/ui/viewer-styles/viewer-styles-decoration-bars.ts
function getDecorationBarStyles() {
  return (
    /* css */
    `

/* Whole-line severity tinting \u2014 hues follow the same tokens as bar/text for each level. */
.line.line-tint-error {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 14%, transparent);
}
.line.line-tint-error:hover {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 22%, transparent);
}
.line.line-tint-warning {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-warningForeground, #cca700) 12%, transparent);
}
.line.line-tint-warning:hover {
    background-color: color-mix(in srgb, var(--vscode-debugConsole-warningForeground, #cca700) 20%, transparent);
}
.line.line-tint-performance {
    background-color: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 12%, transparent);
}
.line.line-tint-performance:hover {
    background-color: color-mix(in srgb, var(--vscode-charts-purple, #a855f7) 20%, transparent);
}
.line.line-tint-todo {
    background-color: rgba(200, 200, 200, 0.08);
}
.line.line-tint-todo:hover {
    background-color: rgba(200, 200, 200, 0.16);
}
.line.line-tint-debug {
    background-color: rgba(220, 220, 170, 0.08);
}
.line.line-tint-debug:hover {
    background-color: rgba(220, 220, 170, 0.16);
}
/* Notice tint: cyan, matches .line.level-notice and .level-bar-notice. */
.line.line-tint-notice {
    background-color: color-mix(in srgb, var(--vscode-terminal-ansiCyan, #00bcd4) 10%, transparent);
}
.line.line-tint-notice:hover {
    background-color: color-mix(in srgb, var(--vscode-terminal-ansiCyan, #00bcd4) 18%, transparent);
}
/* Database tint: green, matches .line.level-database and .level-bar-database. */
.line.line-tint-database {
    background-color: color-mix(in srgb, var(--vscode-charts-green, #4caf50) 12%, transparent);
}
.line.line-tint-database:hover {
    background-color: color-mix(in srgb, var(--vscode-charts-green, #4caf50) 20%, transparent);
}
/* Info tint: blue, matches .line.level-info and .level-bar-info. */
.line.line-tint-info {
    background-color: color-mix(in srgb, var(--vscode-charts-blue, #2196f3) 10%, transparent);
}
.line.line-tint-info:hover {
    background-color: color-mix(in srgb, var(--vscode-charts-blue, #2196f3) 18%, transparent);
}

/* Blank/empty lines: set --blank-line-bg to any color to join before/after; when unset, previous line tint shows. */
.line.line-blank {
  background-color: var(--blank-line-bg);
  /* Must match calcItemHeight: Math.max(4, floor(ROW_HEIGHT/4)) while base .line uses
     full ROW_HEIGHT (= 1em \xD7 --log-line-height, see viewer-styles-lines.ts). Without
     this, virtual-scroll prefix sums use quarter height but the DOM row stays full
     height \u2014 blank gaps look "full size" and scroll height drifts. */
  height: max(4px, calc(0.25 * 1em * var(--log-line-height, 1.1)));
  min-height: 4px;
  /* Empty content: no need for the full strut; keeps the short box visually tight. */
  line-height: 1;
}

/* Positioning context for severity dots and connector bars */
#viewport { position: relative; }

/* Severity dot mode (colored circle on timeline) \u2014 scale with zoom via em */
[class*="level-bar-"] { z-index: 1; }
[class*="level-bar-"]::before {
    content: ''; position: absolute; left: 0.74em;
    top: 0; bottom: 0; margin: auto 0;
    width: 0.44em; height: 0.44em; border-radius: 50%;
    /* Above connector ::after \u2014 must stay in front where the gutter bar overlaps the dot. */
    pointer-events: none; z-index: 2;
}
/* Gutter dots/connectors use the same --vscode-* tokens as .line.level-* in viewer-styles.ts so bar and text stay aligned. */
.level-bar-error { --bar-color: var(--vscode-debugConsole-errorForeground, #f48771); }
/* Recent-error context (same 2s window as a fault above; not the primary error line). */
.level-bar-error-recent-context { --bar-color: color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 38%, var(--vscode-panel-border, #555) 62%); }
.level-bar-warning { --bar-color: var(--vscode-debugConsole-warningForeground, #cca700); }
.level-bar-performance { --bar-color: var(--vscode-charts-purple, #a855f7); }
.level-bar-todo { --bar-color: var(--vscode-terminal-ansiWhite, #e5e5e5); }
.level-bar-debug { --bar-color: var(--vscode-terminal-ansiYellow, #dcdcaa); }
.level-bar-notice { --bar-color: var(--vscode-terminal-ansiCyan, #00bcd4); }
.level-bar-framework { --bar-color: var(--vscode-charts-blue, #2196f3); }
.level-bar-database { --bar-color: var(--vscode-charts-green, #4caf50); }
.level-bar-info { --bar-color: var(--vscode-charts-blue, #2196f3); }
[class*="level-bar-"]::before { background: var(--bar-color); }
/* Blank lines: no dot, the connector ::after below still paints across them. */
.line-blank[class*="level-bar-"]::before { display: none; }
/* Stack trace rows (header + frames) belong to the SAME logical output as
   the log line above them \u2014 the trace is just "more detail for the line."
   Showing a severity dot on each frame would visually multiply the entry's
   weight. The chain ::after still paints on these rows so the gutter line
   reads as one continuous band through the whole entry; only the dots are
   suppressed. */
.stack-header[class*="level-bar-"]::before,
.line.stack-line[class*="level-bar-"]::before { display: none; }

/* Connector line between consecutive same-level dots.
   Declarative \u2014 no JS chain walking. Each row paints its OWN stripe ONLY
   when its immediate next sibling shares the same level-bar-* class. The
   stripe is anchored at this row's middle (top: 50%) and extends downward
   by one row height (height: calc(1em * --log-line-height)), reaching the
   next row's middle exactly. Result:
     - run of N same-level rows \u2192 N-1 stripes, each dot connected to the next
     - lone row (no same-level next) \u2192 no stripe, just the dot
     - end of a chain (next is different level) \u2192 :has() fails on the LAST
       row, no overshoot past its dot \u2014 clean termination.
   Single source of truth: the row's own level-bar-* class drives both the
   dot color (::before) and the line color (::after) via --bar-color. They
   cannot disagree because they're both pseudo-elements of the same element
   reading the same custom property.
   One selector per level \u2014 listed individually because CSS has no "same
   class as me" combinator. Order doesn't matter; specificity is identical.
   :not(:is(.art-block-start, .art-block-middle, .art-block-end)) excludes
   ASCII-art rows \u2014 they reuse ::after for the shimmer animation (and carry no
   gutter rail of their own; the old border-left was removed because it broke
   the box layout), so the chain connector must NOT also claim ::after there or
   it would replace the shimmer with a static stripe. */
.level-bar-error:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-error)::after,
.level-bar-error-recent-context:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-error-recent-context)::after,
.level-bar-warning:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-warning)::after,
.level-bar-performance:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-performance)::after,
.level-bar-todo:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-todo)::after,
.level-bar-debug:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-debug)::after,
.level-bar-notice:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-notice)::after,
.level-bar-framework:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-framework)::after,
.level-bar-database:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-database)::after,
.level-bar-info:not(:is(.art-block-start, .art-block-middle, .art-block-end)):has(+ .level-bar-info)::after {
    content: ''; position: absolute;
    left: 0.89em; width: 0.14em;
    /* Anchor at THIS row's middle (top: 50%) and extend to 50% PAST this
       row's bottom (bottom: -50%) \u2014 net height equals one parent-row
       height, reaching exactly the next row's middle where the next dot
       sits. Requires uniform row heights, which we now have: .line and
       .stack-header both use var(--log-line-height, 1.1) (see
       viewer-styles-content.ts comment on stack-header line-height).
       At a level transition the row's :has() check fails so it doesn't
       paint \u2014 no overshoot to leak the previous chain's color into the
       next chain's space. .line and .stack-header parents have
       overflow: visible so the stripe paints past the row's bottom edge
       into the next row's top half without clipping. */
    top: 50%;
    bottom: -50%;
    /* color-mix at 45% replaces opacity \u2014 opacity on ::after interacted with
       Chromium/WebKit stacking contexts so the gutter stripe could paint on
       top of the severity dot (::before). */
    background: color-mix(in srgb, var(--bar-color) 45%, transparent);
    pointer-events: none;
    /* Below severity dot (::before z-index: 2) so the dot covers the stripe
       at the connection point and remains the focal element. */
    z-index: 1;
}

/* Continuation line collapse badge \u2014 inline pill showing hidden line count.
   Toggles group visibility on click. Uses em so it scales with zoom. */
.cont-badge {
    display: inline-block;
    padding: 0.05em 0.35em;
    margin: 0 0.35em;
    border-radius: 0.25em;
    font-size: 0.75em;
    font-weight: 600;
    cursor: pointer;
    color: var(--vscode-descriptionForeground, #888);
    background: color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 40%, transparent);
    user-select: none;
    vertical-align: baseline;
}
.cont-badge:hover {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
}

/* Error classification markers \u2014 all four (critical / bug / transient / ANR)
   render as a single emoji absolutely positioned in the gutter, in their OWN
   column, so they never push the log text. WHY absolute: the prior inline
   "\u{1F41B} BUG" / "\u26A1 TRANSIENT" pills were flow content \u2014 every classified line's
   text shifted right and broke alignment with the surrounding lines. .line has
   position: relative so these anchor inside the row. The full label is in the
   title tooltip + hover popover; .error-badge-interactive keeps hover/analysis. */
.critical-fire-icon,
.error-badge-gutter {
    position: absolute;
    left: 0.3em;
    top: 0;
    bottom: 0;
    margin: auto 0;
    height: 1em;
    line-height: 1;
    font-size: 0.95em;
    cursor: pointer;
    z-index: 3;
    user-select: none;
}
/* Hide the severity dot on lines carrying a classification icon, so the emoji
   alone acts as the gutter indicator \u2014 no duplicated dot, no double-width gutter. */
.line:has(.critical-fire-icon)[class*="level-bar-"]::before,
.line:has(.error-badge-gutter)[class*="level-bar-"]::before { display: none; }
`
  );
}

// src/ui/viewer-styles/viewer-styles-collapse-controls.ts
function getCollapseControlStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Counter-row chevron \u2014 clickable line-number + \u25B6 / \u25BC on rows that
   own expandable / collapsible hidden content below them.
   =================================================================== */

/* EVERY row wraps counter + chevron in .deco-counter-row, even when no
   affordance applies. Identical DOM structure keeps the inline-formatting
   metrics (baseline alignment, whitespace handling) the same row-to-row,
   so the line-number digits land at the same x on every line. Only rows
   that carry [data-affordance-kind] are interactive \u2014 cursor / hover /
   focus styles scope to that attribute so non-interactive rows do not
   advertise themselves as clickable. */
.deco-counter-row {
    display: inline-block;
    border-radius: 2px;
}
.deco-counter-row[data-affordance-kind] {
    cursor: pointer;
}
.deco-counter-row[data-affordance-kind]:hover {
    background: var(--vscode-editor-hoverHighlightBackground, rgba(173, 214, 255, 0.15));
}
.deco-counter-row[data-affordance-kind]:hover .deco-chevron,
.deco-counter-row[data-affordance-kind]:focus-visible .deco-chevron {
    color: var(--vscode-foreground, #fff);
    opacity: 1;
}
.deco-counter-row[data-affordance-kind]:focus-visible {
    outline: 1px dotted var(--vscode-focusBorder);
    outline-offset: 1px;
}

/* The chevron itself: dimmed at rest so the line-number column reads as
   primary, the chevron as a quiet hint. Hover lifts to full opacity (rule
   above). Fixed inline-block width so \u25B6 and \u25BC occupy the same horizontal
   space \u2014 toggling state does not jitter the message column. */
.deco-chevron {
    display: inline-block;
    margin-left: 0.25em;
    width: 0.9em;
    text-align: center;
    color: var(--vscode-descriptionForeground, #888);
    opacity: 0.55;
    user-select: none;
    /* font-size 0.85em pulls the glyph slightly smaller than the counter
       digits so it reads as a marker on the number, not a competing
       second character at the same weight. */
    font-size: 0.85em;
}

/* Stack-header inline chevron is fully retired \u2014 toggle moved to the
   previous log line's counter-row chevron (kind="stack"). No CSS rule
   for the retired class lives here; the whole-row click handler in
   viewer-script-click-handlers.ts still toggles the trace on row click. */
`
  );
}

// src/ui/viewer-styles/viewer-styles-decoration.ts
function getDecorationStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Decoration Prefix & Settings
   Line decoration prefix (severity dot, counter, timestamp) and
   the settings popover panel for toggling individual parts.
   =================================================================== */
/* Decoration prefix (severity dot, counter, timestamp) \u2014 scale with zoom via em */
.line-decoration {
    font-size: 0.85em;
    color: var(--vscode-editorLineNumber-foreground, #858585);
    white-space: nowrap;
    user-select: none;
}

/* Clickable metadata filter toggles (PID, TID, tag) in the decoration prefix. */
.meta-filter-toggle {
    cursor: pointer;
    border-radius: 2px;
    padding: 0 1px;
}
.meta-filter-toggle:hover {
    background: var(--vscode-editor-hoverHighlightBackground, rgba(173, 214, 255, 0.15));
    text-decoration: underline;
}
.deco-parsed-tag {
    color: var(--vscode-textLink-foreground, #3794ff);
    /* The tag column is a FIXED reservation (applyDecorationLayoutWidth adds a
       flat 7em for it). A long logcat tag \u2014 MediaSessionCompat, FlutterJNI,
       WindowExtensionsImpl \u2014 is wider than that, and with no clip it spilled
       straight over the start of the message text ("MediaSessionComCouldn't\u2026").
       inline-block + max-width + ellipsis pins it inside the reserved column;
       the full tag is still on the title tooltip. max-width is in the span's
       own 0.85em units, so ~6em of the parent \u2014 inside the 7em reservation. */
    display: inline-block;
    max-width: 7em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
}
.deco-pid-tid {
    opacity: 0.7;
}
.deco-level-prefix {
    font-weight: bold;
}

/* Hanging indent for decorated lines: overflow text aligns with content, not decoration. 13em scales with --log-font-size. */
/* When time/number are shown, reserve 1.25em left for severity bar (dot at 0.69em + 0.54em) so the bar does not cover the numbers. */
/* Stack-headers now render the same .line-decoration prefix (counter + chevron)
   as regular log rows so they get a clickable line-number column, instead of
   the prior bespoke .line-deco-spacer-only padding + inline chevron. */
/* Legacy hanging-indent model \u2014 scoped to :not(.cols) so rows migrated to the
   grid column model (plan 055) opt out cleanly while un-migrated paths keep it.
   Multi-frame stack headers are on the grid as of Phase 2, so .stack-header is
   scoped :not(.cols) too \u2014 otherwise this 14.25em padding + negative text-indent
   would apply on top of the grid and shove the header's columns off-screen. */
.line:not(.cols):has(.line-decoration),
.stack-header:not(.cols):has(.line-decoration) {
    padding-left: var(--deco-prefix-width-em, 14.25em); /* 1.25em bar clearance + dynamic decoration width */
    text-indent: calc(-1 * var(--deco-content-indent-em, 13em));
}
.line:not(.cols):has(.line-decoration) .line-decoration,
.stack-header:not(.cols):has(.line-decoration) .line-decoration {
    /* Pulled right of severity bar by padding; indent pulls decoration start to 1.25em */
    margin-right: 0;
    /* Fixed-width prefix column. The hanging-indent rule above already ASSUMES
       this span is exactly --deco-content-indent-em wide \u2014 text-indent is set to
       -(that width) so the message text lands at --deco-prefix-width-em. But the
       span was content-sized, so variable counter / timestamp / PID / TID / tag
       content drifted the column and pushed the message text a few ems
       line-to-line. Making the width explicit (display:inline-block + width)
       pins the column: the box is always exactly the reserved width, so the
       message text starts at the same x on every decorated line regardless of
       prefix content. No overflow:hidden \u2014 an inline-block flows subsequent
       content after its BOX edge even if content visually spills, so the rare
       wide PID/tag case can overlap slightly but never shifts the column (and
       this avoids the baseline shift overflow:hidden would introduce). The
       text-indent / padding-left model is otherwise unchanged, so wrapped SQL
       and error lines still align via the .line rule above.
       The /0.85 divisor: .line-decoration has font-size:0.85em, so 1em here is
       0.85em-of-parent. --deco-content-indent-em is expressed in parent ems (it
       drives the .line padding/text-indent), so to make THIS box exactly that
       parent-width we divide by 0.85. Same pattern as the art-block rule in
       viewer-styles-ascii-art.ts. --deco-content-indent-em is itself recomputed
       from the enabled decoration parts (applyDecorationLayoutWidth), so the
       column is only as wide as the parts actually shown. */
    display: inline-block;
    width: calc(var(--deco-content-indent-em, 13em) / 0.85);
    /* text-indent: 0 is REQUIRED, not cosmetic. text-indent is an inherited
       property; the .line rule sets a large negative text-indent for the
       hanging indent. While .line-decoration was display:inline it did not
       establish its own block formatting context, so the inherited negative
       indent never applied to its own content. As an inline-block it DOES \u2014
       without this reset the counter / timestamp / tag text inside is yanked
       ~--deco-content-indent-em to the left, off the visible row entirely. */
    text-indent: 0;
}
/* Emoji toggle buttons (decorations, audio, minimap) */
.emoji-toggle {
    background: none;
    border: 1px solid transparent;
    font-size: 14px;
    padding: 1px 4px;
    cursor: pointer;
    border-radius: 3px;
    transition: opacity 0.15s;
}
.emoji-toggle.toggle-inactive {
    opacity: 0.35;
}
.emoji-toggle:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
#deco-toggle {
    /* inherits .emoji-toggle */
}
#deco-settings-btn {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 4px;
    cursor: pointer;
    border-radius: 3px;
}
/* Decoration settings popover panel */
.deco-settings-panel {
    display: none;
    position: fixed;
    z-index: 180;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    min-width: 180px;
    padding: 4px 0;
    font-size: 12px;
}
.deco-settings-panel.visible { display: block; }
.deco-settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: bold;
    color: var(--vscode-foreground);
    border-bottom: 1px solid var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
}
.deco-settings-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
}
.deco-settings-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.deco-settings-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
    cursor: default;
}
.deco-settings-row:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
}
.deco-settings-row.deco-indent {
    padding-left: 24px;
    font-size: 11px;
}
.deco-settings-row input[type="checkbox"] {
    accent-color: var(--vscode-button-background);
}
.deco-settings-row select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 2px;
}
.deco-settings-separator {
    height: 1px;
    background: var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
    margin: 4px 8px;
}
` + getDecorationBarStyles() + getCollapseControlStyles()
  );
}

// src/ui/viewer-styles/viewer-styles-edit-modal.ts
function getEditModalStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Edit Line Modal
   Modal dialog for editing a log line and saving changes to file.
   =================================================================== */
.edit-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 400;
}

.edit-modal-content {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 0;
    min-width: 500px;
    max-width: 80vw;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
}

.edit-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: 500;
    font-size: 13px;
}

.edit-modal-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.edit-modal-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.edit-warning {
    background: var(--vscode-inputValidation-warningBackground, rgba(252, 192, 0, 0.15));
    color: var(--vscode-inputValidation-warningForeground, #fc0);
    padding: 8px 16px;
    font-size: 11px;
    border-bottom: 1px solid var(--vscode-inputValidation-warningBorder, rgba(252, 192, 0, 0.3));
}

#edit-modal-textarea {
    width: 100%;
    min-height: 100px;
    padding: 12px 16px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: none;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    resize: vertical;
    outline: none;
}

#edit-modal-textarea:focus {
    background: var(--vscode-input-background);
    outline: 1px solid var(--vscode-focusBorder);
}

.edit-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--vscode-panel-border);
}

.edit-modal-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
}

.edit-modal-save {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}

.edit-modal-save:hover {
    background: var(--vscode-button-hoverBackground);
}

.edit-modal-cancel {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}

.edit-modal-cancel:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-modal.ts
function getModalStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Export Modal
   Modal dialog for exporting logs with level-based filtering and
   preset templates (Errors Only, Full Debug, etc.).
   =================================================================== */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    align-items: center;
    justify-content: center;
    z-index: 400;
}
.modal.visible { display: flex; }

.modal-content {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 0;
    min-width: 450px;
    max-width: 600px;
    max-height: 80vh;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: 500;
    font-size: 13px;
}

.modal-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    line-height: 1;
}
.modal-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.modal-body {
    padding: 16px;
    overflow-y: auto;
    max-height: 60vh;
}

/* Export accordion \u2014 collapsible sections with selection counts */
.export-accordion {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px;
    margin-bottom: 8px;
}
.export-accordion-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    background: var(--vscode-sideBar-background, var(--vscode-panel-background));
    border: none;
    color: var(--vscode-foreground);
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.export-accordion-header:hover {
    background: var(--vscode-list-hoverBackground);
}
.export-accordion-arrow {
    font-size: 14px;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}
.export-accordion.expanded .export-accordion-arrow {
    transform: rotate(90deg);
}
.export-accordion-title { font-weight: 600; }
.export-accordion-summary {
    flex: 1;
    text-align: right;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    text-transform: none;
    letter-spacing: normal;
}
.export-accordion-body {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    padding: 0 8px;
    transition: max-height 0.2s ease, opacity 0.2s ease,
                padding-top 0.15s ease, padding-bottom 0.15s ease;
}
.export-accordion.expanded .export-accordion-body {
    max-height: 300px;
    opacity: 1;
    padding: 4px 8px 8px;
}

@media (prefers-reduced-motion: reduce) {
    .export-accordion-arrow,
    .export-accordion-body { transition: none !important; }
}

.export-section {
    margin-bottom: 16px;
}
.export-section h4 {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.export-section select {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 6px 8px;
    border-radius: 2px;
    font-size: 12px;
    cursor: pointer;
}

.export-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    cursor: pointer;
    font-size: 12px;
}
.export-checkbox input[type="checkbox"] {
    accent-color: var(--vscode-button-background);
}
.export-checkbox:hover {
    color: var(--vscode-foreground);
}

#export-preview {
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
    border-left: 2px solid var(--vscode-textBlockQuote-border, #007acc);
    padding: 8px 12px;
    border-radius: 2px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

#export-line-count {
    font-weight: 600;
    color: var(--vscode-foreground);
}

.modal-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--vscode-panel-border);
}
.modal-footer-spacer { flex: 1; }

.modal-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.modal-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

.modal-btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.modal-btn-primary:hover {
    background: var(--vscode-button-hoverBackground);
}

/* Log file path actions (footer filename) */
.log-file-modal-content {
    min-width: 320px;
    max-width: 440px;
}
.log-file-modal-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
    padding-bottom: 16px;
}
.log-file-modal-btn {
    width: 100%;
    text-align: center;
}
/* Filename shown above the copy actions so users see what will be copied.
   word-break keeps very long names from forcing horizontal scroll. */
.log-file-modal-filename {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
    padding: 6px 10px;
    border-radius: 2px;
    margin-bottom: 4px;
    word-break: break-all;
    user-select: text;
}
/* Dim separator between Copy group and Open group. Uses panel-border at lowered
   opacity so it sits quieter than .modal-header's full-strength border. */
.log-file-modal-divider {
    border: none;
    border-top: 1px solid var(--vscode-panel-border);
    opacity: 0.5;
    margin: 4px 0;
}

/* Files dialog (cumulative cross-session feed, plan 057). Reuses .modal + .modal-btn;
   rows lay out the letter badge, filename, and per-file meta on one line. */
.files-list-modal-content {
    min-width: 340px;
    max-width: 520px;
}
.files-list-modal-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
    padding-bottom: 12px;
    max-height: 50vh;
    overflow-y: auto;
}
.files-list-modal-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    text-align: left;
}
/* Monospace letter chip so A/B/\u2026 line up and read as the gutter code they mirror. */
.files-list-letter {
    font-family: var(--vscode-editor-font-family, monospace);
    font-weight: 600;
    min-width: 2.2em;
    color: var(--vscode-textLink-foreground);
}
.files-list-name {
    flex: 1 1 auto;
    word-break: break-all;
}
.files-list-meta {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}
/* Footer (n) counter: a quiet, clickable affordance next to the filename. */
.footer-file-count {
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
}
.footer-file-count:hover {
    text-decoration: underline;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-session-info-modal.ts
function getSessionInfoModalStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Session Info Modal \u2014 structured view of the SAROPA LOG CAPTURE header
   (sections, indenting, hotlinks, long-press copy).
   =================================================================== */
.session-info-modal-content {
    min-width: 480px;
    max-width: 720px;
}
.session-info-modal-body { padding: 12px 16px 16px; }
.session-info-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.session-info-section {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px;
    background: var(--vscode-sideBar-background, var(--vscode-panel-background));
}
.session-info-section-title {
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    user-select: none;
    list-style: none;
}
.session-info-section-title::-webkit-details-marker { display: none; }
.session-info-section-title::before {
    content: "\u25B6";
    display: inline-block;
    width: 12px;
    margin-right: 4px;
    font-size: 9px;
    transition: transform 0.15s ease;
}
.session-info-section[open] > .session-info-section-title::before {
    transform: rotate(90deg);
}
.session-info-section-body {
    padding: 4px 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
/* Each row holds a key + value. Long-press anywhere on the row copies the
   full text \u2014 the cursor hint signals the row is interactive. */
.session-info-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 3px 4px;
    border-radius: 2px;
    font-size: 12px;
    line-height: 1.45;
    cursor: copy;
}
.session-info-row:hover { background: var(--vscode-list-hoverBackground); }
.session-info-key {
    flex: 0 0 auto;
    min-width: 140px;
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
    user-select: text;
}
.session-info-value {
    flex: 1 1 auto;
    color: var(--vscode-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    word-break: break-all;
    user-select: text;
}
/* Sub-keys under launch.json sit at a deeper indent so the nesting is
   visible at a glance. The launch.json row itself stays at the standard
   width because it is the first row in its section. */
.session-info-section-body .session-info-row:not(:first-child) .session-info-key {
    padding-left: 14px;
}
.session-info-link {
    color: var(--vscode-textLink-foreground);
    text-decoration: none;
}
.session-info-link:hover { text-decoration: underline; }
.session-info-details {
    flex: 1 1 auto;
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--vscode-foreground);
}
.session-info-details > summary {
    cursor: pointer;
    user-select: text;
    list-style: none;
    word-break: break-all;
}
.session-info-details > summary::-webkit-details-marker { display: none; }
.session-info-details > summary::after {
    content: "  \u2026";
    color: var(--vscode-descriptionForeground);
}
.session-info-details[open] > summary::after { content: ""; }
.session-info-details-body {
    margin-top: 4px;
    padding: 6px 8px;
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
    border-left: 2px solid var(--vscode-textBlockQuote-border, #007acc);
    border-radius: 2px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    word-break: break-all;
    user-select: text;
}
.session-info-empty {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    padding: 8px 4px;
}
.session-info-hint {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    opacity: 0.85;
}
/* Toolbar (i) button sits between session-details-inline and the filename so
   it reads as a sibling of the filename, not part of the nav cluster. */
.session-info-btn { margin-right: 4px; }
`
  );
}

// src/ui/viewer-styles/viewer-styles-overlays.ts
function getOverlayStyles() {
  return getDecorationStyles() + getEditModalStyles() + getModalStyles() + getSessionInfoModalStyles() + getContextMenuStyles() + /* css */
  `

/* ===================================================================
   Navigation Bars (Split Breadcrumb + Session Nav)
   Shared styles for the split-part breadcrumb and session prev/next
   navigation bar. Both use the same layout and button styling.
   =================================================================== */
/* Session nav wrapper removed \u2014 toolbar replaces the old smart-sticky header. */
.compress-suggest-banner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
    padding: 4px 8px 6px;
    font-size: 11px;
    line-height: 1.35;
    color: var(--vscode-foreground);
    background: var(--vscode-inputValidation-infoBackground, rgba(55, 148, 255, 0.12));
    border-top: 1px solid var(--vscode-inputValidation-infoBorder, var(--vscode-focusBorder));
}
.compress-suggest-msg {
    flex: 1 1 180px;
    min-width: 0;
}
.compress-suggest-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 2px;
    padding: 2px 10px;
    font-size: 11px;
    cursor: pointer;
}
.compress-suggest-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.compress-suggest-dismiss {
    background: transparent;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
    border-radius: 2px;
}
.compress-suggest-dismiss:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground);
}
.resume-session-banner {
    display: flex;
    align-items: center;
    gap: 6px 10px;
    padding: 4px 8px 6px;
    font-size: 11px;
    line-height: 1.35;
    color: var(--vscode-foreground);
    background: var(--vscode-inputValidation-infoBackground, rgba(55, 148, 255, 0.12));
    border-top: 1px solid var(--vscode-inputValidation-infoBorder, var(--vscode-focusBorder));
}
.resume-session-msg { flex: 0 0 auto; }
.resume-session-action {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 2px;
    padding: 2px 10px;
    font-size: 11px;
    cursor: pointer;
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.resume-session-action:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.resume-session-dismiss {
    background: transparent;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
    border-radius: 2px;
    margin-left: auto;
}
.resume-session-dismiss:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground);
}
.session-details-inline {
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid var(--vscode-panel-border);
    min-width: 0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
}
.session-perf-chip {
    margin-left: 8px;
    padding: 2px 6px;
    font-size: 10px;
    color: var(--vscode-textLink-foreground, #3794ff);
    background: var(--vscode-textLinkActiveBackground, rgba(55, 148, 255, 0.2));
    border: 1px solid var(--vscode-textLink-foreground, #3794ff);
    border-radius: 3px;
    cursor: pointer;
}
.session-perf-chip:hover {
    text-decoration: underline;
}
#split-breadcrumb {
    display: none;
    align-items: center;
    flex-wrap: wrap;
    row-gap: 4px;
    column-gap: 4px;
    padding: 2px 8px;
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}
#split-breadcrumb.visible { display: flex; }
#run-nav {
    display: none;
    align-items: center;
    gap: 4px;
}
#run-nav.visible { display: flex; }
.nav-bar-sep {
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
    margin: 0 2px;
    user-select: none;
}
.nav-bar-label { font-weight: bold; }
/* Only prev/next (and run nav inside the same strip)\u2014not the compact find widget or perf chip. */
#split-breadcrumb button,
#run-nav button {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}
#split-breadcrumb button:hover,
#run-nav button:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
#split-breadcrumb button:disabled,
#run-nav button:disabled {
    opacity: 0.4;
    cursor: default;
}

/* ===================================================================
   JSON Collapsible Blocks
   Inline expandable JSON objects in log output. Toggle between
   a compact one-line preview and full formatted expansion.
   =================================================================== */
.json-collapsible { display: inline; }
.json-toggle {
    cursor: pointer;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-family: sans-serif;
    font-size: 10px;
    padding: 0 4px;
    user-select: none;
}
.json-toggle:hover { color: var(--vscode-textLink-activeForeground, #3794ff); }
/* Collapsed: shows truncated preview text */
.json-preview {
    color: var(--vscode-descriptionForeground);
    font-size: 0.95em;
}
/* Expanded: full formatted JSON in a quote block */
.json-expanded {
    display: block;
    margin: 4px 0 4px 16px;
    padding: 4px 8px;
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
    border-left: 2px solid var(--vscode-textBlockQuote-border, #007acc);
    font-size: 0.95em;
    line-height: 1.4;
    white-space: pre;
    overflow-x: auto;
}
.json-expanded.hidden { display: none; }
.json-preview.hidden { display: none; }
`;
}

// src/ui/viewer-styles/viewer-styles-tags.ts
function getTagStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Source Tag Strip (legacy container, kept for reusable chip styles)
   =================================================================== */
.source-tag-strip {
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
.source-tag-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    user-select: none;
}
.source-tag-header:hover {
    background: var(--vscode-list-hoverBackground);
}
.source-tag-chevron {
    font-size: 10px;
    width: 12px;
    text-align: center;
}
.source-tag-summary {
    font-size: 10px;
    opacity: 0.7;
    margin-left: auto;
}

/* --- Chip container: flex-wrap, shown when tags exist --- */
.source-tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px 6px;
    align-items: center;
}
/* Inside options panel, use tighter padding */
.source-tag-chips.options-tags {
    padding: 4px 0 2px;
}

/* --- Individual tag chip: pill-shaped toggle button --- */
.source-tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--vscode-descriptionForeground);
    background: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    white-space: nowrap;
    opacity: 0.5;
    transition: opacity 0.15s, background 0.15s;
}
.source-tag-chip.active {
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border-color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    opacity: 1;
}
.source-tag-chip:hover {
    background: var(--vscode-list-hoverBackground);
    opacity: 1;
}
.source-tag-chip.tag-overflow { display: none; }
.source-tag-chip .codicon { font-size: 11px; line-height: 1; }
.tag-count {
    font-size: 9px;
    opacity: 0.7;
    font-weight: bold;
}

/* --- All / None action links at the start of the chip row --- */
.source-tag-actions {
    display: flex;
    gap: 2px;
    margin-right: 4px;
}
.tag-action-btn {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-size: 10px;
    cursor: pointer;
    padding: 0 4px;
}
.tag-action-btn:hover {
    text-decoration: underline;
}

/* --- Show all / Show less toggle in tag sections --- */
.tag-show-all-btn {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 8px;
    width: 100%;
    text-align: center;
}
.tag-show-all-btn:hover { text-decoration: underline; }

/* --- Inline tag links in rendered log lines --- */
.tag-link {
    color: var(--tag-clr) !important;
    cursor: pointer;
    border-radius: 2px;
    padding: 0 1px;
    transition: background 0.1s, text-decoration 0.1s;
}
.tag-link:hover {
    text-decoration: underline;
    background: rgba(255, 255, 255, 0.08);
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-exclusion-chips.ts
function getExclusionChipStyles() {
  return (
    /* css */
    `
/* --- Exclusion pattern chips: removable pills in noise-reduction section --- */
.exclusion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 0 2px;
}
.exclusion-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    border: 1px solid var(--vscode-descriptionForeground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    white-space: nowrap;
    max-width: 100%;
    transition: opacity 0.15s;
}
.exclusion-chip-text {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}
.exclusion-chip-remove {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
}
.exclusion-chip-remove:hover {
    color: var(--vscode-errorForeground, #f44);
}
.exclusion-chips-disabled .exclusion-chip {
    opacity: 0.4;
}

/* --- Inline exclusion add input --- */
.exclusion-input-wrapper {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    margin: 4px 0;
}

/* Checkbox toggle inline with the exclusion text input */
.exclusion-toggle {
    display: flex;
    align-items: center;
    padding: 4px 2px 4px 6px;
    cursor: pointer;
    flex-shrink: 0;
}
.exclusion-toggle input[type="checkbox"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
    margin: 0;
}

.exclusion-input-wrapper:focus-within {
    border-color: var(--vscode-focusBorder);
}
#exclusion-add-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: var(--vscode-input-foreground);
    border: none;
    padding: 4px 8px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
}
#exclusion-add-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-left: 1px solid var(--vscode-input-border, transparent);
    font-size: 11px;
    padding: 4px 10px;
    cursor: pointer;
    flex-shrink: 0;
}
#exclusion-add-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Audio preview buttons */
.preview-sound-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 2px;
    margin-left: 4px;
}

.preview-sound-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Volume slider (range input) */
input[type="range"] {
    cursor: pointer;
    accent-color: var(--vscode-button-background);
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-options-extra.ts
function getOptionsExtraStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Integrations screen (dedicated view inside options panel)
   =================================================================== */
.integrations-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}
.integrations-view-hidden {
    display: none !important;
}
.shortcuts-view-hidden {
    display: none !important;
}
.integrations-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--vscode-sideBarTitle-background, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    font-weight: bold;
    font-size: 13px;
}
.integrations-back {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 4px;
    border-radius: 3px;
    font-size: 14px;
    transition: color 0.15s ease, background 0.15s ease;
}
.integrations-back:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.integrations-title { flex: 1; }
.integrations-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}
.integrations-intro {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.4;
    margin: 0 0 12px 0;
}
.integrations-search-wrapper {
    margin: 0 0 10px 0;
}
.integrations-search-wrapper input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--vscode-input-border, transparent);
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 12px;
}
.integrations-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 4px 8px;
    padding: 10px 0;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255, 255, 255, 0.1));
    cursor: pointer;
    font-size: 12px;
}
.integrations-row:hover {
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
}
.integrations-row {
    transition: background 0.15s ease;
}
.integrations-row input[type="checkbox"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
    flex-shrink: 0;
    margin-top: 2px;
}
.integrations-label {
    font-weight: 600;
    flex: 0 0 auto;
}
.integrations-desc {
    flex: 1 1 100%;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.35;
    margin: 4px 0 0 24px;
}
/* Multi-line ellipsis follows panel width; avoids a fixed character cut-off. */
.integrations-desc-collapsible .integrations-desc-preview {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    overflow: hidden;
}
.integrations-expanded-block .integrations-desc-full {
    display: block;
}
.integrations-desc-toggle {
    display: block;
    margin: 4px 0 0 0;
    border: none;
    background: none;
    color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    cursor: pointer;
    font-size: inherit;
    padding: 0;
    text-align: left;
}
.integrations-note {
    margin: 8px 0 0 0;
    font-size: inherit;
    font-weight: inherit;
    font-style: normal;
    color: inherit;
    line-height: inherit;
}
.integrations-perf { }
.integrations-perf-warning {
    margin: 0 3px 0 4px;
}
.integrations-when { }

/* Companion extensions section \u2014 links to related Saropa extensions above the adapter list. */
.integrations-companion-section {
    margin: 0 0 16px 0;
    padding: 0 0 12px 0;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255, 255, 255, 0.1));
}
.integrations-companion-heading {
    font-size: 12px;
    font-weight: 600;
    margin: 0 0 6px 0;
}
.integrations-companion-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    padding: 6px 0;
    font-size: 12px;
}
.integrations-companion-label {
    font-weight: 600;
    flex: 0 0 auto;
}
.integrations-companion-benefit {
    flex: 1 1 100%;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.35;
    margin: 2px 0 0 0;
}
.integrations-companion-link {
    font-size: 11px;
    color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    cursor: pointer;
    text-decoration: none;
    margin: 2px 0 0 0;
}
.integrations-companion-link:hover {
    text-decoration: underline;
}

/* Keyboard shortcuts view */
.shortcuts-h3 {
    font-size: 12px;
    font-weight: 600;
    margin: 16px 0 8px 0;
    color: var(--vscode-foreground);
}
.shortcuts-h3:first-of-type { margin-top: 0; }
.shortcuts-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 12px;
}
.shortcuts-table th,
.shortcuts-table td {
    padding: 4px 8px 4px 0;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255, 255, 255, 0.1));
}
.shortcuts-table th {
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
}
.shortcuts-table kbd {
    font-family: var(--vscode-editor-font-family, var(--monaco-monospace-font));
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--vscode-keybindingLabel-background, rgba(128, 128, 128, 0.2));
    border: 1px solid var(--vscode-keybindingLabel-border, rgba(128, 128, 128, 0.35));
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-options-severity-keywords.ts
function getSeverityKeywordsStyles() {
  return (
    /* css */
    `

/* Severity keywords display */
.severity-keywords-display {
    margin-bottom: 8px;
}
.sk-level-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 3px 0;
    font-size: 11px;
}
.sk-dot {
    width: 8px;
    height: 8px;
    min-width: 8px;
    border-radius: 50%;
    margin-top: 3px;
}
.sk-label {
    font-weight: 600;
    min-width: 80px;
    color: var(--vscode-foreground);
}
.sk-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
}
.sk-pill {
    background: var(--vscode-badge-background, rgba(90, 93, 94, 0.4));
    color: var(--vscode-badge-foreground, var(--vscode-foreground));
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    white-space: nowrap;
}
.sk-pills em {
    opacity: 0.5;
    font-size: 10px;
}

`
  );
}

// src/ui/viewer-styles/viewer-styles-options.ts
function getOptionsStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Options Panel
   Slide-out panel showing all viewer settings
   organized into logical sections.
   =================================================================== */
.options-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.options-panel.visible {
    display: flex;
}

.options-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--vscode-sideBarTitle-background, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    font-weight: bold;
    font-size: 13px;
}

.options-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.options-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.options-search-wrapper {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    padding: 4px 8px;
}
#filters-search,
#options-search {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: var(--vscode-input-foreground);
    border: none;
    padding: 3px 4px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
}
.options-search-clear {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    visibility: hidden;
}
.options-search-clear.visible { visibility: visible; }
.options-search-clear:hover { color: var(--vscode-errorForeground, #f44); }

.options-filtered-hidden { display: none !important; }

.options-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
}

.options-section {
    margin-bottom: 16px;
    padding: 0 12px;
}

.options-section-title {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 8px 0;
    padding: 0;
}

.options-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
    cursor: pointer;
}

.options-row input[type="checkbox"], .options-row input[type="radio"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
}
.scope-disabled { opacity: 0.4; pointer-events: none; }
.scope-suffix { opacity: 0.5; margin-left: 4px; font-style: italic; }

.options-row select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 2px;
    flex: 1;
}

.options-row:has(select) {
    cursor: default;
}

.options-row:hover:has(input[type="checkbox"]) {
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
}

/* Container for the tier source groups */
.tier-filter-list {
    padding: 6px 10px;
}
/* Tier radio groups (Flutter / Device / External) \u2014 radios below legend */
.tier-radio-group {
    border: none;
    margin: 0;
    padding: 8px 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    font-size: 12px;
}
.tier-radio-group legend {
    /* Legend sits on its own line above the radios */
    width: 100%;
    padding: 0 0 4px;
    font-weight: 600;
    font-size: 12px;
    color: var(--vscode-foreground);
}
/* Inline hint after the tier legend \u2014 explains what the tier includes */
.tier-hint {
    font-weight: normal;
    font-size: 11px;
    opacity: 0.6;
}
/* Vertical spacing before Device and External tiers */
.tier-radio-group-spaced {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--vscode-panel-border);
}
.tier-radio-group label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 12px;
    /* Indent radios under the legend */
    margin-left: 12px;
}
.tier-radio-group input[type="radio"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
    margin: 0;
}

.options-indent {
    margin-left: 20px;
    padding-left: 12px;
    border-left: 2px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
    transition: opacity 0.15s ease;
}

.options-row input:disabled + span,
.deco-settings-row input:disabled + span {
    opacity: 0.4;
}

/* Action buttons (Reset to default, Reset all, SQL Query History\u2026) */
.options-action-btn {
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.5));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 11px;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 3px;
}
.options-action-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, rgba(90, 93, 94, 0.7));
}

/* Hint/status text under a control */
.options-hint {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.8;
    padding: 0 0 4px 24px;
}

/* Log Sources: subheading before external source checkboxes */
.source-external-group-title {
    margin-top: 8px;
    padding-top: 4px;
    font-weight: 600;
    opacity: 0.95;
}

/* Code Location Scope: contextual warning when narrowing hides most lines */
.scope-filter-hint {
    margin-top: 6px;
    padding-left: 8px;
    border-left: 2px solid var(--vscode-editorWarning-foreground);
}
.scope-hint-reset-btn {
    margin-left: 8px;
    padding: 1px 6px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    font-size: 10px;
    cursor: pointer;
}
.scope-hint-reset-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Integrations button in options (opens Integrations screen) */
.options-integrations-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 12px;
    padding: 6px 12px;
    cursor: pointer;
    border-radius: 3px;
    text-align: left;
}
.options-integrations-btn:hover {
    background: var(--vscode-button-hoverBackground);
}
.options-integrations-btn .codicon { font-size: 14px; }

/* Hide options content when Integrations view is shown */
.options-content-hidden {
    display: none !important;
}

` + getOptionsExtraStyles() + getExclusionChipStyles() + getSeverityKeywordsStyles()
  );
}

// src/ui/viewer-styles/viewer-styles-errors.ts
function getErrorStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Error Flash Effect
   Red border flash when errors are detected.
   =================================================================== */
@keyframes error-flash {
    0%, 100% { box-shadow: none; }
    50% { box-shadow: inset 0 0 0 3px var(--vscode-errorForeground, #f44); }
}

#log-content.error-flash {
    animation: error-flash 0.3s ease-in-out;
}

/* ===================================================================
   Error Badge
   Shows count of new errors in footer.
   =================================================================== */
#error-badge {
    display: none;
    cursor: pointer;
    color: var(--vscode-errorForeground, #f44);
    font-weight: bold;
    margin-right: 4px;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--vscode-errorBackground, rgba(244, 68, 68, 0.1));
    font-size: 10px;
    transition: background 0.2s ease;
}

#error-badge:hover {
    background: var(--vscode-errorBackground, rgba(244, 68, 68, 0.2));
}

/* ===================================================================
   Error Modal
   Popup alert when errors are detected.
   =================================================================== */
.error-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 300;
    align-items: center;
    justify-content: center;
}

.error-modal.visible {
    display: flex;
}

.error-modal-content {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-errorForeground, #f44);
    border-radius: 4px;
    padding: 16px;
    max-width: 400px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.error-modal-content h3 {
    margin: 0 0 8px 0;
    color: var(--vscode-errorForeground, #f44);
    font-size: 14px;
}

.error-modal-content p {
    margin: 0 0 12px 0;
    font-size: 12px;
}

.error-modal-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 12px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
}

.error-modal-btn:hover {
    background: var(--vscode-button-hoverBackground);
}

/* Error breakpoint toggle button */
#error-breakpoint-toggle {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}

#error-breakpoint-toggle:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-icon-bar.ts
function getIconBarStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Icon Bar \u2014 vertical activity bar (default: left side)
   =================================================================== */
:root {
    /* VS Code's native activity bar is 48px; 44px gives 6px horizontal
       breathing room around the 32px icon buttons without wasting log space. */
    --icon-bar-width: 44px;
    --icon-bar-width-with-labels: 140px;
}

#icon-bar {
    width: var(--icon-bar-width);
    min-width: var(--icon-bar-width);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 4px;
    gap: 3px;
    background: var(--vscode-activityBar-background, var(--vscode-sideBar-background, var(--vscode-panel-background)));
    border-right: 1px solid var(--vscode-activityBar-border, var(--vscode-panel-border));
    transition: width 0.15s ease;
    cursor: pointer;
    overflow-y: auto;
    overflow-x: hidden;
}

#icon-bar.ib-labels-visible {
    width: var(--icon-bar-width-with-labels);
    min-width: var(--icon-bar-width-with-labels);
    align-items: stretch;
}

.ib-label {
    display: none;
    margin-left: 6px;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
}

#icon-bar.ib-labels-visible .ib-label {
    display: inline;
}

.ib-icon {
    width: 32px;
    height: 32px;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--vscode-activityBar-inactiveForeground, var(--vscode-descriptionForeground));
    cursor: pointer;
    border-radius: 4px;
    position: relative;
    transition: color 0.15s;
}

#icon-bar.ib-labels-visible .ib-icon {
    width: auto;
    min-width: 32px;
    justify-content: flex-start;
    padding-left: 8px;
    padding-right: 8px;
}

.ib-icon:hover {
    color: var(--vscode-activityBar-foreground, var(--vscode-foreground));
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.ib-icon.ib-active {
    color: var(--vscode-activityBar-foreground, var(--vscode-foreground));
}

/* Active indicator bar on inner edge (right when bar is on left). */
.ib-icon.ib-active::before {
    content: '';
    position: absolute;
    right: 0;
    top: 4px;
    bottom: 4px;
    width: 2px;
    background: var(--vscode-activityBar-activeBorder, var(--vscode-focusBorder));
    border-radius: 1px;
}

.ib-icon .codicon {
    font-size: 18px;
}

.ib-badge {
    display: none;
    position: absolute;
    top: 2px;
    left: 2px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    font-size: 9px;
    font-weight: 600;
    line-height: 14px;
    text-align: center;
    border-radius: 7px;
    background: var(--vscode-activityBarBadge-background, #007acc);
    color: var(--vscode-activityBarBadge-foreground, #fff);
    pointer-events: none;
}

/* When labels are visible, the inline "(N)" count beside each label already shows the number,
   so suppress the overlay badge to avoid double-counting on every icon.
   !important is required because updateIconBadge() sets display via inline style. */
#icon-bar.ib-labels-visible .ib-badge {
    display: none !important;
}

/* Inline count shown next to label text when labels are visible, e.g. "Signals (32)".
   Dimmed and smaller than the label to avoid visual clutter. */
.ib-count {
    font-size: 0.85em;
    font-weight: 400;
    opacity: 0.55;
}

/* ===================================================================
   Right-side overrides \u2014 icon bar
   =================================================================== */
body[data-icon-bar="right"] #icon-bar {
    border-right: none;
    border-left: 1px solid var(--vscode-activityBar-border, var(--vscode-panel-border));
}
body[data-icon-bar="right"] .ib-icon.ib-active::before {
    right: auto; left: 0;
}
body[data-icon-bar="right"] .ib-badge {
    left: auto; right: 2px;
}

/* ===================================================================
   Right-side overrides \u2014 all slide-out panels
   =================================================================== */
/* --- Icon bar separator ---
   Previously used activityBar-inactiveForeground (which in Dark+ is already ~40% alpha)
   plus an additional opacity: 0.4, giving ~0.16 effective alpha \u2014 invisible against the
   activity-bar background. Use activityBar-border (the same var as the bar's own edge)
   and drop the extra opacity so the rule is actually visible in all themes. */
.ib-separator {
    width: 20px;
    height: 1px;
    flex: 0 0 1px;
    background: var(--vscode-activityBar-border, var(--vscode-panel-border, var(--vscode-contrastBorder, rgba(128, 128, 128, 0.35))));
    margin: 5px 0;
}
#icon-bar.ib-labels-visible .ib-separator {
    width: 100%;
    margin-left: 0;
    margin-right: 0;
}


/* Crashlytics icon hidden until integrations.adapters includes "crashlytics". */
#ib-crashlytics {
    display: none;
}
#ib-crashlytics.ib-integration-enabled {
    display: flex;
}

/* Performance icon hidden until integrations.adapters includes "performance". */
#ib-performance {
    display: none;
}
#ib-performance.ib-integration-enabled {
    display: flex;
}

/* SQL filter button removed from icon bar \u2014 filters live in the toolbar drawer now. */

body[data-icon-bar="right"] #panel-slot > * {
    border-right: none;
    border-left: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3);
}
body[data-icon-bar="right"] .panel-slot-resize {
    left: -3px; right: auto;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-session-panel.ts
function getSessionPanelLayoutStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Session Panel \u2014 slide-out (same pattern as search/options)
   =================================================================== */
.session-panel {
    width: 100%;
    /* Allow 25 % narrower than the 560 px default so users with tight layouts
       can reclaim horizontal space via the resize handle. */
    min-width: 420px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.session-panel.visible {
    display: flex;
}

.session-panel-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.session-header-clickable {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
}

.session-header-clickable:hover {
    color: var(--vscode-textLink-foreground);
}

.session-header-clickable:hover .session-header-path {
    color: var(--vscode-textLink-foreground);
    text-decoration: underline;
}

.session-panel-title {
    flex-shrink: 0;
}

.session-header-path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
}

/* Separator dot excluded from selection when user selects the path. */
.session-path-sep {
    user-select: none;
}

.session-panel-actions {
    display: flex;
    gap: 4px;
    align-items: center;
}

.session-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.session-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.session-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.session-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* Anchor for the kebab options popover (defined in viewer-styles-session-options.ts).
   The popover positions itself relative to the header via top:100%, so the header
   MUST be the nearest positioned ancestor \u2014 without this it falls through to the
   document body and lands in the wrong corner. */
.session-panel-header { position: relative; }

.session-panel-content {
    flex: 1;
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
}

/* --- Collections section --- */
.session-collections {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBarSectionHeader-background, transparent);
}
.session-collections-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 2px;
}
.session-collections-hint {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 6px 0;
    line-height: 1.3;
}
.session-collections-list {
    margin-bottom: 6px;
}
.session-collections-create-row {
    margin-bottom: 0;
}
.session-collections-create-form {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.session-collections-name-input {
    font-size: 12px;
    padding: 4px 8px;
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    width: 100%;
    box-sizing: border-box;
}
.session-collections-name-input:focus {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
}
.session-collections-create-form-actions {
    display: flex;
    gap: 6px;
}
.session-collections-create-confirm {
    font-size: 12px;
    padding: 4px 10px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    cursor: pointer;
}
.session-collections-create-confirm:hover {
    background: var(--vscode-button-hoverBackground);
}
.session-collections-create-confirm:disabled {
    opacity: 0.6;
    cursor: default;
}
.session-collections-name-input:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}
.session-collections-create-cancel {
    font-size: 12px;
    padding: 4px 10px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    cursor: pointer;
}
.session-collections-create-cancel:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.session-collections-create-error {
    font-size: 11px;
    color: var(--vscode-errorForeground);
}
.session-collection-item {
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    border-radius: 3px;
}
.session-collection-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.session-collection-item.session-collection-active {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.session-collection-check {
    margin-left: 4px;
    font-weight: bold;
}
.session-collections-create {
    font-size: 12px;
    padding: 4px 8px;
    background: none;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
}
.session-collections-create:hover {
    background: var(--vscode-toolbar-hoverBackground);
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-session-list.ts
function getSessionListStyles() {
  return (
    /* css */
    `

/* --- Session list items --- */
.session-item {
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.session-item:hover {
    background: var(--vscode-list-hoverBackground);
}

.session-item-selected {
    background: var(--vscode-list-inactiveSelectionBackground, var(--vscode-list-hoverBackground));
}
.session-item-selected:hover {
    background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
}

.session-item-active .session-item-icon .codicon {
    color: var(--vscode-charts-red, #f44336);
}

/* Recent-updates indicators: orange = new since last viewed, red = updated in last minute */
.session-item-update-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-left: 4px;
    flex-shrink: 0;
    vertical-align: middle;
    transition: opacity 0.15s ease;
}
.session-item-updated-recent .session-item-update-dot { background: var(--vscode-charts-red, #f44336); }
.session-item-updated-since-viewed .session-item-update-dot { background: var(--vscode-charts-orange, #e65100); }

.session-item-icon {
    user-select: none;
    display: inline-flex;
    align-items: center;
}
.session-item-icon .codicon {
    font-size: 14px;
    margin-top: 2px;
}

.session-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.session-item-name {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.session-item-perf {
    display: inline-flex;
    margin-left: 4px;
    vertical-align: middle;
    color: var(--vscode-charts-purple, #b267e6);
    font-size: 12px;
}
.session-item-perf .codicon { font-size: 12px; }

.session-item-loaded {
    display: inline-flex;
    margin-left: 4px;
    vertical-align: middle;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
}
.session-item-loaded .codicon { font-size: 12px; }

.session-item-meta {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* --- Row hover actions (reveal in OS, etc.) --- */
/* Container sits beside the info column. Hidden by default; revealed on row hover
   or keyboard focus. Rendered inline so it participates in the flex row without
   overlaying the meta text. */
.session-item-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.1s ease;
    pointer-events: none;
}
.session-item:hover .session-item-actions,
.session-item:focus-within .session-item-actions {
    opacity: 1;
    pointer-events: auto;
}
.session-item-action {
    background: transparent;
    border: none;
    padding: 2px 4px;
    cursor: pointer;
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
}
.session-item-action:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.session-item-action .codicon {
    font-size: 14px;
}

/* --- Latest suffix --- */
.session-latest { opacity: 0.5; font-style: italic; font-size: 11px; margin-left: 3px; }

/* --- Day headings (collapsible) --- */
.session-day-heading {
    padding: 6px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-textLink-foreground, #3794ff);
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    position: sticky;
    top: 0;
    z-index: 1;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 4px;
}
.session-day-heading:hover {
    background: var(--vscode-list-hoverBackground);
}
.session-day-chevron {
    font-size: 12px;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}
/* File count shown dimmed in parentheses beside the date label. */
.session-day-count {
    font-weight: 400;
    opacity: 0.5;
}

/* Collapsed day group: hide session items. */
.session-day-group.collapsed > .session-day-items {
    display: none;
}

/* Reports bucket / newer-log banner / per-row unread-dot styles live in
   viewer-styles-session-newer.ts \u2014 composed alongside this stylesheet by
   viewer-styles-session.ts. Extracted to keep this file under the 300-line limit. */

/* --- Session list pagination --- */
.session-list-pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-top: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    flex-shrink: 0;
    transition: opacity 0.15s ease;
}
.session-list-pagination-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-right: auto;
}
.session-list-pagination-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border-radius: 2px;
    cursor: pointer;
}
.session-list-pagination-btn:hover:not(:disabled) {
    background: var(--vscode-button-secondaryHoverBackground);
}
.session-list-pagination-btn:disabled {
    opacity: 0.5;
    cursor: default;
}

/* --- Filtered-empty hint (shown when filters produce zero results) --- */
.session-empty-filtered {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

/* --- Name filter bar --- styles live in viewer-styles-session-name-filter.ts,
   extracted to keep this file under the 300-line limit. Composed alongside this
   stylesheet by viewer-styles-session.ts in the same <style> block. */

/* --- Session context menu --- */
/* overflow must stay "visible" \u2014 the Copy and Export flyout submenus are absolutely-positioned
   children and would be clipped by "overflow: auto". The menu is compact enough (\u226413 items) that
   scrolling is unnecessary; the show() logic clamps the menu's top/left to the viewport instead. */
.session-context-menu {
    display: none; position: fixed; z-index: 300;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    padding: 4px 0; min-width: 180px; overflow: visible;
}
.session-context-menu.visible { display: block; }
/* Flip submenu to open leftward when the parent menu is near the right edge of the viewport.
   Mirrors the .context-menu.flip-submenu rule used by the line context menu. */
.session-context-menu.flip-submenu .context-menu-submenu-content { left: auto; right: 100%; }

/* --- Severity dots --- */
.sev-dots { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; color: var(--vscode-descriptionForeground); vertical-align: middle; }
.sev-pair { display: inline-flex; align-items: center; gap: 2px; }
.sev-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.sev-error { background: var(--vscode-charts-red, #f44336); }
.sev-warning { background: var(--vscode-charts-yellow, #ffc107); }
.sev-perf { background: var(--vscode-charts-purple, #a855f7); }
/* Framework reads as "neutral background activity" \u2014 pick a hue that does not
   collide with Info (also blue). Charts-foreground is theme-neutral and keeps
   the dot legible without competing with the Info/Notice/Database trio. */
.sev-fw { background: var(--vscode-charts-foreground, #cccccc); }
/* Info dot follows the level palette: Info=blue (rotated from green when the
   level palette became Info=blue / Notice=cyan / Database=green). */
.sev-info { background: var(--vscode-charts-blue, #2196f3); }
/* Debug / Database / Todo / Notice colors mirror the viewer's top-bar palette
   so the same file reads consistently across the list badge and the open log. */
.sev-debug { background: var(--vscode-charts-foreground, #aaaaaa); opacity: 0.7; }
.sev-database { background: var(--vscode-charts-green, #4caf50); }
.sev-todo { background: var(--vscode-charts-orange, #ff9800); }
.sev-notice { background: var(--vscode-charts-cyan, #00bcd4); }
.sev-other { background: var(--vscode-descriptionForeground, #888); opacity: 0.5; }
`
  );
}

// src/ui/viewer-styles/viewer-styles-session-name-filter.ts
function getSessionNameFilterStyles() {
  return (
    /* css */
    `

/* --- Name filter bar --- */
.session-name-filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: var(--vscode-editorInfo-background, rgba(55, 148, 255, 0.1));
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-foreground);
}
.session-name-filter-label {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
/* Pills wrap onto multiple rows as names accumulate, and take the flexible width
   so the verb label and "Show All" button keep their natural size at the ends. */
.session-name-filter-pills {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.session-name-filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    padding: 1px 2px 1px 6px;
    border-radius: 9px;
    background: var(--vscode-badge-background, rgba(120, 120, 120, 0.3));
    color: var(--vscode-badge-foreground, var(--vscode-foreground));
}
.session-name-filter-pill-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.session-name-filter-pill-remove {
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    padding: 1px;
    margin: 0;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    border-radius: 50%;
}
.session-name-filter-pill-remove:hover {
    opacity: 1;
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.session-name-filter-pill-remove .codicon {
    font-size: 12px;
}
.session-name-filter-clear {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: none;
    border: 1px solid var(--vscode-button-border, transparent);
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    flex-shrink: 0;
}
.session-name-filter-clear:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
/* Verb word ("Hiding:" / "Showing only:") now sits between the dropdown-filter chips and the
   name pills, so it gets its own non-shrinking span instead of riding inside the lead label. */
.session-name-filter-verb {
    flex-shrink: 0;
}

/* --- Dropdown-filter chips (date range, minimum size) ---
 * Same removable-pill affordance as the name pills so the user learns one interaction, but a
 * distinct neutral fill so "a value I picked from a menu" reads differently from "a name I hid".
 * The [x] resets that dropdown to its 'all' default (see clearFilterOption). */
.session-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    padding: 1px 2px 1px 6px;
    border-radius: 9px;
    background: var(--vscode-badge-background, rgba(120, 120, 120, 0.3));
    color: var(--vscode-badge-foreground, var(--vscode-foreground));
}
.session-filter-chip .codicon {
    font-size: 12px;
    opacity: 0.8;
}
.session-filter-chip-remove {
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    padding: 1px;
    margin: 0;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    border-radius: 50%;
}
.session-filter-chip-remove:hover {
    opacity: 1;
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.session-filter-chip-remove .codicon {
    font-size: 12px;
}

/* Kebab (\u22EE) "active filters" dot: a small accent dot on the options button when any filter
   (date / size / name) is non-default, so the user sees filters are on even after the bar
   scrolls away and knows where to adjust them. Toggled in renderNameFilterBar on every render. */
.session-panel-action.has-active-filters {
    position: relative;
}
.session-panel-action.has-active-filters::after {
    content: '';
    position: absolute;
    top: 3px;
    right: 3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--vscode-textLink-foreground, #3794ff);
    border: 1px solid var(--vscode-sideBar-background, var(--vscode-editor-background));
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-session-tags-loading.ts
function getSessionTagsLoadingStyles() {
  return (
    /* css */
    `

/* --- Session tag chips (correlation filters: file/error tags across sessions) --- */
.session-tags-section {
    padding: 6px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
    min-height: 0;
}
.session-tags-section .session-tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    max-height: 4.8em;
    overflow-y: auto;
    overflow-x: hidden;
}
.session-tags-section .source-tag-chip {
    border: none;
    background: var(--vscode-badge-background, rgba(128, 128, 128, 0.25));
    color: var(--vscode-badge-foreground, var(--vscode-foreground));
}
.session-tags-section .source-tag-chip.active {
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
}
.session-tags-section .source-tag-chip .tag-label {
    display: inline-block;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.session-tags-section .tag-count {
    flex-shrink: 0;
}

/* --- Empty / loading states --- */
.session-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.session-loading {
    padding: 12px 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.session-loading-bar {
    height: 4px;
    background: var(--vscode-progressBar-background, rgba(128, 128, 128, 0.2));
    border-radius: 2px;
    overflow: hidden;
}

.session-loading-bar-fill {
    height: 100%;
    width: 40%;
    background: var(--vscode-progressBar-foreground, var(--vscode-focusBorder, #3794ff));
    border-radius: 2px;
    animation: session-progress-indeterminate 1.2s ease-in-out infinite;
}

.session-loading-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

.session-loading-shimmer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
}

.session-shimmer-line {
    height: 36px;
    border-radius: 4px;
    background: var(--vscode-sideBar-background, #252526);
    position: relative;
    overflow: hidden;
}

.session-shimmer-line::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--vscode-widget-border, rgba(255, 255, 255, 0.08)) 45%,
        var(--vscode-focusBorder, rgba(255, 255, 255, 0.12)) 50%,
        var(--vscode-widget-border, rgba(255, 255, 255, 0.08)) 55%,
        transparent 100%
    );
    background-size: 200% 100%;
    animation: session-shimmer 1.8s ease-in-out infinite;
}

.session-shimmer-line-short {
    width: 60%;
}

/* Per-item shimmer for metadata line during preview loading */
.session-shimmer-meta {
    display: block;
    height: 10px;
    width: 60%;
    margin-top: 4px;
    border-radius: 3px;
    background: var(--vscode-sideBar-background, #252526);
    position: relative;
    overflow: hidden;
}

.session-shimmer-meta::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--vscode-widget-border, rgba(255, 255, 255, 0.08)) 45%,
        var(--vscode-focusBorder, rgba(255, 255, 255, 0.12)) 50%,
        var(--vscode-widget-border, rgba(255, 255, 255, 0.08)) 55%,
        transparent 100%
    );
    background-size: 200% 100%;
    animation: session-shimmer 1.8s ease-in-out infinite;
}

@keyframes session-progress-indeterminate {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(150%); }
    100% { transform: translateX(-100%); }
}

@keyframes session-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-session-group.ts
function getSessionGroupStyles() {
  return (
    /* css */
    `

/* --- Session group wrapper ---
   The container absorbs sibling hover so that mousing over one row tints
   every member of the group. Background is kept transparent by default so
   date-heading contrast is preserved. */
.session-group {
    background: transparent;
}

/* Shared-hover cascade. When any row inside the group is hovered, every
   .session-item inside that same group gets a soft dim. The more specific
   :hover selector on the actual row still wins, giving it the stronger
   vscode-list-hoverBackground colour. */
.session-group:hover .session-item {
    background: var(--vscode-list-inactiveSelectionBackground, rgba(128, 128, 128, 0.08));
}
.session-group .session-item:hover {
    background: var(--vscode-list-hoverBackground);
}

/* --- Primary row (always visible, carries group chrome) --- */
.session-group .session-item-primary .session-item-icon {
    /* Keep space for the chevron that precedes the icon. */
    padding-left: 0;
}

/* Chevron next to the icon on the primary row. Uses the same codicon pattern
   as the day-heading chevron so visual consistency is explicit. */
.session-group-chevron {
    display: inline-flex;
    align-items: center;
    width: 16px;
    margin-right: 2px;
    flex-shrink: 0;
    cursor: pointer;
    color: var(--vscode-icon-foreground);
    opacity: 0.85;
}
.session-group-chevron:hover {
    opacity: 1;
}

/* The "+N" badge on the primary row. Mirrors .session-day-count so it reads
   as part of the Logs panel's existing count vocabulary. */
.session-group-count {
    margin-left: 4px;
    color: var(--vscode-descriptionForeground);
    font-size: 0.85em;
    font-weight: normal;
    white-space: nowrap;
}

/* --- Secondary rows --- */
.session-group .session-item-secondary {
    /* Step the whole row in so the eye reads it as a child of the primary. */
    padding-left: 28px;
    position: relative;
}
.session-group .session-item-secondary::before {
    /* Left-edge tether: a 1px rule that runs down the secondary's left side.
       Positioned absolutely so it extends to the row's full height regardless
       of content, and sits in the indent gap without taking layout space. */
    content: '';
    position: absolute;
    left: 16px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--vscode-tree-indentGuidesStroke, rgba(128, 128, 128, 0.35));
}

/* Secondary-row labels read as subordinate: use the description foreground
   colour for the source adapter chip so the primary's name pops. */
.session-group .session-item-secondary .session-item-meta {
    color: var(--vscode-descriptionForeground);
}

/* --- Collapsed state ---
   When the primary row's data-collapsed="true", hide every secondary row in
   the group. The primary stays fully visible. Badge counts are summed on the
   primary while collapsed (populated by the renderer before this state kicks
   in). */
.session-group[data-collapsed="true"] .session-item-secondary {
    display: none;
}

/* Chevron glyph swap is done by the renderer via codicon class toggling
   (codicon-chevron-right vs codicon-chevron-down), so no CSS rule is needed
   here \u2014 but we keep a consistent transform so the icon doesn't jump. */
.session-group-chevron .codicon {
    font-size: 12px;
    line-height: 1;
}

/* --- Controller block (Controller-rooted day tree) ---
   The Controller is the workspace's own session; peripheral logs (lint, translate, advisor) nest
   under it in .session-controller-children. Distinct class + chevron from .session-group so a
   peripheral that is itself a real session-group keeps its own independent collapse. */
.session-controller-group {
    background: transparent;
}

/* Subtle left accent marks the controller header row as the day's tree root without shouting. */
.session-item-controller {
    border-left: 2px solid var(--vscode-textLink-foreground, #3794ff);
}
.session-item-controller .session-item-icon {
    /* Leave room for the leading chevron, matching the group primary. */
    padding-left: 0;
}

/* Controller chevron mirrors the session-group chevron exactly so the two read as one vocabulary. */
.session-controller-chevron {
    display: inline-flex;
    align-items: center;
    width: 16px;
    margin-right: 2px;
    flex-shrink: 0;
    cursor: pointer;
    color: var(--vscode-icon-foreground);
    opacity: 0.85;
}
.session-controller-chevron:hover { opacity: 1; }
.session-controller-chevron .codicon { font-size: 12px; line-height: 1; }

/* Children indent so the eye reads them as nested under the controller. The tether line is drawn
   on the container's left edge rather than per-row (rows here may be plain items OR nested
   .session-group blocks, so a per-row ::before like the secondary rows use won't line up). */
.session-controller-children {
    padding-left: 16px;
    border-left: 1px solid var(--vscode-tree-indentGuidesStroke, rgba(128, 128, 128, 0.35));
    margin-left: 8px;
}
.session-controller-group[data-collapsed="true"] .session-controller-children {
    display: none;
}

/* "+N older" badge: a quiet, clickable chip that keeps Latest-only's hidden namesakes reachable. */
.session-older-toggle {
    margin-left: 4px;
    padding: 0 4px;
    border-radius: 3px;
    color: var(--vscode-descriptionForeground);
    font-size: 0.85em;
    white-space: nowrap;
    cursor: pointer;
}
.session-older-toggle:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.2));
}
.session-older-toggle.expanded {
    color: var(--vscode-foreground);
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-session-newer.ts
function getSessionNewerStyles() {
  return (
    /* css */
    `

/* --- Reports bucket (per-day, lint/audit/bundle captures) ---
 * Visually subordinate to the day heading: indented one level, muted color,
 * its own chevron that toggles via expandedReportBuckets. Hidden state
 * (\`reportsBucketState: 'hidden'\`) is implemented in the renderer by emitting
 * an empty string, so no CSS rule is needed for "off". */
.session-reports-bucket-heading {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px 4px 22px;
    font-size: 11px;
    font-weight: 500;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    user-select: none;
    border-bottom: 1px dotted var(--vscode-panel-border);
}
.session-reports-bucket-heading:hover {
    background: var(--vscode-list-hoverBackground);
}
.session-reports-bucket-chevron {
    font-size: 12px;
    flex-shrink: 0;
    opacity: 0.7;
}
.session-reports-bucket-label {
    opacity: 0.85;
    letter-spacing: 0.02em;
}
/* Collapsed bucket: hide the report rows. The heading remains so the user can re-expand. */
.session-reports-bucket.collapsed > .session-reports-bucket-items {
    display: none;
}

/* --- Newer-log sticky banner ---
 * Sits between the toolbar and the list so it survives panel-list scroll. Hidden
 * by default; the renderer flips it on when any record has unreadSinceFocus:true. */
.session-newer-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--vscode-inputValidation-infoBackground, var(--vscode-editorInfo-background, var(--vscode-list-hoverBackground)));
    color: var(--vscode-inputValidation-infoForeground, var(--vscode-foreground));
    border-bottom: 1px solid var(--vscode-inputValidation-infoBorder, var(--vscode-panel-border));
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
}
.session-newer-banner:hover {
    filter: brightness(1.07);
}
.session-newer-banner-icon {
    flex-shrink: 0;
    color: var(--vscode-charts-blue, var(--vscode-textLink-foreground));
    font-size: 14px;
}
.session-newer-banner-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.session-newer-banner-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}
.session-newer-banner-action {
    background: transparent;
    border: 1px solid var(--vscode-button-border, transparent);
    color: inherit;
    padding: 2px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
}
.session-newer-banner-action:hover {
    background: var(--vscode-button-hoverBackground);
}
.session-newer-banner-action.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
}

/* --- Per-row unread dot ---
 * Distinct from the existing red/orange update-dot (\`updatedInLastMinute\` /
 * \`updatedSinceViewed\`) \u2014 fires for never-viewed logs too, cleared by panel
 * dismiss or by viewing the log. Lives inside the icon wrapper next to those
 * dots so we never have two dots stacked on the same row. */
.session-item-unread-dot {
    position: absolute;
    top: -1px;
    right: -1px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--vscode-charts-blue, var(--vscode-textLink-foreground, #3794ff));
    border: 1px solid var(--vscode-sideBar-background, var(--vscode-editor-background));
    pointer-events: none;
}

/* --- Pinned section (top-of-list quick access) ---
 * Sits above the day list. Heading mirrors the day heading's sticky style but uses an accent
 * left border so the pinned block reads as a distinct, always-present group. A faint background
 * tint on the section ties its rows together visually without re-styling each row. */
.session-pinned-section {
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-list-inactiveSelectionBackground, transparent);
}
.session-pinned-heading {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-textLink-foreground, #3794ff);
    border-left: 2px solid var(--vscode-textLink-foreground, #3794ff);
    user-select: none;
}
    `
  );
}

// src/ui/viewer-styles/viewer-styles-session-options.ts
function getSessionOptionsMenuStyles() {
  return (
    /* css */
    `

/* --- Display options menu (kebab popover) ---
   Visibility is class-driven: the popover is display:none by default and only
   shows when .open is present. The previous design used inline style="display:none"
   + JS toggling element.style.display, which left the popover one stray
   element.style.display='' (or .cssText reset) away from rendering visible \u2014 and
   on first integration that's exactly what happened: the menu started open on
   panel load even though no code path explicitly opened it. Class toggling is
   side-effect-free and survives any future style-attribute clear. */
.session-options-menu {
    display: none;
    position: absolute;
    top: 100%;
    right: 8px;
    z-index: 30;
    min-width: 240px;
    max-width: calc(100% - 16px);
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}
.session-options-menu.open { display: flex; }

.session-options-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
}
.session-options-row-label {
    flex: 1;
    font-size: 12px;
    color: var(--vscode-foreground);
}

/* Date range filter dropdown (All time / Last 7 days / Last 30 days). */
.session-date-range-select {
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid var(--vscode-input-border, transparent);
    background: var(--vscode-input-background, transparent);
    color: var(--vscode-input-foreground, var(--vscode-foreground));
}

/* Toggle row: icon + label on the left, switch on the right. The switch is a
   pure-CSS pill driven by .active (added/removed by syncToggleButtons). */
.session-options-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px;
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--vscode-foreground);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
}
.session-options-toggle:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.session-options-toggle-icon { font-size: 14px; opacity: 0.85; }
.session-options-toggle-text { flex: 1; }

.session-options-toggle-switch {
    display: inline-flex;
    align-items: center;
    width: 26px;
    height: 14px;
    padding: 1px;
    border-radius: 8px;
    background: var(--vscode-input-background, rgba(120, 120, 120, 0.4));
    border: 1px solid var(--vscode-input-border, transparent);
    transition: background 0.12s ease-out;
}
.session-options-toggle-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vscode-descriptionForeground);
    transform: translateX(0);
    transition: transform 0.12s ease-out, background 0.12s ease-out;
}
.session-options-toggle.active .session-options-toggle-switch {
    background: var(--vscode-button-background, var(--vscode-focusBorder));
}
.session-options-toggle.active .session-options-toggle-thumb {
    transform: translateX(12px);
    background: var(--vscode-button-foreground, #fff);
}

.session-options-sep {
    border: none;
    border-top: 1px solid var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
    margin: 4px 4px;
}

/* --- Grouped submenu triggers (Filter / Display / Actions) ---
   The flyout panel + \u25B8 arrow styling is inherited from .context-menu-submenu /
   .context-menu-submenu-content (already shared with the session context menu in this panel),
   so grouping the long option list into a few submenus keeps the top-level menu short enough to
   fit a short panel. These overrides align the trigger row with the menu's other rows (matching
   padding/radius) and let the label fill the row so the arrow sits far-right. The flyout itself is
   placed by positionSessionOptionsSubmenu() in viewport coordinates so it is never cropped. */
.session-options-submenu { padding: 6px; border-radius: 3px; }
.session-options-submenu-label { flex: 1; font-size: 12px; }
/* Active-filter dot on the Filter group row: sits just left of the \u25B8 arrow, shown only when the
   trigger carries .has-active-filters (toggled in renderNameFilterBar for an active date/size
   filter). Mirrors the kebab dot's color so the two read as the same "filter is on" signal. */
.session-options-filter-dot {
    display: none;
    width: 6px;
    height: 6px;
    margin-right: 4px;
    border-radius: 50%;
    background: var(--vscode-textLink-foreground, #3794ff);
}
.session-options-submenu.has-active-filters .session-options-filter-dot { display: inline-block; }

.session-options-action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px;
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--vscode-foreground);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
}
.session-options-action:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.session-options-action .codicon { font-size: 14px; opacity: 0.85; }

/* --- Recently-opened-files shortcut list (under the kebab's last separator) ---
   Caps height at ~10 rows and scrolls past that so the popover never grows taller than the panel.
   Each row mirrors .session-options-action's hover/padding so the list reads as part of the menu. */
.session-loaded-files-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 220px;
    overflow-y: auto;
}
.session-loaded-files-empty {
    padding: 4px 6px;
    font-size: 11px;
    font-style: italic;
    color: var(--vscode-descriptionForeground);
    opacity: 0.75;
}
.session-loaded-file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 6px;
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--vscode-foreground);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
}
.session-loaded-file-item:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.session-loaded-file-item .codicon { font-size: 14px; opacity: 0.85; flex-shrink: 0; }
/* Long filenames truncate with an ellipsis rather than widening the popover. */
.session-loaded-file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Highlight the kebab button while the menu is open so the popover origin
   is obvious. Mirrors .session-toggle-btn.active appearance. */
.session-panel-action.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-session.ts
function getSessionPanelStyles() {
  return getSessionPanelLayoutStyles() + getSessionOptionsMenuStyles() + getSessionListStyles() + getSessionNameFilterStyles() + getSessionNewerStyles() + getSessionTagsLoadingStyles() + getSessionGroupStyles();
}

// src/ui/viewer-styles/viewer-styles-find.ts
function getFindPanelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Find Panel \u2014 slide-out (same pattern as session panel)
   =================================================================== */
.find-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.find-panel.visible {
    display: flex;
}

.find-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.find-panel-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.find-header-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}
.find-header-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.find-header-btn.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    border-color: var(--vscode-focusBorder);
}

.find-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.find-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* --- Search input row --- */
.find-input-wrapper {
    display: flex;
    align-items: center;
    margin: 8px 12px;
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
    background: var(--vscode-input-background, #1e1e1e);
    overflow: hidden;
}

.find-input-wrapper:focus-within {
    border-color: var(--vscode-focusBorder, #007acc);
}

.find-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--vscode-input-foreground, inherit);
    font-size: 12px;
    padding: 4px 8px;
    outline: none;
    min-width: 0;
}

.find-input-actions {
    display: flex;
    gap: 2px;
    padding: 0 4px;
}

.find-input-actions .search-input-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.find-input-actions .search-input-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.find-input-actions .search-input-btn.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    border-color: var(--vscode-focusBorder);
}

/* --- Summary and result list --- */
.find-summary {
    padding: 4px 12px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

.find-results {
    flex: 1;
    overflow-y: auto;
}

.find-result-item {
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 12px;
}

.find-result-item:hover {
    background: var(--vscode-list-hoverBackground);
}

.find-result-item.active {
    background: var(--vscode-list-activeSelectionBackground, rgba(4, 57, 94, 0.5));
    color: var(--vscode-list-activeSelectionForeground, inherit);
}

.find-result-item .codicon {
    font-size: 14px;
    flex-shrink: 0;
}

.find-result-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.find-result-badge {
    flex-shrink: 0;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
}

/* --- Empty / loading states --- */
.find-empty,
.find-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-bookmarks.ts
function getBookmarkPanelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Bookmark Panel \u2014 slide-out (same pattern as find panel)
   =================================================================== */
.bookmark-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.bookmark-panel.visible {
    display: flex;
}

.bookmark-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.bookmark-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.bookmark-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.bookmark-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.bookmark-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.bookmark-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* --- Filter input --- */
.bookmark-input-wrapper {
    display: flex;
    align-items: center;
    margin: 8px 12px;
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
    background: var(--vscode-input-background, #1e1e1e);
    overflow: hidden;
}

.bookmark-input-wrapper:focus-within {
    border-color: var(--vscode-focusBorder, #007acc);
}

.bookmark-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--vscode-input-foreground, inherit);
    font-size: 12px;
    padding: 4px 8px;
    outline: none;
    min-width: 0;
}

/* --- Bookmark list --- */
.bookmark-list {
    flex: 1;
    overflow-y: auto;
}

.bookmark-file-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    background: var(--vscode-sideBarSectionHeader-background, rgba(128, 128, 128, 0.1));
    border-bottom: 1px solid var(--vscode-panel-border);
}

.bookmark-file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bookmark-count-badge {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: normal;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
}

.bookmark-file-delete {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 0 2px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.15s;
}

.bookmark-file-header:hover .bookmark-file-delete { opacity: 1; }
.bookmark-file-delete:hover { color: var(--vscode-errorForeground, #f44); }

/* --- Bookmark items --- */
.bookmark-item {
    padding: 6px 12px 6px 24px;
    cursor: pointer;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 12px;
    position: relative;
}

.bookmark-item:hover { background: var(--vscode-list-hoverBackground); }

.bookmark-item-main {
    display: flex;
    align-items: center;
    gap: 6px;
}

.bookmark-item-main .codicon { font-size: 14px; flex-shrink: 0; }

.bookmark-item-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bookmark-item-note {
    margin-top: 2px;
    padding-left: 20px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bookmark-item-actions {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
}

.bookmark-item:hover .bookmark-item-actions { opacity: 1; }

.bookmark-action-btn {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
}

.bookmark-action-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.bookmark-action-btn.bookmark-delete:hover {
    color: var(--vscode-errorForeground, #f44);
}

/* --- Empty state --- */
.bookmark-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    white-space: pre-line;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-sql-query-history.ts
function getSqlQueryHistoryPanelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   SQL Query History Panel
   =================================================================== */
.sql-query-history-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.sql-query-history-panel.visible {
    display: flex;
}

.sql-query-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.sql-query-history-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.sql-query-history-action,
.sql-query-history-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.sql-query-history-action:hover,
.sql-query-history-close:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* The \xD7 is a dismiss control, so it takes the shared red-accent close treatment; the action
   buttons keep the neutral foreground-on-hover from the rule above. */
.sql-query-history-close:hover { color: var(--vscode-errorForeground, #f44); }

.sql-query-history-drift-status {
    padding: 6px 12px;
    font-size: 11px;
    line-height: 1.35;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.08));
    /* anywhere (not break-all): lets the long server URL wrap when it must, WITHOUT chopping
       ordinary words mid-character \u2014 break-all split "reachable" into "reac"/"hable" at narrow widths. */
    overflow-wrap: anywhere;
}

.sql-query-history-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.sql-query-history-toolbar > * {
    margin: 0;
}

#sql-query-history-search {
    flex: 1;
    min-width: 120px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    border-radius: 4px;
    font-size: 12px;
    padding: 4px 8px;
    outline: none;
}

#sql-query-history-search:focus {
    border-color: var(--vscode-focusBorder, #007acc);
}

.sql-query-history-hint {
    padding: 6px 12px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.12));
}

.sql-query-history-list {
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
}

.sql-query-history-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}

.sql-query-history-table thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--vscode-editor-background);
}

.sql-qh-header {
    text-align: left;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
    cursor: pointer;
    user-select: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sql-qh-header:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007acc);
    outline-offset: -2px;
}

/* No captured queries: headers are inert. Dim them and drop the pointer cursor so they don't
   look clickable; the JS handler also returns early on aria-disabled. */
.sql-qh-header-disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
}

/* Order: Count | SQL | Slow \u2014 fixed-width numeric columns; SQL column takes remaining space. */
.sql-qh-header-count,
.sql-qh-cell-count {
    width: 3.5rem;
    padding-left: 6px;
    padding-right: 4px;
    white-space: nowrap;
    text-align: right;
    vertical-align: top;
}

.sql-qh-header-dur,
.sql-qh-cell-dur {
    width: 5rem;
    padding-left: 4px;
    padding-right: 6px;
    white-space: nowrap;
    text-align: right;
    vertical-align: top;
}

.sql-qh-cell-preview {
    vertical-align: top;
    min-width: 0;
}

.sql-qh-header::after {
    content: '';
    margin-left: 4px;
    opacity: 0.6;
}

.sql-qh-header-sorted-asc::after {
    content: '\\25B2';
}

.sql-qh-header-sorted-desc::after {
    content: '\\25BC';
}

#sql-query-history-tbody tr {
    border-bottom: 1px solid var(--vscode-panel-border);
}

#sql-query-history-tbody tr:hover {
    background: var(--vscode-list-hoverBackground);
}

.sql-query-history-row {
    padding: 8px 12px 8px 0;
    cursor: pointer;
}

.sql-query-history-row:focus {
    outline: none;
}

.sql-query-history-count {
    font-weight: 600;
    color: var(--vscode-foreground);
    font-variant-numeric: tabular-nums;
}

.sql-query-history-dur {
    color: var(--vscode-descriptionForeground);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}

.sql-query-history-preview {
    color: var(--vscode-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: text;
    cursor: text;
}

.sql-query-history-sql {
    margin: 4px 0 8px;
    padding: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--vscode-foreground);
    user-select: text;
    cursor: text;
}

.sql-query-history-row-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
}

.sql-query-history-jump {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    cursor: pointer;
    font-size: 11px;
    padding: 0;
}

.sql-query-history-jump:hover { text-decoration: underline; }

.sql-qh-action-btn {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
}

.sql-qh-action-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.sql-query-history-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    white-space: pre-line;
}

/* DB_18: "Current session only" filter, lives in the toolbar next to the search input.
   Class name kept (.sql-qh-cumulative) so existing layout/spacing rules apply unchanged. */
.sql-qh-cumulative {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    user-select: none;
}

.sql-qh-cumulative input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
}

.sql-qh-cumulative:hover {
    color: var(--vscode-foreground);
}

/* DB_18b 1c: pager row shown only when the scale-gated window hides rows (>2000 filtered). */
.sql-qh-pager-cell {
    padding: 10px 12px;
    text-align: center;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
}

.sql-qh-pager-note { margin-right: 8px; }

.sql-qh-show-more {
    background: none;
    border: 1px solid var(--vscode-button-border, var(--vscode-contrastBorder, transparent));
    color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    cursor: pointer;
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 3px;
}

.sql-qh-show-more:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-sql-query-history-dashboard.ts
function getSqlQueryHistoryDashboardStyles() {
  return (
    /* css */
    `

/* ===================================================================
   SQL Query History Dashboard (stat cards + top-queries bar chart)
   =================================================================== */
.sql-qh-dashboard {
    padding: 6px 12px 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.sql-qh-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

/* Each card is a flexible equal-share column so 2-4 cards fill the strip without horizontal scroll.
   Border + 6px radius match the Crashlytics detail stat cards (.cd-stat) so a "stat card" reads
   as one consistent pattern across dashboards instead of two slightly different treatments. */
.sql-qh-stat {
    flex: 1 1 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 6px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    background: var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.1));
}

.sql-qh-stat-val {
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--vscode-foreground);
}

.sql-qh-stat-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.sql-qh-chart {
    margin-top: 8px;
}

.sql-qh-chart-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
}

/* label | bar track | count \u2014 the track flexes so bars share a common right-aligned scale. */
.sql-qh-chart-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
}

.sql-qh-chart-label {
    flex: 0 0 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--vscode-foreground);
}

.sql-qh-chart-track {
    flex: 1 1 auto;
    height: 10px;
    background: var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.12));
    border-radius: 2px;
    overflow: hidden;
}

.sql-qh-chart-bar {
    display: block;
    height: 100%;
    background: var(--vscode-charts-blue, var(--vscode-progressBar-background));
    border-radius: 2px;
}

.sql-qh-chart-num {
    flex: 0 0 auto;
    min-width: 32px;
    text-align: right;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--vscode-descriptionForeground);
}

/* --- Drift Advisor issues sub-section (index suggestions + anomalies) --- */
.sql-qh-issues {
    margin-top: 8px;
}

.sql-qh-issues-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
}

/* A colored left border carries severity at a glance; warning vs info reuse VS Code theme tokens. */
.sql-qh-issue {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    margin-bottom: 2px;
    border-left: 2px solid var(--vscode-charts-blue);
    font-size: 11px;
}

.sql-qh-issue-warning {
    border-left-color: var(--vscode-editorWarning-foreground, var(--vscode-charts-yellow));
}

.sql-qh-issue-info {
    border-left-color: var(--vscode-charts-blue, var(--vscode-editorInfo-foreground));
}

.sql-qh-issue-loc {
    flex: 0 0 auto;
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--vscode-foreground);
    font-weight: 600;
}

.sql-qh-issue-msg {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground);
}

.sql-qh-issue-fix {
    flex: 0 0 auto;
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    padding: 0 2px;
}

.sql-qh-issue-fix:hover {
    color: var(--vscode-textLink-activeForeground);
}

/* --- Async loading / error states for the Drift enrichment fetches (issues + lint) --- */
/* Body tier (11px) matches the issue rows; loading pulses to read as in-progress, error uses the
   theme error color so a failed fetch is visibly distinct from an empty (hidden) section. */
.sql-qh-async {
    font-size: 11px;
    padding: 2px 6px;
}

.sql-qh-async-loading {
    color: var(--vscode-descriptionForeground);
    animation: sql-qh-async-pulse 1.5s ease-in-out infinite;
}

.sql-qh-async-error {
    color: var(--vscode-errorForeground, #f48771);
}

.sql-qh-async-detail {
    opacity: 0.7;
}

@keyframes sql-qh-async-pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.3; } }

/* --- Saropa Lints static-code section (Drift-rule violations + enable-pack advice) --- */
.sql-qh-lint {
    margin-top: 8px;
}

.sql-qh-lint-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
}

/* The advice is a call-to-action, so it gets the prominent notification treatment rather than a row. */
.sql-qh-lint-advice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    background: var(--vscode-inputValidation-infoBackground, var(--vscode-editorWidget-background));
    border: 1px solid var(--vscode-inputValidation-infoBorder, var(--vscode-panel-border));
}

.sql-qh-lint-advice-msg {
    flex: 1 1 auto;
    font-size: 11px;
    color: var(--vscode-foreground);
}

.sql-qh-lint-enable {
    flex: 0 0 auto;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
}

.sql-qh-lint-enable:hover {
    background: var(--vscode-button-hoverBackground, var(--vscode-button-background));
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-trash.ts
function getTrashPanelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Trash Panel \u2014 slide-out (same pattern as bookmark panel)
   =================================================================== */
.trash-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.trash-panel.visible {
    display: flex;
}

.trash-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.trash-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.trash-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.trash-panel-action:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.trash-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.trash-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.trash-panel-content {
    flex: 1;
    overflow-y: auto;
}

/* --- Trash items --- */
.trash-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 12px;
    opacity: 0.85;
}

.trash-item:hover {
    background: var(--vscode-list-hoverBackground);
    opacity: 1;
}

.trash-item-icon { flex-shrink: 0; padding-top: 1px; }
.trash-item-icon .codicon { font-size: 14px; color: var(--vscode-descriptionForeground); }

.trash-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.trash-item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.trash-item-meta {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* --- Empty state --- */
.trash-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-about.ts
function getAboutPanelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   About Panel \u2014 slide-out (same pattern as trash/bookmark panels)
   =================================================================== */
.about-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.about-panel.visible {
    display: flex;
}

.about-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.about-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.about-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.about-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.4;
}

/* --- About panel content styles --- */
/* WHY cursor:pointer + user-select:none: this row is the long-press copy target,
   so we suppress text drag (it would compete with the press timer) and hint the
   gesture. The opacity dip during press is the only feedback users get before
   the toast fires at 500 ms, so keep it visible. */
.ab-version-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; cursor: pointer; user-select: none; -webkit-user-select: none; transition: opacity 0.1s ease; }
.ab-version-row.ab-title-pressing { opacity: 0.55; }
.ab-version-label { font-size: 1.1em; font-weight: 700; }
.ab-version-badge { font-size: 0.9em; font-weight: 500; color: var(--vscode-descriptionForeground); }
.ab-changelog-link { display: inline-block; color: var(--vscode-textLink-foreground); font-size: 11px; margin: 2px 0 4px 0; cursor: pointer; }
.ab-changelog-link:hover { text-decoration: underline; }
.ab-tagline { font-weight: 600; font-style: italic; opacity: 0.9; margin: 0 0 6px 0; font-size: 0.95em; }
.ab-blurb { opacity: 0.8; margin: 0 0 16px 0; font-size: 0.9em; }
/* Section header is now a collapse/expand toggle. cursor:pointer + user-select:none so the
   click doesn't start a text selection. The chevron flips via codicon class swap in script. */
.ab-section { font-weight: 600; font-size: 1.05em; margin-bottom: 8px; margin-top: 12px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
.ab-section-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; -webkit-user-select: none; }
.ab-section-toggle:hover { color: var(--vscode-textLink-foreground); }
.ab-section-chevron { font-size: 0.9em; opacity: 0.8; flex-shrink: 0; }
/* Collapsed body is fully removed from flow (not just hidden) so the sections stack tightly. */
.ab-section-body-hidden { display: none; }
/* --- Debug section: meta files/folders the extension uses --- */
.ab-debug-loading { opacity: 0.6; font-size: 0.9em; }
.ab-debug-row { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
.ab-debug-row:hover { background: var(--vscode-list-hoverBackground); border-color: var(--vscode-panel-border); }
.ab-debug-label { font-weight: 600; display: flex; align-items: center; gap: 5px; }
.ab-debug-state { font-weight: 500; font-size: 0.8em; padding: 0 5px; border-radius: 8px; }
.ab-debug-present { color: var(--vscode-testing-iconPassed, #3fb950); background: rgba(63, 185, 80, 0.12); }
.ab-debug-missing { color: var(--vscode-list-warningForeground, #d29922); background: rgba(210, 153, 34, 0.14); }
.ab-debug-usage { font-size: 0.85em; opacity: 0.8; line-height: 1.35; }
.ab-debug-path { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.8em; opacity: 0.65; word-break: break-all; }
.ab-link { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; }
.ab-link:hover { background: var(--vscode-list-hoverBackground); }
.ab-link-icon { font-size: 1.2em; flex-shrink: 0; margin-top: 1px; }
.ab-link-title { display: block; color: var(--vscode-textLink-foreground); font-weight: 500; }
.ab-link-badge { display: block; font-size: 0.8em; opacity: 0.6; margin-top: 1px; }
.ab-link-desc { display: block; font-size: 0.85em; opacity: 0.8; margin-top: 2px; line-height: 1.35; }
`
  );
}

// src/ui/viewer-styles/viewer-styles-collections.ts
function getCollectionsPanelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Collections Panel \u2014 slide-out (same pattern as about/trash panels)
   =================================================================== */
.collections-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}
.collections-panel.visible { display: flex; }

.collections-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.collections-panel-close {
    background: none;
    border: none;
    color: var(--vscode-icon-foreground);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 14px;
}
.collections-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.collections-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}

/* ---- Explainer ---- */
.collections-explainer {
    background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
    border-left: 3px solid var(--vscode-textLink-foreground, #007acc);
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 12px;
    font-size: 11.5px;
    line-height: 1.55;
}
.collections-explainer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.collections-explainer-title {
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 4px;
}
.collections-explainer-close {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    opacity: 0.6;
    cursor: pointer;
    font-size: 12px;
    padding: 0 2px;
    line-height: 1;
    align-self: flex-start;
}
.collections-explainer-close:hover { opacity: 1; }

/* ---- Create / Merge ---- */
.collections-merge-btn {
    background: var(--vscode-button-secondaryBackground, rgba(127,127,127,0.2));
    color: var(--vscode-button-secondaryForeground, inherit);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    padding: 5px 10px;
    font-size: 11.5px;
    cursor: pointer;
    width: 100%;
    text-align: left;
}
.collections-merge-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, rgba(127,127,127,0.3));
}

.collections-merge-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.collections-rename-input {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    padding: 4px 8px;
    font-size: 12px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
}
.collections-rename-input:focus {
    border-color: var(--vscode-focusBorder);
}

.collections-create-actions {
    display: flex;
    gap: 6px;
}
.collections-create-confirm {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 4px 12px;
    font-size: 11.5px;
    cursor: pointer;
}
.collections-create-confirm:hover { opacity: 0.9; }
.collections-create-confirm:disabled { opacity: 0.5; cursor: default; }

.collections-create-cancel {
    background: var(--vscode-button-secondaryBackground, rgba(127,127,127,0.2));
    color: var(--vscode-button-secondaryForeground, inherit);
    border: none;
    border-radius: 3px;
    padding: 4px 12px;
    font-size: 11.5px;
    cursor: pointer;
}
.collections-create-cancel:hover { opacity: 0.85; }

.collections-create-error {
    color: var(--vscode-errorForeground);
    font-size: 11px;
    padding: 2px 0;
}

/* ---- Merge ---- */
.collections-merge-section { margin-bottom: 12px; }
.collections-merge-select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    padding: 4px 6px;
    font-size: 12px;
    width: 100%;
    box-sizing: border-box;
}
.collections-merge-form label {
    font-size: 11px;
    opacity: 0.8;
    margin-top: 4px;
}

/* ---- Loading / empty ---- */
.collections-loading {
    text-align: center;
    padding: 20px;
    opacity: 0.6;
    font-size: 12px;
}
.collections-empty {
    text-align: center;
    padding: 12px;
    opacity: 0.6;
    font-size: 11.5px;
}

/* ---- List items ---- */
.collections-list { display: flex; flex-direction: column; gap: 6px; }

.collections-item {
    background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.08));
    border: 1px solid var(--vscode-panel-border, transparent);
    border-radius: 4px;
    padding: 8px 10px;
    cursor: pointer;
    transition: background 0.1s;
}
.collections-item:hover {
    background: var(--vscode-list-activeSelectionBackground, rgba(127,127,127,0.15));
}
.collections-item-active {
    border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground));
}

.collections-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}
.collections-item-name {
    font-weight: 500;
    font-size: 12px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.collections-item-check {
    color: var(--vscode-terminal-ansiGreen, #4ec9b0);
    font-size: 13px;
    flex-shrink: 0;
}
.collections-item-meta {
    font-size: 10.5px;
    opacity: 0.65;
    margin-top: 2px;
}
.collections-item-actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
}
.collections-action-btn {
    background: none;
    border: none;
    color: var(--vscode-icon-foreground, inherit);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 12px;
    opacity: 0.6;
    border-radius: 3px;
}
.collections-action-btn:hover {
    opacity: 1;
    background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.15));
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-crashlytics-setup.ts
function getSetupStyles() {
  return (
    /* css */
    `

/* --- Setup wizard --- */
.cp-setup-intro { margin: 10px 12px 4px; font-size: 12px; line-height: 1.5; }

/* 3-step progress row. Each step is a numbered/checked pill: done (green), active (accent), todo (muted). */
.cp-steps { display: flex; gap: 6px; margin: 10px 12px; }
.cp-step { display: flex; align-items: center; gap: 5px; flex: 1; font-size: 11px; opacity: 0.6; }
.cp-step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid var(--vscode-panel-border);
    font-size: 11px;
}
.cp-step-active { opacity: 1; font-weight: 600; }
.cp-step-active .cp-step-num {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
}
.cp-step-done { opacity: 0.9; }
.cp-step-done .cp-step-num {
    background: var(--vscode-testing-iconPassed, #388e3c);
    color: var(--vscode-button-foreground);
    border-color: transparent;
}

.cp-setup-status { margin: 6px 12px 2px; font-size: 12px; font-weight: 600; }

/* Collapsed diagnostic/troubleshooting so a failed setup reads as guidance, not an error wall. */
.cp-problem { margin: 10px 12px; font-size: 11px; }
.cp-problem > summary { cursor: pointer; opacity: 0.8; padding: 4px 0; }
.cp-problem-body { margin-top: 4px; }

.cp-setup-title { font-weight: 600; font-size: 12px; margin: 0 12px 4px; }

/* --- Connection test report --- */
.cp-conn-test { margin: 8px 12px; }
.cp-conn-test-btn { width: 100%; text-align: center; }
.cp-conn-report { margin-top: 8px; }
.cp-conn-checking { font-size: 12px; opacity: 0.8; padding: 4px 0; }
.cp-conn-ok { color: var(--vscode-testing-iconPassed, #388e3c); font-weight: 600; margin-bottom: 6px; }
.cp-conn-bad { color: var(--vscode-errorForeground); font-weight: 600; margin-bottom: 6px; }
.cp-conn-step {
    padding: 6px 8px;
    margin: 4px 0;
    border-left: 3px solid var(--vscode-panel-border);
    border-radius: 3px;
    background: var(--vscode-textBlockQuote-background);
}
.cp-conn-pass { border-left-color: var(--vscode-testing-iconPassed, #388e3c); }
.cp-conn-fail { border-left-color: var(--vscode-errorForeground); }
.cp-conn-skipped { opacity: 0.7; }
.cp-conn-head { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 12px; }
.cp-conn-detail { font-size: 12px; opacity: 0.9; margin-top: 2px; }
.cp-conn-fix { font-size: 11px; margin-top: 4px; }
.cp-conn-tech { margin-top: 4px; font-size: 11px; }
.cp-conn-tech summary { cursor: pointer; opacity: 0.8; }
.cp-conn-tech pre {
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--vscode-textCodeBlock-background);
    padding: 4px;
    margin: 4px 0;
}
.cp-setup-step { margin: 8px 12px; }
.cp-setup-step p { margin: 4px 0 8px; opacity: 0.85; line-height: 1.4; font-size: 12px; }
.cp-setup-step code {
    background: var(--vscode-textCodeBlock-background);
    padding: 1px 4px;
    border-radius: 2px;
    font-family: var(--vscode-editor-font-family);
}

.cp-install-via { margin: 6px 0; }
.cp-install-code { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-copy-btn {
    margin-left: 6px;
    padding: 2px 8px;
    font-size: 11px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 2px;
    cursor: pointer;
    vertical-align: middle;
}
.cp-copy-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }

.cp-setup-why {
    margin-top: 8px;
    font-size: 11px;
    opacity: 0.75;
    font-style: italic;
}
.cp-use-existing { margin: 6px 0; }

.cp-setup-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 14px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 12px;
    display: block;
    margin: 8px 0;
}

.cp-setup-btn:hover { background: var(--vscode-button-hoverBackground); }

.cp-setup-link {
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    text-decoration: underline;
    display: inline-block;
    margin: 4px 0;
}

.cp-setup-settings {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    opacity: 0.8;
}

.cp-setup-tip {
    margin: 16px 12px 8px;
    font-size: 11px;
    opacity: 0.6;
    font-style: italic;
}

.cp-check-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 12px;
    margin: 8px 12px;
}

.cp-check-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
`
  );
}
function getDiagnosticStyles() {
  return (
    /* css */
    `

/* --- Diagnostic box --- */
.cp-diag-box {
    margin: 10px 12px;
    padding: 8px;
    background: var(--vscode-inputValidation-warningBackground);
    border-left: 3px solid var(--vscode-inputValidation-warningBorder);
    border-radius: 3px;
    font-size: 11px;
}

.cp-diag-msg { margin-bottom: 4px; }
.cp-diag-status { font-size: 10px; opacity: 0.8; margin-top: 2px; }
.cp-diag-tech { margin-top: 6px; font-size: 10px; }
.cp-diag-tech summary { cursor: pointer; opacity: 0.8; }
.cp-diag-tech pre {
    margin: 4px 0;
    padding: 4px;
    background: var(--vscode-textCodeBlock-background);
    overflow-x: auto;
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-all;
}

.cp-diag-time { font-size: 10px; margin-top: 6px; opacity: 0.6; font-style: italic; }
.cp-diag-actions { margin: 10px 12px 4px; }
.cp-diag-actions-row {
    margin: 10px 12px 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}
.cp-btn-secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.cp-btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.cp-open-console { margin: 8px 12px; font-size: 12px; }
.cp-show-output { margin-left: 4px; }

/* --- In-panel troubleshooting --- */
.cp-trouble-step {
    margin: 10px 12px;
    padding: 8px 10px;
    background: var(--vscode-textBlockQuote-background);
    border-left: 3px solid var(--vscode-focusBorder);
    border-radius: 3px;
    font-size: 11px;
}
.cp-trouble-step-title { font-weight: 600; margin-bottom: 6px; }
.cp-trouble-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
}
.cp-trouble-table th, .cp-trouble-table td {
    padding: 4px 8px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--vscode-widget-border);
}
.cp-trouble-table th { font-weight: 600; }
.cp-trouble-symptom { font-family: var(--vscode-editor-font-family); }
.cp-trouble-details {
    margin: 10px 12px;
    font-size: 11px;
}
.cp-trouble-details summary {
    cursor: pointer;
    font-weight: 600;
    padding: 4px 0;
}
.cp-trouble-details .cp-trouble-table { margin-top: 6px; }

/* --- In-panel Help (full doc content) --- */
.cp-help-details {
    margin: 10px 12px 12px;
    font-size: 11px;
    border-top: 1px solid var(--vscode-widget-border);
    padding-top: 8px;
}
.cp-help-details summary {
    cursor: pointer;
    font-weight: 600;
    padding: 4px 0;
}
.cp-help-section { margin: 10px 0; }
.cp-help-section-title { font-weight: 600; margin-bottom: 4px; }
.cp-help-section-body {
    font-size: 11px;
    line-height: 1.4;
}
.cp-help-section-body p { margin: 6px 0; }
.cp-help-section-body ol, .cp-help-section-body ul { margin: 6px 0; padding-left: 20px; }
.cp-help-section-body code { font-family: var(--vscode-editor-font-family); font-size: 11px; }
.cp-help-link { color: var(--vscode-textLink-foreground); text-decoration: underline; }
.cp-help-link:hover { color: var(--vscode-textLink-activeForeground); }
`
  );
}

// src/ui/viewer-styles/viewer-styles-crashlytics.ts
function getCrashlyticsPanelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Crashlytics Panel \u2014 slide-out
   =================================================================== */
.crashlytics-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.crashlytics-panel.visible {
    display: flex;
}

.crashlytics-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.crashlytics-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.crashlytics-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.crashlytics-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.crashlytics-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.crashlytics-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.crashlytics-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}

/* --- Issue cards --- */
.cp-item {
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 9px 12px;
    cursor: pointer;
    font-size: 12px;
    transition: background-color 0.12s ease, box-shadow 0.12s ease;
}

/* Hover lifts the row with a soft inset accent on the left edge (refined-native, no layout shift). */
.cp-item:hover { background: var(--vscode-list-hoverBackground); box-shadow: inset 2px 0 0 var(--vscode-focusBorder); }
/* Severity accent stripe so the list reads at a glance (color, #1). */
.cp-item-fatal { border-left: 3px solid var(--vscode-errorForeground); padding-left: 9px; }
.cp-item-nonfatal { border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700); padding-left: 9px; }
/* Typography hierarchy (UI #5): bold primary, muted metadata, room to breathe. */
.cp-title { font-weight: 600; font-size: 12px; line-height: 1.45; margin-bottom: 3px; }
.cp-meta { font-size: 11px; opacity: 0.65; line-height: 1.4; }

/* --- Compact sidebar filter bar (#5): icons/abbreviations for the narrow panel --- */
.cp-filterbar { border-bottom: 1px solid var(--vscode-panel-border); padding: 4px 8px; }
.cp-tabs { display: flex; gap: 2px; margin-bottom: 4px; }
.cp-tab { flex: 1; background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 3px; padding: 2px 0; font-size: 11px; cursor: pointer; opacity: 0.75; }
.cp-tab:hover { opacity: 1; }
.cp-tab.cp-tab-sel { opacity: 1; font-weight: 700; background: var(--vscode-button-secondaryBackground); border-color: var(--vscode-focusBorder); }
.cp-fcontrols { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
/* Search shares a row with the regex toggle (flex-basis < 100% so the button does not wrap alone);
   the version/device/OS selects wrap to the next row as before. */
.cp-search { flex: 1 1 70%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 3px; padding: 2px 6px; font-size: 11px; min-width: 80px; }
/* Regex toggle (#2 advanced search): monospace .* glyph; pressed state borrows the focus accent. */
.cp-regex { flex: 0 0 auto; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 3px; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; padding: 2px 6px; cursor: pointer; opacity: 0.7; }
.cp-regex:hover { opacity: 1; }
.cp-regex.cp-regex-on { opacity: 1; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-focusBorder); }
/* Invalid regex pattern: red outline so the user knows the filter is not applied. */
.cp-search.cp-search-invalid { border-color: var(--vscode-errorForeground); }
.cp-fselect { flex: 1 1 auto; min-width: 56px; max-width: 33%; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border, var(--vscode-panel-border)); border-radius: 3px; font-size: 11px; padding: 1px; }

/* Pill badges (UI #2/#3): soft tints + crisp borders via theme tokens, so they adapt to any theme. */
.cp-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 9px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid transparent;
    vertical-align: middle;
}
.cp-badge-crash { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-errorForeground); border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); }
.cp-badge-anr { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-editorWarning-foreground); border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground)); }
.cp-badge-nf { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.cp-badge-regression, .cp-badge-regressed { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-errorForeground); }
.cp-badge-closed { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.cp-badge-open { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.cp-badge-repetitive { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-editorWarning-foreground); border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground)); }
.cp-archive-btn { background: transparent; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; padding: 0 4px; opacity: 0; flex: 0 0 auto; transition: opacity 0.12s ease, color 0.12s ease; }
.cp-item:hover .cp-archive-btn, .cp-item.cp-item-archived .cp-archive-btn { opacity: 0.85; }
.cp-archive-btn:hover { color: var(--vscode-foreground); }
.cp-item-archived { opacity: 0.55; }
/* Trend sparkline reads as a contained mini-chart chip at the end of the meta line. */
.cp-trend { display: inline-flex; align-items: center; margin-left: 6px; padding: 1px 4px; vertical-align: middle; border-radius: 4px; background: var(--vscode-textBlockQuote-background, transparent); color: var(--vscode-charts-blue, var(--vscode-textLink-foreground)); }
.cp-trend:empty { display: none; }
.cp-trend svg { vertical-align: middle; display: block; }

.cp-actions { display: flex; gap: 4px; margin-top: 4px; }

.cp-action-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 11px;
}

.cp-action-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }

.cp-console {
    padding: 8px 12px;
    text-align: center;
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
    font-size: 12px;
}

.cp-console:hover { text-decoration: underline; }

.cp-empty { padding: 16px 12px; opacity: 0.7; font-style: italic; text-align: center; font-size: 12px; }
.cp-error { color: var(--vscode-errorForeground); font-size: 11px; padding: 6px 12px; }

/* --- Crash detail (loaded into issue card) --- */
.cp-detail { overflow: hidden; max-height: 0; transition: max-height 0.3s ease; }
.cp-detail.expanded { max-height: 2000px; padding: 4px 0; border-top: 1px solid var(--vscode-panel-border); }
.cp-detail-loading {
    padding: 6px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    animation: cp-pulse 1.5s ease-in-out infinite;
}

@keyframes cp-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }

.cp-expand-icon { float: right; font-size: 10px; color: var(--vscode-descriptionForeground); transition: transform 0.2s; }
.cp-item.detail-open .cp-expand-icon { transform: rotate(90deg); }

/* --- Loading state --- */
.crashlytics-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    animation: cp-pulse 1.5s ease-in-out infinite;
}

/* --- Refresh note --- */
.cp-refresh-note { font-weight: normal; font-size: 10px; opacity: 0.6; margin-left: 4px; }

/* ===================================================================
   In-viewer issue detail \u2014 fills the log area beside the sidebar list.
   Replaces the dropped editor-tab dashboard: clicking a sidebar issue
   shows its detail here (like a session opens in the log viewer).
   =================================================================== */
/* Full overlay over the whole log area (#log-area-with-footer is position:relative) so the log's
   toolbar / line-count / file path / footer do NOT bleed through behind the issue detail. */
/* z-index must beat the log toolbar (z-index:50) so "Log X of Y" / search / line-count / filename
   do not show above the issue detail (and so the detail's own header + Copy button are visible). */
.crashlytics-detail { position: absolute; inset: 0; z-index: 200; display: flex; flex-direction: column; overflow: hidden; background: var(--vscode-editor-background); }
.crashlytics-detail.u-hidden { display: none; }
.cd-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 2px solid var(--vscode-focusBorder); background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
.cd-title { font-weight: 600; font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* "View on Firebase" link (#3): the project console opens in the browser. Icon-only to stay compact. */
.cd-console-link { margin-left: 6px; color: var(--vscode-textLink-foreground); text-decoration: none; font-size: 12px; cursor: pointer; }
.cd-console-link:hover { text-decoration: underline; }

/* Dashboard stat cards (#4 / #5 first slice): the issue's severity + counts + state + versions read at
   a glance instead of living only in the copied Markdown. Cards wrap on a narrow overlay. */
.cd-stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 2px 0 12px; }
.cd-stat { background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background)); border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 6px 12px; min-width: 64px; }
.cd-stat-val { display: block; font-size: 15px; font-weight: 700; line-height: 1.2; }
.cd-stat-label { display: block; font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
.cd-sev-crash { color: var(--vscode-errorForeground); }
.cd-sev-anr { color: var(--vscode-editorWarning-foreground, #cca700); }
.cd-sev-nf { color: var(--vscode-descriptionForeground); }
.cd-back, .cd-copy, .cd-newissue {
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
    border: none; border-radius: 3px; padding: 3px 10px; font-size: 12px; cursor: pointer; flex: none;
}
.cd-back:hover, .cd-copy:hover, .cd-newissue:hover { background: var(--vscode-button-secondaryHoverBackground); }
/* Dashboard grid (#5 full layout): small data panels tile into columns as cards; the stack, stats
   strip, device line, and thread headers span the full width. auto-fit collapses to one column on a
   narrow overlay, and streamed-in panels (.cd-tile) slot into the grid as they arrive. */
.cd-body { flex: 1; overflow-y: auto; padding: 8px 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; align-content: start; }
.cd-body > * { grid-column: 1 / -1; min-width: 0; }
.cd-body > .cd-tile { grid-column: span 1; }
.cd-body > .group { background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background)); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 6px 10px; }
.cd-loading { padding: 16px; opacity: 0.7; animation: cp-pulse 1.5s ease-in-out infinite; }
.cp-item.cp-selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }

/* Codebase context streamed under an app frame (source line + git blame) \u2014 #8 made visible in-viewer. */
.cd-frame-ctx { margin: 1px 0 6px 22px; padding: 3px 6px; border-left: 2px solid var(--vscode-panel-border); }
.cd-frame-code { display: block; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; white-space: pre-wrap; word-break: break-all; }
.cd-frame-blame { display: block; font-size: 10px; opacity: 0.7; margin-top: 2px; color: var(--vscode-gitDecoration-modifiedResourceForeground, var(--vscode-descriptionForeground)); }

/* Device / OS distribution bars (renderDeviceDistribution output) \u2014 were dashboard-only; restored
   here so the in-viewer detail shows colored bars instead of plain text. */
/* Colorize the whole detail (#1), not just the stack: device meta, section headers, keys, and the
   app-vs-framework distinction all get color so the eye lands on what matters. */
.cd-body .crash-device-meta { font-size: 11px; margin: 0 0 8px; color: var(--vscode-charts-blue, var(--vscode-foreground)); }
.cd-body .crash-thread-header { font-weight: 600; font-size: 12px; margin: 10px 0 4px; padding-left: 6px; border-left: 3px solid var(--vscode-errorForeground); }
.cd-body .group-header { color: var(--vscode-textLink-foreground); font-weight: 600; cursor: pointer; }
.cd-body .group-header .match-count { color: var(--vscode-descriptionForeground); font-weight: 400; }
.cd-body .frame-badge { font-size: 10px; padding: 0 4px; border-radius: 3px; margin-right: 6px; font-weight: 700; }
.cd-body .frame-badge-app { background: var(--vscode-charts-blue, #4daafc); color: var(--vscode-editor-background); }
.cd-body .frame-badge-fw { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); opacity: 0.7; }
.cd-body .frame-app .line-text, .cd-body .frame-app-nosrc .line-text { color: var(--vscode-foreground); }
.cd-body .frame-fw { opacity: 0.55; }
.cd-body .frame-app[data-frame-file] { cursor: pointer; }
.cd-body .frame-app[data-frame-file]:hover { background: var(--vscode-list-hoverBackground); }
/* Per-frame line numbers (#1a), hover copy (#1b), app-only filter (#1d) in the crash stack. */
.cd-body .stack-frame { position: relative; }
.cd-body .frame-num { color: var(--vscode-descriptionForeground); opacity: 0.5; font-family: var(--vscode-editor-font-family, monospace); font-size: 10px; margin-right: 6px; }
.cd-body .cd-frame-copy { position: absolute; right: 4px; top: 1px; opacity: 0; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px; font-size: 11px; padding: 0 5px; cursor: pointer; }
.cd-body .stack-frame:hover .cd-frame-copy { opacity: 0.8; }
.cd-body .cd-frame-copy:hover { opacity: 1; }
/* Plan 054 5b: \u21BB\xD7N badge on a frame that stands in for a run of identical (recursive) frames. */
.cd-body .frame-repeat { margin-left: 8px; padding: 0 5px; border-radius: 3px; font-size: 10px; font-weight: 700; color: var(--vscode-badge-foreground); background: var(--vscode-badge-background); }
/* Plan 054 5b: Other-Threads grouping \u2014 \xD7N badge for collapsed identical threads, sibling names, overflow. */
.cd-body .cd-thread-count { padding: 0 5px; border-radius: 3px; font-size: 10px; font-weight: 700; color: var(--vscode-badge-foreground); background: var(--vscode-badge-background); }
.cd-body .crash-thread-names { font-size: 10px; color: var(--vscode-descriptionForeground); margin: 0 0 4px 6px; }
.cd-body .crash-thread-more { font-size: 11px; color: var(--vscode-descriptionForeground); margin: 6px 0 0 6px; font-style: italic; }
.cd-stack-controls { margin: 2px 0 4px; }
.cd-apponly { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 3px; font-size: 11px; padding: 1px 8px; cursor: pointer; opacity: 0.8; }
.cd-apponly:hover { opacity: 1; }
.cd-apponly.cd-apponly-on { opacity: 1; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-focusBorder); }
/* App-only mode hides framework rows and their folded groups. */
.cd-body.cd-appcode-only .frame-fw, .cd-body.cd-appcode-only .cd-fw-group { display: none; }

/* Frame right-click context menu (#1c). z-index beats the detail overlay (200); position:fixed so it
   escapes the overlay's overflow:hidden. */
.cd-ctxmenu { position: fixed; z-index: 300; min-width: 160px; padding: 4px 0; font-size: 12px; border-radius: 4px; background: var(--vscode-menu-background, var(--vscode-editorWidget-background)); border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border)); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); }
.cd-ctxmenu.u-hidden { display: none; }
.cd-ctxitem { padding: 4px 14px; cursor: pointer; color: var(--vscode-menu-foreground, var(--vscode-foreground)); white-space: nowrap; }
.cd-ctxitem:hover { background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground)); color: var(--vscode-menu-selectionForeground, var(--vscode-foreground)); }

/* Folded framework-frame run (#1 smart collapse): a quiet, dashed inline disclosure so the
   noise stays one click away without competing with the app frames it sits between. */
.cd-body .cd-fw-group { margin: 2px 0; }
.cd-body .cd-fw-summary {
    cursor: pointer; font-size: 11px; opacity: 0.6; padding: 1px 0 1px 22px;
    color: var(--vscode-descriptionForeground); list-style: none;
}
.cd-body .cd-fw-summary:hover { opacity: 0.95; }
.cd-body .cd-fw-group[open] > .cd-fw-summary { opacity: 0.85; margin-bottom: 2px; }
.cd-body .crash-key-name { color: var(--vscode-symbolIcon-propertyForeground, var(--vscode-foreground)); }

/* "In your project" panel (#2 / 5c): recent commits + changelog-since + annotations. */
.cd-proj { font-size: 11px; }
/* "May already be fixed" banner \u2014 the headline signal that newer releases exist after the affected
   version. Warning-tinted so it reads as actionable, not error. */
.cd-maybe-fixed { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-editorWarning-foreground, #cca700); border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground)); border-radius: 5px; padding: 5px 9px; margin: 4px 0 8px; font-weight: 600; }
.cd-proj-label { font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6; margin: 8px 0 3px; }
.cd-proj-row { display: flex; gap: 8px; align-items: baseline; padding: 1px 0; }
.cd-proj-ver, .cd-proj-sha { flex: none; font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-textLink-foreground); }
.cd-proj-date { flex: none; opacity: 0.55; min-width: 56px; }
.cd-proj-tag { flex: none; font-weight: 700; color: var(--vscode-editorWarning-foreground, #cca700); min-width: 44px; }
.cd-proj-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cd-proj-link { color: var(--vscode-textLink-foreground); text-decoration: none; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.cd-proj-link:hover { text-decoration: underline; }
/* "Seen in your logs" match row (5c-4): session:line in link color, the log text muted alongside. */
.cd-log-link { display: flex; gap: 8px; align-items: baseline; text-decoration: none; cursor: pointer; padding: 1px 0; }
.cd-log-link:hover { background: var(--vscode-list-hoverBackground); }
.cd-log-link .cd-proj-text { color: var(--vscode-descriptionForeground); }
.crash-dist-label { font-weight: 600; font-size: 11px; margin: 8px 0 4px; opacity: 0.85; }
.crash-dist-row { display: flex; align-items: center; gap: 8px; font-size: 11px; margin: 3px 0; }
.crash-dist-name { width: 140px; flex: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crash-dist-bar-bg { flex: 1; height: 9px; background: var(--vscode-panel-border); border-radius: 5px; overflow: hidden; }
/* Rounded, subtly-gradient accent bar (UI #1). */
.crash-dist-bar-fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg, var(--vscode-charts-blue, #0e70c0), var(--vscode-progressBar-background, #4daafc)); }
.crash-dist-count { width: 76px; flex: none; text-align: right; opacity: 0.8; }

` + getSetupStyles() + getDiagnosticStyles()
  );
}

// src/ui/viewer-styles/viewer-styles-project-state.ts
function getProjectStatePanelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Project state panel \u2014 slide-out (same pattern as the About panel)
   =================================================================== */
.project-state-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.project-state-panel.visible {
    display: flex;
}

.project-state-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.project-state-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.project-state-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.project-state-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.4;
}

.ps-section {
    margin-bottom: 12px;
}

.ps-row {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 2px 0;
}

.ps-label {
    flex: none;
    min-width: 110px;
    color: var(--vscode-descriptionForeground);
}

.ps-value {
    flex: 1;
    word-break: break-word;
    font-family: var(--vscode-editor-font-family, monospace);
}

.ps-commit-subject {
    padding: 0 0 2px 118px;
    color: var(--vscode-foreground);
}

.ps-clean { color: var(--vscode-testing-iconPassed, #2ea043); }
.ps-dirty { color: var(--vscode-editorWarning-foreground, #cca700); }

.ps-note,
.ps-empty {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-recurring.ts
function getRecurringPanelStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Recurring Errors Panel \u2014 slide-out
   =================================================================== */
.recurring-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.recurring-panel.visible {
    display: flex;
}

.recurring-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.recurring-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.recurring-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.recurring-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.recurring-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.recurring-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.recurring-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}

/* --- Recurring error cards --- */
.re-card {
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 6px 12px;
    font-size: 12px;
}

.re-card:hover { background: var(--vscode-list-hoverBackground); }
.re-closed { opacity: 0.5; }

.re-text {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-errorForeground);
}

.re-meta { font-size: 0.9em; opacity: 0.8; margin-top: 2px; }

.re-regression { font-size: 0.85em; opacity: 0.85; margin-top: 2px; }
.re-regression .re-commit-link { color: var(--vscode-textLink-foreground); }
.re-regression .re-commit-link:hover { text-decoration: underline; }
.re-regression code { font-size: 0.95em; }

.re-actions { display: flex; gap: 4px; margin-top: 3px; }

.re-action {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 1px 8px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 11px;
}

.re-action:hover { background: var(--vscode-button-secondaryHoverBackground); }

.recurring-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.recurring-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    animation: re-pulse 1.5s ease-in-out infinite;
}

@keyframes re-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }

.recurring-footer {
    padding: 8px 12px;
    text-align: center;
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
    font-size: 12px;
    border-top: 1px solid var(--vscode-panel-border);
}

.recurring-footer { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }
#recurring-footer-signals:hover { text-decoration: underline; }
.recurring-footer-action {
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
}
.recurring-footer-action:hover { text-decoration: underline; }

/* --- Category badges ---
   Theme-token pills matching the Crashlytics panel's .cp-badge treatment so the two
   crash surfaces read as one design language. Raw Material hex (#d32f2f + #fff text) was
   replaced with inputValidation tints + badge tokens: the old white-on-color text failed
   WCAG contrast on light themes, and the fixed hex ignored the active VS Code theme. These
   tokens carry their own foreground/border so the badges adapt to light, dark, and
   high-contrast themes. */
.re-cat-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.7em;
    padding: 1px 7px;
    border-radius: 9px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid transparent;
    vertical-align: middle;
    margin-right: 4px;
}

/* Fatal \u2192 error tint (mirrors .cp-badge-crash). */
.re-cat-fatal { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-errorForeground); border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); }
/* ANR \u2192 warning tint (mirrors .cp-badge-anr). */
.re-cat-anr { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-editorWarning-foreground); border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground)); }
/* OOM \u2192 neutral badge fill with a purple foreground so it stays distinct from fatal/anr
   without a dedicated inputValidation token (none exists for purple). */
.re-cat-oom { background: var(--vscode-badge-background); color: var(--vscode-charts-purple, var(--vscode-debugConsole-infoForeground)); border-color: var(--vscode-charts-purple, var(--vscode-contrastBorder, transparent)); }
/* Native \u2192 neutral badge tokens (mirrors .cp-badge-nf). */
.re-cat-native { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
`
  );
}

// src/ui/viewer-styles/viewer-styles-performance-db.ts
function getPerformanceDbTabStyles() {
  return (
    /* css */
    `

/* --- Database tab (Drift rollup + timeline) --- */
.pp-db-view { padding: 8px 12px; font-size: 11px; }
.pp-db-empty, .pp-db-note {
    color: var(--vscode-descriptionForeground);
    margin: 8px 0;
    line-height: 1.45;
}
.pp-db-drift-row {
    margin-bottom: 10px;
    padding: 8px 10px;
    font-size: 11px;
    line-height: 1.45;
    background: var(--vscode-textBlockQuote-background, rgba(128, 128, 128, 0.12));
    border-left: 3px solid var(--vscode-debugConsole-infoForeground, #b695f8);
    color: var(--vscode-foreground);
}
.pp-db-drift-title { font-weight: 600; }
.pp-db-drift-open {
    margin-left: 6px;
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
    border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
    background: var(--vscode-button-secondaryBackground, transparent);
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border-radius: 3px;
}
.pp-db-drift-open:hover {
    background: var(--vscode-button-secondaryHoverBackground, var(--vscode-toolbar-hoverBackground));
}
.pp-db-time-filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    padding: 6px 8px;
    font-size: 10px;
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.15));
    border-radius: 4px;
}
.pp-db-clear-time {
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
    border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
    background: var(--vscode-button-secondaryBackground, transparent);
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border-radius: 3px;
}
.pp-db-histo {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 12px 0;
    line-height: 1.4;
}
.pp-db-summary {
    margin-bottom: 12px;
    line-height: 1.45;
    color: var(--vscode-foreground);
}
.pp-db-timeline { margin-bottom: 14px; }
.pp-db-timeline-label {
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 6px;
    opacity: 0.85;
}
.pp-db-timeline-hint {
    font-weight: 400;
    opacity: 0.75;
}
.pp-db-timeline-track {
    position: relative;
    cursor: crosshair;
    touch-action: none;
}
.pp-db-viewport-band {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0;
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.25));
    border-left: 1px solid var(--vscode-editor-findMatchBorder, rgba(234, 92, 0, 0.5));
    border-right: 1px solid var(--vscode-editor-findMatchBorder, rgba(234, 92, 0, 0.5));
    pointer-events: none;
    z-index: 1;
    box-sizing: border-box;
}
.pp-db-filter-band {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0;
    background: var(--vscode-minimapSliderBackground, rgba(100, 100, 100, 0.28));
    border: 1px solid var(--vscode-focusBorder, rgba(0, 122, 204, 0.55));
    pointer-events: none;
    z-index: 2;
    box-sizing: border-box;
}
.pp-db-brush-selection {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0;
    background: var(--vscode-mergeCurrentContentBackground, rgba(64, 200, 174, 0.2));
    border: 1px dashed var(--vscode-debugConsole-infoForeground, #b695f8);
    pointer-events: none;
    z-index: 3;
    box-sizing: border-box;
}
.pp-db-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 56px;
    padding: 4px 0;
    border-bottom: 1px solid var(--vscode-panel-border);
    position: relative;
    z-index: 0;
}
.pp-db-bar-wrap {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.pp-db-bar {
    width: 100%;
    max-width: 10px;
    margin: 0 auto;
    min-height: 2px;
    background: var(--vscode-debugConsole-infoForeground, #b695f8);
    border-radius: 2px 2px 0 0;
    opacity: 0.85;
}
.pp-db-table-title {
    font-size: 10px;
    font-weight: 600;
    margin: 10px 0 6px 0;
    opacity: 0.85;
}
.pp-db-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    font-family: var(--vscode-editor-font-family, monospace);
}
.pp-db-table th {
    text-align: left;
    padding: 4px 6px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: 600;
    opacity: 0.75;
}
.pp-db-table td {
    padding: 4px 6px;
    border-bottom: 1px solid var(--vscode-panel-border, transparent);
    vertical-align: top;
    word-break: break-all;
}
.pp-db-fp { color: var(--vscode-descriptionForeground); }

`
  );
}

// src/ui/viewer-styles/viewer-styles-error-rate.ts
function getErrorRateTabStyles() {
  return (
    /* css */
    `

/* --- Error Rate summary --- */
.pp-er-summary {
    padding: 8px 12px;
    font-size: 11px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.pp-er-count { font-weight: 600; }
.pp-er-count-error { color: var(--vscode-debugConsole-errorForeground, #f48771); }
.pp-er-count-warning { color: var(--vscode-debugConsole-warningForeground, #cca700); }
.pp-er-count-spike { color: var(--vscode-debugConsole-infoForeground, #b695f8); }

/* --- Error Rate chart --- */
.pp-er-chart-container {
    padding: 8px 12px;
}

.pp-er-chart { width: 100%; height: 120px; }

.pp-er-bar { cursor: pointer; }
.pp-er-bar:hover { opacity: 0.8; }
.pp-er-bar-error { fill: var(--vscode-debugConsole-errorForeground, #f48771); }
.pp-er-bar-warning { fill: var(--vscode-debugConsole-warningForeground, #cca700); }

.pp-er-spike-marker {
    fill: var(--vscode-debugConsole-infoForeground, #b695f8);
    font-size: 10px;
    pointer-events: none;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-performance.ts
function getPerformancePanelStyles() {
  return getPerformanceDbTabStyles() + getErrorRateTabStyles() + /* css */
  `

/* ===================================================================
   Performance Panel \u2014 slide-out
   =================================================================== */
.performance-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.performance-panel.visible {
    display: flex;
}

.performance-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.performance-panel-actions { display: flex; align-items: center; gap: 4px; }

.pp-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.pp-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.pp-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.pp-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* --- Tabs --- */
.pp-tabs {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.pp-tab {
    flex: 1;
    padding: 6px 8px;
    text-align: center;
    font-size: 11px;
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
}

.pp-tab.active {
    color: var(--vscode-foreground);
    border-bottom-color: var(--vscode-debugConsole-infoForeground, #b695f8);
}

.pp-tab:hover { color: var(--vscode-foreground); }

.performance-panel-content { flex: 1; overflow-y: auto; padding: 4px 0; }

/* --- Current session groups --- */
.pp-group { border-bottom: 1px solid var(--vscode-panel-border); }

.pp-group-header {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    gap: 6px;
}

.pp-group-header:hover { background: var(--vscode-list-hoverBackground); }
.pp-group-arrow { font-size: 10px; width: 12px; }
.pp-group.pp-collapsed .pp-group-body { display: none; }
.pp-group.pp-collapsed .pp-group-arrow::after { content: '\\25B6'; }
.pp-group:not(.pp-collapsed) .pp-group-arrow::after { content: '\\25BC'; }

.pp-group-count {
    font-size: 10px;
    opacity: 0.7;
    margin-left: auto;
    color: var(--vscode-debugConsole-infoForeground, #b695f8);
}

.pp-group-stats {
    padding: 2px 12px 4px 30px;
    font-size: 11px;
    opacity: 0.7;
}

.pp-event-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 12px 3px 30px;
    font-size: 11px;
    cursor: pointer;
    font-family: var(--vscode-editor-font-family, monospace);
}

.pp-event-row:hover { background: var(--vscode-list-hoverBackground); }
.pp-event-metric { color: var(--vscode-debugConsole-infoForeground, #b695f8); }
.pp-event-time { opacity: 0.5; font-size: 10px; }

/* --- Trends table --- */
.pp-trend-table { width: 100%; font-size: 11px; border-collapse: collapse; }
.pp-trend-table th {
    text-align: left;
    padding: 4px 8px;
    font-weight: 600;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 10px;
    opacity: 0.7;
}

.pp-trend-table td { padding: 4px 8px; cursor: pointer; }
.pp-trend-table tr:hover td { background: var(--vscode-list-hoverBackground); }
.pp-trend-table tr.pp-selected td { background: var(--vscode-list-activeSelectionBackground); }
.pp-trend-up { color: var(--vscode-debugConsole-errorForeground, #f48771); }
.pp-trend-down { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
.pp-trend-stable { opacity: 0.5; }

/* --- SVG chart --- */
.pp-chart-container {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.pp-chart-title { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.pp-chart { width: 100%; height: 120px; }
.pp-chart-line { fill: none; stroke: var(--vscode-debugConsole-infoForeground, #b695f8); stroke-width: 2; }
.pp-chart-dot { fill: var(--vscode-debugConsole-infoForeground, #b695f8); }
.pp-chart-axis { stroke: var(--vscode-panel-border); stroke-width: 1; }
.pp-chart-label { fill: var(--vscode-descriptionForeground); font-size: 10px; }

/* --- Session tab (snapshot, samples, profiler) --- */
.pp-session-view { padding: 8px 12px; }
.pp-session-intro {
    margin-bottom: 14px;
    padding: 10px 12px;
    background: var(--vscode-textBlockQuote-background, rgba(128, 128, 128, 0.15));
    border-left: 3px solid var(--vscode-focusBorder, rgba(128, 128, 128, 0.5));
    font-size: 12px;
    color: var(--vscode-foreground);
    line-height: 1.45;
}
.pp-session-intro-line { margin: 0 0 6px 0; }
.pp-session-intro-line:last-child { margin-bottom: 0; }
.pp-session-intro-note { font-size: 11px; opacity: 0.85; }
.pp-session-block {
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.pp-session-block:last-child { border-bottom: none; margin-bottom: 0; }
.pp-session-title {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--vscode-foreground);
}
.pp-session-value {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.4;
    white-space: pre-line;
}

/* --- Empty / loading --- */
.pp-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.pp-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    animation: pp-pulse 1.5s ease-in-out infinite;
}

@keyframes pp-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }
`;
}

// src/ui/viewer-styles/viewer-styles-signal-layout.ts
function getSignalLayoutStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Signal Panel \u2014 single scroll (Cases, Recurring, Hot files, Performance)
   =================================================================== */
.signal-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.signal-panel.visible {
    display: flex;
}

.signal-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.signal-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.signal-panel-copy-md {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 4px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.12s ease, background 0.12s ease;
}

.signal-panel-copy-md:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.signal-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    /* 16px matches the close glyph in the Performance and Crashlytics panels; 18px here made
       the Signal panel's close button visibly larger than its siblings (inconsistent affordance). */
    font-size: 16px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 3px;
    transition: color 0.12s ease, background 0.12s ease;
}

.signal-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.signal-panel-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 8px 8px;
}

/* Accordion sections */
.signal-section {
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 4px;
}

.signal-section:last-child {
    border-bottom: none;
}

.signal-section-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 4px;
    text-align: left;
    transition: background 0.12s ease, color 0.12s ease;
}

.signal-section-header:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.15));
    color: var(--vscode-foreground);
}

.signal-section-emoji {
    margin-right: 6px;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
}

.signal-section-title {
    flex: 1;
}

.signal-section-toggle {
    width: 16px;
    height: 16px;
    opacity: 0.7;
    transition: transform 0.15s ease;
}

.signal-section-toggle::before {
    content: "\\25BC";
    font-size: 10px;
}

.signal-section-header.expanded .signal-section-toggle {
    transform: rotate(0deg);
}

.signal-section-header:not(.expanded) .signal-section-toggle {
    transform: rotate(-90deg);
}

.signal-section-body {
    padding: 4px 0 12px;
    overflow: hidden;
}

.signal-section .session-collections {
    flex: 0 0 auto;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-signal-sections.ts
function getSignalSectionsStyles() {
  return (
    /* css */
    `

.signal-view-all {
    margin: 4px 0;
    font-size: 12px;
}

.signal-view-all span {
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
}

.signal-view-all span:hover {
    text-decoration: underline;
}

.signal-recurring-inner,
.signal-section-body .recurring-list-inner {
    min-height: 0;
}

.signal-recurring-footer {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    font-size: 12px;
}

.signal-recurring-footer .recurring-footer-action {
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
}

.signal-recurring-footer .recurring-footer-action:hover {
    text-decoration: underline;
}

/* Hot files list */
.signal-hotfiles-list {
    font-size: 12px;
}

.signal-hotfile-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid var(--vscode-panel-border);
    gap: 6px;
}

.signal-hotfile-add {
    flex-shrink: 0;
}

.signal-hotfile-item:last-child {
    border-bottom: none;
}

.signal-hotfile-name {
    font-family: var(--vscode-editor-font-family);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.signal-hotfile-meta {
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
    margin-left: 8px;
}

.signal-hotfiles-empty {
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    margin: 0;
}

/* Scope label (Current log: filename) */
.signal-scope-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 6px;
}

/* Compact Performance hero (sparkline + Errors \xB7 Warnings \xB7 Snapshot) */
.signal-performance-hero {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
}

.signal-hero-sparkline-wrap {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.signal-hero-sparkline-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

.signal-hero-sparkline {
    display: block;
    stroke: var(--vscode-charts-blue, #3794ff);
}

.signal-hero-metrics {
    min-width: 0;
}

.signal-hero-hint {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.9;
}

/* Errors in this log: cap height and scroll */
.signal-errors-in-log-list {
    max-height: 180px;
    overflow-y: auto;
}

/* Session details one-line hint */
.signal-session-details-hint {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 8px 0;
}

/* This log: single empty state when no errors and no recurring */
.signal-this-log-empty {
    margin-bottom: 8px;
}

.signal-this-log-content {
    /* wrapper for errors + recurring blocks */
}

/* Narrative blocks (grouped content within one section) */
.signal-narrative-block {
    margin-bottom: 12px;
}

.signal-narrative-block:last-child {
    margin-bottom: 0;
}

.signal-narrative-subtitle {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
}

/* Recurring in this log (inside This log section) */
.signal-section-this-log .recurring-list-inner {
    min-height: 0;
}

/* Environment section */
.signal-environment-list {
    font-size: 12px;
}

.signal-env-group {
    margin-bottom: 8px;
}

.signal-env-title {
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--vscode-foreground);
}

.signal-env-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 0;
}

.signal-env-row span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Signal trend rows \u2014 clickable to open the most recent matching session */
.signal-signal-trend-row { cursor: pointer; border-radius: 3px; }
.signal-signal-trend-row:hover { background: var(--vscode-list-hoverBackground); }
/* Severity indicators: critical gets a red left border, high gets orange */
.signal-sev-critical { border-left: 3px solid var(--vscode-errorForeground, #f44); }
.signal-sev-high { border-left: 3px solid var(--vscode-editorWarning-foreground, #fa4); }
/* Recurring badge \u2014 small \u21BB marker next to the icon */
.signal-recurring-badge { font-size: 10px; opacity: 0.7; margin: 0 1px; }
/* Trend arrows \u2014 \u2191 increasing (red), \u2193 decreasing (green), \u2014 stable (muted) */
.signal-trend-up { font-size: 10px; color: var(--vscode-editorError-foreground, #f44); margin: 0 1px; }
.signal-trend-down { font-size: 10px; color: var(--vscode-testing-iconPassed, #4a4); margin: 0 1px; }
.signal-trend-stable { font-size: 10px; opacity: 0.5; margin: 0 1px; }
/* Jumpable signal rows \u2014 cursor pointer and hover highlight to indicate clickability */
.signal-jumpable { cursor: pointer; }
.signal-jumpable:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04)); }

/* Fu7: time-window filter chips. Compact row of buttons above the signals list \u2014 the active
   chip gets the editor-foreground border so it reads as pressed without needing a fill change. */
.signal-tw-filter {
    display: flex;
    gap: 4px;
    margin: 4px 0 6px;
    flex-wrap: wrap;
}
/* Fu5 sort toggle sits just under the time-window chips, sharing the chip style. */
.signal-sort-toggle {
    display: flex;
    gap: 4px;
    margin: 0 0 6px;
}
.signal-tw-chip {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 10px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
    line-height: 1.4;
}
.signal-tw-chip:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
}
.signal-tw-chip-active {
    border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground, #3794ff));
    background: var(--vscode-list-activeSelectionBackground, transparent);
    color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
}

/* Fu3: inline evidence preview under a signal title. Three compact lines of raw log text so the
   user can verify what the signal is pointing at without clicking through. Width is constrained
   so long lines truncate rather than push the meta column out of the row. */
.signal-evidence-preview { width: 100%; margin-top: 3px; padding-left: 18px; font-size: 11px; opacity: 0.75; line-height: 1.35; }
.signal-evidence-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--vscode-descriptionForeground, var(--vscode-foreground)); }
/* Force the row to wrap so the preview drops below the icon/meta cells instead of breaking flex. */
.signal-in-log-row { flex-wrap: wrap; }

/* Non-jumpable in-log signal rows that carry a detail (e.g. "Drift Advisor issues") are clickable
   to reveal that detail inline \u2014 same pointer/hover affordance as jumpable rows so the row reads as
   interactive even though there is no log line to scroll to. */
.signal-detail-toggle { cursor: pointer; }
.signal-detail-toggle:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04)); }
/* Inline detail body, full-width so it drops below the wrapped row rather than squeezing the meta
   column. pre-wrap keeps multi-part summaries (e.g. "1 error, 2 warnings") readable. */
.signal-detail-body { width: 100%; margin-top: 3px; padding-left: 18px; font-size: 11px; opacity: 0.85; line-height: 1.4; white-space: pre-wrap; color: var(--vscode-descriptionForeground, var(--vscode-foreground)); }

/* Fu2: scroll-lock pulse. Brief highlight on lines around the jump target so the eye lands on
   the right place. Keyframes fade in then out so the cue is clearly transient \u2014 no leftover
   visual debt. Cleanup is by JS class-remove on animationend (see part-d). */
@keyframes saropaLinePulse {
    0%   { background-color: transparent; }
    25%  { background-color: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 179, 8, 0.3)); }
    100% { background-color: transparent; }
}
.line-pulse {
    animation: saropaLinePulse 900ms ease-in-out 1;
}

/* Plan 053-A: filter-suggestions section inside Insights panel. Rows stack the pattern + impact,
   sample line, and Accept/Reject buttons. Compact size matches the existing signal-env-row
   density so the section doesn't dominate the panel even when several suggestions are pending. */
.signal-suggestions-list { font-size: 12px; }
.signal-suggestion-row {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 6px 8px;
    margin-bottom: 6px;
    background: var(--vscode-editor-background, transparent);
}
.signal-suggestion-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
}
.signal-suggestion-pattern {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
}
.signal-suggestion-impact {
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    font-size: 11px;
}
.signal-suggestion-sample {
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 4px;
    opacity: 0.85;
}
.signal-suggestion-actions {
    display: flex;
    gap: 6px;
}
.signal-suggestion-accept,
.signal-suggestion-reject {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px;
    padding: 2px 10px;
    font-size: 11px;
    cursor: pointer;
}
.signal-suggestion-accept:hover {
    background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground, rgba(255,255,255,0.04)));
    border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground, #3794ff));
}
.signal-suggestion-reject:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-signal-hero.ts
function getSignalHeroStyles() {
  return (
    /* css */
    `

/* Inline add-to-case button on recurring cards */
.re-add-to-case {
    margin-right: 4px;
    font-weight: bold;
    cursor: pointer;
}

.re-add-to-case:hover {
    text-decoration: underline;
}

/* Embedded performance panel inside Signal panel */
.signal-hero-block {
    padding-bottom: 6px;
    padding-left: 8px;
    margin-left: -8px;
    border-left: 3px solid transparent;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 4px;
}

.signal-hero-block.signal-hero-has-errors {
    border-left-color: var(--vscode-errorForeground, #f14c4c);
}

.signal-hero-block.signal-hero-has-warnings {
    border-left-color: var(--vscode-editorWarning-foreground, #cca700);
}

.signal-hero-block.signal-hero-has-errors.signal-hero-has-warnings {
    border-left-color: var(--vscode-errorForeground, #f14c4c);
}

/* The error/warning COUNT is the headline of the hero. Without emphasis the whole metric line is
   flat 11px text and "5" reads no louder than its label. Bumping the number to 13px/700 with the
   severity color (and tabular figures so multi-digit counts stay aligned) makes the count the first
   thing the eye lands on. flex-shrink:0 keeps it from collapsing when the hero row is tight. */
.signal-hero-num {
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}

.signal-hero-num-error { color: var(--vscode-errorForeground); }
.signal-hero-num-warn { color: var(--vscode-editorWarning-foreground); }

.signal-section-session-details .performance-panel {
    display: flex !important;
    min-width: 0;
    border: none;
    box-shadow: none;
    background: transparent;
}

.signal-section-session-details .performance-panel-header {
    padding: 4px 0 8px;
}

.signal-section-session-details .pp-close {
    display: none;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-signal.ts
function getSignalPanelStyles() {
  return getSignalLayoutStyles() + getSignalSectionsStyles() + getSignalHeroStyles();
}

// src/ui/viewer-styles/viewer-styles-ai.ts
function getAiStyles() {
  return (
    /* css */
    `

/* ===================================================================
   AI Activity Lines
   Shared base for all ai-* categories. Distinguished by a coloured
   left border and slightly reduced opacity vs primary debug output.
   =================================================================== */

/* Rail is drawn with inset box-shadow (NOT border-left) so it is OUT OF FLOW.
   With border-left:3px the AI rows' content shifted 3px right of non-AI rows
   \u2014 the line-number digits on every AI line landed 3px right of the digits
   on regular log lines, breaking column alignment across the viewport.
   box-shadow:inset paints the same 3px stripe inside the row's left edge
   without adding to its box width, so columns stay straight. Per-category
   color overrides set --ai-rail-color; the .ai-line rule reads it via fallback. */
.line.ai-line {
    --ai-rail-color: var(--vscode-terminal-ansiMagenta, #bc3fbc);
    box-shadow: inset 3px 0 0 var(--ai-rail-color);
    opacity: 0.85;
}
/* Decoration-off rows have no .line-decoration prefix, so they don't inherit
   the regular hanging-indent padding from viewer-styles-decoration.ts. Without
   this fallback the message would butt directly against the 3px accent rail.
   Scoped :not(.cols) \u2014 grid AI rows (plan 055 Phase 2) already get the shared
   1.25em clearance from .line.cols, so this legacy fallback must not stack a
   second indent on top of it. */
.line.ai-line:not(.cols):not(:has(.line-decoration)) {
    padding-left: 13px;
}

/* --- User prompt breadcrumbs --- */
.line.ai-prompt {
    --ai-rail-color: var(--vscode-terminal-ansiCyan, #11a8cd);
    font-style: italic;
}
.line.ai-prompt .ai-prefix {
    color: var(--vscode-terminal-ansiCyan, #11a8cd);
}

/* --- File mutations (Write, Edit) --- */
.line.ai-edit {
    --ai-rail-color: var(--vscode-terminal-ansiYellow, #e5e510);
}
.line.ai-edit .ai-prefix {
    color: var(--vscode-terminal-ansiYellow, #e5e510);
}

/* --- Bash commands --- */
.line.ai-bash {
    --ai-rail-color: var(--vscode-terminal-ansiMagenta, #bc3fbc);
}
.line.ai-bash .ai-prefix {
    color: var(--vscode-terminal-ansiMagenta, #bc3fbc);
}

/* --- Read/search operations (dimmed when visible) --- */
.line.ai-read {
    --ai-rail-color: var(--vscode-descriptionForeground, #717171);
    opacity: 0.6;
}
.line.ai-read .ai-prefix {
    color: var(--vscode-descriptionForeground, #717171);
}

/* --- System warnings (rate limits, hook blocks) --- */
.line.ai-system {
    --ai-rail-color: var(--vscode-editorWarning-foreground, #ff9800);
}
.line.ai-system .ai-prefix {
    color: var(--vscode-editorWarning-foreground, #ff9800);
}

/* --- AI prefix label (e.g., "[AI Edit]") --- */
.ai-prefix {
    font-weight: 600;
    margin-right: 6px;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-run-separator.ts
function getRunSeparatorStyles() {
  return (
    /* css */
    `
/* Left padding aligns with log line content (same as viewer-styles-decoration) so the bar does not overlap the severity bar. */
.run-separator {
    min-height: 72px;
    background: linear-gradient(135deg, #c2185b 0%, #880e4f 100%);
    margin: 0;
    padding: 8px 12px 8px 14.25em;
    display: flex;
    align-items: center;
    color: rgba(255,255,255,0.95);
    font-size: 12px;
    box-sizing: border-box;
}
.run-separator-inner {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    border-left: 4px solid #ad1457;
    padding-left: 8px;
}
.run-sep-title {
    font-weight: bold;
    margin-right: 4px;
}
.run-sep-times {
    opacity: 0.95;
}
.run-sep-duration {
    opacity: 0.9;
    font-size: 11px;
}
.run-sep-counts {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
}
.run-sep-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    font-size: 10px;
    font-weight: bold;
    padding: 0 4px;
}
.run-sep-dot-error { background: #f44336; color: #fff; }
.run-sep-dot-warning { background: #ff9800; color: #000; }
.run-sep-dot-perf { background: #9c27b0; color: #fff; }
/* Info dot blue, matching the rotated level palette (Info=blue, Notice=cyan, DB=green). */
.run-sep-dot-info { background: #2196f3; color: #fff; }
.run-sep-dot-none { background: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }
`
  );
}

// src/ui/viewer-styles/viewer-styles-replay.ts
function getReplayStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Session Replay \u2014 horizontal panel (bottom-right of log area)
   =================================================================== */

/* Horizontal floating panel \u2014 bottom-right, above footer */
.replay-bar {
    display: none !important;
    position: absolute;
    bottom: 8px;
    right: calc(8px + var(--mm-w, 60px));
    z-index: 16;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
}
.replay-bar.replay-bar-visible {
    display: flex !important;
    animation: replay-bar-enter 0.15s ease-out;
}
@keyframes replay-bar-enter { from { opacity: 0; } to { opacity: 1; } }

/* Transport buttons row (play/pause/stop side by side) */
.replay-btn-row {
    display: flex;
    gap: 2px;
}
.replay-btn {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    padding: 2px 5px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 12px;
}
.replay-btn:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}

/* Mode & speed selects \u2014 compact inline */
.replay-mode, .replay-speed {
    font-size: 10px;
    padding: 1px 2px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    text-align: center;
}

/* Horizontal scrubber \u2014 fills remaining horizontal space */
.replay-scrubber {
    flex: 1;
    min-width: 80px;
    height: 16px;
}

/* Status text */
.replay-status {
    font-size: 9px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground);
}

`
  );
}

// src/ui/viewer-styles/viewer-styles-root-cause-hints.ts
function getRootCauseHypothesesStyles() {
  return (
    /* css */
    `
.root-cause-hypotheses {
    flex-shrink: 0;
    margin: 0 0 4px 0;
    padding: 6px 10px 8px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
    font-size: 12px;
    line-height: 1.35;
    max-height: 42vh;
    overflow: auto;
    transition: max-height 0.25s ease-out, opacity 0.25s ease-out,
                padding 0.25s ease-out, margin 0.25s ease-out,
                border-color 0.25s ease-out;
}
/* Collapsed by filter drawer mutual exclusion */
.root-cause-hypotheses.signals-drawer-hidden {
    max-height: 0 !important;
    opacity: 0;
    overflow: hidden;
    padding-top: 0;
    padding-bottom: 0;
    margin: 0;
    border-color: transparent;
}
.root-cause-hypotheses-list {
    margin: 0;
    padding-left: 1.15em;
}
.root-cause-hypotheses-list li {
    margin: 4px 0;
    display: flex;
    align-items: baseline;
    gap: 4px;
}
/* Hypothesis text as clickable report button \u2014 flex: 1 lets it
   fill remaining width so long signal text wraps instead of
   overflowing the panel. */
.rch-report-btn {
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
    appearance: none;
    flex: 1;
    min-width: 0;
    white-space: normal;
    word-break: break-word;
}
.rch-report-btn:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline;
}
.rch-dismiss-btn {
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 4px;
    margin-left: 2px;
    border-radius: 2px;
    flex-shrink: 0;
    align-self: flex-start;
    opacity: 0;
    transition: opacity 0.15s;
}
.root-cause-hypotheses-list li:hover .rch-dismiss-btn {
    opacity: 1;
}
.rch-dismiss-btn:hover {
    color: var(--vscode-errorForeground, #f48771);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.rch-restore-btn {
    display: block;
    margin: 6px 0 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    cursor: pointer;
    appearance: none;
}
.rch-restore-btn:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline;
}
.root-cause-hyp-conf {
    display: inline-block;
    flex-shrink: 0;
    font-size: 12px;
    line-height: 1;
    opacity: 0.92;
    cursor: help;
}
/* Brief toast shown after dismiss */
.rch-toast {
    display: inline-block;
    margin-left: 8px;
    font-size: 11px;
    color: var(--vscode-charts-green, #89d185);
    animation: rch-toast-fade 1.5s ease-out forwards;
}
/* Cross-session trend badge: small \u21BBN indicator between confidence emoji and signal text */
.rch-trend-badge {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.75;
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
}
@keyframes rch-toast-fade {
    0%, 60% { opacity: 1; }
    100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
    .root-cause-hypotheses { transition: none !important; }
    .rch-dismiss-btn { transition: none !important; }
    .rch-toast { animation: none !important; }
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-toolbar.ts
function getToolbarStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Toolbar \u2014 persistent top bar (never hides on scroll)
   =================================================================== */
.viewer-toolbar {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    min-height: 28px;
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
    user-select: none;
}
.viewer-toolbar.paused {
    color: var(--vscode-statusBarItem-warningForeground, #fc0);
    background: var(--vscode-statusBarItem-warningBackground, rgba(252, 192, 0, 0.15));
}
.toolbar-left {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}
.toolbar-right {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    overflow: hidden;
}
.toolbar-filename {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: color 0.15s ease;
}
.toolbar-filename:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
}
.footer-filename {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
}
.toolbar-filename:hover .footer-filename {
    text-decoration-style: solid;
}
.toolbar-sep {
    width: 1px;
    height: 16px;
    background: var(--vscode-panel-border);
    flex-shrink: 0;
}

/* ===================================================================
   Toolbar Icon Buttons
   =================================================================== */
.toolbar-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 22px;
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    border-radius: 3px;
    position: relative;
    flex-shrink: 0;
}
.toolbar-icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
}
.toolbar-icon-btn:hover:not(:disabled) {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-foreground);
}
.toolbar-icon-btn[aria-expanded="true"] {
    background: var(--vscode-toolbar-activeBackground, rgba(99, 102, 106, 0.31));
    color: var(--vscode-foreground);
}
.toolbar-badge {
    position: absolute;
    top: 0;
    right: 0;
    font-size: 8px;
    min-width: 12px;
    height: 12px;
    line-height: 12px;
    text-align: center;
    border-radius: 6px;
    background: var(--vscode-badge-background, #007acc);
    color: var(--vscode-badge-foreground, #fff);
    font-weight: bold;
}
.toolbar-badge:empty { display: none; }

/* Decoration toggle \u2014 dimmed when all decorations are off */
.toolbar-deco-inactive {
    opacity: 0.35;
}

/* Nav label in toolbar */
.viewer-toolbar .nav-bar-label { font-size: 11px; white-space: nowrap; }
.viewer-toolbar .session-details-inline { font-size: 11px; opacity: 0.7; }

/* ===================================================================
   Search Flyout \u2014 floating overlay anchored top-right of log area
   =================================================================== */
.search-flyout {
    position: absolute;
    top: 0;
    /* Indent from the right frame so the flyout doesn't hug the panel edge
       (previously right:0 made the input feel pinned and cramped). */
    right: 12px;
    z-index: 100;
    /* Bumped width to give the textbox usable space after the case/word/regex
       toggles, the "Showing N of M" badge, and nav/funnel buttons all share the row. */
    width: 480px;
    max-width: calc(100% - 24px);
    background: var(--vscode-editorWidget-background, var(--vscode-panel-background));
    color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
    border-top: none;
    border-radius: 0 0 4px 4px;
    padding: 4px 8px;
    box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.36));
}
.search-flyout.u-hidden { display: none; }
.search-flyout-row { display: flex; align-items: center; }
.search-flyout-options { padding: 4px 0; }
.search-flyout-history { max-height: 150px; overflow-y: auto; }

/* ===================================================================
   Actions Dropdown \u2014 positioned below actions button
   =================================================================== */
.toolbar-actions-dropdown {
    position: absolute;
    display: none;
    z-index: 100;
}
.toolbar-actions-dropdown.toolbar-actions-visible {
    display: block;
}
.toolbar-actions-popover {
    display: none;
    transform-origin: top;
    min-width: 200px;
    max-width: min(90vw, 420px);
    width: max-content;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    background: var(--vscode-editorWidget-background, var(--vscode-panel-background));
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

/* Preset submenu \u2014 flies out to the left from the Presets menu item */
.toolbar-actions-submenu-trigger {
    position: relative;
}
.toolbar-actions-submenu-trigger .codicon-chevron-right {
    margin-left: auto;
    font-size: 10px;
    opacity: 0.6;
}
.toolbar-actions-submenu {
    display: none;
    position: absolute;
    right: 100%;
    top: -4px;
    min-width: 180px;
    width: max-content;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    background: var(--vscode-editorWidget-background, var(--vscode-panel-background));
    box-shadow: -4px 4px 16px rgba(0, 0, 0, 0.25);
    margin-right: 2px;
}
.toolbar-actions-submenu-trigger:hover > .toolbar-actions-submenu,
.toolbar-actions-submenu-trigger.submenu-open > .toolbar-actions-submenu {
    display: block;
}
/* Highlight the currently active preset */
.preset-active {
    background: var(--vscode-list-activeSelectionBackground, rgba(0, 122, 204, 0.3));
    color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
}
/* toolbar-actions-open: toolbar script; footer-actions-open: replay script compat */
.toolbar-actions-popover.toolbar-actions-open,
.toolbar-actions-popover.footer-actions-open { display: block; }

/* Reuse footer-actions-item styles for backward compat */
.toolbar-actions-dropdown .footer-actions-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--vscode-foreground);
    font-size: 11px;
    text-align: left;
    padding: 4px 6px;
    cursor: pointer;
    white-space: nowrap;
}
.toolbar-actions-dropdown .footer-actions-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.toolbar-actions-dropdown .footer-actions-separator {
    border: none;
    border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    margin: 3px 4px;
}

/* ===================================================================
   Footer compat styles (for elements that kept footer class names)
   =================================================================== */
#line-count { white-space: nowrap; font-variant-numeric: tabular-nums; }
.footer-selection { white-space: nowrap; font-variant-numeric: tabular-nums; margin-left: 6px; }
.footer-selection:empty { display: none; }
@keyframes badge-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* Flyout / drawer slide-down open & slide-up close */
@keyframes flyout-open {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
}
@keyframes flyout-close {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-8px); }
}
.anim-flyout-open  { animation: flyout-open  0.25s ease-out backwards; }
.anim-flyout-close { animation: flyout-close 0.2s  ease-in  forwards; }

/* Actions dropdown scale-from-top open & close */
@keyframes dropdown-open {
    from { opacity: 0; transform: scaleY(0); }
    to   { opacity: 1; transform: scaleY(1); }
}
@keyframes dropdown-close {
    from { opacity: 1; transform: scaleY(1); }
    to   { opacity: 0; transform: scaleY(0); }
}
.anim-dropdown-open  { animation: dropdown-open  0.15s ease-out backwards; }
.anim-dropdown-close { animation: dropdown-close 0.15s ease-in  forwards; }

/* Hidden lines counter (migrated from footer) */
.hidden-lines-counter {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    padding: 1px 4px;
    border-radius: 3px;
}
.hidden-lines-counter:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* ===================================================================
   Reduced Motion
   =================================================================== */
@media (prefers-reduced-motion: reduce) {
    .search-flyout,
    .filter-drawer,
    .toolbar-actions-popover,
    .anim-flyout-open,
    .anim-flyout-close,
    .anim-dropdown-open,
    .anim-dropdown-close { animation: none !important; transition: none !important; }
}

`
  );
}

// src/ui/viewer-styles/viewer-styles-filter-drawer.ts
function getFilterDrawerStyles() {
  return (
    /* css */
    `

/* ===================================================================
   Filters Panel \u2014 full-height slide-out in panel-slot
   =================================================================== */
.filters-panel {
    width: 100%;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}
.filters-panel.visible { display: flex; }

/* Header */
.filters-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--vscode-sideBarTitle-background, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    font-weight: bold;
    font-size: 13px;
    flex-shrink: 0;
}
.filters-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}
.filters-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* Levels row \u2014 compact, wraps inside the panel */
.filters-panel .filter-drawer-levels {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 6px 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
.filter-drawer-level-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    flex: 1;
}
.filter-drawer-level-row .level-circle {
    width: auto;
    padding: 1px 3px;
    gap: 2px;
}
.filter-drawer-level-row .level-count { min-width: 0; }
.filter-drawer-level-row .level-label { display: none; }
.filter-drawer-level-row .level-flyup-header {
    border-bottom: none;
    margin-bottom: 0;
    padding: 0;
}
.level-flyup-header button {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 3px;
}
.level-flyup-header button:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.level-flyup-header button.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.level-flyup-header button.active:hover {
    background: var(--vscode-button-hoverBackground);
}
.filter-drawer-context {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-left: 4px;
}
.filter-drawer-context input[type="range"] { width: 60px; }

/* Log Sources divider between tiers */
.log-inputs-divider {
    border-top: 1px dashed var(--vscode-panel-border);
    margin: 4px 0;
}

/* ===================================================================
   Tab Layout \u2014 vertical sidebar (left) + panel content (right)
   Fills remaining height below the levels row.
   =================================================================== */
.filter-tab-layout {
    display: flex;
    flex: 1;
    min-height: 0;
}

/* Vertical tab bar \u2014 stacked buttons on the left */
.filter-tab-bar {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-right: 1px solid var(--vscode-panel-border);
    padding: 4px 0;
    gap: 1px;
}
.filter-tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px 5px 6px;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    text-align: left;
    transition: color 0.1s, border-color 0.1s;
}
.filter-tab:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-list-hoverBackground);
}
.filter-tab[aria-selected="true"] {
    color: var(--vscode-foreground);
    border-left-color: var(--vscode-focusBorder, #007fd4);
    font-weight: 600;
}
.filter-tab .codicon { font-size: 14px; flex-shrink: 0; }

/* Labels hidden when tab bar labels are toggled off */
.filter-tab-label { pointer-events: none; }
.filter-tab-bar:not(.ftb-labels-visible) .filter-tab-label,
.filter-tab-bar:not(.ftb-labels-visible) .filter-tab-count {
    display: none;
}
/* When labels hidden, reduce padding so icons are compact */
.filter-tab-bar:not(.ftb-labels-visible) .filter-tab {
    padding: 5px 8px;
    justify-content: center;
}

/* Count suffix \u2014 hidden when empty, dimmed text */
.filter-tab-count {
    font-size: 10px;
    opacity: 0.7;
}
.filter-tab-count:empty { display: none; }

/* ===================================================================
   Tab Panels \u2014 fill remaining width, scroll independently
   =================================================================== */
.filter-tab-panels {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
}
.filter-tab-panel {
    padding: 6px 10px;
}
.filter-tab-panel[style*="display: none"],
.filter-tab-panel[style*="display:none"] {
    padding: 0;
    overflow: hidden;
}

/* Filter drawer summary \u2014 hidden, kept for backward compat */
.filter-drawer-summary {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

`
  );
}

// src/ui/viewer-styles/viewer-styles-lines.ts
function getLineStyles() {
  return (
    /* css */
    `
/* --- Individual log lines --- */
.line {
    white-space: pre-wrap;
    /* break-all shredded monospace decorations; Debug Console\u2013style wrapping first, break long tokens only if needed. */
    word-break: normal;
    overflow-wrap: anywhere;
    padding: 0 8px 0 1.85em;
    /* Fallback 1.1 matches the JS default in viewer-layout.ts and the package.json
       setting default \u2014 keep all three in sync. 1.5 produced ~0.5em of visible intra-line
       leading that users read as a gap between every row in dense logs. */
    line-height: var(--log-line-height, 1.1);
    height: calc(1em * var(--log-line-height, 1.1));
    overflow: visible;
    transition: background 0.1s ease;
}
/* Rows that embed a block-level child (currently: expanded SQL repeat drilldown
   panel inside repeat-notification rows) must grow to fit the panel. WHY a class
   rather than always using min-height on .line: the virtual scroller's prefix
   sums treat each row as exactly calcItemHeight() tall; non-expanded rows must
   stay at the strict fixed height so block-flow positions match the prefix
   sums. The class is applied only when the item carries the open-state flag
   that calcItemHeight() also reads, keeping DOM and scroll math in sync.
   Failure mode this avoids: clicking "N \xD7 SQL repeated:" expands the panel,
   the .line stays 1em tall, overflow: visible lets the panel paint on top
   of the next 5\u201310 rows, hiding real log content. */
.line.line-has-block {
    height: auto;
    min-height: calc(1em * var(--log-line-height, 1.1));
}
/* Chip rows (repeat-notification, n-plus-one-signal) and stack headers do not
   carry a real decoration prefix, but when decorations are globally on they
   still need to start at the same content column as decorated lines so the
   view reads as a single tabular column. This rule applies only padding-left,
   NOT the negative text-indent used by .line:has(.line-decoration) \u2014 without a
   prefix to fill the indent space the first inline content would otherwise
   render pulled left to ~1.25em, breaking the column. The .stack-header
   selector overrides that element's own padding-left:16px (viewer-styles-content.ts)
   \u2014 without it the header juts far left of the message column. */
.line.line-deco-spacer-only,
.stack-header.line-deco-spacer-only {
    padding-left: var(--deco-prefix-width-em, 14.25em);
}
.line:hover { background: var(--vscode-list-hoverBackground); }
/* .stack-gutter-spacer rule retired alongside the inline collapse chevron
   it compensated for. The counter-row chevron now lives on the same column
   on every row (stack-header or regular), so no compensating spacer is needed. */

/* --- Floating copy icon (single overlay pinned to right edge of #log-content) --- */
/* Ghost-paint defense for virtualized row recycle \u2014 see
   plans/history/2026.06/2026.06.02/viewer-row-paint-ghosting-attempts.md
   for the full history.

   Symptom: the viewport renderer used to swap visible rows via
   \`viewportEl.innerHTML = \u2026\`. When a slot recycled from one severity (e.g.
   level-info blue) to another (level-database green), Chromium could leave
   un-invalidated pixels of the prior row's text inside the slot's bounding
   box, so faint blue characters ghost through the new green text. The
   user-visible repro is "DRIFT: Drift debug server disconnected" rendered
   with the prior info row's blue text bleeding through; a :hover repaint
   clears it. Four layered defenses sit here, each addressing a different
   point in the paint pipeline:

   1. position: relative + isolation: isolate \u2014 gives each row its own
      stacking context so the severity dot's ::before (z-index 2) and the
      chain-stripe ::after (z-index 1) from a *previous* row that overflows
      into this row's space (via overflow: visible) resolve INSIDE the row.
      Without it, an overshooting ::after composed against the global
      stacking context could paint over this row's dot at the overlap.

   2. transform: translateZ(0) \u2014 attempt #1 (commit 49297d75). A
      compositor-layer hint promoting each row to its own GPU layer so paint
      invalidation is per-row on row recycle. By itself this turned out to
      be insufficient in production v7.17.0 \u2014 the user still saw ghosting on
      the DRIFT disconnect line. Kept here because it is a cheap hint that
      can still help on Chromium versions where the heuristic honors it; it
      composes with (3) and (4) below.

   3. background: var(--vscode-editor-background) \u2014 attempt #2 (this
      commit). Each row paints an opaque fill rect before its text content,
      so any stale pixels left behind by Chromium's paint cache are
      physically overwritten by the row's own background. Same color as
      the editor panel parent, so visually invisible, but the fill DOES get
      rasterized, which is the point. This is the most reliable defense
      because it does not depend on browser layer-promotion heuristics.

   4. Atomic DOM swap via <template> + replaceChildren()/appendChild() in
      viewer-data-viewport.ts replaces the innerHTML fast path entirely.
      Forces full disposal of the prior child nodes before fresh nodes
      attach, so the new row has no paint-cache lineage with whatever
      previously occupied that physical slot.

   Bounded cost: virtualization keeps ~50 rows live, so the GPU/compositor
   footprint stays small regardless of how many of these the browser
   actually materializes. The opaque background also does NOT clip the
   severity-gutter ::after stripe overshoot (bottom: -50%) \u2014 only
   contain: paint would, which is why we deliberately avoid it. */
.line, .stack-header {
    position: relative;
    isolation: isolate;
    transform: translateZ(0);
    background: var(--vscode-editor-background);
}
#copy-float {
    display: none;
    position: absolute;
    font-size: 14px;
    padding: 2px;
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editor-background);
    border-radius: 3px;
    user-select: none;
    z-index: 10;
}
#copy-float:hover {
    color: var(--vscode-editor-foreground);
    background: var(--vscode-button-hoverBackground, rgba(90,93,94,0.31));
}
.copy-toast {
    position: fixed;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.15s ease;
    pointer-events: none;
    z-index: 300;
}
.copy-toast.visible { opacity: 1; }

/* --- Clickable source file links within log lines --- */
.source-link {
    color: var(--vscode-editorLineNumber-foreground, #858585);
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s ease;
}
.source-link:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline;
}
/* Per-segment hover highlight while Ctrl/Cmd is held.
   :has(~ .source-link-seg:hover) matches any segment that has a LATER
   sibling being hovered \u2014 combined with :hover on the hovered segment
   itself, this lights up the cumulative prefix the click would filter on.
   Without the body.ctrl-held gate the segments would highlight on plain
   hover too, defeating the visual cue that Ctrl unlocks a different
   action (filter) than plain click (open file). */
body.ctrl-held .source-link-seg:hover,
body.ctrl-held .source-link-seg:has(~ .source-link-seg:hover) {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline;
}
body.ctrl-held .source-link {
    cursor: cell;
}

/* --- Clickable URL links within log lines --- */
.url-link {
    color: var(--vscode-editorLineNumber-foreground, #858585);
    cursor: pointer;
    text-decoration: underline;
    transition: color 0.15s ease;
}
.url-link:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
}

/* --- Focus indicators for keyboard navigation --- */
button:focus-visible, .ib-icon:focus-visible, input:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007acc);
    outline-offset: -1px;
}

/* --- stderr output lines (DAP category "stderr") --- */
.line.cat-stderr {
    color: var(--vscode-debugConsole-errorForeground, #f48771);
}

/* --- Log level styling (error/warning/performance/info) --- */
.line.level-error {
    color: var(--vscode-debugConsole-errorForeground, #f48771);
}
/* Softer than primary fault lines; dashed edge matches severity bar "recent context" tone.
   Uses outline-style trick: inset box-shadow avoids shifting content (no padding override). */
.line.recent-error-context {
    box-shadow: inset 2px 0 0 color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 50%, var(--vscode-panel-border, #555));
}
.line.level-error.recent-error-context {
    color: color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 72%, var(--vscode-editor-foreground, #d4d4d4));
}
.line.level-warning {
    color: var(--vscode-debugConsole-warningForeground, #cca700);
}
/* Performance: purple bar + text (--vscode-charts-purple) matches level-bar-performance. */
.line.level-performance {
    color: var(--vscode-charts-purple, #a855f7);
}
/* Info: blue \u2014 same token as Notice/Framework chart blue. Why we moved off
   debugConsole-infoForeground: that token resolves to a purple-ish tint in
   several themes (and the fallback is #b695f8 purple), which clashed with
   Performance (also purple). Anchoring Info to charts-blue keeps the
   "standard info blue" reading users expect and frees the cyan/green
   space for Notice and Database below. */
.line.level-info {
    color: var(--vscode-charts-blue, #2196f3);
}
.line.level-todo {
    color: var(--vscode-terminal-ansiWhite, #e5e5e5);
    opacity: 0.9;
}
.line.level-debug {
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    opacity: 0.8;
}
/* Notice: cyan \u2014 distinct from Info (blue) and Database (green). Notice is a
   step above Info but below Warning, so a cooler hue between blue and green
   reads as "pay attention but not urgent". */
.line.level-notice {
    color: var(--vscode-terminal-ansiCyan, #00bcd4);
}
/* Database: green \u2014 distinct from Notice (cyan). Green reads as "neutral
   activity, healthy traffic" which fits SQL query output (it is not an
   error or warning, just a record of what the DB did). */
.line.level-database {
    color: var(--vscode-charts-green, #4caf50);
}

/* --- ASCII separator lines (===, ---, +---, Drift/Unicode box banners, etc.) --- */
.line.separator-line {
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    opacity: 0.8;
    word-break: normal;
    overflow-wrap: normal;
    /* One row per captured log line; scroll #log-content horizontally if the banner is wider than the pane. */
    white-space: pre;
}

/* --- No-wrap mode: horizontal scroll instead of wrapping --- */
#log-content.nowrap {
    overflow-x: auto;
}
#log-content.nowrap .line,
#log-content.nowrap .stack-header,
#log-content.nowrap .stack-frames .line {
    white-space: pre;
    word-break: normal;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-columns.ts
function getColumnStyles() {
  return (
    /* css */
    `
/* --- Reusable column primitive (plan 055) --- */
.cols {
    display: grid;
    align-items: baseline;
}
/* The decoration wrapper is display:contents so its .deco-cell children become
   direct grid items of the row (keeps the JS hook without a nesting level). */
.cols .line-decoration { display: contents; }

/* Log-gutter consumer: 6 decoration tracks + message, sized by --grid-cols.
   padding-left reserves the severity-bar clearance (matches the old 1.25em).
   Multi-frame stack-header rows are NOT .line (they carry .stack-header for the
   collapse click handler), so the gutter selectors name both \u2014 same template var,
   same overlap-proof contract, so a stack header's message aligns under the same
   column as the regular log rows around it (plan 055 Phase 2). */
.line.cols, .stack-header.cols { padding-left: 1.25em; }
.line.log-cols, .stack-header.log-cols { grid-template-columns: var(--grid-cols, 0 0 0 0 0 0 1fr); }

/* Each decoration datum is its own clipping cell \u2014 no merged content, no spill. */
.deco-cell {
    overflow: hidden;
    white-space: nowrap;
    min-width: 0;
}
/* Variable-width parts (the tag) clip with an ellipsis; the full value stays on
   the title tooltip. Fixed-width parts (counter, timestamp, \u2026) never clip
   because their tracks are sized to the known character count. */
.deco-cell.ellipsis { text-overflow: ellipsis; }

/* Fixed column placement \u2014 see file header (why not auto-flow). */
.deco-cell-num { grid-column: 1; }
.deco-cell-time { grid-column: 2; }
.deco-cell-sessElapsed { grid-column: 3; }
.deco-cell-pidtid { grid-column: 4; }
.deco-cell-level { grid-column: 5; }
.deco-cell-tag { grid-column: 6; }

/* Message track: pinned last, min-width:0 so it wraps inside its column and can
   never push or be pushed over the decoration cells. Keeps the row's own
   white-space (pre-wrap / nowrap mode) for the message text. Stack-header and
   stack-frame rows share the column so their message/frame text aligns under the
   same track as the regular rows above them. */
.line.cols .line-msg, .stack-header.cols .line-msg {
    grid-column: 7;
    min-width: 0;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-ascii-art.ts
function getAsciiArtStyles() {
  return (
    /* css */
    `
/* --- ASCII Art Block: grouped separator lines rendered as one visual unit --- */

/* All art-block lines: uniform color, tight layout, no wrapping.
   line-height 1 + height 1em collapses the inter-row gap so vertical box-drawing
   strokes (\u2502, \u2551) on adjacent rows connect cleanly. The base .line rule uses
   line-height 1.5 which left visible whitespace above and below every glyph \u2014
   fine for prose, but it shreds ASCII banners. */
.line.art-block-start,
.line.art-block-middle,
.line.art-block-end {
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    opacity: 1;
    white-space: pre;
    word-break: normal;
    overflow-wrap: normal;
    position: relative;
    overflow: hidden;
    line-height: 1;
    height: 1em;
}

/* Top of block: rounded top corners, padded breathing room above.
   Breathing room uses padding (not margin) so it is included in the element's
   height and stays in sync with calcItemHeight \u2014 margins would desync the
   virtual scroller's prefix sums and cause rows below the block to drift. */
.line.art-block-start {
    padding-top: 6px;
    height: calc(1em + 6px);
    border-radius: 6px 6px 0 0;
    background: color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 4%, transparent);
}

/* Middle lines: zero vertical gap, shared background, no decoration */
.line.art-block-middle {
    padding-left: var(--deco-prefix-width-em, 14.25em);
    background: color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 4%, transparent);
}

/* Bottom of block: rounded bottom corners, padded breathing room below
   (see note on .art-block-start for why this is padding, not margin). */
.line.art-block-end {
    padding-bottom: 6px;
    height: calc(1em + 6px);
    border-radius: 0 0 6px 6px;
    padding-left: var(--deco-prefix-width-em, 14.25em);
    background: color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 4%, transparent);
}

/* Pin the start-line decoration to a fixed slot so the box-drawing art always
   begins at exactly --deco-prefix-width-em from the left, regardless of
   timestamp/counter/PID text length. Without this, a wider decoration (e.g.
   5-digit line numbers + logcat tag + PID/TID) pushes the first row's '\u256D'
   rightward while the '\u2502' on middle rows stays pinned to padding-left \u2014 the
   user sees corners that don't align with the vertical bars below them.
   WHY the /0.85 divisor: .line-decoration has font-size: 0.85em, so inside it
   1em = 0.85em-of-parent. To reserve exactly --deco-content-indent-em of the
   PARENT em, we need that many em / 0.85 in the decoration's own em unit. */
.line.art-block-start .line-decoration {
    display: inline-block;
    width: calc(var(--deco-content-indent-em, 13em) / 0.85);
    overflow: hidden;
    vertical-align: top;
}

/* Collapsed start row: the hidden end row no longer supplies the bottom corners,
   so round all four so the lone visible row reads as a closed tab, not an open box. */
.line.art-block-start.art-collapsed {
    border-radius: 6px;
}

/* Collapse chevron: pinned to the block's top-right corner, absolutely positioned
   (the row is position:relative) so it never shifts the white-space:pre box art.
   overflow:hidden on the row clips at the rounded corner \u2014 keep the chevron inset
   far enough that the glyph stays fully visible. */
.line.art-block-start .art-collapse-chevron {
    position: absolute;
    top: 4px;
    right: 8px;
    z-index: 1;
    cursor: pointer;
    opacity: 0.55;
    font-size: 0.9em;
    line-height: 1;
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    user-select: none;
}

.line.art-block-start .art-collapse-chevron:hover {
    opacity: 1;
}

/* Row count shown only while collapsed ("\u25B8 7") \u2014 muted, sits left of nothing; the
   glyph + count together announce how many lines fold away. */
.line.art-block-start .art-collapse-count {
    margin-left: 0.3em;
    font-size: 0.85em;
    opacity: 0.85;
}

/* No severity gutter bar on art blocks: the box-drawing art is its own visual
   unit, and a left border + margin-left shifted the block and read as a stray
   vertical line breaking the layout. Severity for the block is conveyed by the
   yellow tint/border-radius, not a gutter rail. */

/* Suppress severity dot on continuation lines (start keeps its dot) */
.line.art-block-middle[class*="level-bar-"]::before,
.line.art-block-end[class*="level-bar-"]::before {
    display: none;
}

/* Shimmer sweep across the art block. Gated behind .art-shimmer-play, which
   the renderer adds only on a row's FIRST render (latched by item._artShimmered
   in viewer-data-helpers-render.ts). Without the gate the sweep would restart
   every time renderViewport() rebuilds the visible DOM (every scroll / incoming
   line), reading as a perpetual animation regardless of iteration-count. */
.line.art-block-start.art-shimmer-play::after,
.line.art-block-middle.art-shimmer-play::after,
.line.art-block-end.art-shimmer-play::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
        105deg,
        transparent 0%,
        transparent 35%,
        color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 6%, transparent) 45%,
        color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 10%, transparent) 50%,
        color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 6%, transparent) 55%,
        transparent 65%,
        transparent 100%
    );
    background-size: 300% 100%;
    /* Shimmer once on arrival, then settle \u2014 an infinite loop on every art
       block reads as a perpetual "loading" state and competes for attention
       with live log lines. A single sweep announces the block, then it goes
       static. 'forwards' holds the final keyframe so the sweep ends off-screen
       rather than snapping the gradient back to its start position. */
    animation: art-block-shimmer 4s ease-in-out 1 forwards;
}

/* Stagger shimmer across rows for a cascading wave effect */
.line.art-block-middle.art-shimmer-play::after { animation-delay: 0.12s; }
.line.art-block-end.art-shimmer-play::after { animation-delay: 0.24s; }

@keyframes art-block-shimmer {
    0% { background-position: 300% 0; }
    100% { background-position: -300% 0; }
}

/* Hover: brighten the whole block together via increased tint */
.line.art-block-start:hover,
.line.art-block-middle:hover,
.line.art-block-end:hover {
    background: color-mix(in srgb, var(--vscode-terminal-ansiYellow, #dcdcaa) 8%, transparent);
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-format.ts
function getFormatStyles() {
  return (
    /* css */
    `

/* ---- Format toggle button active state ---- */

.toolbar-icon-btn-active {
    background: var(--vscode-toolbar-activeBackground, rgba(255, 255, 255, 0.12));
    border-radius: 4px;
}

/* ---- Markdown ---- */

/* All markdown lines share one left edge. The 1.85em log gutter (severity bars) is
   irrelevant in markdown mode, so trim it to a small uniform margin \u2014 this is the fix
   for the ragged left edge that per-heading borders/padding used to cause. */
.line.fmt-markdown { padding-left: 1em; }

/* Markdown is a document: prose must always wrap, even when the log view is in no-wrap mode
   (which otherwise sets white-space:pre and clips long lines off the right edge). Tables, code
   fences, and headings keep their own nowrap via their inner spans. */
#log-content.nowrap .line.fmt-markdown { white-space: pre-wrap; }

/* Headings: no left border (it broke alignment). The row is pinned to a taller height
   (calcItemHeight + inline style); flex-centering the text inside it yields the vertical
   padding, and the collapse chevron is pushed to the right edge. */
.line.fmt-md-h1, .line.fmt-md-h2, .line.fmt-md-h3,
.line.fmt-md-h4, .line.fmt-md-h5, .line.fmt-md-h6 {
    display: flex;
    /* CENTER, not flex-start: mdHeadingRowHeight allocates a row strictly TALLER than the glyph
       box, and centering splits that slack top+bottom. flex-start put all slack at the bottom and
       still clipped descenders on sub-pixel rounding (plans/history/2026.06/2026.06.09/markdown_render_spacing_attempts.md #3). */
    align-items: center;
    /* NO vertical overflow:hidden here \u2014 that is exactly what cropped the heading glyphs. Horizontal
       truncation/ellipsis lives on .md-htext instead, so the row never clips the text vertically. */
    box-sizing: border-box;
    padding-top: 0.6em;
    padding-bottom: 0.25em;
}

.md-heading {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    font-weight: bold;
    cursor: pointer;
}
.md-heading:hover { opacity: 0.85; }

/* ---- Markdown gutter (line number + type tag) \u2014 shown when line-number decorations are on.
   Non-heading rows use a hanging indent so wrapped lines align under the content, not the
   gutter; heading rows are flex, so the gutter is just the first flex item. ---- */
.line.fmt-markdown.md-has-gutter { padding-left: 0; }
.line.fmt-markdown.md-has-gutter:not([class*="fmt-md-h"]) {
    padding-left: var(--md-gutter-width, 8.5em);
    text-indent: calc(-1 * var(--md-gutter-width, 8.5em));
}
.md-gutter {
    display: inline-block;
    flex: 0 0 auto;
    width: var(--md-gutter-width, 8.5em);
    box-sizing: border-box;
    text-indent: 0;
    padding-right: 0.75em;
    font-size: 0.85em;
    color: var(--vscode-editorLineNumber-foreground, #858585);
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    vertical-align: top;
}
.md-gutter-num { display: inline-block; width: 3em; text-align: right; padding-right: 1em; }
/* Left-aligned and wide so the structure tags (H1, //, code \u2039\u203A, table \u25A6, quote \u275D, bullet \u2022)
   read clearly, like the log line-number column. */
.md-gutter-tag { display: inline-block; width: 4em; text-align: left; opacity: 0.85; }

.md-htext {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* Line height generous enough to clear the monospace glyph cap+descender at heading sizes so
       overflow:hidden (horizontal ellipsis) never crops the glyphs vertically. MUST match the 1.5
       factor in mdHeadingRowHeight (the row height is derived from it). */
    line-height: 1.5;
}

/* Font sizes MUST match the per-level fontEm in mdHeadingRowHeight (heading row height is
   computed from them); the line's own font-size stays at base so the pinned px height is exact.
   Per-level colors give scannable hierarchy; the minimap mirrors these (keep MM_HEADING_COLORS
   in viewer-scrollbar-minimap-paint.ts in sync with these hex fallbacks). */
.md-h1 .md-htext { font-size: 1.45em; color: var(--vscode-charts-blue, #4fc1ff); }
.md-h2 .md-htext { font-size: 1.3em; color: var(--vscode-charts-green, #89d185); }
.md-h3 .md-htext { font-size: 1.2em; color: var(--vscode-charts-purple, #b180d7); }
.md-h4 .md-htext { font-size: 1.05em; color: var(--vscode-charts-orange, #d18616); }
.md-h5 .md-htext { font-size: 1.0em; color: var(--vscode-charts-yellow, #cca700); }
.md-h6 .md-htext { font-size: 1.0em; color: var(--vscode-descriptionForeground, #888); }

/* Subtle, right-aligned collapse affordance. */
.md-chevron {
    flex: 0 0 auto;
    margin-left: 8px;
    opacity: 0.35;
    font-size: 0.7em;
    color: var(--vscode-descriptionForeground, #888);
}
.md-heading:hover .md-chevron { opacity: 0.7; }

.md-collapse-badge {
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground, #888);
    font-weight: normal;
    margin-left: 8px;
}

.md-hr {
    display: block;
    border: none;
    border-top: 1px solid var(--vscode-editorWidget-border, #454545);
    margin: 2px 0;
    height: 0;
}

.md-blockquote {
    display: inline-block;
    border-left: 2px solid var(--vscode-textBlockQuote-border, #555);
    padding-left: calc(var(--bq-depth, 1) * 8px);
    color: var(--vscode-descriptionForeground, #999);
    font-style: italic;
}

/* Top-level bullets align to the body left edge; only nested items indent (by depth). */
.md-bullet {
    padding-left: calc(var(--md-indent, 0) * 12px);
}

/* Each top-level list item gets top space (inside its border-box height, which calcItemHeight
   enlarged by the same 0.4 row) so consecutive multi-line bullets read as separate items. */
.line.fmt-md-bullet-top {
    box-sizing: border-box;
    padding-top: calc(0.4 * var(--log-line-height, 1.1) * 1em);
}

.md-code {
    background: var(--vscode-textCodeBlock-background, rgba(255, 255, 255, 0.06));
    border-radius: 3px;
    padding: 1px 4px;
    font-family: var(--vscode-editor-font-family);
}

.md-link {
    text-decoration: underline;
    color: var(--vscode-textLink-foreground, #3794ff);
}

/* HTML comments render in the conventional comment green + italic so they are clearly distinct
   from prose and from the gray line numbers. A multi-line comment's opening line is a collapse
   toggle with a right chevron. */
/* Canonical comment green, hardcoded so it stays distinct from the H2 heading color (which uses
   charts-green); italic reinforces "this is a comment". */
.md-comment {
    color: #6a9955;
    font-style: italic;
}
.md-comment-open { cursor: pointer; }
.md-comment-chevron { opacity: 0.8; color: var(--vscode-descriptionForeground, #888); }
.md-comment-open:hover .md-comment-chevron { opacity: 1; }

/* Tables render as aligned columns: each cell is a fixed-ch-width inline-block (width set
   per column in buildMdTables), so columns line up in the monospace font. The header row is
   bold with a bottom border; the |---| separator row is collapsed to 0 height upstream. */
.md-table-row {
    font-family: var(--vscode-editor-font-family);
    white-space: nowrap;
}

.md-table-header {
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-editorWidget-border, #454545);
}

.md-td {
    display: inline-block;
    box-sizing: border-box;
    vertical-align: top;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 1ch;
}

.md-table-rule {
    display: block;
    border-top: 1px solid var(--vscode-editorWidget-border, #454545);
    height: 0;
}

/* Fenced code blocks (triple-backtick + language). Body lines render verbatim in a
   monospace, tinted block; the open/close delimiters become thin rules so the block
   reads as one unit. */
.md-fence-body {
    display: inline-block;
    width: 100%;
    background: var(--vscode-textCodeBlock-background, rgba(255, 255, 255, 0.06));
    font-family: var(--vscode-editor-font-family);
    white-space: pre;
    padding: 0 6px;
}
.md-fence-open,
.md-fence-close {
    display: block;
    background: var(--vscode-textCodeBlock-background, rgba(255, 255, 255, 0.06));
    border-top: 1px solid var(--vscode-editorWidget-border, #454545);
}
/* Close has no label, so collapse it to a thin closing rule. Open auto-sizes to its
   language label below. */
.md-fence-close { height: 4px; }
.md-fence-lang {
    font-family: var(--vscode-editor-font-family);
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground, #888);
    padding: 0 6px;
}

/* ---- JSON ---- */

.json-line {
    padding-left: calc(var(--json-depth, 0) * 16px);
    cursor: default;
}
.json-line[data-json-section] { cursor: pointer; }
.json-line[data-json-section]:hover { opacity: 0.8; }

.json-key { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
.json-string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
.json-number { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
.json-bool { color: var(--vscode-debugTokenExpression-boolean, #4fc1ff); }
.json-brace { color: var(--vscode-descriptionForeground, #888); }

.json-collapse-badge {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground, #888);
    margin-left: 4px;
}

/* ---- CSV ---- */

.csv-row {
    font-family: var(--vscode-editor-font-family);
    white-space: pre;
}

.csv-header-row {
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-editorWidget-border, #454545);
}

.csv-alt-row {
    background: rgba(255, 255, 255, 0.02);
}

.csv-cell {
    display: inline-block;
    padding: 0 4px;
}

.csv-header-cell {
    display: inline-block;
    padding: 0 4px;
    font-weight: bold;
}

.csv-sep {
    color: var(--vscode-descriptionForeground, #555);
    padding: 0 2px;
}

/* ---- Generic format line wrapper ---- */

.fmt-markdown,
.fmt-json,
.fmt-csv,
.fmt-html {
    /* No level-based coloring for structured documents. */
    color: var(--vscode-editor-foreground, #d4d4d4);
}
`
  );
}

// src/ui/viewer-styles/viewer-styles-flutter-banner.ts
function getFlutterBannerStyles() {
  return (
    /* css */
    `

/* Faint error-toned wash so the incident reads as one block without a left rail. */
.banner-group-start,
.banner-group-mid,
.banner-group-end {
    background-color: color-mix(in srgb, var(--vscode-editorError-foreground, #f14c4c) 6%, transparent);
}
/* Header gets a stronger tint so the always-visible, collapsible title stands out. */
.banner-group-start {
    background-color: color-mix(in srgb, var(--vscode-editorError-foreground, #f14c4c) 12%, transparent);
}

/* Collapse disclosure triangle on the banner header. A bare symbol (\u25B6 / \u25BC), so it
   needs no l10n; the whole header row is the click target (viewer-script-click-handlers.ts). */
.banner-chevron {
    display: inline-block;
    margin-right: 0.35em;
    color: var(--vscode-editorError-foreground, #f14c4c);
    cursor: pointer;
    user-select: none;
}

/* Hidden-line count shown on a collapsed banner header ("47 lines"), so the folded
   block still tells the user how much it hides. Muted error-toned pill. */
.banner-count {
    display: inline-block;
    margin-right: 0.4em;
    padding: 0 0.35em;
    border-radius: 0.25em;
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground, #888);
    background: color-mix(in srgb, var(--vscode-editorError-foreground, #f14c4c) 16%, transparent);
    user-select: none;
}

/* Decoration prefix on banner body/footer rows is redundant: the whole group
   emits in one frame so the timestamp equals the header's, and a per-row counter
   on a 50-line RenderFlex dump is noise. visibility: hidden keeps the
   .line-decoration span occupying its normal width so the .line:has(.line-decoration)
   column rule still applies and body message bodies stay column-aligned with the
   header. The counter still advances per file line number (idx-based) so Copy with
   decorations / Copy Error continue to produce correctly numbered output. */
.banner-group-mid > .line-decoration,
.banner-group-end > .line-decoration {
    visibility: hidden;
}
`
  );
}

// src/ui/viewer-styles/viewer-styles.ts
function getViewerStyles() {
  return (
    /* css */
    `
/* Utility: hide element without inline style (CSP-friendly) */
.u-hidden { display: none !important; }

/* Utility: visually hidden but accessible to screen readers */
.u-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* ===================================================================
   Reset & Root Layout
   The webview body is a flex row: icon bar + main content column.
   Default: icon bar on left (row-reverse). data-icon-bar=\u201Dright\u201D flips it.
   The #main-content div contains the panel-content row (panels + log area)
   plus fixed-position overlays (context menus, modals).
   =================================================================== */
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace);
    font-size: var(--log-font-size, var(--vscode-editor-font-size, 13px));
    overflow: hidden;
    height: 100vh;
    display: flex;
    flex-direction: row-reverse;
    user-select: none; /* Confine native text selection to #viewport only */
}
body[data-icon-bar=\u201Dright\u201D] { flex-direction: row; }
#viewport { user-select: text; }

#main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100vh;
    overflow: hidden;
}

/* ===================================================================
   Panel-Content Row
   Flex row containing the panel slot and log+footer area.
   Panel sits on the icon-bar side; log area (content + footer) takes remaining space.
   =================================================================== */
#panel-content-row {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
}
body[data-icon-bar=\u201Dright\u201D] #panel-content-row {
    flex-direction: row-reverse;
}
#log-area-with-footer {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    /* Positioning context for the floating search overlay */
    position: relative;
}

/* ===================================================================
   Panel Slot
   Container for all slide-out panels. Width is 0 when no panel is
   open; animates to target width when a panel opens. Uses CSS grid
   to stack all panels in a single cell (only one visible at a time).
   =================================================================== */
#panel-slot {
    width: 0;
    flex-shrink: 0;
    overflow: hidden;
    transition: width 0.25s ease-out;
    position: relative;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    max-width: 70vw;
}
#panel-slot > * {
    grid-row: 1;
    grid-column: 1;
}
#panel-slot.open {
    overflow: visible;
}

/* Drag handle to resize the shared slide-out width. Anchored to the persistent
   #panel-slot (not inside any one panel) so EVERY slide-out is resizable from the
   same edge \u2014 the slot is position:relative, so right:-3px lands on its right edge
   (left:-3px under a right-side icon bar, see viewer-styles-icon-bar.ts). The slot's
   overflow:hidden (until .open) keeps the handle hidden while no panel is open.
   The 420px drag floor lives in the JS resize handler / MIN_PANEL_WIDTH. */
.panel-slot-resize {
    position: absolute; right: -3px; top: 0; bottom: 0; width: 6px;
    cursor: col-resize; z-index: 1;
}
.panel-slot-resize:hover,
.panel-slot-resize.dragging {
    background: var(--vscode-focusBorder);
    opacity: 0.5;
}

/* ===================================================================
   Log Content Wrapper
   Flex row containing the scrollable log area and the minimap panel.
   =================================================================== */
#log-content-wrapper {
    --mm-w: 60px; /* minimap width \u2014 updated by JS when size changes */
    --scrollbar-w: 0; /* native vertical scrollbar width when showScrollbar is on */
    position: relative;
    flex: 1;
    min-height: 0;
    /* Flex row child: allow horizontal shrink so #log-content + minimap share width predictably */
    min-width: 0;
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: stretch;
}
body.scrollbar-visible #log-content-wrapper { --scrollbar-w: 10px; }

/* Vertical scrollbar is physically clipped, not CSS-hidden. Chromium in the VS Code
   webview caches the composited ::-webkit-scrollbar layer and ignores live updates
   to width / display / scrollbar-width \u2014 previous attempts (overflow cycle,
   display:none cycle, host-class toggle) all failed. .log-content-clip reserves
   the real flex width; #log-content inside is 10px wider with matching padding-right,
   so the scrollbar lives in the clipped overflow and is invisible. Toggling the
   Show-native-scrollbar setting lifts the clip (overflow: visible) so the scrollbar
   re-enters the visible area \u2014 works because overflow changes on a normal element
   force reflow, unlike webkit pseudo-element style changes. Horizontal scrollbar
   is unaffected: it runs along the bottom, and only the rightmost 10px is clipped. */
.log-content-clip {
    flex: 1 1 0%;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    position: relative;
}
body.scrollbar-visible .log-content-clip { overflow: visible; }

/* ===================================================================
   Log Content Area
   Main scrollable region. Vertical scrollbar is hidden because
   the minimap panel serves as the vertical-scroll replacement.
   Horizontal scrollbar is styled to match the VS Code theme.
   =================================================================== */
#log-content {
    /* Width is (clip-parent width + 10px). The extra 10px is where the vertical
       scrollbar paints; padding-right: 10px keeps content inside the visible area.
       .log-content-clip has overflow: hidden, so the 10px scrollbar zone is clipped
       off-screen. Horizontal scrollbar still runs the full element width along the
       bottom \u2014 only its rightmost 10px is clipped (scrollbar slider stays usable). */
    width: calc(100% + 10px);
    height: 100%;
    overflow-y: auto;
    /* Horizontal scroll when lines use white-space: pre (banners, stacks) \u2014 same idea as the Debug Console wide line. */
    overflow-x: auto;
    overflow-anchor: none;
    padding: 4px 10px 40px 0;
    position: relative;
    box-sizing: border-box;
    /* Do NOT add scrollbar-width:none \u2014 Chromium 130+ treats it as authoritative
       and hides the horizontal bar too, making wide nowrap lines invisible on the
       right side. We hide the vertical bar via .log-content-clip's overflow clip. */
}
/* When the user opts in to the native vertical scrollbar, drop the clipping trick:
   the clip parent becomes overflow: visible (above) so the extra 10px zone shows,
   and #log-content returns to 100% width / no right padding \u2014 visually identical
   to having the scrollbar live in-layout like a normal element. */
body.scrollbar-visible #log-content {
    width: 100%;
    padding-right: 0;
}
/* Vertical scrollbar is always painted at 10px so its thumb is draggable when
   the clip is lifted. Chromium's caching no longer matters \u2014 visibility is
   controlled by layout (clip on / clip off), not by ::-webkit-scrollbar width. */
#log-content::-webkit-scrollbar { width: 10px; height: 10px; }
#log-content::-webkit-scrollbar-thumb {
    background: var(--vscode-scrollbarSlider-background);
    border-radius: 4px;
}
#log-content::-webkit-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-hoverBackground);
}
#log-content::-webkit-scrollbar-track { background: transparent; }
` + getLineStyles() + getColumnStyles() + getAsciiArtStyles() + getContentStyles() + getNPlusOneSignalStyles() + getSqlRepeatDrilldownStyles() + getReplayStyles() + getComponentStyles() + getOverlayStyles() + getTagStyles() + getOptionsStyles() + getErrorStyles() + getIconBarStyles() + getSessionPanelStyles() + getFindPanelStyles() + getBookmarkPanelStyles() + getSqlQueryHistoryPanelStyles() + getSqlQueryHistoryDashboardStyles() + getTrashPanelStyles() + getAboutPanelStyles() + getCollectionsPanelStyles() + getCrashlyticsPanelStyles() + getProjectStatePanelStyles() + getRecurringPanelStyles() + getPerformancePanelStyles() + getSignalPanelStyles() + getAiStyles() + getRunSeparatorStyles() + getContextPopoverStyles() + getRootCauseHypothesesStyles() + getToolbarStyles() + getFilterDrawerStyles() + getFormatStyles() + getFlutterBannerStyles()
  );
}
export {
  getViewerStyles
};

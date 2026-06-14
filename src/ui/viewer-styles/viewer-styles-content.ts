/** CSS for timing markers, stack traces, jump button, annotations. */
export function getContentStyles(): string {
    return /* css */ `
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
/* DB_16 timestamp burst — green rail matches database level / gutter (same token as level-bar-database).
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
       row's height — when stack-header rows were taller than .line rows the
       chain stripe couldn't reach the next dot's middle, producing visible
       gaps at log-line → stack-header transitions. Stack headers are part
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
/* Stack-header text color follows inherited level — same tokens as .line.level-* in viewer-styles-lines.ts.
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
   capture it on Ctrl+C. The visible icon comes from CSS ::before — pseudo-
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

/* DB badge: line has correlated database queries (click opens the related-queries popover) */
.db-query-badge { cursor: pointer; margin-left: 2px; opacity: 0.7; font-size: 0.85em; }
.db-query-badge:hover { opacity: 1; }

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

`;
}

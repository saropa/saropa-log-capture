/**
 * Styles for the Reports bucket, newer-log banner, and per-row unread dot.
 * Extracted from viewer-styles-session-list.ts to keep that file under the
 * 300-line limit (see `.claude/rules/global.md`). Composed by
 * viewer-styles-session.ts in the same `<style>` block as the rest of the
 * session-panel styles — no extra `<link>` needed.
 */

export function getSessionNewerStyles(): string {
    return /* css */ `

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
    /* position:relative anchors the kebab overflow menu (plan 109) to the banner row. */
    position: relative;
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

/* The viewer's CLICK-mode banner overlays its kebab menu DOWN over the log content. None of
   #log-content-wrapper / .log-content-clip / #log-content set a z-index, so they create no
   stacking context and the content's own positioned bits (severity bars z-index 1-3, the floating
   copy icon z-index 10) bubble up to compete in #log-area-with-footer. The banner sat at z-index
   auto, so its kebab (a child at z-index 5) painted UNDER those bars. Promote the whole banner so
   it — and its absolutely-positioned overflow menu — paint above the content. Stays below the
   toolbar (50) and its dropdowns (100) and all modal overlays (200+). Scoped to .viewer-newer-banner
   so the session panel's sticky newer banner is untouched. */
.viewer-newer-banner {
    z-index: 20;
}

/* --- Unified banner: kebab overflow + close (plan 109) --- */
/* The ⋮ and × are icon-only square buttons; the codicon centers via line-height. */
.session-newer-banner-action.log-banner-kebab-btn,
.session-newer-banner-action.session-newer-banner-close {
    padding: 2px 6px;
}
.session-newer-banner-close {
    font-size: 14px;
    line-height: 1;
}
/* Overflow menu: anchored to the banner's right edge, below the action row. Stacks the
   less-important file actions (copy name, open beside, reveal, terminal). */
.log-banner-kebab-menu {
    position: absolute;
    top: 100%;
    right: 8px;
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-width: 180px;
    margin-top: 2px;
    padding: 4px;
    background: var(--vscode-menu-background, var(--vscode-editorWidget-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-widget-border, var(--vscode-panel-border)));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.36);
}
.log-banner-kebab-menu[hidden] { display: none; }
.log-banner-kebab-item {
    text-align: left;
    padding: 5px 10px;
    background: transparent;
    border: none;
    border-radius: 3px;
    color: var(--vscode-menu-foreground, var(--vscode-foreground));
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
}
.log-banner-kebab-item:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}

/* --- Toolbar staleness chip (plan 109) ---
 * Replaces the "Log N of M" navigator. Hidden until the open log is behind a newer controller
 * (main-project) log; then a warning glyph + "N newer". Clicking opens the log banner. The warning
 * color cues "you are out of date" without being alarmist (uses the editor's own warning token). */
.log-staleness {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    margin-right: 6px;
    border-radius: 3px;
    font-size: 11px;
    color: var(--vscode-editorWarning-foreground, var(--vscode-charts-yellow));
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
}
.log-staleness:hover {
    background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
}
.log-staleness .codicon { font-size: 13px; }

/* --- Per-row unread dot ---
 * Distinct from the existing red/orange update-dot (\`updatedInLastMinute\` /
 * \`updatedSinceViewed\`) — fires for never-viewed logs too, cleared by panel
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
    `;
}

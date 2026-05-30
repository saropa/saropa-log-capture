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
    `;
}

/**
 * CSS styles for the session-info modal (the (i) icon next to the filename
 * opens a structured view of the SAROPA LOG CAPTURE header — sections,
 * indented launch-config sub-keys, hotlinks, long-press copy).
 *
 * Split from viewer-styles-modal.ts to keep that file under the line limit.
 */
export function getSessionInfoModalStyles(): string {
    return /* css */ `

/* ===================================================================
   Session Info Modal — structured view of the SAROPA LOG CAPTURE header
   (sections, indenting, hotlinks, long-press copy).
   =================================================================== */
.session-info-modal-content {
    /* Cap the 480px floor to the viewport so the modal doesn't clip its left edge (section titles
       + key labels run off-screen) when the log-viewer panel is narrower than 480px. */
    min-width: min(480px, calc(100vw - 24px));
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
    content: "▶";
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
   full text — the cursor hint signals the row is interactive. */
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
    content: "  …";
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
/* Toolbar (i) button sits to the left of the filename so it reads as a sibling of the filename,
   not part of the nav cluster. Its old left neighbor, the session-details line, moved into the
   persistent log status bar. */
.session-info-btn { margin-right: 4px; }
`;
}

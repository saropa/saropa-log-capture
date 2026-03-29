/**
 * Actions dropdown HTML — positioned below the toolbar actions icon.
 *
 * Preserves the same IDs and classes used by `viewer-replay.ts`:
 *   `#footer-actions-menu`, `#footer-actions-popover`,
 *   `.footer-actions-item`, `data-action` attributes.
 */

/** Actions dropdown HTML fragment. */
export function getActionsDropdownHtml(): string {
    return /* html */ `
<div id="footer-actions-menu" class="footer-actions-menu toolbar-actions-dropdown">
    <div id="footer-actions-popover" class="toolbar-actions-popover" role="menu" aria-label="Actions">
        <button type="button" class="footer-actions-item" data-action="replay" role="menuitem" title="Replay the log session line-by-line with timing">
            <span class="codicon codicon-debug-start" aria-hidden="true"></span> Replay
        </button>
        <hr class="footer-actions-separator" role="separator">
        <button type="button" class="footer-actions-item" data-action="open-quality-report" role="menuitem" title="Generate and open a quality report for this log session">
            <span class="codicon codicon-file-code" aria-hidden="true"></span> Open Quality Report
        </button>
        <hr class="footer-actions-separator" role="separator">
        <button type="button" class="footer-actions-item" data-action="export" role="menuitem" title="Export log lines to a file with optional level filtering">
            <span class="codicon codicon-export" aria-hidden="true"></span> Export
        </button>
    </div>
</div>`;
}

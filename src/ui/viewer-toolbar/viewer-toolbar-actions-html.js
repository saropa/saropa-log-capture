"use strict";
/**
 * Actions dropdown HTML — positioned below the toolbar actions icon.
 *
 * Preserves the same IDs and classes used by `viewer-replay.ts`:
 *   `#footer-actions-menu`, `#footer-actions-popover`,
 *   `.footer-actions-item`, `data-action` attributes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActionsDropdownHtml = getActionsDropdownHtml;
/** Actions dropdown HTML fragment. */
function getActionsDropdownHtml() {
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
        <hr class="footer-actions-separator" role="separator">
        <div class="toolbar-actions-submenu-trigger" role="menuitem" aria-haspopup="true" title="Saved combinations of level, source, search, and exclusion filters \u2014 apply a preset to quickly switch your entire filter configuration">
            <button type="button" class="footer-actions-item" id="presets-submenu-btn">
                <span class="codicon codicon-library" aria-hidden="true"></span> Presets
                <span class="codicon codicon-chevron-right" aria-hidden="true"></span>
            </button>
            <div class="toolbar-actions-submenu" id="presets-submenu" role="menu" aria-label="Quick Filters">
                <button type="button" class="footer-actions-item preset-submenu-item" data-preset="" role="menuitem" title="Reset all filters to defaults: all levels enabled, Flutter DAP=All, Device=Warn+, External=Warn+, no search or exclusions">
                    <span class="codicon codicon-clear-all" aria-hidden="true"></span> Default
                </button>
            </div>
        </div>
    </div>
</div>`;
}
//# sourceMappingURL=viewer-toolbar-actions-html.js.map
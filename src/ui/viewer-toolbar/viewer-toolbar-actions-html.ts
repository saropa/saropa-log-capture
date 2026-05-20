/**
 * Actions dropdown HTML — positioned below the toolbar actions icon.
 *
 * Preserves the same IDs and classes used by `viewer-replay.ts`:
 *   `#footer-actions-menu`, `#footer-actions-popover`,
 *   `.footer-actions-item`, `data-action` attributes.
 *
 * User-facing strings resolve through t() (host-built HTML) — see strings-viewer.ts.
 */

import { t } from '../../l10n';

/** Actions dropdown HTML fragment. */
export function getActionsDropdownHtml(): string {
    return /* html */ `
<div id="footer-actions-menu" class="footer-actions-menu toolbar-actions-dropdown">
    <div id="footer-actions-popover" class="toolbar-actions-popover" role="menu" aria-label="${t('viewer.actions.menu.label')}">
        <button type="button" class="footer-actions-item" data-action="replay" role="menuitem" title="${t('viewer.actions.replay.title')}">
            <span class="codicon codicon-debug-start" aria-hidden="true"></span> ${t('viewer.actions.replay')}
        </button>
        <hr class="footer-actions-separator" role="separator">
        <button type="button" class="footer-actions-item" data-action="open-quality-report" role="menuitem" title="${t('viewer.actions.qualityReport.title')}">
            <span class="codicon codicon-file-code" aria-hidden="true"></span> ${t('viewer.actions.qualityReport')}
        </button>
        <hr class="footer-actions-separator" role="separator">
        <button type="button" class="footer-actions-item" data-action="export" role="menuitem" title="${t('viewer.actions.export.title')}">
            <span class="codicon codicon-export" aria-hidden="true"></span> ${t('viewer.actions.export')}
        </button>
        <hr class="footer-actions-separator" role="separator">
        <div class="toolbar-actions-submenu-trigger" role="menuitem" aria-haspopup="true" title="${t('viewer.actions.presets.title')}">
            <button type="button" class="footer-actions-item" id="presets-submenu-btn">
                <span class="codicon codicon-library" aria-hidden="true"></span> ${t('viewer.actions.presets')}
                <span class="codicon codicon-chevron-right" aria-hidden="true"></span>
            </button>
            <div class="toolbar-actions-submenu" id="presets-submenu" role="menu" aria-label="${t('viewer.actions.presetsSubmenu.label')}">
                <button type="button" class="footer-actions-item preset-submenu-item" data-preset="" role="menuitem" title="${t('viewer.actions.presetDefault.title')}">
                    <span class="codicon codicon-clear-all" aria-hidden="true"></span> ${t('viewer.actions.presetDefault')}
                </button>
            </div>
        </div>
    </div>
</div>`;
}

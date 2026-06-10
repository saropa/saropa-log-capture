/**
 * Scroll map + scrollbar toggle rows — shared between the main content context menu and
 * `#scroll-chrome-context-menu` (right-click on the minimap / native scrollbar).
 *
 * Extracted from `viewer-context-menu-html.ts` to keep that file under the 300-line cap.
 * Labels + tooltips are localized via t() (keys in strings-viewer-g.ts); codicon names,
 * data-action values, and `.context-menu-shortcut` key hints stay literal.
 */
import { t } from "../../l10n";

/** Returns the shared minimap/scrollbar toggle rows used by both menus. */
export function getScrollChromeMenuTogglesHtml(): string {
    return `
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-proportional" title="${t('viewer.ctx.minimapProportional')}">
                <span class="codicon codicon-graph" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.minimapProportional')}</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-show-scrollbar" title="${t('viewer.ctx.showScrollbar')}">
                <span class="codicon codicon-layout" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.showScrollbar')}</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-info-markers" title="${t('viewer.ctx.minimapInfoMarkers')}">
                <span class="codicon codicon-info" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.minimapInfoMarkers')}</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-sql-density" title="${t('viewer.ctx.minimapSqlDensity')}">
                <span class="codicon codicon-database"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.minimapSqlDensity')}</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-viewport-red-outline" title="${t('viewer.ctx.minimapRedOutline')}">
                <span class="codicon codicon-circle-outline" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.minimapRedOutline')}</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-outside-arrow" title="${t('viewer.ctx.minimapOutsideArrow')}">
                <span class="codicon codicon-arrow-right" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.minimapOutsideArrow')}</span>
            </div>`;
}

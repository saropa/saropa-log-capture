/**
 * Log content context menu HTML. The shared minimap/scrollbar toggle rows live in
 * `viewer-context-menu-scroll-toggles.ts` (extracted to keep this file under the 300-line
 * cap). Labels + tooltips localized via t() (keys in strings-viewer-g.ts); codicon names,
 * data-action values, and `.context-menu-shortcut` key hints stay literal.
 */
import { t } from "../../l10n";
import { getScrollChromeMenuTogglesHtml } from "./viewer-context-menu-scroll-toggles";

export { getScrollChromeMenuTogglesHtml };

/** Compact menu: same toggles as the Scroll map & scrollbar submenu (minimap / scrollbar right-click). */
export function getScrollChromeContextMenuHtml(): string {
    return `<div id="scroll-chrome-context-menu" class="context-menu" role="menu" aria-label="${t('viewer.ctx.scrollChrome.region')}">
${getScrollChromeMenuTogglesHtml()}
</div>`;
}

/**
 * Returns the HTML for the log content context menu.
 * Column toggles (line numbers, timestamps, session elapsed, tag) live in the top-level
 * **Columns** submenu; layout toggles (wrap, spacing, line height, compression) live in
 * the top-level **Layout** submenu; the footer gear panel remains **Options** in the UI.
 */
export function getContextMenuHtml(): string {
    return `<div id="context-menu" class="context-menu">
    <div class="context-menu-item" data-action="open-source-link" data-source-action title="${t('viewer.ctx.openFile.title')}">
        <span class="codicon codicon-go-to-file"></span> ${t('viewer.ctx.openFile.label')}
    </div>
    <div class="context-menu-item" data-action="copy-relative-path" data-source-action title="${t('viewer.ctx.copyRelPath.title')}">
        <span class="codicon codicon-copy"></span> ${t('viewer.ctx.copyRelPath.label')}
    </div>
    <div class="context-menu-item" data-action="copy-full-path" data-source-action title="${t('viewer.ctx.copyFullPath.title')}">
        <span class="codicon codicon-copy"></span> ${t('viewer.ctx.copyFullPath.label')}
    </div>
    <div class="context-menu-separator" data-source-action></div>
    <div class="context-menu-item" data-action="copy-error-warning-block" data-copy-error-warning-row style="display:none" title="${t('viewer.ctx.copyEwBlock.title')}">
        <span class="codicon codicon-error" data-ew-copy-icon aria-hidden="true"></span>
        <span data-ew-copy-label>${t('viewer.ctx.copyEwBlock.label')}</span>
    </div>
    <div class="context-menu-item" data-action="copy-error-warning-json" data-copy-error-warning-row style="display:none" title="${t('viewer.ctx.copyEwJson.title')}">
        <span class="codicon codicon-json" aria-hidden="true"></span>
        <span data-ew-json-label>${t('viewer.ctx.copyEwJson.label')}</span>
    </div>
    <div class="context-menu-item" data-action="copy-db-cluster-block" data-copy-db-cluster-row style="display:none" title="${t('viewer.ctx.copyDbCluster.title')}">
        <span class="codicon codicon-database"></span> ${t('viewer.ctx.copyDbCluster.label')}
    </div>
    <div class="context-menu-separator" data-grouped-block-copy-separator style="display:none"></div>
    <!-- Copy & Export submenu: shortens main menu so it fits on screen; Copy to Search after separator (line-only). -->
    <div class="context-menu-submenu" id="copy-export-submenu">
        <span class="codicon codicon-clippy"></span> ${t('viewer.ctx.submenu.copyExport')}
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="copy-json" data-line-action title="${t('viewer.ctx.copyJson.title')}">
                <span class="codicon codicon-json"></span> ${t('viewer.ctx.copyJson.label')}
                <span class="context-menu-shortcut">Ctrl+C</span>
            </div>
            <div class="context-menu-item" data-action="copy-selection" title="${t('viewer.ctx.copySelection.title')}">
                <span class="codicon codicon-copy"></span> ${t('viewer.ctx.copySelection.label')}
            </div>
            <div class="context-menu-item" data-action="copy" data-line-action title="${t('viewer.ctx.copy.title')}">
                <span class="codicon codicon-copy"></span> ${t('viewer.ctx.copy.label')}
            </div>
            <div class="context-menu-item" data-action="copy-decorated" data-line-action title="${t('viewer.ctx.copyDecorated.title')}">
                <span class="codicon codicon-copy"></span> ${t('viewer.ctx.copyDecorated.label')}
            </div>
            <div class="context-menu-item" data-action="copy-line-number" data-line-action title="${t('viewer.ctx.copyLineNumber.title')}">
                <span class="codicon codicon-list-ordered"></span> ${t('viewer.ctx.copyLineNumber.label')}
            </div>
            <div class="context-menu-item" data-action="copy-timestamp" data-line-action data-timestamp-action title="${t('viewer.ctx.copyTimestamp.title')}">
                <span class="codicon codicon-clock"></span> ${t('viewer.ctx.copyTimestamp.label')}
            </div>
            <div class="context-menu-separator" data-line-action></div>
            <div class="context-menu-item" data-action="copy-all" title="${t('viewer.ctx.copyAll.title')}">
                <span class="codicon codicon-clippy"></span> ${t('viewer.ctx.copyAll.label')}
                <span class="context-menu-shortcut">Ctrl+Shift+A</span>
            </div>
            <div class="context-menu-item" data-action="copy-all-decorated" title="${t('viewer.ctx.copyAllDecorated.title')}">
                <span class="codicon codicon-clippy"></span> ${t('viewer.ctx.copyAllDecorated.label')}
            </div>
            <div class="context-menu-item" data-action="copy-as-snippet" title="${t('viewer.ctx.copyAsSnippet.title')}">
                <span class="codicon codicon-markdown"></span> ${t('viewer.ctx.copyAsSnippet.label')}
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="copy-with-source" title="${t('viewer.ctx.copyWithSource.title')}">
                <span class="codicon codicon-file-code"></span> ${t('viewer.ctx.copyWithSource.label')}
            </div>
            <div class="context-menu-item" data-action="select-all" title="${t('viewer.ctx.selectAll.title')}">
                <span class="codicon codicon-list-flat"></span> ${t('viewer.ctx.selectAll.label')}
                <span class="context-menu-shortcut">Ctrl+A</span>
            </div>
            <div class="context-menu-item" data-action="export-current-view" title="${t('viewer.ctx.exportCurrentView.title')}">
                <span class="codicon codicon-export"></span> ${t('viewer.ctx.exportCurrentView.label')}
            </div>
            <div class="context-menu-separator" data-line-action></div>
            <div class="context-menu-item" data-action="copy-to-search" data-line-action title="${t('viewer.ctx.copyToSearch.title')}">
                <span class="codicon codicon-search"></span> ${t('viewer.ctx.copyToSearch.label')}
            </div>
        </div>
    </div>
    <div class="context-menu-item" data-action="open-source" data-line-action title="${t('viewer.ctx.openSource.title')}">
        <span class="codicon codicon-go-to-file"></span> ${t('viewer.ctx.openSource.label')}
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-submenu" data-line-action>
        <span class="codicon codicon-search"></span> ${t('viewer.ctx.submenu.search')}
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="search-codebase" title="${t('viewer.ctx.searchCodebase.title')}">
                <span class="codicon codicon-search"></span> ${t('viewer.ctx.searchCodebase.label')}
            </div>
            <div class="context-menu-item" data-action="search-sessions" title="${t('viewer.ctx.searchSessions.title')}">
                <span class="codicon codicon-history"></span> ${t('viewer.ctx.searchSessions.label')}
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="analyze-line" title="${t('viewer.ctx.analyzeLine.title')}">
                <span class="codicon codicon-search-fuzzy"></span> ${t('viewer.ctx.analyzeLine.label')}
            </div>
            <div class="context-menu-item" data-action="generate-report" title="${t('viewer.ctx.generateReport.title')}">
                <span class="codicon codicon-report"></span> ${t('viewer.ctx.generateReport.label')}
            </div>
            <div class="context-menu-item" data-action="create-report-file" title="${t('viewer.ctx.createReportFile.title')}">
                <span class="codicon codicon-new-file"></span> ${t('viewer.ctx.createReportFile.label')}
            </div>
        </div>
    </div>
    <div class="context-menu-submenu" data-line-action>
        <span class="codicon codicon-tools"></span> ${t('viewer.ctx.submenu.actions')}
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="pin" title="${t('viewer.ctx.pin.title')}">
                <span class="codicon codicon-pin"></span> ${t('viewer.ctx.pin.label')}
                <span class="context-menu-shortcut">P</span>
            </div>
            <div class="context-menu-item" data-action="bookmark" title="${t('viewer.ctx.bookmark.title')}">
                <span class="codicon codicon-bookmark"></span> ${t('viewer.ctx.bookmark.label')}
                <span class="context-menu-shortcut">Ctrl+B</span>
            </div>
            <div class="context-menu-item" data-action="edit" title="${t('viewer.ctx.edit.title')}">
                <span class="codicon codicon-edit"></span> ${t('viewer.ctx.edit.label')}
            </div>
            <div class="context-menu-item" data-action="show-context" title="${t('viewer.ctx.showContext.title')}">
                <span class="codicon codicon-list-flat"></span> ${t('viewer.ctx.showContext.label')}
            </div>
            <div class="context-menu-item" data-action="show-integration-context" title="${t('viewer.ctx.showIntegrationContext.title')}">
                <span class="codicon codicon-layers"></span> ${t('viewer.ctx.showIntegrationContext.label')}
            </div>
            <div class="context-menu-item" data-action="show-related-queries" data-line-action title="${t('viewer.ctx.showRelatedQueries.title')}">
                <span class="codicon codicon-database"></span> ${t('viewer.ctx.showRelatedQueries.label')}
            </div>
            <div class="context-menu-item" data-action="show-related-requests" data-line-action title="${t('viewer.ctx.showRelatedRequests.title')}">
                <span class="codicon codicon-globe"></span> ${t('viewer.ctx.showRelatedRequests.label')}
            </div>
            <div class="context-menu-item" data-action="show-code-quality" data-line-action title="${t('viewer.ctx.showCodeQuality.title')}">
                <span class="codicon codicon-symbol-misc"></span> ${t('viewer.ctx.showCodeQuality.label')}
            </div>
            <div class="context-menu-item" data-action="show-git-history" title="${t('viewer.ctx.showGitHistory.title')}">
                <span class="codicon codicon-git-commit"></span> ${t('viewer.ctx.showGitHistory.label')}
            </div>
            <div class="context-menu-item" data-action="show-changelog-since" title="${t('viewer.ctx.showChangelogSince.title')}">
                <span class="codicon codicon-history"></span> ${t('viewer.ctx.showChangelogSince.label')}
            </div>
            <div class="context-menu-item" data-action="open-drift-advisor" data-line-action data-drift-line-action title="${t('viewer.ctx.openDriftAdvisor.title')}">
                <span class="codicon codicon-database"></span> ${t('viewer.ctx.openDriftAdvisor.label')}
            </div>
            <div class="context-menu-item" data-action="find-static-sources-line" data-line-action data-static-sql-line-action title="${t('viewer.ctx.findStaticSources.title')}">
                <span class="codicon codicon-search"></span> ${t('viewer.ctx.findStaticSources.label')}
            </div>
            <div class="context-menu-item" data-action="explain-with-ai" data-line-action title="${t('viewer.ctx.explainWithAi.title')}">
                <span class="codicon codicon-sparkle"></span> ${t('viewer.ctx.explainWithAi.label')}
            </div>
            <div class="context-menu-item" data-action="explain-root-cause-hypotheses" data-line-action title="${t('viewer.ctx.explainSignals.title')}">
                <span class="codicon codicon-lightbulb"></span> ${t('viewer.ctx.explainSignals.label')}
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="add-watch" title="${t('viewer.ctx.addWatch.title')}">
                <span class="codicon codicon-eye"></span> ${t('viewer.ctx.addWatch.label')}
            </div>
        </div>
    </div>
    <div class="context-menu-submenu" id="hide-lines-submenu">
        <span class="codicon codicon-eye-closed"></span> ${t('viewer.ctx.submenu.hide')}
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="hide-line" data-line-action title="${t('viewer.ctx.hideLine.title')}">
                <span class="codicon codicon-eye-closed"></span> ${t('viewer.ctx.hideLine.label')}
            </div>
            <div class="context-menu-item" data-action="unhide-line" data-line-action data-requires-hidden title="${t('viewer.ctx.unhideLine.title')}">
                <span class="codicon codicon-eye"></span> ${t('viewer.ctx.unhideLine.label')}
            </div>
            <div class="context-menu-separator" data-selection-action></div>
            <div class="context-menu-item" data-action="hide-selection" data-selection-action title="${t('viewer.ctx.hideSelection.title')}">
                <span class="codicon codicon-eye-closed"></span> ${t('viewer.ctx.hideSelection.label')}
            </div>
            <div class="context-menu-item" data-action="unhide-selection" data-selection-action data-requires-hidden title="${t('viewer.ctx.unhideSelection.title')}">
                <span class="codicon codicon-eye"></span> ${t('viewer.ctx.unhideSelection.label')}
            </div>
            <div class="context-menu-separator" data-text-selection-action></div>
            <div class="context-menu-item" data-action="hide-text-session" data-text-selection-action title="${t('viewer.ctx.hideTextSession.title')}">
                <span class="codicon codicon-eye-closed"></span> ${t('viewer.ctx.hideTextSession.label')}
            </div>
            <div class="context-menu-item" data-action="hide-text-always" data-text-selection-action title="${t('viewer.ctx.hideTextAlways.title')}">
                <span class="codicon codicon-eye-closed"></span> ${t('viewer.ctx.hideTextAlways.label')}
            </div>
            <div class="context-menu-item" data-action="add-exclusion" data-line-action title="${t('viewer.ctx.addExclusion.title')}">
                <span class="codicon codicon-eye-closed"></span> ${t('viewer.ctx.addExclusion.label')}
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="hide-all-visible" title="${t('viewer.ctx.hideAllVisible.title')}">
                <span class="codicon codicon-eye-closed"></span> ${t('viewer.ctx.hideAllVisible.label')}
            </div>
            <div class="context-menu-item" data-action="unhide-all" data-requires-any-hidden title="${t('viewer.ctx.unhideAll.title')}">
                <span class="codicon codicon-eye"></span> ${t('viewer.ctx.unhideAll.label')}
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-show-blank-lines" title="${t('viewer.ctx.toggleBlankLines.title')}">
                <span class="codicon codicon-whitespace" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleBlankLines.label')}</span>
                <span class="context-menu-shortcut">H</span>
            </div>
        </div>
    </div>
    <div class="context-menu-submenu">
        <span class="codicon codicon-table"></span> ${t('viewer.ctx.submenu.columns')}
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item context-menu-toggle" data-action="toggle-line-numbers" title="${t('viewer.ctx.toggleLineNumbers.title')}">
                <span class="codicon codicon-list-ordered" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleLineNumbers.label')}</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-timestamp" title="${t('viewer.ctx.toggleTimestamp.title')}">
                <span class="codicon codicon-clock" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleTimestamp.label')}</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-session-elapsed" title="${t('viewer.ctx.toggleSessionElapsed.title')}">
                <span class="codicon codicon-watch" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleSessionElapsed.label')}</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-parsed-tag" title="${t('viewer.ctx.toggleParsedTag.title')}">
                <span class="codicon codicon-tag" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleParsedTag.label')}</span>
            </div>
        </div>
    </div>
    <div class="context-menu-submenu">
        <span class="codicon codicon-settings-gear"></span> ${t('viewer.ctx.submenu.layout')}
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item context-menu-toggle" data-action="toggle-wrap" title="${t('viewer.ctx.toggleWrap.title')}">
                <span class="codicon codicon-word-wrap" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleWrap.label')}</span>
                <span class="context-menu-shortcut">W</span>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-spacing" title="${t('viewer.ctx.toggleSpacing.title')}">
                <span class="codicon codicon-layout-panel" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleSpacing.label')}</span>
                <span class="context-menu-shortcut">V</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-line-height" title="${t('viewer.ctx.toggleLineHeight.title')}">
                <span class="codicon codicon-unfold" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleLineHeight.label')}</span>
                <span class="context-menu-shortcut">Ctrl+Shift+Scroll</span>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-compress-lines" title="${t('viewer.ctx.toggleCompressLines.title')}">
                <span class="codicon codicon-fold" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleCompressLines.label')}</span>
                <span class="context-menu-shortcut">C</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-compress-lines-global" title="${t('viewer.ctx.toggleCompressLinesGlobal.title')}">
                <span class="codicon codicon-fold-down" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">${t('viewer.ctx.toggleCompressLinesGlobal.label')}</span>
            </div>
        </div>
    </div>
</div>`;
}

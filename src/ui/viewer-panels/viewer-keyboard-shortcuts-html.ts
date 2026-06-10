/**
 * HTML for the Keyboard Shortcuts screen shown when the user clicks
 * "Keyboard shortcuts…" in the Options panel or presses F1.
 * Same slide-out panel pattern as Integrations view; open/close in
 * viewer-options-panel-script.
 *
 * Rows with `data-action-id` are rebindable — double-click to record a new key.
 * The key column updates dynamically via `syncShortcutsTable()` in
 * viewer-options-panel-script.ts.
 *
 * Localized via t() (keys in strings-viewer-f.ts). <kbd> key names stay
 * literal; Command-Palette command NAMES stay English because they double as
 * the palette search term (data-keybinding-search) — only descriptions are keyed.
 */

import { t } from "../../l10n";

/** Returns the HTML for the Keyboard Shortcuts view (header + back + content). */
export function getKeyboardShortcutsViewHtml(): string {
    return `
    <div id="shortcuts-view" class="integrations-view shortcuts-view-hidden" role="region" aria-label="${t('viewer.shortcuts.region')}" aria-hidden="true">
        <div class="integrations-header">
            <button type="button" id="shortcuts-back" class="integrations-back" title="${t('viewer.shortcuts.back')}" aria-label="${t('viewer.shortcuts.back')}"><span class="codicon codicon-arrow-left"></span></button>
            <span class="integrations-title">${t('viewer.shortcuts.region')}</span>
        </div>
        <div class="integrations-content shortcuts-content">
            <p class="integrations-intro">${t('viewer.shortcuts.intro')}</p>

${getPowerShortcutsHtml()}

${getCommandPaletteHtml()}
            <p class="integrations-intro">${t('viewer.shortcuts.commandNote')}</p>
        </div>
    </div>`;
}

/** A column-header row shared by every shortcuts table (Key / Action / Description). */
function shortcutsTableHead(): string {
    return `<thead><tr><th>${t('viewer.shortcuts.col.key')}</th><th>${t('viewer.shortcuts.col.action')}</th><th>${t('viewer.shortcuts.col.description')}</th></tr></thead>`;
}

/** One rebindable/static shortcut row: key cell (literal), then localized action + description. */
function shortcutRow(keyCell: string, id: string, attrs = ''): string {
    return `<tr${attrs}><td>${keyCell}</td><td>${t(`viewer.shortcuts.${id}.action`)}</td><td>${t(`viewer.shortcuts.${id}.desc`)}</td></tr>`;
}

/** Power shortcuts table — grouped by category. */
function getPowerShortcutsHtml(): string {
    return `
            <h3 class="shortcuts-h3">${t('viewer.shortcuts.sec.general')}</h3>
            <table class="shortcuts-table">
                ${shortcutsTableHead()}
                <tbody>
                    ${shortcutRow('<kbd>F1</kbd>', 'showKeyboardShortcuts', ' data-action-id="showKeyboardShortcuts"')}
                </tbody>
            </table>

            <h3 class="shortcuts-h3">${t('viewer.shortcuts.sec.navigation')}</h3>
            <table class="shortcuts-table" id="shortcuts-power-table">
                ${shortcutsTableHead()}
                <tbody>
                    ${shortcutRow('<kbd>Home</kbd>', 'home', ' data-action-id="home"')}
                    ${shortcutRow('<kbd>End</kbd>', 'end', ' data-action-id="end"')}
                    ${shortcutRow('<kbd>PageUp</kbd>', 'pageUp', ' data-action-id="pageUp"')}
                    ${shortcutRow('<kbd>PageDown</kbd>', 'pageDown', ' data-action-id="pageDown"')}
                    ${shortcutRow('<kbd>Ctrl+G</kbd>', 'gotoLine', ' data-action-id="gotoLine"')}
                    ${shortcutRow('<kbd>[</kbd>', 'prevSession', ' data-action-id="prevSession"')}
                    ${shortcutRow('<kbd>]</kbd>', 'nextSession', ' data-action-id="nextSession"')}
                    ${shortcutRow('<kbd>Shift+[</kbd>', 'prevPart', ' data-action-id="prevPart"')}
                    ${shortcutRow('<kbd>Shift+]</kbd>', 'nextPart', ' data-action-id="nextPart"')}
                </tbody>
            </table>

            <h3 class="shortcuts-h3">${t('viewer.shortcuts.sec.search')}</h3>
            <table class="shortcuts-table">
                ${shortcutsTableHead()}
                <tbody>
                    ${shortcutRow('<kbd>Ctrl+F</kbd>', 'openSearch', ' data-action-id="openSearch"')}
                    ${shortcutRow('<kbd>F3</kbd> / <kbd>Shift+F3</kbd>', 'nextPrevMatch')}
                    ${shortcutRow('<kbd>Ctrl+Shift+F</kbd>', 'openFindPanel', ' data-action-id="openFindPanel"')}
                    ${shortcutRow('<kbd>Escape</kbd>', 'escape', ' data-action-id="escape"')}
                </tbody>
            </table>

            <h3 class="shortcuts-h3">${t('viewer.shortcuts.sec.lineActions')}</h3>
            <table class="shortcuts-table">
                ${shortcutsTableHead()}
                <tbody>
                    ${shortcutRow('<kbd>P</kbd>', 'togglePin', ' data-action-id="togglePin"')}
                    ${shortcutRow('<kbd>N</kbd>', 'annotate', ' data-action-id="annotate"')}
                    ${shortcutRow('<kbd>Ctrl+B</kbd>', 'bookmark', ' data-action-id="bookmark"')}
                    ${shortcutRow('<kbd>M</kbd>', 'insertMarker', ' data-action-id="insertMarker"')}
                    ${shortcutRow('<kbd>Shift+Click</kbd>', 'selectRange')}
                    ${shortcutRow('<kbd>Shift+Down</kbd>', 'extendSelectionDown', ' data-action-id="extendSelectionDown"')}
                    ${shortcutRow('<kbd>Shift+Up</kbd>', 'extendSelectionUp', ' data-action-id="extendSelectionUp"')}
                    ${shortcutRow('<kbd>Shift+PageDown</kbd>', 'extendSelectionPageDown', ' data-action-id="extendSelectionPageDown"')}
                    ${shortcutRow('<kbd>Shift+PageUp</kbd>', 'extendSelectionPageUp', ' data-action-id="extendSelectionPageUp"')}
                    ${shortcutRow('<kbd>Ctrl+Shift+End</kbd>', 'extendSelectionBottom', ' data-action-id="extendSelectionBottom"')}
                    ${shortcutRow('<kbd>Ctrl+Shift+Home</kbd>', 'extendSelectionTop', ' data-action-id="extendSelectionTop"')}
                    ${shortcutRow('Double-click', 'inlinePeek')}
                </tbody>
            </table>

            <h3 class="shortcuts-h3">${t('viewer.shortcuts.sec.copy')}</h3>
            <table class="shortcuts-table">
                ${shortcutsTableHead()}
                <tbody>
                    ${shortcutRow('<kbd>Ctrl+C</kbd>', 'copyJson', ' data-action-id="copyJson"')}
                    ${shortcutRow('<kbd>—</kbd>', 'copyPlain', ' data-action-id="copyPlain"')}
                    ${shortcutRow('<kbd>Ctrl+Shift+C</kbd>', 'copyMarkdown', ' data-action-id="copyMarkdown"')}
                    ${shortcutRow('<kbd>Ctrl+Alt+C</kbd>', 'copyRaw', ' data-action-id="copyRaw"')}
                    ${shortcutRow('<kbd>Ctrl+Shift+A</kbd>', 'copyAll', ' data-action-id="copyAll"')}
                    ${shortcutRow('<kbd>Ctrl+A</kbd>', 'selectAll', ' data-action-id="selectAll"')}
                    ${shortcutRow('<kbd>Ctrl+Shift+P</kbd>', 'copyFilePath', ' data-action-id="copyFilePath"')}
                    ${shortcutRow('<kbd>Ctrl+Shift+E</kbd>', 'revealFile', ' data-action-id="revealFile"')}
                </tbody>
            </table>

            <h3 class="shortcuts-h3">${t('viewer.shortcuts.sec.display')}</h3>
            <table class="shortcuts-table">
                ${shortcutsTableHead()}
                <tbody>
                    ${shortcutRow('<kbd>Ctrl+=</kbd>', 'fontSizeUp', ' data-action-id="fontSizeUp"')}
                    ${shortcutRow('<kbd>Ctrl+-</kbd>', 'fontSizeDown', ' data-action-id="fontSizeDown"')}
                    ${shortcutRow('<kbd>Ctrl+0</kbd>', 'fontSizeReset', ' data-action-id="fontSizeReset"')}
                    ${shortcutRow('<kbd>Ctrl+Shift+=</kbd>', 'lineHeightUp', ' data-action-id="lineHeightUp"')}
                    ${shortcutRow('<kbd>Ctrl+Shift+-</kbd>', 'lineHeightDown', ' data-action-id="lineHeightDown"')}
                    ${shortcutRow('<kbd>Ctrl+Shift+0</kbd>', 'lineHeightReset', ' data-action-id="lineHeightReset"')}
                    ${shortcutRow('<kbd>W</kbd>', 'toggleWrap', ' data-action-id="toggleWrap"')}
                    ${shortcutRow('<kbd>C</kbd>', 'toggleCompress', ' data-action-id="toggleCompress"')}
                    ${shortcutRow('<kbd>H</kbd>', 'toggleBlankLines', ' data-action-id="toggleBlankLines"')}
                    ${shortcutRow('<kbd>V</kbd>', 'toggleSpacing', ' data-action-id="toggleSpacing"')}
                    ${shortcutRow('<kbd>Space</kbd>', 'togglePause', ' data-action-id="togglePause"')}
                    ${shortcutRow('<kbd>A</kbd>', 'toggleDevice', ' data-action-id="toggleDevice"')}
                </tbody>
            </table>

            <h3 class="shortcuts-h3">${t('viewer.shortcuts.sec.panels')}</h3>
            <table class="shortcuts-table">
                ${shortcutsTableHead()}
                <tbody>
                    ${shortcutRow('<kbd>O</kbd>', 'toggleOptions', ' data-action-id="toggleOptions"')}
                    ${shortcutRow('<kbd>F</kbd>', 'toggleFilters', ' data-action-id="toggleFilters"')}
                    ${shortcutRow('<kbd>S</kbd>', 'toggleSignals', ' data-action-id="toggleSignals"')}
                    ${shortcutRow('<kbd>B</kbd>', 'toggleBookmarks', ' data-action-id="toggleBookmarks"')}
                    ${shortcutRow('<kbd>L</kbd>', 'toggleSessions', ' data-action-id="toggleSessions"')}
                    ${shortcutRow('<kbd>I</kbd>', 'toggleCollections', ' data-action-id="toggleCollections"')}
                    ${shortcutRow('<kbd>Q</kbd>', 'toggleSqlHistory', ' data-action-id="toggleSqlHistory"')}
                    ${shortcutRow('<kbd>T</kbd>', 'toggleTrash', ' data-action-id="toggleTrash"')}
                </tbody>
            </table>`;
}

/** One Command-Palette row: command NAME stays English (also the search term), localized description. */
function commandRow(command: string, descId: string): string {
    return `<tr data-keybinding-search="Saropa Log Capture: ${command}"><td>${command}</td><td>${t(`viewer.shortcuts.cmd.${descId}.desc`)}</td></tr>`;
}

/** Command Palette shortcuts table. */
function getCommandPaletteHtml(): string {
    return `
            <h3 class="shortcuts-h3">${t('viewer.shortcuts.sec.commands')}</h3>
            <table class="shortcuts-table" id="shortcuts-commands-table">
                <thead><tr><th>${t('viewer.shortcuts.col.command')}</th><th>${t('viewer.shortcuts.col.description')}</th></tr></thead>
                <tbody>
                    ${commandRow('Start Capture', 'startCapture')}
                    ${commandRow('Stop Capture', 'stopCapture')}
                    ${commandRow('Pause/Resume Capture', 'pauseResume')}
                    ${commandRow('Insert Marker', 'insertMarker')}
                    ${commandRow('Open Active Log File', 'openActiveLog')}
                    ${commandRow('Open Log Folder', 'openLogFolder')}
                    ${commandRow('Clear Current Session', 'clearSession')}
                    ${commandRow('Delete Log File', 'deleteLog')}
                    ${commandRow('Split Log File Now', 'splitLog')}
                    ${commandRow('Search Log Files', 'searchLogs')}
                    ${commandRow('Apply Quick Filter', 'applyQuickFilter')}
                    ${commandRow('Save current filters as Quick Filter', 'saveQuickFilter')}
                    ${commandRow('Toggle Inline Log Decorations', 'toggleDecorations')}
                    ${commandRow('Compare Sessions', 'compareSessions')}
                    ${commandRow('Apply Session Template', 'applyTemplate')}
                    ${commandRow('Save Settings as Template', 'saveTemplate')}
                    ${commandRow('Open Tailed File', 'openTailed')}
                    ${commandRow('Import .slc Bundle', 'importBundle')}
                    ${commandRow('Configure integrations', 'configureIntegrations')}
                </tbody>
            </table>`;
}

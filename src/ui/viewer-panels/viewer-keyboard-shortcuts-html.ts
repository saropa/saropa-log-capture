/**
 * HTML for the Keyboard Shortcuts screen shown when the user clicks
 * "Keyboard shortcuts…" in the Options panel or presses F1.
 * Same slide-out panel pattern as Integrations view; open/close in
 * viewer-options-panel-script.
 *
 * Rows with `data-action-id` are rebindable — double-click to record a new key.
 * The key column updates dynamically via `syncShortcutsTable()` in
 * viewer-options-panel-script.ts.
 */

/** Returns the HTML for the Keyboard Shortcuts view (header + back + content). */
export function getKeyboardShortcutsViewHtml(): string {
    return `
    <div id="shortcuts-view" class="integrations-view shortcuts-view-hidden" role="region" aria-label="Keyboard shortcuts" aria-hidden="true">
        <div class="integrations-header">
            <button type="button" id="shortcuts-back" class="integrations-back" title="Back to Options" aria-label="Back to Options"><span class="codicon codicon-arrow-left"></span></button>
            <span class="integrations-title">Keyboard shortcuts</span>
        </div>
        <div class="integrations-content shortcuts-content">
            <p class="integrations-intro">Quick reference for the log viewer panel. Double-click a power shortcut row to rebind it.</p>

${getPowerShortcutsHtml()}

${getCommandPaletteHtml()}
            <p class="integrations-intro">All commands are under <strong>Saropa Log Capture:</strong> in the Command Palette (Ctrl+Shift+P). See README for the full list.</p>
        </div>
    </div>`;
}

/** Power shortcuts table — grouped by category. */
function getPowerShortcutsHtml(): string {
    return `
            <h3 class="shortcuts-h3">General</h3>
            <table class="shortcuts-table">
                <thead><tr><th>Key</th><th>Action</th><th>Description</th></tr></thead>
                <tbody>
                    <tr data-action-id="showKeyboardShortcuts"><td><kbd>F1</kbd></td><td>Keyboard shortcuts</td><td>Open this keyboard shortcuts reference</td></tr>
                </tbody>
            </table>

            <h3 class="shortcuts-h3">Navigation</h3>
            <table class="shortcuts-table" id="shortcuts-power-table">
                <thead><tr><th>Key</th><th>Action</th><th>Description</th></tr></thead>
                <tbody>
                    <tr data-action-id="home"><td><kbd>Home</kbd></td><td>Scroll to top</td><td>Jump to the first line in the log</td></tr>
                    <tr data-action-id="end"><td><kbd>End</kbd></td><td>Scroll to bottom</td><td>Jump to the last line and re-enable auto-scroll</td></tr>
                    <tr data-action-id="pageUp"><td><kbd>PageUp</kbd></td><td>Page up</td><td>Scroll up by 80% of the viewport height</td></tr>
                    <tr data-action-id="pageDown"><td><kbd>PageDown</kbd></td><td>Page down</td><td>Scroll down by 80% of the viewport height</td></tr>
                    <tr data-action-id="gotoLine"><td><kbd>Ctrl+G</kbd></td><td>Go to line</td><td>Open a prompt to jump to a specific line number</td></tr>
                    <tr data-action-id="prevSession"><td><kbd>[</kbd></td><td>Previous session</td><td>Navigate to the previous log session file</td></tr>
                    <tr data-action-id="nextSession"><td><kbd>]</kbd></td><td>Next session</td><td>Navigate to the next log session file</td></tr>
                    <tr data-action-id="prevPart"><td><kbd>Shift+[</kbd></td><td>Previous file part</td><td>Navigate to the previous split part of the current log file</td></tr>
                    <tr data-action-id="nextPart"><td><kbd>Shift+]</kbd></td><td>Next file part</td><td>Navigate to the next split part of the current log file</td></tr>
                </tbody>
            </table>

            <h3 class="shortcuts-h3">Search</h3>
            <table class="shortcuts-table">
                <thead><tr><th>Key</th><th>Action</th><th>Description</th></tr></thead>
                <tbody>
                    <tr data-action-id="openSearch"><td><kbd>Ctrl+F</kbd></td><td>Focus log search</td><td>Open the search flyout and focus the search input</td></tr>
                    <tr><td><kbd>F3</kbd> / <kbd>Shift+F3</kbd></td><td>Next / previous match</td><td>Jump between search matches</td></tr>
                    <tr data-action-id="openFindPanel"><td><kbd>Ctrl+Shift+F</kbd></td><td>Find in files</td><td>Open the find-in-files panel to search across all sessions</td></tr>
                    <tr data-action-id="escape"><td><kbd>Escape</kbd></td><td>Close / dismiss</td><td>Close search, inline peek, go-to-line, or any open panel</td></tr>
                </tbody>
            </table>

            <h3 class="shortcuts-h3">Line actions</h3>
            <table class="shortcuts-table">
                <thead><tr><th>Key</th><th>Action</th><th>Description</th></tr></thead>
                <tbody>
                    <tr data-action-id="togglePin"><td><kbd>P</kbd></td><td>Pin/unpin line</td><td>Pin the center line to the sticky header for quick reference</td></tr>
                    <tr data-action-id="annotate"><td><kbd>N</kbd></td><td>Annotate line</td><td>Add a text annotation to the center line</td></tr>
                    <tr data-action-id="bookmark"><td><kbd>Ctrl+B</kbd></td><td>Bookmark line</td><td>Save the center line to the bookmarks panel</td></tr>
                    <tr data-action-id="insertMarker"><td><kbd>M</kbd></td><td>Insert marker</td><td>Insert a visual separator line at the current position</td></tr>
                    <tr><td><kbd>Shift+Click</kbd></td><td>Select range</td><td>Select a range of lines between the click and the last selected line</td></tr>
                    <tr><td>Double-click</td><td>Inline peek</td><td>Open an inline peek showing surrounding context lines</td></tr>
                </tbody>
            </table>

            <h3 class="shortcuts-h3">Copy</h3>
            <table class="shortcuts-table">
                <thead><tr><th>Key</th><th>Action</th><th>Description</th></tr></thead>
                <tbody>
                    <tr data-action-id="copyPlain"><td><kbd>Ctrl+C</kbd></td><td>Copy selection</td><td>Copy selected lines as plain text</td></tr>
                    <tr data-action-id="copyMarkdown"><td><kbd>Ctrl+Shift+C</kbd></td><td>Copy as markdown</td><td>Copy selected lines formatted as a markdown code block</td></tr>
                    <tr data-action-id="copyRaw"><td><kbd>Ctrl+Alt+C</kbd></td><td>Copy as raw text</td><td>Copy selected lines with original decorations intact</td></tr>
                    <tr data-action-id="copyAll"><td><kbd>Ctrl+Shift+A</kbd></td><td>Copy all visible</td><td>Copy every visible (non-filtered) line to the clipboard</td></tr>
                    <tr data-action-id="selectAll"><td><kbd>Ctrl+A</kbd></td><td>Select all</td><td>Select all lines in the viewport</td></tr>
                    <tr data-action-id="copyFilePath"><td><kbd>Ctrl+Shift+P</kbd></td><td>Copy file path</td><td>Copy the current log file path to the clipboard</td></tr>
                    <tr data-action-id="revealFile"><td><kbd>Ctrl+Shift+E</kbd></td><td>Reveal log file</td><td>Show the current log file in the system file explorer</td></tr>
                </tbody>
            </table>

            <h3 class="shortcuts-h3">Display</h3>
            <table class="shortcuts-table">
                <thead><tr><th>Key</th><th>Action</th><th>Description</th></tr></thead>
                <tbody>
                    <tr data-action-id="fontSizeUp"><td><kbd>Ctrl+=</kbd></td><td>Font size up</td><td>Increase the log font size by 1px</td></tr>
                    <tr data-action-id="fontSizeDown"><td><kbd>Ctrl+-</kbd></td><td>Font size down</td><td>Decrease the log font size by 1px</td></tr>
                    <tr data-action-id="fontSizeReset"><td><kbd>Ctrl+0</kbd></td><td>Font size reset</td><td>Reset the font size to the default (13px)</td></tr>
                    <tr data-action-id="lineHeightUp"><td><kbd>Ctrl+Shift+=</kbd></td><td>Line height up</td><td>Increase line spacing by 0.1x</td></tr>
                    <tr data-action-id="lineHeightDown"><td><kbd>Ctrl+Shift+-</kbd></td><td>Line height down</td><td>Decrease line spacing by 0.1x</td></tr>
                    <tr data-action-id="lineHeightReset"><td><kbd>Ctrl+Shift+0</kbd></td><td>Line height reset</td><td>Reset line spacing to the default (2.0x)</td></tr>
                    <tr data-action-id="toggleWrap"><td><kbd>W</kbd></td><td>Word wrap</td><td>Toggle wrapping of long lines to fit the panel width</td></tr>
                    <tr data-action-id="toggleCompress"><td><kbd>C</kbd></td><td>Compress duplicates</td><td>Collapse consecutive identical lines into one row with a count badge</td></tr>
                    <tr data-action-id="toggleBlankLines"><td><kbd>H</kbd></td><td>Hide blank lines</td><td>Hide lines that are empty or only whitespace</td></tr>
                    <tr data-action-id="toggleSpacing"><td><kbd>V</kbd></td><td>Visual spacing</td><td>Toggle breathing room between log sections</td></tr>
                    <tr data-action-id="togglePause"><td><kbd>Space</kbd></td><td>Pause/resume</td><td>Pause auto-scroll so new lines don't push the viewport</td></tr>
                    <tr data-action-id="toggleDevice"><td><kbd>A</kbd></td><td>Cycle device logs</td><td>Cycle device log visibility: None → Warn+ → All → None</td></tr>
                </tbody>
            </table>

            <h3 class="shortcuts-h3">Panels</h3>
            <table class="shortcuts-table">
                <thead><tr><th>Key</th><th>Action</th><th>Description</th></tr></thead>
                <tbody>
                    <tr data-action-id="toggleOptions"><td><kbd>O</kbd></td><td>Options</td><td>Open or close the options panel</td></tr>
                    <tr data-action-id="toggleFilters"><td><kbd>F</kbd></td><td>Filters</td><td>Open or close the filters panel</td></tr>
                    <tr data-action-id="toggleSignals"><td><kbd>S</kbd></td><td>Signals</td><td>Open or close the signals / root cause panel</td></tr>
                    <tr data-action-id="toggleBookmarks"><td><kbd>B</kbd></td><td>Bookmarks</td><td>Open or close the bookmarks panel</td></tr>
                    <tr data-action-id="toggleSessions"><td><kbd>L</kbd></td><td>Logs</td><td>Open or close the Logs panel</td></tr>
                    <tr data-action-id="toggleCollections"><td><kbd>I</kbd></td><td>Collections</td><td>Open or close the collections panel</td></tr>
                    <tr data-action-id="toggleSqlHistory"><td><kbd>Q</kbd></td><td>SQL history</td><td>Open or close the SQL query history panel</td></tr>
                    <tr data-action-id="toggleTrash"><td><kbd>T</kbd></td><td>Trash</td><td>Open or close the trash panel</td></tr>
                </tbody>
            </table>`;
}

/** Command Palette shortcuts table. */
function getCommandPaletteHtml(): string {
    return `
            <h3 class="shortcuts-h3">Key commands (Command Palette)</h3>
            <table class="shortcuts-table" id="shortcuts-commands-table">
                <thead><tr><th>Command</th><th>Description</th></tr></thead>
                <tbody>
                    <tr data-keybinding-search="Saropa Log Capture: Start Capture"><td>Start Capture</td><td>Start capturing to a new log file</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Stop Capture"><td>Stop Capture</td><td>Stop capturing and finalize the file</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Pause/Resume Capture"><td>Pause/Resume Capture</td><td>Toggle capture on/off</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Insert Marker"><td>Insert Marker</td><td>Insert a visual separator into the log</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Open Active Log File"><td>Open Active Log File</td><td>Open the current log file in the editor</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Open Log Folder"><td>Open Log Folder</td><td>Reveal the log directory in the file explorer</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Clear Current Session"><td>Clear Current Session</td><td>Reset the line counter</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Delete Log File"><td>Delete Log File</td><td>Delete log files from the reports directory</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Split Log File Now"><td>Split Log File Now</td><td>Manually split the current log file</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Search Log Files"><td>Search Log Files</td><td>Search across all log files with Quick Pick</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Apply Quick Filter"><td>Apply Quick Filter</td><td>Apply a saved Quick Filter</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Save current filters as Quick Filter"><td>Save current filters as Quick Filter</td><td>Save current filter state as a named Quick Filter</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Toggle Inline Log Decorations"><td>Toggle Inline Log Decorations</td><td>Toggle inline log decorations in the editor</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Compare Sessions"><td>Compare Sessions</td><td>Side-by-side diff of two log sessions</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Apply Session Template"><td>Apply Session Template</td><td>Apply a saved session template</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Save Settings as Template"><td>Save Settings as Template</td><td>Save current settings as a reusable template</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Open Tailed File"><td>Open Tailed File</td><td>Open a workspace log file and tail it live</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Import .slc Bundle"><td>Import .slc Bundle</td><td>Import a .slc session bundle into the log dir</td></tr>
                    <tr data-keybinding-search="Saropa Log Capture: Configure integrations"><td>Configure integrations</td><td>Quick Pick to enable/disable integration adapters</td></tr>
                </tbody>
            </table>`;
}

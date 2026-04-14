"use strict";
/**
 * HTML for the Keyboard Shortcuts screen shown when the user clicks
 * "Keyboard shortcuts…" in the Options panel. Same slide-out panel pattern
 * as Integrations view; open/close in viewer-options-panel-script.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeyboardShortcutsViewHtml = getKeyboardShortcutsViewHtml;
/** Returns the HTML for the Keyboard Shortcuts view (header + back + content). */
function getKeyboardShortcutsViewHtml() {
    return `
    <div id="shortcuts-view" class="integrations-view shortcuts-view-hidden" role="region" aria-label="Keyboard shortcuts" aria-hidden="true">
        <div class="integrations-header">
            <button type="button" id="shortcuts-back" class="integrations-back" title="Back to Options" aria-label="Back to Options"><span class="codicon codicon-arrow-left"></span></button>
            <span class="integrations-title">Keyboard shortcuts</span>
        </div>
        <div class="integrations-content shortcuts-content">
            <p class="integrations-intro">Quick reference for the log viewer panel. For the full command list, see the README.</p>
            <p class="integrations-intro">To change a command's key: <strong>Keyboard Shortcuts</strong> (Ctrl+K Ctrl+S) → search "Saropa Log Capture". Double-click a command row to open Keyboard Shortcuts for that command. Double-click a power shortcut row to rebind it (then press the new key).</p>

            <h3 class="shortcuts-h3">Power shortcuts (panel viewer)</h3>
            <table class="shortcuts-table" id="shortcuts-power-table">
                <thead><tr><th>Key</th><th>Action</th></tr></thead>
                <tbody>
                    <tr data-action-id="openSearch"><td><kbd>Ctrl+F</kbd></td><td>Focus log search</td></tr>
                    <tr><td><kbd>F3</kbd> / <kbd>Shift+F3</kbd></td><td>Next / previous search match</td></tr>
                    <tr data-action-id="escape"><td><kbd>Escape</kbd></td><td>Close search panel / inline peek</td></tr>
                    <tr data-action-id="togglePause"><td><kbd>Space</kbd></td><td>Toggle pause/resume</td></tr>
                    <tr data-action-id="toggleWrap"><td><kbd>W</kbd></td><td>Toggle word wrap</td></tr>
                    <tr data-action-id="insertMarker"><td><kbd>M</kbd></td><td>Insert marker</td></tr>
                    <tr data-action-id="togglePin"><td><kbd>P</kbd></td><td>Pin/unpin center line</td></tr>
                    <tr><td><kbd>Shift+Click</kbd></td><td>Select line range</td></tr>
                    <tr data-action-id="copyPlain"><td><kbd>Ctrl+C</kbd></td><td>Copy selection as plain text</td></tr>
                    <tr data-action-id="copyMarkdown"><td><kbd>Ctrl+Shift+C</kbd></td><td>Copy selection as markdown</td></tr>
                    <tr data-action-id="copyAll"><td><kbd>Ctrl+Shift+A</kbd></td><td>Copy all visible lines to clipboard</td></tr>
                    <tr data-action-id="annotate"><td><kbd>N</kbd></td><td>Annotate center line</td></tr>
                    <tr data-action-id="toggleDevice"><td><kbd>A</kbd></td><td>Cycle device logs (None / Warn+ / All)</td></tr>
                    <tr><td>Double-click</td><td>Open inline peek with context lines</td></tr>
                    <tr data-action-id="home"><td><kbd>Home</kbd></td><td>Scroll to top</td></tr>
                    <tr data-action-id="end"><td><kbd>End</kbd></td><td>Scroll to bottom</td></tr>
                </tbody>
            </table>

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
            </table>
            <p class="integrations-intro">All commands are under <strong>Saropa Log Capture:</strong> in the Command Palette (Ctrl+Shift+P). See README for the full list.</p>
        </div>
    </div>`;
}
//# sourceMappingURL=viewer-keyboard-shortcuts-html.js.map
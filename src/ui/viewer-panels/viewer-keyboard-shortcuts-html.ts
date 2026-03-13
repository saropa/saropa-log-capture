/**
 * HTML for the Keyboard Shortcuts screen shown when the user clicks
 * "Keyboard shortcuts…" in the Options panel. Same slide-out panel pattern
 * as Integrations view; open/close in viewer-options-panel-script.
 */

/** Returns the HTML for the Keyboard Shortcuts view (header + back + content). */
export function getKeyboardShortcutsViewHtml(): string {
    return `
    <div id="shortcuts-view" class="integrations-view shortcuts-view-hidden" aria-hidden="true">
        <div class="integrations-header">
            <button type="button" id="shortcuts-back" class="integrations-back" title="Back to Options"><span class="codicon codicon-arrow-left"></span></button>
            <span class="integrations-title">Keyboard shortcuts</span>
        </div>
        <div class="integrations-content shortcuts-content">
            <p class="integrations-intro">Quick reference for the log viewer panel. For the full command list, see the README.</p>

            <h3 class="shortcuts-h3">Power shortcuts (panel viewer)</h3>
            <table class="shortcuts-table">
                <thead><tr><th>Key</th><th>Action</th></tr></thead>
                <tbody>
                    <tr><td><kbd>Ctrl+F</kbd></td><td>Open search panel</td></tr>
                    <tr><td><kbd>F3</kbd> / <kbd>Shift+F3</kbd></td><td>Next / previous search match</td></tr>
                    <tr><td><kbd>Escape</kbd></td><td>Close search panel / inline peek</td></tr>
                    <tr><td><kbd>Space</kbd></td><td>Toggle pause/resume</td></tr>
                    <tr><td><kbd>W</kbd></td><td>Toggle word wrap</td></tr>
                    <tr><td><kbd>M</kbd></td><td>Insert marker</td></tr>
                    <tr><td><kbd>P</kbd></td><td>Pin/unpin center line</td></tr>
                    <tr><td><kbd>Shift+Click</kbd></td><td>Select line range</td></tr>
                    <tr><td><kbd>Ctrl+C</kbd></td><td>Copy selection as plain text</td></tr>
                    <tr><td><kbd>Ctrl+Shift+C</kbd></td><td>Copy selection as markdown</td></tr>
                    <tr><td><kbd>Ctrl+Shift+A</kbd></td><td>Copy all visible lines to clipboard</td></tr>
                    <tr><td><kbd>N</kbd></td><td>Annotate center line</td></tr>
                    <tr><td><kbd>A</kbd></td><td>Toggle app-only stack trace mode</td></tr>
                    <tr><td>Double-click</td><td>Open inline peek with context lines</td></tr>
                    <tr><td><kbd>Home</kbd></td><td>Scroll to top</td></tr>
                    <tr><td><kbd>End</kbd></td><td>Scroll to bottom</td></tr>
                </tbody>
            </table>

            <h3 class="shortcuts-h3">Key commands (Command Palette)</h3>
            <table class="shortcuts-table">
                <thead><tr><th>Command</th><th>Description</th></tr></thead>
                <tbody>
                    <tr><td>Start Capture</td><td>Start capturing to a new log file</td></tr>
                    <tr><td>Stop Capture</td><td>Stop capturing and finalize the file</td></tr>
                    <tr><td>Pause/Resume Capture</td><td>Toggle capture on/off</td></tr>
                    <tr><td>Insert Marker</td><td>Insert a visual separator into the log</td></tr>
                    <tr><td>Open Active Log File</td><td>Open the current log file in the editor</td></tr>
                    <tr><td>Open Log Folder</td><td>Reveal the log directory in the file explorer</td></tr>
                    <tr><td>Clear Current Session</td><td>Reset the line counter</td></tr>
                    <tr><td>Delete Log File</td><td>Delete log files from the reports directory</td></tr>
                    <tr><td>Split Log File Now</td><td>Manually split the current log file</td></tr>
                    <tr><td>Search Log Files</td><td>Search across all log files with Quick Pick</td></tr>
                    <tr><td>Apply Filter Preset</td><td>Apply a saved filter preset</td></tr>
                    <tr><td>Save Current Filters as Preset</td><td>Save current filter state as a named preset</td></tr>
                    <tr><td>Toggle Inline Log Decorations</td><td>Toggle inline log decorations in the editor</td></tr>
                    <tr><td>Compare Sessions</td><td>Side-by-side diff of two log sessions</td></tr>
                    <tr><td>Apply Session Template</td><td>Apply a saved session template</td></tr>
                    <tr><td>Save Settings as Template</td><td>Save current settings as a reusable template</td></tr>
                    <tr><td>Open Tailed File</td><td>Open a workspace log file and tail it live</td></tr>
                    <tr><td>Import .slc Bundle</td><td>Import a .slc session bundle into the log dir</td></tr>
                    <tr><td>Configure integrations</td><td>Quick Pick to enable/disable integration adapters</td></tr>
                </tbody>
            </table>
            <p class="integrations-intro">All commands are under <strong>Saropa Log Capture:</strong> in the Command Palette (Ctrl+Shift+P). See README for the full list.</p>
        </div>
    </div>`;
}

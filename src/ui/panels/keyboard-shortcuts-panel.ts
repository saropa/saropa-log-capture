/**
 * Standalone keyboard shortcuts reference panel.
 *
 * Opens in the main VS Code editor area (ViewColumn.Beside) as a read-only
 * reference. Shows all rebindable viewer power shortcuts grouped by category,
 * with a description column explaining what each feature does — not just
 * the action name. Includes a search bar that filters rows by key, action
 * name, or description text.
 *
 * Triggered by F1 inside the log viewer, or via the Options → Keyboard
 * shortcuts link.
 */

import * as vscode from 'vscode';
import { getViewerActionToKeyFromConfig, type ViewerKeybindingActionId } from '../viewer/viewer-keybindings';
import { getKeyboardShortcutsPanelStyles } from './keyboard-shortcuts-panel-styles';
import { getKeyboardShortcutsPanelScript } from './keyboard-shortcuts-panel-script';

let panel: vscode.WebviewPanel | undefined;

/** Open (or reveal) the keyboard shortcuts reference panel. */
export function showKeyboardShortcutsPanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.keyboardShortcuts',
        'Saropa Keyboard Shortcuts',
        vscode.ViewColumn.Beside,
        { enableScripts: true, localResourceRoots: [] },
    );
    panel.onDidDispose(() => { panel = undefined; });
    panel.webview.html = buildHtml();
}

/** Dispose the singleton panel (called on extension deactivation). */
export function disposeKeyboardShortcutsPanel(): void {
    panel?.dispose();
    panel = undefined;
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function buildHtml(): string {
    const nonce = makeNonce();
    const keyMap = getViewerActionToKeyFromConfig();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getKeyboardShortcutsPanelStyles()}</style>
</head>
<body>
<div role="main" aria-label="Keyboard shortcuts reference">
<h1>Keyboard shortcuts</h1>
<p class="intro">All power shortcuts work inside the Saropa Log Capture viewer panel. Double-click a row in the viewer's Options → Keyboard shortcuts screen to rebind a key.</p>
<div class="search-bar">
    <input id="shortcut-search" type="text" placeholder="Filter shortcuts\u2026" aria-label="Filter shortcuts by key, name, or description" />
    <button id="shortcut-search-clear" type="button" aria-label="Clear filter" style="display:none">&times;</button>
    <span id="shortcut-match-count" class="match-count"></span>
</div>
${buildSection('General', generalRows(keyMap))}
${buildSection('Navigation', navigationRows(keyMap))}
${buildSection('Search', searchRows(keyMap))}
${buildSection('Line actions', lineActionRows(keyMap))}
${buildSection('Copy and clipboard', copyRows(keyMap))}
${buildSection('Display', displayRows(keyMap))}
${buildSection('Panels', panelRows(keyMap))}
</div>
<script nonce="${nonce}">${getKeyboardShortcutsPanelScript()}</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Row data — [actionId | null, displayKey, actionName, description]
// ---------------------------------------------------------------------------

type Row = [ViewerKeybindingActionId | null, string, string, string];

/** Format a key descriptor for display: ctrl+shift+= → Ctrl+Shift+= */
function fmtKey(raw: string): string {
    return raw.split('+').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('+');
}

/** Look up the current key for an action, falling back to the provided default. */
function key(map: Record<string, string>, id: ViewerKeybindingActionId, fallback: string): string {
    return fmtKey(map[id] ?? fallback);
}

function generalRows(m: Record<string, string>): Row[] {
    return [
        ['showKeyboardShortcuts', key(m, 'showKeyboardShortcuts', 'f1'), 'Keyboard shortcuts',
            'Opens this standalone reference panel in the editor area. Lists every rebindable power shortcut with its current key, a short name, and a detailed description of the feature. Use the search bar at the top to filter by any text.'],
    ];
}

function navigationRows(m: Record<string, string>): Row[] {
    return [
        ['home', key(m, 'home', 'home'), 'Scroll to top',
            'Instantly jumps to the first line of the log and disables auto-scroll, so the viewport stays anchored at the top even if new lines arrive during a live session.'],
        ['end', key(m, 'end', 'end'), 'Scroll to bottom',
            'Jumps to the last line and re-enables auto-scroll. In a live session, the view will track new lines as they arrive — the "auto-scroll" indicator in the toolbar disappears when active.'],
        ['pageUp', key(m, 'pageUp', 'pageup'), 'Page up',
            'Scrolls the viewport up by about 80% of its visible height, similar to Page Up in a text editor. Auto-scroll is turned off so the position sticks.'],
        ['pageDown', key(m, 'pageDown', 'pagedown'), 'Page down',
            'Scrolls the viewport down by about 80% of its visible height.'],
        ['gotoLine', key(m, 'gotoLine', 'ctrl+g'), 'Go to line',
            'Shows a small input prompt at the top of the viewer. Type a line number and press Enter to jump directly to that line. The prompt validates that the number is within range. Useful when a stack trace or error message references a specific line index.'],
        ['prevSession', key(m, 'prevSession', '['), 'Previous session',
            'Loads the previous log session file. The session navigator in the toolbar shows "Session N of M" — this steps backward (earlier in time). The viewer replaces the current content with the previous session\'s log.'],
        ['nextSession', key(m, 'nextSession', ']'), 'Next session',
            'Loads the next log session file — forward in time. The session counter in the toolbar updates to reflect the new position.'],
        ['prevPart', key(m, 'prevPart', 'shift+['), 'Previous file part',
            'When a log file exceeds the configured size limit, it is automatically split into numbered parts. This navigates to the previous part. The split navigator (e.g. "Part 2 of 5") appears in the toolbar when a file has multiple parts.'],
        ['nextPart', key(m, 'nextPart', 'shift+]'), 'Next file part',
            'Navigates to the next split part of the current log file. The part counter in the toolbar updates.'],
    ];
}

function searchRows(m: Record<string, string>): Row[] {
    return [
        ['openSearch', key(m, 'openSearch', 'ctrl+f'), 'Focus log search',
            'Opens the search flyout at the top of the viewer and places the cursor in the text input. As you type, matching lines are highlighted in real time. Non-matching lines can be dimmed or hidden depending on the search mode. The flyout also shows a match count (e.g. "12 of 347").'],
        [null, 'F3 / Shift+F3', 'Next / previous match',
            'Cycles through search matches. F3 moves to the next match below the current scroll position; Shift+F3 moves to the previous match above it. The viewport scrolls to center the matched line. Works whether the search input is focused or not.'],
        ['openFindPanel', key(m, 'openFindPanel', 'ctrl+shift+f'), 'Find in files',
            'Opens the Find in Files slide-out panel, which searches across all saved log sessions — not just the currently displayed one. Results appear grouped by session file name with line previews. Click a result to open that session and jump to the matching line.'],
        ['escape', key(m, 'escape', 'escape'), 'Close / dismiss',
            'Closes the topmost open overlay in order: inline peek popup → go-to-line prompt → search flyout → find panel → options panel → session panel. Pressing Escape repeatedly closes each layer.'],
    ];
}

function lineActionRows(m: Record<string, string>): Row[] {
    return [
        ['togglePin', key(m, 'togglePin', 'p'), 'Pin / unpin line',
            'Pins the line at the center of the viewport to a sticky header strip at the top of the viewer. The pinned line stays visible as you scroll through the rest of the log, showing its text, severity dot, and line number. This is useful for keeping a reference error visible while you scroll through surrounding context. Press again on the same line to unpin it. Multiple lines can be pinned simultaneously.'],
        ['annotate', key(m, 'annotate', 'n'), 'Annotate line',
            'Shows a text input dialog for the line at the center of the viewport. Type a note and press Enter to attach it. The annotation appears as a small colored label next to the line text and is persisted with the session file — so annotations survive viewer reloads and can be seen by anyone who opens the same log file.'],
        ['bookmark', key(m, 'bookmark', 'ctrl+b'), 'Bookmark line',
            'Saves the center line to the Bookmarks panel (open it with B). The bookmark stores the line number, text, and timestamp. In the Bookmarks panel, bookmarks are listed in order and each one is clickable — clicking jumps back to that exact line. Bookmarks persist across viewer reloads.'],
        ['insertMarker', key(m, 'insertMarker', 'm'), 'Insert marker',
            'Inserts a horizontal visual separator line at the current scroll position. Markers are full-width colored bars that stand out from regular log lines. They appear in the minimap as bright horizontal bands, making it easy to spot sections from the scroll overview. Use markers to divide the log into logical phases — for example, "before reproducing the bug" and "after".'],
        [null, 'Shift+Click', 'Select range',
            'Click a line, then Shift-click another line to select every line between them. Selected lines are highlighted with a background color. Once selected, you can copy them (Ctrl+C / Ctrl+Shift+C), hide them, or right-click for context menu actions like "Add to collection" or "Generate bug report".'],
        [null, 'Double-click', 'Inline peek',
            'Double-clicking a log line opens an inline peek popup centered on that line, showing several lines of surrounding context above and below. The popup appears as a floating card over the viewport. This lets you read nearby lines without losing your scroll position. Click outside the peek or press Escape to dismiss it.'],
    ];
}

function copyRows(m: Record<string, string>): Row[] {
    return [
        ['copyPlain', key(m, 'copyPlain', 'ctrl+c'), 'Copy selection',
            'Copies the currently selected log lines as plain text — no severity dots, no timestamps, no formatting. Each line\'s raw text content is placed on the clipboard separated by newlines. If no lines are explicitly selected, falls back to the native browser text selection.'],
        ['copyMarkdown', key(m, 'copyMarkdown', 'ctrl+shift+c'), 'Copy as markdown',
            'Copies the selected lines wrapped in a markdown fenced code block (```...```). The result is ready to paste directly into GitHub issues, Slack messages, or documentation and will render as a formatted code block.'],
        ['copyRaw', key(m, 'copyRaw', 'ctrl+alt+c'), 'Copy as raw text',
            'Copies the selected lines with their original decoration prefixes — line numbers, timestamps, severity indicators — exactly as they appear in the viewer. Useful when the visual context (which line, what time, what severity) matters in the paste destination.'],
        ['copyAll', key(m, 'copyAll', 'ctrl+shift+a'), 'Copy all visible',
            'Copies every line that is currently visible (not filtered out by search, level filters, or exclusions) to the clipboard as plain text. This is the fastest way to export a filtered view of the log.'],
        ['selectAll', key(m, 'selectAll', 'ctrl+a'), 'Select all',
            'Selects all lines currently rendered in the viewport. Selected lines are highlighted and can then be copied using any of the copy shortcuts, or acted on via the right-click context menu.'],
        ['copyFilePath', key(m, 'copyFilePath', 'ctrl+shift+p'), 'Copy log file path',
            'Copies the full filesystem path of the currently displayed log file to the clipboard and briefly shows a "Path copied" message in the VS Code status bar. Useful for referencing the exact file in terminal commands, bug reports, or chat messages.'],
        ['revealFile', key(m, 'revealFile', 'ctrl+shift+e'), 'Log file actions',
            'Opens a small menu: open the log in the text editor, reveal its folder in the system file manager, or copy the file path.'],
    ];
}

function displayRows(m: Record<string, string>): Row[] {
    return [
        ['fontSizeUp', key(m, 'fontSizeUp', 'ctrl+='), 'Font size up',
            'Increases the log text font size by 1 pixel. The viewer supports sizes from 4px (extremely compact, useful for getting a bird\'s-eye overview of log density) to 42px (large magnification for readability or presentations). The font size slider in Options tracks this value. Also works with Ctrl+scroll wheel.'],
        ['fontSizeDown', key(m, 'fontSizeDown', 'ctrl+-'), 'Font size down',
            'Decreases the log text font size by 1 pixel. The virtual scroller recalculates row heights automatically to keep scrolling smooth.'],
        ['fontSizeReset', key(m, 'fontSizeReset', 'ctrl+0'), 'Font size reset',
            'Resets the font size to the default of 13px, which matches VS Code\'s default editor font size.'],
        ['lineHeightUp', key(m, 'lineHeightUp', 'ctrl+shift+='), 'Line height up',
            'Increases the spacing between log lines by 0.1x multiplier. Higher values put more air between lines, making individual lines easier to scan in dense output. The line height slider in Options reflects this value. Range: 0.5x (tight) to 4.0x (very spacious).'],
        ['lineHeightDown', key(m, 'lineHeightDown', 'ctrl+shift+-'), 'Line height down',
            'Decreases the spacing between log lines by 0.1x multiplier. Lower values fit more lines on screen, useful when scrolling through large volumes of output.'],
        ['lineHeightReset', key(m, 'lineHeightReset', 'ctrl+shift+0'), 'Line height reset',
            'Resets line spacing to the default of 2.0x.'],
        ['toggleWrap', key(m, 'toggleWrap', 'w'), 'Word wrap',
            'Toggles word wrap for long log lines. When enabled, lines break at the panel edge so you can read the full text without horizontal scrolling — each wrapped segment gets additional vertical space. When disabled, long lines extend beyond the visible area and you can scroll horizontally to read them. The wrap checkbox in Options stays in sync.'],
        ['toggleCompress', key(m, 'toggleCompress', 'c'), 'Compress duplicates',
            'Toggles compression of consecutive identical log lines. When enabled, runs of duplicate lines collapse into a single visible row with a count badge (e.g. "×42") showing how many times the line repeated. This dramatically reduces visual noise when the same message is logged in a loop. The original line remains fully visible with its severity dot, line number, and timestamp.'],
        ['toggleBlankLines', key(m, 'toggleBlankLines', 'h'), 'Hide blank lines',
            'Toggles visibility of lines that are empty or contain only whitespace. When hidden, the log becomes denser and more scannable — the line numbers skip over the hidden blanks so you can see the gaps. The checkbox in Options stays in sync.'],
        ['toggleSpacing', key(m, 'toggleSpacing', 'v'), 'Visual spacing',
            'Toggles extra vertical "breathing room" between logical sections of the log — for example, between output from different source categories (stdout vs. stderr), or between different debug sessions. Off by default for IDE-like density; turn on when you want clearer section separation. The checkbox in Options stays in sync.'],
        ['togglePause', key(m, 'togglePause', 'space'), 'Pause / resume',
            'Pauses auto-scroll during a live capture session. When paused, new log lines continue to arrive and are stored, but the viewport stays where you left it — a "Paused" indicator appears in the toolbar with a line count showing how many new lines have arrived. Press again to resume: the viewport jumps to the latest line and auto-scroll re-engages.'],
        ['toggleDevice', key(m, 'toggleDevice', 'a'), 'Cycle device logs',
            'Cycles through three device/logcat log visibility modes: None (hides all device-tier lines, showing only your app output), Warn+ (shows only warnings, errors, and fatal messages from device sources), and All (shows everything including verbose and debug device output). Device logs are often extremely noisy — a single Flutter app session can produce thousands of framework lines — so filtering them is one of the most effective ways to focus on what matters.'],
    ];
}

function panelRows(m: Record<string, string>): Row[] {
    return [
        ['toggleOptions', key(m, 'toggleOptions', 'o'), 'Options panel',
            'Opens or closes the Options slide-out panel on the right side of the viewer. The panel contains display settings (font size and line height sliders, decoration toggles for severity dots, timestamps, line numbers, elapsed time), layout controls (word wrap, visual spacing, compress duplicates), integrations configuration, and a link to this keyboard shortcuts reference. Pressing O while the Options panel is already open closes it.'],
        ['toggleFilters', key(m, 'toggleFilters', 'f'), 'Filters panel',
            'Opens or closes the Filters slide-out panel. The panel has tabs for log levels (toggle visibility of verbose, debug, info, warning, error, fatal), source tags (filter by stdout, stderr, logcat, etc.), exclusion patterns (hide lines matching text or regex), and presets (save/load named filter combinations). All filters are non-destructive — hidden lines still exist in the data and can be revealed by adjusting filters.'],
        ['toggleSignals', key(m, 'toggleSignals', 's'), 'Signals panel',
            'Opens or closes the Signals slide-out panel. Signals are automatically detected patterns in your log output: errors, warnings, anomalies, recurring patterns, and AI-generated root-cause hypotheses. The panel groups signals by severity with expandable details and a "Jump to line" link for each. Signals are computed passively in the background as log data arrives.'],
        ['toggleBookmarks', key(m, 'toggleBookmarks', 'b'), 'Bookmarks panel',
            'Opens or closes the Bookmarks slide-out panel. Shows a vertical list of all bookmarked lines, each displaying the line number, timestamp, and text preview. Clicking a bookmark scrolls the viewer to that line and highlights it. Bookmarks are saved with the session and persist across viewer reloads. Use Ctrl+B to add the center line as a bookmark.'],
        ['toggleSessions', key(m, 'toggleSessions', 'l'), 'Logs panel',
            'Opens or closes the Logs slide-out panel. Lists every captured log file for the current workspace, sorted by date (newest first). Each entry shows the log name, date, line count, and file size. Right-click a log for actions: open, rename, tag, compare side-by-side, export (HTML/CSV/JSON/JSONL/SLC), move to trash, or add to a collection.'],
        ['toggleCollections', key(m, 'toggleCollections', 'i'), 'Collections panel',
            'Opens or closes the Collections slide-out panel. Collections group related logs and files for a specific bug, feature, or incident. Right-click a log in the Logs panel and choose "Add to Collection" to create one. Collections can be renamed, merged, exported, and shared.'],
        ['toggleSqlHistory', key(m, 'toggleSqlHistory', 'q'), 'SQL history panel',
            'Opens or closes the SQL Query History slide-out panel. Shows every SQL query captured during the session, grouped by SQL fingerprint (queries with the same structure but different parameters are merged). Each entry shows the query template, execution count, timing statistics (min/max/avg), and a clickable link to jump to the first occurrence in the log.'],
        ['toggleTrash', key(m, 'toggleTrash', 't'), 'Trash panel',
            'Opens or closes the Trash slide-out panel. Logs deleted from the Logs panel are moved here instead of being permanently removed. Each trashed log shows its name and deletion date. You can restore a log (moves it back to Logs) or permanently delete it to free disk space. The trash can also be emptied in bulk.'],
    ];
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

/** Build one grouped section with a heading and table. */
function buildSection(title: string, rows: Row[]): string {
    const trs = rows.map(([, k, name, desc]) =>
        `<tr><td class="key-col"><kbd>${esc(k)}</kbd></td><td class="name-col">${esc(name)}</td><td class="desc-col">${esc(desc)}</td></tr>`,
    ).join('\n');
    return `<h2>${esc(title)}</h2>
<table>
<thead><tr><th>Key</th><th>Action</th><th>Description</th></tr></thead>
<tbody>
${trs}
</tbody>
</table>`;
}

/** Escape HTML special characters for safe interpolation. */
function esc(s: string): string {
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function makeNonce(): string {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let r = '';
    for (let i = 0; i < 32; i++) { r += c[Math.floor(Math.random() * c.length)]; }
    return r;
}

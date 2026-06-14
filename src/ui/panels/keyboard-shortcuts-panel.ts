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
import { randomBytes } from 'crypto';
import { t } from '../../l10n';
import { getViewerActionToKeyFromConfig, type ViewerKeybindingActionId } from '../viewer/viewer-keybindings';
import { getKeyboardShortcutsPanelStyles } from './keyboard-shortcuts-panel-styles';
import { getKeyboardShortcutsPanelScript } from './keyboard-shortcuts-panel-script';

let panel: vscode.WebviewPanel | undefined;

/** Open (or reveal) the keyboard shortcuts reference panel. */
export function showKeyboardShortcutsPanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.keyboardShortcuts',
        t('kbd.chrome.panelTitle'),
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
<div role="main" aria-label="${esc(t('kbd.chrome.mainAria'))}">
<h1>${esc(t('kbd.chrome.title'))}</h1>
<p class="intro">${esc(t('kbd.chrome.intro'))}</p>
<div class="search-bar">
    <input id="shortcut-search" type="text" placeholder="${esc(t('kbd.chrome.searchPlaceholder'))}" aria-label="${esc(t('kbd.chrome.searchAria'))}" />
    <button id="shortcut-search-clear" type="button" aria-label="${esc(t('kbd.chrome.clearAria'))}" style="display:none">&times;</button>
    <span id="shortcut-match-count" class="match-count"></span>
</div>
${buildSection(t('kbd.section.general'), generalRows(keyMap))}
${buildSection(t('kbd.section.navigation'), navigationRows(keyMap))}
${buildSection(t('kbd.section.search'), searchRows(keyMap))}
${buildSection(t('kbd.section.lineActions'), lineActionRows(keyMap))}
${buildSection(t('kbd.section.copy'), copyRows(keyMap))}
${buildSection(t('kbd.section.display'), displayRows(keyMap))}
${buildSection(t('kbd.section.panels'), panelRows(keyMap))}
</div>
<script nonce="${nonce}">${getKeyboardShortcutsPanelScript()}</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Row data — [actionId | null, displayKey, actionName, description]
// ---------------------------------------------------------------------------

/** `[actionId | null, displayKey, nameKey, descKey]` — name/desc are l10n keys (see strings-kbd.ts). */
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
        ['showKeyboardShortcuts', key(m, 'showKeyboardShortcuts', 'f1'), 'kbd.row.showKeyboardShortcuts.name', 'kbd.row.showKeyboardShortcuts.desc'],
    ];
}

function navigationRows(m: Record<string, string>): Row[] {
    return [
        ['home', key(m, 'home', 'home'), 'kbd.row.home.name', 'kbd.row.home.desc'],
        ['end', key(m, 'end', 'end'), 'kbd.row.end.name', 'kbd.row.end.desc'],
        ['pageUp', key(m, 'pageUp', 'pageup'), 'kbd.row.pageUp.name', 'kbd.row.pageUp.desc'],
        ['pageDown', key(m, 'pageDown', 'pagedown'), 'kbd.row.pageDown.name', 'kbd.row.pageDown.desc'],
        ['gotoLine', key(m, 'gotoLine', 'ctrl+g'), 'kbd.row.gotoLine.name', 'kbd.row.gotoLine.desc'],
        ['prevSession', key(m, 'prevSession', '['), 'kbd.row.prevSession.name', 'kbd.row.prevSession.desc'],
        ['nextSession', key(m, 'nextSession', ']'), 'kbd.row.nextSession.name', 'kbd.row.nextSession.desc'],
        ['prevPart', key(m, 'prevPart', 'shift+['), 'kbd.row.prevPart.name', 'kbd.row.prevPart.desc'],
        ['nextPart', key(m, 'nextPart', 'shift+]'), 'kbd.row.nextPart.name', 'kbd.row.nextPart.desc'],
    ];
}

function searchRows(m: Record<string, string>): Row[] {
    return [
        ['openSearch', key(m, 'openSearch', 'ctrl+f'), 'kbd.row.openSearch.name', 'kbd.row.openSearch.desc'],
        [null, 'F3 / Shift+F3', 'kbd.row.searchMatch.name', 'kbd.row.searchMatch.desc'],
        ['openFindPanel', key(m, 'openFindPanel', 'ctrl+shift+f'), 'kbd.row.openFindPanel.name', 'kbd.row.openFindPanel.desc'],
        ['escape', key(m, 'escape', 'escape'), 'kbd.row.escape.name', 'kbd.row.escape.desc'],
    ];
}

function lineActionRows(m: Record<string, string>): Row[] {
    return [
        ['togglePin', key(m, 'togglePin', 'p'), 'kbd.row.togglePin.name', 'kbd.row.togglePin.desc'],
        ['annotate', key(m, 'annotate', 'n'), 'kbd.row.annotate.name', 'kbd.row.annotate.desc'],
        ['bookmark', key(m, 'bookmark', 'ctrl+b'), 'kbd.row.bookmark.name', 'kbd.row.bookmark.desc'],
        ['insertMarker', key(m, 'insertMarker', 'm'), 'kbd.row.insertMarker.name', 'kbd.row.insertMarker.desc'],
        [null, 'Shift+Click', 'kbd.row.selectRange.name', 'kbd.row.selectRange.desc'],
        [null, 'Double-click', 'kbd.row.inlinePeek.name', 'kbd.row.inlinePeek.desc'],
    ];
}

function copyRows(m: Record<string, string>): Row[] {
    return [
        ['copyJson', key(m, 'copyJson', 'ctrl+c'), 'kbd.row.copyJson.name', 'kbd.row.copyJson.desc'],
        ['copyPlain', key(m, 'copyPlain', ''), 'kbd.row.copyPlain.name', 'kbd.row.copyPlain.desc'],
        ['copyMarkdown', key(m, 'copyMarkdown', 'ctrl+shift+c'), 'kbd.row.copyMarkdown.name', 'kbd.row.copyMarkdown.desc'],
        ['copyRaw', key(m, 'copyRaw', 'ctrl+alt+c'), 'kbd.row.copyRaw.name', 'kbd.row.copyRaw.desc'],
        ['copyAll', key(m, 'copyAll', 'ctrl+shift+a'), 'kbd.row.copyAll.name', 'kbd.row.copyAll.desc'],
        ['selectAll', key(m, 'selectAll', 'ctrl+a'), 'kbd.row.selectAll.name', 'kbd.row.selectAll.desc'],
        ['copyFilePath', key(m, 'copyFilePath', 'ctrl+shift+p'), 'kbd.row.copyFilePath.name', 'kbd.row.copyFilePath.desc'],
        ['revealFile', key(m, 'revealFile', 'ctrl+shift+e'), 'kbd.row.revealFile.name', 'kbd.row.revealFile.desc'],
    ];
}

function displayRows(m: Record<string, string>): Row[] {
    return [
        ['fontSizeUp', key(m, 'fontSizeUp', 'ctrl+='), 'kbd.row.fontSizeUp.name', 'kbd.row.fontSizeUp.desc'],
        ['fontSizeDown', key(m, 'fontSizeDown', 'ctrl+-'), 'kbd.row.fontSizeDown.name', 'kbd.row.fontSizeDown.desc'],
        ['fontSizeReset', key(m, 'fontSizeReset', 'ctrl+0'), 'kbd.row.fontSizeReset.name', 'kbd.row.fontSizeReset.desc'],
        ['lineHeightUp', key(m, 'lineHeightUp', 'ctrl+shift+='), 'kbd.row.lineHeightUp.name', 'kbd.row.lineHeightUp.desc'],
        ['lineHeightDown', key(m, 'lineHeightDown', 'ctrl+shift+-'), 'kbd.row.lineHeightDown.name', 'kbd.row.lineHeightDown.desc'],
        ['lineHeightReset', key(m, 'lineHeightReset', 'ctrl+shift+0'), 'kbd.row.lineHeightReset.name', 'kbd.row.lineHeightReset.desc'],
        ['toggleWrap', key(m, 'toggleWrap', 'w'), 'kbd.row.toggleWrap.name', 'kbd.row.toggleWrap.desc'],
        ['toggleCompress', key(m, 'toggleCompress', 'c'), 'kbd.row.toggleCompress.name', 'kbd.row.toggleCompress.desc'],
        ['toggleBlankLines', key(m, 'toggleBlankLines', 'h'), 'kbd.row.toggleBlankLines.name', 'kbd.row.toggleBlankLines.desc'],
        ['toggleSpacing', key(m, 'toggleSpacing', 'v'), 'kbd.row.toggleSpacing.name', 'kbd.row.toggleSpacing.desc'],
        ['togglePause', key(m, 'togglePause', 'space'), 'kbd.row.togglePause.name', 'kbd.row.togglePause.desc'],
        ['toggleDevice', key(m, 'toggleDevice', 'a'), 'kbd.row.toggleDevice.name', 'kbd.row.toggleDevice.desc'],
    ];
}

function panelRows(m: Record<string, string>): Row[] {
    return [
        ['toggleOptions', key(m, 'toggleOptions', 'o'), 'kbd.row.toggleOptions.name', 'kbd.row.toggleOptions.desc'],
        ['toggleFilters', key(m, 'toggleFilters', 'f'), 'kbd.row.toggleFilters.name', 'kbd.row.toggleFilters.desc'],
        ['toggleSignals', key(m, 'toggleSignals', 's'), 'kbd.row.toggleSignals.name', 'kbd.row.toggleSignals.desc'],
        ['toggleBookmarks', key(m, 'toggleBookmarks', 'b'), 'kbd.row.toggleBookmarks.name', 'kbd.row.toggleBookmarks.desc'],
        ['toggleSessions', key(m, 'toggleSessions', 'l'), 'kbd.row.toggleSessions.name', 'kbd.row.toggleSessions.desc'],
        ['toggleCollections', key(m, 'toggleCollections', 'i'), 'kbd.row.toggleCollections.name', 'kbd.row.toggleCollections.desc'],
        ['toggleSqlHistory', key(m, 'toggleSqlHistory', 'q'), 'kbd.row.toggleSqlHistory.name', 'kbd.row.toggleSqlHistory.desc'],
        ['toggleTrash', key(m, 'toggleTrash', 't'), 'kbd.row.toggleTrash.name', 'kbd.row.toggleTrash.desc'],
    ];
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

/** Build one grouped section with a heading and table. `nameKey`/`descKey` are l10n keys. */
function buildSection(title: string, rows: Row[]): string {
    const trs = rows.map(([, k, nameKey, descKey]) =>
        `<tr><td class="key-col"><kbd>${esc(k)}</kbd></td><td class="name-col">${esc(t(nameKey))}</td><td class="desc-col">${esc(t(descKey))}</td></tr>`,
    ).join('\n');
    return `<h2>${esc(title)}</h2>
<table>
<thead><tr><th>${esc(t('kbd.chrome.colKey'))}</th><th>${esc(t('kbd.chrome.colAction'))}</th><th>${esc(t('kbd.chrome.colDescription'))}</th></tr></thead>
<tbody>
${trs}
</tbody>
</table>`;
}

/** Escape HTML special characters for safe interpolation. */
function esc(s: string): string {
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** CSP nonce from a CSPRNG (not Math.random — the nonce gates which scripts run). */
function makeNonce(): string {
    return randomBytes(16).toString('base64');
}

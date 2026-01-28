/**
 * Interactive HTML export with embedded JavaScript.
 * Creates a self-contained, shareable HTML file with:
 * - Search (Ctrl+F, F3/Shift+F3 navigation)
 * - Category filter dropdown
 * - Collapsible stack traces and JSON
 * - Light/Dark theme toggle
 */

import * as vscode from 'vscode';
import { ansiToHtml, escapeHtml } from './ansi';
import { SessionMetadataStore } from './session-metadata';

/** Line data parsed from log file. */
interface ParsedLine {
    readonly text: string;
    readonly html: string;
    readonly category: string;
    readonly isStackFrame: boolean;
}

/**
 * Export a .log file to an interactive .html file.
 * Returns the URI of the generated HTML file.
 */
export async function exportToInteractiveHtml(logUri: vscode.Uri): Promise<vscode.Uri> {
    const raw = await vscode.workspace.fs.readFile(logUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');

    const { headerLines, bodyLines } = splitHeader(lines);
    const headerHtml = headerLines.map(l => escapeHtml(l)).join('\n');

    const store = new SessionMetadataStore();
    const annotations = await store.getAnnotations(logUri);
    const annotationMap = new Map(annotations.map(a => [a.lineIndex, a.text]));

    const parsed = parseLines(bodyLines);
    const categories = extractCategories(parsed);
    const bodyHtml = buildInteractiveBody(parsed, annotationMap);

    const htmlPath = logUri.fsPath.replace(/\.log$/, '.html');
    const htmlUri = vscode.Uri.file(htmlPath);
    const content = buildInteractiveHtmlDocument(headerHtml, bodyHtml, categories);
    await vscode.workspace.fs.writeFile(htmlUri, Buffer.from(content, 'utf-8'));
    return htmlUri;
}

function splitHeader(lines: string[]): { headerLines: string[]; bodyLines: string[] } {
    const divider = lines.findIndex(l => l.startsWith('===================='));
    if (divider < 0) {
        return { headerLines: [], bodyLines: lines };
    }
    return {
        headerLines: lines.slice(0, divider + 1),
        bodyLines: lines.slice(divider + 1),
    };
}

/** Parse lines to extract category and detect stack frames. */
function parseLines(lines: string[]): ParsedLine[] {
    return lines.map(line => {
        const category = extractCategory(line);
        const isStackFrame = /^\s+at\s/.test(line);
        return {
            text: line,
            html: ansiToHtml(line),
            category,
            isStackFrame,
        };
    });
}

/** Extract category from line (e.g., [stdout], [stderr]). */
function extractCategory(line: string): string {
    const match = line.match(/^\[(\w+)\]/);
    return match ? match[1] : 'console';
}

/** Extract unique categories from parsed lines. */
function extractCategories(lines: ParsedLine[]): string[] {
    const cats = new Set<string>();
    for (const line of lines) {
        cats.add(line.category);
    }
    return Array.from(cats).sort();
}

/** Build body HTML with data attributes for interactivity. */
function buildInteractiveBody(lines: ParsedLine[], annotations: Map<number, string>): string {
    const parts: string[] = [];
    let groupId = 0;
    let inStackGroup = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const escapedText = escapeHtml(line.text);
        const cls = line.category === 'stderr' ? 'line cat-stderr' : 'line';

        if (line.isStackFrame) {
            if (!inStackGroup) {
                inStackGroup = true;
                groupId++;
                parts.push(`<div class="stack-header collapsed" data-gid="${groupId}">▶ ${line.html}</div>`);
                parts.push(`<div class="stack-frames" data-gid="${groupId}" style="display:none">`);
            } else {
                parts.push(`<div class="${cls}" data-idx="${i}" data-cat="${line.category}">${line.html}</div>`);
            }
        } else {
            if (inStackGroup) {
                parts.push('</div>');
                inStackGroup = false;
            }
            const jsonHtml = wrapJsonInLine(line.html);
            parts.push(`<div class="${cls}" data-idx="${i}" data-cat="${line.category}">${jsonHtml}</div>`);
        }

        const ann = annotations.get(i);
        if (ann) {
            parts.push(`<div class="annotation">[Note: ${escapeHtml(ann)}]</div>`);
        }
    }

    if (inStackGroup) {
        parts.push('</div>');
    }

    return parts.join('\n');
}

/** Wrap potential JSON in collapsible elements. */
function wrapJsonInLine(html: string): string {
    const jsonMatch = detectJsonInHtml(html);
    if (!jsonMatch) {
        return html;
    }

    const { prefix, json, suffix, pretty } = jsonMatch;
    const preview = json.length > 60 ? json.slice(0, 57) + '...' : json;

    return `${prefix}<span class="json-collapsible"><span class="json-toggle">▶</span><span class="json-preview">${escapeHtml(preview)}</span><pre class="json-expanded hidden">${escapeHtml(pretty)}</pre></span>${suffix}`;
}

/** Detect JSON in HTML string. */
function detectJsonInHtml(html: string): { prefix: string; json: string; suffix: string; pretty: string } | null {
    const text = html.replace(/<[^>]*>/g, '');
    const candidates: { start: number; closer: string }[] = [];

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            candidates.push({ start: i, closer: '}' });
        } else if (text[i] === '[') {
            candidates.push({ start: i, closer: ']' });
        }
    }

    for (const { start, closer } of candidates) {
        const end = findMatchingBracket(text, start, closer);
        if (end < 0) {
            continue;
        }

        const jsonStr = text.slice(start, end + 1);
        try {
            const parsed = JSON.parse(jsonStr);
            if (typeof parsed !== 'object' || parsed === null) {
                continue;
            }
            return {
                prefix: text.slice(0, start),
                json: jsonStr,
                suffix: text.slice(end + 1),
                pretty: JSON.stringify(parsed, null, 2),
            };
        } catch {
            // Not valid JSON
        }
    }
    return null;
}

function findMatchingBracket(str: string, start: number, closer: string): number {
    const opener = str[start];
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\') {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) {
            continue;
        }
        if (ch === opener) {
            depth++;
        } else if (ch === closer) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

function buildInteractiveHtmlDocument(headerHtml: string, bodyHtml: string, categories: string[]): string {
    const catOptions = categories.map(c => `<option value="${c}" selected>${c}</option>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Saropa Log Capture</title>
<style>
${getInteractiveStyles()}
</style>
</head>
<body class="dark-theme">
<div id="toolbar">
    <button id="theme-toggle" title="Toggle theme">☀️</button>
    <div id="search-bar" style="display:none">
        <input id="search-input" type="text" placeholder="Search..." />
        <span id="match-count"></span>
        <button id="search-prev" title="Previous (Shift+F3)">◀</button>
        <button id="search-next" title="Next (F3)">▶</button>
        <button id="search-close" title="Close (Esc)">✕</button>
    </div>
    <select id="filter-select" multiple title="Filter by category">
        ${catOptions}
    </select>
    <button id="wrap-toggle">Wrap</button>
    <span id="stats"></span>
</div>
<details open id="header-section">
    <summary>Session Context</summary>
    <div class="header-block"><pre>${headerHtml}</pre></div>
</details>
<div id="log-content">
${bodyHtml}
</div>
<div id="footer">
    <span id="footer-text">Interactive Log Viewer</span>
    <span id="hidden-count"></span>
</div>
<script>
${getInteractiveScript()}
</script>
</body>
</html>`;
}

function getInteractiveStyles(): string {
    return `
:root {
    --bg: #1e1e1e;
    --fg: #d4d4d4;
    --bg-hover: rgba(255,255,255,0.05);
    --border: #3c3c3c;
    --accent: #569cd6;
    --error: #f44;
    --warn: #fc0;
    --muted: #858585;
    --selection: rgba(38, 79, 120, 0.5);
    --search-highlight: rgba(234, 92, 0, 0.33);
    --search-current: rgba(255, 150, 50, 0.6);
    --header-bg: #252526;
}
.light-theme {
    --bg: #ffffff;
    --fg: #333333;
    --bg-hover: rgba(0,0,0,0.05);
    --border: #e0e0e0;
    --accent: #0066cc;
    --error: #d32f2f;
    --warn: #f57c00;
    --muted: #666666;
    --selection: rgba(173, 214, 255, 0.5);
    --search-highlight: rgba(255, 235, 59, 0.5);
    --search-current: rgba(255, 193, 7, 0.8);
    --header-bg: #f5f5f5;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--bg);
    color: var(--fg);
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}
#toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 4px 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
#toolbar button, #filter-select {
    background: var(--header-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
}
#toolbar button:hover { background: var(--bg-hover); }
#search-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    max-width: 400px;
}
#search-input {
    flex: 1;
    background: var(--header-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    padding: 4px 8px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    border-radius: 4px;
}
#search-input:focus { border-color: var(--accent); }
#match-count { font-size: 11px; color: var(--muted); white-space: nowrap; }
#search-bar button { padding: 4px 6px; }
#filter-select { max-width: 150px; height: 26px; }
#stats { margin-left: auto; font-size: 11px; color: var(--muted); }
#header-section { margin: 0 8px; }
#header-section summary {
    cursor: pointer;
    color: var(--accent);
    font-weight: bold;
    padding: 8px 0;
}
.header-block {
    background: var(--header-bg);
    border: 1px solid var(--border);
    padding: 8px 12px;
    border-radius: 4px;
    color: var(--muted);
    margin-bottom: 8px;
}
.header-block pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
#log-content {
    flex: 1;
    padding: 4px 0;
}
#log-content.nowrap { overflow-x: auto; }
#log-content.nowrap .line { white-space: pre; word-break: normal; }
.line {
    white-space: pre-wrap;
    word-break: break-all;
    padding: 0 8px;
}
.line:hover { background: var(--bg-hover); }
.line.cat-stderr { color: var(--error); }
.line.hidden { display: none; }
.line.search-match { background: var(--search-highlight); }
.line.current-match { background: var(--search-current); }
mark { background: var(--search-highlight); color: inherit; border-radius: 2px; }
.current-match mark { background: var(--search-current); }
.stack-header {
    padding: 0 8px;
    cursor: pointer;
    color: var(--error);
    user-select: none;
}
.stack-header:hover { background: var(--bg-hover); }
.stack-frames .line { padding-left: 20px; color: var(--muted); }
.annotation {
    padding: 1px 8px 1px 24px;
    font-size: 11px;
    font-style: italic;
    color: var(--muted);
    background: var(--bg-hover);
}
.json-collapsible { display: inline; }
.json-toggle {
    cursor: pointer;
    color: var(--accent);
    font-family: sans-serif;
    font-size: 10px;
    padding: 0 4px;
    user-select: none;
}
.json-toggle:hover { opacity: 0.8; }
.json-preview { color: var(--muted); font-size: 0.95em; }
.json-expanded {
    display: block;
    margin: 4px 0 4px 16px;
    padding: 4px 8px;
    background: var(--header-bg);
    border-left: 2px solid var(--accent);
    font-size: 0.95em;
    line-height: 1.4;
    white-space: pre;
    overflow-x: auto;
}
.json-expanded.hidden { display: none; }
.json-preview.hidden { display: none; }
#footer {
    position: sticky;
    bottom: 0;
    background: var(--bg);
    border-top: 1px solid var(--border);
    padding: 4px 8px;
    font-size: 11px;
    color: var(--muted);
    display: flex;
    gap: 8px;
}
/* ANSI colors */
.ansi-black { color: #000; } .ansi-red { color: #cd3131; }
.ansi-green { color: #0dbc79; } .ansi-yellow { color: #e5e510; }
.ansi-blue { color: #2472c8; } .ansi-magenta { color: #bc3fbc; }
.ansi-cyan { color: #11a8cd; } .ansi-white { color: #e5e5e5; }
.ansi-bright-black { color: #666; } .ansi-bright-red { color: #f14c4c; }
.ansi-bright-green { color: #23d18b; } .ansi-bright-yellow { color: #f5f543; }
.ansi-bright-blue { color: #3b8eea; } .ansi-bright-magenta { color: #d670d6; }
.ansi-bright-cyan { color: #29b8db; } .ansi-bright-white { color: #fff; }
.ansi-bold { font-weight: bold; } .ansi-dim { opacity: 0.7; }
.ansi-italic { font-style: italic; } .ansi-underline { text-decoration: underline; }
`;
}

function getInteractiveScript(): string {
    return `
(function() {
    var logContent = document.getElementById('log-content');
    var searchBar = document.getElementById('search-bar');
    var searchInput = document.getElementById('search-input');
    var matchCount = document.getElementById('match-count');
    var filterSelect = document.getElementById('filter-select');
    var wrapToggle = document.getElementById('wrap-toggle');
    var themeToggle = document.getElementById('theme-toggle');
    var footerText = document.getElementById('footer-text');
    var hiddenCount = document.getElementById('hidden-count');
    var statsEl = document.getElementById('stats');

    var searchOpen = false;
    var searchRegex = null;
    var matchElements = [];
    var currentMatchIdx = -1;
    var wordWrap = true;

    // Count total lines
    var allLines = document.querySelectorAll('.line');
    statsEl.textContent = allLines.length + ' lines';

    // Theme toggle
    themeToggle.addEventListener('click', function() {
        var body = document.body;
        if (body.classList.contains('dark-theme')) {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            themeToggle.textContent = '🌙';
        } else {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
            themeToggle.textContent = '☀️';
        }
    });

    // Word wrap toggle
    wrapToggle.addEventListener('click', function() {
        wordWrap = !wordWrap;
        logContent.classList.toggle('nowrap', !wordWrap);
        wrapToggle.textContent = wordWrap ? 'No Wrap' : 'Wrap';
    });

    // Category filter
    filterSelect.addEventListener('change', function() {
        var selected = [];
        for (var i = 0; i < filterSelect.options.length; i++) {
            if (filterSelect.options[i].selected) {
                selected.push(filterSelect.options[i].value);
            }
        }
        var hidden = 0;
        for (var i = 0; i < allLines.length; i++) {
            var cat = allLines[i].dataset.cat || 'console';
            var isHidden = selected.indexOf(cat) === -1;
            allLines[i].classList.toggle('hidden', isHidden);
            if (isHidden) hidden++;
        }
        hiddenCount.textContent = hidden > 0 ? hidden + ' hidden' : '';
    });

    // Search
    function openSearch() {
        searchOpen = true;
        searchBar.style.display = 'flex';
        searchInput.focus();
    }

    function closeSearch() {
        searchOpen = false;
        searchBar.style.display = 'none';
        clearSearchHighlights();
    }

    function clearSearchHighlights() {
        for (var i = 0; i < matchElements.length; i++) {
            matchElements[i].classList.remove('search-match', 'current-match');
        }
        matchElements = [];
        currentMatchIdx = -1;
        matchCount.textContent = '';
        // Remove mark tags
        var marks = logContent.querySelectorAll('mark');
        for (var i = 0; i < marks.length; i++) {
            var parent = marks[i].parentNode;
            parent.replaceChild(document.createTextNode(marks[i].textContent), marks[i]);
            parent.normalize();
        }
    }

    function updateSearch() {
        clearSearchHighlights();
        var query = searchInput.value;
        if (!query) return;

        try {
            searchRegex = new RegExp(query.replace(/[-\\\\/^$*+?.()|[\\]{}]/g, '\\\\$&'), 'gi');
        } catch (e) {
            return;
        }

        for (var i = 0; i < allLines.length; i++) {
            var line = allLines[i];
            if (line.classList.contains('hidden')) continue;

            var text = line.textContent;
            searchRegex.lastIndex = 0;
            if (searchRegex.test(text)) {
                matchElements.push(line);
                line.classList.add('search-match');
                // Highlight matches within
                highlightMatches(line, searchRegex);
            }
        }

        if (matchElements.length > 0) {
            currentMatchIdx = 0;
            matchElements[0].classList.add('current-match');
            matchElements[0].scrollIntoView({ block: 'center' });
        }
        updateMatchCount();
    }

    function highlightMatches(el, regex) {
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var nodesToReplace = [];
        while (walker.nextNode()) {
            var node = walker.currentNode;
            regex.lastIndex = 0;
            if (regex.test(node.textContent)) {
                nodesToReplace.push(node);
            }
        }
        for (var i = 0; i < nodesToReplace.length; i++) {
            var node = nodesToReplace[i];
            var span = document.createElement('span');
            regex.lastIndex = 0;
            span.innerHTML = node.textContent.replace(regex, '<mark>$&</mark>');
            node.parentNode.replaceChild(span, node);
        }
    }

    function updateMatchCount() {
        if (matchElements.length === 0) {
            matchCount.textContent = searchInput.value ? 'No matches' : '';
        } else {
            matchCount.textContent = (currentMatchIdx + 1) + '/' + matchElements.length;
        }
    }

    function searchNext() {
        if (matchElements.length === 0) return;
        matchElements[currentMatchIdx].classList.remove('current-match');
        currentMatchIdx = (currentMatchIdx + 1) % matchElements.length;
        matchElements[currentMatchIdx].classList.add('current-match');
        matchElements[currentMatchIdx].scrollIntoView({ block: 'center' });
        updateMatchCount();
    }

    function searchPrev() {
        if (matchElements.length === 0) return;
        matchElements[currentMatchIdx].classList.remove('current-match');
        currentMatchIdx = (currentMatchIdx - 1 + matchElements.length) % matchElements.length;
        matchElements[currentMatchIdx].classList.add('current-match');
        matchElements[currentMatchIdx].scrollIntoView({ block: 'center' });
        updateMatchCount();
    }

    searchInput.addEventListener('input', updateSearch);
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.shiftKey ? searchPrev() : searchNext();
            e.preventDefault();
        }
        if (e.key === 'Escape') {
            closeSearch();
            e.preventDefault();
        }
    });

    document.getElementById('search-next').addEventListener('click', searchNext);
    document.getElementById('search-prev').addEventListener('click', searchPrev);
    document.getElementById('search-close').addEventListener('click', closeSearch);

    // Stack trace collapse/expand
    document.querySelectorAll('.stack-header').forEach(function(header) {
        header.addEventListener('click', function() {
            var gid = header.dataset.gid;
            var frames = document.querySelector('.stack-frames[data-gid=\"' + gid + '\"]');
            if (!frames) return;

            var collapsed = header.classList.toggle('collapsed');
            frames.style.display = collapsed ? 'none' : 'block';
            header.textContent = (collapsed ? '▶' : '▼') + header.textContent.slice(1);
        });
    });

    // JSON collapse/expand
    document.querySelectorAll('.json-toggle').forEach(function(toggle) {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            var container = toggle.closest('.json-collapsible');
            if (!container) return;

            var preview = container.querySelector('.json-preview');
            var expanded = container.querySelector('.json-expanded');
            var isCollapsed = toggle.textContent === '▶';

            toggle.textContent = isCollapsed ? '▼' : '▶';
            preview.classList.toggle('hidden', !isCollapsed);
            expanded.classList.toggle('hidden', isCollapsed);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F3') {
            e.preventDefault();
            if (!searchOpen) openSearch();
            else e.shiftKey ? searchPrev() : searchNext();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            openSearch();
            return;
        }
        if (e.key === 'Escape' && searchOpen) {
            closeSearch();
        }
    });

    footerText.textContent = 'Generated by Saropa Log Capture';
})();
`;
}

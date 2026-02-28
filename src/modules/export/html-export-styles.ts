/**
 * CSS styles for the interactive HTML export.
 *
 * Generates a complete stylesheet with dark/light theme support,
 * toolbar, search bar, log content, stack traces, JSON collapsible
 * blocks, and ANSI color classes. All styles use CSS custom properties
 * for theming.
 */

/** Generate the CSS stylesheet for the interactive HTML export. */
export function getInteractiveStyles(): string {
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

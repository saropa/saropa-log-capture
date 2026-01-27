/** Maximum lines retained in the viewer DOM (file on disk keeps all). */
export const MAX_VIEWER_LINES = 5000;

/** Generate a random nonce for Content Security Policy. */
export function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/** CSS styles for the log viewer webview. */
export function getViewerStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    overflow-y: auto;
    height: 100vh;
    display: flex;
    flex-direction: column;
}
#log-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}
.line {
    white-space: pre-wrap;
    word-break: break-all;
    padding: 0 8px;
    line-height: 1.5;
}
.line:hover { background: var(--vscode-list-hoverBackground); }
.line.cat-stderr {
    color: var(--vscode-debugConsole-errorForeground, #f44);
}
#log-content.nowrap {
    overflow-x: auto;
}
#log-content.nowrap .line,
#log-content.nowrap .stack-header,
#log-content.nowrap .stack-frames .line {
    white-space: pre;
    word-break: normal;
}
.marker {
    border-top: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    border-bottom: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    background: var(--vscode-diffEditor-insertedLineBackground, rgba(40, 167, 69, 0.1));
    color: var(--vscode-editorGutter-addedBackground, #28a745);
    padding: 4px 8px;
    text-align: center;
    font-style: italic;
    line-height: 1.5;
}
.stack-group { margin: 0; }
.stack-header {
    padding: 0 8px;
    cursor: pointer;
    color: var(--vscode-errorForeground, #f44);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    user-select: none;
}
.stack-header:hover { background: var(--vscode-list-hoverBackground); }
.stack-group.collapsed .stack-frames { display: none; }
.stack-frames .line {
    padding-left: 20px;
    color: var(--vscode-descriptionForeground);
}
#jump-btn {
    display: none;
    position: fixed;
    bottom: 32px;
    right: 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10;
}
#jump-btn:hover { background: var(--vscode-button-hoverBackground); }
#footer {
    position: sticky;
    bottom: 0;
    background: var(--vscode-sideBar-background);
    border-top: 1px solid var(--vscode-panel-border);
    padding: 4px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
}
#footer.paused {
    color: var(--vscode-statusBarItem-warningForeground, #fc0);
    background: var(--vscode-statusBarItem-warningBackground, rgba(252, 192, 0, 0.15));
}
#wrap-toggle {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
    margin-left: auto;
}
#wrap-toggle:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
`;
}

/** Client-side JavaScript for the log viewer webview. */
export function getViewerScript(): string {
    return /* javascript */ `
const logEl = document.getElementById('log-content');
const jumpBtn = document.getElementById('jump-btn');
const footerEl = document.getElementById('footer');
const footerTextEl = document.getElementById('footer-text');
const wrapToggle = document.getElementById('wrap-toggle');
const MAX_LINES = ${MAX_VIEWER_LINES};
let autoScroll = true;
let lineCount = 0;
let isPaused = false;
let wordWrap = true;
let currentStackGroup = null;

wrapToggle.addEventListener('click', function() {
    wordWrap = !wordWrap;
    logEl.classList.toggle('nowrap', !wordWrap);
    wrapToggle.textContent = wordWrap ? 'No Wrap' : 'Wrap';
});

logEl.addEventListener('scroll', () => {
    const atBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 30;
    autoScroll = atBottom;
    jumpBtn.style.display = atBottom ? 'none' : 'block';
});

function jumpToBottom() {
    logEl.scrollTop = logEl.scrollHeight;
    autoScroll = true;
    jumpBtn.style.display = 'none';
}

function isStackFrame(text) {
    return /^\\s+at\\s/.test(text);
}

function updateFooterText() {
    footerTextEl.textContent = isPaused
        ? 'PAUSED \\u2014 ' + lineCount + ' lines'
        : 'Recording: ' + lineCount + ' lines';
}

function trimOldLines() {
    while (logEl.children.length > MAX_LINES) {
        logEl.removeChild(logEl.firstChild);
    }
}

function createStackGroup(firstText) {
    const group = document.createElement('div');
    group.className = 'stack-group collapsed';
    const header = document.createElement('div');
    header.className = 'stack-header';
    header.textContent = '\\u25b6 ' + firstText.trim();
    header.onclick = function() { toggleStack(group); };
    group.appendChild(header);
    const frames = document.createElement('div');
    frames.className = 'stack-frames';
    group.appendChild(frames);
    return group;
}

function toggleStack(group) {
    const collapsed = group.classList.toggle('collapsed');
    const header = group.querySelector('.stack-header');
    header.textContent = (collapsed ? '\\u25b6' : '\\u25bc') + header.textContent.substring(1);
}

function addStackFrame(group, text) {
    const frames = group.querySelector('.stack-frames');
    const el = document.createElement('div');
    el.className = 'line stack-line';
    el.textContent = text;
    frames.appendChild(el);
    const count = frames.children.length;
    const firstLine = frames.firstChild.textContent.trim();
    const arrow = group.classList.contains('collapsed') ? '\\u25b6' : '\\u25bc';
    const suffix = count > 1 ? '  [+' + (count - 1) + ' frames]' : '';
    group.querySelector('.stack-header').textContent = arrow + ' ' + firstLine + suffix;
}

function addLine(text, isMarker, category) {
    const isStack = !isMarker && isStackFrame(text);
    if (isStack) {
        if (!currentStackGroup || !currentStackGroup.parentNode) {
            currentStackGroup = createStackGroup(text);
            logEl.appendChild(currentStackGroup);
        }
        addStackFrame(currentStackGroup, text);
    } else {
        currentStackGroup = null;
        const el = document.createElement('div');
        el.className = isMarker ? 'marker' : 'line';
        if (category === 'stderr') { el.classList.add('cat-stderr'); }
        el.textContent = text;
        logEl.appendChild(el);
    }
}

window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
        case 'addLines':
            for (const line of msg.lines) { addLine(line.text, line.isMarker, line.category); }
            trimOldLines();
            if (msg.lineCount !== undefined) { lineCount = msg.lineCount; }
            if (autoScroll) { logEl.scrollTop = logEl.scrollHeight; }
            updateFooterText();
            break;
        case 'clear':
            logEl.innerHTML = '';
            lineCount = 0;
            currentStackGroup = null;
            isPaused = false;
            footerEl.classList.remove('paused');
            footerTextEl.textContent = 'Cleared';
            break;
        case 'updateFooter':
            footerTextEl.textContent = msg.text;
            break;
        case 'setPaused':
            isPaused = msg.paused;
            footerEl.classList.toggle('paused', isPaused);
            updateFooterText();
            break;
    }
});
`;
}

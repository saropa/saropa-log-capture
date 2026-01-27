/**
 * Client-side JavaScript for the log viewer webview.
 * Handles message reception, DOM rendering, auto-scroll,
 * stack trace collapsing, and word wrap toggle.
 *
 * @param maxLines - Maximum lines retained in the viewer DOM.
 */
export function getViewerScript(maxLines: number): string {
    return /* javascript */ `
const logEl = document.getElementById('log-content');
const jumpBtn = document.getElementById('jump-btn');
const footerEl = document.getElementById('footer');
const footerTextEl = document.getElementById('footer-text');
const wrapToggle = document.getElementById('wrap-toggle');
const MAX_LINES = ${maxLines};
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

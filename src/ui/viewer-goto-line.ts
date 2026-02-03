/** Inline Go to Line overlay: Ctrl+G opens, numbers-only, instant scroll. */

/** Returns the HTML for the Go to Line input overlay. */
export function getGotoLineHtml(): string {
    return /* html */ `<div id="goto-line-overlay" class="goto-line-overlay">
    <label for="goto-line-input" class="goto-line-label">Go to Line</label>
    <input id="goto-line-input" type="text" inputmode="numeric"
           placeholder="Line number" autocomplete="off" />
</div>`;
}

/** Returns the CSS for the Go to Line overlay. */
export function getGotoLineStyles(): string {
    return /* css */ `
/* --- Go to Line overlay --- */
@keyframes goto-slide-down {
    from { opacity: 0; transform: translateX(-50%) translateY(-100%); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.goto-line-overlay {
    display: none;
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 300;
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, var(--vscode-panel-border)));
    border-top: none;
    border-radius: 0 0 6px 6px;
    padding: 6px 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    gap: 8px;
    align-items: center;
}
.goto-line-overlay.visible {
    display: flex;
    animation: goto-slide-down 0.15s ease-out;
}
.goto-line-label {
    font-size: 12px;
    color: var(--vscode-foreground);
    white-space: nowrap;
}
#goto-line-input {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    padding: 3px 6px;
    font-size: 12px;
    width: 120px;
    outline: none;
    border-radius: 2px;
}
#goto-line-input:focus { border-color: var(--vscode-focusBorder); }
`;
}

/** Returns the JavaScript for the Go to Line logic. */
export function getGotoLineScript(): string {
    return /* javascript */ `
var gotoOverlay = document.getElementById('goto-line-overlay');
var gotoInput = document.getElementById('goto-line-input');
var gotoSavedScroll = -1;

function openGotoLine() {
    if (!gotoOverlay || !gotoInput) return;
    gotoSavedScroll = logEl.scrollTop;
    gotoInput.value = '';
    gotoInput.placeholder = '1 \\u2013 ' + allLines.length;
    gotoOverlay.classList.add('visible');
    gotoInput.focus();
}

function closeGotoLine(revert) {
    if (!gotoOverlay) return;
    gotoOverlay.classList.remove('visible');
    if (revert && gotoSavedScroll >= 0) {
        suppressScroll = true;
        logEl.scrollTop = gotoSavedScroll;
        suppressScroll = false;
        renderViewport(false);
    }
    gotoSavedScroll = -1;
}

function scrollToLineNumber(num) {
    if (num < 1 || allLines.length === 0) return;
    var target = Math.min(num, allLines.length) - 1;
    var offset = 0;
    for (var i = 0; i < target; i++) offset += allLines[i].height;
    suppressScroll = true;
    logEl.scrollTop = offset;
    suppressScroll = false;
    autoScroll = false;
    jumpBtn.style.display = 'block';
    renderViewport(false);
}

if (gotoInput) {
    gotoInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        var num = parseInt(this.value, 10);
        if (!isNaN(num) && num > 0) scrollToLineNumber(num);
    });
    gotoInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); closeGotoLine(false); }
        if (e.key === 'Escape') { e.preventDefault(); closeGotoLine(true); }
    });
    gotoInput.addEventListener('blur', function() { closeGotoLine(false); });
}
`;
}

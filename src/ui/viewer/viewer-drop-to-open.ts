/**
 * Webview drag-and-drop: load a log file dropped from the OS straight into the viewer.
 *
 * VS Code webviews run as sandboxed iframes, so an OS file drop usually does NOT expose a
 * usable filesystem path (`File.path` is empty under the sandbox). Two cases are handled:
 *   1. A path IS available (some hosts/electron builds populate it) → post it so the host
 *      loads the file by URI through the normal pipeline (handles any size).
 *   2. No path → read the file text in the page (capped) and post the content; the host
 *      writes it to a temp file and loads that. Files above the cap can't be streamed this
 *      way, so the user is told to use "Open log file…" instead of silently truncating.
 *
 * Runs inside the main viewer IIFE; uses the shared `vscodeApi` postMessage handle.
 */

/** Max bytes to ferry through the webview message channel when no OS path is available.
 *  Above this, content transfer would bloat the message and risk the host's string limits;
 *  the picker path (Open log file…) reads from disk and has no such ceiling. */
const droppedContentMaxBytes = 50 * 1024 * 1024;

export function getDropToOpenScript(): string {
    return /* javascript */ `
    (function () {
        if (typeof document === 'undefined') return;
        var MAX_BYTES = ${droppedContentMaxBytes};
        var overlay = null;

        /* Lazily build the drop hint overlay. Inline styles (not a CSS class) avoid a
           separate stylesheet module and any style-CSP nonce concerns. */
        function ensureOverlay() {
            if (overlay) return overlay;
            overlay = document.createElement('div');
            overlay.setAttribute('aria-hidden', 'true');
            var s = overlay.style;
            s.position = 'fixed'; s.inset = '0'; s.display = 'none'; s.zIndex = '99999';
            s.alignItems = 'center'; s.justifyContent = 'center';
            s.font = '600 14px var(--vscode-font-family, sans-serif)';
            s.color = 'var(--vscode-foreground)';
            s.background = 'color-mix(in srgb, var(--vscode-editor-background) 75%, transparent)';
            s.border = '2px dashed var(--vscode-focusBorder)';
            s.pointerEvents = 'none';
            overlay.textContent = ${JSON.stringify('Drop a log file to open it')};
            document.body.appendChild(overlay);
            return overlay;
        }
        function showOverlay(on) { ensureOverlay().style.display = on ? 'flex' : 'none'; }

        /* Only react to drags that actually carry files; ignore in-page text/element drags
           (those belong to drag-select and SQL collection drag handlers). */
        function hasFiles(e) {
            var dt = e.dataTransfer; if (!dt) return false;
            var types = dt.types || [];
            for (var i = 0; i < types.length; i++) { if (types[i] === 'Files') return true; }
            return false;
        }

        document.addEventListener('dragover', function (e) {
            if (!hasFiles(e)) return;
            e.preventDefault(); e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            showOverlay(true);
        });
        document.addEventListener('dragleave', function (e) {
            /* relatedTarget null = the cursor left the window entirely. */
            if (!e.relatedTarget) showOverlay(false);
        });
        document.addEventListener('drop', function (e) {
            if (!hasFiles(e)) return;
            e.preventDefault(); e.stopPropagation();
            showOverlay(false);
            var files = e.dataTransfer.files;
            if (!files || files.length === 0) return;
            loadDroppedFile(files[0]);
        });

        function loadDroppedFile(file) {
            /* Prefer the OS path when the host exposes it — no content transfer, any size. */
            var path = file.path || '';
            if (path) { vscodeApi.postMessage({ type: 'openDroppedLog', path: path }); return; }
            if (file.size > MAX_BYTES) {
                vscodeApi.postMessage({ type: 'openDroppedLog', name: file.name, tooLarge: true });
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                vscodeApi.postMessage({ type: 'openDroppedLog', name: file.name, content: String(reader.result || '') });
            };
            reader.onerror = function () {
                vscodeApi.postMessage({ type: 'openDroppedLog', name: file.name, error: true });
            };
            reader.readAsText(file);
        }
    })();
    `;
}

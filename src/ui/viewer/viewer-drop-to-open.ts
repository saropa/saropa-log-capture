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

        /* True only for an in-page drag that carries its OWN mime types (drag-select, SQL/collection
           drags). An OS file drag, by contrast, usually exposes NO types during dragover (the browser
           hides file data until drop for security) — so an empty type list means "let it through".
           Gating dragover on a positive 'Files' check (attempts 1 & 2) is exactly why the drop never
           fired: types was empty during dragover, so preventDefault never ran and Chromium suppressed
           the drop. */
        function isInPageTypedDrag(e) {
            var dt = e.dataTransfer; if (!dt) return false;
            var types = dt.types || [];
            if (types.length === 0) return false;            // OS file drag with hidden types — allow
            for (var i = 0; i < types.length; i++) { if (types[i] === 'Files') return false; }
            return true;                                     // has types, none are Files — internal drag
        }

        /* Capture phase on window so our preventDefault runs before the workbench's own handlers.
           dragenter AND dragover must both preventDefault or Chromium never fires drop. */
        function allowDrag(e) {
            if (isInPageTypedDrag(e)) return;
            e.preventDefault(); e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            showOverlay(true);
        }
        window.addEventListener('dragenter', allowDrag, true);
        window.addEventListener('dragover', allowDrag, true);
        window.addEventListener('dragleave', function (e) {
            /* relatedTarget null = the cursor left the window entirely. */
            if (!e.relatedTarget) showOverlay(false);
        }, true);
        window.addEventListener('drop', function (e) {
            if (isInPageTypedDrag(e)) return;
            e.preventDefault(); e.stopPropagation();
            showOverlay(false);
            handleDrop(e.dataTransfer);
        }, true);

        /* A dropped OS file can arrive three ways in a webview; try each. VS Code commonly hands the
           file over as a file:// URI in text/uri-list (neither earlier attempt read that), not as a
           File in files[]. */
        function handleDrop(dt) {
            if (!dt) { vscodeApi.postMessage({ type: 'openDroppedLog', empty: true }); return; }
            var uriList = '';
            try { uriList = dt.getData('text/uri-list') || dt.getData('text/plain') || ''; } catch (e) { uriList = ''; }
            /* A local file (dragged from the file manager) comes as file://; a web link (dragged from a
               browser tab/address bar) comes as http(s):// — route the latter to the URL download path. */
            var fileUri = firstUriOfScheme(uriList, 'file:');
            if (fileUri) { vscodeApi.postMessage({ type: 'openDroppedLog', uri: fileUri }); return; }
            var webUri = firstUriOfScheme(uriList, 'http');
            if (webUri) { vscodeApi.postMessage({ type: 'openDroppedLog', url: webUri }); return; }
            var file = (dt.files && dt.files[0]) || itemAsFile(dt);
            if (file) { loadDroppedFile(file); return; }
            /* Drop reached us but exposed neither a URI nor a File — guide the user to the picker. */
            vscodeApi.postMessage({ type: 'openDroppedLog', empty: true });
        }

        /* First line of a text/uri-list payload whose scheme matches the prefix (comment lines start
           with '#'). 'http' matches both http: and https:. */
        function firstUriOfScheme(text, prefix) {
            if (!text) return '';
            var lines = text.split(/[\\r\\n]+/);
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line && line.charAt(0) !== '#' && line.indexOf(prefix) === 0) return line;
            }
            return '';
        }

        /* Pull a File out of DataTransferItemList when files[] is empty (some Electron builds). */
        function itemAsFile(dt) {
            var items = dt.items || [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') { var f = items[i].getAsFile(); if (f) return f; }
            }
            return null;
        }

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

/**
 * Minimap drag-to-resize: left-edge handle for interactive width adjustment.
 * Captures pointer on the resize grip, tracks horizontal delta, and updates
 * mmWidthPx + DOM width continuously. On drag end, posts the final pixel
 * value to the extension for workspace-state persistence.
 */

/** Returns the minimap resize handle interaction script. */
export function getScrollbarMinimapResizeScript(): string {
    return /* javascript */ `

/** Minimum and maximum minimap width in pixels. */
var MM_RESIZE_MIN_PX = 20;
var MM_RESIZE_MAX_PX = 160;

/** Initialize the minimap resize handle drag behavior. */
function initMinimapResize() {
    var handle = document.getElementById('minimap-resize-handle');
    if (!handle || !minimapEl) return;

    handle.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        e.stopPropagation(); /* prevent minimap scroll-drag from firing */
        handle.setPointerCapture(e.pointerId);

        var startX = e.clientX;
        var startW = mmWidthPx;
        var pid = e.pointerId;

        /* Visual feedback: resize cursor on body while dragging */
        document.body.classList.add('mm-resizing');

        function onMove(ev) {
            if (ev.pointerId !== pid) return;
            ev.preventDefault();
            /* Handle is on the left edge, so dragging left = wider, right = narrower */
            var delta = startX - ev.clientX;
            var nextW = Math.round(Math.max(MM_RESIZE_MIN_PX, Math.min(MM_RESIZE_MAX_PX, startW + delta)));
            if (nextW === mmWidthPx) return;
            mmWidthPx = nextW;
            minimapEl.style.width = nextW + 'px';
            syncMmColumnWidth();
            scheduleMinimap();
        }

        function onDone(ev) {
            if (ev && ev.pointerId !== undefined && ev.pointerId !== pid) return;
            document.body.classList.remove('mm-resizing');
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onDone);
            handle.removeEventListener('pointercancel', onDone);
            handle.removeEventListener('lostpointercapture', onDone);
            /* Persist the final width to workspace state via the extension host */
            vscodeApi.postMessage({ type: 'setMinimapCustomPx', value: mmWidthPx });
        }

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onDone);
        handle.addEventListener('pointercancel', onDone);
        handle.addEventListener('lostpointercapture', onDone);
    });
}
`;
}

/**
 * Client-side pixel diff for the signal report's before/after screenshot block
 * (plan 114 follow-up). Runs inside the report webview's shell script: the extension
 * host has no image decoder, but the webview has Canvas — both frames are drawn at a
 * matched size, per-pixel channel deltas are computed, and changes are painted as a
 * magenta heat overlay on top of the "at error" frame.
 *
 * Injected into the shell <script> tag by signal-report-render.ts; the shell calls
 * computeScreenshotDiffs() after the screenshots section lands (and after a state
 * restore recreates it). Data-URI images are same-origin, so getImageData never taints.
 */
export function getSignalReportDiffScript(): string {
    return /* javascript */ `
/** Max diff render width — bounds the O(w×h) pixel loop on full-resolution captures. */
var DIFF_MAX_W = 480;
/** Per-pixel |dR|+|dG|+|dB| below this is noise (AA, gradients), not a change. */
var DIFF_THRESHOLD = 45;

/** Diff every un-processed .screenshot-diff block currently in the DOM. */
function computeScreenshotDiffs() {
    var blocks = document.querySelectorAll('.screenshot-diff:not([data-diff-done])');
    for (var i = 0; i < blocks.length; i++) { diffOneBlock(blocks[i]); }
}

function diffOneBlock(block) {
    block.setAttribute('data-diff-done', '1');
    var before = block.querySelector('img.diff-before');
    var after = block.querySelector('img.diff-after');
    var canvas = block.querySelector('canvas.diff-canvas');
    if (!before || !after || !canvas) { return; }
    var pending = 0;
    var run = function() { if (pending === 0) { try { drawDiff(before, after, canvas); } catch (e) { /* canvas failure leaves the two plain frames — still useful */ } } };
    // Data-URI images usually decode synchronously-ish, but wait when they haven't.
    [before, after].forEach(function(img) {
        if (!img.complete || img.naturalWidth === 0) {
            pending++;
            img.addEventListener('load', function() { pending--; run(); }, { once: true });
            img.addEventListener('error', function() { block.removeAttribute('data-diff-done'); }, { once: true });
        }
    });
    run();
}

/** Draw the after frame with a magenta heat overlay where it differs from before. */
function drawDiff(beforeImg, afterImg, canvas) {
    var w = Math.min(afterImg.naturalWidth, DIFF_MAX_W);
    var scale = w / afterImg.naturalWidth;
    var h = Math.max(1, Math.round(afterImg.naturalHeight * scale));
    // Both frames stretch into the SAME w×h box: an orientation/resize between captures
    // still produces a comparable (if coarser) heat map instead of an exception.
    var beforeData = rasterize(beforeImg, w, h).getImageData(0, 0, w, h);
    var out = rasterize(afterImg, w, h).getImageData(0, 0, w, h);
    var a = out.data, b = beforeData.data;
    for (var p = 0; p < a.length; p += 4) {
        var delta = Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]);
        if (delta <= DIFF_THRESHOLD) continue;
        // Blend toward magenta, strength scaled by delta (caps at full replacement).
        var k = Math.min(1, delta / 300);
        a[p] = Math.round(a[p] * (1 - k) + 255 * k);
        a[p + 1] = Math.round(a[p + 1] * (1 - k));
        a[p + 2] = Math.round(a[p + 2] * (1 - k) + 255 * k);
    }
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').putImageData(out, 0, 0);
}

/** Draw an image into an offscreen canvas at w×h; returns the 2d context for getImageData. */
function rasterize(img, w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return ctx;
}
`;
}

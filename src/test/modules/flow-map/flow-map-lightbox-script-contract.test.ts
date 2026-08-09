import * as assert from 'assert';
import { flowMapLightboxScript } from '../../../ui/panels/flow-map-panel-lightbox-script';

// The overlay's runtime behavior lives in the webview; what IS checkable from the Extension Host
// is that the generated script carries the wiring an aria-modal dialog is required to have.
// Split out of flow-map-shot-thumbs.test.ts (house 300-line limit) — same file's `script` fixture,
// same suite, just its own module.
suite('FlowMap lightbox script contract', () => {
    const script = flowMapLightboxScript('abc123', {
        title: 'Screenshot', captured: 'Captured', trigger: 'Trigger', screen: 'Screen',
        logLine: 'Log line', close: 'Close', counter: '{0}/{1}', counterScreen: '{0}/{1} here',
        file: 'File', copyPath: 'Copy full path', zoom: 'Zoom', zoomHint: 'Scroll to zoom',
        unavailable: 'Screenshot unavailable',
        prev: 'Previous screenshot', next: 'Next screenshot',
        compare: 'Compare', comparePrev: 'Previous', compareNext: 'Next',
        compareSession: 'Other session', compareThisSession: 'This session',
        compareLoading: 'Reading…', compareNoMatch: 'No capture of this screen',
    });

    test('should keep Tab inside the dialog and restore focus to the opener on close', () => {
        assert.ok(script.includes('trapTab'), 'Tab is trapped inside the card');
        assert.ok(/opener\s*=\s*el/.test(script), 'the clicked thumbnail is remembered');
        assert.ok(script.includes('opener.focus()'), 'focus returns to it on close');
    });

    test('should never build overlay content with innerHTML', () => {
        // Screen labels and triggers come from log text — markup interpolation would let a log
        // line inject nodes into the panel.
        // Matches an ASSIGNMENT, not the word — the script's own comment names innerHTML to
        // explain why it is avoided, and that mention must not fail the check.
        assert.ok(!/innerHTML\s*=/.test(script), 'facts are rendered with textContent only');
    });

    test('should carry the nonce so the strict CSP admits the script', () => {
        assert.ok(script.startsWith('<script nonce="abc123">'), 'nonce-guarded');
    });

    test('should bind EVERY capture surface with one img selector', () => {
        // The diagram thumbnail is an <img> inside a <foreignObject> now, not an SVG <image> —
        // a stale 'image.fm-shot' selector would silently stop opening the lightbox from a card.
        // .fm-mini-shot covers the timeline strip and the screen-visit rows: a surface left out
        // of this one selector renders a capture that simply does nothing when clicked.
        assert.ok(
            script.includes("'img.shot-img, img.fm-shot, img.fm-mini-shot'"),
            'all three capture surfaces share the binder');
        assert.ok(!script.includes('image.fm-shot'), 'no SVG-image selector left behind');
    });

    test('should copy the full path through its own message, not the summary copier', () => {
        assert.ok(script.includes("'copyShotPath'"), 'dedicated message so the toast names the right thing');
        assert.ok(script.includes('data-shot-path'), 'reads the path off the clicked capture');
    });

    test('should state a load failure instead of leaving a broken-image glyph', () => {
        // A capture present when the report was built can be gone by the time the browser fetches
        // it — the report must say so rather than show a silent browser placeholder.
        assert.ok(/addEventListener\('error'/.test(script), 'both surfaces handle a failed fetch');
        assert.ok(script.includes('fm-shot-missing'), 'and mark the frame as failed');
        assert.ok(script.includes("removeAttribute('role')"), 'a dead thumbnail stops advertising a click');
    });

    test('should offer compare only when the screen has more than one capture', () => {
        assert.ok(script.includes('data-shot-screen-key'), 'compare resolves the set from a screen key');
        assert.ok(script.includes('fm-shot-sets'), 'reading the once-per-document island');
        assert.ok(/set\.length > 1/.test(script), 'a lone capture has nothing to compare against in-session');
    });

    test('should walk compare siblings with a BOUNDED scan, never skip-until-different', () => {
        // Nothing dedups captures by file, so every entry in a screen's set can carry the same
        // src; an unbounded "skip until different" loop would spin forever and hang the panel.
        assert.ok(!/do\s*\{/.test(script), 'no unbounded do/while in the sibling walk');
        assert.ok(/for \(var i = 0; i < n; i\+\+\)/.test(script), 'one lap maximum');
        assert.ok(script.includes('next !== cmpSelf'), 'skips by INDEX, never by src equality');
    });

    test('should state a load failure in a compare pane too, not just on a thumbnail', () => {
        // A broken-image glyph in the one view meant for spotting differences reads as "this
        // screen changed completely" — the exact wrong conclusion.
        const panes = script.split('fms-cmp-img')[1] || '';
        assert.ok(panes.includes("addEventListener('error'"), 'compare panes handle a failed fetch');
    });

    test('should zoom on wheel and by slider, with a reset back to fit', () => {
        assert.ok(script.includes('zoomAttach'), 'zoom is wired when the overlay opens');
        assert.ok(/addEventListener\('wheel'/.test(script), 'scroll-to-zoom');
        assert.ok(script.includes("slider.addEventListener('input'"), 'slider drives the same scale');
        assert.ok(script.includes('zoomReset'), 'and fit is recoverable');
        assert.ok(script.includes('passive: false'), 'wheel can preventDefault, so the page cannot scroll under it');
    });

    test('should lock the stage to a fixed width once the image has loaded', () => {
        // Without a fixed width, .fms-stage/.fms-card have no width besides "however wide the
        // zoomed image's CURRENT pixel width happens to make them" — so every wheel tick both
        // resizes and re-centers the whole dialog instead of scrolling inside a box that stays
        // put, and the anchor-preserving scroll math has nothing stable to scroll within. This
        // is what made the lightbox zoom "still jump around wildly" even after the earlier
        // height-only fit-cap fix.
        assert.ok(script.includes('lockStageWidth'), 'a width-locking step exists');
        assert.ok(
            /img\.addEventListener\('load', function\(\)\{ zoomApply\(\); lockStageWidth\(\); \}\)/.test(script),
            'locked right after the image loads, once fit layout has settled');
    });

    test('should lock to the FIT width, not a fixed constant', () => {
        // A constant would give a portrait capture the same dialog width as a landscape one;
        // locking to the measured fit-mode width keeps a small capture's dialog small.
        assert.ok(
            /zoomStage\.clientWidth/.test(script),
            'the lock reads the stage\'s own measured width');
    });

    test('should widen the lock to the card\'s other children when they need more room', () => {
        // The card's width tracks its widest child's max-content size; locking narrower than
        // the facts grid or nav bar would let those siblings force the card wider than the
        // (now-fixed) stage, breaking the anchor-scroll math the lock exists for.
        assert.ok(
            /Math\.max\(zoomStage\.clientWidth, siblingWidth\)/.test(script),
            'the lock never goes narrower than the card\'s other children need');
    });

    test('should re-lock fresh on every open, not carry a previous capture\'s width', () => {
        assert.ok(script.includes('zoomWidthLocked = false'), 'the lock flag resets on open');
        assert.ok(/stage\.style\.width = '';/.test(script), 'and any previous inline width is cleared');
    });

    test('should lock width only once per open, not on every zoom tick', () => {
        // Re-measuring on every load event (the slider/zoomReset path can also fire zoomApply,
        // though only the image's own load event calls lockStageWidth) would let the box keep
        // growing to whatever the image happens to be at that moment — exactly the bug this
        // guards against.
        assert.ok(
            /if \(zoomWidthLocked \|\| !zoomStage\) \{ return; \}/.test(script),
            'a second call is a no-op');
    });
});

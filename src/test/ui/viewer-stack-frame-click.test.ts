import * as assert from 'node:assert';
import { getViewerClickHandlerScript } from '../../ui/viewer/viewer-script-click-handlers';

/**
 * Pins the whole-row click-to-open behavior for stack FRAMES (user report
 * 2026-06-07: member-first frames read as "not clickable" because only the
 * right-floated path was a link). The branch must route a frame-row click to
 * the frame's embedded .source-link, run AFTER the specific targets it could
 * carry (the .source-link itself, the async-gap glyph), BEFORE the
 * .stack-header toggle (so it cannot be shadowed), and be guarded on a
 * collapsed selection so drag-to-select frame text is not hijacked.
 */
suite('Stack-frame whole-row click-to-open', () => {
    const script = getViewerClickHandlerScript();

    test('routes a .stack-line frame click to the embedded source-link', () => {
        const i = script.indexOf(".closest('.stack-line')");
        assert.ok(i >= 0, 'frame-row branch should target .stack-line');
        const branch = script.slice(i, i + 900);
        assert.ok(branch.includes(".querySelector('.source-link')"), 'finds the frame source-link');
        assert.ok(branch.includes("type: 'linkClicked'"), 'posts a linkClicked message');
        assert.ok(branch.includes('splitEditor'), 'honors Ctrl/Cmd split-editor');
    });

    test('guards the frame click on a collapsed text selection', () => {
        const i = script.indexOf(".closest('.stack-line')");
        const branch = script.slice(i, i + 900);
        assert.ok(branch.includes('getSelection'), 'reads the current selection');
        assert.ok(branch.includes('isCollapsed'), 'only opens when nothing is selected');
    });

    test('frame branch precedes the stack-header toggle branch', () => {
        // Ordering matters: a frame row must resolve to open-file before any
        // header-toggle logic can claim the event.
        const frameIdx = script.indexOf(".closest('.stack-line')");
        const headerIdx = script.indexOf(".closest('.stack-header')");
        assert.ok(frameIdx >= 0 && headerIdx >= 0, 'both branches present');
        assert.ok(frameIdx < headerIdx, 'frame branch comes before header branch');
    });

    test('direct source-link click branch is still handled first', () => {
        // A click on the link itself must keep routing through the original
        // .source-link branch (which also handles Ctrl+click path filtering),
        // so it must appear before the new whole-row fallback.
        const linkIdx = script.indexOf(".closest('.source-link')");
        const frameIdx = script.indexOf(".closest('.stack-line')");
        assert.ok(linkIdx >= 0 && linkIdx < frameIdx, 'source-link branch precedes frame fallback');
    });
});

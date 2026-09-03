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
        // Window spans the whole frame branch (it ends ~1287 chars in, where
        // the .stack-header branch begins) without bleeding into the next
        // branch. The deco-counter-row guard comment pushed linkClicked past a
        // tighter 900-char window, so size to the branch, not a round number.
        const branch = script.slice(i, i + 1200);
        assert.ok(branch.includes(".querySelector('.source-link')"), 'finds the frame source-link');
        assert.ok(branch.includes("type: 'linkClicked'"), 'posts a linkClicked message');
        assert.ok(branch.includes('splitEditor'), 'honors Ctrl/Cmd split-editor');
    });

    test('guards the frame click on a collapsed text selection', () => {
        const i = script.indexOf(".closest('.stack-line')");
        const branch = script.slice(i, i + 1200);
        assert.ok(branch.includes('getSelection'), 'reads the current selection');
        assert.ok(branch.includes('isCollapsed'), 'only opens when nothing is selected');
    });

    test('frame branch precedes the stack-header toggle branch', () => {
        // Ordering matters: a frame row must resolve to open-file before any
        // header-toggle logic can claim the event. Header-toggle handling was
        // extracted to handleGroupToggleClicks() (viewer-script-click-handlers-groups.ts),
        // whose source text is concatenated BEFORE this file's — so a raw
        // indexOf('.stack-header') is no longer a valid position proxy (it finds
        // the function definition, not where it runs). Check the delegating call
        // site instead, searched from frameIdx so it can't match the definition.
        const frameIdx = script.indexOf(".closest('.stack-line')");
        const delegateCallIdx = script.indexOf('handleGroupToggleClicks(e)', frameIdx);
        assert.ok(frameIdx >= 0 && delegateCallIdx >= 0, 'both branches present');
        assert.ok(frameIdx < delegateCallIdx, 'frame branch comes before the delegated header-toggle call');
    });

    test('direct source-link click branch is still handled first', () => {
        // A click on the link itself must keep routing through the original
        // .source-link branch (which also handles Ctrl+click path filtering),
        // so it must appear before the new whole-row fallback.
        const linkIdx = script.indexOf(".closest('.source-link')");
        const frameIdx = script.indexOf(".closest('.stack-line')");
        assert.ok(linkIdx >= 0 && linkIdx < frameIdx, 'source-link branch precedes frame fallback');
    });

    test('the direct source-link branch is guarded on a collapsed selection', () => {
        // User report 2026-06-16: finishing a text drag-select whose mouseup landed on a
        // source link was hijacked into open-file. The branch must read the selection and
        // bail when it is non-collapsed, BEFORE it posts linkClicked.
        const linkIdx = script.indexOf(".closest('.source-link')");
        const ctrlIdx = script.indexOf('filterToPathPrefix');
        // Window spans only the source-link branch (up to the Ctrl+click filter sub-branch).
        const branch = script.slice(linkIdx, ctrlIdx);
        assert.ok(branch.includes('getSelection'), 'source-link branch reads the selection');
        assert.ok(branch.includes('isCollapsed'), 'source-link branch bails on a live selection');
    });
});

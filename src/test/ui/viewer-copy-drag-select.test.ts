/**
 * Drag-select copy module — verifies the script wires the model selection
 * (selectionStart/End) to plain mouse-down→move→up so Ctrl+C / right-click → Copy
 * survive the viewport's per-scroll DOM rebuild.
 *
 * Why static assertions: the script is a JS template literal that runs inside the
 * webview against globals (viewportEl, selectionStart, etc.) that don't exist in
 * Node. Pinning the structural pieces here is enough to catch regressions in the
 * pieces that matter — listener wiring, threshold gating, stuck-state guards.
 */
import * as assert from 'node:assert';
import { getCopyDragSelectScript } from '../../ui/viewer/viewer-copy-drag-select';

suite('viewer-copy-drag-select', () => {
    const script = getCopyDragSelectScript();

    test('exports a non-empty script', () => {
        assert.ok(typeof script === 'string' && script.length > 0);
    });

    test('wires mousedown on viewport and document-level mousemove + mouseup', () => {
        assert.ok(
            script.includes("viewportEl.addEventListener('mousedown', onDragSelectMouseDown)"),
            'mousedown listener must attach to viewportEl, not document — drags start inside the log',
        );
        assert.ok(
            script.includes("document.addEventListener('mousemove', onDragSelectMouseMove)"),
            'mousemove on document so drag tracking survives leaving the viewport bounds',
        );
        assert.ok(
            script.includes("document.addEventListener('mouseup', onDragSelectMouseUp)"),
            'mouseup on document so a release outside the viewport still ends the drag',
        );
    });

    test('drives the same selection model as shift+click (selectionStart / selectionEnd)', () => {
        /* Critical contract: drag-select must NOT introduce a parallel selection state. The
           viewer's render rebuilds DOM on scroll, so the only selection that survives is the
           model-indexed one in viewer-copy.ts. */
        assert.ok(script.includes('selectionStart = dragSelectStartIdx'));
        assert.ok(script.includes('selectionEnd = dragSelectStartIdx'));
        assert.ok(script.includes('selectionEnd = idx'));
    });

    test('gates activation on a movement threshold so single clicks remain no-ops', () => {
        assert.ok(
            script.includes('dragSelectThresholdPx'),
            'threshold variable required so plain clicks do not clobber existing selection',
        );
        assert.ok(
            /dx \* dx \+ dy \* dy < dragSelectThresholdPx \* dragSelectThresholdPx/.test(script),
            'threshold check must be squared-distance to avoid sqrt on every mousemove',
        );
    });

    test('honors shift+click ownership by the existing handler in viewer-copy.ts', () => {
        /* shift+click extends an existing selection via the click handler in viewer-copy.ts.
           If this handler set state on shift+mousedown it would race with that path. */
        assert.ok(
            /if \(e\.shiftKey \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) return/.test(script),
            'modifier-key mousedown must early-return so shift+click handler runs unimpeded',
        );
    });

    test('skips interactive children so links and buttons retain their primary action', () => {
        assert.ok(
            script.includes('dragSelectIgnoreSelector'),
            'ignore-selector required so source-link / url-link / buttons still click through',
        );
        assert.ok(script.includes('source-link'));
        assert.ok(script.includes('url-link'));
    });

    test('clears native text selection on drag activation to avoid double-highlight', () => {
        /* The native blue selection would be wiped by the next viewport re-render anyway —
           clearing it up front prevents a one-frame visual conflict with the row .selected class. */
        assert.ok(script.includes('clearNativeTextSelection()'));
    });

    test('autoscroll pump runs only while a drag is active and stops on release', () => {
        assert.ok(
            script.includes('startDragSelectAutoscroll') && script.includes('stopDragSelectAutoscroll'),
            'pump must have explicit start/stop — leaking the interval would scroll forever after release',
        );
        assert.ok(
            /if \(!dragSelectActive \|\| !logEl\) return/.test(script),
            'pump tick must early-return when not actively dragging',
        );
    });

    test('releases stuck drag state on lost button (e.buttons & 1) and on focus loss', () => {
        /* Without these guards a mouseup that lands outside the iframe (alt-tab during drag,
           OS-level interrupt) leaves dragSelectActive true and the autoscroll pump runs
           forever, presenting as the viewer flickering on its own. */
        assert.ok(
            /\(e\.buttons & 1\) === 0/.test(script),
            'mousemove must release when left button is no longer held',
        );
        assert.ok(
            script.includes("window.addEventListener('blur', onDragSelectMouseUp)"),
            'window blur must release drag (alt-tab during drag)',
        );
        assert.ok(
            script.includes("document.addEventListener('visibilitychange'"),
            'visibility change must release drag (tab hidden)',
        );
        assert.ok(
            script.includes("document.addEventListener('mouseleave', onDragSelectMouseUp)"),
            'mouse leaving the iframe must release drag',
        );
    });

    test('only top-level viewport children with data-idx are accepted as rows', () => {
        /* Nested .line elements (rare but possible inside embedded panels) would resolve to
           an idx that does not map into allLines — selection would target the wrong rows. */
        assert.ok(
            script.includes('rowEl.parentElement !== viewportEl'),
            'reject closest() matches that are not direct viewport children',
        );
        assert.ok(script.includes('rowEl.dataset'));
    });

    test('activation requires the cursor to leave the start row so within-line text selection works', () => {
        /* Regression guard: a prior version activated drag-select on any 4px movement, which
           wiped native browser selection (clearNativeTextSelection) and stamped a whole-row
           .selected class. That made selecting half a line / a word / a SQL token impossible —
           dragging horizontally inside one row immediately replaced the in-progress text
           highlight with a row highlight. Activation must now also require the cursor to be
           on a different row index than dragSelectStartIdx. */
        assert.ok(
            /curIdx === dragSelectStartIdx/.test(script),
            'activation must compare cursor row to dragSelectStartIdx and skip when equal',
        );
        /* The within-row early return must precede activateDragSelect() so we never call
           clearNativeTextSelection while the drag is still inside the start row. */
        const earlyReturnIdx = script.indexOf('curIdx === dragSelectStartIdx) return');
        const activateIdx = script.indexOf('activateDragSelect();');
        assert.ok(
            earlyReturnIdx >= 0 && activateIdx >= 0 && earlyReturnIdx < activateIdx,
            'within-row early return must come before activateDragSelect call',
        );
    });

    test('a plain click dismisses an existing model selection (no Escape needed)', () => {
        /* User report 2026-06-16: a multi-row / shift selection only cleared with Escape.
           A plain click in the viewport must now clear it via clearSelection(). */
        assert.ok(
            script.includes("viewportEl.addEventListener('click', onDragSelectDismissClick)"),
            'dismiss-on-click listener must attach to viewportEl',
        );
        assert.ok(
            /selectionStart >= 0 && typeof clearSelection === 'function'/.test(script),
            'dismiss click clears the model selection only when one exists',
        );
    });

    test('dismiss click is gated so it never wipes a selection still being made', () => {
        /* Three gates: modifier clicks (shift/ctrl extend or filter) are skipped, the click
           that ENDS a drag is skipped (dragSelectJustEnded), and a live native within-line
           text selection (non-collapsed) is preserved. */
        assert.ok(
            script.includes('dragSelectJustEnded'),
            'flag required so the drag-ending click is not treated as a dismiss',
        );
        assert.ok(
            /if \(dragSelectActive\) dragSelectJustEnded = true/.test(script),
            'mouseup must remember a real model drag so its trailing click is skipped',
        );
        assert.ok(
            /if \(e\.shiftKey \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) return/.test(
                script.slice(script.indexOf('function onDragSelectDismissClick')),
            ),
            'modifier clicks must not dismiss',
        );
        assert.ok(
            /if \(s && !s\.isCollapsed\) return/.test(
                script.slice(script.indexOf('function onDragSelectDismissClick')),
            ),
            'a live native text selection must be preserved',
        );
        /* Reset on the next mousedown so a dropped/absent drag-end click cannot strand the
           flag and swallow a later legitimate dismiss click. */
        assert.ok(
            /dragSelectJustEnded = false/.test(
                script.slice(script.indexOf('function onDragSelectMouseDown')),
            ),
            'fresh mousedown must reset the just-ended flag',
        );
    });

    test('exposes isUserSelecting() for the streaming/auto-scroll path to query', () => {
        /* The addLines handler in viewer-script-messages.ts calls this to suppress
           snap-to-bottom while a selection is in progress. If this signature drifts the
           handler's typeof guard will silently fail open and live capture will scroll over
           the user's selection again. */
        assert.ok(
            /function isUserSelecting\(\)/.test(script),
            'isUserSelecting must be a top-level function so it lives on window',
        );
        assert.ok(script.includes('dragSelectActive'));
        assert.ok(script.includes('window.getSelection'));
        assert.ok(script.includes('isCollapsed'));
    });
});

import * as assert from 'node:assert';
import { getDropToOpenScript } from '../../ui/viewer/viewer-drop-to-open';

/* The OS-file-drop handler runs inside the sandboxed webview iframe, so it can only be
   exercised at runtime via real DragEvents — the Extension Host has no DOM. These tests pin
   the reliability invariants of the GENERATED script instead, following the same
   string-assertion pattern as viewer-script-keyboard-escape.test.ts.

   The invariants below are exactly the regressions the hardening pass fixed; a future edit
   that drops any of them silently reintroduces a stuck overlay, a flickering overlay, a
   suppressed drop, or a thrown drag handler. */
suite('Webview OS-file drop-to-open script', () => {
    const script = getDropToOpenScript();

    test('registers every drag lifecycle listener in capture phase', () => {
        for (const evt of ['dragenter', 'dragover', 'dragleave', 'drop', 'dragend', 'blur']) {
            assert.ok(
                script.includes("addEventListener('" + evt + "'"),
                'drop script must listen for ' + evt,
            );
        }
        /* Capture phase (the trailing `, true`) so preventDefault runs before any in-page handler. */
        assert.ok(script.includes(', true)'), 'listeners must be registered capture-phase');
    });

    test('arms the drop on BOTH dragenter and dragover (Chromium suppresses drop otherwise)', () => {
        /* The attempt-2 regression: gating dragover meant preventDefault never ran and the drop
           was suppressed. Both enter and over must preventDefault. */
        assert.ok(script.includes('function onDragEnter'), 'expected onDragEnter handler');
        assert.ok(script.includes('function onDragOver'), 'expected onDragOver handler');
        assert.ok(script.includes('e.preventDefault()'), 'drop arming requires preventDefault');
        assert.ok(script.includes("dropEffect = 'copy'"), 'must signal a copy drop effect');
    });

    test('uses an enter/leave depth counter so the overlay does not flicker over child rows', () => {
        assert.ok(script.includes('dragDepth'), 'overlay visibility must be driven by a depth counter');
        assert.ok(script.includes('dragDepth++'), 'dragenter must increment the depth counter');
        assert.ok(script.includes('dragDepth--') || script.includes('dragDepth -'), 'dragleave must decrement');
    });

    test('resets drag state on cancel paths so the overlay never strands', () => {
        /* Esc-cancel / release-outside-window / blur fire no drop and no matching leave; without an
           explicit reset the dashed overlay stays stuck on screen. */
        assert.ok(script.includes('function resetDrag'), 'expected a resetDrag helper');
        assert.ok(script.includes("addEventListener('dragend'"), 'dragend must reset drag state');
        assert.ok(script.includes("addEventListener('blur'"), 'window blur must reset drag state');
    });

    test('guards every handler so a drag listener can never throw', () => {
        assert.ok(script.includes('function guard'), 'handlers must be wrapped by a guard');
        assert.ok(/try\s*{/.test(script) && script.includes('catch'), 'guard must swallow handler errors');
    });

    test('does NOT call stopPropagation (it cannot reach the parent-frame workbench and risks starving webview drag plumbing)', () => {
        /* Match the CALL, not the bare word — the WHY-comment legitimately names stopPropagation. */
        assert.ok(!script.includes('stopPropagation('), 'stopPropagation() was deliberately removed');
    });

    test('preserves multi-path delivery: uri-list, items, files, and capped content', () => {
        assert.ok(script.includes('text/uri-list'), 'must read file:// / http(s):// from text/uri-list');
        assert.ok(script.includes('getAsFile'), 'must fall back to DataTransferItemList.getAsFile');
        assert.ok(script.includes('FileReader'), 'must read dropped content when no path/URI is exposed');
        assert.ok(script.includes('file.path'), 'must prefer the OS path when the host exposes it');
    });

    test('leaves in-page typed drags (SQL/collection) untouched', () => {
        assert.ok(script.includes('function isInPageTypedDrag'), 'expected the in-page-drag discriminator');
        assert.ok(script.includes("=== 'Files'"), 'an OS file drag exposes the Files type');
    });
});

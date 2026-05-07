import * as assert from 'node:assert';
import { getCopyScript } from '../../ui/viewer/viewer-copy';
import { getContextMenuLineActionsScript } from '../../ui/viewer-context-menu/viewer-context-menu-line-actions';

/**
 * Tests for decorated copy fixes:
 * 1. Shift-click selection uses data-idx (not lastStart + offset) for correct
 *    indices when filtered lines exist in the viewport.
 * 2. "Copy Line Decorated" copies all selected lines when a shift-click
 *    selection exists, even if the right-click was outside the range.
 * 3. decorateLine strips the leading emoji dot from text when the decoration
 *    is about to prepend the same dot, preventing duplication.
 */
suite('Copy Decorated', () => {

    suite('shift-click selection index', () => {
        const script = getCopyScript();

        test('should prefer dataset.idx over lastStart + clickOffset', () => {
            assert.ok(
                script.includes('lineEl.dataset.idx'),
                'shift-click handler should read dataset.idx from DOM element',
            );
        });

        test('should fall back to lastStart + clickOffset when dataset.idx missing', () => {
            assert.ok(
                script.includes('lastStart + clickOffset'),
                'should retain fallback for elements without data-idx',
            );
        });

        test('should parse dataset.idx as integer', () => {
            assert.ok(
                script.includes("parseInt(lineEl.dataset.idx, 10)"),
                'should parseInt dataset.idx with radix 10',
            );
        });

        test('updateSelectionHighlight should use data-idx per row, not lastStart + child index', () => {
            const start = script.indexOf('function updateSelectionHighlight');
            assert.ok(start >= 0, 'updateSelectionHighlight must exist');
            const rest = script.slice(start, start + 1200);
            assert.ok(
                rest.includes('el.dataset') && rest.includes("parseInt(raw, 10)"),
                'should parse each viewport child data-idx for range check',
            );
            assert.ok(
                !rest.includes('lastStart + i'),
                'must not map selection with lastStart + loop index (breaks when .viewer-divider rows exist)',
            );
        });
    });

    suite('decorateLine dot deduplication', () => {
        const script = getCopyScript();

        test('should strip leading dot from text when decoration adds one', () => {
            const fnStart = script.indexOf('function decorateLine');
            assert.ok(fnStart >= 0, 'decorateLine function must exist');
            const fnBlock = script.slice(fnStart, fnStart + 800);

            assert.ok(
                fnBlock.includes('text.indexOf(dot) === 0'),
                'should check if text starts with the same dot',
            );
            assert.ok(
                fnBlock.includes('text.substring(dot.length)'),
                'should strip the leading dot from text',
            );
        });

        test('should only strip when decoShowDot is active', () => {
            const fnStart = script.indexOf('function decorateLine');
            const fnBlock = script.slice(fnStart, fnStart + 800);

            assert.ok(
                fnBlock.includes('addingDot'),
                'dot stripping should be gated on addingDot flag',
            );
            assert.ok(
                fnBlock.includes("typeof decoShowDot !== 'undefined' && decoShowDot"),
                'addingDot should require decoShowDot to be truthy',
            );
        });

        test('should trim whitespace after stripping dot', () => {
            const fnStart = script.indexOf('function decorateLine');
            const fnBlock = script.slice(fnStart, fnStart + 800);

            assert.ok(
                /replace\(\/\^\\s\+\//.test(fnBlock),
                'should trim leading whitespace after dot removal',
            );
        });
    });

    suite('copy-decorated multi-line selection', () => {
        const script = getContextMenuLineActionsScript();

        test('should copy the right-clicked line when the click is OUTSIDE a stale shift-click selection', () => {
            /* Earlier behavior used `sel.multiLine || hasAnySel` so any prior shift-click range
               hijacked Copy Line / Copy Line Decorated on rows outside that range — user
               right-clicks line 50 to copy it and gets lines 5-10 instead. The fix scopes the
               multi-line branch to `sel.multiLine` only (right-click is INSIDE the selection),
               which matches user expectation: right-click line 50 → copy line 50. */
            const start = script.indexOf("case 'copy-decorated':");
            assert.ok(start >= 0, 'copy-decorated case must exist');
            const block = script.slice(start, start + 800);

            assert.ok(!block.includes('hasAnySel'), 'hasAnySel must be removed');
            assert.ok(block.includes('sel.multiLine'), 'should still respect multiLine selection');
            assert.ok(!/sel\.multiLine\s*\|\|/.test(block), 'must not OR multiLine with anything else');
        });
    });

    suite('copy (plain) multi-line selection consistency', () => {
        const script = getContextMenuLineActionsScript();

        test('copy action mirrors copy-decorated: only sel.multiLine triggers multi-line copy', () => {
            const start = script.indexOf("case 'copy':");
            assert.ok(start >= 0, 'copy case must exist');
            const block = script.slice(start, start + 1200);

            assert.ok(!block.includes('hasAnySel'), 'hasAnySel must be removed from copy too');
            assert.ok(block.includes('sel.multiLine'), 'should still gate on multiLine');
            assert.ok(!/sel\.multiLine\s*\|\|/.test(block), 'must not OR multiLine with anything else');
        });
    });
});

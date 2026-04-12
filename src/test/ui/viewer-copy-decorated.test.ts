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

        test('should respect selection even when right-click is outside range', () => {
            const start = script.indexOf("case 'copy-decorated':");
            assert.ok(start >= 0, 'copy-decorated case must exist');
            const block = script.slice(start, start + 500);

            assert.ok(
                block.includes('hasAnySel'),
                'should check for any active selection, not just multiLine',
            );
            assert.ok(
                block.includes('sel.multiLine || hasAnySel'),
                'should use OR of multiLine and hasAnySel',
            );
        });

        test('hasAnySel should check selectionStart >= 0 and sel.hi > sel.lo', () => {
            const start = script.indexOf("case 'copy-decorated':");
            const block = script.slice(start, start + 500);

            assert.ok(
                block.includes('selectionStart >= 0'),
                'hasAnySel should require selectionStart >= 0',
            );
            assert.ok(
                block.includes('sel.hi > sel.lo'),
                'hasAnySel should require hi > lo (at least 2 lines)',
            );
        });
    });

    suite('copy (plain) multi-line selection consistency', () => {
        const script = getContextMenuLineActionsScript();

        test('copy action should also use hasAnySel for consistency with copy-decorated', () => {
            const start = script.indexOf("case 'copy':");
            assert.ok(start >= 0, 'copy case must exist');
            const block = script.slice(start, start + 500);

            assert.ok(
                block.includes('hasAnySel'),
                'copy should check hasAnySel like copy-decorated',
            );
            assert.ok(
                block.includes('sel.multiLine || hasAnySel'),
                'copy should use same OR pattern as copy-decorated',
            );
        });
    });
});

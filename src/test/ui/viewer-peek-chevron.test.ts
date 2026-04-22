/**
 * Tests for the scoped peek-chevron feature (viewer-peek-chevron.ts).
 *
 * Covers the three moving parts of click-to-peek:
 *   1. the chevron HTML carries data-from/data-to range attributes so the click
 *      handler knows which items to reveal;
 *   2. calcItemHeight bypasses every filter/hide gate when peekOverride is set
 *      (otherwise clicking the chevron would reveal nothing);
 *   3. the render loop injects a .peek-collapse un-peek marker before the first
 *      item of each peek group, and skips both indicator divs when bridging
 *      same-level severity dots (so the connector bar still spans the gap).
 *
 * Pattern: string-includes assertions against the generated webview JS / CSS,
 * matching the existing viewer-severity-bar-connector.test.ts style.
 */
import * as assert from 'node:assert';
import { getPeekChevronScript } from '../../ui/viewer/viewer-peek-chevron';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getDecorationStyles } from '../../ui/viewer-styles/viewer-styles-decoration';
import { getHiddenLinesScript } from '../../ui/viewer/viewer-hidden-lines';

suite('Peek chevron — data attributes on the hidden-chevron', () => {
    const viewport = getViewportRenderScript();

    test('should emit data-from with the first hidden index', () => {
        // prevVisIdx is the last visible line before the gap; the gap starts at prevVisIdx+1.
        assert.ok(
            viewport.includes(`data-from="' + (prevVisIdx + 1) + '"`),
            'chevron must carry data-from so peekChevron knows the start index',
        );
    });

    test('should emit data-to with the next visible index (exclusive)', () => {
        // i is the next visible line after the gap; range is [from, to) exclusive.
        assert.ok(
            viewport.includes(`data-to="' + i + '"`),
            'chevron must carry data-to as the exclusive range end',
        );
    });
});

suite('Peek chevron — un-peek marker injection in render loop', () => {
    const viewport = getViewportRenderScript();

    test('should read peekAnchorKey from the current item', () => {
        assert.ok(
            viewport.includes('allLines[i].peekAnchorKey'),
            'render loop must look up each peekAnchorKey to decide marker placement',
        );
    });

    test('should inject .peek-collapse at the first item of a peek group', () => {
        assert.ok(
            viewport.includes('allLines[i - 1].peekAnchorKey !== _pk'),
            'first-in-group detection must compare prev key to current key',
        );
        assert.ok(
            viewport.includes('<div class="peek-collapse"'),
            'render loop must emit a peek-collapse div for the group start',
        );
    });

    test('should pass peekAnchorKey through as data-peek-key for the click handler', () => {
        assert.ok(
            viewport.includes(`data-peek-key="' + _pk + '"`),
            'peek-collapse must carry data-peek-key so unpeekChevron can match the group',
        );
    });
});

suite('Peek chevron — same-level dot bridging skips both indicator divs', () => {
    const viewport = getViewportRenderScript();

    test('should skip peek-collapse in findNextDotSibling', () => {
        assert.ok(
            viewport.includes(`classList.contains('peek-collapse')`) &&
                viewport.includes('findNextDotSibling'),
            'findNextDotSibling must skip peek-collapse the same way it skips hidden-chevron',
        );
    });

    test('should skip peek-collapse when adding bar-bridge classes', () => {
        assert.ok(
            viewport.includes(`!ch[bi].classList.contains('peek-collapse')`),
            'bar-bridge loop must not stamp level classes onto peek-collapse divs',
        );
    });
});

suite('Peek chevron — calcItemHeight peekOverride bypass', () => {
    const core = getViewerDataHelpersCore();

    test('should wrap filter gates in !item.peekOverride', () => {
        assert.ok(
            core.includes('if (!item.peekOverride)'),
            'calcItemHeight must short-circuit past filter gates when peekOverride is set',
        );
    });

    test('should still respect peekOverride for tier-hidden items', () => {
        assert.ok(
            core.includes('_tierHidden && !item.peekOverride'),
            'tier-hidden gate must also defer to peekOverride',
        );
    });

    test('should NOT wrap continuation-collapse inside peekOverride bypass', () => {
        // Continuation collapse is an explicit user action, not a filter;
        // peek must not undo it. The contCollapsed gate sits AFTER the
        // peekOverride wrap block closes.
        const src = core;
        const peekStart = src.indexOf('if (!item.peekOverride)');
        const contGate = src.indexOf('contCollapsed');
        assert.ok(peekStart >= 0 && contGate >= 0, 'both gates must exist');
        assert.ok(
            contGate > peekStart,
            'contCollapsed gate must come after the peekOverride wrap',
        );
    });
});

suite('Peek chevron — peek / un-peek functions', () => {
    const peek = getPeekChevronScript();

    test('should mint a fresh peekAnchorKey for each peek', () => {
        // Per-group keys let two adjacent peeks collapse independently.
        assert.ok(peek.includes('var nextPeekKey = 1'), 'must declare monotonic key counter');
        assert.ok(peek.includes('var key = nextPeekKey++'), 'peekChevron must mint a new key per call');
    });

    test('should set peekOverride and peekAnchorKey on items in [from, to)', () => {
        assert.ok(peek.includes('it.peekOverride = true'), 'peek must set peekOverride flag');
        assert.ok(peek.includes('it.peekAnchorKey = key'), 'peek must stamp the group key on each item');
    });

    test('should skip items already peeked by another group', () => {
        assert.ok(
            peek.includes('it.peekAnchorKey !== undefined && it.peekAnchorKey !== null'),
            'peekChevron must not overwrite an existing peek group key',
        );
    });

    test('should clear only the matching key in unpeekChevron', () => {
        assert.ok(
            peek.includes('it.peekAnchorKey === key'),
            'unpeekChevron must match the specific group key, not clear all peeks',
        );
    });

    test('should bail on shift+click so row selection still works', () => {
        assert.ok(
            peek.includes('if (e.shiftKey) return'),
            'click handler must bail on shiftKey to avoid colliding with row selection',
        );
    });

    test('should delegate at the viewport level', () => {
        assert.ok(
            peek.includes(`document.getElementById('viewport')`),
            'click handler must be delegated from #viewport (stable across re-renders)',
        );
    });
});

suite('Peek chevron — initHiddenLines wires initPeekChevron', () => {
    const hidden = getHiddenLinesScript();

    test('should call initPeekChevron from initHiddenLines', () => {
        assert.ok(
            hidden.includes(`typeof initPeekChevron === 'function'`) &&
                hidden.includes('initPeekChevron()'),
            'initHiddenLines must invoke initPeekChevron so the click handler wires up',
        );
    });
});

suite('Peek chevron — CSS for .peek-collapse and hit targets', () => {
    const css = getDecorationStyles();

    test('should define .peek-collapse with zero height + overflow visible', () => {
        const block = css.slice(css.indexOf('.peek-collapse {'), css.indexOf('.peek-collapse >'));
        assert.ok(
            block.includes('height: 0') && block.includes('overflow: visible'),
            'peek-collapse must be zero-height with overflow visible',
        );
    });

    test('should render the minus glyph via ::before content (not a text node)', () => {
        assert.ok(
            css.includes(`.peek-collapse > span::before { content: '\\2212'; }`),
            'un-peek glyph must be drawn via ::before content so it cannot be selected or copied',
        );
    });

    test('should mark both indicator divs user-select: none', () => {
        const hiddenMatch = /\.hidden-chevron\s*\{[\s\S]*?user-select:\s*none/.test(css);
        const peekMatch = /\.peek-collapse\s*\{[\s\S]*?user-select:\s*none/.test(css);
        assert.ok(hiddenMatch, 'hidden-chevron must be unselectable');
        assert.ok(peekMatch, 'peek-collapse must be unselectable');
    });

    test('should give the hidden-chevron a click cursor and pointer-events', () => {
        assert.ok(
            css.includes('.hidden-chevron { cursor: pointer; pointer-events: auto; }'),
            'chevron must be visually and behaviorally clickable',
        );
    });

    test('should visually differentiate peek-collapse from hidden-chevron', () => {
        const peekBlock = css.slice(
            css.indexOf('.peek-collapse >'),
            css.indexOf('.peek-collapse:hover'),
        );
        assert.ok(
            peekBlock.includes('var(--vscode-textLink-foreground'),
            'peek-collapse must use accent/link color, distinct from descriptionForeground',
        );
    });
});

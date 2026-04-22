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

suite('Peek chevron — data attributes on the row after a hidden gap', () => {
    // Unified line-collapsing: both indicator states (hidden gap behind, peek
    // group start) are now stamped onto the outer row via .bar-hidden-rows
    // plus routing data-* attrs. The click handler disambiguates by which
    // attrs are present. See bugs/unified-line-collapsing.md.
    const viewport = getViewportRenderScript();

    test('should emit data-hidden-from with the first hidden index', () => {
        // _hiddenFrom = prevVisIdx + 1 — first hidden index (inclusive).
        assert.ok(
            viewport.includes("data-hidden-from=\"' + _hiddenFrom + '\""),
            'row after a hidden gap must carry data-hidden-from so peekChevron knows the start index',
        );
    });

    test('should emit data-hidden-to with the next visible index (exclusive)', () => {
        // _hiddenTo = i — exclusive end of the hidden range.
        assert.ok(
            viewport.includes("data-hidden-to=\"' + _hiddenTo + '\""),
            'row after a hidden gap must carry data-hidden-to as the exclusive range end',
        );
    });
});

suite('Peek chevron — un-peek state stamped on the first peek-group row', () => {
    const viewport = getViewportRenderScript();

    test('should read peekAnchorKey from the current item', () => {
        assert.ok(
            viewport.includes('allLines[i].peekAnchorKey'),
            'render loop must look up each peekAnchorKey to decide which row starts a peek group',
        );
    });

    test('should stamp .bar-hidden-rows on the first row of a peek group', () => {
        assert.ok(
            viewport.includes('allLines[i - 1].peekAnchorKey !== _pk'),
            'first-in-group detection must compare prev key to current key',
        );
        assert.ok(
            viewport.includes('class="bar-hidden-rows '),
            'render loop must inject .bar-hidden-rows onto the first row of a peek group',
        );
    });

    test('should pass peekAnchorKey through as data-peek-key for the click handler', () => {
        assert.ok(
            viewport.includes("data-peek-key=\"' + _peekKey + '\""),
            'peek-group row must carry data-peek-key so unpeekChevron can match the group',
        );
    });
});

suite('Retired indicator divs no longer affect bar-bridge logic', () => {
    // The unified line-collapsing rethink retired .peek-collapse and
    // .hidden-chevron entirely, so the bar-bridge post-pass no longer needs
    // to skip them. These tests pin the cleanup so nobody reintroduces the
    // skip without first reintroducing the divs themselves.
    const viewport = getViewportRenderScript();

    test('should no longer reference .peek-collapse in the render loop', () => {
        assert.ok(
            !viewport.includes(`classList.contains('peek-collapse')`),
            'render loop must not reference the retired .peek-collapse class',
        );
    });

    test('should no longer reference .hidden-chevron in the render loop', () => {
        assert.ok(
            !viewport.includes(`classList.contains('hidden-chevron')`),
            'render loop must not reference the retired .hidden-chevron class',
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

suite('Retired .peek-collapse CSS is fully removed', () => {
    // The CSS rules for .peek-collapse (and .hidden-chevron) were removed when
    // the unified line-collapsing rethink retired those indicator elements.
    // The outlined severity-dot state (.bar-hidden-rows) replaces both.
    const css = getDecorationStyles();

    test('should no longer define any .peek-collapse CSS rule', () => {
        // Active selector usage only — comment mentions are allowed.
        assert.ok(
            !/\.peek-collapse\s*[{>:]/.test(css),
            'bundled stylesheet must not carry dead .peek-collapse rules',
        );
    });

    test('should define the replacement .bar-hidden-rows state', () => {
        assert.ok(
            css.includes('.bar-hidden-rows'),
            'unified outlined-dot state must be present',
        );
    });
});

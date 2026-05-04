/**
 * Tests for the scoped peek-chevron feature (viewer-peek-chevron.ts) AFTER
 * the severity-gutter decoupling (plan: bugs/048_plan-severity-gutter-decoupling.md).
 *
 * The peekOverride / peekAnchorKey state machine is unchanged. Only the
 * UI vocabulary that triggers it has changed:
 *   - Filter-hidden gap expand → .viewer-divider[data-divider-action="show-gap"]
 *   - Peek group collapse      → .viewer-divider[data-divider-action="hide-peek"]
 *                                 (leading AND trailing brackets the range)
 *   - Dedup-fold expand/hide   → inline .dedup-badge on the survivor
 *   - Preview-mode show-all    → .viewer-divider[data-divider-action="show-frames"]
 *
 * The severity dot is no longer interactive — assertions below pin that
 * the render loop and click delegate emit none of the prior overload.
 *
 * Pattern: string-includes assertions against the generated webview JS / CSS,
 * matching the existing viewer-severity-bar-connector.test.ts style.
 */
import * as assert from 'node:assert';
import { getPeekChevronScript } from '../../ui/viewer/viewer-peek-chevron';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getDividerRenderScript } from '../../ui/viewer/viewer-data-divider';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getDecorationStyles } from '../../ui/viewer-styles/viewer-styles-decoration';
import { getHiddenLinesScript } from '../../ui/viewer/viewer-hidden-lines';

suite('Filter-hidden gap → divider row carries the expand attrs', () => {
    /* Plan 048 replaces the prior overload (".bar-hidden-rows" stamped on
       the row AFTER the gap with data-hidden-from/to attrs) with an inline
       .viewer-divider sibling row that carries the same attrs. The divider
       IS the click target; the severity gutter no longer is. */
    const divider = getDividerRenderScript();
    const viewport = getViewportRenderScript();

    test('buildHiddenGapDivider emits data-hidden-from / data-hidden-to', () => {
        assert.ok(
            divider.includes('data-hidden-from="\' + from + \'"'),
            'divider builder must propagate the start index for peekChevron',
        );
        assert.ok(
            divider.includes('data-hidden-to="\' + to + \'"'),
            'divider builder must propagate the exclusive end index',
        );
    });

    test('buildHiddenGapDivider tags itself with show-gap action', () => {
        assert.ok(
            divider.includes('data-divider-action="show-gap"'),
            'show-gap action lets the click delegate route filter-gap dividers to peekChevron',
        );
    });

    test('render loop calls buildHiddenGapDivider when a gap is detected', () => {
        assert.ok(
            viewport.includes('buildHiddenGapDivider(_hiddenFrom, _hiddenTo, _hInfo)'),
            'renderViewport must push a divider row when prevVisIdx leaves a gap',
        );
    });

    test('render loop no longer stamps .bar-hidden-rows onto a row', () => {
        // Plan 048 retires the overload entirely. Any reintroduction would
        // re-create the data-loss-feeling dot-click failure mode.
        assert.ok(
            !viewport.includes('class="bar-hidden-rows '),
            'render loop must not inject the retired .bar-hidden-rows class',
        );
    });
});

suite('Peek group collapse → leading + trailing divider brackets', () => {
    const divider = getDividerRenderScript();
    const viewport = getViewportRenderScript();

    test('buildPeekHideDivider emits hide-peek action + peek-key + position', () => {
        assert.ok(
            divider.includes('data-divider-action="hide-peek"'),
            'hide-peek action lets the click delegate route to unpeekChevron',
        );
        assert.ok(
            divider.includes('data-peek-key="\' + peekKey + \'"'),
            'divider must carry the peek-key so unpeekChevron collapses the right group',
        );
        assert.ok(
            divider.includes('data-peek-pos="\' + pos + \'"'),
            'divider must carry start/end so the label can read "above" on the trailing bracket',
        );
    });

    test('render loop emits BOTH leading and trailing dividers per peek group', () => {
        // Principle 3 of plan 048: collapse from far end of the expansion.
        // The user can then close the group from wherever they scrolled to.
        assert.ok(
            viewport.includes("buildPeekHideDivider(_pk, countPeekedLines(_pk), 'start')"),
            'leading divider must emit at the first row of an expanded peek group',
        );
        assert.ok(
            viewport.includes("buildPeekHideDivider(_pk, countPeekedLines(_pk), 'end')"),
            'trailing divider must emit at the last row of an expanded peek group',
        );
    });

    test('render loop suppresses peek dividers for dedup peeks', () => {
        // Dedup peeks own their toggle via the inline .dedup-badge on the
        // survivor. Bracketing dividers would be a redundant target on a
        // row that does not own the fold.
        assert.ok(
            viewport.includes("peekKind !== 'dedup'"),
            'render loop must skip leading/trailing brackets when peekKind is dedup',
        );
    });
});

suite('Preview-mode trimmed-frame divider', () => {
    const divider = getDividerRenderScript();
    const viewport = getViewportRenderScript();

    test('getPreviewModeHiddenInfo only fires for preview-mode app frames', () => {
        // Header.collapsed === true / false → not preview; fw frames → never visible
        // in preview. Returns null in those cases so the divider does not emit.
        assert.ok(
            divider.includes('hdr.collapsed === true || hdr.collapsed === false'),
            'helper must short-circuit when header is in an explicit collapsed/expanded state',
        );
        assert.ok(
            divider.includes('item.fw'),
            'helper must short-circuit on framework frames (always hidden in preview)',
        );
    });

    test('buildPreviewFramesDivider routes show-frames action through gid', () => {
        assert.ok(
            divider.includes('data-divider-action="show-frames"'),
            'show-frames action lets the click delegate route to toggleStackGroup',
        );
        assert.ok(
            divider.includes('data-gid="\' + info.gid + \'"'),
            'divider must carry the gid so toggleStackGroup expands the right group',
        );
    });

    test('render loop pushes preview divider AFTER the last visible app frame', () => {
        assert.ok(
            viewport.includes('getPreviewModeHiddenInfo(allLines[i])')
                && viewport.includes('buildPreviewFramesDivider(_previewInfo)'),
            'renderViewport must emit a preview divider when the helper returns info',
        );
    });
});

suite('Click delegation routes the four affordances correctly', () => {
    const peek = getPeekChevronScript();

    test('handler routes show-gap divider clicks to peekChevron', () => {
        assert.ok(
            peek.includes(`closest('.viewer-divider[data-divider-action]')`),
            'handler must scope to .viewer-divider with an action attribute',
        );
        assert.ok(
            peek.includes(`'show-gap'`) && peek.includes('peekChevron(from, to,'),
            'show-gap branch must call peekChevron with the divider data-attrs',
        );
    });

    test('handler routes hide-peek divider clicks to unpeekChevron', () => {
        assert.ok(
            peek.includes(`'hide-peek'`) && peek.includes('unpeekChevron(peekKey)'),
            'hide-peek branch must call unpeekChevron with the divider peek-key',
        );
    });

    test('handler routes show-frames divider clicks to toggleStackGroup', () => {
        assert.ok(
            peek.includes(`'show-frames'`) && peek.includes('toggleStackGroup(gid)'),
            'show-frames branch must call toggleStackGroup with the divider gid',
        );
    });

    test('handler routes .dedup-badge clicks via collapsed/expanded state', () => {
        assert.ok(
            peek.includes(`closest('.dedup-badge[data-dedup-survivor-idx]')`),
            'badge handler must scope to .dedup-badge by data-attr',
        );
        // When the survivor already carries a peekAnchorKey the badge collapses
        // (unpeekChevron); otherwise it expands (peekDedupFold).
        assert.ok(
            peek.includes('survivor.peekAnchorKey !== undefined'),
            'badge handler must inspect peekAnchorKey to choose direction',
        );
        assert.ok(
            peek.includes('unpeekChevron(survivor.peekAnchorKey)')
                && peek.includes('peekDedupFold(idx)'),
            'badge handler must wire both directions through one selector',
        );
    });

    test('severity dot has no interactive class — gutter is read-only', () => {
        // Plan 048 Principle 1: the severity gutter shows severity. It does
        // not accept clicks. The retired .bar-hidden-rows selector and its
        // closest('.bar-hidden-rows') click delegate are gone.
        assert.ok(
            !peek.includes(".bar-hidden-rows"),
            'click delegate must not reference the retired .bar-hidden-rows class',
        );
    });

    test('handler bails on shift-click so range selection still works', () => {
        assert.ok(
            peek.includes('if (e.shiftKey) return'),
            'click handler must bail on shiftKey to avoid colliding with row selection',
        );
    });

    test('handler is delegated at the viewport level', () => {
        assert.ok(
            peek.includes(`document.getElementById('viewport')`),
            'click handler must be delegated from #viewport (stable across re-renders)',
        );
    });
});

suite('Peek state machine — calcItemHeight peekOverride bypass', () => {
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

suite('Peek state machine — peek / un-peek functions', () => {
    const peek = getPeekChevronScript();

    test('should mint a fresh peekAnchorKey for each peek', () => {
        // Per-group keys let two adjacent peeks collapse independently.
        assert.ok(peek.includes('var nextPeekKey = 1'), 'must declare monotonic key counter');
        assert.ok(peek.includes('var key = nextPeekKey++'), 'peek* must mint a new key per call');
    });

    test('should set peekOverride and peekAnchorKey on items in [from, to)', () => {
        assert.ok(peek.includes('it.peekOverride = true'), 'peek must set peekOverride flag');
        assert.ok(peek.includes('it.peekAnchorKey = key'), 'peek must stamp the group key on each item');
    });

    test('should stamp peekKind so render loop knows whether to bracket the group', () => {
        // peekKind='dedup' suppresses the leading/trailing .viewer-divider
        // brackets (the badge handles that group's collapse). 'filter' gets
        // the brackets (Principle 3 of the plan).
        assert.ok(
            peek.includes(`survivor.peekKind = 'dedup'`),
            'peekDedupFold must mark the survivor as a dedup peek',
        );
        assert.ok(
            peek.includes('it.peekKind = pkind') || peek.includes('it.peekKind = '),
            'peekChevron must stamp peekKind on every revealed item',
        );
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

suite('Retired CSS rules and selectors are fully removed', () => {
    /* Plan 048 retired both the .bar-hidden-rows outlined-dot state AND the
       interim .peek-collapse-row sibling that briefly bridged the gap
       between the unified-line-collapsing rethink and the gutter-decoupling
       rework. Pin the cleanup so a future refactor does not silently
       re-introduce either. */
    const css = getDecorationStyles();

    test('CSS no longer defines .bar-hidden-rows outlined-dot rule', () => {
        // Match an active selector usage (followed by `{`, ` >`, `:hover`, etc.).
        // Mere mentions in comments / migration notes are allowed.
        assert.ok(
            !/\.bar-hidden-rows\s*[{>:]/.test(css)
                && !/\.bar-hidden-rows::before/.test(css),
            'bundled stylesheet must not carry dead .bar-hidden-rows rules',
        );
    });

    test('CSS no longer defines .peek-collapse-row interim rule', () => {
        assert.ok(
            !/\.peek-collapse-row\s*[{>:]/.test(css),
            'bundled stylesheet must not carry the interim .peek-collapse-row rule',
        );
    });

    test('CSS defines the new .viewer-divider affordance', () => {
        assert.ok(
            css.includes('.viewer-divider'),
            'plan-048 .viewer-divider rule must be present',
        );
    });

    test('CSS defines the new .dedup-badge affordance', () => {
        assert.ok(
            css.includes('.dedup-badge'),
            'plan-048 .dedup-badge rule must be present',
        );
    });

    test('CSS defines the new .stack-toggle affordance', () => {
        assert.ok(
            css.includes('.stack-toggle'),
            'plan-048 .stack-toggle rule must be present',
        );
    });
});

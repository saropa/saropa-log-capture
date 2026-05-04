/**
 * Regression tests for the severity-gutter decoupling rework.
 * Plan: bugs/048_plan-severity-gutter-decoupling.md.
 *
 * The severity column shows severity. It does not accept clicks. Each of
 * the four expand/collapse concepts (filter-hidden gap, expanded peek
 * group, dedup-fold survivor, collapsed/preview stack) gets its own
 * dedicated affordance with its own visible vocabulary, and the collapse
 * control for any given expansion is geometrically separated from the
 * expand control that opened it.
 *
 * Companion suites: viewer-peek-chevron.test.ts (delegate routing) and
 * viewer-severity-bar-connector.test.ts (connector + retired classes).
 */
import * as assert from 'node:assert';
import { getDecorationStyles } from '../../ui/viewer-styles/viewer-styles-decoration';
import { getCollapseControlStyles } from '../../ui/viewer-styles/viewer-styles-collapse-controls';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getDividerRenderScript } from '../../ui/viewer/viewer-data-divider';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';
import { getStackHeaderRenderScript } from '../../ui/viewer/viewer-data-helpers-render-stack';
import { getPeekChevronScript } from '../../ui/viewer/viewer-peek-chevron';

suite('Principle 1: severity gutter is read-only (no click handler, no toggle class)', () => {
    const css = getDecorationStyles();
    const viewport = getViewportRenderScript();
    const peek = getPeekChevronScript();

    test('severity-dot ::before rule has no cursor:pointer', () => {
        // The dot is decorative. cursor:pointer would falsely advertise it
        // as an interactive control — the exact misread plan 048 fixes.
        const dotRuleIdx = css.indexOf('[class*="level-bar-"]::before');
        assert.ok(dotRuleIdx >= 0, 'severity dot rule must exist');
        const dotRuleBlock = css.substring(dotRuleIdx, dotRuleIdx + 800);
        assert.ok(
            !/cursor\s*:\s*pointer/.test(dotRuleBlock),
            'severity dot ::before must not declare cursor:pointer',
        );
    });

    test('render loop emits no .bar-hidden-rows class on log rows', () => {
        // The four-way overload that made the gutter interactive is retired.
        assert.ok(
            !viewport.includes('bar-hidden-rows'),
            'render loop must not stamp the retired .bar-hidden-rows class',
        );
    });

    test('click delegate references no severity-gutter selector', () => {
        // Pre-plan-048 the delegate hooked .bar-hidden-rows directly. Now
        // it scopes only to the dedicated affordances.
        assert.ok(
            !peek.includes('bar-hidden-rows'),
            'click delegate must not reference the severity-gutter overload',
        );
    });
});

suite('Principle 2: each concept has its own affordance', () => {
    const ctlCss = getCollapseControlStyles();

    test('CSS defines .viewer-divider for filter gaps + peek brackets + preview frames', () => {
        assert.ok(ctlCss.includes('.viewer-divider'), 'plan-048 .viewer-divider rule must exist');
        assert.ok(
            ctlCss.includes('.viewer-divider-label'),
            '.viewer-divider must carry an inner label element for the count + reason text',
        );
    });

    test('CSS defines .dedup-badge for dedup-fold survivors', () => {
        assert.ok(ctlCss.includes('.dedup-badge'), 'plan-048 .dedup-badge rule must exist');
        assert.ok(
            ctlCss.includes('.dedup-badge.dedup-badge-expanded'),
            '.dedup-badge must have an expanded-state variant so collapse vs expand reads visually',
        );
    });

    test('CSS defines .stack-toggle for stack-header chevrons', () => {
        assert.ok(ctlCss.includes('.stack-toggle'), 'plan-048 .stack-toggle rule must exist');
    });

    test('divider does not render its own gutter dot when bridged by connectors', () => {
        // Bridge logic adds level-bar-* to interleaved children. The CSS
        // rule below suppresses the dot on dividers that pick it up so the
        // control row is not visually mistaken for a log line.
        assert.ok(
            ctlCss.includes('.viewer-divider[class*="level-bar-"]::before'),
            'divider must suppress its bar dot when bridged',
        );
        assert.ok(
            /\.viewer-divider\[class\*="level-bar-"\]::before\s*{\s*display:\s*none/.test(ctlCss),
            'suppression rule must hide the bar dot via display:none',
        );
    });
});

suite('Principle 3: collapse controls live at the END of the revealed range', () => {
    const divider = getDividerRenderScript();
    const viewport = getViewportRenderScript();

    test('peek divider builder accepts a position arg so the trailing label can read "above"', () => {
        assert.ok(
            divider.includes('data-peek-pos="\' + pos + \'"'),
            'divider must record start vs end position for label phrasing',
        );
        assert.ok(
            divider.includes("'end'") && divider.includes('above'),
            'end-position label must include "above" wording so the user knows it collapses upward',
        );
    });

    test('render loop emits trailing divider after the last row of a peek group', () => {
        // _peekLast detection compares allLines[i+1].peekAnchorKey against
        // the current key — the row whose successor breaks the key is the
        // last of the group, and that's where the trailing divider goes.
        assert.ok(
            viewport.includes('allLines[i + 1].peekAnchorKey !== _pk'),
            'last-of-peek detection must check the next allLines item key',
        );
        assert.ok(
            viewport.includes("buildPeekHideDivider(_pk, countPeekedLines(_pk), 'end')"),
            'trailing divider must call buildPeekHideDivider with end position',
        );
    });
});

suite('Dedup badge state machine: collapsed shows ×N, expanded shows ×N hide', () => {
    const renderChunk = getViewerDataHelpersRender();
    const stackChunk = getStackHeaderRenderScript();

    test('renderItem emits the collapsed badge label when no peekAnchorKey', () => {
        // _dupLabel = '×' + count + (expanded ? ' hide' : '')
        assert.ok(
            renderChunk.includes("(_dupExpanded ? ' hide' : '')"),
            'renderItem dedup badge must mutate label based on expansion state',
        );
        assert.ok(
            renderChunk.includes('item.peekAnchorKey !== undefined'),
            'expansion detection must read the survivor\'s peekAnchorKey',
        );
    });

    test('renderItem emits the expanded class variant when peeked', () => {
        assert.ok(
            renderChunk.includes("'dedup-badge dedup-badge-expanded'"),
            'expanded badge must carry the dedup-badge-expanded class for visual emphasis',
        );
    });

    test('renderItem badge carries data-dedup-survivor-idx for the click delegate', () => {
        assert.ok(
            renderChunk.includes('data-dedup-survivor-idx="\' + idx + \'"'),
            'badge must carry the survivor index so peekDedupFold knows which list to reveal',
        );
    });

    test('renderStackFrame emits the same badge pattern for cross-type dedup', () => {
        assert.ok(
            stackChunk.includes("(_sfExpanded ? ' hide' : '')")
                && stackChunk.includes('data-dedup-survivor-idx'),
            'stack-frame dedup-survivor must emit the same .dedup-badge as plain rows',
        );
    });
});

suite('Stack chevron parity: ▶ for collapsed/preview, ▼ for fully expanded', () => {
    const stackChunk = getStackHeaderRenderScript();

    test('chevron glyph differs between collapsed and expanded states', () => {
        // u25b6 = ▶, u25bc = ▼. Two distinct glyphs so the user can tell
        // state at a glance, IDE / debugger / file-tree convention.
        assert.ok(
            stackChunk.includes('\\u25b6') && stackChunk.includes('\\u25bc'),
            'header must use ▶ for collapsed/preview and ▼ for expanded',
        );
    });

    test('chevron is rendered as an inline .stack-toggle element inside the header text', () => {
        assert.ok(
            stackChunk.includes('<span class="stack-toggle"'),
            'chevron must be an inline span so it sits in the header text, not the gutter',
        );
        assert.ok(
            stackChunk.includes('data-gid="\' + item.groupId + \'"'),
            'chevron must carry data-gid so a click on the chevron alone still resolves the group',
        );
    });

    test('stack-header no longer carries .bar-hidden-rows', () => {
        assert.ok(
            !stackChunk.includes('bar-hidden-rows'),
            'stack-header must not stamp the retired .bar-hidden-rows class',
        );
    });
});

suite('Preview-mode trimmed-frame divider', () => {
    const divider = getDividerRenderScript();
    const stackChunk = getStackHeaderRenderScript();

    test('stack-frame branch no longer carries preview-mode .bar-hidden-rows wiring', () => {
        // Detection moved to viewer-data-divider.ts (getPreviewModeHiddenInfo).
        assert.ok(
            !stackChunk.includes('previewCount'),
            'renderStackFrame must not duplicate preview-mode detection — moved to divider helper',
        );
        assert.ok(
            !stackChunk.includes('sfPrevCls'),
            'renderStackFrame must not stamp the retired .bar-hidden-rows preview class',
        );
    });

    test('getPreviewModeHiddenInfo lives in the divider helper module', () => {
        assert.ok(
            divider.includes('function getPreviewModeHiddenInfo('),
            'preview-mode detection must be the divider helper\'s responsibility',
        );
    });
});

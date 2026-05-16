/**
 * Regression tests for the severity-gutter / collapse-affordance design.
 *
 * The severity column shows severity. It does not accept clicks. Each
 * expand / collapse concept on a regular log row routes through a single
 * affordance: the `.deco-counter-row` chevron in the line-number column
 * (see viewer-data-divider.ts and viewer-peek-chevron.test.ts). Stack-
 * header rows keep their own inline `.stack-toggle` because they have
 * no line-number prefix to host a counter-row chevron.
 *
 * Companion suites: viewer-peek-chevron.test.ts (counter-row routing) and
 * viewer-severity-bar-connector.test.ts (chain stripe + retired classes).
 */
import * as assert from 'node:assert';
import { getDecorationStyles } from '../../ui/viewer-styles/viewer-styles-decoration';
import { getCollapseControlStyles } from '../../ui/viewer-styles/viewer-styles-collapse-controls';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getStackHeaderRenderScript } from '../../ui/viewer/viewer-data-helpers-render-stack';
import { getPeekChevronScript } from '../../ui/viewer/viewer-peek-chevron';

suite('Severity gutter is read-only — no click handler, no toggle class', () => {
    const css = getDecorationStyles();
    const viewport = getViewportRenderScript();
    const peek = getPeekChevronScript();

    test('severity-dot ::before rule has no cursor:pointer', () => {
        // The dot is decorative. cursor:pointer would falsely advertise it
        // as an interactive control.
        const dotRuleIdx = css.indexOf('[class*="level-bar-"]::before');
        assert.ok(dotRuleIdx >= 0, 'severity dot rule must exist');
        const dotRuleBlock = css.substring(dotRuleIdx, dotRuleIdx + 800);
        assert.ok(
            !/cursor\s*:\s*pointer/.test(dotRuleBlock),
            'severity dot ::before must not declare cursor:pointer',
        );
    });

    test('render loop emits no .bar-hidden-rows class on log rows', () => {
        assert.ok(
            !viewport.includes('bar-hidden-rows'),
            'render loop must not stamp the retired .bar-hidden-rows class',
        );
    });

    test('click delegate references no severity-gutter selector', () => {
        assert.ok(
            !peek.includes('bar-hidden-rows'),
            'click delegate must not reference the severity-gutter overload',
        );
    });
});

suite('Affordance CSS: counter-row chevron replaces divider + dedup-badge', () => {
    const ctlCss = getCollapseControlStyles();

    test('CSS defines .deco-counter-row + .deco-chevron for regular log rows', () => {
        assert.ok(ctlCss.includes('.deco-counter-row'), 'counter-row wrapper rule must exist');
        assert.ok(ctlCss.includes('.deco-chevron'), 'chevron child rule must exist');
    });

    test('retired affordances absent: no .viewer-divider, no .dedup-badge, no .stack-toggle rules', () => {
        // All three were replaced by the counter-row chevron (with the
        // 'stack' kind routing trace toggles to the previous log line).
        // Re-introducing any would recreate the overlap / floating-pill /
        // mid-row-clutter problems the user reported.
        assert.ok(
            !ctlCss.includes('.viewer-divider'),
            '.viewer-divider rule must be removed — between-row pills caused tag-column overlap',
        );
        assert.ok(
            !ctlCss.includes('.dedup-badge'),
            '.dedup-badge rule must be removed — trailing pill replaced by counter-row chevron',
        );
        assert.ok(
            !ctlCss.includes('.stack-toggle'),
            '.stack-toggle rule must be removed — inline ▶ stack chip replaced by previous-line counter-row chevron',
        );
    });
});

suite('Stack-header rendering: no inline chevron, plain text only', () => {
    const stackChunk = getStackHeaderRenderScript();

    test('stack-header emits no inline .stack-toggle span', () => {
        // The toggle moved to the previous log line's counter-row chevron
        // (data-affordance-kind="stack"). The stack-header is plain text;
        // click anywhere on the row still toggles via the whole-row
        // .stack-header[data-gid] handler in viewer-script-click-handlers.ts.
        assert.ok(
            !stackChunk.includes('<span class="stack-toggle"'),
            'stack-header must not emit the retired inline .stack-toggle chip',
        );
    });

    test('stack-header still uses ▶ / ▼ glyphs in its hover tooltip text', () => {
        // The chevron itself moved off the header, but the tooltip text
        // (rendered server-side into hdrTitleAttr) can still describe
        // state with glyphs the user knows.
        assert.ok(
            stackChunk.includes('\\u25b6') && stackChunk.includes('\\u25bc'),
            'header tooltip / glyph computation must still distinguish ▶ vs ▼ state',
        );
    });

    test('stack-header does not stamp the retired .bar-hidden-rows class', () => {
        assert.ok(
            !stackChunk.includes('bar-hidden-rows'),
            'stack-header must not stamp the retired .bar-hidden-rows class',
        );
    });
});

suite('Render loop no longer emits between-row divider rows', () => {
    const viewport = getViewportRenderScript();

    test('render loop does not call any divider builders', () => {
        // The three between-row builders (buildHiddenGapDivider /
        // buildPeekHideDivider / buildPreviewFramesDivider) were retired
        // because the labels overlapped adjacent rows' tag chips and
        // multiple dividers stacked at the same row boundary. All three
        // cases are now surfaced via the row's own counter-row chevron.
        assert.ok(
            !viewport.includes('buildHiddenGapDivider('),
            'render loop must not push between-row gap dividers',
        );
        assert.ok(
            !viewport.includes('buildPeekHideDivider('),
            'render loop must not push between-row peek-collapse dividers',
        );
        assert.ok(
            !viewport.includes('buildPreviewFramesDivider('),
            'render loop must not push between-row preview-frame dividers',
        );
    });

    test('render loop calls computeRowAffordances before the DOM build', () => {
        // The pre-pass stamps _hiddenAfter / _triggeredPeekKey on each
        // visible row so renderItem → getDecorationPrefix can emit the
        // correct counter-row chevron without scanning forward.
        assert.ok(
            viewport.includes('computeRowAffordances()'),
            'render loop must invoke the affordance pre-pass each render',
        );
    });
});

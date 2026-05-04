/**
 * Tests for severity bar connector logic and hidden-lines chevron.
 *
 * Covers the viewport rendering script: same-level dot joining, blank-line
 * skipping, hidden-lines chevron insertion, and tooltip reason aggregation.
 * Uses string-includes assertions on the generated webview JS (same pattern
 * as viewer-data-helpers-render-fw-muted.test.ts).
 */
import * as assert from 'node:assert';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';
import { getStackHeaderRenderScript as getStackRenderScript } from '../../ui/viewer/viewer-data-helpers-render-stack';
import { getDecorationStyles } from '../../ui/viewer-styles/viewer-styles-decoration';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';

suite('Severity bar connector (same-level joining)', () => {
    const viewportScript = getViewportRenderScript();

    test('should use findNextDotSibling instead of findNextBarSibling', () => {
        assert.ok(
            viewportScript.includes('function findNextDotSibling('),
            'viewport script must define findNextDotSibling',
        );
        assert.ok(
            !viewportScript.includes('function findNextBarSibling('),
            'old findNextBarSibling must be removed',
        );
    });

    test('should skip blank lines when finding next dot', () => {
        assert.ok(
            viewportScript.includes("classList.contains('line-blank')"),
            'findNextDotSibling must skip blank lines',
        );
    });

    test('should skip .viewer-divider sibling rows when finding the next dot', () => {
        // Plan 048 introduced .viewer-divider control rows interleaved among
        // log lines. They must not break the connector chain that joins
        // consecutive same-level dots, otherwise a divider in the middle of
        // a same-level run would visually slice the timeline in two.
        assert.ok(
            viewportScript.includes("classList.contains('viewer-divider')"),
            'findNextDotSibling must skip .viewer-divider so connectors bridge through them',
        );
    });

    test('should no longer reference the retired indicator classes', () => {
        // The unified-line-collapsing rethink retired .hidden-chevron / .peek-collapse;
        // plan 048 retired the overloaded .bar-hidden-rows that succeeded them.
        assert.ok(
            !viewportScript.includes("classList.contains('hidden-chevron')"),
            'render loop must not reference the long-retired .hidden-chevron class',
        );
        assert.ok(
            !viewportScript.includes("classList.contains('peek-collapse')"),
            'render loop must not reference the long-retired .peek-collapse class',
        );
        assert.ok(
            !viewportScript.includes('class="bar-hidden-rows '),
            'render loop must not stamp the retired .bar-hidden-rows class on rows',
        );
    });

    test('should only connect dots with the same bar level', () => {
        assert.ok(
            viewportScript.includes('nextLvl !== lvl'),
            'connector loop must compare adjacent dot levels and skip mismatches',
        );
    });

    test('should still stop connector chain at markers', () => {
        assert.ok(
            viewportScript.includes("classList.contains('marker')"),
            'dot search must stop at markers to break connector chain at session boundaries',
        );
    });
});

suite('Hidden-lines chevron insertion', () => {
    const viewportScript = getViewportRenderScript();

    test('should define countHiddenNonBlank helper', () => {
        assert.ok(
            viewportScript.includes('function countHiddenNonBlank('),
            'viewport script must define countHiddenNonBlank',
        );
    });

    test('should skip blank lines in hidden count', () => {
        assert.ok(
            viewportScript.includes('isLineContentBlank(item)'),
            'countHiddenNonBlank must exclude blank lines',
        );
    });

    test('should cover all calcItemHeight filter flags in reason tracking', () => {
        // These flags are checked in calcItemHeight; countHiddenNonBlank must track each.
        const requiredFlags = [
            'levelFiltered', 'excluded', 'filteredOut', 'sourceFiltered',
            'searchFiltered', 'errorSuppressed', 'repeatHidden',
            'compressDupHidden', 'scopeFiltered', 'timeRangeFiltered',
            'classFiltered', 'sqlPatternFiltered',
        ];
        for (const flag of requiredFlags) {
            assert.ok(
                viewportScript.includes(`item.${flag}`),
                `countHiddenNonBlank must check item.${flag}`,
            );
        }
    });

    test('should check userHidden and autoHidden for manual/auto-hide', () => {
        assert.ok(
            viewportScript.includes('item.userHidden') && viewportScript.includes('item.autoHidden'),
            'must check both userHidden and autoHidden flags',
        );
    });

    test('should check tier-based filter via isTierHidden', () => {
        assert.ok(
            viewportScript.includes('isTierHidden'),
            'must check tier filter via isTierHidden function',
        );
    });

    test('should define buildHiddenTip for tooltip formatting', () => {
        assert.ok(
            viewportScript.includes('function buildHiddenTip('),
            'viewport script must define buildHiddenTip',
        );
    });

    test('should push a .viewer-divider row when a filter-hidden gap exists', () => {
        // Plan 048 (bugs/048_plan-severity-gutter-decoupling.md): the
        // .bar-hidden-rows overload on the row AFTER the gap was retired.
        // The render loop now pushes a dedicated .viewer-divider sibling
        // row carrying the count + click target. See viewer-data-divider.ts
        // for the divider HTML; here we only pin that the render loop calls
        // the builder when prevVisIdx leaves a gap.
        assert.ok(
            viewportScript.includes('buildHiddenGapDivider(_hiddenFrom, _hiddenTo, _hInfo)'),
            'render loop must call buildHiddenGapDivider on a detected gap',
        );
    });

    test('should use prevVisIdx to detect gaps between visible lines', () => {
        assert.ok(
            viewportScript.includes('prevVisIdx'),
            'render loop must track previous visible line index',
        );
    });

    test('should build singular/plural tooltip text', () => {
        // "1 hidden line" vs "N hidden lines"
        assert.ok(
            viewportScript.includes("n !== 1 ? 's' : ''"),
            'buildHiddenTip must pluralise correctly',
        );
    });
});

suite('renderItem blank-line bar class removal', () => {
    const renderChunk = getViewerDataHelpersRender();

    test('should not inherit bar class from previous line for blank lines', () => {
        // Before: blank lines inherited level-bar-* via `var prevLn = allLines[idx - 1]`.
        // After: blank lines get no bar class; the bridge logic in renderViewport() handles it.
        // The `prevLn` variable was only used for blank-line bar inheritance.
        assert.ok(
            !renderChunk.includes('prevLn'),
            'renderItem must not use prevLn for blank-line bar class inheritance',
        );
    });

    test('should still assign bar class for non-blank lines with a level', () => {
        assert.ok(
            renderChunk.includes("barCls = ' level-bar-' + item.level"),
            'non-blank lines must still get level-bar-{level} class',
        );
    });

    test('should still preserve tint inheritance for blank lines', () => {
        // Tint CSS class (line-tint-*) is separate from bar class.
        assert.ok(
            renderChunk.includes("tintCls = ' line-tint-' + allLines[idx - 1].level"),
            'blank line tint must still inherit from previous line',
        );
    });
});

suite('Stack level inheritance from parent line', () => {
    const addScript = getViewerDataAddScript();

    test('should define previousLineLevel helper', () => {
        assert.ok(
            addScript.includes('function previousLineLevel('),
            'addToData script must define previousLineLevel',
        );
    });

    test('should use previousLineLevel for stack-header level', () => {
        /* The header stores level: _hdrLevel, where _hdrLevel = previousLineLevel().
           The indirection exists so the same backward-scan result feeds both the
           level property and the isTierHidden warnplus check. */
        assert.ok(
            addScript.includes('var _hdrLevel = previousLineLevel()'),
            'stack-header level must come from previousLineLevel() via _hdrLevel',
        );
        assert.ok(
            addScript.includes('level: _hdrLevel'),
            'stack-header must store level from _hdrLevel',
        );
    });

    test('should use activeGroupHeader.level for stack-frame level', () => {
        assert.ok(
            addScript.includes('level: activeGroupHeader.level'),
            'stack-frame must inherit level from its group header',
        );
    });

    test('should not hardcode error level for stack items', () => {
        // Count occurrences of level: 'error' — should only appear in the
        // previousLineLevel fallback, not in stack-frame or stack-header creation.
        const lines = addScript.split('\n');
        const hardcodedInItems = lines.filter(l =>
            l.includes("level: 'error'") &&
            !l.includes('return') &&
            !l.includes('//'),
        );
        assert.strictEqual(
            hardcodedInItems.length, 0,
            'no stack item should hardcode level: \'error\' — found: ' + hardcodedInItems.join(' | '),
        );
    });

    test('should fall back to error when previous line is a marker', () => {
        assert.ok(
            addScript.includes("it.type === 'marker'") &&
            addScript.includes("return 'error'"),
            'previousLineLevel must return error when hitting a marker boundary',
        );
    });
});

suite('Stack header level CSS class in renderItem', () => {
    /* Stack-header rendering was extracted to viewer-data-helpers-render-stack.ts
       as part of the unified line-collapsing rethink (keeps the parent file under
       the 300-line eslint max-lines limit). The level-class and class-list
       assertions now target that module's output. */
    const renderChunk = getStackRenderScript();

    test('should apply level class to stack-header div, gated on !item.isContext', () => {
        // Commit e2522420 added the !item.isContext guard so context-pulled
        // headers mute via .context-line instead of carrying a full-color
        // level- class. See viewer-context-line-muting.test.ts for the
        // dedicated regression test on this behavior.
        assert.ok(
            renderChunk.includes("hdrLevelCls = (item.level && !item.isContext) ? ' level-' + item.level : ''"),
            'stack-header renderer must compute hdrLevelCls from item.level when !isContext',
        );
    });

    test('should include hdrLevelCls in stack-header class list', () => {
        assert.ok(
            renderChunk.includes("stack-header' + hdrLevelCls + matchCls"),
            'stack-header div must include the level class before other class concatenations',
        );
    });
});

suite('Retired indicator classes are fully removed', () => {
    /* Three generations of retired indicator classes:
       1. .hidden-chevron (▼) and .peek-collapse (−) — the original
          inline glyphs. Retired by the 2026.04 unified-line-collapsing
          rethink.
       2. .bar-hidden-rows — the overloaded outlined-dot state that
          replaced them. Retired by plan 048 because the dot looked
          identical for "click to expand" and "click to collapse".
       3. .peek-collapse-row — the interim sibling pill from the surgical
          fix in commit 4a4d1590. Replaced by the trailing .viewer-divider
          on expanded peek groups under plan 048.
       This suite pins all three so a future refactor cannot quietly
       resurrect any of them. */
    const css = getDecorationStyles();

    test('should no longer define .hidden-chevron rules', () => {
        // Match an active selector usage (followed by `{`, ` >`, `:hover`, etc.).
        // Mere mentions in comments / migration notes are allowed.
        assert.ok(
            !/\.hidden-chevron\s*[{>:]/.test(css),
            'CSS must not contain any active .hidden-chevron rule',
        );
    });

    test('should no longer define .peek-collapse rules', () => {
        assert.ok(
            !/\.peek-collapse\s*[{>:]/.test(css),
            'CSS must not contain any active .peek-collapse rule',
        );
    });

    test('should no longer define .bar-hidden-rows rules', () => {
        assert.ok(
            !/\.bar-hidden-rows\s*[{>:]/.test(css)
                && !/\.bar-hidden-rows::before/.test(css),
            'CSS must not carry the retired overloaded .bar-hidden-rows state',
        );
    });

    test('should define the new .viewer-divider affordance', () => {
        assert.ok(
            css.includes('.viewer-divider'),
            'plan-048 .viewer-divider rule must replace .bar-hidden-rows',
        );
    });
});

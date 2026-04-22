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

    test('should not reference the retired .hidden-chevron / .peek-collapse classes', () => {
        // Unified line-collapsing rethink retired both indicator elements — the
        // render loop no longer emits them and the post-pass no longer skips them.
        // findNextDotSibling just scans for dot-carrying rows; nothing to skip.
        assert.ok(
            !viewportScript.includes("classList.contains('hidden-chevron')"),
            'findNextDotSibling must not reference the retired .hidden-chevron class',
        );
        assert.ok(
            !viewportScript.includes("classList.contains('peek-collapse')"),
            'bar-bridge loop must not reference the retired .peek-collapse class',
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

    test('should stamp .bar-hidden-rows + tooltip on the row after a hidden gap', () => {
        // Unified line-collapsing (bugs/unified-line-collapsing.md): the old
        // .hidden-chevron DIV was retired. The outlined-dot state is now
        // represented by injecting .bar-hidden-rows + data-hidden-from/to + title
        // onto the outer <div class="..."> of the visible row that FOLLOWS the
        // hidden gap. No separate indicator element is emitted.
        assert.ok(
            viewportScript.includes('class="bar-hidden-rows '),
            'render loop must inject .bar-hidden-rows onto the row after a hidden gap',
        );
        assert.ok(
            viewportScript.includes('title="' + "'"),
            'tooltip must be set on the row outer div so hover works anywhere on the row',
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

    test('should apply level class to stack-header div', () => {
        assert.ok(
            renderChunk.includes("hdrLevelCls = item.level ? ' level-' + item.level : ''"),
            'stack-header renderer must compute hdrLevelCls from item.level',
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
    // The unified line-collapsing rethink retired the .hidden-chevron (▼) and
    // .peek-collapse (−) elements in favour of the outlined severity dot state
    // (.bar-hidden-rows). The CSS blocks and their usages are removed so the
    // bundled webview stylesheet does not ship dead rules.
    const css = getDecorationStyles();

    test('should no longer define .hidden-chevron rules', () => {
        // Match an active selector usage (followed by `{`, ` >`, `:hover`, etc.).
        // Mere mentions in comments / migration notes are allowed.
        assert.ok(
            !/\.hidden-chevron\s*[{>:]/.test(css),
            'CSS must not contain any active .hidden-chevron rule after the rethink',
        );
    });

    test('should no longer define .peek-collapse rules', () => {
        assert.ok(
            !/\.peek-collapse\s*[{>:]/.test(css),
            'CSS must not contain any active .peek-collapse rule after the rethink',
        );
    });

    test('should still define the replacement .bar-hidden-rows state', () => {
        assert.ok(
            css.includes('.bar-hidden-rows'),
            'unified outlined-dot state must be present',
        );
    });
});

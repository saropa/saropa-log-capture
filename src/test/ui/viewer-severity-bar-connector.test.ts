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
import { getViewerStyles } from '../../ui/viewer-styles/viewer-styles';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';

suite('Severity bar connector (CSS sibling architecture)', () => {
    // The connector that joins consecutive same-level dots is now pure CSS in
    // viewer-styles-decoration-bars.ts, using :has(+ .level-bar-X)::after on
    // each row. The previous JS architecture (findNextDotSibling + bar-up /
    // bar-down / bar-bridge stamping in the render loop) is fully removed —
    // it had multiple drift bugs (the chain extending across colour changes,
    // the stripe's --bar-color disagreeing with the dot's). These tests pin
    // the new architecture.
    const viewportScript = getViewportRenderScript();
    const decoStyles = getDecorationStyles();

    test('viewport script no longer contains the retired chain helpers', () => {
        assert.ok(
            !viewportScript.includes('function findNextDotSibling('),
            'findNextDotSibling was JS chain machinery — replaced by CSS sibling selectors',
        );
        assert.ok(
            !viewportScript.includes('function getBarLevel('),
            'getBarLevel was used only by the chain loop — no longer needed',
        );
        assert.ok(
            !/classList\.add\([^)]*['"]bar-up['"]/.test(viewportScript),
            'render loop must not stamp .bar-up — chain is now CSS-only',
        );
        assert.ok(
            !/classList\.add\([^)]*['"]bar-down['"]/.test(viewportScript),
            'render loop must not stamp .bar-down — chain is now CSS-only',
        );
        assert.ok(
            !/classList\.add\([^)]*['"]bar-bridge['"]/.test(viewportScript),
            'render loop must not stamp .bar-bridge — chain is now CSS-only',
        );
    });

    test('CSS defines a :has(+ same-level)::after connector for every level', () => {
        // One rule per level — CSS has no "same class as me" combinator, so
        // each level gets its own selector. All ten levels must be present
        // or those rows visually break out of the chain.
        const levels = [
            'error',
            'error-recent-context',
            'warning',
            'performance',
            'todo',
            'debug',
            'notice',
            'framework',
            'database',
            'info',
        ];
        for (const lvl of levels) {
            // The selector for level X must include `:has(+ .level-bar-X)` —
            // that's the sibling-aware check the browser uses to decide
            // whether to paint the chain stripe from this dot to the next.
            assert.ok(
                decoStyles.includes(`:has(+ .level-bar-${lvl})`),
                `connector CSS must include a :has(+ .level-bar-${lvl}) sibling rule`,
            );
        }
    });

    test('connector ::after geometry matches the dot column', () => {
        // The stripe is anchored at this row's middle (top: 50%) and extends
        // 50% PAST the row's bottom edge (bottom: -50%). Net: it spans from
        // this dot to where the next row's dot sits (50% into the next row).
        // Using percentages rather than a calc on --log-line-height so the
        // stripe automatically scales with whatever row height the parent
        // produces, including blank rows and lines with custom line-height.
        assert.ok(
            /left:\s*0\.89em/.test(decoStyles),
            'connector left position must remain at 0.89em (under the dot)',
        );
        assert.ok(
            /width:\s*0\.14em/.test(decoStyles),
            'connector width must remain at 0.14em',
        );
        assert.ok(
            /top:\s*50%/.test(decoStyles),
            'connector must be anchored at the row middle (top: 50%)',
        );
        assert.ok(
            /bottom:\s*-50%/.test(decoStyles),
            'connector reaches exactly to next row\'s middle (bottom: -50%); requires uniform row heights, which stack-header now provides by matching .line\'s line-height var(--log-line-height)',
        );
    });

    test('connector excludes ASCII-art rows so shimmer animation is preserved', () => {
        // viewer-styles-ascii-art.ts uses ::after for a shimmer keyframe
        // animation across art-block rows. The chain connector also targets
        // ::after; both rules on the same element would replace the shimmer
        // with a static stripe. The :not(:is(.art-block-start, .art-block-middle,
        // .art-block-end)) qualifier on the chain rule keeps art-block ::after
        // free for shimmer use. art-block rows already paint a continuous
        // border-left as their gutter rail.
        assert.ok(
            /:not\(:is\(\.art-block-start,\s*\.art-block-middle,\s*\.art-block-end\)\)/.test(decoStyles),
            'connector must exclude art-block rows so shimmer ::after is preserved',
        );
    });

    test('between-row divider rows are retired — chain spans naturally row-to-row', () => {
        // The .viewer-divider concept was retired alongside the move to
        // the counter-row chevron affordance. With no DOM rows between
        // visible log rows, the :has(+ .level-bar-X) selector on each
        // row finds its immediate neighbor directly — no divider stamping,
        // no chain bridging, no special-case CSS.
        const fullStyles = getViewerStyles();
        assert.ok(
            !fullStyles.includes('.viewer-divider'),
            'no .viewer-divider CSS rule should remain — counter-row chevron replaced it',
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
            'compressDupHidden', 'stackDedupHidden', 'scopeFiltered', 'timeRangeFiltered',
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

    test('filter-hidden gaps surface via _hiddenAfter pre-pass, not divider rows', () => {
        // Replaces the old buildHiddenGapDivider call: the counter-row
        // chevron on the row BEFORE the gap reads its _hiddenAfter stamp
        // (set by computeRowAffordances in viewer-data-divider.ts) and
        // routes the click to peekChevron.
        assert.ok(
            viewportScript.includes('computeRowAffordances()'),
            'render loop must invoke the affordance pre-pass each render',
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

    /* Note: the former 'skip recentErrorContext rows' test guarded a defensive
       skip inside previousLineLevel that mattered only when the 2 s proximity
       tint was painting lines as recentErrorContext. The tint is removed; no
       code path sets the flag to true anymore, so the skip is unnecessary.
       previousLineLevel still walks back to inherit a real level onto stack
       headers (covered by the marker-fallback test above). */
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

    test('stack-header gets its own .line-decoration prefix (line number + chevron)', () => {
        // Stack-headers now render through getDecorationPrefix like regular
        // log rows, so they get a clickable line-number column with a chevron.
        // The shared CSS rule .line:has(.line-decoration), .stack-header:has(.line-decoration)
        // in viewer-styles-decoration.ts gives them the same padding-left +
        // text-indent treatment, replacing the bespoke .line-deco-spacer-only
        // class that used to handle stack-header indent in isolation.
        assert.ok(
            renderChunk.includes('getDecorationPrefix(item, idx, null)'),
            'renderStackHeader must call getDecorationPrefix so the row gets a counter-row chevron',
        );
        // Stack-FRAMES still use line-deco-spacer-only (they don't render
        // their own decoration prefix); only the HEADER stops using it.
        // Verify by checking the renderStackHeader function specifically.
        const headerFnMatch = /function renderStackHeader\([^{]*\{[\s\S]*?\n\}/.exec(renderChunk);
        assert.ok(headerFnMatch, 'renderStackHeader function must exist');
        assert.ok(
            !headerFnMatch![0].includes('line-deco-spacer-only'),
            'line-deco-spacer-only must be retired from renderStackHeader — the shared :has(.line-decoration) rule handles it now',
        );
    });
});

suite('Stack header column alignment CSS', () => {
    const css = getDecorationStyles();

    test('legacy :has(.line-decoration) rule covers .line:not(.cols) and .stack-header', () => {
        // The legacy hanging-indent rule is now scoped to :not(.cols) (plan 055)
        // so rows migrated to the grid column model opt out, while un-migrated
        // paths — multi-frame stack-headers among them — still get the
        // padding-left + text-indent treatment, otherwise their text juts to the
        // left of the message column. Stack-headers are not yet on the grid.
        assert.ok(
            /\.line:not\(\.cols\):has\(\.line-decoration\)[^{]*\.stack-header:has\(\.line-decoration\)/.test(css),
            'the legacy padding-left rule must include both .line:not(.cols) and .stack-header selectors',
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

    test('should NOT define .viewer-divider (retired alongside dedup-badge)', () => {
        // The between-row .viewer-divider concept was retired when the
        // counter-row chevron took over filter-hidden / peek / preview
        // affordances. Re-introducing it would recreate the tag-column
        // overlap problem the user reported.
        assert.ok(
            !css.includes('.viewer-divider'),
            'no .viewer-divider CSS rule should remain — counter-row chevron replaced it',
        );
    });
});

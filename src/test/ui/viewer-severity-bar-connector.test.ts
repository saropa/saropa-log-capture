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
import { getLineStyles } from '../../ui/viewer-styles/viewer-styles-lines';
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
        // The stripe must be anchored at the row's middle (top: 50%) so it
        // starts where the dot sits, and extend by one row-height-em downward
        // so it reaches the next row's middle (where the next dot sits).
        // Width and left position match the prior stripe and the dot column
        // so the chain reads as a single column.
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
            /height:\s*calc\(1em \* var\(--log-line-height/.test(decoStyles),
            'connector height must scale with --log-line-height so blank rows still reach the next dot',
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

    test('viewer-divider rows participate in chain (::after paints, ::before suppressed)', () => {
        // Dividers (filter-gap, peek-hide, preview-frames) get stamped with
        // the surrounding chain level at render time in viewer-data-viewport.ts.
        // That lets the :has(+ .level-bar-X) selector on the row ABOVE find
        // a matching neighbor and the chain stripe extend through the gap.
        // The divider's own ::after also paints (continuing the chain to the
        // row below). The dot ::before stays suppressed — the divider is a
        // control, not a log line.
        const fullStyles = getViewerStyles();
        assert.ok(
            /\.viewer-divider\[class\*="level-bar-"\]::before\s*\{[^}]*display:\s*none/.test(fullStyles),
            'viewer-divider dot (::before) must stay suppressed even when divider has a level-bar-* class',
        );
        // Conversely, no rule should force ::after to display:none on dividers
        // — that would break the chain through them.
        assert.ok(
            !/\.viewer-divider\[class\*="level-bar-"\]::after\s*\{[^}]*display:\s*none/.test(fullStyles),
            'viewer-divider ::after must NOT be hidden — that would break the chain across gap dividers',
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

    test('should push a .viewer-divider row when a filter-hidden gap exists', () => {
        // Plan 048 (bugs/048_plan-severity-gutter-decoupling.md): the
        // .bar-hidden-rows overload on the row AFTER the gap was retired.
        // The render loop now pushes a dedicated .viewer-divider sibling
        // row carrying the count + click target. See viewer-data-divider.ts
        // for the divider HTML; here we only pin that the render loop calls
        // the builder when prevVisIdx leaves a gap.
        assert.ok(
            viewportScript.includes('buildHiddenGapDivider(_hiddenFrom, _hiddenTo, _hInfo, _chainLvl)'),
            'render loop must call buildHiddenGapDivider on a detected gap (with chain level)',
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

    test('should skip recentErrorContext rows when walking back for header level', () => {
        assert.ok(
            addScript.includes('function previousLineLevel(') && addScript.includes('if (it.recentErrorContext) continue'),
            'previousLineLevel must not inherit level from proximity-promoted context lines',
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

    test('should align the stack header to the content column when decorations are on', () => {
        // A stack header carries no .line-decoration prefix, so without help it
        // sits at the bare .stack-header padding-left (16px) while decorated log
        // lines start at --deco-prefix-width-em (~14.25em) — the header jutted
        // far left of the message column and read as broken. hdrDecoCls adds
        // line-deco-spacer-only (the same affordance repeat-notification chips
        // use) so the header lands in the content column. Gated on
        // areDecorationsOn() because with decorations off there is no column.
        assert.ok(
            renderChunk.includes('areDecorationsOn') && renderChunk.includes('line-deco-spacer-only'),
            'renderStackHeader must add line-deco-spacer-only when areDecorationsOn()',
        );
        assert.ok(
            renderChunk.includes('hdrCtxCls + hdrDecoCls'),
            'hdrDecoCls must be concatenated into the stack-header class list',
        );
    });
});

suite('Stack header column alignment CSS', () => {
    const css = getLineStyles();

    test('should reserve the decoration-column padding for stack headers', () => {
        // Pairs with the renderStackHeader hdrDecoCls test above: the rendered
        // class is inert without a CSS rule binding it to the deco-column width.
        assert.ok(
            css.includes('.stack-header.line-deco-spacer-only'),
            'viewer-styles-lines must give .stack-header.line-deco-spacer-only the deco-column padding-left',
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

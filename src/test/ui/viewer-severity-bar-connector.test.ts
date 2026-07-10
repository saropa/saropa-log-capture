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

suite('Severity bar connector (CSS per-color-group half-stripe architecture)', () => {
    // The connector joining consecutive dots is pure CSS in
    // viewer-styles-decoration-bars.ts and joins ONLY same-color dots. Each
    // leveled row has a collapsed ::after (centered on --gutter-cx); generated
    // per-color-group rules extend its bottom half toward the next dot
    // (g:has(+ g)) and its top half toward the previous dot (g + g) only when the
    // neighbor shares the color group, so a color change shows a clean break.
    // This replaced (2026-07-10) the full-height class-agnostic stripe, which
    // joined ADJACENT DIFFERENT colors at the shared row boundary (user: "you
    // regressed by joining NON-matching colors"); that stripe had itself replaced
    // an exact-class :has() chain that missed info/framework (same blue, different
    // class) and severed at any intervening row, which replaced the still-earlier
    // JS findNextDotSibling + bar-up/bar-down/bar-bridge stamping. Full history:
    // bugs/severity_dot_join_attempts.md. These tests pin the current architecture.
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

    test('connector joins by COLOR GROUP so only same-color dots connect', () => {
        // The join is gated on the neighbor's color group: a segment is drawn
        // toward the next/previous dot only when it shares the color. This is the
        // whole point — a full-height class-agnostic stripe (no :has/+ gate)
        // joined adjacent DIFFERENT colors at the row boundary.
        assert.ok(
            /:has\(\+ \.level-bar-warning\)::after\s*\{\s*bottom:\s*0/.test(decoStyles),
            'a row must connect DOWN only when the next sibling is the same color group',
        );
        assert.ok(
            /\.level-bar-warning \+ \.level-bar-warning::after\s*\{\s*top:\s*0/.test(decoStyles),
            'a row must connect UP only when the previous sibling is the same color group',
        );
        // info + framework are the SAME blue: they must be one color group, so a
        // mixed info/framework run still joins (the exact-class chain missed this).
        assert.ok(
            /:is\(\.level-bar-info,\s*\.level-bar-framework\):has\(\+ :is\(\.level-bar-info,\s*\.level-bar-framework\)\)::after/.test(decoStyles),
            'info and framework (same charts-blue) must share one color group in the connector',
        );
    });

    test('error and error-recent-context are separate color groups (never bridged)', () => {
        // The two error shades are DIFFERENT colors (full red vs a muted red mixed
        // toward the panel border). They must not join into one band — this is the
        // same "don't bridge different colors" contract as yellow-vs-blue, and the
        // one case where the two class names share a prefix, so it is pinned
        // explicitly against a substring-style regression.
        assert.ok(
            /\.level-bar-error:has\(\+ \.level-bar-error\)::after\s*\{\s*bottom:\s*0/.test(decoStyles),
            'plain error has its own join group',
        );
        assert.ok(
            /\.level-bar-error-recent-context:has\(\+ \.level-bar-error-recent-context\)::after\s*\{\s*bottom:\s*0/.test(decoStyles),
            'recent-error context has its own join group (its own muted color)',
        );
        assert.ok(
            !/\.level-bar-error:has\(\+ \.level-bar-error-recent-context\)/.test(decoStyles)
                && !/\.level-bar-error-recent-context:has\(\+ \.level-bar-error\)::after/.test(decoStyles),
            'the two error shades are different colors and must never bridge into one band',
        );
    });

    test('every colored gutter class is joined in a connector group (completeness)', () => {
        // Guard against adding a new .level-bar-X (with its own --bar-color) while
        // forgetting to add it to barColorGroups — its dots would then silently
        // never join. Every class that declares --bar-color must appear in a
        // generated connector rule (a line carrying :has(+ ...)).
        const colorClasses = [...decoStyles.matchAll(/\.(level-bar-[\w-]+)\s*\{\s*--bar-color:/g)].map((m) => m[1]);
        assert.ok(colorClasses.length >= 10, `expected the full set of gutter color classes, found ${colorClasses.length}`);
        const joinRules = decoStyles.split('\n').filter((l) => l.includes(':has(+')).join('\n');
        for (const cls of colorClasses) {
            // (?![\w-]) boundary so .level-bar-error does not match inside
            // .level-bar-error-recent-context (the shared-prefix trap).
            const re = new RegExp('\\.' + cls + '(?![\\w-])');
            assert.ok(re.test(joinRules), `gutter class .${cls} is not joined in any connector group — add it to barColorGroups`);
        }
    });

    test('base connector ::after is collapsed and center-anchored on --gutter-cx', () => {
        // The base ::after paints NOTHING on its own (top:50%/bottom:50% => zero
        // height); only the per-group rules extend a half toward a same-color
        // neighbor. It is anchored on the shared --gutter-cx with translateX(-50%)
        // so the stripe and the dot compute their left edge from ONE reference and
        // cannot drift sub-pixel (the off-center-line report). The old absolute
        // left:0.89em / width:0.14em positioning is gone.
        const base = /\[class\*="level-bar-"\][^{]*::after\s*\{[^}]*\}/s.exec(decoStyles);
        assert.ok(base, 'expected the base [class*="level-bar-"]::after rule');
        assert.ok(/left:\s*var\(--gutter-cx\)/.test(base![0]), 'base stripe must anchor on --gutter-cx');
        assert.ok(/transform:\s*translateX\(-50%\)/.test(base![0]), 'base stripe must self-center with translateX(-50%)');
        assert.ok(/top:\s*50%/.test(base![0]) && /bottom:\s*50%/.test(base![0]),
            'base stripe must be collapsed (top:50%; bottom:50%) so it joins nothing until a same-color neighbor extends it');
        assert.ok(!/left:\s*0\.89em/.test(decoStyles), 'the absolute left:0.89em positioning must be gone (center-anchored now)');
        assert.ok(/#viewport\s*\{[^}]*--gutter-cx:/.test(decoStyles), '--gutter-cx must be defined on the positioning context');
    });

    test('the severity dot shares the connector center anchor (exact centering)', () => {
        // The dot ::before and the connector ::after both anchor on --gutter-cx
        // with translateX(-50%). Sharing one center is what guarantees the line
        // sits exactly under the dots regardless of their different widths.
        const dot = /\[class\*="level-bar-"\]::before\s*\{[^}]*\}/s.exec(decoStyles);
        assert.ok(dot, 'expected the dot ::before rule');
        assert.ok(/left:\s*var\(--gutter-cx\)/.test(dot![0]), 'dot must anchor on the same --gutter-cx');
        assert.ok(/transform:\s*translateX\(-50%\)/.test(dot![0]), 'dot must self-center with translateX(-50%)');
    });

    test('connector excludes ASCII-art rows so shimmer animation is preserved', () => {
        // viewer-styles-ascii-art.ts uses ::after for a shimmer keyframe
        // animation across art-block rows. The chain connector also targets
        // ::after; both rules on the same element would replace the shimmer
        // with a static stripe. The :not(:is(.art-block-start, .art-block-middle,
        // .art-block-end)) qualifier on the chain rule keeps art-block ::after
        // free for shimmer use. (Art blocks no longer paint a gutter rail at all —
        // the left border was removed because it broke the box layout.)
        // The exclusion list also carries .line-blank now (blank rows carry no
        // dot), so match up to .art-block-end without pinning the closing paren.
        assert.ok(
            /:not\(:is\(\.art-block-start,\s*\.art-block-middle,\s*\.art-block-end/.test(decoStyles),
            'connector must exclude art-block rows so shimmer ::after is preserved',
        );
    });

    test('between-row divider rows are retired — band spans naturally row-to-row', () => {
        // The .viewer-divider concept was retired alongside the move to the
        // counter-row chevron affordance. With no DOM rows between visible log
        // rows, each row's full-height stripe abuts the next directly — no
        // divider stamping, no chain bridging, no special-case CSS.
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
            'levelFiltered', 'troubleFiltered', 'excluded', 'filteredOut', 'sourceFiltered',
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
            renderChunk.includes("stack-header cols log-cols' + hdrLevelCls + matchCls"),
            'stack-header div must carry .cols.log-cols (Phase 2 grid) then the level class before other class concatenations',
        );
    });

    test('stack-header gets its own decoration cell (line number + chevron) on the grid', () => {
        // Plan 055 Phase 2: stack-headers render through getDecorationCells like
        // regular grid rows, so they get a clickable line-number column with a
        // chevron as a clipping .deco-cell, and their text lives in a .line-msg
        // cell pinned to the message column. The bespoke .line-deco-spacer-only
        // indent and the legacy getDecorationPrefix blob are both gone.
        assert.ok(
            renderChunk.includes('getDecorationCells(item, idx, null)'),
            'renderStackHeader must call getDecorationCells so the row gets a grid counter-row chevron',
        );
        const headerFnMatch = /function renderStackHeader\([^{]*\{[\s\S]*?\n\}/.exec(renderChunk);
        assert.ok(headerFnMatch, 'renderStackHeader function must exist');
        assert.ok(
            !headerFnMatch![0].includes('line-deco-spacer-only'),
            'line-deco-spacer-only must be retired from renderStackHeader — the grid message track handles nesting now',
        );
    });
});

suite('Stack header column alignment CSS', () => {
    const css = getDecorationStyles();

    test('legacy :has(.line-decoration) rule scopes BOTH .line and .stack-header to :not(.cols)', () => {
        // Plan 055 Phase 2: multi-frame stack-headers are on the grid, so the
        // legacy hanging-indent rule must scope .stack-header :not(.cols) too —
        // otherwise the 14.25em padding-left + negative text-indent would stack on
        // top of the grid and shove the header's columns off-screen. Un-migrated
        // paths (chips, art blocks) keep the legacy treatment.
        assert.ok(
            /\.line:not\(\.cols\):has\(\.line-decoration\)[^{]*\.stack-header:not\(\.cols\):has\(\.line-decoration\)/.test(css),
            'the legacy padding-left rule must scope both .line:not(.cols) and .stack-header:not(.cols)',
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

/**
 * Tests for ASCII art block grouping: level forcing, block tracking, finalization,
 * source-tag guard, and state reset on clear/trim.
 */
import * as assert from 'node:assert';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';
import { getAsciiArtStyles } from '../../ui/viewer-styles/viewer-styles-ascii-art';

function extractAddToDataBlock(script: string): string {
    const start = script.indexOf('function addToData(');
    const end = script.indexOf('\nfunction toggleStackGroup(');
    if (start < 0 || end < 0 || end <= start) {
        return '';
    }
    return script.slice(start, end);
}

suite('ASCII art block grouping', () => {
    suite('level classification', () => {
        test('separator lines should be forced to info level', () => {
            const block = extractAddToDataBlock(getViewerDataAddScript());
            assert.ok(block.length > 0, 'expected addToData block');
            assert.ok(
                block.includes("isSep ? 'info'"),
                'separator lines must bypass classifyLevel and use info directly',
            );
        });

        test('source-tag database override should not apply to separator lines', () => {
            const block = extractAddToDataBlock(getViewerDataAddScript());
            assert.ok(
                block.includes("!isSep && sTag === 'database'"),
                'database source-tag reclassification must skip separator lines',
            );
        });
    });

    suite('art block tracker', () => {
        test('should exist with startIdx, timestamp, and count fields', () => {
            const core = getViewerDataHelpersCore();
            assert.ok(
                core.includes('var artBlockTracker = {'),
                'artBlockTracker must be declared in helpers core',
            );
            assert.ok(core.includes('startIdx:'), 'tracker must have startIdx');
            assert.ok(core.includes('timestamp:'), 'tracker must have timestamp');
        });

        test('should be gated by viewerGroupAsciiArt setting', () => {
            const block = extractAddToDataBlock(getViewerDataAddScript());
            assert.ok(
                block.includes('viewerGroupAsciiArt && isSep && ts'),
                'art block tracking must check viewerGroupAsciiArt before grouping',
            );
        });

        test('should use timestamp proximity (not strict equality) for block continuity', () => {
            const block = extractAddToDataBlock(getViewerDataAddScript());
            assert.ok(
                block.includes('Math.abs(ts - artBlockTracker.timestamp) < 1000'),
                'tracker must compare timestamps with 1 s tolerance for block continuity',
            );
            const finalizeCount = (block.match(/finalizeArtBlock/g) || []).length;
            assert.ok(
                finalizeCount >= 2,
                'finalizeArtBlock must be called on both timestamp mismatch and non-separator lines',
            );
        });
    });

    suite('finalizeArtBlock', () => {
        test('should only tag blocks with 2+ lines', () => {
            const core = getViewerDataHelpersCore();
            assert.ok(
                core.includes('artBlockTracker.count < 2'),
                'finalization must skip single-line blocks (count < 2)',
            );
        });

        test('should assign start, middle, and end positions', () => {
            const core = getViewerDataHelpersCore();
            assert.ok(core.includes("it.artBlockPos = 'start'"), 'must tag first line as start');
            assert.ok(core.includes("it.artBlockPos = 'end'"), 'must tag last line as end');
            assert.ok(core.includes("it.artBlockPos = 'middle'"), 'must tag interior lines as middle');
        });

        test('should reset tracker state after finalization', () => {
            const core = getViewerDataHelpersCore();
            assert.ok(
                core.includes('artBlockTracker.startIdx = -1') && core.includes('artBlockTracker.count = 0'),
                'tracker must reset after finalization',
            );
        });
    });

    suite('renderItem integration', () => {
        test('should suppress decoration on art block continuation lines', () => {
            const render = getViewerDataHelpersRender();
            assert.ok(
                render.includes("var isArtCont = (abp === 'middle' || abp === 'end')"),
                'isArtCont flag must identify continuation lines',
            );
            assert.ok(
                render.includes("var deco = isArtCont ? ''"),
                'decoration must be empty for continuation lines',
            );
        });

        test('should add art-block CSS classes based on position', () => {
            const render = getViewerDataHelpersRender();
            assert.ok(render.includes("' art-block-start'"), 'start class must be added');
            assert.ok(render.includes("' art-block-middle'"), 'middle class must be added');
            assert.ok(render.includes("' art-block-end'"), 'end class must be added');
        });

        test('should suppress visual spacing for art block lines', () => {
            const render = getViewerDataHelpersRender();
            assert.ok(
                render.includes('!item.artBlockPos'),
                'spacing logic must be skipped for art block lines',
            );
        });
    });

    suite('tight row layout (no inter-row gap)', () => {
        // Before: art-block lines inherited .line { line-height: 1.5 }, so
        // vertical box-drawing strokes │ on adjacent rows never connected —
        // the box appeared broken. After: art-block lines override to
        // line-height 1 with matching height so strokes meet cleanly.
        test('CSS collapses inter-row gap via line-height 1 on all three art-block classes', () => {
            const css = getAsciiArtStyles();
            /* The shared rule that applies to start+middle+end must set both
               line-height and height; check the combined selector block exists. */
            assert.ok(
                css.includes('.line.art-block-start,\n.line.art-block-middle,\n.line.art-block-end'),
                'shared rule must target all three art-block classes',
            );
            assert.ok(css.includes('line-height: 1;'), 'line-height must be 1 for tight box-drawing');
            assert.ok(css.includes('height: 1em;'), 'base art-block height must be 1em');
        });

        test('CSS breathing room uses padding (not margin) so virtualization stays in sync', () => {
            const css = getAsciiArtStyles();
            /* Margin is not included in item.height and would desync the
               scroller's prefix sums; padding is included via border-box. */
            assert.ok(
                css.includes('padding-top: 6px;\n    height: calc(1em + 6px);'),
                'art-block-start must use padding-top + height calc (not margin)',
            );
            assert.ok(
                css.includes('padding-bottom: 6px;\n    height: calc(1em + 6px);'),
                'art-block-end must use padding-bottom + height calc (not margin)',
            );
            assert.ok(!css.includes('margin-top: 6px'), 'art-block-start must not use margin-top');
            assert.ok(!css.includes('margin-bottom: 6px'), 'art-block-end must not use margin-bottom');
        });

        test('calcItemHeight returns compact logFontSize-based heights for art-block rows', () => {
            const core = getViewerDataHelpersCore();
            assert.ok(
                core.includes("item.artBlockPos === 'start' || item.artBlockPos === 'end'"),
                'start and end must resolve together with +6 padding',
            );
            assert.ok(
                core.includes('return logFontSize + 6'),
                'start/end height must be logFontSize + 6px to match CSS padding',
            );
            assert.ok(
                core.includes("item.artBlockPos === 'middle'") && core.includes('return logFontSize'),
                'middle height must be logFontSize (no padding)',
            );
        });
    });

    suite('perfect indent alignment', () => {
        // Before: the top-row decoration prefix (counter/timestamp/tag) had
        // variable rendered width, so the ╭ corner drifted left/right relative
        // to the │ bars on middle rows. After: decoration is a fixed-width
        // inline-block sized in parent em units, pinning the corner.
        test('CSS pins start-line decoration to fixed --deco-content-indent-em slot', () => {
            const css = getAsciiArtStyles();
            assert.ok(
                css.includes('.line.art-block-start .line-decoration'),
                'must scope the fixed-width slot to art-block-start only (other rows unaffected)',
            );
            assert.ok(
                css.includes('display: inline-block'),
                'decoration must be inline-block so width takes effect',
            );
            /* /0.85 compensates for the decoration's 0.85em font-size; without
               it the slot would only reserve 0.85 * 13em = 11.05em of parent
               space and the art would still drift. */
            assert.ok(
                css.includes('width: calc(var(--deco-content-indent-em, 13em) / 0.85)'),
                'slot width must divide by 0.85 to account for decoration font-size',
            );
        });
    });

    suite('generalized ASCII art detector (plan 046)', () => {
        test('should define feedAsciiArtDetector gated by viewerDetectAsciiArt', () => {
            const script = getViewerDataAddScript();
            assert.ok(
                script.includes('function feedAsciiArtDetector('),
                'feedAsciiArtDetector must be defined in the data-add script',
            );
            assert.ok(
                script.includes('if (!viewerDetectAsciiArt) return false'),
                'detector must early-return when setting is off',
            );
        });

        test('should define scoreAsciiArtLine with entropy heuristics', () => {
            const script = getViewerDataAddScript();
            assert.ok(
                script.includes('function scoreAsciiArtLine('),
                'scoreAsciiArtLine must be defined',
            );
        });

        test('should use majority-in-window detection (not strict consecutive)', () => {
            const script = getViewerDataAddScript();
            assert.ok(
                script.includes('majorityPct'),
                'detector must use majority percentage for window qualification',
            );
            assert.ok(
                script.includes('bLen'),
                'window entries must track body length for vertical uniformity',
            );
        });

        test('should call feedAsciiArtDetector for non-separator lines in addToData', () => {
            const block = extractAddToDataBlock(getViewerDataAddScript());
            assert.ok(
                block.includes('feedAsciiArtDetector(plain, allLines.length - 1, ts)'),
                'addToData must call feedAsciiArtDetector for non-separator lines',
            );
            assert.ok(
                block.includes('!isSep && typeof feedAsciiArtDetector'),
                'call must be gated by !isSep',
            );
        });

        test('should define resetAsciiArtDetector for clear/session reset', () => {
            const script = getViewerDataAddScript();
            assert.ok(
                script.includes('function resetAsciiArtDetector()'),
                'resetAsciiArtDetector must be defined',
            );
        });

        test('should clear aaWindow after flagging a block to avoid cross-block pollution', () => {
            const script = getViewerDataAddScript();
            // After flagging, aaWindow must be reset so prior entries don't
            // inflate the majority count when detecting the next art block.
            assert.ok(
                script.includes("aaWindow = [];\n    }\n\n    return flagged;"),
                'aaWindow must be cleared inside the flagged branch before returning',
            );
        });

        test('should include low-token heuristic in webview scoreAsciiArtLine', () => {
            const script = getViewerDataAddScript();
            assert.ok(
                script.includes('Low token count'),
                'scoreAsciiArtLine must include low-token-count heuristic (comment marker)',
            );
        });
    });

    suite('state lifecycle', () => {
        test('should finalize art block on markers', () => {
            const block = extractAddToDataBlock(getViewerDataAddScript());
            const markerSection = block.slice(
                block.indexOf('if (isMarker)'),
                block.indexOf('allLines.push(markerItem)'),
            );
            assert.ok(
                markerSection.includes('finalizeArtBlock'),
                'marker path must finalize any open art block',
            );
        });

        test('should finalize art block on stack frames', () => {
            const block = extractAddToDataBlock(getViewerDataAddScript());
            const sfStart = block.indexOf('if (isStackFrameText(html))');
            // Slice to just past the finalizeArtBlock call (within first 200 chars of stack-frame path)
            const stackSection = block.slice(sfStart, sfStart + 200);
            assert.ok(
                stackSection.includes('finalizeArtBlock'),
                'stack-frame path must finalize any open art block',
            );
        });
    });
});

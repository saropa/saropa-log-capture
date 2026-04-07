/**
 * Tests for ASCII art block grouping: level forcing, block tracking, finalization,
 * source-tag guard, and state reset on clear/trim.
 */
import * as assert from 'node:assert';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';

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

        test('should finalize previous block when timestamp changes', () => {
            const block = extractAddToDataBlock(getViewerDataAddScript());
            assert.ok(
                block.includes('artBlockTracker.timestamp === ts'),
                'tracker must compare timestamps for block continuity',
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

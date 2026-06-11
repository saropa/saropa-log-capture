/**
 * Tests for ASCII art block collapse / expand: height gating, the toggle function,
 * the start-row chevron render, the click route, and the collapsed-corner CSS.
 * Kept separate from viewer-ascii-art-block.test.ts to stay under the file line cap.
 */
import * as assert from 'node:assert';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';
import { getAsciiArtStyles } from '../../ui/viewer-styles/viewer-styles-ascii-art';
import { getViewerClickHandlerScript } from '../../ui/viewer/viewer-script-click-handlers';

suite('ASCII art block collapse / expand', () => {
    test('finalizeArtBlock stamps artBlockCount on the start row', () => {
        const core = getViewerDataHelpersCore();
        assert.ok(
            core.includes('artBlockCount = artBlockTracker.count'),
            'start row must carry artBlockCount so the chevron can show "N lines"',
        );
    });

    test('calcItemHeight hides middle/end rows when the block is collapsed', () => {
        const core = getViewerDataHelpersCore();
        assert.ok(
            core.includes("item.artBlockPos === 'end') return item.artCollapsed ? 0 : logFontSize + 6"),
            'collapsed end row must return 0 height',
        );
        assert.ok(
            core.includes("item.artBlockPos === 'middle') return item.artCollapsed ? 0 : logFontSize"),
            'collapsed middle row must return 0 height',
        );
    });

    test('start row stays visible when collapsed (it is the toggle anchor)', () => {
        const core = getViewerDataHelpersCore();
        assert.ok(
            core.includes("item.artBlockPos === 'start') return logFontSize + 6"),
            'start row height must not depend on artCollapsed — it always renders',
        );
    });

    test('toggleAsciiArtBlock flips artCollapsed across the whole contiguous block', () => {
        const script = getViewerDataAddScript();
        assert.ok(
            script.includes('function toggleAsciiArtBlock('),
            'toggleAsciiArtBlock must be defined',
        );
        assert.ok(
            script.includes('allLines[i].artCollapsed = nowCollapsed'),
            'toggle must set artCollapsed on every row of the block',
        );
    });

    test('renderer emits the .art-collapse-chevron only on the start row', () => {
        const render = getViewerDataHelpersRender();
        assert.ok(
            render.includes('art-collapse-chevron'),
            'start row must render the collapse chevron',
        );
        assert.ok(
            render.includes("if (abp === 'start') {"),
            'chevron must be gated to the start row',
        );
    });

    test('click handler routes .art-collapse-chevron to toggleAsciiArtBlock', () => {
        const handlers = getViewerClickHandlerScript();
        assert.ok(
            handlers.includes("e.target.closest('.art-collapse-chevron')"),
            'click handler must detect the chevron',
        );
        assert.ok(
            handlers.includes('toggleAsciiArtBlock(parseInt(artRow.dataset.idx, 10))'),
            'chevron click must call toggleAsciiArtBlock with the row index',
        );
    });

    test('CSS rounds all corners of a collapsed start row', () => {
        const css = getAsciiArtStyles();
        assert.ok(
            css.includes('.line.art-block-start.art-collapsed'),
            'collapsed start row must get a dedicated full-radius rule',
        );
    });
});

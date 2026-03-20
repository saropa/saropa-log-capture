import * as assert from 'node:assert';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getViewerScript } from '../../ui/viewer/viewer-script';

/**
 * Regression: filtered logs (many height-0 lines) used index-based viewport hysteresis,
 * causing full DOM rebuild every scroll frame and severe flicker. Tail-follow also
 * flipped when distance-to-bottom jittered. See viewer-data-viewport + viewer-script.
 */
suite('ViewerScrollBehavior', () => {
    const maxLines = 100_000;

    test('viewport script skips rebuild only when visible range unchanged (not index slack)', () => {
        const script = getViewportRenderScript();
        assert.ok(
            script.includes('startIdx === lastStart && endIdx === lastEnd'),
            'expected equality-based skip to avoid filter-mode flicker',
        );
        assert.ok(
            script.includes('height 0'),
            'expected comment documenting filtered-view failure mode',
        );
        assert.ok(
            !script.includes('Math.abs(startIdx - lastStart)'),
            'index-delta hysteresis must not remain',
        );
    });

    test('viewer script uses Schmitt-trigger thresholds for tail-follow', () => {
        const script = getViewerScript(maxLines);
        assert.ok(script.includes('AT_BOTTOM_ON_PX'));
        assert.ok(script.includes('AT_BOTTOM_OFF_PX'));
        assert.ok(script.includes('Schmitt-trigger'));
        assert.ok(script.includes('distBottom'));
    });
});

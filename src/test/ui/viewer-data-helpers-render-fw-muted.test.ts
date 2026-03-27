/**
 * Regression tests for `fwMuted` in `renderItem` (embedded webview script).
 *
 * `saropaLogCapture.deemphasizeFrameworkLevels` must mute framework **error/warning** text colors
 * only — not **performance** (Choreographer jank, etc.). Assertions use string includes on the
 * emitted script (same pattern as viewer-compress-and-search-styles.test.ts).
 */
import * as assert from 'node:assert';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';

suite('viewer-data-helpers-render fwMuted (framework deemphasize)', () => {
    const renderChunk = getViewerDataHelpersRender();

    test('fwMuted gates on error or warning level when framework + deemphasize', () => {
        assert.ok(
            renderChunk.includes("item.level === 'error' || item.level === 'warning'"),
            'fwMuted must only apply to framework error/warning lines',
        );
        assert.ok(
            renderChunk.includes('deemphasizeFrameworkLevels') && renderChunk.includes('item.fw'),
            'fwMuted must still consider deemphasize + framework flag',
        );
    });

    test('does not use framework-only mute (before: all fw levels lost line colors)', () => {
        /* Regression: prior implementation closed with `&& item.fw);` — no level branch. */
        assert.ok(
            !renderChunk.includes('deemphasizeFrameworkLevels && item.fw);'),
            'must not end fwMuted immediately after item.fw (performance would stay muted)',
        );
    });
});

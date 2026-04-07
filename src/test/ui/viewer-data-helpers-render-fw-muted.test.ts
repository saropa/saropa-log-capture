/**
 * Regression tests for framework line rendering in `renderItem` (embedded webview script).
 *
 * The tier system handles device-line severity: device-other lines have their level
 * demoted to `info` in `addToData()`, so `renderItem` no longer needs `fwMuted` logic.
 * These tests verify the old per-render muting is gone and the bar still derives from `item.level`.
 */
import * as assert from 'node:assert';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';

suite('viewer-data-helpers-render framework severity (tier system)', () => {
    const renderChunk = getViewerDataHelpersRender();

    test('fwMuted variable should not exist (tier system handles severity demotion)', () => {
        assert.ok(
            !renderChunk.includes('fwMuted'),
            'renderItem must not contain fwMuted — device-other severity is demoted in addToData()',
        );
    });

    test('deemphasizeFrameworkLevels should not appear in render script', () => {
        assert.ok(
            !renderChunk.includes('deemphasizeFrameworkLevels'),
            'renderItem must not reference the deprecated deemphasizeFrameworkLevels setting',
        );
    });

    /**
     * Before the tier system: `barCls` picked `level-bar-framework` (charts blue) when `item.fw && !hasSeverity`,
     * while `levelCls` still applied `level-debug` / `level-info` — blue bar + yellow text on Android D/ lines.
     * After: bar is always `level-bar-` + `item.level` (except recent-error-context), matching gutter CSS to line text.
     */
    test('severity bar uses level-bar-{level} for framework lines (matches level-* text)', () => {
        assert.ok(
            !renderChunk.includes("' level-bar-framework'"),
            'gutter must not use level-bar-framework when item.fw; bar color should match level-debug/info/etc.',
        );
        assert.ok(
            renderChunk.includes("' level-bar-' + item.level"),
            'bar class must derive from item.level',
        );
    });
});

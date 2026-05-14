/**
 * Guards that error-classification markers (bug / transient / ANR) render as
 * absolutely-positioned gutter icons, not inline pills. An inline "🐛 BUG" /
 * "⚡ TRANSIENT" badge was flow content, so every classified line's text shifted
 * right and broke alignment with the surrounding lines. See
 * viewer-styles-decoration-bars.ts (.error-badge-gutter).
 */
import * as assert from 'node:assert';
import { getErrorClassificationScript } from '../../ui/viewer-decorations/viewer-error-classification';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';
import { getDecorationBarStyles } from '../../ui/viewer-styles/viewer-styles-decoration-bars';

suite('error classification markers render in the gutter, not inline', () => {
    test('getErrorBadge emits gutter-class spans, not inline-pill text labels', () => {
        const script = getErrorClassificationScript();
        assert.ok(
            script.includes('error-badge-gutter error-badge-bug'),
            'bug badge must use the absolute-positioned error-badge-gutter class',
        );
        assert.ok(
            script.includes('error-badge-gutter error-badge-transient'),
            'transient badge must use the absolute-positioned error-badge-gutter class',
        );
        // The old inline-pill text labels shifted the line text — they must be gone.
        assert.ok(!script.includes('TRANSIENT</span>'), 'inline "TRANSIENT" text label must be removed');
        assert.ok(!script.includes('BUG</span>'), 'inline "BUG" text label must be removed');
        // .error-badge-interactive is the hover hook and must survive.
        assert.ok(script.includes('error-badge-interactive'), 'hover hook class must be retained');
    });

    test('ANR marker also renders as a gutter icon', () => {
        const render = getViewerDataHelpersRender();
        assert.ok(
            render.includes('error-badge-gutter error-badge-anr'),
            'ANR badge must use the error-badge-gutter class',
        );
        assert.ok(!render.includes('\\u23f1 ANR</span>'), 'inline "ANR" text label must be removed');
    });

    test('error-badge-gutter is absolutely positioned and shares the critical-icon column', () => {
        const css = getDecorationBarStyles();
        assert.ok(
            /\.critical-fire-icon,\s*\.error-badge-gutter\s*\{[^}]*position:\s*absolute/s.test(css),
            'error-badge-gutter must be absolutely positioned alongside .critical-fire-icon',
        );
        assert.ok(
            css.includes(':has(.error-badge-gutter)[class*="level-bar-"]::before'),
            'lines carrying a gutter badge must hide the duplicate severity dot',
        );
    });
});

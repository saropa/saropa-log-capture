import * as assert from 'node:assert';
import { getDecorationStyles } from '../../ui/viewer-styles/viewer-styles-decoration';
import { getViewerStyles } from '../../ui/viewer-styles/viewer-styles';

suite('ViewerLevelLineColors', () => {
    test('info line text matches info severity bar token (debug console info)', () => {
        const viewer = getViewerStyles();
        const deco = getDecorationStyles();
        assert.ok(
            /\.line\.level-info\s*\{[^}]*debugConsole-infoForeground/s.test(viewer),
            'info line text should use debugConsole-infoForeground',
        );
        assert.ok(
            /\.level-bar-info\s*\{[^}]*debugConsole-infoForeground/s.test(deco),
            'info severity bar should use the same token as info line text',
        );
        assert.ok(
            !/\.level-bar-info\s*\{[^}]*charts-yellow/s.test(deco),
            'regression: info bar must not use charts-yellow while text uses debugConsole-infoForeground',
        );
    });

    test('performance line text uses charts purple to match performance bar', () => {
        const viewer = getViewerStyles();
        const deco = getDecorationStyles();
        assert.ok(
            /\.line\.level-performance\s*\{[^}]*charts-purple/s.test(viewer),
            'performance line color should match level-bar-performance',
        );
        assert.ok(
            /\.level-bar-performance\s*\{[^}]*charts-purple/s.test(deco),
            'performance bar should stay charts-purple alongside performance line text',
        );
        assert.ok(
            !/\.line\.level-performance\s*\{[^}]*debugConsole-infoForeground/s.test(viewer),
            'regression: performance line must not share infoForeground with info (distinct purple level)',
        );
    });

    test('error and warning severity bars use debug console tokens (match line text)', () => {
        const deco = getDecorationStyles();
        assert.ok(
            /\.level-bar-error\s*\{[^}]*debugConsole-errorForeground/s.test(deco),
            'error bar should align with .line.level-error',
        );
        assert.ok(
            /\.level-bar-warning\s*\{[^}]*debugConsole-warningForeground/s.test(deco),
            'warning bar should align with .line.level-warning',
        );
    });

    test('debug lines still use terminal yellow (unchanged level palette)', () => {
        const css = getViewerStyles();
        assert.ok(css.includes('.line.level-debug'));
        const debugRe = /\.line\.level-debug\s*\{[^}]*terminal-ansiYellow/s;
        assert.ok(debugRe.exec(css), 'debug lines should keep terminal-ansiYellow');
    });
});

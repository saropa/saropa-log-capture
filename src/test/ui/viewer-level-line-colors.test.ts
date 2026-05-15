import * as assert from 'node:assert';
import { getDecorationStyles } from '../../ui/viewer-styles/viewer-styles-decoration';
import { getViewerStyles } from '../../ui/viewer-styles/viewer-styles';

suite('ViewerLevelLineColors', () => {
    test('info line text matches info severity bar token (charts blue)', () => {
        const viewer = getViewerStyles();
        const deco = getDecorationStyles();
        // Info anchored to charts-blue (was debugConsole-infoForeground which resolved
        // to a purple-ish tint in several themes and clashed with Performance).
        assert.ok(
            /\.line\.level-info\s*\{[^}]*charts-blue/s.test(viewer),
            'info line text should use charts-blue',
        );
        assert.ok(
            /\.level-bar-info\s*\{[^}]*charts-blue/s.test(deco),
            'info severity bar should use the same token as info line text',
        );
        assert.ok(
            !/\.level-bar-info\s*\{[^}]*debugConsole-infoForeground/s.test(deco),
            'regression: info bar must not regress to debugConsole-infoForeground (purple-ish in many themes)',
        );
    });

    test('notice uses ansi-cyan and database uses charts-green (palette rotation)', () => {
        const viewer = getViewerStyles();
        const deco = getDecorationStyles();
        // Three-way rotation away from the prior info=purple / notice=blue / db=cyan
        // palette. Verify line text and gutter bar agree per level so the picker
        // dot, gutter bar, and log row never disagree on what a level "looks like".
        assert.ok(
            /\.line\.level-notice\s*\{[^}]*terminal-ansiCyan/s.test(viewer),
            'notice line text should use terminal-ansiCyan',
        );
        assert.ok(
            /\.level-bar-notice\s*\{[^}]*terminal-ansiCyan/s.test(deco),
            'notice severity bar should use terminal-ansiCyan',
        );
        assert.ok(
            /\.line\.level-database\s*\{[^}]*charts-green/s.test(viewer),
            'database line text should use charts-green',
        );
        assert.ok(
            /\.level-bar-database\s*\{[^}]*charts-green/s.test(deco),
            'database severity bar should use charts-green',
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

    test('severity gutter connector uses color-mix not opacity (dot stacks above stripe)', () => {
        const deco = getDecorationStyles();
        // The 70% bump produced a connector that looked like a single solid
        // color column at the wider 0.28em stripe width — hue contrast
        // between adjacent rows disappeared. Back to 45% so each row's color
        // reads as its own. The stripe width was the actual readability lever:
        // 4px stripes resolve hue clearly, 2px stripes blur.
        const connectorRe =
            /\.bar-down::after,\s*\.bar-up::after\s*\{[\s\S]*?width:\s*0\.28em[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--bar-color\)\s*45%,\s*transparent\)[\s\S]*?z-index:\s*1[\s\S]*?\}/;
        assert.ok(connectorRe.test(deco), 'connector should be 0.28em wide with color-mix 45% and z-index 1');
        const badOpacity = /\.bar-down::after,\s*\.bar-up::after\s*\{[\s\S]*?opacity:\s*0\./;
        assert.ok(!badOpacity.test(deco), 'regression: connector must not use opacity (Chromium stacks it over the dot)');
    });
});

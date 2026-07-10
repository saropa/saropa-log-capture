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
        // Connector is now a single class-agnostic [class*="level-bar-"]::after
        // full-height stripe reading --bar-color (replaced the per-level
        // :has(+ .level-bar-X) chain, 2026-07-10). It must use color-mix(45%) for
        // the fill, not opacity, so the pseudo-element doesn't stack above the
        // dot in Chromium/WebKit.
        assert.ok(
            /\[class\*="level-bar-"\][^{]*::after\s*\{/.test(deco),
            'connector CSS must use a single [class*="level-bar-"]::after stripe rule',
        );
        assert.ok(
            /background:\s*color-mix\(in srgb,\s*var\(--bar-color\)\s*45%,\s*transparent\)/.test(deco),
            'connector fill should use color-mix 45%',
        );
        // The rule body must not use opacity (regression guard from the
        // pre-CSS-sibling era — opacity on ::after interacted with stacking
        // contexts and let the gutter stripe paint on top of the dot).
        const ruleBody = /\[class\*="level-bar-"\][^{]*::after\s*\{([^}]*)\}/.exec(deco);
        assert.ok(ruleBody, 'connector stripe rule must exist');
        assert.ok(
            !/opacity:\s*0\./.test(ruleBody![1]),
            'regression: connector must not use opacity (Chromium stacks it over the dot)',
        );
    });
});

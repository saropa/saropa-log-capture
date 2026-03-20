import * as assert from 'node:assert';
import { getViewerStyles } from '../../ui/viewer-styles/viewer-styles';

suite('ViewerLevelLineColors', () => {
    test('info + performance lines share debugConsole.infoForeground (not terminal yellow)', () => {
        const css = getViewerStyles();
        const combinedRe =
            /\.line\.level-performance,\s*\.line\.level-info\s*\{[^}]*debugConsole-infoForeground/s;
        const combined = combinedRe.exec(css);
        assert.ok(combined, 'expected one shared rule for perf + info using debug console info token');

        const blockRe = /\.line\.level-performance,\s*\.line\.level-info\s*\{[^}]*\}/s;
        const block = blockRe.exec(css);
        if (block === null) {
            assert.fail('expected combined perf/info CSS block');
        }
        assert.ok(
            !block[0].includes('terminal-ansiYellow'),
            'perf/info line color must not use terminal-ansiYellow'
        );
    });

    test('debug lines still use terminal yellow (unchanged level palette)', () => {
        const css = getViewerStyles();
        assert.ok(css.includes('.line.level-debug'));
        const debugRe = /\.line\.level-debug\s*\{[^}]*terminal-ansiYellow/s;
        assert.ok(debugRe.exec(css), 'debug lines should keep terminal-ansiYellow');
    });
});

/**
 * Unit tests for renderSmartFrameSection — the crashlytics-only smart frame collapse (#1).
 *
 * Pure HTML output: app frames stay inline + clickable, runs of >2 consecutive framework
 * frames fold into a `.cd-fw-group` <details>, short runs (<=2) stay inline. Runs under
 * `node --test` because analysis-frame-render only imports escapeHtml (no vscode).
 */

import * as assert from 'assert';
import { renderSmartFrameSection, type StackFrameInfo } from '../../../ui/analysis/analysis-frame-render';

const app = (text: string, file?: string, line = 1): StackFrameInfo =>
    file ? { text, isApp: true, sourceRef: { filePath: file, line } as StackFrameInfo['sourceRef'] }
         : { text, isApp: true };
const fw = (text: string): StackFrameInfo => ({ text, isApp: false });

suite('renderSmartFrameSection', () => {
    test('folds a run of >2 consecutive framework frames into a .cd-fw-group', () => {
        const html = renderSmartFrameSection([
            app('MyApp.crash', 'lib/main.dart', 42),
            fw('framework.a'), fw('framework.b'), fw('framework.c'),
            app('MyApp.handler', 'lib/handler.dart', 7),
        ]);
        assert.ok(html.includes('cd-fw-group'), 'long fw run is folded');
        assert.ok(html.includes('3 framework frames'), 'summary names the run length');
    });

    test('keeps short framework runs (<=2) inline, not folded', () => {
        const html = renderSmartFrameSection([
            app('MyApp.crash', 'lib/main.dart', 1),
            fw('framework.a'), fw('framework.b'),
            app('MyApp.next', 'lib/next.dart', 2),
        ]);
        assert.ok(!html.includes('cd-fw-group'), 'two-frame run stays inline');
        assert.ok(html.includes('framework.a') && html.includes('framework.b'), 'both fw frames present');
    });

    test('app frames with a source reference render clickable (data-frame-file)', () => {
        const html = renderSmartFrameSection([app('MyApp.crash', 'lib/main.dart', 42)]);
        assert.ok(html.includes('data-frame-file="lib/main.dart"'), 'app frame is clickable');
        assert.ok(html.includes('data-frame-line="42"'), 'carries the line number');
        assert.ok(!html.includes('cd-fw-group'), 'no fw group for app-only stack');
    });

    test('summary reports correct app/fw frame counts', () => {
        const html = renderSmartFrameSection([
            app('a', 'lib/a.dart'), fw('x'), fw('y'), fw('z'), app('b', 'lib/b.dart'),
        ]);
        assert.ok(html.includes('5 frames (2 app, 3 fw)'), 'counts app vs fw');
    });

    test('a trailing framework run is still folded after the last app frame', () => {
        const html = renderSmartFrameSection([
            app('a', 'lib/a.dart'), fw('x'), fw('y'), fw('z'),
        ]);
        assert.ok(html.includes('cd-fw-group'), 'trailing fw run folds (flush after loop)');
    });
});

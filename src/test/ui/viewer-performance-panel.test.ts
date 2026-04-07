import * as assert from 'node:assert';
import { getPerformancePanelHtml, getPerformancePanelScript } from '../../ui/panels/viewer-performance-panel';

suite('ViewerPerformancePanel', () => {

    suite('getPerformancePanelHtml', () => {
        test('should return HTML with session intro and copyable message block', () => {
            const html = getPerformancePanelHtml();
            assert.ok(html.includes('pp-session-intro'));
            assert.ok(html.includes('pp-copyable-message'));
            assert.ok(html.includes('Right-click to copy'));
            assert.ok(html.includes('This log file was saved without performance data'));
            assert.ok(html.includes("if <strong>Performance</strong> is enabled"));
        });

        test('should include copy-message context menu', () => {
            const html = getPerformancePanelHtml();
            assert.ok(html.includes('pp-copy-message-menu'));
            assert.ok(html.includes('data-action="copy-message"'));
            assert.ok(html.includes('Copy message'));
        });

        test('should support insight prefix for embedded panel', () => {
            const html = getPerformancePanelHtml('insight-');
            assert.ok(html.includes('id="insight-pp-panel"'));
            assert.ok(html.includes('id="insight-pp-session-intro"'));
            assert.ok(html.includes('id="insight-pp-copy-message-menu"'));
        });
    });

    suite('getPerformancePanelScript', () => {
        test('should include copy-message menu show/hide and contextmenu handler', () => {
            const script = getPerformancePanelScript();
            assert.ok(script.includes('hideCopyMessageMenu'));
            assert.ok(script.includes('showCopyMessageMenu'));
            assert.ok(script.includes('ppSessionIntro'));
            assert.ok(script.includes('ppCopyMessageMenu'));
            assert.ok(script.includes('contextmenu'));
            assert.ok(script.includes("type: 'copyToClipboard'"));
        });

        test('should use positive condition for ID prefix (Sonar S7735)', () => {
            // When no prefix is given, the script should contain the runtime fallback
            const noPrefix = getPerformancePanelScript();
            assert.ok(noPrefix.includes('__insightPerfIdPrefix'));
            // When a prefix string is given, it should be inlined directly
            const withPrefix = getPerformancePanelScript('insight-');
            assert.ok(withPrefix.includes("'insight-'"));
            assert.ok(!withPrefix.includes('__insightPerfIdPrefix'));
        });

        test('webview should bind to embedded insight- panel IDs', () => {
            const script = getPerformancePanelScript('insight-');
            assert.ok(script.includes("'insight-'"));
            assert.ok(script.includes("ppIdPrefix + 'pp-panel'") || script.includes("insight-pp-panel"));
        });

        test('session perf chip should open Insight without setActivePanel toggle-off', () => {
            const script = getPerformancePanelScript('insight-');
            assert.ok(script.includes('ensureInsightSlideoutOpen'));
            assert.ok(script.includes('session-perf-chip'));
        });

        test('session perf chip should try ensureInsightSlideoutOpen before setActivePanel fallback', () => {
            const script = getPerformancePanelScript();
            const ensureIdx = script.indexOf('ensureInsightSlideoutOpen');
            const fallbackIdx = script.indexOf("window.setActivePanel === 'function') window.setActivePanel('insight')");
            assert.ok(ensureIdx > 0, 'ensureInsightSlideoutOpen must appear in chip handler');
            assert.ok(fallbackIdx > ensureIdx, 'setActivePanel fallback must come after ensureInsightSlideoutOpen');
        });

        test('session perf chip fallback should use else-if chain, not unconditional calls', () => {
            const script = getPerformancePanelScript();
            // Extract the chip handler block
            const chipStart = script.indexOf("getElementById('session-perf-chip')");
            assert.ok(chipStart > 0);
            const handlerBlock = script.slice(chipStart, chipStart + 500);
            // The setActivePanel('insight') call must be in an else-if, not a standalone if
            assert.ok(
                handlerBlock.includes('else if (typeof window.setActivePanel'),
                'setActivePanel(insight) must be else-if (only fires when ensureInsightSlideoutOpen is absent)',
            );
        });
    });
});

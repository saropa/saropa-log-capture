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
            const implementation = getPerformancePanelScript.toString();
            assert.ok(implementation.includes("typeof prefix === 'string'"));
        });
    });
});

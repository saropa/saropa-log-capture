import * as assert from 'assert';
import { getIconBarHtml, getIconBarScript } from '../../ui/viewer-nav/viewer-icon-bar';

suite('ViewerIconBar', () => {

    suite('getIconBarHtml', () => {
        test('should return toolbar with icon-bar id and aria-label', () => {
            const html = getIconBarHtml();
            assert.ok(html.includes('id="icon-bar"'));
            assert.ok(html.includes('role="toolbar"'));
            assert.ok(html.includes('aria-label="Log viewer tools"'));
        });

        test('should include title for label toggle discoverability', () => {
            const html = getIconBarHtml();
            assert.ok(html.includes('show or hide icon labels'));
        });

        test('should include optional labels for each icon', () => {
            const html = getIconBarHtml();
            assert.ok(html.includes('class="ib-label"'));
            assert.ok(html.includes('>Project Logs</span>'));
            assert.ok(html.includes('>Search</span>'));
            assert.ok(html.includes('>Bookmarks</span>'));
            assert.ok(html.includes('>Options</span>'));
        });

        test('should include separator and main icon buttons', () => {
            const html = getIconBarHtml();
            assert.ok(html.includes('class="ib-separator"'));
            assert.ok(html.includes('id="ib-sessions"'));
            assert.ok(html.includes('id="ib-options"'));
            assert.ok(html.includes('id="ib-about"'));
        });
    });

    suite('getIconBarScript', () => {
        test('should persist and restore label visibility via webview state', () => {
            const script = getIconBarScript();
            assert.ok(script.includes('iconBarLabelsVisible'));
            assert.ok(script.includes('getState'));
            assert.ok(script.includes('setState'));
        });

        test('should toggle labels on bar click, not on icon button click', () => {
            const script = getIconBarScript();
            assert.ok(script.includes('ib-icon'));
            assert.ok(script.includes('applyLabelsVisible'));
        });
    });
});

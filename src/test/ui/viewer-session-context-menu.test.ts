import * as assert from 'assert';
import { getSessionContextMenuHtml, getSessionContextMenuScript } from '../../ui/viewer-context-menu/viewer-session-context-menu';

suite('ViewerSessionContextMenu', () => {
    suite('getSessionContextMenuHtml', () => {
        test('should include Replay action', () => {
            const html = getSessionContextMenuHtml();
            assert.ok(html.includes('data-session-action="replay"'));
            assert.ok(html.includes('Replay'));
        });
        test('should include Open and other session actions', () => {
            const html = getSessionContextMenuHtml();
            assert.ok(html.includes('data-session-action="open"'));
            assert.ok(html.includes('data-session-action="trash"'));
        });
    });
    suite('getSessionContextMenuScript', () => {
        test('should post sessionAction with action and uriString', () => {
            const script = getSessionContextMenuScript();
            assert.ok(script.includes('sessionAction'));
            assert.ok(script.includes('sessionCtxUri'));
        });
    });
});

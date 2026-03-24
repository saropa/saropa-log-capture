/**
 * String-level check: host can open the SQL query history panel via postMessage.
 */
import * as assert from 'node:assert';
import { getViewerScriptMessageHandler } from '../../ui/viewer/viewer-script-messages';

suite('viewer-script-messages SQL query history', () => {
    test("openSqlQueryHistoryPanel case delegates to setActivePanel('sqlHistory')", () => {
        const handler = getViewerScriptMessageHandler();
        assert.ok(handler.includes("case 'openSqlQueryHistoryPanel'"));
        assert.ok(handler.includes("setActivePanel('sqlHistory')"));
    });
});

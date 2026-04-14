"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const viewer_session_context_menu_1 = require("../../ui/viewer-context-menu/viewer-session-context-menu");
suite('ViewerSessionContextMenu', () => {
    suite('getSessionContextMenuHtml', () => {
        test('should include Replay action', () => {
            const html = (0, viewer_session_context_menu_1.getSessionContextMenuHtml)();
            assert.ok(html.includes('data-session-action="replay"'));
            assert.ok(html.includes('Replay'));
        });
        test('should include Open and other session actions', () => {
            const html = (0, viewer_session_context_menu_1.getSessionContextMenuHtml)();
            assert.ok(html.includes('data-session-action="open"'));
            assert.ok(html.includes('data-session-action="trash"'));
        });
        test('should include Hide This Name action', () => {
            const html = (0, viewer_session_context_menu_1.getSessionContextMenuHtml)();
            assert.ok(html.includes('data-session-action="hideByName"'));
            assert.ok(html.includes('Hide This Name'));
            assert.ok(html.includes('codicon-eye-closed'));
        });
        test('should include Show Only This Name action', () => {
            const html = (0, viewer_session_context_menu_1.getSessionContextMenuHtml)();
            assert.ok(html.includes('data-session-action="showOnlyByName"'));
            assert.ok(html.includes('Show Only This Name'));
            assert.ok(html.includes('codicon-eye'));
        });
        test('should mark name filter actions as session-normal-only', () => {
            /* Name filter items should be hidden for trashed sessions. */
            const html = (0, viewer_session_context_menu_1.getSessionContextMenuHtml)();
            const hideIdx = html.indexOf('hideByName');
            const showIdx = html.indexOf('showOnlyByName');
            assert.ok(hideIdx > 0);
            assert.ok(showIdx > 0);
            /* Both should be inside elements with session-normal-only class. */
            const hideItem = html.lastIndexOf('session-normal-only', hideIdx);
            const showItem = html.lastIndexOf('session-normal-only', showIdx);
            assert.ok(hideItem > 0, 'hideByName should have session-normal-only');
            assert.ok(showItem > 0, 'showOnlyByName should have session-normal-only');
        });
    });
    suite('getSessionContextMenuScript', () => {
        test('should post sessionAction with action and uriStrings/filenames', () => {
            const script = (0, viewer_session_context_menu_1.getSessionContextMenuScript)();
            assert.ok(script.includes('sessionAction'));
            assert.ok(script.includes('sessionCtxUris'));
            assert.ok(script.includes('uriStrings'));
            assert.ok(script.includes('filenames'));
        });
        test('should handle hideByName locally without posting to extension', () => {
            /* The script should intercept hideByName and call setSessionNameFilter
               instead of posting a sessionAction message to the extension. */
            const script = (0, viewer_session_context_menu_1.getSessionContextMenuScript)();
            assert.ok(script.includes("action === 'hideByName'"));
            assert.ok(script.includes('setSessionNameFilter'));
        });
        test('should handle showOnlyByName locally without posting to extension', () => {
            const script = (0, viewer_session_context_menu_1.getSessionContextMenuScript)();
            assert.ok(script.includes("action === 'showOnlyByName'"));
            /* Both name filter actions early-return before postMessage. */
            assert.ok(script.includes("return;"), 'Name filter actions should return early');
        });
        test('should look up session from cachedSessions for name filter', () => {
            /* Context menu should use cachedSessions to get displayName, not just
               the data-filename attribute, so renamed sessions match correctly. */
            const script = (0, viewer_session_context_menu_1.getSessionContextMenuScript)();
            assert.ok(script.includes('cachedSessions'));
            assert.ok(script.includes('displayName'));
        });
    });
});
//# sourceMappingURL=viewer-session-context-menu.test.js.map
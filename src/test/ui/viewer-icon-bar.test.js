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
const assert = __importStar(require("node:assert"));
const viewer_icon_bar_1 = require("../../ui/viewer-nav/viewer-icon-bar");
suite('ViewerIconBar', () => {
    suite('getIconBarHtml', () => {
        test('should return toolbar with icon-bar id and aria-label', () => {
            const html = (0, viewer_icon_bar_1.getIconBarHtml)();
            assert.ok(html.includes('id="icon-bar"'));
            assert.ok(html.includes('role="toolbar"'));
            assert.ok(html.includes('aria-label="Log viewer tools"'));
        });
        test('should include title for label toggle discoverability', () => {
            const html = (0, viewer_icon_bar_1.getIconBarHtml)();
            assert.ok(html.includes('show or hide icon labels'));
        });
        test('should include optional labels for each icon', () => {
            const html = (0, viewer_icon_bar_1.getIconBarHtml)();
            assert.ok(html.includes('class="ib-label"'));
            assert.ok(html.includes('>Project Logs</span>'));
            assert.ok(html.includes('>Find</span>'));
            assert.ok(!html.includes('id="ib-search"'), 'in-log search is session-nav only, not an icon bar tool');
            assert.ok(html.includes('>Bookmarks</span>'));
            assert.ok(html.includes('>Options</span>'));
        });
        test('should include separator and main icon buttons', () => {
            const html = (0, viewer_icon_bar_1.getIconBarHtml)();
            assert.ok(html.includes('class="ib-separator"'));
            assert.ok(html.includes('id="ib-sessions"'));
            assert.ok(html.includes('id="ib-options"'));
            assert.ok(html.includes('id="ib-about"'));
            assert.ok(!html.includes('id="ib-compress"'), 'compress is a log-pane display toggle, not an activity bar tool');
        });
        test('should not include replay in icon bar (replay is footer + log overlay only)', () => {
            const html = (0, viewer_icon_bar_1.getIconBarHtml)();
            assert.ok(!html.includes('id="ib-replay"'));
            assert.ok(!html.includes('>Replay</span>'));
        });
    });
    suite('getIconBarScript', () => {
        test('should persist and restore label visibility via webview state', () => {
            const script = (0, viewer_icon_bar_1.getIconBarScript)();
            assert.ok(script.includes('iconBarLabelsVisible'));
            assert.ok(script.includes('getState'));
            assert.ok(script.includes('setState'));
        });
        test('should toggle labels on bar click, not on icon button click', () => {
            const script = (0, viewer_icon_bar_1.getIconBarScript)();
            assert.ok(script.includes('ib-icon'));
            assert.ok(script.includes('applyLabelsVisible'));
        });
        test('should define ensureInsightSlideoutOpen that skips toggle when insight already active', () => {
            const script = (0, viewer_icon_bar_1.getIconBarScript)();
            assert.ok(script.includes('ensureInsightSlideoutOpen'));
            // When insight is already active, it must NOT call setActivePanel (which toggles off)
            // Instead it calls openInsightPanel directly — verify both branches exist
            assert.ok(script.includes("activePanel === 'insight'"), 'must check whether insight is already the active panel');
            assert.ok(script.includes("setActivePanel('insight')"), 'must delegate to setActivePanel when insight is not active');
        });
    });
});
//# sourceMappingURL=viewer-icon-bar.test.js.map
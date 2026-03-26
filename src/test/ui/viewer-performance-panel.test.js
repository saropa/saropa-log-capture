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
const viewer_performance_panel_1 = require("../../ui/panels/viewer-performance-panel");
suite('ViewerPerformancePanel', () => {
    suite('getPerformancePanelHtml', () => {
        test('should return HTML with session intro and copyable message block', () => {
            const html = (0, viewer_performance_panel_1.getPerformancePanelHtml)();
            assert.ok(html.includes('pp-session-intro'));
            assert.ok(html.includes('pp-copyable-message'));
            assert.ok(html.includes('Right-click to copy'));
            assert.ok(html.includes('This log file was saved without performance data'));
            assert.ok(html.includes("if <strong>Performance</strong> is enabled"));
        });
        test('should include copy-message context menu', () => {
            const html = (0, viewer_performance_panel_1.getPerformancePanelHtml)();
            assert.ok(html.includes('pp-copy-message-menu'));
            assert.ok(html.includes('data-action="copy-message"'));
            assert.ok(html.includes('Copy message'));
        });
        test('should support insight prefix for embedded panel', () => {
            const html = (0, viewer_performance_panel_1.getPerformancePanelHtml)('insight-');
            assert.ok(html.includes('id="insight-pp-panel"'));
            assert.ok(html.includes('id="insight-pp-session-intro"'));
            assert.ok(html.includes('id="insight-pp-copy-message-menu"'));
        });
    });
    suite('getPerformancePanelScript', () => {
        test('should include copy-message menu show/hide and contextmenu handler', () => {
            const script = (0, viewer_performance_panel_1.getPerformancePanelScript)();
            assert.ok(script.includes('hideCopyMessageMenu'));
            assert.ok(script.includes('showCopyMessageMenu'));
            assert.ok(script.includes('ppSessionIntro'));
            assert.ok(script.includes('ppCopyMessageMenu'));
            assert.ok(script.includes('contextmenu'));
            assert.ok(script.includes("type: 'copyToClipboard'"));
        });
        test('should use positive condition for ID prefix (Sonar S7735)', () => {
            const implementation = viewer_performance_panel_1.getPerformancePanelScript.toString();
            assert.ok(implementation.includes("typeof prefix === 'string'"));
        });
        test('webview should bind to embedded insight- panel IDs', () => {
            const script = (0, viewer_performance_panel_1.getPerformancePanelScript)('insight-');
            assert.ok(script.includes("'insight-'"));
            assert.ok(script.includes("ppIdPrefix + 'pp-panel'") || script.includes("insight-pp-panel"));
        });
    });
});
//# sourceMappingURL=viewer-performance-panel.test.js.map
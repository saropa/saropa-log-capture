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
const viewer_script_messages_1 = require("../../ui/viewer/viewer-script-messages");
const viewer_script_1 = require("../../ui/viewer/viewer-script");
const viewer_performance_panel_1 = require("../../ui/panels/viewer-performance-panel");
const viewer_error_handler_1 = require("../../ui/viewer-decorations/viewer-error-handler");
suite('Webview script null guards', () => {
    suite('viewer-script-messages', () => {
        const script = (0, viewer_script_messages_1.getViewerScriptMessageHandler)();
        test('should guard footerEl.classList in clear handler', () => {
            // The clear case must not access footerEl.classList without a null check
            const clearBlock = script.slice(script.indexOf("case 'clear':"), script.indexOf("case 'updateFooter':"));
            assert.ok(clearBlock.includes('if (footerEl) footerEl.classList'), 'clear handler should guard footerEl.classList');
        });
        test('should guard footerEl.classList in setPaused handler', () => {
            const pausedBlock = script.slice(script.indexOf("case 'setPaused':"), script.indexOf("case 'setViewingMode':"));
            assert.ok(pausedBlock.includes('if (footerEl) footerEl.classList'), 'setPaused handler should guard footerEl.classList');
        });
        test('should guard footerTextEl in clear handler', () => {
            const clearBlock = script.slice(script.indexOf("case 'clear':"), script.indexOf("case 'updateFooter':"));
            assert.ok(clearBlock.includes("if (footerTextEl) footerTextEl.textContent"), 'clear handler should guard footerTextEl.textContent');
        });
        test('should guard footerTextEl in updateFooter handler', () => {
            const footerBlock = script.slice(script.indexOf("case 'updateFooter':"), script.indexOf("case 'setPaused':"));
            assert.ok(footerBlock.includes("if (footerTextEl) footerTextEl.textContent"), 'updateFooter handler should guard footerTextEl.textContent');
        });
        test('should guard jumpBtn.style in loadComplete handler', () => {
            const loadBlock = script.slice(script.indexOf("case 'loadComplete':"), script.indexOf("case 'loadComplete':") + 400);
            assert.ok(loadBlock.includes('if (jumpBtn) jumpBtn.style'), 'loadComplete handler should guard jumpBtn.style');
        });
    });
    suite('viewer-script', () => {
        const script = (0, viewer_script_1.getViewerScript)(100_000);
        test('should guard logEl.classList in toggleWrap', () => {
            const wrapBlock = script.slice(script.indexOf('function toggleWrap'), script.indexOf('function toggleWrap') + 200);
            assert.ok(wrapBlock.includes('if (logEl) logEl.classList'), 'toggleWrap should guard logEl.classList');
        });
    });
    suite('viewer-performance-panel switchTab', () => {
        const script = (0, viewer_performance_panel_1.getPerformancePanelScript)('insight-');
        test('should guard ppTabCurrent.classList in switchTab', () => {
            const tabBlock = script.slice(script.indexOf('function switchTab'), script.indexOf('function switchTab') + 400);
            assert.ok(tabBlock.includes('if (ppTabCurrent) ppTabCurrent.classList'), 'switchTab should guard ppTabCurrent.classList');
        });
        test('should guard ppTabTrends.classList in switchTab', () => {
            const tabBlock = script.slice(script.indexOf('function switchTab'), script.indexOf('function switchTab') + 400);
            assert.ok(tabBlock.includes('if (ppTabTrends) ppTabTrends.classList'), 'switchTab should guard ppTabTrends.classList');
        });
    });
    suite('error handler banner', () => {
        const script = (0, viewer_error_handler_1.getErrorHandlerScript)();
        test('should include line and col in error banner text', () => {
            assert.ok(script.includes("'Script error (line ' + line"), 'banner should show line number');
            assert.ok(script.includes("col + '): '"), 'banner should show column number');
        });
    });
});
//# sourceMappingURL=viewer-script-null-guards.test.js.map
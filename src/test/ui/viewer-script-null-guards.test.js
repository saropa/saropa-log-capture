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
const viewer_script_footer_1 = require("../../ui/viewer/viewer-script-footer");
const viewer_data_viewport_1 = require("../../ui/viewer/viewer-data-viewport");
suite('Webview script null guards – core viewer', () => {
    suite('viewer-script-messages', () => {
        const script = (0, viewer_script_messages_1.getViewerScriptMessageHandler)();
        test('should guard footerEl.classList in clear handler', () => {
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
        test('should guard logEl in handleScroll', () => {
            const block = script.slice(script.indexOf('function handleScroll'), script.indexOf('function handleScroll') + 200);
            assert.ok(block.includes('if (!logEl) return'), 'handleScroll should early-return when logEl is null');
        });
        test('should guard logEl.addEventListener for scroll', () => {
            assert.ok(script.includes("if (logEl) logEl.addEventListener('scroll'"), 'scroll listener should guard logEl');
        });
        test('should guard logEl.addEventListener for wheel', () => {
            assert.ok(script.includes("if (logEl) logEl.addEventListener('wheel'"), 'wheel listener should guard logEl');
        });
        test('should guard viewportEl.addEventListener for click', () => {
            assert.ok(script.includes("if (viewportEl) viewportEl.addEventListener('click'"), 'click listener should guard viewportEl');
        });
        test('should guard viewportEl.addEventListener for keydown', () => {
            assert.ok(script.includes("if (viewportEl) viewportEl.addEventListener('keydown'"), 'keydown listener should guard viewportEl');
        });
        test('should guard logEl in getCenterIdx', () => {
            const block = script.slice(script.indexOf('function getCenterIdx'), script.indexOf('function getCenterIdx') + 150);
            assert.ok(block.includes('if (!logEl) return 0'), 'getCenterIdx should early-return when logEl is null');
        });
        test('should guard logEl in jumpToBottom', () => {
            const block = script.slice(script.indexOf('function jumpToBottom'), script.indexOf('function jumpToBottom') + 150);
            assert.ok(block.includes('if (!logEl) return'), 'jumpToBottom should early-return when logEl is null');
        });
        test('should guard logEl in ResizeObserver', () => {
            assert.ok(script.includes('if (logEl) new ResizeObserver'), 'ResizeObserver should guard logEl');
        });
        test('filename mousedown should check e.button for left-click only', () => {
            assert.ok(script.includes('if (e.button !== 0) return'), 'mousedown handler should reject non-left clicks');
        });
        test('filename mousedown should use closest for target detection', () => {
            assert.ok(script.includes("e.target.closest('.footer-filename')"), 'mousedown handler should use closest instead of classList.contains');
        });
        test('filename mousedown should preventDefault to block drag', () => {
            const mdBlock = script.slice(script.indexOf("addEventListener('mousedown'"), script.indexOf("addEventListener('mouseup'"));
            assert.ok(mdBlock.includes('e.preventDefault()'), 'mousedown on filename should call preventDefault');
        });
        test('should prevent dragstart on footer text element', () => {
            assert.ok(script.includes("addEventListener('dragstart'"), 'footerTextEl should have a dragstart listener');
        });
        test('should guard logEl in onLogOrWrapResize', () => {
            const block = script.slice(script.indexOf('function onLogOrWrapResize'), script.indexOf('function onLogOrWrapResize') + 300);
            assert.ok(block.includes('if (logEl && allLines.length'), 'onLogOrWrapResize should guard logEl');
        });
    });
    suite('viewer-script-footer', () => {
        const script = (0, viewer_script_footer_1.getViewerScriptFooterChunk)();
        test('should guard footerTextEl in updateFooterText', () => {
            const block = script.slice(script.indexOf('function updateFooterText'), script.indexOf('function updateFooterText') + 150);
            assert.ok(block.includes('if (!footerTextEl) return'), 'updateFooterText should early-return when footerTextEl is null');
        });
    });
    suite('viewer-data-viewport', () => {
        const script = (0, viewer_data_viewport_1.getViewportRenderScript)();
        test('should guard logEl at top of renderViewport', () => {
            const block = script.slice(script.indexOf('function renderViewport'), script.indexOf('function renderViewport') + 150);
            assert.ok(block.includes('if (!logEl || !logEl.clientHeight) return'), 'renderViewport should guard logEl');
        });
        test('should guard children[ni] in findNextDotSibling', () => {
            const block = script.slice(script.indexOf('function findNextDotSibling'), script.indexOf('function findNextDotSibling') + 300);
            assert.ok(block.includes('if (!children[ni]) continue'), 'findNextDotSibling should guard children[ni]');
        });
    });
});
//# sourceMappingURL=viewer-script-null-guards.test.js.map
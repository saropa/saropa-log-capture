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
const viewer_context_menu_1 = require("../../ui/viewer-context-menu/viewer-context-menu");
suite('ViewerContextMenu', () => {
    suite('getContextMenuScript', () => {
        test('should return JavaScript code', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.length > 0);
            assert.ok(script.includes('function initContextMenu'));
            assert.ok(script.includes('function showContextMenu'));
            assert.ok(script.includes('function hideContextMenu'));
            assert.ok(script.includes('function onContextMenuAction'));
        });
        test('should track context menu open state for programmatic-scroll coordination', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('isContextMenuOpen'));
            assert.ok(script.includes('__programmaticScroll'));
        });
        test('should use getSelectionRange helper for selection detection across actions', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('function getSelectionRange(lineIdx)'));
            assert.ok(script.includes('selectionStart'));
            assert.ok(script.includes('selectionEnd'));
            /* All selection-aware actions should call the helper, not inline the boilerplate. */
            const helper = script.indexOf('function getSelectionRange');
            const handler = script.indexOf('function handleLineAction');
            assert.ok(helper < handler, 'getSelectionRange should be defined before handleLineAction');
        });
        test('should copy all selected lines when multiple lines selected (Copy Line uses getSelectedLines)', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('getSelectedLines'));
            assert.ok(script.includes('linesToPlainText'));
        });
        test('should use copyContextLines for Copy with source (expand range before/after)', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('copyContextLines'));
            assert.ok(script.includes('setCopyContextLines'));
            assert.ok(script.includes('loExpand'));
            assert.ok(script.includes('hiExpand'));
        });
        test('should handle all expected actions', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes("case 'copy':"));
            assert.ok(script.includes("case 'copy-decorated':"));
            assert.ok(script.includes("case 'search-codebase':"));
            assert.ok(script.includes("case 'search-sessions':"));
            assert.ok(script.includes("case 'add-watch':"));
            assert.ok(script.includes("case 'add-exclusion':"));
            assert.ok(script.includes("case 'pin':"));
            assert.ok(script.includes("case 'annotate':"));
            assert.ok(script.includes("case 'open-source':"));
            assert.ok(script.includes("case 'show-context':"));
            assert.ok(script.includes("case 'copy-line-number':"));
            assert.ok(script.includes("case 'copy-timestamp':"));
        });
        test('copy-line-number posts the 1-based row position', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            /* 1-based: matches the counter decoration users see; the rest of the UI is 1-based too. */
            assert.ok(script.includes('String(lineIdx + 1)'));
            /* Goes through the generic clipboard postMessage path — no new host route needed. */
            const idx = script.indexOf("case 'copy-line-number':");
            const snippet = script.slice(idx, idx + 400);
            assert.ok(snippet.includes("type: 'copyToClipboard'"));
            assert.ok(snippet.includes('String(lineIdx + 1)'));
        });
        test('copy-timestamp guards missing epoch and emits ISO 8601', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            const idx = script.indexOf("case 'copy-timestamp':");
            assert.ok(idx >= 0);
            const snippet = script.slice(idx, idx + 500);
            /* Both .timestamp (canonical) and .ts (legacy) must be checked — dropping either makes
               the copy silently empty on stack frames or markers depending on code path. */
            assert.ok(snippet.includes('lineData.timestamp || lineData.ts'));
            /* Null-guard: the visibility layer hides the item when no ts, but the handler must still
               refuse to post an empty ISO string if a race exposes it. */
            assert.ok(snippet.includes('if (!tsVal) return true;'));
            assert.ok(snippet.includes('new Date(tsVal).toISOString()'));
            assert.ok(snippet.includes("type: 'copyToClipboard'"));
        });
        test('showContextMenu hides copy-timestamp when the line has no epoch', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            /* The data-timestamp-action filter sits alongside data-line-action / data-source-action
               so that markers and synthetic rows (which have no .timestamp) don't expose a button
               that would copy an empty string. */
            assert.ok(script.includes("querySelectorAll('[data-timestamp-action]')"));
            assert.ok(script.includes('lineData.timestamp || lineData.ts'));
        });
        test('copy-decorated should use linesToDecoratedText for decorated copy', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            const start = script.indexOf("case 'copy-decorated':");
            assert.ok(start >= 0, 'copy-decorated case must exist');
            const block = script.slice(start, start + 800);
            assert.ok(block.includes('linesToDecoratedText'), 'should call linesToDecoratedText');
            assert.ok(block.includes('getSelectedLines'), 'should support multi-line selection');
            assert.ok(block.includes('copyToClipboard'), 'should post clipboard message');
        });
        test('should handle hide/unhide line actions', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes("case 'hide-line':"));
            assert.ok(script.includes("case 'unhide-line':"));
            assert.ok(script.includes("case 'hide-selection':"));
            assert.ok(script.includes("case 'unhide-selection':"));
            assert.ok(script.includes("case 'hide-all-visible':"));
            assert.ok(script.includes("case 'unhide-all':"));
            assert.ok(script.includes('hideLine'));
            assert.ok(script.includes('unhideLine'));
            assert.ok(script.includes('hideAllVisible'));
            assert.ok(script.includes('unhideAll'));
        });
        test('should check hidden line state for menu visibility', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('isLineHidden'));
            assert.ok(script.includes('hasHiddenLines'));
            assert.ok(script.includes('hasSelectionWithHidden'));
            assert.ok(script.includes('hide-lines-submenu'));
        });
        test('should handle copy-selection, select-all, and export-current-view global actions', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('function handleGlobalAction'));
            assert.ok(script.includes("'copy-selection'"));
            assert.ok(script.includes("'select-all'"));
            assert.ok(script.includes("'export-current-view'"));
            assert.ok(script.includes('window.openExportModal'));
        });
        test('handleGlobalAction should take savedLineIdx and pass lineIdx from onContextMenuAction (copy after shift-click)', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('function handleGlobalAction(action, savedLineIdx)'));
            assert.ok(script.includes('handleGlobalAction(action, lineIdx)'));
            assert.ok(script.includes('Native selection is empty'));
        });
        test('copy-with-source global handler should return false when selection empty so line-scoped handler runs', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            const start = script.indexOf("if (action === 'copy-with-source')");
            assert.ok(start >= 0, 'copy-with-source branch missing');
            const branch = script.slice(start, start + 600);
            assert.ok(/return false/.test(branch), 'expected return false when no selection/refs so fallthrough to line case');
        });
        test('should handle source-link actions', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('function handleSourceAction'));
            assert.ok(script.includes("'open-source-link'"));
            assert.ok(script.includes("'copy-relative-path'"));
            assert.ok(script.includes("'copy-full-path'"));
        });
        test('should detect source-link on right-click', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes("e.target.closest('.source-link')"));
            assert.ok(script.includes('contextMenuSourcePath'));
        });
        test('should handle toggle actions for Layout submenu', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('function handleToggleAction'));
            assert.ok(script.includes("'toggle-wrap'"));
            assert.ok(script.includes("'toggle-spacing'"));
            assert.ok(script.includes("'toggle-line-height'"));
            assert.ok(script.includes("'toggle-hide-blank-lines'"));
            assert.ok(script.includes("'toggle-compress-lines'"));
            assert.ok(script.includes("'toggle-compress-lines-global'"));
        });
        test('should sync toggle checkmarks from state variables', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('function syncContextMenuToggles'));
            assert.ok(script.includes('wordWrap'));
            assert.ok(script.includes('visualSpacingEnabled'));
            assert.ok(script.includes('logLineHeight'));
            assert.ok(script.includes('hideBlankLines'));
            assert.ok(script.includes('compressLinesMode'));
            assert.ok(script.includes('compressNonConsecutiveMode'));
        });
        test('should clamp menu to viewport so bottom/right are never cropped', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('function positionContextMenu'));
            assert.ok(script.includes('window.innerHeight'));
            assert.ok(script.includes('window.innerWidth'));
            assert.ok(script.includes('rect.bottom > window.innerHeight'));
            assert.ok(script.includes('innerHeight - rect.height'));
        });
        test('should flip submenus vertically when menu is near bottom so flyouts stay on screen', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('flip-submenu-vertical'));
            assert.ok(script.includes('rect.bottom + submenuMaxH > window.innerHeight'));
        });
        test('should push submenu content down when menu is near top so flyout top is not cropped', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('flip-submenu-vertical-top'));
            assert.ok(script.includes('--submenu-content-top'));
            assert.ok(script.includes('rect.top <'));
        });
        test('should disable show-code-quality when codeQuality adapter is off (open report is footer-only)', () => {
            const script = (0, viewer_context_menu_1.getContextMenuScript)();
            assert.ok(script.includes('function setContextMenuItemDisabled'));
            assert.ok(script.includes('is-disabled'));
            assert.ok(script.includes("classList.contains('is-disabled')"));
            assert.ok(script.includes('window.integrationAdapters'));
            assert.ok(script.includes("indexOf('codeQuality')"));
            assert.ok(script.includes("'show-code-quality'"));
            assert.ok(!script.includes("'open-quality-report'"));
        });
    });
});
//# sourceMappingURL=viewer-context-menu.test.js.map
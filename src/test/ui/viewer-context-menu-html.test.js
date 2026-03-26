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
suite('ViewerContextMenuHtml', () => {
    suite('getContextMenuHtml', () => {
        test('should return HTML for context menu', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('id="context-menu"'));
            assert.ok(html.includes('class="context-menu"'));
        });
        test('should include top-level menu items', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('> Copy\n'));
            assert.ok(html.includes('Select All'));
            assert.ok(html.includes('Copy Line'));
            assert.ok(html.includes('Copy All'));
            assert.ok(html.includes('Copy to Search'));
            assert.ok(html.includes('Open Source File'));
        });
        test('should include Search submenu with items', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('> Search\n'));
            assert.ok(html.includes('Search Codebase'));
            assert.ok(html.includes('Search Past Logs'));
            assert.ok(html.includes('Analyze Across Logs'));
            assert.ok(html.includes('Generate Bug Report'));
        });
        test('should include Actions submenu with items', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('> Actions\n'));
            assert.ok(html.includes('Pin Line'));
            assert.ok(html.includes('Bookmark Line'));
            assert.ok(html.includes('Edit Line'));
            assert.ok(html.includes('Show Context'));
            assert.ok(html.includes('Add to Watch List'));
            assert.ok(!html.includes('Add to Exclusions'));
        });
        test('should include Options submenu with toggle items', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('> Options\n'));
            assert.ok(html.includes('data-action="toggle-wrap"'));
            assert.ok(html.includes('data-action="toggle-decorations"'));
            assert.ok(html.includes('data-action="toggle-timestamp"'));
            assert.ok(html.includes('data-action="toggle-session-elapsed"'));
            assert.ok(html.includes('data-action="toggle-spacing"'));
            assert.ok(html.includes('data-action="toggle-line-height"'));
            assert.ok(html.includes('data-action="toggle-compress-lines"'));
            assert.ok(html.includes('data-action="toggle-compress-lines-global"'));
            assert.ok(html.includes('Word wrap'));
            assert.ok(html.includes('Line decorations (dot, number, time)'));
            assert.ok(html.includes('Timestamp'));
            assert.ok(html.includes('Session elapsed'));
            assert.ok(html.includes('Visual spacing'));
            assert.ok(html.includes('Comfortable line height'));
            assert.ok(html.includes('Compress lines (consecutive dupes)'));
            assert.ok(html.includes('Compress lines (non-consecutive dupes)'));
        });
        test('should include leading codicons on Options toggles and hide-blank toggle', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('data-action="toggle-wrap"') && html.includes('codicon-word-wrap'));
            assert.ok(html.includes('codicon-symbol-event') && html.includes('toggle-decorations'));
            assert.ok(html.includes('codicon-clock') && html.includes('toggle-timestamp'));
            assert.ok(html.includes('codicon-watch') && html.includes('toggle-session-elapsed'));
            assert.ok(html.includes('codicon-layout-panel') && html.includes('toggle-spacing'));
            assert.ok(html.includes('codicon-unfold') && html.includes('toggle-line-height'));
            assert.ok(html.includes('<span class="codicon codicon-fold" aria-hidden="true"></span>'));
            assert.ok(html.includes('<span class="codicon codicon-fold-down" aria-hidden="true"></span>'));
            assert.ok(html.includes('codicon-blank') && html.includes('toggle-hide-blank-lines'));
        });
        test('should not put open-quality-report in context menu (footer Actions only)', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(!html.includes('data-action="open-quality-report"'));
            /* False positive guard: substring must not appear in comments or alternate attributes */
            assert.ok(!html.includes('open-quality-report'));
        });
        test('should keep hide-only controls out of Options submenu', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            const optionsStart = html.indexOf('> Options');
            assert.ok(optionsStart >= 0);
            const optionsEnd = html.indexOf('</div>\n    </div>\n</div>', optionsStart);
            const optionsBlock = optionsEnd > optionsStart ? html.slice(optionsStart, optionsEnd) : html.slice(optionsStart);
            assert.ok(!optionsBlock.includes('toggle-hide-blank-lines'));
            assert.ok(!optionsBlock.includes('Hide blank lines'));
            assert.ok(!optionsBlock.includes('Hide This Text (Always)'));
        });
        test('should include data-action attributes', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('data-action="copy-selection"'));
            assert.ok(html.includes('data-action="select-all"'));
            assert.ok(html.includes('data-action="copy"'));
            assert.ok(html.includes('data-action="search-codebase"'));
            assert.ok(html.includes('data-action="search-sessions"'));
            assert.ok(html.includes('data-action="open-source"'));
            assert.ok(html.includes('data-action="show-context"'));
            assert.ok(html.includes('data-action="pin"'));
            assert.ok(html.includes('data-action="add-watch"'));
            assert.ok(html.includes('data-action="add-exclusion"'));
            assert.ok(html.includes('data-action="explain-root-cause-hypotheses"'));
        });
        test('should mark line-specific items with data-line-action', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('data-action="copy" data-line-action'));
            assert.ok(!html.includes('data-action="copy-selection" data-line-action'));
            assert.ok(!html.includes('data-action="select-all" data-line-action'));
        });
        test('should mark Search and Actions submenus as line-specific', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('class="context-menu-submenu" data-line-action'));
        });
        test('should not mark Options submenu as line-specific', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('class="context-menu-submenu">\n' +
                '        <span class="codicon codicon-settings-gear">'));
        });
        test('should include source-link menu items with data-source-action', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('data-action="open-source-link" data-source-action'));
            assert.ok(html.includes('data-action="copy-relative-path" data-source-action'));
            assert.ok(html.includes('data-action="copy-full-path" data-source-action'));
            assert.ok(html.includes('Open File'));
            assert.ok(html.includes('Copy Relative Path'));
            assert.ok(html.includes('Copy Full Path'));
        });
        test('should not mark source-link items with data-line-action', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(!html.includes('data-action="open-source-link" data-line-action'));
            assert.ok(!html.includes('data-action="copy-relative-path" data-line-action'));
            assert.ok(!html.includes('data-action="copy-full-path" data-line-action'));
        });
        test('should include codicon classes for icons', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('codicon-copy'));
            assert.ok(html.includes('codicon-search'));
            assert.ok(html.includes('codicon-history'));
            assert.ok(html.includes('codicon-pin'));
            assert.ok(html.includes('codicon-eye'));
            assert.ok(html.includes('codicon-eye-closed'));
        });
        test('should include Hide submenu with actions', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('id="hide-lines-submenu"'));
            assert.ok(html.includes('> Hide\n'));
            assert.ok(html.includes('Hide This Line'));
            assert.ok(html.includes('Unhide This Line'));
            assert.ok(html.includes('Hide Selection'));
            assert.ok(html.includes('Unhide Selection'));
            assert.ok(html.includes('Hide This Text (Always)'));
            assert.ok(html.includes('Hide All Visible'));
            assert.ok(html.includes('Unhide All'));
            assert.ok(html.includes('data-action="toggle-hide-blank-lines"'));
            assert.ok(html.includes('Hide blank lines'));
            assert.ok(html.includes('data-action="add-exclusion"'));
        });
        test('should include hide/unhide action data attributes', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('data-action="hide-line"'));
            assert.ok(html.includes('data-action="unhide-line"'));
            assert.ok(html.includes('data-action="hide-selection"'));
            assert.ok(html.includes('data-action="unhide-selection"'));
            assert.ok(html.includes('data-action="hide-all-visible"'));
            assert.ok(html.includes('data-action="unhide-all"'));
        });
        test('should mark selection-based hide items with data-selection-action', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('data-action="hide-selection" data-selection-action'));
            assert.ok(html.includes('data-action="unhide-selection" data-selection-action'));
        });
        test('should include submenu structure elements', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('context-menu-submenu'));
            assert.ok(html.includes('context-menu-submenu-content'));
            assert.ok(html.includes('context-menu-arrow'));
            assert.ok(html.includes('codicon-chevron-right'));
        });
        test('should include toggle structure for Options items', () => {
            const html = (0, viewer_context_menu_1.getContextMenuHtml)();
            assert.ok(html.includes('context-menu-toggle'));
            assert.ok(html.includes('context-menu-check'));
            assert.ok(html.includes('codicon-check'));
        });
    });
});
//# sourceMappingURL=viewer-context-menu-html.test.js.map
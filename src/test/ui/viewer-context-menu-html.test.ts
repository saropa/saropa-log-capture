import * as assert from 'node:assert';
import { getContextMenuHtml } from '../../ui/viewer-context-menu/viewer-context-menu';

suite('ViewerContextMenuHtml', () => {
    suite('getContextMenuHtml', () => {
        test('should return HTML for context menu', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('id="context-menu"'));
            assert.ok(html.includes('class="context-menu"'));
        });

        test('should include top-level menu items', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('> Copy\n'));
            assert.ok(html.includes('Select All'));
            assert.ok(html.includes('Copy Line'));
            assert.ok(html.includes('Copy All'));
            assert.ok(html.includes('Copy to Search'));
            assert.ok(html.includes('Open Source File'));
        });

        test('should include Search submenu with items', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('> Search\n'));
            assert.ok(html.includes('Search Codebase'));
            assert.ok(html.includes('Search Past Logs'));
            assert.ok(html.includes('Analyze Across Logs'));
            assert.ok(html.includes('Generate Bug Report'));
        });

        test('should include Actions submenu with items', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('> Actions\n'));
            assert.ok(html.includes('Pin Line'));
            assert.ok(html.includes('Bookmark Line'));
            assert.ok(html.includes('Edit Line'));
            assert.ok(html.includes('Show Context'));
            assert.ok(html.includes('Add to Watch List'));
            assert.ok(html.includes('Add to Exclusions'));
        });

        test('should include Options submenu with toggle items', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('> Options\n'));
            assert.ok(html.includes('data-action="toggle-wrap"'));
            assert.ok(html.includes('data-action="toggle-decorations"'));
            assert.ok(html.includes('data-action="toggle-timestamp"'));
            assert.ok(html.includes('data-action="toggle-session-elapsed"'));
            assert.ok(html.includes('data-action="toggle-spacing"'));
            assert.ok(html.includes('data-action="toggle-line-height"'));
            assert.ok(html.includes('data-action="toggle-hide-blank-lines"'));
            assert.ok(html.includes('data-action="toggle-compress-lines"'));
            assert.ok(html.includes('Word wrap'));
            assert.ok(html.includes('Line decorations (dot, number, time)'));
            assert.ok(html.includes('Timestamp'));
            assert.ok(html.includes('Session elapsed'));
            assert.ok(html.includes('Visual spacing'));
            assert.ok(html.includes('Comfortable line height'));
            assert.ok(html.includes('Hide blank lines'));
            assert.ok(html.includes('Compress lines'));
        });

        test('should include data-action attributes', () => {
            const html = getContextMenuHtml();
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
        });

        test('should mark line-specific items with data-line-action', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('data-action="copy" data-line-action'));
            assert.ok(!html.includes('data-action="copy-selection" data-line-action'));
            assert.ok(!html.includes('data-action="select-all" data-line-action'));
        });

        test('should mark Search and Actions submenus as line-specific', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('class="context-menu-submenu" data-line-action'));
        });

        test('should not mark Options submenu as line-specific', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes(
                'class="context-menu-submenu">\n' +
                '        <span class="codicon codicon-settings-gear">',
            ));
        });

        test('should include source-link menu items with data-source-action', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('data-action="open-source-link" data-source-action'));
            assert.ok(html.includes('data-action="copy-relative-path" data-source-action'));
            assert.ok(html.includes('data-action="copy-full-path" data-source-action'));
            assert.ok(html.includes('Open File'));
            assert.ok(html.includes('Copy Relative Path'));
            assert.ok(html.includes('Copy Full Path'));
        });

        test('should not mark source-link items with data-line-action', () => {
            const html = getContextMenuHtml();
            assert.ok(!html.includes('data-action="open-source-link" data-line-action'));
            assert.ok(!html.includes('data-action="copy-relative-path" data-line-action'));
            assert.ok(!html.includes('data-action="copy-full-path" data-line-action'));
        });

        test('should include codicon classes for icons', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('codicon-copy'));
            assert.ok(html.includes('codicon-search'));
            assert.ok(html.includes('codicon-history'));
            assert.ok(html.includes('codicon-pin'));
            assert.ok(html.includes('codicon-eye'));
            assert.ok(html.includes('codicon-eye-closed'));
        });

        test('should include Hide submenu with actions', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('id="hide-lines-submenu"'));
            assert.ok(html.includes('> Hide\n'));
            assert.ok(html.includes('Hide This Line'));
            assert.ok(html.includes('Unhide This Line'));
            assert.ok(html.includes('Hide Selection'));
            assert.ok(html.includes('Unhide Selection'));
            assert.ok(html.includes('Hide All Visible'));
            assert.ok(html.includes('Unhide All'));
        });

        test('should include hide/unhide action data attributes', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('data-action="hide-line"'));
            assert.ok(html.includes('data-action="unhide-line"'));
            assert.ok(html.includes('data-action="hide-selection"'));
            assert.ok(html.includes('data-action="unhide-selection"'));
            assert.ok(html.includes('data-action="hide-all-visible"'));
            assert.ok(html.includes('data-action="unhide-all"'));
        });

        test('should mark selection-based hide items with data-selection-action', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('data-action="hide-selection" data-selection-action'));
            assert.ok(html.includes('data-action="unhide-selection" data-selection-action'));
        });

        test('should include submenu structure elements', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('context-menu-submenu'));
            assert.ok(html.includes('context-menu-submenu-content'));
            assert.ok(html.includes('context-menu-arrow'));
            assert.ok(html.includes('codicon-chevron-right'));
        });

        test('should include toggle structure for Options items', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('context-menu-toggle'));
            assert.ok(html.includes('context-menu-check'));
            assert.ok(html.includes('codicon-check'));
        });
    });
});

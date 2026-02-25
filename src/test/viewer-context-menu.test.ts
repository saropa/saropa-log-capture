import * as assert from 'assert';
import { getContextMenuScript, getContextMenuHtml } from '../ui/viewer-context-menu';

suite('ViewerContextMenu', () => {

    suite('getContextMenuScript', () => {
        test('should return JavaScript code', () => {
            const script = getContextMenuScript();
            assert.ok(script.length > 0);
            assert.ok(script.includes('function initContextMenu'));
            assert.ok(script.includes('function showContextMenu'));
            assert.ok(script.includes('function hideContextMenu'));
            assert.ok(script.includes('function onContextMenuAction'));
        });

        test('should handle all expected actions', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes("case 'copy':"));
            assert.ok(script.includes("case 'search-codebase':"));
            assert.ok(script.includes("case 'search-sessions':"));
            assert.ok(script.includes("case 'add-watch':"));
            assert.ok(script.includes("case 'add-exclusion':"));
            assert.ok(script.includes("case 'pin':"));
            assert.ok(script.includes("case 'annotate':"));
            assert.ok(script.includes("case 'open-source':"));
            assert.ok(script.includes("case 'show-context':"));
        });

        test('should handle copy-selection and select-all global actions', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function handleGlobalAction'));
            assert.ok(script.includes("'copy-selection'"));
            assert.ok(script.includes("'select-all'"));
        });

        test('should handle source-link actions', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function handleSourceAction'));
            assert.ok(script.includes("'open-source-link'"));
            assert.ok(script.includes("'copy-relative-path'"));
            assert.ok(script.includes("'copy-full-path'"));
        });

        test('should detect source-link on right-click', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes("e.target.closest('.source-link')"));
            assert.ok(script.includes('contextMenuSourcePath'));
        });

        test('should handle toggle actions for Options submenu', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function handleToggleAction'));
            assert.ok(script.includes("'toggle-wrap'"));
            assert.ok(script.includes("'toggle-decorations'"));
            assert.ok(script.includes("'toggle-spacing'"));
        });

        test('should sync toggle checkmarks from state variables', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function syncContextMenuToggles'));
            assert.ok(script.includes('wordWrap'));
            assert.ok(script.includes('showDecorations'));
            assert.ok(script.includes('visualSpacingEnabled'));
        });
    });

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
            assert.ok(html.includes('Search Past Sessions'));
            assert.ok(html.includes('Analyze Across Sessions'));
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
            assert.ok(html.includes('data-action="toggle-spacing"'));
            assert.ok(html.includes('Word wrap'));
            assert.ok(html.includes('Line prefix'));
            assert.ok(html.includes('Visual spacing'));
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
            // Global items should NOT have data-line-action
            assert.ok(!html.includes('data-action="copy-selection" data-line-action'));
            assert.ok(!html.includes('data-action="select-all" data-line-action'));
        });

        test('should mark Search and Actions submenus as line-specific', () => {
            const html = getContextMenuHtml();
            // Submenu containers should have data-line-action
            assert.ok(html.includes('class="context-menu-submenu" data-line-action'));
        });

        test('should not mark Options submenu as line-specific', () => {
            const html = getContextMenuHtml();
            // The Options submenu container: class="context-menu-submenu"> with no data-line-action
            // Search and Actions containers: class="context-menu-submenu" data-line-action>
            // Verify Options submenu opens with submenu class directly followed by >, then the gear icon
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

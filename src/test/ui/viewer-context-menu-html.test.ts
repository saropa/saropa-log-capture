import * as assert from 'node:assert';
import { getContextMenuHtml, getScrollChromeContextMenuHtml } from '../../ui/viewer-context-menu/viewer-context-menu';

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
            assert.ok(!html.includes('Add to Exclusions'));
        });

        test('should include Layout submenu with toggle items', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('> Layout\n'));
            assert.ok(
                html.includes('codicon-settings-gear"></span> Layout'),
                'gear row is the layout/toggles submenu (was labeled Options)',
            );
            assert.ok(
                !html.includes('codicon-settings-gear"></span> Options'),
                'layout submenu must not use the old Options label',
            );
            assert.ok(html.includes('data-action="toggle-wrap"'));
            assert.ok(html.includes('data-action="toggle-timestamp"'));
            assert.ok(html.includes('data-action="toggle-session-elapsed"'));
            assert.ok(html.includes('data-action="toggle-spacing"'));
            assert.ok(html.includes('data-action="toggle-line-height"'));
            assert.ok(html.includes('data-action="toggle-compress-lines"'));
            assert.ok(html.includes('data-action="toggle-compress-lines-global"'));
            assert.ok(html.includes('Word wrap'));
            assert.ok(html.includes('Timestamp'));
            assert.ok(html.includes('Session elapsed'));
            assert.ok(html.includes('Visual spacing'));
            assert.ok(html.includes('Comfortable line height'));
            assert.ok(html.includes('Compress lines (consecutive dupes)'));
            assert.ok(html.includes('Compress lines (non-consecutive dupes)'));
        });

        test('should include leading codicons on Layout toggles and hide-blank toggle', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('data-action="toggle-wrap"') && html.includes('codicon-word-wrap'));
            assert.ok(html.includes('codicon-clock') && html.includes('toggle-timestamp'));
            assert.ok(html.includes('codicon-watch') && html.includes('toggle-session-elapsed'));
            assert.ok(html.includes('codicon-layout-panel') && html.includes('toggle-spacing'));
            assert.ok(html.includes('codicon-unfold') && html.includes('toggle-line-height'));
            assert.ok(html.includes('<span class="codicon codicon-fold" aria-hidden="true"></span>'));
            assert.ok(html.includes('<span class="codicon codicon-fold-down" aria-hidden="true"></span>'));
            assert.ok(
                /\bdata-action="toggle-hide-blank-lines"[\s\S]{0,120}codicon-eye-closed\b/.test(html),
                'hide blank lines toggle should use the same eye-closed icon as other Hide items'
            );
            assert.ok(
                !html.includes('codicon-blank'),
                'context menu HTML must not use codicon-blank (invisible); it broke Hide blank lines alignment'
            );
        });

        test('should not put open-quality-report in context menu (footer Actions only)', () => {
            const html = getContextMenuHtml();
            assert.ok(!html.includes('data-action="open-quality-report"'));
            /* False positive guard: substring must not appear in comments or alternate attributes */
            assert.ok(!html.includes('open-quality-report'));
        });

        test('should keep hide-only controls out of Layout submenu', () => {
            const html = getContextMenuHtml();
            const optionsStart = html.indexOf('> Layout');
            assert.ok(optionsStart >= 0);
            const scrollChromeSub = html.indexOf('id="scroll-chrome-submenu"', optionsStart);
            const optionsEnd = scrollChromeSub > optionsStart ? scrollChromeSub : html.indexOf('</div>\n    </div>\n</div>', optionsStart);
            const optionsBlock = optionsEnd > optionsStart ? html.slice(optionsStart, optionsEnd) : html.slice(optionsStart);
            assert.ok(!optionsBlock.includes('toggle-hide-blank-lines'));
            assert.ok(!optionsBlock.includes('Hide blank lines'));
            assert.ok(!optionsBlock.includes('Hide This Text (Always)'));
        });

        test('should include Scroll map & scrollbar submenu with minimap and scrollbar toggles', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('id="scroll-chrome-submenu"'));
            assert.ok(html.includes('Scroll map & scrollbar'));
            assert.ok(html.includes('data-action="toggle-minimap-proportional"'));
            assert.ok(html.includes('data-action="toggle-show-scrollbar"'));
            assert.ok(html.includes('data-action="toggle-minimap-sql-density"'));
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
            assert.ok(html.includes('data-action="explain-root-cause-hypotheses"'));
        });

        test('should include Copy Line Decorated menu item', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('Copy Line Decorated'));
            assert.ok(html.includes('data-action="copy-decorated" data-line-action'));
        });

        test('should group "All" items between separators in Copy & Export submenu', () => {
            const html = getContextMenuHtml();
            const copyAllIdx = html.indexOf('data-action="copy-all"');
            const copyAllDecIdx = html.indexOf('data-action="copy-all-decorated"');
            const snippetIdx = html.indexOf('data-action="copy-as-snippet"');
            assert.ok(copyAllIdx > 0);
            assert.ok(copyAllDecIdx > copyAllIdx, 'Copy All Decorated should follow Copy All');
            assert.ok(snippetIdx > copyAllDecIdx, 'Copy as snippet should follow Copy All Decorated');

            // Separator before the "All" group
            const beforeAll = html.lastIndexOf('context-menu-separator', copyAllIdx);
            assert.ok(beforeAll > 0, 'separator should precede the All group');
            // No non-separator menu items between the separator and Copy All
            const betweenSepAndAll = html.slice(beforeAll, copyAllIdx);
            assert.ok(!betweenSepAndAll.includes('data-action='), 'no actions between separator and Copy All');

            // Separator after the "All" group
            const afterSnippet = html.indexOf('context-menu-separator', snippetIdx);
            assert.ok(afterSnippet > snippetIdx, 'separator should follow the All group');
            const betweenSnippetAndSep = html.slice(snippetIdx + 1, afterSnippet);
            assert.ok(!betweenSnippetAndSep.includes('data-action="copy-with-source"'), 'copy-with-source should be after the separator');
        });

        test('should mark line-specific items with data-line-action', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('data-action="copy" data-line-action'));
            assert.ok(html.includes('data-action="copy-decorated" data-line-action'));
            assert.ok(!html.includes('data-action="copy-selection" data-line-action'));
            assert.ok(!html.includes('data-action="select-all" data-line-action'));
        });

        test('should mark Search and Actions submenus as line-specific', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('class="context-menu-submenu" data-line-action'));
        });

        test('should not mark Layout submenu as line-specific', () => {
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
            assert.ok(html.includes('Hide This Text (Always)'));
            assert.ok(html.includes('Hide All Visible'));
            assert.ok(html.includes('Unhide All'));
            assert.ok(html.includes('data-action="toggle-hide-blank-lines"'));
            assert.ok(html.includes('Hide blank lines'));
            assert.ok(html.includes('data-action="add-exclusion"'));
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

        test('should include toggle structure for Layout items', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('context-menu-toggle'));
            assert.ok(html.includes('context-menu-check'));
            assert.ok(html.includes('codicon-check'));
        });

        test('should use context-menu-label class on all toggle text spans', () => {
            const html = getContextMenuHtml();
            const toggleActions = [
                'toggle-wrap', 'toggle-timestamp',
                'toggle-session-elapsed', 'toggle-spacing', 'toggle-line-height',
                'toggle-compress-lines', 'toggle-compress-lines-global',
                'toggle-hide-blank-lines',
                'toggle-minimap-proportional', 'toggle-show-scrollbar',
                'toggle-minimap-info-markers', 'toggle-minimap-sql-density',
                'toggle-minimap-viewport-red-outline', 'toggle-minimap-outside-arrow',
            ];
            for (const action of toggleActions) {
                const pattern = new RegExp(
                    `data-action="${action}"[\\s\\S]{0,300}class="context-menu-label"`,
                );
                assert.ok(
                    pattern.test(html),
                    `toggle ${action} should have context-menu-label on its text span`,
                );
            }
        });
    });

    suite('getScrollChromeContextMenuHtml', () => {
        test('should expose the same toggles as the Scroll map submenu (minimap / scrollbar right-click)', () => {
            const html = getScrollChromeContextMenuHtml();
            assert.ok(html.includes('id="scroll-chrome-context-menu"'));
            assert.ok(html.includes('data-action="toggle-minimap-proportional"'));
            assert.ok(html.includes('data-action="toggle-show-scrollbar"'));
        });

        test('should include title attributes on scroll-chrome toggle items', () => {
            const html = getScrollChromeContextMenuHtml();
            assert.ok(html.includes('title="Proportional line width (minimap)"'));
            assert.ok(html.includes('title="Show native scrollbar"'));
            assert.ok(html.includes('title="Info / debug / notice on minimap"'));
            assert.ok(html.includes('title="SQL density on minimap"'));
            assert.ok(html.includes('title="Red outline on viewport"'));
            assert.ok(html.includes('title="Yellow arrow outside minimap"'));
        });
    });
});

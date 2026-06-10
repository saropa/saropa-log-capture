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
            assert.ok(html.includes('View Context'));
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
            assert.ok(html.includes('data-action="toggle-spacing"'));
            assert.ok(html.includes('data-action="toggle-line-height"'));
            assert.ok(html.includes('data-action="toggle-compress-lines"'));
            assert.ok(html.includes('data-action="toggle-compress-lines-global"'));
            assert.ok(html.includes('Word wrap'));
            assert.ok(html.includes('Visual spacing'));
            assert.ok(html.includes('Tall rows'));
            assert.ok(html.includes('Compress lines (consecutive dupes)'));
            assert.ok(html.includes('Compress lines (non-consecutive dupes)'));
        });

        test('should include leading codicons on Columns / Layout toggles and hide-blank toggle', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('data-action="toggle-wrap"') && html.includes('codicon-word-wrap'));
            assert.ok(html.includes('data-action="toggle-line-numbers"') && html.includes('codicon-list-ordered'));
            assert.ok(html.includes('codicon-clock') && html.includes('toggle-timestamp'));
            assert.ok(html.includes('codicon-watch') && html.includes('toggle-session-elapsed'));
            assert.ok(
                /\bdata-action="toggle-parsed-tag"[\s\S]{0,200}codicon-tag\b/.test(html),
                'parsed-tag toggle should use the tag codicon'
            );
            assert.ok(html.includes('codicon-layout-panel') && html.includes('toggle-spacing'));
            assert.ok(html.includes('codicon-unfold') && html.includes('toggle-line-height'));
            assert.ok(html.includes('<span class="codicon codicon-fold" aria-hidden="true"></span>'));
            assert.ok(html.includes('<span class="codicon codicon-fold-down" aria-hidden="true"></span>'));
            assert.ok(
                /\bdata-action="toggle-show-blank-lines"[\s\S]{0,120}codicon-whitespace\b/.test(html),
                'show blank lines toggle should use the whitespace icon'
            );
            assert.ok(
                !html.includes('codicon-blank'),
                'context menu HTML must not use codicon-blank (invisible); it broke blank lines toggle alignment'
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
            /* Layout is now the last submenu (scroll-chrome was removed), so bound by the menu close tag. */
            const optionsEnd = html.indexOf('</div>\n</div>', optionsStart);
            const optionsBlock = optionsEnd > optionsStart ? html.slice(optionsStart, optionsEnd) : html.slice(optionsStart);
            assert.ok(!optionsBlock.includes('toggle-show-blank-lines'));
            assert.ok(!optionsBlock.includes('Show blank lines'));
            assert.ok(!optionsBlock.includes('Hide This Text (Always)'));
        });

        test('should not include Scroll map & scrollbar submenu in main context menu', () => {
            /* Scroll map toggles are only in the compact scroll-chrome menu (right-click on minimap/scrollbar).
               Removed from main menu to reduce clutter — users right-click the minimap to access these. */
            const html = getContextMenuHtml();
            assert.ok(!html.includes('id="scroll-chrome-submenu"'));
            assert.ok(!html.includes('Scroll map & scrollbar'));
        });

        test('should place Copy Error, Copy DB cluster, and grouped separator immediately before Copy & Export', () => {
            const html = getContextMenuHtml();
            const ewIdx = html.indexOf('data-action="copy-error-warning-block"');
            const jsonIdx = html.indexOf('data-action="copy-error-warning-json"');
            const dbIdx = html.indexOf('data-action="copy-db-cluster-block"');
            const sepIdx = html.indexOf('data-grouped-block-copy-separator');
            const copyExportIdx = html.indexOf('id="copy-export-submenu"');
            /* Order: Copy Error block → Copy Error JSON → Copy DB cluster → separator → Copy & Export. */
            assert.ok(ewIdx > 0 && jsonIdx > ewIdx && dbIdx > jsonIdx && sepIdx > dbIdx && copyExportIdx > sepIdx);
            assert.ok(html.includes('data-ew-copy-label'));
            assert.ok(html.includes('data-ew-copy-icon'));
            /* JSON variant shares the data-copy-error-warning-row gate and carries its own label hook. */
            assert.ok(html.includes('data-ew-json-label'));
            assert.ok((html.match(/data-copy-error-warning-row/g) || []).length === 2);
            assert.ok(html.includes('codicon-error'));
            assert.ok(html.includes('Copy DB cluster'));
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

        test('should include Copy Line Number and Copy Timestamp line-scoped items', () => {
            const html = getContextMenuHtml();
            /* Both are line-only copy helpers that sit next to Copy Line / Copy Line Decorated. */
            assert.ok(html.includes('Copy Line Number'));
            assert.ok(html.includes('data-action="copy-line-number" data-line-action'));
            assert.ok(html.includes('Copy Timestamp'));
            /* Timestamp item carries data-timestamp-action so showContextMenu can hide it when the
               line has no epoch (markers, synthetic rows) — prevents silent empty-string copies. */
            assert.ok(html.includes('data-action="copy-timestamp" data-line-action data-timestamp-action'));
            /* Ordering: both new items appear between Copy Line Decorated and the first separator
               that precedes the "All" group, so they are grouped with the per-line copy helpers. */
            const decIdx = html.indexOf('data-action="copy-decorated"');
            const numIdx = html.indexOf('data-action="copy-line-number"');
            const tsIdx = html.indexOf('data-action="copy-timestamp"');
            const allIdx = html.indexOf('data-action="copy-all"');
            assert.ok(decIdx > 0 && numIdx > decIdx && tsIdx > numIdx && allIdx > tsIdx);
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
            assert.ok(html.includes('data-action="toggle-show-blank-lines"'));
            assert.ok(html.includes('Show blank lines'));
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
    });
});

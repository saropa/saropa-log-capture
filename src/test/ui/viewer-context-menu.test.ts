import * as assert from 'node:assert';
import { getContextMenuScript } from '../../ui/viewer-context-menu/viewer-context-menu';

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

        test('should track context menu open state for programmatic-scroll coordination', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('isContextMenuOpen'));
            assert.ok(script.includes('__programmaticScroll'));
        });

        test('should copy all selected lines when multiple lines selected (Copy Line uses getSelectedLines)', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('getSelectedLines'));
            assert.ok(script.includes('linesToPlainText'));
            assert.ok(script.includes('selectionStart'));
            assert.ok(script.includes('selectionEnd'));
        });

        test('should use copyContextLines for Copy with source (expand range before/after)', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('copyContextLines'));
            assert.ok(script.includes('setCopyContextLines'));
            assert.ok(script.includes('loExpand'));
            assert.ok(script.includes('hiExpand'));
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

        test('should handle hide/unhide line actions', () => {
            const script = getContextMenuScript();
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
            const script = getContextMenuScript();
            assert.ok(script.includes('isLineHidden'));
            assert.ok(script.includes('hasHiddenLines'));
            assert.ok(script.includes('hasSelectionWithHidden'));
            assert.ok(script.includes('hide-lines-submenu'));
        });

        test('should handle copy-selection, select-all, and export-current-view global actions', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function handleGlobalAction'));
            assert.ok(script.includes("'copy-selection'"));
            assert.ok(script.includes("'select-all'"));
            assert.ok(script.includes("'export-current-view'"));
            assert.ok(script.includes('window.openExportModal'));
        });

        test('handleGlobalAction should take savedLineIdx and pass lineIdx from onContextMenuAction (copy after shift-click)', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function handleGlobalAction(action, savedLineIdx)'));
            assert.ok(script.includes('handleGlobalAction(action, lineIdx)'));
            assert.ok(script.includes('Native selection is empty'));
        });

        test('copy-with-source global handler should return false when selection empty so line-scoped handler runs', () => {
            const script = getContextMenuScript();
            const start = script.indexOf("if (action === 'copy-with-source')");
            assert.ok(start >= 0, 'copy-with-source branch missing');
            const branch = script.slice(start, start + 600);
            assert.ok(
                /return false/.test(branch),
                'expected return false when no selection/refs so fallthrough to line case',
            );
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

        test('should handle toggle actions for Layout submenu', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function handleToggleAction'));
            assert.ok(script.includes("'toggle-wrap'"));
            assert.ok(script.includes("'toggle-spacing'"));
            assert.ok(script.includes("'toggle-line-height'"));
            assert.ok(script.includes("'toggle-hide-blank-lines'"));
            assert.ok(script.includes("'toggle-compress-lines'"));
            assert.ok(script.includes("'toggle-compress-lines-global'"));
        });

        test('should sync toggle checkmarks from state variables', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function syncContextMenuToggles'));
            assert.ok(script.includes('wordWrap'));
            assert.ok(script.includes('visualSpacingEnabled'));
            assert.ok(script.includes('logLineHeight'));
            assert.ok(script.includes('hideBlankLines'));
            assert.ok(script.includes('compressLinesMode'));
            assert.ok(script.includes('compressNonConsecutiveMode'));
        });

        test('should clamp menu to viewport so bottom/right are never cropped', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function positionContextMenu'));
            assert.ok(script.includes('window.innerHeight'));
            assert.ok(script.includes('window.innerWidth'));
            assert.ok(script.includes('rect.bottom > window.innerHeight'));
            assert.ok(script.includes('innerHeight - rect.height'));
        });

        test('should flip submenus vertically when menu is near bottom so flyouts stay on screen', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('flip-submenu-vertical'));
            assert.ok(script.includes('rect.bottom + submenuMaxH > window.innerHeight'));
        });

        test('should push submenu content down when menu is near top so flyout top is not cropped', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('flip-submenu-vertical-top'));
            assert.ok(script.includes('--submenu-content-top'));
            assert.ok(script.includes('rect.top <'));
        });

        test('should disable show-code-quality when codeQuality adapter is off (open report is footer-only)', () => {
            const script = getContextMenuScript();
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

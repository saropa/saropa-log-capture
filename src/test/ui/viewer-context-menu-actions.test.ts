import * as assert from 'node:assert';
import { getContextMenuScript } from '../../ui/viewer-context-menu/viewer-context-menu';

// Split from viewer-context-menu.test.ts to keep both files under the line limit.
suite('ViewerContextMenu (hide/global/toggle actions)', () => {

    suite('getContextMenuScript', () => {
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
            assert.ok(script.includes("'toggle-line-numbers'"));
            assert.ok(script.includes("'toggle-spacing'"));
            assert.ok(script.includes("'toggle-line-height'"));
            assert.ok(script.includes("'toggle-show-blank-lines'"));
            assert.ok(script.includes("'toggle-compress-lines'"));
            assert.ok(script.includes("'toggle-compress-lines-global'"));
        });

        test('should sync toggle checkmarks from state variables', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function syncContextMenuToggles'));
            assert.ok(script.includes('wordWrap'));
            assert.ok(script.includes('decoShowCounter'));
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

        test('should position each submenu flyout from its own trigger rect on mouseenter', () => {
            const script = getContextMenuScript();
            // Per-submenu placement replaced the old global flip-submenu* classes.
            assert.ok(script.includes('function positionSubmenu'));
            assert.ok(script.includes("addEventListener('mouseenter'"));
            assert.ok(script.includes('.context-menu-submenu-content'));
            // Direction chosen from the trigger's live rect, not a single root-menu class.
            assert.ok(script.includes('submenuEl.getBoundingClientRect()'));
            // The dead global model must be gone so it cannot override per-submenu placement.
            assert.ok(!script.includes('flip-submenu-vertical'));
            assert.ok(!script.includes('--submenu-content-top'));
        });

        test('should maximize a submenu flyout to the full viewport height and scroll only if it cannot fit', () => {
            const script = getContextMenuScript();
            // Fixed positioning + full-viewport height replaced the trigger-anchored one-sided cap.
            assert.ok(script.includes("flyout.style.position = 'fixed'"));
            assert.ok(script.includes('availableHeight'));
            assert.ok(script.includes('style.maxHeight'));
            // The old one-sided trigger-room model is gone so it cannot strand half the screen.
            assert.ok(!script.includes('spaceBelow'));
            assert.ok(!script.includes('spaceAbove'));
        });

        test('should cap a submenu flyout to the viewport WIDTH so a narrow panel never clips it off the right edge', () => {
            const script = getContextMenuScript();
            // Width is treated symmetrically with height: cap + horizontal scroll, not clip off-screen.
            assert.ok(script.includes('availableWidth'));
            assert.ok(script.includes('style.maxWidth'));
            assert.ok(script.includes("flyout.style.overflowX = 'auto'"));
            // Height must be capped BEFORE width is measured so a scrollbar-widened flyout is counted.
            const heightCap = script.indexOf('flyout.style.maxHeight = availableHeight');
            const widthMeasure = script.indexOf('Math.min(flyout.offsetWidth, availableWidth)');
            assert.ok(heightCap >= 0 && widthMeasure > heightCap, 'height cap must precede width measure');
        });

        test('should reposition the open context menu and submenu on viewport resize (responsive)', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes("addEventListener('resize'"));
            assert.ok(script.includes('function repositionOpenContextMenu'));
            assert.ok(script.includes('.context-menu-submenu:hover'));
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

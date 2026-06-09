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

        test('should use getSelectionRange helper for selection detection across actions', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function getSelectionRange(lineIdx)'));
            assert.ok(script.includes('selectionStart'));
            assert.ok(script.includes('selectionEnd'));
            /* All selection-aware actions should call the helper, not inline the boilerplate. */
            const helper = script.indexOf('function getSelectionRange');
            const handler = script.indexOf('function handleLineAction');
            assert.ok(helper < handler, 'getSelectionRange should be defined before handleLineAction');
        });

        test('should copy all selected lines when multiple lines selected (Copy Line uses getSelectedLines)', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('getSelectedLines'));
            assert.ok(script.includes('linesToPlainText'));
        });

        test('Copy Line must not hijack a single-line right-click when a stale shift-click selection exists', () => {
            const script = getContextMenuScript();
            /* Bug repro: previously `case 'copy'` (and `copy-decorated`) widened the selection
               check with `hasAnySel = selectionStart >= 0 && sel.hi > sel.lo`, so any prior
               shift-click range hijacked Copy Line on rows OUTSIDE the selection — the user
               right-clicked line 50 to copy line 50 and got lines 5-10 instead. The fix removes
               that fallback; only `sel.multiLine` (right-click is INSIDE the selection) triggers
               the multi-line branch. Guard the regression by asserting `hasAnySel` is gone and
               the surrounding `case 'copy'` / `case 'copy-decorated'` blocks no longer reference
               it. */
            assert.ok(!/hasAnySel/.test(script), 'hasAnySel must be removed from copy actions');
            const copyCase = script.indexOf("case 'copy':");
            assert.ok(copyCase >= 0);
            const copyBlock = script.slice(copyCase, copyCase + 1200);
            assert.ok(!copyBlock.includes('hasAnySel'));
            const decoCase = script.indexOf("case 'copy-decorated':");
            assert.ok(decoCase >= 0);
            const decoBlock = script.slice(decoCase, decoCase + 800);
            assert.ok(!decoBlock.includes('hasAnySel'));
        });

        test('Copy Line emits a "Copied line N (X characters)" toast and Copy Lines emits a range toast', () => {
            const script = getContextMenuScript();
            /* The toast message reads as natural English with locale-formatted numbers
               (toLocaleString gives "1,247 characters") so users can see what landed on
               the clipboard without squinting at the status bar. Assert the helper exists,
               the format strings are present, and `case 'copy'` calls it for both single
               and multi-line paths. */
            assert.ok(script.includes('function formatCopyToastMessage'));
            assert.ok(script.includes("'Copied lines '"));
            assert.ok(script.includes("'Copied line '"));
            assert.ok(script.includes('toLocaleString'));
            const copyCase = script.indexOf("case 'copy':");
            const copyBlock = script.slice(copyCase, copyCase + 1500);
            assert.ok(copyBlock.includes("formatCopyToastMessage('lines'"));
            assert.ok(copyBlock.includes("formatCopyToastMessage('line'"));
            assert.ok(copyBlock.includes('showCopyToast('));
        });

        test('Copy Line Decorated, Copy Line Number, and Copy Timestamp all surface a toast', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes("formatCopyToastMessage('line-decorated'"));
            assert.ok(script.includes("formatCopyToastMessage('lines-decorated'"));
            assert.ok(script.includes("formatCopyToastMessage('line-number'"));
            assert.ok(script.includes("formatCopyToastMessage('timestamp'"));
        });

        test('copy-selection global path also surfaces a toast (top-level Copy menu item)', () => {
            const script = getContextMenuScript();
            const start = script.indexOf("if (action === 'copy-selection')");
            assert.ok(start >= 0);
            const block = script.slice(start, start + 1500);
            assert.ok(block.includes('showCopyToast('));
            assert.ok(block.includes("formatCopyToastMessage('selection'"));
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
            /* Grouped-block copy actions moved to viewer-context-menu-block-copy.ts (handleBlockCopyAction),
               so they dispatch via `if (action === ...)` rather than a switch case. The JSON variant is new. */
            assert.ok(script.includes("action === 'copy-error-warning-block'"));
            assert.ok(script.includes("action === 'copy-error-warning-json'"));
            assert.ok(script.includes("action === 'copy-db-cluster-block'"));
        });

        test('should define incident range helpers before showContextMenu uses them', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('function computeIncidentLineRange'));
            assert.ok(script.includes('function effectiveErrorWarningLevel'));
            assert.ok(script.includes('mergeBanner'));
            assert.ok(script.includes('rangeHasCopyableIncident'));
            const incIdx = script.indexOf('function computeIncidentLineRange');
            const showIdx = script.indexOf('function showContextMenu');
            assert.ok(incIdx > 0 && showIdx > incIdx);
        });

        test('should define DB burst range helper before showContextMenu', () => {
            const script = getContextMenuScript();
            const dbIdx = script.indexOf('function computeDbTimestampBurstLineRange');
            const showIdx = script.indexOf('function showContextMenu');
            assert.ok(dbIdx > 0 && showIdx > dbIdx);
        });

        test('copy-line-number posts the 1-based row position', () => {
            const script = getContextMenuScript();
            /* 1-based: matches the counter decoration users see; the rest of the UI is 1-based too. */
            assert.ok(script.includes('String(lineIdx + 1)'));
            /* Goes through the generic clipboard postMessage path — no new host route needed.
               Snippet is 800 chars because the WHY comment above the implementation is long and
               we need to reach the vscodeApi.postMessage line that sits after it. */
            const idx = script.indexOf("case 'copy-line-number':");
            const snippet = script.slice(idx, idx + 800);
            assert.ok(snippet.includes("type: 'copyToClipboard'"));
            assert.ok(snippet.includes('String(lineIdx + 1)'));
        });

        test('copy-timestamp guards missing epoch and emits ISO 8601', () => {
            const script = getContextMenuScript();
            const idx = script.indexOf("case 'copy-timestamp':");
            assert.ok(idx >= 0);
            /* 900 chars: the WHY comment above this case is the longest in the file (covers
               .timestamp vs .ts rationale + ISO 8601 reasoning), so the snippet must extend past
               it to reach the `new Date(tsVal).toISOString()` line. */
            const snippet = script.slice(idx, idx + 900);
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
            const script = getContextMenuScript();
            /* The data-timestamp-action filter sits alongside data-line-action / data-source-action
               so that markers and synthetic rows (which have no .timestamp) don't expose a button
               that would copy an empty string. */
            assert.ok(script.includes("querySelectorAll('[data-timestamp-action]')"));
            assert.ok(script.includes('lineData.timestamp || lineData.ts'));
        });

        test('copy-decorated should use linesToDecoratedText for decorated copy', () => {
            const script = getContextMenuScript();
            const start = script.indexOf("case 'copy-decorated':");
            assert.ok(start >= 0, 'copy-decorated case must exist');
            const block = script.slice(start, start + 800);
            assert.ok(block.includes('linesToDecoratedText'), 'should call linesToDecoratedText');
            assert.ok(block.includes('getSelectedLines'), 'should support multi-line selection');
            assert.ok(block.includes('copyToClipboard'), 'should post clipboard message');
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

        test('should cap a too-tall submenu flyout to the available space so it scrolls instead of clipping', () => {
            const script = getContextMenuScript();
            assert.ok(script.includes('style.maxHeight'));
            assert.ok(script.includes('spaceBelow'));
            assert.ok(script.includes('spaceAbove'));
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

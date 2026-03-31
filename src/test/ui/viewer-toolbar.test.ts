import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { getToolbarHtml } from '../../ui/viewer-toolbar/viewer-toolbar-html';
import { getSearchFlyoutHtml } from '../../ui/viewer-toolbar/viewer-toolbar-search-html';
import { getFilterDrawerHtml } from '../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html';
import { getActionsDropdownHtml } from '../../ui/viewer-toolbar/viewer-toolbar-actions-html';

/**
 * Tests for the toolbar, search flyout, filter drawer, and actions dropdown.
 *
 * Verifies that all required DOM element IDs are preserved so existing
 * webview scripts continue to bind correctly.
 */
suite('Viewer toolbar', () => {

    function readSrc(relFromSrc: string): string {
        const fromOut = path.join(__dirname, '../../../src', relFromSrc);
        const fromSrcTree = path.join(__dirname, '../../', relFromSrc);
        const p = fs.existsSync(fromOut) ? fromOut : fromSrcTree;
        return fs.readFileSync(p, 'utf8');
    }

    test('toolbar HTML preserves required element IDs', () => {
        const html = getToolbarHtml({ version: '1.0.0' });
        const required = [
            'id="viewer-toolbar"',
            'id="toolbar-search-btn"',
            'id="toolbar-filter-btn"',
            'id="toolbar-actions-btn"',
            'id="level-menu-btn"',
            'id="line-count"',
            'id="hidden-lines-counter"',
            'id="footer-selection"',
            'id="toolbar-signals-btn"',
            'id="footer-text"',
        ];
        for (const id of required) {
            assert.ok(html.includes(id), `toolbar must contain ${id}`);
        }
    });

    test('toolbar HTML has data-version attribute', () => {
        const html = getToolbarHtml({ version: '4.2.0' });
        assert.ok(html.includes('data-version="v4.2.0"'), 'data-version should be set');
    });

    test('toolbar fixed elements are in toolbar-left, filename in toolbar-right', () => {
        const html = getToolbarHtml({ version: '1.0.0' });
        const leftIdx = html.indexOf('toolbar-left');
        const rightIdx = html.indexOf('toolbar-right');
        const filenameIdx = html.indexOf('toolbar-filename');
        assert.ok(leftIdx < rightIdx, 'toolbar-left should precede toolbar-right');
        assert.ok(filenameIdx > rightIdx, 'filename should be in toolbar-right');
    });

    test('filter drawer HTML preserves required element IDs', () => {
        const html = getFilterDrawerHtml();
        const required = [
            'id="filter-drawer"',
            'id="level-select-all"',
            'id="level-select-none"',
            'id="context-lines-slider"',
            'id="context-lines-label"',
            'id="opt-app-only"',
            'id="preset-select"',
            'id="reset-all-filters"',
        ];
        for (const id of required) {
            assert.ok(html.includes(id), `filter drawer must contain ${id}`);
        }
    });

    test('context label uses compact \u00b1N format', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('>\u00B13</span>'),
            'context label should show \u00b13 (not "Context: 3 lines")',
        );
    });

    test('syncContextSlider produces matching \u00b1N format', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-level-filter.ts');
        assert.ok(
            src.includes("'\\u00B1' + contextLinesBefore"),
            'syncContextSlider should set label to \u00b1N',
        );
    });

    test('filter drawer has accordion sections', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('filter-accordion'),
            'filter drawer should have accordion sections',
        );
        assert.ok(
            html.includes('filter-accordion-header'),
            'accordion sections need clickable headers',
        );
    });

    test('filter drawer has preset label and reset after summary', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('filter-drawer-footer-label'),
            'footer should have a preset label',
        );
        assert.ok(
            html.includes('>Preset:</span>'),
            'preset label should read "Preset:"',
        );
        const summaryIdx = html.indexOf('id="filter-drawer-summary"');
        const resetIdx = html.indexOf('id="reset-all-filters"');
        assert.ok(
            summaryIdx < resetIdx,
            'reset button should appear after summary (far right)',
        );
    });

    test('filter drawer sections use grid container', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('class="filter-drawer-sections"'),
            'accordion sections should be inside grid container',
        );
    });

    test('accordion script manages expanded class', () => {
        const src = readSrc('ui/viewer-toolbar/viewer-toolbar-script.ts');
        assert.ok(
            src.includes("classList.add('expanded')"),
            'handleAccordionClick should add expanded class',
        );
        assert.ok(
            src.includes("classList.remove('expanded')"),
            'collapseAllAccordions should remove expanded class',
        );
    });

    test('actions dropdown preserves replay script IDs', () => {
        const html = getActionsDropdownHtml();
        assert.ok(html.includes('id="footer-actions-menu"'), 'replay compat: menu ID');
        assert.ok(html.includes('id="footer-actions-popover"'), 'replay compat: popover ID');
        assert.ok(html.includes('data-action="replay"'), 'replay action button');
        assert.ok(html.includes('data-action="export"'), 'export action button');
    });

    test('content body wires toolbar, flyout, drawer, and actions', () => {
        const src = readSrc('ui/provider/viewer-content-body.ts');
        assert.ok(src.includes('getToolbarHtml'), 'body should import toolbar');
        assert.ok(src.includes('getSearchFlyoutHtml'), 'body should import search flyout');
        assert.ok(src.includes('getFilterDrawerHtml'), 'body should import filter drawer');
        assert.ok(src.includes('getActionsDropdownHtml'), 'body should import actions');
    });

    test('content body does not include old footer or filters panel', () => {
        const src = readSrc('ui/provider/viewer-content-body.ts');
        assert.ok(!src.includes('id="footer"'), 'old footer removed');
        assert.ok(!src.includes('getFiltersPanelHtml'), 'filters panel removed from body');
    });

    test('toolbar should be inside log-area-with-footer, not above panel-content-row', () => {
        const { getViewerBodyHtml } = require('../../ui/provider/viewer-content-body');
        const html: string = getViewerBodyHtml({ version: '1.0.0' });
        const logAreaIdx = html.indexOf('id="log-area-with-footer"');
        const toolbarIdx = html.indexOf('id="viewer-toolbar"');
        const panelSlotIdx = html.indexOf('id="panel-slot"');
        assert.ok(logAreaIdx > 0, 'log-area-with-footer must exist');
        assert.ok(toolbarIdx > logAreaIdx, 'toolbar must appear after log-area-with-footer opens');
        assert.ok(panelSlotIdx < logAreaIdx, 'panel-slot must appear before log-area-with-footer');
    });

    test('panel-content-row should be direct child of main-content with no toolbar between', () => {
        const { getViewerBodyHtml } = require('../../ui/provider/viewer-content-body');
        const html: string = getViewerBodyHtml({ version: '1.0.0' });
        const mainIdx = html.indexOf('id="main-content"');
        const panelRowIdx = html.indexOf('id="panel-content-row"');
        const toolbarIdx = html.indexOf('id="viewer-toolbar"');
        assert.ok(mainIdx < panelRowIdx, 'panel-content-row must follow main-content');
        assert.ok(toolbarIdx > panelRowIdx, 'toolbar must not appear between main-content and panel-content-row');
    });

    test('icon bar has no Filters or SQL Filter buttons', () => {
        const src = readSrc('ui/viewer-nav/viewer-icon-bar.ts');
        assert.ok(!src.includes('id="ib-filters"'), 'Filters button removed');
        assert.ok(!src.includes('id="ib-sql-filter"'), 'SQL Filter button removed');
    });

    test('toolbar script provides backward compat aliases', () => {
        const src = readSrc('ui/viewer-toolbar/viewer-toolbar-script.ts');
        assert.ok(src.includes('window.openFiltersPanel'), 'openFiltersPanel alias');
        assert.ok(src.includes('window.closeFiltersPanel'), 'closeFiltersPanel alias');
        assert.ok(src.includes('window.openFilterDrawer'), 'openFilterDrawer export');
        assert.ok(src.includes('window.closeFilterDrawer'), 'closeFilterDrawer export');
        assert.ok(src.includes('window.toggleSearchFlyout'), 'toggleSearchFlyout export');
        assert.ok(src.includes('window.setFooterActionsOpen'), 'setFooterActionsOpen compat');
    });

    test('toolbar script has Signals mutual exclusion', () => {
        const src = readSrc('ui/viewer-toolbar/viewer-toolbar-script.ts');
        assert.ok(src.includes('signalsWasVisible'), 'should track signals visibility');
        assert.ok(src.includes('root-cause-hypotheses'), 'should reference signals host');
    });

    test('about panel reads version from toolbar, not footer', () => {
        const src = readSrc('ui/viewer-panels/viewer-about-panel.ts');
        assert.ok(
            src.includes("getElementById('viewer-toolbar')"),
            'about panel should read version from toolbar',
        );
        assert.ok(
            !src.includes("getElementById('footer-text')"),
            'about panel should not reference old footer-text for version',
        );
    });

    test('viewer-script uses toolbar element for paused state', () => {
        const src = readSrc('ui/viewer/viewer-script.ts');
        assert.ok(
            src.includes("getElementById('viewer-toolbar')"),
            'viewer-script should use toolbar for paused class toggle',
        );
    });

    test('filter badge updates toolbar icon badge', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-filter-badge.ts');
        assert.ok(
            src.includes("getElementById('toolbar-filter-count')"),
            'badge should update the toolbar filter icon badge',
        );
        assert.ok(
            !src.includes("getElementById('filter-badge')"),
            'should not reference removed standalone filter-badge',
        );
    });

    test('level filter delegates to filter drawer', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-level-filter.ts');
        assert.ok(
            src.includes('toggleFilterDrawer'),
            'toggleLevelMenu should delegate to toggleFilterDrawer',
        );
        assert.ok(
            !src.includes("getElementById('level-flyup')"),
            'should not reference removed #level-flyup element',
        );
    });

    test('toolbar elements should have descriptive tooltips', () => {
        const html = getToolbarHtml({ version: '1.0.0' });
        // Nav buttons
        assert.ok(html.includes('title="Navigate to the previous'), 'prev button needs descriptive tooltip');
        assert.ok(html.includes('title="Navigate to the next'), 'next button needs descriptive tooltip');
        // Icon buttons
        assert.ok(html.includes('title="Open search to find text'), 'search button needs descriptive tooltip');
        assert.ok(html.includes('title="Open filter drawer'), 'filter button needs descriptive tooltip');
        assert.ok(html.includes('title="Open actions menu'), 'actions button needs descriptive tooltip');
        // Level dots
        assert.ok(html.includes('title="Info — click to toggle, double-click to show only Info"'), 'level dots need descriptive tooltips');
        // Status elements
        assert.ok(html.includes('title="Total number of lines'), 'line count needs tooltip');
        assert.ok(html.includes('title="Number of currently selected lines"'), 'selection needs tooltip');
        // Interactive elements describe their actions
        assert.ok(html.includes('double-click to open folder'), 'filename tooltip should describe double-click');
        assert.ok(html.includes('long-press to copy path'), 'filename tooltip should describe long-press');
        assert.ok(html.includes('click to open filter drawer'), 'trigger label should describe click action');
    });

    test('search flyout elements should have descriptive tooltips', () => {
        const html = getSearchFlyoutHtml();
        assert.ok(html.includes('title="Type to search or filter'), 'search input needs tooltip');
        assert.ok(html.includes('title="Match Case — toggle'), 'case toggle needs descriptive tooltip');
        assert.ok(html.includes('title="Match Whole Word — only'), 'word toggle needs descriptive tooltip');
        assert.ok(html.includes('title="Number of matches found"'), 'match count needs tooltip');
        assert.ok(html.includes('title="Switch between highlighting'), 'funnel button needs descriptive tooltip');
    });

    test('filter drawer level buttons should have tooltips', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('title="Click to show all log levels"'), 'All button needs tooltip');
        assert.ok(html.includes('title="Click to hide all log levels"'), 'None button needs tooltip');
        assert.ok(html.includes('title="Info — click to show/hide informational'), 'Info toggle needs descriptive tooltip');
        assert.ok(html.includes('title="Error — click to show/hide error'), 'Error toggle needs descriptive tooltip');
    });

    test('filter drawer accordion headers should have tooltips', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('title="Click to expand or collapse the Log Inputs'), 'Log Inputs accordion needs tooltip');
        assert.ok(html.includes('title="Click to expand or collapse the Noise Reduction'), 'Noise Reduction accordion needs tooltip');
    });

    test('accordion arrows should use codicon chevron-right', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('codicon codicon-chevron-right'),
            'accordion arrows should use codicon chevron-right for visibility',
        );
        assert.ok(
            !html.includes('\u25B8'),
            'should not use small Unicode triangle for arrows',
        );
    });

    test('accordion headers should have summary span for item counts', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('filter-accordion-summary'),
            'accordion headers need a summary span for displaying counts',
        );
    });

    test('filter drawer scope options should have tooltips', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('title="Show all log lines regardless of source file"'), 'All logs radio needs tooltip');
        assert.ok(html.includes('title="Show only logs from the current workspace"'), 'Workspace radio needs tooltip');
        assert.ok(html.includes('title="Show only logs from the current package"'), 'Package radio needs tooltip');
        assert.ok(html.includes('title="Show only logs from the active file"'), 'File radio needs tooltip');
        assert.ok(html.includes('title="Hide log lines that have no associated file path'), 'Unattributed checkbox needs tooltip');
    });

    test('filter drawer exclusions checkbox should have tooltip', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('title="Enable or disable exclusion pattern filtering"'), 'Exclusions checkbox needs tooltip');
    });

    test('actions dropdown items should have tooltips', () => {
        const html = getActionsDropdownHtml();
        assert.ok(html.includes('title="Replay the log session'), 'replay needs tooltip');
        assert.ok(html.includes('title="Generate and open a quality report'), 'quality report needs tooltip');
        assert.ok(html.includes('title="Export log lines'), 'export needs tooltip');
    });
});

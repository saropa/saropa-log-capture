import * as assert from 'assert';
import { getToolbarHtml } from '../../ui/viewer-toolbar/viewer-toolbar-html';
import { getSearchFlyoutHtml } from '../../ui/viewer-toolbar/viewer-toolbar-search-html';
import { getFilterDrawerHtml } from '../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html';
import { getActionsDropdownHtml } from '../../ui/viewer-toolbar/viewer-toolbar-actions-html';

/**
 * Tooltip tests for the toolbar, search flyout, filter drawer, and
 * actions dropdown. Ensures all interactive elements have descriptive
 * title attributes for accessibility and discoverability.
 */
suite('Viewer toolbar tooltips', () => {

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
        assert.ok(html.includes('title="Click to expand or collapse the Log Sources'), 'Log Sources accordion needs tooltip');
        assert.ok(html.includes('title="Click to expand or collapse the Text Exclusions'), 'Text Exclusions accordion needs tooltip');
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
        assert.ok(html.includes('title="When a scope is active, also exclude lines that have no source file'), 'Unattributed checkbox needs tooltip');
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

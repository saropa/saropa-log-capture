/**
 * Tests for the dedicated "Related Queries" popover script and wiring.
 */
import * as assert from 'assert';
import { getRelatedQueriesPopoverScript } from '../../ui/viewer-context-menu/viewer-context-popover-integration-sections';
import { getContextPopoverScript } from '../../ui/viewer-context-menu/viewer-context-popover-script';
import { getContextMenuActionsScript } from '../../ui/viewer-context-menu/viewer-context-menu-actions';

suite('Related Queries popover', () => {
    const script = getRelatedQueriesPopoverScript();

    test('should define showRelatedQueriesPopover function', () => {
        assert.ok(script.includes('function showRelatedQueriesPopover('));
    });

    test('should define closeRelatedQueriesPopover function', () => {
        assert.ok(script.includes('function closeRelatedQueriesPopover('));
    });

    test('should define handleRelatedQueriesPopoverData function', () => {
        assert.ok(script.includes('function handleRelatedQueriesPopoverData('));
    });

    test('should build content with query list and copy buttons', () => {
        assert.ok(script.includes('buildRelatedQueriesContent'));
        assert.ok(script.includes('popover-copy-query'));
        assert.ok(script.includes('data-query'));
    });

    test('should show empty state when no queries found', () => {
        assert.ok(script.includes('No related queries found'));
    });

    test('should include Copy All button for non-empty results', () => {
        assert.ok(script.includes('rq-copy-all'));
        assert.ok(script.includes('Copy All'));
    });

    test('should close other popovers when opening', () => {
        assert.ok(script.includes('closeContextPopover()'));
        assert.ok(script.includes('closeQualityPopover()'));
    });

    test('should show error as toast', () => {
        assert.ok(script.includes('if (msg.error)'));
        assert.ok(script.includes('showPopoverToast(msg.error)'));
    });
});

suite('Related Queries popover wiring', () => {
    const fullScript = getContextPopoverScript();

    test('should be concatenated into the full popover script', () => {
        assert.ok(fullScript.includes('handleRelatedQueriesPopoverData'));
    });

    test('should listen for relatedQueriesData message', () => {
        assert.ok(fullScript.includes("msg.type === 'relatedQueriesData'"));
    });

    test('should listen for triggerShowRelatedQueries message', () => {
        assert.ok(fullScript.includes("msg.type === 'triggerShowRelatedQueries'"));
    });

    test('context popover should close related queries popover', () => {
        /* showContextPopover calls closeRelatedQueriesPopover */
        const idx = fullScript.indexOf('function showContextPopover(');
        const block = fullScript.slice(idx, idx + 300);
        assert.ok(block.includes('closeRelatedQueriesPopover()'));
    });
});

suite('Related Queries context menu action', () => {
    const actionsScript = getContextMenuActionsScript();

    test('should handle show-related-queries action', () => {
        assert.ok(actionsScript.includes("'show-related-queries'"));
    });

    test('should post showRelatedQueries message type', () => {
        assert.ok(actionsScript.includes("type: 'showRelatedQueries'"));
    });
});

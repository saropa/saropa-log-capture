/**
 * Tests for the dedicated "Related Requests" popover script and wiring (plan 010 HTTP).
 * Mirrors the Related Queries popover tests — the dedicated popover is the deferred
 * piece the HTTP spec called out (the inline time-window section already shipped).
 */
import * as assert from 'assert';
import { getRelatedRequestsPopoverScript } from '../../ui/viewer-context-menu/viewer-context-popover-integration-sections';
import { getContextPopoverScript } from '../../ui/viewer-context-menu/viewer-context-popover-script';
import { getContextMenuActionsScript } from '../../ui/viewer-context-menu/viewer-context-menu-actions';

suite('Related Requests popover', () => {
    const script = getRelatedRequestsPopoverScript();

    test('should define showRelatedRequestsPopover function', () => {
        assert.ok(script.includes('function showRelatedRequestsPopover('));
    });

    test('should define closeRelatedRequestsPopover function', () => {
        assert.ok(script.includes('function closeRelatedRequestsPopover('));
    });

    test('should define handleRelatedRequestsPopoverData function', () => {
        assert.ok(script.includes('function handleRelatedRequestsPopoverData('));
    });

    test('should build content with method/url/status/duration and copy buttons', () => {
        assert.ok(script.includes('buildRelatedRequestsContent'));
        assert.ok(script.includes('http-method'));
        assert.ok(script.includes('http-url'));
        assert.ok(script.includes('http-status'));
        assert.ok(script.includes('http-duration'));
        assert.ok(script.includes('popover-copy-request'));
        assert.ok(script.includes('data-request'));
    });

    test('should show empty state when no requests found', () => {
        assert.ok(script.includes('viewer.relatedRequests.empty'));
    });

    test('should include Copy All button for non-empty results', () => {
        assert.ok(script.includes('rr-copy-all'));
        assert.ok(script.includes('viewer.relatedRequests.copyAll'));
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

suite('Related Requests popover wiring', () => {
    const fullScript = getContextPopoverScript();

    test('should be concatenated into the full popover script', () => {
        assert.ok(fullScript.includes('handleRelatedRequestsPopoverData'));
    });

    test('should listen for relatedRequestsData message', () => {
        assert.ok(fullScript.includes("msg.type === 'relatedRequestsData'"));
    });

    test('should listen for triggerShowRelatedRequests message', () => {
        assert.ok(fullScript.includes("msg.type === 'triggerShowRelatedRequests'"));
    });

    test('context popover should close related requests popover', () => {
        /* showContextPopover calls closeRelatedRequestsPopover so only one popover shows at a time */
        const idx = fullScript.indexOf('function showContextPopover(');
        const block = fullScript.slice(idx, idx + 320);
        assert.ok(block.includes('closeRelatedRequestsPopover()'));
    });
});

suite('Related Requests context menu action', () => {
    const actionsScript = getContextMenuActionsScript();

    test('should handle show-related-requests action', () => {
        assert.ok(actionsScript.includes("'show-related-requests'"));
    });

    test('should post showRelatedRequests message type', () => {
        assert.ok(actionsScript.includes("type: 'showRelatedRequests'"));
    });
});

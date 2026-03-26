"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests for the dedicated "Related Queries" popover script and wiring.
 */
const assert = __importStar(require("assert"));
const viewer_context_popover_integration_sections_1 = require("../../ui/viewer-context-menu/viewer-context-popover-integration-sections");
const viewer_context_popover_script_1 = require("../../ui/viewer-context-menu/viewer-context-popover-script");
const viewer_context_menu_actions_1 = require("../../ui/viewer-context-menu/viewer-context-menu-actions");
suite('Related Queries popover', () => {
    const script = (0, viewer_context_popover_integration_sections_1.getRelatedQueriesPopoverScript)();
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
    const fullScript = (0, viewer_context_popover_script_1.getContextPopoverScript)();
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
    const actionsScript = (0, viewer_context_menu_actions_1.getContextMenuActionsScript)();
    test('should handle show-related-queries action', () => {
        assert.ok(actionsScript.includes("'show-related-queries'"));
    });
    test('should post showRelatedQueries message type', () => {
        assert.ok(actionsScript.includes("type: 'showRelatedQueries'"));
    });
});
//# sourceMappingURL=viewer-related-queries-popover.test.js.map
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
 * Runtime test for the session panel inlined script.
 * Runs the same script combination the webview runs (transforms + tags + panel)
 * in a minimal VM with mock document/vscodeApi, then dispatches a sessionList
 * message. Catches ReferenceErrors (e.g. missing escapeHtmlText) that syntax-
 * only checks cannot detect.
 */
const assert = __importStar(require("assert"));
const viewer_session_panel_test_helpers_1 = require("./viewer-session-panel-test-helpers");
suite('Session panel script runtime', () => {
    test('should render full session list without ReferenceError', () => {
        const { sandbox, messageHandlers } = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
        try {
            (0, viewer_session_panel_test_helpers_1.bootPanel)(sandbox);
        }
        catch (e) {
            const err = e;
            assert.fail(`Session panel script threw: ${err.name}: ${err.message}`);
        }
        assert.ok(messageHandlers.length > 0, 'Panel should register a message handler');
        const sessionListMessage = {
            data: {
                type: 'sessionList',
                sessions: [
                    {
                        uriString: 'file:///test.log',
                        filename: 'test.log',
                        displayName: 'test.log',
                        mtime: Date.now(),
                        trashed: false,
                    },
                ],
            },
        };
        try {
            for (const handler of messageHandlers) {
                handler(sessionListMessage);
            }
        }
        catch (e) {
            const err = e;
            assert.fail(`renderSessionList threw: ${err.name}: ${err.message}`);
        }
    });
    test('should render preview list with shimmer metadata without ReferenceError', () => {
        const { sandbox, messageHandlers, elements } = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
        (0, viewer_session_panel_test_helpers_1.bootPanel)(sandbox);
        const previewMessage = {
            data: {
                type: 'sessionListPreview',
                previews: [
                    { filename: 'alpha.log', uriString: 'file:///alpha.log' },
                    { filename: 'beta.log', uriString: 'file:///beta.log' },
                ],
            },
        };
        for (const handler of messageHandlers) {
            handler(previewMessage);
        }
        const listEl = elements.get('session-list');
        const html = String(listEl?.innerHTML ?? '');
        assert.ok(html.includes('session-shimmer-meta'), 'Preview items should have shimmer meta class');
        assert.ok(html.includes('alpha.log'), 'Preview should contain first filename');
        assert.ok(html.includes('beta.log'), 'Preview should contain second filename');
        assert.ok(html.includes('data-uri="file:///alpha.log"'), 'Preview items should have data-uri');
    });
    test('should render reveal-in-OS hover action button on every session row', () => {
        /* Every session row gets a hover button that reveals the log in the OS
           file explorer. The button must carry the revealInOS action and the
           folder-opened codicon, and be wrapped in a session-item-actions
           container that CSS can toggle on hover. */
        const { sandbox, messageHandlers, elements } = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
        (0, viewer_session_panel_test_helpers_1.bootPanel)(sandbox);
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionList',
                    sessions: [{
                            uriString: 'file:///alpha.log', filename: 'alpha.log',
                            displayName: 'alpha.log', mtime: Date.now(), trashed: false,
                        }],
                },
            });
        }
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('session-item-actions'), 'Row should include hover-actions container');
        assert.ok(html.includes('data-session-action="revealInOS"'), 'Row should include revealInOS action');
        assert.ok(html.includes('codicon-folder-opened'), 'Reveal button should use folder-opened icon');
    });
    test('should render reveal-in-OS button on preview rows too', () => {
        /* Preview rows (streamed before metadata resolves) should also offer the
           reveal action so users do not wait for metadata to jump to the file. */
        const { sandbox, messageHandlers, elements } = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
        (0, viewer_session_panel_test_helpers_1.bootPanel)(sandbox);
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionListPreview',
                    previews: [{ filename: 'alpha.log', uriString: 'file:///alpha.log' }],
                },
            });
        }
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('data-session-action="revealInOS"'), 'Preview row should include revealInOS action');
    });
    test('should replace preview with full session list when data arrives', () => {
        const { sandbox, messageHandlers, elements } = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
        (0, viewer_session_panel_test_helpers_1.bootPanel)(sandbox);
        // First: preview
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionListPreview',
                    previews: [{ filename: 'alpha.log', uriString: 'file:///alpha.log' }],
                },
            });
        }
        const listEl = elements.get('session-list');
        assert.ok(String(listEl?.innerHTML).includes('session-shimmer-meta'), 'Should show shimmer');
        // Then: full data replaces preview
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionList',
                    sessions: [{
                            uriString: 'file:///alpha.log', filename: 'alpha.log',
                            displayName: 'alpha.log', mtime: Date.now(), trashed: false,
                        }],
                },
            });
        }
        const finalHtml = String(listEl?.innerHTML);
        assert.ok(!finalHtml.includes('session-shimmer-meta'), 'Full render should not have shimmer');
    });
    test('should handle sessionListBatch without ReferenceError', () => {
        const { sandbox, messageHandlers } = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
        (0, viewer_session_panel_test_helpers_1.bootPanel)(sandbox);
        // Send preview first, then batch update
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionListPreview',
                    previews: [{ filename: 'alpha.log', uriString: 'file:///alpha.log' }],
                },
            });
        }
        // Batch arrives — should not throw even if querySelector returns null
        try {
            for (const handler of messageHandlers) {
                handler({
                    data: {
                        type: 'sessionListBatch',
                        items: [{
                                uriString: 'file:///alpha.log', filename: 'alpha.log',
                                displayName: 'alpha.log', mtime: Date.now(),
                                hasTimestamps: true, size: 1024, trashed: false,
                            }],
                    },
                });
            }
        }
        catch (e) {
            const err = e;
            assert.fail(`sessionListBatch threw: ${err.name}: ${err.message}`);
        }
    });
    test('should handle sessionListBatch with empty items', () => {
        const { sandbox, messageHandlers } = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
        (0, viewer_session_panel_test_helpers_1.bootPanel)(sandbox);
        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionListBatch', items: [] } });
        }
        assert.ok(true, 'Empty batch should not throw');
    });
    test('should handle sessionListBatch before preview without error', () => {
        const { sandbox, messageHandlers } = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
        (0, viewer_session_panel_test_helpers_1.bootPanel)(sandbox);
        // Batch arrives without a prior preview — should degrade gracefully
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionListBatch',
                    items: [{
                            uriString: 'file:///orphan.log', filename: 'orphan.log',
                            displayName: 'orphan.log', mtime: Date.now(), trashed: false,
                        }],
                },
            });
        }
        assert.ok(true, 'Batch without preview should not throw');
    });
    test('should handle empty preview gracefully', () => {
        const { sandbox, messageHandlers, elements } = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
        (0, viewer_session_panel_test_helpers_1.bootPanel)(sandbox);
        // Verify loading element is shown before preview
        const loadingEl = elements.get('session-loading');
        loadingEl.style.display = '';
        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionListPreview', previews: [] } });
        }
        // Empty preview should not crash — loading stays visible
        // (the full sessionList message handles the empty state)
        assert.ok(true, 'Empty preview should not throw');
    });
    suite('name filter', () => {
        /** Helper: boot sandbox, send session list, return elements + sandbox. */
        function bootWithSessions(sessions) {
            const result = (0, viewer_session_panel_test_helpers_1.buildSandbox)();
            (0, viewer_session_panel_test_helpers_1.bootPanel)(result.sandbox);
            for (const handler of result.messageHandlers) {
                handler({ data: { type: 'sessionList', sessions } });
            }
            return result;
        }
        const testSessions = [
            { uriString: 'file:///a1.log', filename: '20260413_120000_vibrancy.log', displayName: '20260413_120000_vibrancy.log', mtime: Date.now() - 60000, trashed: false },
            { uriString: 'file:///a2.log', filename: '20260413_110000_vibrancy.log', displayName: '20260413_110000_vibrancy.log', mtime: Date.now() - 120000, trashed: false },
            { uriString: 'file:///b1.log', filename: '20260413_100000_other_app.log', displayName: '20260413_100000_other_app.log', mtime: Date.now() - 180000, trashed: false },
        ];
        test('should expose setSessionNameFilter and clearSessionNameFilter', () => {
            const { sandbox } = bootWithSessions(testSessions);
            assert.strictEqual(typeof sandbox.setSessionNameFilter, 'function');
            assert.strictEqual(typeof sandbox.clearSessionNameFilter, 'function');
        });
        test('should filter by name in "hide" mode without ReferenceError', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            /* Hide sessions named "vibrancy" — only "other_app" should remain. */
            sandbox.setSessionNameFilter('hide', '20260413_120000_vibrancy.log');
            const html = String(elements.get('session-list')?.innerHTML ?? '');
            assert.ok(!html.includes('file:///a1.log'), 'Filtered session a1 should be hidden');
            assert.ok(!html.includes('file:///a2.log'), 'Filtered session a2 should be hidden');
            assert.ok(html.includes('file:///b1.log'), 'Non-matching session should remain');
        });
        test('should filter by name in "only" mode without ReferenceError', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            /* Show only sessions named "vibrancy". */
            sandbox.setSessionNameFilter('only', '20260413_120000_vibrancy.log');
            const html = String(elements.get('session-list')?.innerHTML ?? '');
            assert.ok(html.includes('file:///a1.log'), 'Matching session a1 should be visible');
            assert.ok(html.includes('file:///a2.log'), 'Matching session a2 should be visible');
            assert.ok(!html.includes('file:///b1.log'), 'Non-matching session should be hidden');
        });
        test('should clear name filter and show all sessions', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            /* Set then clear the filter — all sessions should reappear. */
            sandbox.setSessionNameFilter('hide', '20260413_120000_vibrancy.log');
            sandbox.clearSessionNameFilter();
            const html = String(elements.get('session-list')?.innerHTML ?? '');
            assert.ok(html.includes('file:///a1.log'), 'Session a1 should reappear');
            assert.ok(html.includes('file:///b1.log'), 'Session b1 should still be visible');
        });
        test('should show filter bar when name filter is active', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            const filterBar = elements.get('session-name-filter-bar');
            assert.strictEqual(filterBar.style.display, 'none', 'Filter bar should be hidden initially');
            sandbox.setSessionNameFilter('hide', '20260413_120000_vibrancy.log');
            assert.notStrictEqual(filterBar.style.display, 'none', 'Filter bar should be visible after filter set');
        });
        test('should hide filter bar after clearing name filter', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            const filterBar = elements.get('session-name-filter-bar');
            sandbox.setSessionNameFilter('only', '20260413_120000_vibrancy.log');
            sandbox.clearSessionNameFilter();
            assert.strictEqual(filterBar.style.display, 'none', 'Filter bar should be hidden after clear');
        });
        test('should show correct verb in filter bar for hide mode', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            sandbox.setSessionNameFilter('hide', '20260413_120000_vibrancy.log');
            const barHtml = String(elements.get('session-name-filter-bar').innerHTML ?? '');
            assert.ok(barHtml.includes('Hiding'), 'Bar should show "Hiding" for hide mode');
            assert.ok(barHtml.includes('Show All'), 'Bar should include Show All button');
        });
        test('should show correct verb in filter bar for only mode', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            sandbox.setSessionNameFilter('only', '20260413_120000_vibrancy.log');
            const barHtml = String(elements.get('session-name-filter-bar').innerHTML ?? '');
            assert.ok(barHtml.includes('Showing only'), 'Bar should show "Showing only" for only mode');
        });
        test('should show filtered-empty hint when name filter hides all sessions', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            /* Hide every session name present in the list — result should be zero items. */
            sandbox.setSessionNameFilter('only', 'nonexistent_name.log');
            const html = String(elements.get('session-list')?.innerHTML ?? '');
            assert.ok(html.includes('No sessions match'), 'Should show filtered-empty hint');
            assert.ok(!html.includes('file:///a1.log'), 'No sessions should be rendered');
        });
    });
});
//# sourceMappingURL=viewer-session-panel-runtime.test.js.map
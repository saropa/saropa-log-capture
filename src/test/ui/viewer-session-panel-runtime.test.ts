/**
 * Runtime test for the session panel inlined script.
 * Runs the same script combination the webview runs (transforms + tags + panel)
 * in a minimal VM with mock document/vscodeApi, then dispatches a sessionList
 * message. Catches ReferenceErrors (e.g. missing escapeHtmlText) that syntax-
 * only checks cannot detect.
 */
import * as assert from 'assert';
import * as vm from 'vm';
import { getSessionTransformsScript } from '../../ui/viewer/viewer-session-transforms';
import { getSessionTagsScript } from '../../ui/viewer-panels/viewer-session-tags';
import { getSessionPanelScript } from '../../ui/viewer-panels/viewer-session-panel';

function noop(): void {}
function mockEl(): Record<string, unknown> {
    return {
        classList: { add: noop, remove: noop, toggle: noop },
        style: { display: '', width: '' },
        innerHTML: '',
        textContent: '',
        addEventListener: noop,
        querySelector: () => null,
        querySelectorAll: () => [],
        contains: () => false,
        getAttribute: () => null,
        setAttribute: noop,
        focus: noop,
    };
}

/** Create a VM sandbox with mock DOM and capture message handlers. */
function buildSandbox(): {
    sandbox: Record<string, unknown>;
    messageHandlers: Array<(e: { data?: unknown }) => void>;
    elements: Map<string, Record<string, unknown>>;
} {
    const elements = new Map<string, Record<string, unknown>>();
    const getEl = (id: string): Record<string, unknown> => {
        if (!elements.has(id)) { elements.set(id, mockEl()); }
        return elements.get(id)!;
    };
    const document = {
        getElementById: (id: string) => getEl(id),
        addEventListener: noop,
    };
    const messageHandlers: Array<(e: { data?: unknown }) => void> = [];
    const sandbox: Record<string, unknown> = {
        document,
        CSS: { escape: (v: string) => v },
        vscodeApi: { postMessage: noop },
        requestAnimationFrame: (fn: () => void) => fn(),
        __sharedPanelWidth: 560,
    };
    sandbox.window = sandbox;
    sandbox.addEventListener = (type: string, fn: (e: { data?: unknown }) => void) => {
        if (type === 'message') { messageHandlers.push(fn); }
    };
    vm.createContext(sandbox);
    return { sandbox, messageHandlers, elements };
}

/** Boot the panel scripts in a sandbox and return message handlers. */
function bootPanel(sandbox: Record<string, unknown>): void {
    vm.runInContext(getSessionTransformsScript(), sandbox);
    vm.runInContext(getSessionTagsScript(), sandbox);
    vm.runInContext(getSessionPanelScript(), sandbox);
}

suite('Session panel script runtime', () => {
    test('should render full session list without ReferenceError', () => {
        const { sandbox, messageHandlers } = buildSandbox();
        try { bootPanel(sandbox); } catch (e) {
            const err = e as Error;
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
        } catch (e) {
            const err = e as Error;
            assert.fail(`renderSessionList threw: ${err.name}: ${err.message}`);
        }
    });

    test('should render preview list with shimmer metadata without ReferenceError', () => {
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);

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

    test('should replace preview with full session list when data arrives', () => {
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);

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
        const { sandbox, messageHandlers } = buildSandbox();
        bootPanel(sandbox);

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
        } catch (e) {
            const err = e as Error;
            assert.fail(`sessionListBatch threw: ${err.name}: ${err.message}`);
        }
    });

    test('should handle sessionListBatch with empty items', () => {
        const { sandbox, messageHandlers } = buildSandbox();
        bootPanel(sandbox);

        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionListBatch', items: [] } });
        }
        assert.ok(true, 'Empty batch should not throw');
    });

    test('should handle sessionListBatch before preview without error', () => {
        const { sandbox, messageHandlers } = buildSandbox();
        bootPanel(sandbox);

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
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);

        // Verify loading element is shown before preview
        const loadingEl = elements.get('session-loading');
        (loadingEl as Record<string, Record<string, string>>).style.display = '';

        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionListPreview', previews: [] } });
        }

        // Empty preview should not crash — loading stays visible
        // (the full sessionList message handles the empty state)
        assert.ok(true, 'Empty preview should not throw');
    });

    suite('name filter', () => {
        /** Helper: boot sandbox, send session list, return elements + sandbox. */
        function bootWithSessions(sessions: Array<Record<string, unknown>>): {
            sandbox: Record<string, unknown>;
            messageHandlers: Array<(e: { data?: unknown }) => void>;
            elements: Map<string, Record<string, unknown>>;
        } {
            const result = buildSandbox();
            bootPanel(result.sandbox);
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
            (sandbox.setSessionNameFilter as (m: string, n: string) => void)('hide', '20260413_120000_vibrancy.log');
            const html = String(elements.get('session-list')?.innerHTML ?? '');
            assert.ok(!html.includes('file:///a1.log'), 'Filtered session a1 should be hidden');
            assert.ok(!html.includes('file:///a2.log'), 'Filtered session a2 should be hidden');
            assert.ok(html.includes('file:///b1.log'), 'Non-matching session should remain');
        });

        test('should filter by name in "only" mode without ReferenceError', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            /* Show only sessions named "vibrancy". */
            (sandbox.setSessionNameFilter as (m: string, n: string) => void)('only', '20260413_120000_vibrancy.log');
            const html = String(elements.get('session-list')?.innerHTML ?? '');
            assert.ok(html.includes('file:///a1.log'), 'Matching session a1 should be visible');
            assert.ok(html.includes('file:///a2.log'), 'Matching session a2 should be visible');
            assert.ok(!html.includes('file:///b1.log'), 'Non-matching session should be hidden');
        });

        test('should clear name filter and show all sessions', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            /* Set then clear the filter — all sessions should reappear. */
            (sandbox.setSessionNameFilter as (m: string, n: string) => void)('hide', '20260413_120000_vibrancy.log');
            (sandbox.clearSessionNameFilter as () => void)();
            const html = String(elements.get('session-list')?.innerHTML ?? '');
            assert.ok(html.includes('file:///a1.log'), 'Session a1 should reappear');
            assert.ok(html.includes('file:///b1.log'), 'Session b1 should still be visible');
        });

        test('should show filter bar when name filter is active', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            const filterBar = elements.get('session-name-filter-bar') as Record<string, Record<string, string>>;
            assert.strictEqual(filterBar.style.display, 'none', 'Filter bar should be hidden initially');
            (sandbox.setSessionNameFilter as (m: string, n: string) => void)('hide', '20260413_120000_vibrancy.log');
            assert.notStrictEqual(filterBar.style.display, 'none', 'Filter bar should be visible after filter set');
        });

        test('should hide filter bar after clearing name filter', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            const filterBar = elements.get('session-name-filter-bar') as Record<string, Record<string, string>>;
            (sandbox.setSessionNameFilter as (m: string, n: string) => void)('only', '20260413_120000_vibrancy.log');
            (sandbox.clearSessionNameFilter as () => void)();
            assert.strictEqual(filterBar.style.display, 'none', 'Filter bar should be hidden after clear');
        });

        test('should show correct verb in filter bar for hide mode', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            (sandbox.setSessionNameFilter as (m: string, n: string) => void)('hide', '20260413_120000_vibrancy.log');
            const barHtml = String((elements.get('session-name-filter-bar') as Record<string, string>).innerHTML ?? '');
            assert.ok(barHtml.includes('Hiding'), 'Bar should show "Hiding" for hide mode');
            assert.ok(barHtml.includes('Show All'), 'Bar should include Show All button');
        });

        test('should show correct verb in filter bar for only mode', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            (sandbox.setSessionNameFilter as (m: string, n: string) => void)('only', '20260413_120000_vibrancy.log');
            const barHtml = String((elements.get('session-name-filter-bar') as Record<string, string>).innerHTML ?? '');
            assert.ok(barHtml.includes('Showing only'), 'Bar should show "Showing only" for only mode');
        });

        test('should show filtered-empty hint when name filter hides all sessions', () => {
            const { sandbox, elements } = bootWithSessions(testSessions);
            /* Hide every session name present in the list — result should be zero items. */
            (sandbox.setSessionNameFilter as (m: string, n: string) => void)('only', 'nonexistent_name.log');
            const html = String(elements.get('session-list')?.innerHTML ?? '');
            assert.ok(html.includes('No sessions match'), 'Should show filtered-empty hint');
            assert.ok(!html.includes('file:///a1.log'), 'No sessions should be rendered');
        });
    });
});

/**
 * Runtime test for the session panel inlined script.
 * Runs the same script combination the webview runs (transforms + tags + panel)
 * in a minimal VM with mock document/vscodeApi, then dispatches a sessionList
 * message. Catches ReferenceErrors (e.g. missing escapeHtmlText) that syntax-
 * only checks cannot detect.
 */
import * as assert from 'assert';
import { buildSandbox, bootPanel } from './viewer-session-panel-test-helpers';
import { getSessionPanelScript } from '../../ui/viewer-panels/viewer-session-panel';

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

        /* Previews now carry mtime: the host's cheap stat pass supplies it so the
           skeleton day-groups in the SAME structure as the final list (no flat→grouped
           reflow). mtime is the only field grouping needs. */
        const previewMessage = {
            data: {
                type: 'sessionListPreview',
                previews: [
                    { filename: 'alpha.log', uriString: 'file:///alpha.log', mtime: Date.now() },
                    { filename: 'beta.log', uriString: 'file:///beta.log', mtime: Date.now() },
                ],
            },
        };
        for (const handler of messageHandlers) {
            handler(previewMessage);
        }

        const listEl = elements.get('session-list');
        const html = String(listEl?.innerHTML ?? '');
        assert.ok(html.includes('session-shimmer-meta'), 'Preview items should have shimmer meta class');
        assert.ok(html.includes('session-day-heading'), 'Preview should render day-grouped, not flat');
        assert.ok(html.includes('data-filename="alpha.log"'), 'Preview should contain first filename');
        assert.ok(html.includes('data-filename="beta.log"'), 'Preview should contain second filename');
        assert.ok(html.includes('data-uri="file:///alpha.log"'), 'Preview items should have data-uri');
    });

    test('should render reveal-in-OS hover action button on every session row', () => {
        /* Every session row gets a hover button that reveals the log in the OS
           file explorer. The button must carry the revealInOS action and the
           folder-opened codicon, and be wrapped in a session-item-actions
           container that CSS can toggle on hover. */
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);

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
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);

        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionListPreview',
                    previews: [{ filename: 'alpha.log', uriString: 'file:///alpha.log', mtime: Date.now() }],
                },
            });
        }
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('data-session-action="revealInOS"'), 'Preview row should include revealInOS action');
    });

    test('should replace preview with full session list when data arrives', () => {
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);

        // First: preview
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionListPreview',
                    previews: [{ filename: 'alpha.log', uriString: 'file:///alpha.log', mtime: Date.now() }],
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
                    previews: [{ filename: 'alpha.log', uriString: 'file:///alpha.log', mtime: Date.now() }],
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

    /* "Latest only" thins peripheral logs but must NEVER fold a Controller (the project's own
       session, e.g. "contacts"). Every controller run stays visible whether grouped or not;
       only peripheral namesakes collapse behind the latest. */
    suite('latest-only controller exemption', () => {
        function bootLatestOnly(sessions: Array<Record<string, unknown>>): Map<string, Record<string, unknown>> {
            const { sandbox, messageHandlers, elements } = buildSandbox();
            bootPanel(sandbox);
            for (const handler of messageHandlers) {
                handler({ data: { type: 'sessionList', sessions } });
            }
            return elements;
        }

        /* Two controller "contacts" runs + two peripheral "lint" runs, Latest only on by default. */
        const mixed = [
            { uriString: 'file:///c1.log', filename: '20260413_120000_contacts.log', displayName: '20260413_120000_contacts.log', mtime: Date.now() - 60000, trashed: false, role: 'controller' },
            { uriString: 'file:///c2.log', filename: '20260413_110000_contacts.log', displayName: '20260413_110000_contacts.log', mtime: Date.now() - 120000, trashed: false, role: 'controller' },
            { uriString: 'file:///p1.log', filename: '20260413_120500_lint.log', displayName: '20260413_120500_lint.log', mtime: Date.now() - 30000, trashed: false, role: 'peripheral' },
            { uriString: 'file:///p2.log', filename: '20260413_110500_lint.log', displayName: '20260413_110500_lint.log', mtime: Date.now() - 90000, trashed: false, role: 'peripheral' },
        ];

        test('keeps every controller run visible while folding older peripheral namesakes', () => {
            const html = String(bootLatestOnly(mixed).get('session-list')?.innerHTML ?? '');
            assert.ok(html.includes('file:///c1.log'), 'Latest controller run should be visible');
            assert.ok(html.includes('file:///c2.log'), 'Older controller run must NOT be folded by Latest only');
            assert.ok(html.includes('file:///p1.log'), 'Latest peripheral run should be visible');
            assert.ok(!html.includes('file:///p2.log'), 'Older peripheral namesake should fold behind +N older');
        });
    });

    /* The Logs panel used to start a 5-second auto-close countdown after a file was
       opened from it, which closed the panel out from under a user browsing several
       files in a row. That behavior was removed: the panel now stays open until an
       explicit close (icon, outside click, Escape). These assertions pin the removal
       so the timer can't silently return — a behavioral runtime test isn't possible
       because the test harness stubs addEventListener as a no-op and defines no
       setTimeout, so the click handler never fires in the sandbox. */
    suite('no auto-close after opening a file', () => {
        const script = getSessionPanelScript();

        test('does not declare or arm the auto-close timer', () => {
            assert.ok(!script.includes('sessionAutoCloseTimer'),
                'Auto-close timer variable must not be reintroduced');
            assert.ok(!script.includes('setTimeout'),
                'Opening a session must not schedule any deferred panel close');
        });

        test('still opens the file and keeps an explicit close path', () => {
            assert.ok(script.includes('openSessionFromPanel'),
                'Selecting a row must still post openSessionFromPanel');
            assert.ok(script.includes('closeSessionPanel'),
                'Manual/explicit close must still be available');
        });
    });

});


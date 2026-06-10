/**
 * Runtime tests for the kebab "recently opened files" shortcut list.
 *
 * Extracted from viewer-session-panel-runtime.test.ts to keep that file under the 300-line house
 * limit. Drives the real panel script in the shared VM sandbox: dispatching a `sessionList` message
 * runs `renderLoadedFilesMenu`, so these exercise the filter (loadedManually), newest-first sort,
 * 10-row cap, HTML escaping, decoded-path tooltip, and empty-notice toggle end-to-end. The literal
 * click→open round-trip is not covered: the sandbox stubs addEventListener as a no-op, so the
 * delegated handler never fires; that wiring (data-uri → openSessionFromPanel) is asserted at the
 * script-string level in viewer-session-options-menu.test.ts instead.
 */
import * as assert from 'assert';
import { buildSandbox, bootPanel } from './viewer-session-panel-test-helpers';

suite('kebab recently-opened files list', () => {
    function bootWith(sessions: Array<Record<string, unknown>>): Map<string, Record<string, unknown>> {
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);
        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionList', sessions } });
        }
        return elements;
    }
    const loadedFilesHtml = (els: Map<string, Record<string, unknown>>): string =>
        String(els.get('session-loaded-files-list')?.innerHTML ?? '');
    const emptyDisplay = (els: Map<string, Record<string, unknown>>): string =>
        String((els.get('session-loaded-files-empty') as { style: { display: string } }).style.display);

    test('shows the empty notice and no rows when no file was manually opened', () => {
        const els = bootWith([
            { uriString: 'file:///scan.log', filename: 'scan.log', displayName: 'scan.log', mtime: Date.now(), trashed: false },
        ]);
        assert.strictEqual(loadedFilesHtml(els), '', 'No loaded-file rows render when none are flagged');
        assert.strictEqual(emptyDisplay(els), '', 'Empty notice is visible (display not none)');
    });

    test('renders a clickable row only for loadedManually files, hiding the empty notice', () => {
        const els = bootWith([
            { uriString: 'file:///scan.log', filename: 'scan.log', displayName: 'scan.log', mtime: Date.now(), trashed: false },
            { uriString: 'file:///d:/out/manual.log', filename: 'manual.log', displayName: 'manual.log', mtime: Date.now(), trashed: false, loadedManually: true },
        ]);
        const html = loadedFilesHtml(els);
        assert.ok(html.includes('data-uri="file:///d:/out/manual.log"'), 'Loaded file becomes a clickable row carrying its URI');
        assert.ok(html.includes('>manual.log<'), 'Row shows the loaded file name');
        assert.ok(!html.includes('scan.log'), 'A directory-scanned (non-loaded) file is NOT listed here');
        assert.strictEqual(emptyDisplay(els), 'none', 'Empty notice is hidden once a row exists');
    });

    test('caps the list at the 10 most-recently-loaded files', () => {
        /* 12 loaded files with ascending mtime; only the newest 10 (mtime 12..3) survive the cap. */
        const sessions = Array.from({ length: 12 }, (_, i) => ({
            uriString: `file:///d:/out/loaded-${i + 1}.log`,
            filename: `loaded-${i + 1}.log`,
            displayName: `loaded-${i + 1}.log`,
            mtime: i + 1,
            trashed: false,
            loadedManually: true,
        }));
        const html = loadedFilesHtml(bootWith(sessions));
        const rows = (html.match(/session-loaded-file-item/g) ?? []).length;
        assert.strictEqual(rows, 10, 'At most 10 recently-opened rows render');
        assert.ok(html.includes('loaded-12.log'), 'Newest loaded file is kept');
        assert.ok(!html.includes('loaded-1.log'), 'Oldest loaded file past the cap is dropped');
    });

    test('orders rows newest-first by load time', () => {
        const html = loadedFilesHtml(bootWith([
            { uriString: 'file:///d:/out/old.log', filename: 'old.log', displayName: 'old.log', mtime: 100, trashed: false, loadedManually: true },
            { uriString: 'file:///d:/out/new.log', filename: 'new.log', displayName: 'new.log', mtime: 900, trashed: false, loadedManually: true },
        ]));
        assert.ok(html.indexOf('new.log') < html.indexOf('old.log'), 'Most recently loaded file is listed first');
    });

    test('falls back to the filename when displayName is absent', () => {
        const html = loadedFilesHtml(bootWith([
            { uriString: 'file:///d:/out/only-fn.log', filename: 'only-fn.log', mtime: 1, trashed: false, loadedManually: true },
        ]));
        assert.ok(html.includes('>only-fn.log<'), 'Row shows the filename when displayName is missing');
    });

    test('HTML-escapes the displayed file name (no markup injection)', () => {
        const html = loadedFilesHtml(bootWith([
            { uriString: 'file:///d:/out/x.log', filename: 'x.log', displayName: 'a<b>&c.log', mtime: 1, trashed: false, loadedManually: true },
        ]));
        assert.ok(html.includes('a&lt;b&gt;&amp;c.log'), 'Special characters are HTML-escaped');
        assert.ok(!html.includes('a<b>'), 'Raw markup is never injected from a file name');
    });

    test('shows the decoded absolute path as the row tooltip', () => {
        /* The webview only gets uriString; the row tooltip must be the human path — scheme
           stripped, percent-escapes decoded, and the leading slash before a Windows drive dropped. */
        const html = loadedFilesHtml(bootWith([
            { uriString: 'file:///d:/My%20Logs/app.log', filename: 'app.log', displayName: 'app.log', mtime: 1, trashed: false, loadedManually: true },
        ]));
        assert.ok(html.includes('title="d:/My Logs/app.log"'), 'Tooltip is the decoded path with no scheme or leading slash');
    });

    test('clears rows and restores the notice when a later list has no loaded files', () => {
        const { sandbox, messageHandlers, elements } = buildSandbox();
        bootPanel(sandbox);
        const send = (sessions: Array<Record<string, unknown>>): void => {
            for (const handler of messageHandlers) { handler({ data: { type: 'sessionList', sessions } }); }
        };
        send([{ uriString: 'file:///d:/out/m.log', filename: 'm.log', displayName: 'm.log', mtime: 1, trashed: false, loadedManually: true }]);
        assert.ok(String(elements.get('session-loaded-files-list')?.innerHTML ?? '').includes('m.log'), 'Row present after the first list');
        send([{ uriString: 'file:///scan.log', filename: 'scan.log', displayName: 'scan.log', mtime: 2, trashed: false }]);
        assert.strictEqual(String(elements.get('session-loaded-files-list')?.innerHTML ?? ''), '', 'Rows clear when the next list has none loaded');
        assert.strictEqual(
            String((elements.get('session-loaded-files-empty') as { style: { display: string } }).style.display),
            '', 'Empty notice is restored');
    });
});

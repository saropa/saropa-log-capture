/**
 * Runtime tests for the session-list name filter (Hide This Name / Show Only
 * This Name). The filter is cumulative: each pick stacks a removable pill, and
 * the bar renders one [x] per name plus a "Show All" clear. Boots the same
 * inlined webview script in a VM sandbox and drives the window.setSessionNameFilter
 * / removeSessionNameFilter / clearSessionNameFilter functions directly.
 *
 * Extracted from viewer-session-panel-runtime.test.ts to keep that file under the
 * 300-line limit when the cumulative-filter tests were added.
 */
import * as assert from 'assert';
import { buildSandbox, bootPanel } from './viewer-session-panel-test-helpers';

suite('Session panel name filter', () => {
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
        assert.strictEqual(typeof sandbox.removeSessionNameFilter, 'function');
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
        /* Show only sessions named "vibrancy". a1 and a2 are both PERIPHERAL "vibrancy" runs
           (no controller role), so with "Latest only" on by default the older a2 folds behind
           the latest a1's "+N older" badge — latest-only thins peripherals. b1 is filtered by name. */
        (sandbox.setSessionNameFilter as (m: string, n: string) => void)('only', '20260413_120000_vibrancy.log');
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('file:///a1.log'), 'Latest matching session a1 should be visible');
        assert.ok(!html.includes('file:///a2.log'), 'Older matching peripheral a2 is folded by Latest only');
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

    test('should hide cumulatively across multiple names', () => {
        const { sandbox, elements } = bootWithSessions(testSessions);
        /* Hide both names — every session shares one of the two, so the list empties. */
        const setFilter = sandbox.setSessionNameFilter as (m: string, n: string) => void;
        setFilter('hide', '20260413_120000_vibrancy.log');
        setFilter('hide', '20260413_100000_other_app.log');
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(!html.includes('file:///a1.log'), 'vibrancy hidden');
        assert.ok(!html.includes('file:///b1.log'), 'other_app hidden too (cumulative)');
    });

    test('should render one removable pill per hidden name', () => {
        const { sandbox, elements } = bootWithSessions(testSessions);
        const setFilter = sandbox.setSessionNameFilter as (m: string, n: string) => void;
        setFilter('hide', '20260413_120000_vibrancy.log');
        setFilter('hide', '20260413_100000_other_app.log');
        const barHtml = String((elements.get('session-name-filter-bar') as Record<string, string>).innerHTML ?? '');
        const pillCount = (barHtml.match(/session-name-filter-pill-remove/g) ?? []).length;
        assert.strictEqual(pillCount, 2, 'Two names should yield two removable pills');
    });

    test('should drop just one name via removeSessionNameFilter', () => {
        const { sandbox, elements } = bootWithSessions(testSessions);
        const setFilter = sandbox.setSessionNameFilter as (m: string, n: string) => void;
        setFilter('hide', '20260413_120000_vibrancy.log');
        setFilter('hide', '20260413_100000_other_app.log');
        /* Remove only the other_app name — its session returns, vibrancy stays hidden. */
        (sandbox.removeSessionNameFilter as (n: string) => void)('20260413_100000_other_app.log');
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('file:///b1.log'), 'other_app reappears after its pill removed');
        assert.ok(!html.includes('file:///a1.log'), 'vibrancy stays hidden');
    });

    test('should clear the filter bar when the last pill is removed', () => {
        const { sandbox, elements } = bootWithSessions(testSessions);
        (sandbox.setSessionNameFilter as (m: string, n: string) => void)('hide', '20260413_120000_vibrancy.log');
        (sandbox.removeSessionNameFilter as (n: string) => void)('20260413_120000_vibrancy.log');
        const filterBar = elements.get('session-name-filter-bar') as Record<string, Record<string, string>>;
        assert.strictEqual(filterBar.style.display, 'none', 'Bar hides once no names remain');
    });

    test('should reset names when switching between hide and only modes', () => {
        const { sandbox, elements } = bootWithSessions(testSessions);
        const setFilter = sandbox.setSessionNameFilter as (m: string, n: string) => void;
        setFilter('hide', '20260413_120000_vibrancy.log');
        /* Switching to "only" with a new name must not keep the prior hide name. */
        setFilter('only', '20260413_100000_other_app.log');
        const barHtml = String((elements.get('session-name-filter-bar') as Record<string, string>).innerHTML ?? '');
        const pillCount = (barHtml.match(/session-name-filter-pill-remove/g) ?? []).length;
        assert.strictEqual(pillCount, 1, 'Mode switch starts a fresh single-name filter');
        assert.ok(barHtml.includes('Showing only'), 'Bar reflects the new only mode');
    });
});

/**
 * Tests for collapsible day groups in the session panel.
 * Verifies that the grouped rendering produces the correct HTML structure
 * (day-group wrappers, chevrons, aria attributes) and that flat mode
 * omits group containers entirely.
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

/** Boot the panel scripts in a sandbox. */
function bootPanel(sandbox: Record<string, unknown>): void {
    vm.runInContext(getSessionTransformsScript(), sandbox);
    vm.runInContext(getSessionTagsScript(), sandbox);
    vm.runInContext(getSessionPanelScript(), sandbox);
}

/** Boot sandbox and send a session list, return test fixtures. */
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

/** Sessions spanning two different days for day-group tests. */
const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

const twoDaySessions = [
    { uriString: 'file:///today1.log', filename: 'today1.log', displayName: 'today1.log', mtime: today.getTime(), trashed: false },
    { uriString: 'file:///today2.log', filename: 'today2.log', displayName: 'today2.log', mtime: today.getTime() - 1000, trashed: false },
    { uriString: 'file:///yesterday1.log', filename: 'yesterday1.log', displayName: 'yesterday1.log', mtime: yesterday.getTime(), trashed: false },
];

suite('Collapsible day groups', () => {
    test('should render day group containers with data-day-key attribute', () => {
        const { elements } = bootWithSessions(twoDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        /* Day headings are enabled by default, so grouped rendering produces
           session-day-group wrappers with data-day-key attributes. */
        assert.ok(html.includes('session-day-group'), 'Should render day group containers');
        assert.ok(html.includes('data-day-key='), 'Day groups should have data-day-key');
    });

    test('should render chevron icons in day headings', () => {
        const { elements } = bootWithSessions(twoDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        /* Expanded groups show codicon-chevron-down by default. */
        assert.ok(html.includes('session-day-chevron'), 'Day headings should have chevron element');
        assert.ok(html.includes('codicon-chevron-down'), 'Expanded groups should show down chevron');
    });

    test('should render day headings with aria-expanded true by default', () => {
        const { elements } = bootWithSessions(twoDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('aria-expanded="true"'), 'Headings should be aria-expanded=true');
    });

    test('should wrap session items inside session-day-items container', () => {
        const { elements } = bootWithSessions(twoDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('session-day-items'), 'Sessions should be inside day-items container');
    });

    test('should produce separate day groups for different dates', () => {
        const { elements } = bootWithSessions(twoDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        /* Each group has the class in its opening div — count those. */
        const groupCount = (html.match(/class="session-day-group/g) || []).length;
        assert.strictEqual(groupCount, 2, 'Should produce two separate day groups');
    });

    test('should include session items inside their date group', () => {
        const { elements } = bootWithSessions(twoDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        /* Both today sessions should appear in the rendered HTML. */
        assert.ok(html.includes('file:///today1.log'), 'Today session 1 should be rendered');
        assert.ok(html.includes('file:///today2.log'), 'Today session 2 should be rendered');
        assert.ok(html.includes('file:///yesterday1.log'), 'Yesterday session should be rendered');
    });

    test('should render day headings with role=button and tabindex', () => {
        const { elements } = bootWithSessions(twoDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('role="button"'), 'Day heading should have role=button');
        assert.ok(html.includes('tabindex="0"'), 'Day heading should have tabindex=0');
    });

    test('should not render day groups when showDayHeadings is off', () => {
        const { sandbox: _sb, elements, messageHandlers } = buildSandbox();
        bootPanel(_sb);
        /* Toggle off day headings before sending session list. */
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionDisplayOptions',
                    options: {
                        stripDatetime: true, normalizeNames: true,
                        showDayHeadings: false, reverseSort: false,
                        showLatestOnly: false, dateRange: 'all',
                    },
                },
            });
        }
        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionList', sessions: twoDaySessions } });
        }
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(!html.includes('session-day-group'), 'Flat mode should not render day groups');
        assert.ok(!html.includes('session-day-heading'), 'Flat mode should not render day headings');
    });

    test('should render without error for a single-day list', () => {
        const singleDaySessions = [
            { uriString: 'file:///a.log', filename: 'a.log', displayName: 'a.log', mtime: today.getTime(), trashed: false },
            { uriString: 'file:///b.log', filename: 'b.log', displayName: 'b.log', mtime: today.getTime() - 500, trashed: false },
        ];
        const { elements } = bootWithSessions(singleDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        const groupCount = (html.match(/class="session-day-group/g) || []).length;
        assert.strictEqual(groupCount, 1, 'Single day should produce exactly one group');
    });

    test('should show file count in day heading for today group', () => {
        const { elements } = bootWithSessions(twoDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        /* Today has 2 sessions, yesterday has 1. Both should show counts in parentheses. */
        assert.ok(html.includes('session-day-count'), 'Day headings should include count badge');
        assert.ok(html.includes('(2)'), 'Today group should show count (2)');
        assert.ok(html.includes('(1)'), 'Yesterday group should show count (1)');
    });

    test('should not show file count when day headings are off', () => {
        const { sandbox: _sb, elements, messageHandlers } = buildSandbox();
        bootPanel(_sb);
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionDisplayOptions',
                    options: {
                        stripDatetime: true, normalizeNames: true,
                        showDayHeadings: false, reverseSort: false,
                        showLatestOnly: false, dateRange: 'all',
                    },
                },
            });
        }
        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionList', sessions: twoDaySessions } });
        }
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(!html.includes('session-day-count'), 'Flat mode should not render count badges');
    });
});

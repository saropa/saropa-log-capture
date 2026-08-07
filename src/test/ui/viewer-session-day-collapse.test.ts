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
import { vtStub } from './viewer-session-panel-test-helpers';

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
        // Webview l10n bridge stand-in — render scripts now resolve strings via vt().
        vt: vtStub,
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
        /* Today has 2 sessions, yesterday has 1. Both show the count in a pill (no parens). */
        assert.ok(html.includes('session-day-count'), 'Day headings should include count badge');
        assert.ok(html.includes('class="session-day-count">2<'), 'Today group should show count 2');
        assert.ok(html.includes('class="session-day-count">1<'), 'Yesterday group should show count 1');
    });

    test('severity pill count is comma-grouped for large logs', () => {
        const { sandbox } = buildSandbox();
        bootPanel(sandbox);
        /* renderSeverityDots is a top-level fn in the transforms chunk, so it is a global
           on the VM context. Exercise the real pill path: a five-figure error count must
           render as "12,480" inside the sev-count-error pill, not raw "12480". */
        const render = sandbox.renderSeverityDots as (s: Record<string, number>) => string;
        const html = render({ errorCount: 12480, lineCount: 12480 });
        assert.ok(html.includes('sev-count-error'), 'renders an error pill');
        assert.ok(html.includes('>12,480<'), 'large error count is comma-grouped');
        // The pill now carries its category prefix letter inside the pill (E for error), before
        // the count. Pin the letter + argument order so a wrong `letter` arg to sevPair is caught.
        assert.ok(
            html.includes('<span class="sev-count-letter">E</span>12,480'),
            'error pill shows the "E" prefix letter immediately before the count',
        );
    });

    test('groupThousands leaves small counts unchanged', () => {
        const { sandbox } = buildSandbox();
        bootPanel(sandbox);
        const gt = sandbox.groupThousands as (n: number) => string;
        assert.strictEqual(gt(42), '42', 'no separator below 1,000');
        assert.strictEqual(gt(1000), '1,000', 'separator at the thousand boundary');
    });

    test('should default non-today day groups to collapsed', () => {
        const { elements } = bootWithSessions(twoDaySessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        /* Two day groups: today (expanded) and yesterday (collapsed by default). */
        const groups = html.match(/<div class="session-day-group[^"]*"[^>]*data-day-key="([^"]+)"/g) || [];
        assert.strictEqual(groups.length, 2, 'Should have two day groups');
        /* Today's group should NOT have the collapsed class. */
        const todayKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const todayGroup = html.match(new RegExp('class="session-day-group([^"]*)"[^>]*data-day-key="' + todayKey + '"'));
        assert.ok(todayGroup, 'Today group should exist');
        assert.ok(!todayGroup![1].includes('collapsed'), 'Today group should be expanded');
        /* Yesterday's group should have the collapsed class. */
        const yKey = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
        const yGroup = html.match(new RegExp('class="session-day-group([^"]*)"[^>]*data-day-key="' + yKey + '"'));
        assert.ok(yGroup, 'Yesterday group should exist');
        assert.ok(yGroup![1].includes('collapsed'), 'Yesterday group should be collapsed by default');
    });

    test('should respect explicit false in collapsedDays (user expanded)', () => {
        const yKey = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
        const { sandbox: _sb, elements, messageHandlers } = buildSandbox();
        bootPanel(_sb);
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionDisplayOptions',
                    options: {
                        stripDatetime: true, normalizeNames: true,
                        showDayHeadings: true, reverseSort: false,
                        showLatestOnly: false, dateRange: 'all',
                        collapsedDays: { [yKey]: false },
                    },
                },
            });
        }
        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionList', sessions: twoDaySessions } });
        }
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        const yGroup = html.match(new RegExp('class="session-day-group([^"]*)"[^>]*data-day-key="' + yKey + '"'));
        assert.ok(yGroup, 'Yesterday group should exist');
        assert.ok(!yGroup![1].includes('collapsed'), 'Yesterday should be expanded when collapsedDays has false');
    });

    test('collapsed severity pills: non-latest rows show collapsed count', () => {
        const sessions = [
            { uriString: 'file:///a1.log', filename: 'app.log', displayName: 'app.log', mtime: today.getTime(), trashed: false, lineCount: 500, errorCount: 10, warningCount: 20 },
            { uriString: 'file:///a2.log', filename: 'app.log', displayName: 'app.log', mtime: today.getTime() - 60000, trashed: false, lineCount: 300, errorCount: 5, warningCount: 8 },
        ];
        const { elements } = bootWithSessions(sessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('sev-dots-collapsed'), 'Non-latest row should have collapsed pill');
        assert.ok(html.includes('sev-collapsed-total'), 'Collapsed pill should show total count element');
    });

    test('collapsed severity pills: latest row shows full breakdown', () => {
        const sessions = [
            { uriString: 'file:///a1.log', filename: 'app.log', displayName: 'app.log', mtime: today.getTime(), trashed: false, lineCount: 500, errorCount: 10, warningCount: 20, isLatestOfName: true },
        ];
        const { elements } = bootWithSessions(sessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('sev-count-error'), 'Latest row should show full error pill');
        assert.ok(html.includes('sev-count-warning'), 'Latest row should show full warning pill');
        assert.ok(!html.includes('sev-dots-collapsed'), 'Latest row should not be collapsed');
    });

    test('collapsed severity pills: active row shows full breakdown', () => {
        const sessions = [
            { uriString: 'file:///a1.log', filename: 'active.log', displayName: 'active.log', mtime: today.getTime(), trashed: false, lineCount: 100, errorCount: 3, isActive: true },
        ];
        const { elements } = bootWithSessions(sessions);
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(html.includes('sev-count-error'), 'Active row should show full error pill');
        assert.ok(!html.includes('sev-dots-collapsed'), 'Active row should not be collapsed');
    });

    test('collapsed severity pills: toggle off shows full breakdown for all', () => {
        const sessions = [
            { uriString: 'file:///a1.log', filename: 'app.log', displayName: 'app.log', mtime: today.getTime(), trashed: false, lineCount: 500, errorCount: 10 },
            { uriString: 'file:///a2.log', filename: 'app.log', displayName: 'app.log', mtime: today.getTime() - 60000, trashed: false, lineCount: 300, errorCount: 5 },
        ];
        const { sandbox: _sb, elements, messageHandlers } = buildSandbox();
        bootPanel(_sb);
        for (const handler of messageHandlers) {
            handler({
                data: {
                    type: 'sessionDisplayOptions',
                    options: {
                        stripDatetime: true, normalizeNames: true,
                        showDayHeadings: true, reverseSort: false,
                        showLatestOnly: false, dateRange: 'all',
                        collapseSeverityCounts: false,
                    },
                },
            });
        }
        for (const handler of messageHandlers) {
            handler({ data: { type: 'sessionList', sessions } });
        }
        const html = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(!html.includes('sev-dots-collapsed'), 'No collapsed pills when toggle is off');
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

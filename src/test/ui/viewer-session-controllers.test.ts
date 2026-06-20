/**
 * Tests for the Controller-rooted day tree in the session panel.
 *
 * Verifies the webview grouping: project sessions become Controllers, peripherals attach to the
 * nearest EARLIER controller of the day, peripherals before the first controller render flat
 * (orphans), and "Latest only" folds older namesakes behind a "+N older" badge instead of hiding
 * them. Runs the generated panel script in a vm sandbox with a mock DOM, mirroring
 * viewer-session-day-collapse.test.ts.
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
        innerHTML: '', textContent: '',
        addEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
        contains: () => false, getAttribute: () => null, setAttribute: noop, focus: noop,
    };
}

function buildSandbox(): {
    messageHandlers: Array<(e: { data?: unknown }) => void>;
    elements: Map<string, Record<string, unknown>>;
} {
    const elements = new Map<string, Record<string, unknown>>();
    const getEl = (id: string): Record<string, unknown> => {
        if (!elements.has(id)) { elements.set(id, mockEl()); }
        return elements.get(id)!;
    };
    const messageHandlers: Array<(e: { data?: unknown }) => void> = [];
    const sandbox: Record<string, unknown> = {
        document: { getElementById: (id: string) => getEl(id), addEventListener: noop },
        CSS: { escape: (v: string) => v },
        vscodeApi: { postMessage: noop },
        requestAnimationFrame: (fn: () => void) => fn(),
        __sharedPanelWidth: 560,
        vt: vtStub,
    };
    sandbox.window = sandbox;
    sandbox.addEventListener = (type: string, fn: (e: { data?: unknown }) => void) => {
        if (type === 'message') { messageHandlers.push(fn); }
    };
    vm.createContext(sandbox);
    vm.runInContext(getSessionTransformsScript(), sandbox);
    vm.runInContext(getSessionTagsScript(), sandbox);
    vm.runInContext(getSessionPanelScript(), sandbox);
    return { messageHandlers, elements };
}

/** Boot a sandbox, optionally override display options, send the list, return the rendered HTML. */
function renderHtml(sessions: Array<Record<string, unknown>>, options?: Record<string, unknown>): string {
    const { messageHandlers, elements } = buildSandbox();
    if (options) {
        for (const h of messageHandlers) { h({ data: { type: 'sessionDisplayOptions', options } }); }
    }
    for (const h of messageHandlers) { h({ data: { type: 'sessionList', sessions } }); }
    return String(elements.get('session-list')?.innerHTML ?? '');
}

const day = new Date();
const at = (h: number, m: number): number =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();

/** Display options with Latest-only OFF so every row renders (attach tests want all rows visible). */
const showAll = {
    stripDatetime: true, normalizeNames: true, showDayHeadings: true,
    reverseSort: false, showLatestOnly: false, dateRange: 'all',
};

suite('Controller-rooted session tree', () => {
    test('a controller wraps its later peripheral as a child', () => {
        const sessions = [
            { uriString: 'file:///ctl.log', filename: 'ctl.log', displayName: 'Contacts', role: 'controller', mtime: at(10, 0), trashed: false },
            { uriString: 'file:///lint.log', filename: 'lint.log', displayName: 'Lint', role: 'peripheral', mtime: at(10, 30), trashed: false },
        ];
        const html = renderHtml(sessions, showAll);
        assert.ok(html.includes('session-controller-group'), 'controller block rendered');
        assert.ok(html.includes('session-item-controller'), 'controller header row marked');
        assert.ok(html.includes('session-controller-children'), 'children container rendered');
        assert.ok(html.includes('file:///lint.log'), 'peripheral row rendered');
        /* Exactly one peripheral attached → "+1" child-count badge on the controller header. */
        assert.ok(html.includes('>+1<'), 'controller shows +1 child badge');
    });

    test('peripheral attaches to the nearest EARLIER controller', () => {
        // Controllers at 10:00 and 12:00; a peripheral at 11:00 must attach to the 10:00 one.
        const sessions = [
            { uriString: 'file:///c12.log', filename: 'c12.log', displayName: 'Contacts', role: 'controller', mtime: at(12, 0), trashed: false },
            { uriString: 'file:///per.log', filename: 'per.log', displayName: 'Lint', role: 'peripheral', mtime: at(11, 0), trashed: false },
            { uriString: 'file:///c10.log', filename: 'c10.log', displayName: 'Builder', role: 'controller', mtime: at(10, 0), trashed: false },
        ];
        const html = renderHtml(sessions, showAll);
        const groups = (html.match(/class="session-controller-group/g) || []).length;
        assert.strictEqual(groups, 2, 'two controller blocks');
        /* Exactly one controller gains the child → a single "+1" badge across the whole list. */
        const childBadges = (html.match(/>\+1</g) || []).length;
        assert.strictEqual(childBadges, 1, 'only the nearest-earlier controller gets the child');
    });

    test("a peripheral before the day's first controller is an orphan (not nested)", () => {
        const sessions = [
            { uriString: 'file:///early.log', filename: 'early.log', displayName: 'Lint', role: 'peripheral', mtime: at(9, 0), trashed: false },
            { uriString: 'file:///ctl.log', filename: 'ctl.log', displayName: 'Contacts', role: 'controller', mtime: at(10, 0), trashed: false },
        ];
        const html = renderHtml(sessions, showAll);
        assert.ok(html.includes('file:///early.log'), 'orphan row still rendered');
        /* Controller has no children → no "+N" child badge anywhere. */
        assert.ok(!/>\+\d+</.test(html), 'no child-count badge when the only peripheral is an orphan');
    });

    test('no role data → flat list (degrades to pre-feature behavior)', () => {
        const sessions = [
            { uriString: 'file:///a.log', filename: 'a.log', displayName: 'Alpha', mtime: at(10, 0), trashed: false },
            { uriString: 'file:///b.log', filename: 'b.log', displayName: 'Beta', mtime: at(10, 1), trashed: false },
        ];
        const html = renderHtml(sessions, showAll);
        assert.ok(!html.includes('session-controller-group'), 'no controller blocks without roles');
        assert.ok(html.includes('file:///a.log') && html.includes('file:///b.log'), 'both rows rendered flat');
    });

    test('a streaming batch without group extras keeps the controller collapse key stable', () => {
        // Regression: the deferred severity scan and streaming hydration re-post each row via
        // buildSessionItemRecord WITHOUT the SessionGroup extras, so those batch rows carry
        // isGroupPrimary:false / groupSize:0. If mergeStreamingRecord overwrote the cached record
        // wholesale, the next re-render re-picked a different controller primary (the active row
        // sorts first), flipping the collapse key 'ctrl:<uriString>' and silently dropping the
        // user's collapse. The active recording session fires these batches constantly, so the
        // collapse "sometimes worked" and the row flickered. mergeStreamingRecord must preserve
        // the cached grouping hints.
        const { messageHandlers, elements } = buildSandbox();
        const send = (data: unknown): void => { for (const h of messageHandlers) { h({ data }); } };
        const gid = 'g-contacts';
        const sessions = [
            { uriString: 'file:///contacts.log', filename: 'contacts.log', displayName: 'Contacts', role: 'controller', groupId: gid, isGroupPrimary: true, groupSize: 2, mtime: at(10, 49), isActive: false, trashed: false, hasTimestamps: true },
            { uriString: 'file:///dart.log', filename: 'dart.log', displayName: 'dart', role: 'controller', groupId: gid, isGroupPrimary: false, groupSize: 2, mtime: at(10, 50), isActive: true, trashed: false, hasTimestamps: true },
        ];
        send({ type: 'sessionDisplayOptions', options: showAll });
        send({ type: 'sessionList', sessions });
        const before = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(before.includes('ctrl:file:///contacts.log'), 'controller is keyed on the primary (Contacts)');

        // Deferred severity scan / hydration re-posts the primary row stripped of group extras.
        send({ type: 'sessionListBatch', items: [
            { uriString: 'file:///contacts.log', filename: 'contacts.log', displayName: 'Contacts', role: 'controller', groupId: gid, isGroupPrimary: false, groupSize: 0, mtime: at(10, 49), errorCount: 9, isActive: false, trashed: false, hasTimestamps: true },
        ] });
        // A later re-render runs off the (possibly corrupted) cachedSessions — here a display echo.
        send({ type: 'sessionDisplayOptions', options: showAll });
        const after = String(elements.get('session-list')?.innerHTML ?? '');
        assert.ok(after.includes('ctrl:file:///contacts.log'), 'controller key stays on Contacts after the batch');
        assert.ok(!after.includes('ctrl:file:///dart.log'), 'primary did not flip to the active dart row');
    });

    test('Latest-only folds older namesakes behind a "+N older" badge', () => {
        // Two logs share the canonical name "Lint"; the older must be hidden, the newer keeps a badge.
        const sessions = [
            { uriString: 'file:///lint-new.log', filename: 'lint-new.log', displayName: 'Lint', role: 'peripheral', mtime: at(11, 0), trashed: false },
            { uriString: 'file:///lint-old.log', filename: 'lint-old.log', displayName: 'Lint', role: 'peripheral', mtime: at(9, 0), trashed: false },
        ];
        const html = renderHtml(sessions, { ...showAll, showLatestOnly: true });
        assert.ok(html.includes('session-older-toggle'), 'older badge rendered on the latest row');
        assert.ok(html.includes('file:///lint-new.log'), 'latest namesake visible');
        assert.ok(!html.includes('file:///lint-old.log'), 'older namesake hidden until expanded');
    });
});

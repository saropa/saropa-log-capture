import * as assert from 'assert';
import { SESSION_PANEL_ROOT_KEY } from '../ui/provider/viewer-handler-wiring';
import { applySessionStartedState, DebugLifecycleDeps } from '../extension-lifecycle';

/**
 * In-memory mock of vscode.Memento (workspaceState / globalState).
 * Supports get/update with type-safe defaults, enough for lifecycle tests.
 */
class MockMemento {
    private store = new Map<string, unknown>();

    get<T>(key: string, defaultValue?: T): T {
        return (this.store.has(key) ? this.store.get(key) : defaultValue) as T;
    }

    async update(key: string, value: unknown): Promise<void> {
        if (value === undefined) {
            this.store.delete(key);
        } else {
            this.store.set(key, value);
        }
    }

    has(key: string): boolean { return this.store.has(key); }
}

/** No-op stub that swallows every method call — used for deps we don't inspect. */
const noop = () => {};
const noopProxy = new Proxy({}, { get: () => noop }) as Record<string, unknown>;

/** Build minimal mock deps for applySessionStartedState. */
function makeDeps(workspaceState: MockMemento): {
    deps: DebugLifecycleDeps;
    firedEvents: { sessionStart: unknown[] };
} {
    const firedEvents = { sessionStart: [] as unknown[] };
    const deps: DebugLifecycleDeps = {
        context: {
            workspaceState,
            extension: { packageJSON: { version: '0.0.0' } },
            subscriptions: [],
        } as unknown as DebugLifecycleDeps['context'],
        sessionManager: {
            getActiveSession: () => undefined,
            getActiveFilename: () => undefined,
        } as unknown as DebugLifecycleDeps['sessionManager'],
        broadcaster: noopProxy as unknown as DebugLifecycleDeps['broadcaster'],
        historyProvider: noopProxy as unknown as DebugLifecycleDeps['historyProvider'],
        viewerProvider: noopProxy as unknown as DebugLifecycleDeps['viewerProvider'],
        inlineDecorations: noopProxy as unknown as DebugLifecycleDeps['inlineDecorations'],
        updateSessionNav: async () => {},
        aiWatcher: noopProxy as unknown as DebugLifecycleDeps['aiWatcher'],
        fireSessionStart: (e: unknown) => { firedEvents.sessionStart.push(e); },
        fireSessionEnd: noop,
    };
    return { deps, firedEvents };
}

/** Build a minimal mock DebugSession. */
function makeSession(overrides?: {
    workspaceFolder?: { name: string; uri: { fsPath: string } };
}): import('vscode').DebugSession {
    return {
        id: 'test-session-1',
        type: 'dart',
        name: 'Test Config',
        workspaceFolder: overrides?.workspaceFolder as unknown as import('vscode').WorkspaceFolder,
        configuration: { name: 'Test Config', type: 'dart', request: 'launch' },
        customRequest: async () => ({}),
        getDebugProtocolBreakpoint: async () => undefined,
    } as unknown as import('vscode').DebugSession;
}

suite('applySessionStartedState', () => {

    test('should clear stale SESSION_PANEL_ROOT_KEY override on session start', () => {
        const ws = new MockMemento();
        // Simulate a stale override left from a previous "Browse" action
        // pointing at a different project's log directory.
        ws.update(SESSION_PANEL_ROOT_KEY, 'file:///d:/src/other-project/reports');

        const { deps } = makeDeps(ws);
        const session = makeSession();

        applySessionStartedState(deps, session);

        // The override should be cleared so the panel reverts to the workspace
        // default log directory instead of showing the stale browsed path.
        assert.strictEqual(
            ws.has(SESSION_PANEL_ROOT_KEY),
            false,
            'SESSION_PANEL_ROOT_KEY should be cleared after session start',
        );
    });

    test('should be a no-op when no override exists', () => {
        const ws = new MockMemento();
        // No override set — workspace default is already active.
        const { deps } = makeDeps(ws);
        const session = makeSession();

        applySessionStartedState(deps, session);

        assert.strictEqual(
            ws.has(SESSION_PANEL_ROOT_KEY),
            false,
            'SESSION_PANEL_ROOT_KEY should remain absent',
        );
    });

    test('should fire sessionStart event with correct project name', () => {
        const ws = new MockMemento();
        const { deps, firedEvents } = makeDeps(ws);
        const session = makeSession({
            workspaceFolder: { name: 'contacts', uri: { fsPath: 'd:\\src\\contacts' } },
        });

        applySessionStartedState(deps, session);

        assert.strictEqual(firedEvents.sessionStart.length, 1, 'should fire exactly one sessionStart');
        const event = firedEvents.sessionStart[0] as Record<string, unknown>;
        assert.strictEqual(event['projectName'], 'contacts');
        assert.strictEqual(event['debugSessionId'], 'test-session-1');
    });

    test('should refresh historyProvider after clearing override', () => {
        const ws = new MockMemento();
        ws.update(SESSION_PANEL_ROOT_KEY, 'file:///stale/path');

        const callOrder: string[] = [];
        const { deps } = makeDeps(ws);
        // Replace the Proxy-based historyProvider with a plain object so we can
        // instrument setActiveUri / refresh and observe call ordering.
        const instrumentedHistory = {
            setActiveUri: () => {
                // At this point the override should already be cleared.
                callOrder.push(ws.has(SESSION_PANEL_ROOT_KEY) ? 'setActiveUri:stale' : 'setActiveUri:cleared');
            },
            refresh: () => {
                callOrder.push(ws.has(SESSION_PANEL_ROOT_KEY) ? 'refresh:stale' : 'refresh:cleared');
            },
        };
        (deps as unknown as Record<string, unknown>).historyProvider = instrumentedHistory;

        const session = makeSession();
        applySessionStartedState(deps, session);

        // Both calls should see the override already cleared (ordering matters).
        assert.deepStrictEqual(callOrder, ['setActiveUri:cleared', 'refresh:cleared']);
    });
});

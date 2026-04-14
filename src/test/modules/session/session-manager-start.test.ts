import * as assert from 'assert';
import { describe, it } from 'mocha';
import { startSessionImpl, type StartSessionDeps } from '../../../modules/session/session-manager-start';
import type { LogSession } from '../../../modules/capture/log-session';
import { getConfig } from '../../../modules/config/config';

/** Collect output channel messages for assertion. */
function makeOutputChannel(): { appendLine: (s: string) => void; messages: string[] } {
    const messages: string[] = [];
    return { appendLine: (s: string) => { messages.push(s); }, messages };
}

/** Build a minimal config merged with overrides. */
function makeConfig(overrides: Record<string, unknown>) {
    return { ...getConfig(), ...overrides } as ReturnType<typeof getConfig>;
}

/** Minimal mock DebugSession. */
function makeSession(overrides?: {
    id?: string;
    type?: string;
    parentSession?: { id: string } | null;
}): import('vscode').DebugSession {
    return {
        id: overrides?.id ?? 'session-1',
        type: overrides?.type ?? 'dart',
        name: 'Launch',
        parentSession: overrides?.parentSession ?? undefined,
        workspaceFolder: { name: 'test', uri: { fsPath: '/test' } },
        configuration: { name: 'Launch', type: 'dart', request: 'launch' },
        customRequest: async () => ({}),
        getDebugProtocolBreakpoint: async () => undefined,
    } as unknown as import('vscode').DebugSession;
}

/** Build StartSessionDeps with sensible defaults and the given overrides. */
function makeDeps(overrides: {
    config?: ReturnType<typeof getConfig>;
    sessions?: Map<string, LogSession>;
    ownerSessionIds?: Set<string>;
    ownerSessionCreatedAt?: Map<string, number>;
    outputChannel?: ReturnType<typeof makeOutputChannel>;
}): StartSessionDeps {
    const oc = overrides.outputChannel ?? makeOutputChannel();
    return {
        config: overrides.config ?? makeConfig({ enabled: true }),
        sessions: overrides.sessions ?? new Map(),
        ownerSessionIds: overrides.ownerSessionIds ?? new Set(),
        ownerSessionCreatedAt: overrides.ownerSessionCreatedAt ?? new Map(),
        childToParentId: new Map(),
        earlyBuffer: { drain: () => [], drainAll: () => [] } as any,
        outputChannel: oc as any,
        getSingleRecentOwnerSession: () => null,
        statusBar: { updateLineCount: () => {}, show: () => {} },
        broadcastSplit: () => {},
        onOutputEvent: () => {},
        clearBufferTimeoutState: () => {},
    };
}

/** Minimal mock ExtensionContext — startSessionImpl only needs it for initializeSession. */
const mockContext = {
    extension: { packageJSON: { version: '0.0.0' } },
    subscriptions: [],
    workspaceState: { get: () => undefined, update: async () => {} },
    globalState: { get: () => undefined, update: async () => {} },
    extensionUri: { fsPath: '/ext' },
} as unknown as import('vscode').ExtensionContext;

describe('startSessionImpl', () => {

    it('should return skipped and log when config.enabled is false', async () => {
        const oc = makeOutputChannel();
        const deps = makeDeps({
            config: makeConfig({ enabled: false }),
            outputChannel: oc,
        });

        const outcome = await startSessionImpl(makeSession(), mockContext, deps);

        assert.strictEqual(outcome.kind, 'skipped');
        assert.ok(
            oc.messages.some(m => m.includes('enabled is false')),
            `Expected "enabled is false" log, got: ${JSON.stringify(oc.messages)}`,
        );
    });

    it('should return aliased when child session has known parent', async () => {
        const oc = makeOutputChannel();
        const parentLog = { appendLine: () => {}, lineCount: 0 } as unknown as LogSession;
        const sessions = new Map<string, LogSession>([['parent-1', parentLog]]);
        const deps = makeDeps({ sessions, outputChannel: oc });

        const childSession = makeSession({ id: 'child-1', parentSession: { id: 'parent-1' } });
        const outcome = await startSessionImpl(childSession, mockContext, deps);

        assert.strictEqual(outcome.kind, 'aliased');
        // Child should now map to the parent's LogSession.
        assert.strictEqual(sessions.get('child-1'), parentLog);
        assert.ok(
            oc.messages.some(m => m.includes('Child session aliased to parent')),
            `Expected aliasing log, got: ${JSON.stringify(oc.messages)}`,
        );
    });

    it('should return aliased when race guard matches a recent owner session', async () => {
        const oc = makeOutputChannel();
        const recentLog = { appendLine: () => {}, lineCount: 0 } as unknown as LogSession;
        const deps = makeDeps({ outputChannel: oc });
        // Override to return a recent session (simulates a session created <5s ago).
        deps.getSingleRecentOwnerSession = () => ({ sid: 'recent-1', logSession: recentLog });

        // The session needs a parentSession so the 30s "recent child" fallback (line 66 in
        // session-manager-start.ts) is skipped — that check only runs when parentSession is
        // absent. With a parentSession whose id is NOT in sessions, the parent alias check
        // also fails, falling through to the race guard.
        const outcome = await startSessionImpl(
            makeSession({ id: 'new-1', parentSession: { id: 'unknown-parent' } }),
            mockContext,
            deps,
        );

        assert.strictEqual(outcome.kind, 'aliased');
        assert.ok(
            oc.messages.some(m => m.includes('race guard')),
            `Expected race guard log, got: ${JSON.stringify(oc.messages)}`,
        );
    });
});

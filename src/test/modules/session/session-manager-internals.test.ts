import * as assert from 'assert';
import * as vscode from 'vscode';
import { describe, it } from 'mocha';
import { getSingleRecentOwnerSession, getMostRecentOwnerSessionId } from '../../../modules/session/session-manager-internals';
import type { LogSession } from '../../../modules/capture/log-session';

/** Build a minimal vscode.WorkspaceFolder for a given fsPath. */
function folder(fsPath: string): vscode.WorkspaceFolder {
    return { uri: { fsPath } as vscode.Uri, name: fsPath, index: 0 };
}

/** Build a fake LogSession whose sessionContext carries just the workspaceFolder these tests need. */
function fakeLogSession(workspaceFolder: vscode.WorkspaceFolder): LogSession {
    return { sessionContext: { workspaceFolder } } as unknown as LogSession;
}

// Bug 034 regression coverage: the sweep report flagged that getSingleRecentOwnerSession (the
// 5s race-guard and 30s recent-child fallback paths in session-manager-start.ts) aliased a new
// debug session to ANY LogSession created within the window, with no workspace-folder check —
// so a folder-B session starting within 5s of folder-A's session start got permanently aliased
// to folder A's log file. These tests exercise the fix directly against the real timing/window
// logic, rather than through a mock that bypasses it.
describe('getSingleRecentOwnerSession', () => {

    it('should alias when the single recent owner is in the same workspace folder', () => {
        const folderA = folder('/repo/folder-a');
        const logSession = fakeLogSession(folderA);
        const ownerSessionIds = new Set(['owner-1']);
        const ownerSessionCreatedAt = new Map([['owner-1', Date.now()]]);
        const sessions = new Map([['owner-1', logSession]]);

        const result = getSingleRecentOwnerSession(ownerSessionIds, ownerSessionCreatedAt, sessions, 5000, folderA);

        assert.ok(result);
        assert.strictEqual(result?.logSession, logSession);
    });

    it('should refuse to alias across workspace folders (the bug 034 reproduction)', () => {
        const folderA = folder('/repo/folder-a');
        const folderB = folder('/repo/folder-b');
        const logSession = fakeLogSession(folderA);
        const ownerSessionIds = new Set(['owner-1']);
        const ownerSessionCreatedAt = new Map([['owner-1', Date.now()]]);
        const sessions = new Map([['owner-1', logSession]]);

        // Folder B's debug session starts within the 5s race-guard window that used to alias
        // unconditionally onto folder A's session — must now return null instead.
        const result = getSingleRecentOwnerSession(ownerSessionIds, ownerSessionCreatedAt, sessions, 5000, folderB);

        assert.strictEqual(result, null);
    });

    it('should still alias when no workspaceFolder is supplied (single-root callers unaffected)', () => {
        const folderA = folder('/repo/folder-a');
        const logSession = fakeLogSession(folderA);
        const ownerSessionIds = new Set(['owner-1']);
        const ownerSessionCreatedAt = new Map([['owner-1', Date.now()]]);
        const sessions = new Map([['owner-1', logSession]]);

        const result = getSingleRecentOwnerSession(ownerSessionIds, ownerSessionCreatedAt, sessions, 5000, undefined);

        assert.ok(result);
    });

    it('should return null when the owner session is outside the timing window', () => {
        const folderA = folder('/repo/folder-a');
        const logSession = fakeLogSession(folderA);
        const ownerSessionIds = new Set(['owner-1']);
        const ownerSessionCreatedAt = new Map([['owner-1', Date.now() - 10_000]]);
        const sessions = new Map([['owner-1', logSession]]);

        const result = getSingleRecentOwnerSession(ownerSessionIds, ownerSessionCreatedAt, sessions, 5000, folderA);

        assert.strictEqual(result, null);
    });
});

// Bug 034: the multi-owner "most recent session wins" fallback in session-manager-routing.ts
// had the same gap — it picked the newest owner session purely by timestamp, which could route
// folder B's output into folder A's log if A's session happened to be newer.
describe('getMostRecentOwnerSessionId', () => {

    it('should pick the most recent session within the same workspace folder', () => {
        const folderA = folder('/repo/folder-a');
        const older = fakeLogSession(folderA);
        const newer = fakeLogSession(folderA);
        const ownerSessionIds = new Set(['older-1', 'newer-1']);
        const ownerSessionCreatedAt = new Map([['older-1', 1000], ['newer-1', 2000]]);
        const sessions = new Map([['older-1', older], ['newer-1', newer]]);

        const result = getMostRecentOwnerSessionId(ownerSessionIds, ownerSessionCreatedAt, sessions, folderA);

        assert.strictEqual(result, 'newer-1');
    });

    it('should skip a newer session from a different workspace folder', () => {
        const folderA = folder('/repo/folder-a');
        const folderB = folder('/repo/folder-b');
        const olderInA = fakeLogSession(folderA);
        const newerInB = fakeLogSession(folderB);
        const ownerSessionIds = new Set(['older-a', 'newer-b']);
        const ownerSessionCreatedAt = new Map([['older-a', 1000], ['newer-b', 2000]]);
        const sessions = new Map([['older-a', olderInA], ['newer-b', newerInB]]);

        // Folder B's session is the newest overall, but the incoming output belongs to folder
        // A — the fallback must skip B and return A's session, not silently misroute to B.
        const result = getMostRecentOwnerSessionId(ownerSessionIds, ownerSessionCreatedAt, sessions, folderA);

        assert.strictEqual(result, 'older-a');
    });

    it('should return null when no owner session matches the requested folder', () => {
        const folderA = folder('/repo/folder-a');
        const folderB = folder('/repo/folder-b');
        const sessions = new Map([['owner-1', fakeLogSession(folderB)]]);
        const ownerSessionIds = new Set(['owner-1']);
        const ownerSessionCreatedAt = new Map([['owner-1', 1000]]);

        const result = getMostRecentOwnerSessionId(ownerSessionIds, ownerSessionCreatedAt, sessions, folderA);

        assert.strictEqual(result, null);
    });
});

/**
 * Tests for `autoLoadInitialLog` — the first-visit load decision (plan 111).
 *
 * The contract: reopen the log the user last deliberately opened, else the newest non-trashed one.
 * "Deliberately" matters because only explicit opens write `logLastViewed`; if an auto-load ever
 * wrote it, restore would echo its own previous choice forever.
 *
 * The existence check is a real `vscode.workspace.fs.stat`, so these tests write real files into a
 * temp directory rather than stubbing the filesystem — a stub would not catch the case this feature
 * exists to handle (a remembered file that no longer exists on disk).
 */
import * as assert from 'assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { autoLoadInitialLog } from '../../extension-activation-helpers';
import { LOG_LAST_VIEWED_KEY } from '../../ui/provider/viewer-provider-actions';
import type { SessionGroup, SessionMetadata, SplitGroup, TreeItem } from '../../ui/session/session-history-grouping';

/** Map-backed workspaceState carrying only the last-viewed map. */
function fakeContext(lastViewed: Record<string, number>): vscode.ExtensionContext {
    const store = new Map<string, unknown>([[LOG_LAST_VIEWED_KEY, lastViewed]]);
    return {
        workspaceState: {
            get: <T>(key: string, fallback?: T): T | undefined => (store.get(key) as T | undefined) ?? fallback,
            update: (key: string, value: unknown): Thenable<void> => { store.set(key, value); return Promise.resolve(); },
        },
    } as unknown as vscode.ExtensionContext;
}

/** Records what the viewer was asked to load. `currentFileUri` models a log that some other path
 *  (a live session, the webview's pending load) opened while autoLoadInitialLog was awaiting stat(). */
function fakeTarget(currentFileUri?: vscode.Uri): { target: Parameters<typeof autoLoadInitialLog>[2]; loaded: string[] } {
    const loaded: string[] = [];
    const target = {
        getCurrentFileUri: (): vscode.Uri | undefined => currentFileUri,
        loadFromFile: (uri: vscode.Uri): Promise<void> => { loaded.push(uri.toString()); return Promise.resolve(); },
        postMessage: (): void => {},
    };
    return { target, loaded };
}

suite('autoLoadInitialLog', () => {
    let tmpDir: vscode.Uri;

    /** One temp dir per suite run; each test writes only the files it needs to exist. */
    suiteSetup(async () => {
        tmpDir = vscode.Uri.file(path.join(os.tmpdir(), `slc-autoload-${process.pid}`));
        await vscode.workspace.fs.createDirectory(tmpDir);
    });

    suiteTeardown(async () => {
        try { await vscode.workspace.fs.delete(tmpDir, { recursive: true }); } catch { /* best effort */ }
    });

    /** Write a real file so stat() succeeds, and return its URI. */
    async function realFile(name: string): Promise<vscode.Uri> {
        const uri = vscode.Uri.joinPath(tmpDir, name);
        await vscode.workspace.fs.writeFile(uri, Buffer.from('log line\n', 'utf-8'));
        return uri;
    }

    /** A URI under tmpDir that is deliberately never written — stat() must fail on it. */
    function missingFile(name: string): vscode.Uri {
        return vscode.Uri.joinPath(tmpDir, name);
    }

    function item(uri: vscode.Uri, mtime: number, trashed = false): TreeItem {
        return { uri, filename: path.basename(uri.fsPath), size: 1, mtime, trashed } as SessionMetadata;
    }

    test('restores the last-viewed log rather than the newest one', async () => {
        const older = await realFile('older.log');
        const newest = await realFile('newest.log');
        const ctx = fakeContext({ [older.toString()]: 5_000 });
        const { target, loaded } = fakeTarget();
        // Newest first — the old autoLoadLatest took items[0] unconditionally.
        await autoLoadInitialLog(ctx, [item(newest, 200), item(older, 100)], target);
        assert.deepStrictEqual(loaded, [older.toString()]);
    });

    test('restores a last-viewed file that is absent from the session tree (opened via the picker)', async () => {
        const outside = await realFile('picked-from-elsewhere.log');
        const inTree = await realFile('in-tree.log');
        const ctx = fakeContext({ [outside.toString()]: 5_000 });
        const { target, loaded } = fakeTarget();
        await autoLoadInitialLog(ctx, [item(inTree, 200)], target);
        assert.deepStrictEqual(loaded, [outside.toString()], 'a picker-loaded file outside reports/ must still restore');
    });

    test('falls back to the newest log when the last-viewed file no longer exists', async () => {
        const gone = missingFile('deleted.log');
        const newest = await realFile('survivor.log');
        const ctx = fakeContext({ [gone.toString()]: 5_000 });
        const { target, loaded } = fakeTarget();
        await autoLoadInitialLog(ctx, [item(newest, 200)], target);
        assert.deepStrictEqual(loaded, [newest.toString()]);
    });

    test('falls back to the newest log when the last-viewed log was trashed', async () => {
        const trashed = await realFile('trashed.log');
        const newest = await realFile('kept.log');
        const ctx = fakeContext({ [trashed.toString()]: 5_000 });
        const { target, loaded } = fakeTarget();
        await autoLoadInitialLog(ctx, [item(newest, 200), item(trashed, 100, true)], target);
        assert.deepStrictEqual(loaded, [newest.toString()], 'a trashed log must not come back on restart');
    });

    test('picks the most recent entry when several logs have been viewed', async () => {
        const first = await realFile('first-viewed.log');
        const second = await realFile('second-viewed.log');
        const ctx = fakeContext({ [first.toString()]: 1_000, [second.toString()]: 9_000 });
        const { target, loaded } = fakeTarget();
        await autoLoadInitialLog(ctx, [item(first, 100), item(second, 200)], target);
        assert.deepStrictEqual(loaded, [second.toString()]);
    });

    test('loads the newest non-trashed log when there is no view history', async () => {
        const newest = await realFile('fresh.log');
        const trashed = await realFile('old-trashed.log');
        const { target, loaded } = fakeTarget();
        await autoLoadInitialLog(fakeContext({}), [item(trashed, 300, true), item(newest, 200)], target);
        assert.deepStrictEqual(loaded, [newest.toString()], 'trashed items are skipped by the fallback');
    });

    test('loads nothing when there are no items and no history', async () => {
        const { target, loaded } = fakeTarget();
        await autoLoadInitialLog(fakeContext({}), [], target);
        assert.deepStrictEqual(loaded, []);
    });

    /* Trash is a sidecar flag, not a file move: `trashSession` calls metaStore.setTrashed and the log
       stays on disk, so stat() still succeeds. Only the leaf's `trashed` flag stops the restore — and
       the leaf lives one level down, inside SplitGroup.parts or SessionGroup.members. A lookup that
       inspects only top-level items finds nothing, reads no flag, and reopens the trashed log. */
    test('falls back to the newest log when the last-viewed leaf is a TRASHED SPLIT PART', async () => {
        const part = await realFile('split-part-2.log');
        const newest = await realFile('newest-after-split.log');
        const split = {
            type: 'split-group', baseFilename: 'split', mtime: 100,
            parts: [item(part, 100, true) as SessionMetadata],
        } as unknown as SplitGroup;
        const ctx = fakeContext({ [part.toString()]: 5_000 });
        const { target, loaded } = fakeTarget();
        await autoLoadInitialLog(ctx, [item(newest, 200), split as TreeItem], target);
        assert.deepStrictEqual(loaded, [newest.toString()], 'a trashed split part must not be restored');
    });

    test('falls back to the newest log when the last-viewed leaf is a TRASHED SESSION-GROUP MEMBER', async () => {
        const member = await realFile('group-member-2.log');
        const primary = await realFile('group-primary.log');
        const newest = await realFile('newest-after-group.log');
        const primaryLeaf = item(primary, 100) as SessionMetadata;
        const group = {
            type: 'session-group', groupId: 'g1', mtime: 100, latestMtime: 120,
            members: [primaryLeaf, item(member, 120, true) as SessionMetadata],
            primary: primaryLeaf, uri: primary, filename: 'group-primary.log', size: 2,
        } as unknown as SessionGroup;
        const ctx = fakeContext({ [member.toString()]: 5_000 });
        const { target, loaded } = fakeTarget();
        await autoLoadInitialLog(ctx, [item(newest, 200), group as TreeItem], target);
        assert.deepStrictEqual(loaded, [newest.toString()], 'a trashed group member must not be restored');
    });

    test('restores a NON-trashed session-group member (the nested lookup must not over-reject)', async () => {
        const member = await realFile('live-group-member.log');
        const primary = await realFile('live-group-primary.log');
        const newest = await realFile('newest-beside-group.log');
        const primaryLeaf = item(primary, 100) as SessionMetadata;
        const group = {
            type: 'session-group', groupId: 'g2', mtime: 100, latestMtime: 120,
            members: [primaryLeaf, item(member, 120) as SessionMetadata],
            primary: primaryLeaf, uri: primary, filename: 'live-group-primary.log', size: 2,
        } as unknown as SessionGroup;
        const ctx = fakeContext({ [member.toString()]: 5_000 });
        const { target, loaded } = fakeTarget();
        await autoLoadInitialLog(ctx, [item(newest, 200), group as TreeItem], target);
        assert.deepStrictEqual(loaded, [member.toString()]);
    });

    /* The caller's "nothing open yet" guard runs BEFORE the stat() await. A live session or the
       webview's pending load can open a log during that await; this first-visit convenience must
       not overwrite it. */
    test('loads nothing when another path opened a log during the stat() await', async () => {
        const remembered = await realFile('remembered.log');
        const openedMeanwhile = await realFile('opened-by-live-session.log');
        const ctx = fakeContext({ [remembered.toString()]: 5_000 });
        const { target, loaded } = fakeTarget(openedMeanwhile);
        await autoLoadInitialLog(ctx, [item(remembered, 100)], target);
        assert.deepStrictEqual(loaded, [], 'a log opened by a more deliberate path must not be overwritten');
    });
});

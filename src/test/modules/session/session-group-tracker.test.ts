import * as assert from 'assert';
import * as vscode from 'vscode';
import { SessionGroupTracker, type SessionGroupTrackerDeps, type TrackerSettings } from '../../../modules/session/session-group-tracker';
import type { SessionMetadataStore, SessionMeta } from '../../../modules/session/session-metadata';

/**
 * Minimal fake of SessionMetadataStore sufficient for the tracker's use of
 * `stampGroupIdBatch`. Records calls so we can assert against them.
 */
class FakeMetaStore {
    stampCalls: Array<{ uris: readonly vscode.Uri[]; groupId: string | undefined }> = [];
    /** Pretend every claim succeeds \u2014 the tracker reports back what this returns. */
    stampResponse: (uris: readonly vscode.Uri[]) => vscode.Uri[] = uris => [...uris];

    async stampGroupIdBatch(uris: readonly vscode.Uri[], groupId: string | undefined): Promise<vscode.Uri[]> {
        this.stampCalls.push({ uris, groupId });
        return this.stampResponse(uris);
    }
    // Unused in tracker but required by the `Pick` we pass \u2014 kept as no-ops.
    async loadMetadata(): Promise<SessionMeta> { return {}; }
    async saveMetadata(): Promise<void> {}
    async deleteMetadata(): Promise<void> {}
    async loadAllMetadata(): Promise<ReadonlyMap<string, SessionMeta>> { return new Map(); }
}

/** Build a tracker with controlled in-memory fs views for test isolation. */
function makeTracker(opts: {
    settings: TrackerSettings;
    files: Array<{ name: string; mtime: number; type?: vscode.FileType }>;
}): { tracker: SessionGroupTracker; store: FakeMetaStore; logs: string[] } {
    const store = new FakeMetaStore();
    const logs: string[] = [];
    const files = opts.files.map(f => ({
        name: f.name,
        mtime: f.mtime,
        type: f.type ?? vscode.FileType.File,
    }));
    const deps: SessionGroupTrackerDeps = {
        metaStore: store as unknown as SessionMetadataStore,
        getSettings: () => opts.settings,
        log: (msg: string) => logs.push(msg),
        readDirectory: async () => files.map(f => [f.name, f.type] as [string, vscode.FileType]),
        stat: async (uri: vscode.Uri) => {
            const name = uri.fsPath.split(/[\\/]/).pop()!;
            const hit = files.find(f => f.name === name);
            if (!hit) { throw new Error(`stat: ${name} not found`); }
            return {
                type: hit.type,
                ctime: hit.mtime,
                mtime: hit.mtime,
                size: 0,
            } satisfies vscode.FileStat;
        },
    };
    return { tracker: new SessionGroupTracker(deps), store, logs };
}

const LOG_DIR = vscode.Uri.file('/tmp/logs');
const MAIN_LOG = vscode.Uri.joinPath(LOG_DIR, 'session.log');

suite('session-group-tracker', () => {

    suite('onDapSessionStart', () => {
        test('does nothing when feature is disabled', async () => {
            const { tracker, store } = makeTracker({
                settings: { enabled: false, lookbackSeconds: 20 },
                files: [{ name: 'session.log', mtime: 1000 }],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1000);
            assert.strictEqual(store.stampCalls.length, 0);
            assert.strictEqual(tracker.getActiveGroupId(), undefined);
        });

        test('mints a groupId and sets active state on enable', async () => {
            const { tracker } = makeTracker({
                settings: { enabled: true, lookbackSeconds: 20 },
                files: [{ name: 'session.log', mtime: 5000 }],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 5000);
            const id = tracker.getActiveGroupId();
            assert.ok(typeof id === 'string' && id.length > 0);
        });

        test('stamps files whose mtime is inside the lookback window', async () => {
            // startMs = 10_000, lookback = 20s \u2192 window is mtime \u2265 -10_000. Claim everything \u2265 that.
            const { tracker, store } = makeTracker({
                settings: { enabled: true, lookbackSeconds: 20 },
                files: [
                    { name: 'inside.log', mtime: 5000 },
                    { name: 'main.log', mtime: 10000 },
                ],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 10000);
            assert.strictEqual(store.stampCalls.length, 1);
            const names = store.stampCalls[0].uris.map(u => u.fsPath.split(/[\\/]/).pop());
            assert.deepStrictEqual(names.sort(), ['inside.log', 'main.log']);
        });

        test('excludes files whose mtime is older than the lookback window', async () => {
            // startMs = 60_000, lookback = 20s \u2192 window starts at 40_000. "too-old.log" (mtime 30_000) is out.
            const { tracker, store } = makeTracker({
                settings: { enabled: true, lookbackSeconds: 20 },
                files: [
                    { name: 'too-old.log', mtime: 30000 },
                    { name: 'edge.log', mtime: 40000 },
                    { name: 'inside.log', mtime: 55000 },
                ],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 60000);
            const names = store.stampCalls[0].uris.map(u => u.fsPath.split(/[\\/]/).pop()).sort();
            assert.deepStrictEqual(names, ['edge.log', 'inside.log']);
        });

        test('skips hidden files (e.g. .session-metadata.json)', async () => {
            const { tracker, store } = makeTracker({
                settings: { enabled: true, lookbackSeconds: 20 },
                files: [
                    { name: '.session-metadata.json', mtime: 5000 },
                    { name: 'visible.log', mtime: 5000 },
                ],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 5000);
            const names = store.stampCalls[0].uris.map(u => u.fsPath.split(/[\\/]/).pop());
            assert.deepStrictEqual(names, ['visible.log']);
        });

        test('skips directory entries', async () => {
            const { tracker, store } = makeTracker({
                settings: { enabled: true, lookbackSeconds: 20 },
                files: [
                    { name: 'subdir', mtime: 5000, type: vscode.FileType.Directory },
                    { name: 'file.log', mtime: 5000 },
                ],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 5000);
            const names = store.stampCalls[0].uris.map(u => u.fsPath.split(/[\\/]/).pop());
            assert.deepStrictEqual(names, ['file.log']);
        });

        test('skips the stamp call entirely when no candidates qualify', async () => {
            const { tracker, store } = makeTracker({
                settings: { enabled: true, lookbackSeconds: 20 },
                files: [{ name: 'ancient.log', mtime: 0 }],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1_000_000);
            assert.strictEqual(store.stampCalls.length, 0);
        });

        test('treats negative lookbackSeconds as zero', async () => {
            // Defensive: clamp in config means this normally won't happen, but the tracker should survive.
            const { tracker, store } = makeTracker({
                settings: { enabled: true, lookbackSeconds: -5 },
                files: [
                    { name: 'older.log', mtime: 999 },
                    { name: 'exact.log', mtime: 1000 },
                ],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1000);
            const names = store.stampCalls[0].uris.map(u => u.fsPath.split(/[\\/]/).pop());
            assert.deepStrictEqual(names, ['exact.log']);
        });
    });

    suite('onDapSessionEnd', () => {
        test('no-op when no group was anchored', async () => {
            const { tracker, store } = makeTracker({
                settings: { enabled: true, lookbackSeconds: 20 },
                files: [],
            });
            await tracker.onDapSessionEnd(MAIN_LOG);
            assert.strictEqual(store.stampCalls.length, 0);
        });

        test('runs a second sweep to claim sidecars created during the session', async () => {
            // Start: only the main log exists. End: a sidecar now exists too.
            const fileList = [{ name: 'main.log', mtime: 1000 }];
            const { tracker, store } = makeTracker({
                settings: { enabled: true, lookbackSeconds: 20 },
                files: fileList,
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1000);
            // Simulate adb-logcat's post-session sidecar write.
            fileList.push({ name: 'main.logcat.log', mtime: 1500 });
            await tracker.onDapSessionEnd(MAIN_LOG);
            // Two stamp calls: one at start (main.log) and one at end (main.log + main.logcat.log).
            assert.strictEqual(store.stampCalls.length, 2);
            const endCallNames = store.stampCalls[1].uris.map(u => u.fsPath.split(/[\\/]/).pop()).sort();
            assert.deepStrictEqual(endCallNames, ['main.log', 'main.logcat.log']);
            // Both calls must carry the same groupId.
            assert.strictEqual(store.stampCalls[0].groupId, store.stampCalls[1].groupId);
        });

        test('clears active state even when the sweep fails', async () => {
            const { tracker, store } = makeTracker({
                settings: { enabled: true, lookbackSeconds: 20 },
                files: [{ name: 'main.log', mtime: 1000 }],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1000);
            // Poison the next stamp call so the sweep throws.
            store.stampResponse = () => { throw new Error('disk full'); };
            await tracker.onDapSessionEnd(MAIN_LOG);
            // State must be cleared so the next session starts fresh.
            assert.strictEqual(tracker.getActiveGroupId(), undefined);
        });
    });
});

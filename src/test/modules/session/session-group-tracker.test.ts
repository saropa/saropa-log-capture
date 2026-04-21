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
    // Unused in tracker but required to satisfy the store shape when we cast.
    async loadMetadata(): Promise<SessionMeta> { return {}; }
    async saveMetadata(): Promise<void> {}
    async deleteMetadata(): Promise<void> {}
    async loadAllMetadata(): Promise<ReadonlyMap<string, SessionMeta>> { return new Map(); }
}

/** Captured delayed-sweep invocations so tests can run them on demand. */
interface DelayedSweep {
    readonly callback: () => void;
    readonly delayMs: number;
}

/** Build a tracker with controlled in-memory fs views for test isolation. */
function makeTracker(opts: {
    settings: TrackerSettings;
    files: Array<{ name: string; mtime: number; type?: vscode.FileType }>;
}): {
    tracker: SessionGroupTracker;
    store: FakeMetaStore;
    logs: string[];
    files: Array<{ name: string; mtime: number; type?: vscode.FileType }>;
    delayedSweeps: DelayedSweep[];
} {
    const store = new FakeMetaStore();
    const logs: string[] = [];
    // Share opts.files by reference — some tests push to it after construction to simulate
    // late-arriving sidecars. Copying via .map() would hide those mutations from the tracker.
    const files = opts.files;
    const delayedSweeps: DelayedSweep[] = [];
    const deps: SessionGroupTrackerDeps = {
        metaStore: store as unknown as SessionMetadataStore,
        getSettings: () => opts.settings,
        log: (msg: string) => logs.push(msg),
        readDirectory: async () => files.map(f => [f.name, f.type ?? vscode.FileType.File] as [string, vscode.FileType]),
        stat: async (uri: vscode.Uri) => {
            const name = uri.fsPath.split(/[\\/]/).pop()!;
            const hit = files.find(f => f.name === name);
            if (!hit) { throw new Error(`stat: ${name} not found`); }
            return {
                type: hit.type ?? vscode.FileType.File,
                ctime: hit.mtime,
                mtime: hit.mtime,
                size: 0,
            } satisfies vscode.FileStat;
        },
        scheduleAfterSweep: (callback: () => void, delayMs: number) => {
            // Capture the delayed sweep but do NOT invoke it \u2014 tests decide when to fire.
            delayedSweeps.push({ callback, delayMs });
        },
    };
    return { tracker: new SessionGroupTracker(deps), store, logs, files, delayedSweeps };
}

const LOG_DIR = vscode.Uri.file('/tmp/logs');
const MAIN_LOG = vscode.Uri.joinPath(LOG_DIR, 'session.log');

suite('session-group-tracker', () => {

    suite('onDapSessionStart', () => {
        test('does nothing when feature is disabled', async () => {
            const { tracker, store } = makeTracker({
                settings: { enabled: false, beforeSeconds: 10, afterSeconds: 10 },
                files: [{ name: 'session.log', mtime: 1000 }],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1000);
            assert.strictEqual(store.stampCalls.length, 0);
            assert.strictEqual(tracker.getActiveGroupId(), undefined);
        });

        test('mints a groupId and sets active state on enable', async () => {
            const { tracker } = makeTracker({
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 10 },
                files: [{ name: 'session.log', mtime: 5000 }],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 5000);
            const id = tracker.getActiveGroupId();
            assert.ok(typeof id === 'string' && id.length > 0);
        });

        test('stamps files whose mtime is inside the before-window', async () => {
            // startMs = 10_000, beforeSeconds = 20 \u2192 window starts at -10_000. Claim everything \u2265 that.
            const { tracker, store } = makeTracker({
                settings: { enabled: true, beforeSeconds: 20, afterSeconds: 10 },
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

        test('excludes files whose mtime is older than the before-window', async () => {
            // startMs = 60_000, beforeSeconds = 20 \u2192 window starts at 40_000. "too-old.log" (mtime 30_000) is out.
            const { tracker, store } = makeTracker({
                settings: { enabled: true, beforeSeconds: 20, afterSeconds: 10 },
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
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 10 },
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
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 10 },
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
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 10 },
                files: [{ name: 'ancient.log', mtime: 0 }],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1_000_000);
            assert.strictEqual(store.stampCalls.length, 0);
        });

        test('treats negative beforeSeconds as zero', async () => {
            // Defensive: clamp in config means this normally won't happen, but the tracker should survive.
            const { tracker, store } = makeTracker({
                settings: { enabled: true, beforeSeconds: -5, afterSeconds: 10 },
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
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 10 },
                files: [],
            });
            await tracker.onDapSessionEnd(MAIN_LOG);
            assert.strictEqual(store.stampCalls.length, 0);
        });

        test('immediate end-sweep claims sidecars already on disk', async () => {
            const fileList = [{ name: 'main.log', mtime: 1000 }];
            const { tracker, store } = makeTracker({
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 10 },
                files: fileList,
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1000);
            // Simulate a sidecar written synchronously in an integration provider's onSessionEnd hook,
            // before the tracker's own onDapSessionEnd runs.
            fileList.push({ name: 'main.logcat.log', mtime: 1500 });
            await tracker.onDapSessionEnd(MAIN_LOG);
            // Two stamp calls: before-sweep at start (main.log), immediate end-sweep (main.log + sidecar).
            assert.strictEqual(store.stampCalls.length, 2);
            const endCallNames = store.stampCalls[1].uris.map(u => u.fsPath.split(/[\\/]/).pop()).sort();
            assert.deepStrictEqual(endCallNames, ['main.log', 'main.logcat.log']);
            // Both calls carry the same groupId.
            assert.strictEqual(store.stampCalls[0].groupId, store.stampCalls[1].groupId);
        });

        test('schedules a delayed after-sweep with the configured afterSeconds', async () => {
            const { tracker, delayedSweeps } = makeTracker({
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 15 },
                files: [{ name: 'main.log', mtime: 1000 }],
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1000);
            await tracker.onDapSessionEnd(MAIN_LOG);
            assert.strictEqual(delayedSweeps.length, 1);
            assert.strictEqual(delayedSweeps[0].delayMs, 15_000);
        });

        test('delayed after-sweep claims late-arriving files inside the after-window', async () => {
            const fileList = [{ name: 'main.log', mtime: 1000 }];
            const { tracker, store, delayedSweeps } = makeTracker({
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 10 },
                files: fileList,
            });
            const startMs = 1000;
            await tracker.onDapSessionStart(MAIN_LOG, startMs);
            // Session ends; onDapSessionEnd stamps Date.now() as endMs internally.
            const endMs = Date.now();
            await tracker.onDapSessionEnd(MAIN_LOG);
            // A late sidecar appears a few seconds later, still inside the after-window.
            fileList.push({ name: 'main.late.log', mtime: endMs + 3000 });
            // Fire the delayed sweep.
            assert.strictEqual(delayedSweeps.length, 1);
            delayedSweeps[0].callback();
            // Allow the microtask queue to drain so the promise chain inside the delayed sweep resolves.
            await new Promise(res => setImmediate(res));
            // Now there should be three stamp calls: before, immediate end, delayed.
            assert.strictEqual(store.stampCalls.length, 3);
            const delayedNames = store.stampCalls[2].uris.map(u => u.fsPath.split(/[\\/]/).pop()).sort();
            // Every eligible file inside the window gets offered to the batch stamp \u2014 the "never re-claim
            // same groupId" guard inside the real store would skip main.log on re-stamp, but our fake
            // doesn't enforce that, so we just check the late file is present.
            assert.ok(delayedNames.includes('main.late.log'), 'late sidecar must be stamped');
        });

        test('delayed after-sweep refuses files written after the after-window closes', async () => {
            const fileList = [{ name: 'main.log', mtime: 1000 }];
            const { tracker, store, delayedSweeps } = makeTracker({
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 10 },
                files: fileList,
            });
            await tracker.onDapSessionStart(MAIN_LOG, 1000);
            const endMs = Date.now();
            await tracker.onDapSessionEnd(MAIN_LOG);
            // A file written way past the after-window (endMs + 60s) \u2014 should NOT be stamped.
            fileList.push({ name: 'much-later.log', mtime: endMs + 60_000 });
            delayedSweeps[0].callback();
            await new Promise(res => setImmediate(res));
            const delayedCall = store.stampCalls[2];
            const delayedNames = (delayedCall?.uris ?? []).map(u => u.fsPath.split(/[\\/]/).pop());
            assert.ok(!delayedNames.includes('much-later.log'), 'file past upper bound must NOT be stamped');
        });

        test('delayed sweep respects the disabled flag if setting flipped between schedule and fire', async () => {
            let enabled = true;
            const store = new FakeMetaStore();
            const logs: string[] = [];
            const files: Array<{ name: string; mtime: number; type: vscode.FileType }> = [
                { name: 'main.log', mtime: 1000, type: vscode.FileType.File },
            ];
            const delayedSweeps: DelayedSweep[] = [];
            const deps: SessionGroupTrackerDeps = {
                metaStore: store as unknown as SessionMetadataStore,
                getSettings: () => ({ enabled, beforeSeconds: 10, afterSeconds: 10 }),
                log: (msg) => logs.push(msg),
                readDirectory: async () => files.map(f => [f.name, f.type]),
                stat: async (uri) => {
                    const name = uri.fsPath.split(/[\\/]/).pop()!;
                    const hit = files.find(f => f.name === name)!;
                    return { type: hit.type, ctime: hit.mtime, mtime: hit.mtime, size: 0 };
                },
                scheduleAfterSweep: (cb, ms) => { delayedSweeps.push({ callback: cb, delayMs: ms }); },
            };
            const tracker = new SessionGroupTracker(deps);
            await tracker.onDapSessionStart(MAIN_LOG, 1000);
            await tracker.onDapSessionEnd(MAIN_LOG);
            const beforeCount = store.stampCalls.length;
            // Disable before the delayed sweep fires.
            enabled = false;
            delayedSweeps[0].callback();
            await new Promise(res => setImmediate(res));
            // No new stamp calls after disabling.
            assert.strictEqual(store.stampCalls.length, beforeCount);
        });

        test('clears active state even when the immediate sweep fails', async () => {
            const { tracker, store } = makeTracker({
                settings: { enabled: true, beforeSeconds: 10, afterSeconds: 10 },
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

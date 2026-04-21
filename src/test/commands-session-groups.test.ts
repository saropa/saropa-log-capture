import * as assert from 'assert';
import * as vscode from 'vscode';
import { runGroupSelectedSessions, runUngroupSession } from '../commands-session-groups';
import type { SessionMeta } from '../modules/session/session-metadata';

/**
 * In-memory fake that behaves like the `.session-metadata.json` store for the two
 * methods the group/ungroup commands rely on.
 */
class InMemoryStore {
    readonly data = new Map<string, SessionMeta>();

    async loadAllMetadata(_logDir: vscode.Uri): Promise<ReadonlyMap<string, SessionMeta>> {
        return new Map(this.data);
    }

    async stampGroupIdBatch(logUris: readonly vscode.Uri[], groupId: string | undefined): Promise<vscode.Uri[]> {
        const stamped: vscode.Uri[] = [];
        for (const uri of logUris) {
            const key = relKey(uri);
            const existing: SessionMeta = this.data.get(key) ? { ...this.data.get(key)! } : {};
            if (groupId === undefined) {
                if (existing.groupId === undefined) { continue; }
                delete existing.groupId;
            } else {
                // The never-re-claim rule from the real store.
                if (existing.groupId !== undefined && existing.groupId !== groupId) { continue; }
                if (existing.groupId === groupId) { continue; }
                existing.groupId = groupId;
            }
            this.data.set(key, existing);
            stamped.push(uri);
        }
        return stamped;
    }
}

/** Build a relative-key string matching how the production code derives it. */
function relKey(uri: vscode.Uri): string {
    return vscode.workspace.asRelativePath(uri).replace(/\\/g, '/');
}

/** Minimal SessionHistoryProvider stand-in \u2014 only needs getMetaStore + refresh. */
function makeHistoryProvider(store: InMemoryStore): { refreshCount: number } & {
    getMetaStore(): InMemoryStore;
    refresh(): void;
} {
    const state = { refreshCount: 0 };
    return {
        ...state,
        getMetaStore: () => store,
        refresh: () => { state.refreshCount++; },
        get refreshCount(): number { return state.refreshCount; },
    };
}

const LOG_DIR = vscode.Uri.file('/tmp/logs');
const A = vscode.Uri.joinPath(LOG_DIR, 'a.log');
const B = vscode.Uri.joinPath(LOG_DIR, 'b.log');
const C = vscode.Uri.joinPath(LOG_DIR, 'c.log');

suite('commands-session-groups', () => {

    suite('runGroupSelectedSessions', () => {
        test('mints a fresh groupId and stamps every target', async () => {
            const store = new InMemoryStore();
            store.data.set(relKey(A), {});
            store.data.set(relKey(B), {});
            const hp = makeHistoryProvider(store);

            await runGroupSelectedSessions(hp as never, [A, B]);

            const a = store.data.get(relKey(A))!;
            const b = store.data.get(relKey(B))!;
            assert.ok(a.groupId, 'a.log must carry a groupId');
            assert.strictEqual(a.groupId, b.groupId, 'both files share the same groupId');
        });

        test('overrides existing groupIds (user intent beats first-claim-wins)', async () => {
            const store = new InMemoryStore();
            store.data.set(relKey(A), { groupId: 'old-group-alpha' });
            store.data.set(relKey(B), { groupId: 'old-group-beta' });
            const hp = makeHistoryProvider(store);

            await runGroupSelectedSessions(hp as never, [A, B]);

            const a = store.data.get(relKey(A))!;
            const b = store.data.get(relKey(B))!;
            assert.ok(a.groupId);
            assert.ok(a.groupId !== 'old-group-alpha', 'old id cleared');
            assert.ok(a.groupId !== 'old-group-beta', 'old id cleared');
            assert.strictEqual(a.groupId, b.groupId, 'both files share the new id');
        });

        test('refreshes the history provider', async () => {
            const store = new InMemoryStore();
            store.data.set(relKey(A), {});
            store.data.set(relKey(B), {});
            const hp = makeHistoryProvider(store);

            await runGroupSelectedSessions(hp as never, [A, B]);
            assert.strictEqual(hp.refreshCount, 1);
        });

        test('no-op with no targets', async () => {
            const store = new InMemoryStore();
            const hp = makeHistoryProvider(store);
            await runGroupSelectedSessions(hp as never, []);
            assert.strictEqual(hp.refreshCount, 0);
            assert.strictEqual(store.data.size, 0);
        });
    });

    suite('runUngroupSession', () => {
        test('clears groupId from every member of the target file\u2019s group', async () => {
            const store = new InMemoryStore();
            store.data.set(relKey(A), { groupId: 'g1' });
            store.data.set(relKey(B), { groupId: 'g1' });
            store.data.set(relKey(C), { groupId: 'g1' });
            const hp = makeHistoryProvider(store);

            // Invoke on A alone; B and C should also be ungrouped because they share g1.
            await runUngroupSession(hp as never, [A]);

            assert.strictEqual(store.data.get(relKey(A))!.groupId, undefined);
            assert.strictEqual(store.data.get(relKey(B))!.groupId, undefined);
            assert.strictEqual(store.data.get(relKey(C))!.groupId, undefined);
        });

        test('leaves other groups alone', async () => {
            const store = new InMemoryStore();
            store.data.set(relKey(A), { groupId: 'g1' });
            store.data.set(relKey(B), { groupId: 'g2' });
            store.data.set(relKey(C), { groupId: 'g2' });
            const hp = makeHistoryProvider(store);

            await runUngroupSession(hp as never, [A]);

            assert.strictEqual(store.data.get(relKey(A))!.groupId, undefined);
            assert.strictEqual(store.data.get(relKey(B))!.groupId, 'g2', 'g2 must be preserved');
            assert.strictEqual(store.data.get(relKey(C))!.groupId, 'g2');
        });

        test('handles targets from multiple groups \u2014 dismantles all of them', async () => {
            const store = new InMemoryStore();
            store.data.set(relKey(A), { groupId: 'g1' });
            store.data.set(relKey(B), { groupId: 'g1' });
            store.data.set(relKey(C), { groupId: 'g2' });
            const D = vscode.Uri.joinPath(LOG_DIR, 'd.log');
            store.data.set(relKey(D), { groupId: 'g2' });
            const hp = makeHistoryProvider(store);

            await runUngroupSession(hp as never, [A, C]);

            assert.strictEqual(store.data.get(relKey(A))!.groupId, undefined);
            assert.strictEqual(store.data.get(relKey(B))!.groupId, undefined);
            assert.strictEqual(store.data.get(relKey(C))!.groupId, undefined);
            assert.strictEqual(store.data.get(relKey(D))!.groupId, undefined);
        });

        test('no-op when target is not part of any group', async () => {
            const store = new InMemoryStore();
            store.data.set(relKey(A), {});
            const hp = makeHistoryProvider(store);

            await runUngroupSession(hp as never, [A]);

            assert.strictEqual(hp.refreshCount, 0);
        });
    });
});

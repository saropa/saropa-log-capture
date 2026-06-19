/**
 * Tests for `getOrSeedDismissedAt` — the single seed-on-first-read source for the
 * Logs-panel "newer-log dismiss" cursor. The cursor now feeds two consumers: the
 * panel refresh AND the proactive tree-change refresh that supplies the always-visible
 * log-viewer banner. Pinning the seed + idempotency here guards against a regression
 * where a re-read re-seeds to a later "now" (which would silently un-flag unread logs).
 * See [bugs] BUG_new_log_banner and
 * [plans/history/2026.06/2026.06.02/001_plan-newer-alert-and-reports-grouping.md].
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { getOrSeedDismissedAt, LOGS_PANEL_DISMISSED_AT_KEY } from '../../ui/provider/viewer-provider-actions';

/** Minimal Map-backed workspaceState stub — only get/update are exercised. */
function fakeContext(initial?: number): { ctx: vscode.ExtensionContext; updates: number[] } {
    const store = new Map<string, unknown>();
    if (typeof initial === 'number') { store.set(LOGS_PANEL_DISMISSED_AT_KEY, initial); }
    const updates: number[] = [];
    const ctx = {
        workspaceState: {
            get: <T>(key: string): T | undefined => store.get(key) as T | undefined,
            update: (key: string, value: unknown): Thenable<void> => {
                store.set(key, value);
                if (typeof value === 'number') { updates.push(value); }
                return Promise.resolve();
            },
        },
    } as unknown as vscode.ExtensionContext;
    return { ctx, updates };
}

suite('getOrSeedDismissedAt', () => {

    test('seeds a numeric cursor on first read and persists it', () => {
        const { ctx, updates } = fakeContext();
        const seeded = getOrSeedDismissedAt(ctx);
        assert.strictEqual(typeof seeded, 'number');
        assert.strictEqual(updates.length, 1, 'first read must persist exactly one seed');
        assert.strictEqual(updates[0], seeded, 'persisted value must equal the returned cursor');
    });

    test('is idempotent — a second read returns the same cursor and writes nothing', () => {
        const { ctx, updates } = fakeContext();
        const first = getOrSeedDismissedAt(ctx);
        const second = getOrSeedDismissedAt(ctx);
        assert.strictEqual(second, first, 're-read must not advance the cursor');
        assert.strictEqual(updates.length, 1, 'idempotent read must not write again');
    });

    test('returns the existing persisted cursor unchanged', () => {
        const existing = 1_700_000_000_000;
        const { ctx, updates } = fakeContext(existing);
        const result = getOrSeedDismissedAt(ctx);
        assert.strictEqual(result, existing);
        assert.strictEqual(updates.length, 0, 'an existing cursor must never be re-seeded');
    });
});

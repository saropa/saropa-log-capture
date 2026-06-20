import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { computeLogContextInfo } from '../../ui/provider/viewer-log-context';
import type { SessionMetadata, TreeItem } from '../../ui/session/session-history-grouping';

/**
 * Unit tests for the staleness/lifespan computation behind the unified log banner (plan 109).
 * "Controller" (main project) logs drive staleness; peripherals never do. A leaf classifies as a
 * controller when its displayName is in controllerNames OR matches the workspace folder name.
 */
suite('computeLogContextInfo', () => {
    const FOLDER = 'MyApp';

    function leaf(name: string, mtime: number, opts?: { durationMs?: number; controller?: boolean }): SessionMetadata {
        return {
            uri: vscode.Uri.parse('file:///logs/' + name + '.log'),
            filename: name + '.log',
            displayName: opts?.controller ? FOLDER : name,
            size: 1,
            mtime,
            durationMs: opts?.durationMs,
        } as SessionMetadata;
    }

    function compute(items: TreeItem[], currentUri: string | undefined, dismissedAt = 0) {
        return computeLogContextInfo({ items, currentUri, controllerNames: [], workspaceFolderName: FOLDER, dismissedAt });
    }

    test('should report not-stale when no controller logs exist', () => {
        const items = [leaf('peripheralA', 100), leaf('peripheralB', 200)];
        const info = compute(items, items[0].uri.toString());
        assert.strictEqual(info.stale, false);
        assert.strictEqual(info.autoShow, false);
        assert.strictEqual(info.newerCount, 0);
        assert.strictEqual(info.latestUri, '');
    });

    test('should report not-stale when the open log IS the latest controller log', () => {
        const newest = leaf('run2', 200, { controller: true });
        const items: TreeItem[] = [leaf('run1', 100, { controller: true }), newest];
        const info = compute(items, newest.uri.toString());
        assert.strictEqual(info.newerCount, 0);
        assert.strictEqual(info.stale, false);
        assert.strictEqual(info.latestUri, newest.uri.toString());
    });

    test('should be stale with autoShow when a newer controller log post-dates the open one', () => {
        const open = leaf('run1', 100, { controller: true });
        const newer = leaf('run2', 200, { controller: true });
        const info = compute([open, newer], open.uri.toString(), 0);
        assert.strictEqual(info.stale, true);
        assert.strictEqual(info.newerCount, 1);
        assert.strictEqual(info.autoShow, true);
        assert.strictEqual(info.latestUri, newer.uri.toString());
    });

    test('should keep stale true but suppress autoShow once the dismiss cursor passes the newer log', () => {
        const open = leaf('run1', 100, { controller: true });
        const newer = leaf('run2', 200, { controller: true });
        const info = compute([open, newer], open.uri.toString(), 250);
        assert.strictEqual(info.stale, true);
        assert.strictEqual(info.autoShow, false, 'dismissed: newer log is older than the cursor');
    });

    test('should not count a newer PERIPHERAL log as staleness', () => {
        const open = leaf('run1', 100, { controller: true });
        const newerPeripheral = leaf('drift', 300, { controller: false });
        const info = compute([open, newerPeripheral], open.uri.toString());
        assert.strictEqual(info.newerCount, 0);
        assert.strictEqual(info.stale, false);
    });

    test('should derive lifespan startedMs from mtime - durationMs, 0 when duration unknown', () => {
        const withDur = leaf('run', 10_000, { controller: true, durationMs: 3_000 });
        const a = compute([withDur], withDur.uri.toString());
        assert.strictEqual(a.startedMs, 7_000);
        assert.strictEqual(a.durationMs, 3_000);

        const noDur = leaf('run', 10_000, { controller: true });
        const b = compute([noDur], noDur.uri.toString());
        assert.strictEqual(b.startedMs, 0);
        assert.strictEqual(b.durationMs, 0);
    });
});

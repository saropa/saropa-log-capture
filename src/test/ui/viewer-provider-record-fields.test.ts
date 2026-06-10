/**
 * Tests for the newer-log + Reports-bucket fields on session-payload records
 * (`unreadSinceFocus`, `kind`) produced by `buildSessionItemRecord`. See
 * [plans/history/2026.06/2026.06.02/001_plan-newer-alert-and-reports-grouping.md].
 *
 * Pins the dismiss-cursor gating and the classifier wiring at the record-builder
 * boundary so a future change to either path can't silently regress the panel.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
    buildSessionItemRecord,
    buildClassifierInputs,
} from '../../ui/provider/viewer-provider-actions';

/** Minimal Meta-shaped fixture with a real-looking URI. mtime is supplied so
 *  resolveMtime() skips the vscode.workspace.fs.stat path. */
function fakeMeta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        filename: 'demo.log',
        displayName: 'demo.log',
        size: 1234,
        mtime: 1_700_000_000_000,
        uri: vscode.Uri.parse('file:///tmp/demo.log'),
        ...overrides,
    };
}

suite('viewer-provider-actions: newer-log + kind fields', () => {

    suite('unreadSinceFocus', () => {

        test('is true when mtime is greater than the dismiss cursor', async () => {
            const meta = fakeMeta({ mtime: 1_700_000_001_000 });
            const rec = await buildSessionItemRecord(meta as never, undefined, {
                getDismissedAt: () => 1_700_000_000_000,
            });
            assert.strictEqual(rec.unreadSinceFocus, true);
        });

        test('is false when mtime equals the dismiss cursor', async () => {
            const meta = fakeMeta({ mtime: 1_700_000_000_000 });
            const rec = await buildSessionItemRecord(meta as never, undefined, {
                getDismissedAt: () => 1_700_000_000_000,
            });
            assert.strictEqual(rec.unreadSinceFocus, false);
        });

        test('is false when mtime is older than the dismiss cursor', async () => {
            const meta = fakeMeta({ mtime: 1_699_999_000_000 });
            const rec = await buildSessionItemRecord(meta as never, undefined, {
                getDismissedAt: () => 1_700_000_000_000,
            });
            assert.strictEqual(rec.unreadSinceFocus, false);
        });

        test('is false when getDismissedAt is omitted (banner disabled)', async () => {
            const rec = await buildSessionItemRecord(fakeMeta() as never, undefined, {});
            assert.strictEqual(rec.unreadSinceFocus, false);
        });

        test('is false when getDismissedAt returns undefined', async () => {
            const rec = await buildSessionItemRecord(fakeMeta() as never, undefined, {
                getDismissedAt: () => undefined,
            });
            assert.strictEqual(rec.unreadSinceFocus, false);
        });
    });

    suite('pin fields', () => {

        test('default record is not pinned and has pinnedAt 0', async () => {
            const rec = await buildSessionItemRecord(fakeMeta() as never, undefined, {});
            assert.strictEqual(rec.pinned, false);
            assert.strictEqual(rec.pinnedAt, 0);
        });

        test('propagates pinned + pinnedAt from the meta (the persisted pin state)', async () => {
            const meta = fakeMeta({ pinned: true, pinnedAt: 1_700_000_500_000 });
            const rec = await buildSessionItemRecord(meta as never, undefined, {});
            assert.strictEqual(rec.pinned, true);
            assert.strictEqual(rec.pinnedAt, 1_700_000_500_000);
        });
    });

    suite('kind classification', () => {

        test('defaults to project when classifyMeta is omitted (fail-open)', async () => {
            const rec = await buildSessionItemRecord(fakeMeta() as never, undefined, {});
            assert.strictEqual(rec.kind, 'project');
        });

        test('honors classifier verdict — report match on displayName', async () => {
            const classifyMeta = buildClassifierInputs(
                ['^Saropa Lint Report\\b'],
                undefined,
            );
            const meta = fakeMeta({ displayName: 'Saropa Lint Report — 2026-06-02' });
            const rec = await buildSessionItemRecord(meta as never, undefined, { classifyMeta });
            assert.strictEqual(rec.kind, 'report');
        });

        test('honors classifier verdict — debugAdapterType makes it a project', async () => {
            // Even with a report-matching displayName, a DAP session wins (debug-session rule
            // fires before the displayName check). Pins the rule order at the integration boundary.
            const classifyMeta = buildClassifierInputs(
                ['^Saropa Lint Report\\b'],
                undefined,
            );
            const meta = fakeMeta({
                displayName: 'Saropa Lint Report',
                debugAdapterType: 'dart',
            });
            const rec = await buildSessionItemRecord(meta as never, undefined, { classifyMeta });
            assert.strictEqual(rec.kind, 'project');
        });

        test('honors classifier verdict — explicit kind override wins over everything', async () => {
            const classifyMeta = buildClassifierInputs(
                ['^Saropa Lint Report\\b'],
                undefined,
            );
            const meta = fakeMeta({
                displayName: 'Saropa Lint Report',
                kind: 'project',
            });
            const rec = await buildSessionItemRecord(meta as never, undefined, { classifyMeta });
            assert.strictEqual(rec.kind, 'project');
        });
    });
});

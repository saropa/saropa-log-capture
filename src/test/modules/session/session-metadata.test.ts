import * as assert from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    SessionMetadataStore, SessionMeta, Annotation, hasMeaningfulPerformanceData, isOurSidecar,
    cleanupDeletedSessionMetadata,
} from '../../../modules/session/session-metadata';
import { screenshotDirUri, screenshotSidecarUri } from '../../../modules/screenshot/screenshot-store';

suite('SessionMetadataStore', () => {

    test('getMetaUri returns undefined when no workspace folder is available', () => {
        const store = new SessionMetadataStore();
        const fakeUri = { toString: () => 'file:///workspace/reports/test.log' };
        const metaUri = store.getMetaUri(fakeUri as never);
        // Outside a real workspace, getCentralMetaUri returns undefined (no sidecar fallback)
        assert.strictEqual(metaUri, undefined);
    });

    test('Annotation interface should hold expected fields', () => {
        const ann: Annotation = {
            lineIndex: 5,
            text: 'This is a note',
            timestamp: '2026-01-27T12:00:00.000Z',
        };
        assert.strictEqual(ann.lineIndex, 5);
        assert.strictEqual(ann.text, 'This is a note');
        assert.ok(ann.timestamp.length > 0);
    });

    test('SessionMeta interface should support optional fields', () => {
        const meta: SessionMeta = {};
        assert.strictEqual(meta.displayName, undefined);
        assert.strictEqual(meta.tags, undefined);
        assert.strictEqual(meta.annotations, undefined);
    });

    test('isOurSidecar should match files with severity count fields', () => {
        assert.strictEqual(isOurSidecar({ errorCount: 0, warningCount: 0, perfCount: 0, fwCount: 0, infoCount: 10 }), true);
        assert.strictEqual(isOurSidecar({ errorCount: 5 }), true);
        assert.strictEqual(isOurSidecar({ infoCount: 100 }), true);
        assert.strictEqual(isOurSidecar({ fwCount: 0 }), true);
        assert.strictEqual(isOurSidecar({ warningCount: 3 }), true);
    });

    test('isOurSidecar should reject non-matching content', () => {
        assert.strictEqual(isOurSidecar(null), false);
        assert.strictEqual(isOurSidecar('string'), false);
        assert.strictEqual(isOurSidecar(42), false);
        assert.strictEqual(isOurSidecar([]), false);
        assert.strictEqual(isOurSidecar({}), false);
        assert.strictEqual(isOurSidecar({ name: 'some other tool' }), false);
        assert.strictEqual(isOurSidecar({ errorCount: 'not a number' }), false);
    });

    test('SessionMeta should hold all fields when populated', () => {
        const meta: SessionMeta = {
            displayName: 'My Session',
            tags: ['bug', 'prod'],
            annotations: [
                { lineIndex: 0, text: 'First line note', timestamp: '2026-01-27T12:00:00.000Z' },
            ],
        };
        assert.strictEqual(meta.displayName, 'My Session');
        assert.strictEqual(meta.tags?.length, 2);
        assert.strictEqual(meta.annotations?.length, 1);
        assert.strictEqual(meta.annotations?.[0].lineIndex, 0);
    });

    test('hasMeaningfulPerformanceData should reject placeholder snapshots (false positive guard)', () => {
        assert.strictEqual(hasMeaningfulPerformanceData(undefined), false);
        assert.strictEqual(hasMeaningfulPerformanceData(null), false);
        assert.strictEqual(hasMeaningfulPerformanceData({}), false);
        assert.strictEqual(hasMeaningfulPerformanceData({ snapshot: {} }), false);
        assert.strictEqual(hasMeaningfulPerformanceData({ snapshot: { note: 'placeholder' } }), false);
        assert.strictEqual(hasMeaningfulPerformanceData({ samplesFile: '   ' }), false);
    });

    test('hasMeaningfulPerformanceData should accept real snapshot/sample metadata', () => {
        assert.strictEqual(hasMeaningfulPerformanceData({ samplesFile: 'session.perf.json' }), true);
        assert.strictEqual(hasMeaningfulPerformanceData({ snapshot: { cpus: 8 } }), true);
        assert.strictEqual(hasMeaningfulPerformanceData({ snapshot: { totalMemMb: 16384, freeMemMb: 8000 } }), true);
        assert.strictEqual(hasMeaningfulPerformanceData({ snapshot: { processMemMb: 512 } }), true);
    });

    // bug_046: deleting a log used to leave its `.screenshots/` PNGs and `.screenshots.json`
    // index behind forever, growing disk usage unbounded. These run against real files in a
    // temp directory (like the flow-map cross-session tests) because the behavior under test
    // IS the filesystem cleanup, and a mocked fs would only test the mock.
    suite('cleanupDeletedSessionMetadata screenshot sidecar cleanup (bug_046)', () => {
        let dir = '';

        setup(async () => {
            dir = path.join(os.tmpdir(), `slc-sidecar-cleanup-${process.hrtime.bigint()}`);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
        });

        teardown(async () => {
            try { await vscode.workspace.fs.delete(vscode.Uri.file(dir), { recursive: true }); } catch { /* best effort */ }
        });

        test('should remove the screenshots directory and sidecar index when a log is deleted', async () => {
            const logFsPath = path.join(dir, '20260101_090000_app.log');
            const logUri = vscode.Uri.file(logFsPath);
            await vscode.workspace.fs.writeFile(logUri, new TextEncoder().encode('=== SAROPA LOG CAPTURE — SESSION START ===\n'));

            // Lay out sidecars exactly as ScreenshotStore.save() would.
            const dirUri = screenshotDirUri(logFsPath);
            const sidecarUri = screenshotSidecarUri(logFsPath);
            await vscode.workspace.fs.createDirectory(dirUri);
            await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(dirUri, '001_nav_1.png'), new Uint8Array([1]));
            await vscode.workspace.fs.writeFile(sidecarUri, new TextEncoder().encode('{"version":1,"screenshots":[]}'));

            await cleanupDeletedSessionMetadata(logUri, new SessionMetadataStore());

            // vscode.workspace.fs.stat returns a Thenable, not a real Promise, so assert.rejects
            // needs an async wrapper to get a type it accepts.
            await assert.rejects(async () => vscode.workspace.fs.stat(dirUri), 'screenshots directory must be gone');
            await assert.rejects(async () => vscode.workspace.fs.stat(sidecarUri), 'screenshots.json sidecar must be gone');
        });

        test('should not throw when a log has no screenshot sidecars at all', async () => {
            // Most logs never captured a screenshot — this is the common case, not an error.
            const logUri = vscode.Uri.file(path.join(dir, '20260101_090000_app.log'));
            await vscode.workspace.fs.writeFile(logUri, new TextEncoder().encode('no screenshots here\n'));
            await assert.doesNotReject(cleanupDeletedSessionMetadata(logUri, new SessionMetadataStore()));
        });
    });
});

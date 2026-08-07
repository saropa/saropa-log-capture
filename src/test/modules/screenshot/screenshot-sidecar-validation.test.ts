import * as assert from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { readScreenshotSidecar, screenshotSidecarUri } from '../../../modules/screenshot/screenshot-store';

/**
 * The sidecar is a JSON file on disk that outlives the process that wrote it — a user can edit it,
 * an older build may have written a field this one no longer understands, and a partial write can
 * leave a half-record behind. `readScreenshotSidecar` is the boundary where all of that has to be
 * rejected, because everything downstream (the gallery, the diagram thumbnails, the severity tint)
 * trusts the declared types without re-checking them.
 */
suite('screenshot sidecar validation at the read boundary', () => {
    let logFsPath = '';

    setup(async () => {
        const dir = path.join(os.tmpdir(), `slc-sidecar-${process.hrtime.bigint()}`);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
        logFsPath = path.join(dir, 'session.log');
    });

    /** Write a raw sidecar body (deliberately untyped — these are files, not values). */
    async function writeSidecar(screenshots: unknown): Promise<void> {
        const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, screenshots }));
        await vscode.workspace.fs.writeFile(screenshotSidecarUri(logFsPath), bytes);
    }

    /** A complete, valid record. */
    function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            file: '001_error_1000.png', trigger: 'error', timestamp: 1000,
            logLine: 12, text: 'boom', fingerprint: 'abc', ...overrides,
        };
    }

    test('should accept every trigger the capturer can actually emit', async () => {
        await writeSidecar(['error', 'warning', 'nav', 'manual'].map(t => entry({ trigger: t })));
        const read = await readScreenshotSidecar(logFsPath);
        assert.deepStrictEqual(read.map(e => e.trigger), ['error', 'warning', 'nav', 'manual']);
    });

    test('should DROP a record whose trigger is not in the union', async () => {
        // Consumers switch on trigger to pick a severity tint and to choose which capture represents
        // a screen; an unknown value would render as an untinted mystery rather than being rejected.
        await writeSidecar([entry(), entry({ trigger: 'crash' }), entry({ trigger: '' })]);
        const read = await readScreenshotSidecar(logFsPath);
        assert.strictEqual(read.length, 1, 'only the valid record survives');
        assert.strictEqual(read[0].trigger, 'error');
    });

    test('should drop records missing the fields that identify a capture at all', async () => {
        await writeSidecar([
            entry({ file: undefined }), entry({ timestamp: 'soon' }), entry({ trigger: undefined }),
            null, 'not an object', 42,
        ]);
        assert.deepStrictEqual(await readScreenshotSidecar(logFsPath), []);
    });

    test('should DEFAULT rather than reject an unanchored, unfingerprinted capture', async () => {
        // A manual capture legitimately has no log anchor and no fingerprint — demanding them would
        // discard valid history rather than protect anything.
        await writeSidecar([{ file: 'a.png', trigger: 'manual', timestamp: 5 }]);
        const read = await readScreenshotSidecar(logFsPath);
        assert.strictEqual(read.length, 1);
        assert.strictEqual(read[0].logLine, 0, 'unanchored, not undefined');
        assert.strictEqual(read[0].text, '');
        assert.strictEqual(read[0].fingerprint, '');
    });

    test('should return [] for a missing sidecar and for one that is not JSON', async () => {
        assert.deepStrictEqual(await readScreenshotSidecar(logFsPath), [], 'missing file');
        await vscode.workspace.fs.writeFile(screenshotSidecarUri(logFsPath), new TextEncoder().encode('{ "ver'));
        assert.deepStrictEqual(await readScreenshotSidecar(logFsPath), [], 'truncated write');
    });

    test('should return [] when screenshots is present but not an array', async () => {
        await writeSidecar({ '0': entry() });
        assert.deepStrictEqual(await readScreenshotSidecar(logFsPath), []);
    });
});

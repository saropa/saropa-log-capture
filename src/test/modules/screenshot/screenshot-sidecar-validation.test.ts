import * as assert from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    ScreenshotStore, readScreenshotSidecar, readScreenshotSummary, screenshotSidecarUri,
} from '../../../modules/screenshot/screenshot-store';

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

    /**
     * A log path whose sidecar can never be written, because a directory sits where the file goes.
     * The most reliable way to force a write failure without mocking the filesystem.
     */
    async function makeUnwritableLog(name: string): Promise<string> {
        const doomed = path.join(path.dirname(logFsPath), `${name}.log`);
        await vscode.workspace.fs.createDirectory(screenshotSidecarUri(doomed));
        return doomed;
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

    suite('suppressed count', () => {
        /** Write a whole sidecar body, including fields `writeSidecar` would normally own. */
        async function writeRaw(body: unknown): Promise<void> {
            const bytes = new TextEncoder().encode(JSON.stringify(body));
            await vscode.workspace.fs.writeFile(screenshotSidecarUri(logFsPath), bytes);
        }

        test('should read back a recorded suppressed count', async () => {
            await writeRaw({ version: 1, screenshots: [entry()], suppressed: 4 });
            const summary = await readScreenshotSummary(logFsPath);
            assert.strictEqual(summary.suppressed, 4);
            assert.strictEqual(summary.entries.length, 1, 'entries are unaffected');
        });

        test('should default to 0 for a sidecar written before the field existed', async () => {
            // Every sidecar on disk today has no such field; demanding one would reject all of them.
            await writeRaw({ version: 1, screenshots: [entry()] });
            assert.strictEqual((await readScreenshotSummary(logFsPath)).suppressed, 0);
        });

        test('should report 0 rather than propagate a nonsense count', async () => {
            for (const bad of [-3, 'many', null, Number.NaN]) {
                await writeRaw({ version: 1, screenshots: [entry()], suppressed: bad });
                assert.strictEqual((await readScreenshotSummary(logFsPath)).suppressed, 0, `for ${String(bad)}`);
            }
        });

        test('should persist across saves without losing the entries', async () => {
            const store = new ScreenshotStore();
            await store.save(logFsPath, new Uint8Array([1]), {
                trigger: 'nav', timestamp: 1, logLine: 1, text: 'x', fingerprint: '',
            }, 10);
            store.noteSuppressed(logFsPath);
            store.noteSuppressed(logFsPath);
            await store.dispose();
            const summary = await readScreenshotSummary(logFsPath);
            assert.strictEqual(summary.suppressed, 2, 'both suppressions counted');
            assert.strictEqual(summary.entries.length, 1, 'and the saved capture survived the rewrite');
        });

        test('should NOT write on every skip — a burst costs one write', async () => {
            // Skips arrive in bursts and cost nothing but a decision; a whole-file rewrite each
            // would put that burst on the live capture path to record a number read much later.
            const store = new ScreenshotStore();
            for (let i = 0; i < 20; i++) { store.noteSuppressed(logFsPath); }
            assert.strictEqual((await readScreenshotSummary(logFsPath)).suppressed, 0,
                'nothing written yet — the write is debounced');
            await store.dispose();
            assert.strictEqual((await readScreenshotSummary(logFsPath)).suppressed, 20,
                'and the whole burst lands in one write');
        });

        test('should keep flushing OTHER logs when one log\'s write fails', async () => {
            // Clearing the whole dirty set up front meant one failure discarded every other log's
            // count with it, permanently — nothing marks them dirty again unless that log happens
            // to skip another capture.
            const errors: string[] = [];
            const store = new ScreenshotStore((m) => errors.push(m));
            // Unwritable by construction: a DIRECTORY already occupies the sidecar's exact path, so
            // writeFile must fail. (A missing parent would not do — writeFile creates parents.)
            const doomed = await makeUnwritableLog('doomed');
            store.noteSuppressed(doomed);
            store.noteSuppressed(logFsPath);
            await store.flushSuppressed();
            assert.strictEqual((await readScreenshotSummary(logFsPath)).suppressed, 1,
                'the healthy log was written despite the other failing');
            assert.strictEqual(errors.length, 1, `the failure was reported: ${errors.join(' | ')}`);
            assert.ok(errors[0].includes('suppressed count'), 'and says what could not be recorded');
        });

        test('should keep a failed log dirty so the next flush retries it', async () => {
            const store = new ScreenshotStore(() => { /* failures are asserted elsewhere */ });
            store.noteSuppressed(await makeUnwritableLog('retry'));
            await store.flushSuppressed();
            assert.strictEqual(store.hasPendingSuppressed, true, 'still pending after a failed write');
        });

        test('should not lose counts when a save races the pending flush', async () => {
            // save() and the flush rewrite the SAME file from the same state; overlapping whole-file
            // writes would let the last writer win with a stale snapshot.
            const store = new ScreenshotStore();
            store.noteSuppressed(logFsPath);
            const saving = store.save(logFsPath, new Uint8Array([1]), {
                trigger: 'nav', timestamp: 2, logLine: 2, text: 'y', fingerprint: '',
            }, 10);
            const flushing = store.flushSuppressed();
            await Promise.all([saving, flushing]);
            const summary = await readScreenshotSummary(logFsPath);
            assert.strictEqual(summary.entries.length, 1, 'the capture survived');
            assert.strictEqual(summary.suppressed, 1, 'and so did the count');
        });
    });
});

import * as assert from 'node:assert';
import * as zlib from 'node:zlib';
import { ScreenshotCapturer, type ScreenshotCapturerDeps } from '../../../modules/screenshot/screenshot-capturer';
import { ScreenshotStore, type ScreenshotSaveResult } from '../../../modules/screenshot/screenshot-store';
import type { LineData } from '../../../modules/session/session-event-bus';

/**
 * Near-duplicate skipping, wired end to end through ScreenshotCapturer. Split from
 * screenshot-capturer.test.ts to keep that file inside the line budget.
 *
 * The similarity RULE is covered by screenshot-similarity.test.ts against built PNGs; what these
 * assert is the WIRING — that the setting is honored, that fault and manual captures bypass it, and
 * that the signature memory does not span logs.
 */

function makeLine(text: string, overrides: Partial<LineData> = {}): LineData {
    return {
        text,
        isMarker: false,
        lineCount: 42,
        category: 'stderr',
        timestamp: new Date(1719849123456),
        logFileUri: 'd:/reports/test.log',
        ...overrides,
    };
}

interface Recorded { trigger: string; logLine: number; }

/** Store double: records what was actually persisted, including suppression counts. */
class FakeStore {
    saves: Recorded[] = [];
    suppressed = 0;
    noteSuppressed(_log: string): Promise<void> {
        this.suppressed++;
        return Promise.resolve();
    }
    save(_log: string, _png: Uint8Array, entry: { trigger: string; logLine: number }): Promise<ScreenshotSaveResult | undefined> {
        this.saves.push({ trigger: entry.trigger, logLine: entry.logLine });
        return Promise.resolve({
            entry: { file: 'x.png', trigger: entry.trigger, timestamp: 0, logLine: entry.logLine, text: '', fingerprint: '' } as ScreenshotSaveResult['entry'],
            pngUri: undefined as unknown as ScreenshotSaveResult['pngUri'],
            totalForLog: this.saves.length,
        });
    }
}

interface Harness {
    capturer: ScreenshotCapturer;
    store: FakeStore;
    logs: string[];
    flush: () => Promise<void>;
}

function makeHarness(overrides: Partial<ScreenshotCapturerDeps>): Harness {
    const store = new FakeStore();
    const logs: string[] = [];
    const capturer = new ScreenshotCapturer({
        isEnabled: () => true,
        triggerSettings: () => ({
            onError: true, onWarning: false, onNavigation: false, cooldownMs: 2000, maxPerLog: 50,
            skipNearDuplicates: false, duplicateSimilarity: 0.985,
        }),
        getVmServiceWsUri: () => 'ws://127.0.0.1:1234/tok=/ws',
        capturePng: () => Promise.resolve(new Uint8Array([1])),
        store: store as unknown as ScreenshotStore,
        log: (m) => logs.push(m),
        now: () => 1000000,
        ...overrides,
    });
    // captureAndSave settles across two awaited promises; two macrotask hops flush it.
    const flush = async (): Promise<void> => { await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); };
    return { capturer, store, logs, flush };
}

suite('ScreenshotCapturer near-duplicate skipping', () => {
    /** A flat 8-bit RGBA PNG of one shade — same shade in, same signature out. */
    function flatPng(shade: number): Uint8Array {
        const w = 40, h = 80, stride = w * 4;
        const raw = Buffer.alloc((stride + 1) * h);
        for (let y = 0; y < h; y++) {
            const at = y * (stride + 1);
            for (let x = 0; x < w; x++) {
                const p = at + 1 + x * 4;
                raw[p] = raw[p + 1] = raw[p + 2] = shade;
                raw[p + 3] = 255;
            }
        }
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(w, 0);
        ihdr.writeUInt32BE(h, 4);
        ihdr[8] = 8;
        ihdr[9] = 6;
        const chunk = (type: string, data: Buffer): Buffer => {
            const head = Buffer.alloc(4);
            head.writeUInt32BE(data.length, 0);
            const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
            // CRC is not validated by the reader, so a zero placeholder keeps this helper small.
            return Buffer.concat([head, body, Buffer.alloc(4)]);
        };
        return Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
        ]);
    }

    /** Harness whose captures return a caller-controlled picture, with dedup on. */
    function dedupHarness(shade: () => number, on = true): Harness {
        return makeHarness({
            capturePng: () => Promise.resolve(flatPng(shade())),
            triggerSettings: () => ({
                onError: true, onWarning: true, onNavigation: true, cooldownMs: 0, maxPerLog: 50,
                skipNearDuplicates: on, duplicateSimilarity: 0.985,
            }),
        });
    }

    // The REAL decorated shape — the breadcrumb classifier needs the `[log]` channel prefix, and
    // a bare "Screen Navigation: Home" silently classifies as nothing at all.
    const NAV_TEXT = '[08:00:01.000] [console] [log] Screen Navigation: Home';
    const navLine = (line: number, log = 'd:/reports/test.log') =>
        makeLine(NAV_TEXT, { category: 'stdout', lineCount: line, logFileUri: log });

    test('should skip a navigation capture identical to a recent one, and say so', async () => {
        const h = dedupHarness(() => 120);
        h.capturer.onLine(navLine(1));
        await h.flush();
        h.capturer.onLine(navLine(2));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 1, 'the second identical picture was not saved');
        assert.ok(h.logs.some(l => /skipped a 100\.0% match/.test(l)), `a skip is reported: ${h.logs}`);
    });

    test('should keep both when the pictures genuinely differ', async () => {
        let shade = 20;
        const h = dedupHarness(() => shade);
        h.capturer.onLine(navLine(1));
        await h.flush();
        shade = 220;
        h.capturer.onLine(navLine(2));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 2);
    });

    test('should never skip a FAULT capture, however alike the picture', async () => {
        // The picture at the moment of an error is the report's whole point.
        const h = dedupHarness(() => 120);
        h.capturer.onLine(makeLine('Unhandled Exception: boom', { lineCount: 1 }));
        await h.flush();
        h.capturer.onLine(makeLine('Unhandled Exception: different text', { lineCount: 2 }));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 2, 'both error captures kept');
    });

    test('should not skip anything while the setting is off', async () => {
        const h = dedupHarness(() => 120, false);
        h.capturer.onLine(navLine(1));
        await h.flush();
        h.capturer.onLine(navLine(2));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 2, 'default-off means no behavior change');
    });

    test('should say ONCE when a capture cannot be read for comparison', async () => {
        // "Cannot read it" keeps the capture by design, which would otherwise make an unsupported
        // PNG form look like a setting that quietly stopped working.
        const h = makeHarness({
            capturePng: () => Promise.resolve(new Uint8Array([1, 2, 3])),
            triggerSettings: () => ({
                onError: true, onWarning: true, onNavigation: true, cooldownMs: 0, maxPerLog: 50,
                skipNearDuplicates: true, duplicateSimilarity: 0.985,
            }),
        });
        h.capturer.onLine(navLine(1));
        await h.flush();
        h.capturer.onLine(navLine(2));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 2, 'unreadable captures are kept, never dropped');
        const notices = h.logs.filter(l => l.includes('could not be read'));
        assert.strictEqual(notices.length, 1, `said exactly once, not per capture: ${h.logs.length} logs`);
    });

    test('should record the suppressed count so a later report can state it', async () => {
        const h = dedupHarness(() => 120);
        h.capturer.onLine(navLine(1));
        await h.flush();
        h.capturer.onLine(navLine(2));
        await h.flush();
        assert.strictEqual(h.capturer.suppressedShotCount, 1, 'counted in memory');
        assert.strictEqual(h.store.suppressed, 1, 'and persisted for a report built later');
    });

    test('should FORGET the previous log — a new session starts with an empty memory', async () => {
        // The capturer outlives any one session. Without a reset, a new run's first screenshot
        // would be compared against the last run's and could be discarded before the new log had
        // a single capture.
        const h = dedupHarness(() => 120);
        h.capturer.onLine(navLine(1));
        await h.flush();
        h.capturer.onLine(navLine(1, 'd:/reports/next-session.log'));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 2, 'the new log kept its first capture');
    });
});

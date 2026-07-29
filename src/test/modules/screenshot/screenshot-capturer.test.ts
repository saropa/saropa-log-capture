import * as assert from 'node:assert';
import { ScreenshotCapturer, type ScreenshotCapturerDeps } from '../../../modules/screenshot/screenshot-capturer';
import { ScreenshotStore, type ScreenshotSaveResult } from '../../../modules/screenshot/screenshot-store';
import { toVmServiceWsUri } from '../../../modules/screenshot/vm-service-uri';
import { parseScreenshotReply } from '../../../modules/screenshot/vm-service-screenshot';
import type { LineData } from '../../../modules/session/session-event-bus';

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

/** Store double: records saves; returns undefined once `full` is set (cap reached). */
class FakeStore {
    saves: Recorded[] = [];
    full = false;
    save(_log: string, _png: Uint8Array, entry: { trigger: string; logLine: number }): Promise<ScreenshotSaveResult | undefined> {
        if (this.full) { return Promise.resolve(undefined); }
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
    clock: { now: number };
    flush: () => Promise<void>;
}

function makeHarness(overrides: Partial<ScreenshotCapturerDeps> = {}): Harness {
    const store = new FakeStore();
    const logs: string[] = [];
    const clock = { now: 1000000 };
    const deps: ScreenshotCapturerDeps = {
        isEnabled: () => true,
        triggerSettings: () => ({ onError: true, onWarning: false, onNavigation: false, cooldownMs: 2000, maxPerLog: 50 }),
        getVmServiceWsUri: () => 'ws://127.0.0.1:1234/tok=/ws',
        capturePng: () => Promise.resolve(new Uint8Array([1])),
        store: store as unknown as ScreenshotStore,
        log: (m) => logs.push(m),
        now: () => clock.now,
        ...overrides,
    };
    const capturer = new ScreenshotCapturer(deps);
    // captureAndSave settles across two awaited promises; two macrotask hops flush it.
    const flush = async (): Promise<void> => { await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); };
    return { capturer, store, logs, clock, flush };
}

suite('ScreenshotCapturer', () => {
    test('should capture on an error line with the error trigger', async () => {
        const h = makeHarness();
        h.capturer.onLine(makeLine('Unhandled Exception: something broke'));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 1);
        assert.strictEqual(h.store.saves[0].trigger, 'error');
        assert.strictEqual(h.store.saves[0].logLine, 42);
    });

    test('should not capture when the master toggle is off', async () => {
        const h = makeHarness({ isEnabled: () => false });
        h.capturer.onLine(makeLine('Unhandled Exception: something broke'));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 0);
    });

    test('should not capture without a live VM Service', async () => {
        const h = makeHarness({ getVmServiceWsUri: () => undefined });
        h.capturer.onLine(makeLine('Unhandled Exception: something broke'));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 0);
    });

    test('should skip markers and non-error lines', async () => {
        const h = makeHarness();
        h.capturer.onLine(makeLine('Unhandled Exception: broke', { isMarker: true }));
        h.capturer.onLine(makeLine('plain informational output', { category: 'stdout' }));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 0);
    });

    test('should dedupe identical error signatures', async () => {
        const h = makeHarness();
        h.capturer.onLine(makeLine('Unhandled Exception: null pointer at 0x1234'));
        await h.flush();
        h.clock.now += 10000; // cooldown passed — only the fingerprint blocks now
        h.capturer.onLine(makeLine('Unhandled Exception: null pointer at 0x9999'));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 1);
    });

    test('should enforce the cooldown between distinct errors', async () => {
        const h = makeHarness();
        h.capturer.onLine(makeLine('Unhandled Exception: first distinct failure'));
        await h.flush();
        h.clock.now += 500; // inside the 2000ms cooldown
        h.capturer.onLine(makeLine('Unhandled Exception: completely different second failure'));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 1);
        h.clock.now += 5000; // cooldown expired
        h.capturer.onLine(makeLine('Unhandled Exception: a third distinct failure entirely'));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 2);
    });

    test('should warn exactly once when the per-log cap refuses saves', async () => {
        const h = makeHarness();
        h.store.full = true;
        h.capturer.onLine(makeLine('Unhandled Exception: alpha failure'));
        await h.flush();
        h.clock.now += 5000;
        h.capturer.onLine(makeLine('Unhandled Exception: beta failure of another kind'));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 0);
        assert.strictEqual(h.logs.filter((l) => l.includes('cap')).length, 1);
    });

    test('manual capture should bypass cooldown and report outcomes', async () => {
        const h = makeHarness();
        assert.strictEqual(await h.capturer.captureManual('d:/reports/test.log', 7), 'saved');
        assert.strictEqual(await h.capturer.captureManual('d:/reports/test.log', 8), 'saved');
        h.store.full = true;
        assert.strictEqual(await h.capturer.captureManual('d:/reports/test.log', 9), 'capFull');
        const off = makeHarness({ isEnabled: () => false });
        assert.strictEqual(await off.capturer.captureManual('d:/reports/test.log', 1), 'disabled');
        const noVm = makeHarness({ getVmServiceWsUri: () => undefined });
        assert.strictEqual(await noVm.capturer.captureManual('d:/reports/test.log', 1), 'noVmService');
    });

    test('manual capture should report busy while another capture is in flight', async () => {
        // Hold the auto-trigger capture open with a never-resolving PNG fetch, then try manual.
        let release: ((png: Uint8Array) => void) | undefined;
        const h = makeHarness({ capturePng: () => new Promise((r) => { release = r; }) });
        h.capturer.onLine(makeLine('Unhandled Exception: something broke'));
        await new Promise((r) => setImmediate(r)); // let the auto capture enter captureAndSave
        assert.strictEqual(await h.capturer.captureManual('d:/reports/test.log', 5), 'busy');
        release?.(new Uint8Array([1]));
        await h.flush();
        // Exactly ONE save landed (the auto capture); the manual attempt never raced the store.
        assert.strictEqual(h.store.saves.length, 1);
    });

    test('manual capture should report failed when the VM call rejects', async () => {
        const h = makeHarness({ capturePng: () => Promise.reject(new Error('boom')) });
        assert.strictEqual(await h.capturer.captureManual('d:/reports/test.log', 1), 'failed');
        assert.strictEqual(h.logs.length, 1);
    });
});

suite('toVmServiceWsUri', () => {
    test('should convert the announced http URI to its ws form', () => {
        assert.strictEqual(toVmServiceWsUri('http://127.0.0.1:52999/abc123=/'), 'ws://127.0.0.1:52999/abc123=/ws');
        assert.strictEqual(toVmServiceWsUri('http://127.0.0.1:52999/abc123='), 'ws://127.0.0.1:52999/abc123=/ws');
        assert.strictEqual(toVmServiceWsUri('ws://127.0.0.1:52999/abc123=/ws'), 'ws://127.0.0.1:52999/abc123=/ws');
    });
});

suite('parseScreenshotReply', () => {
    test('should decode a valid reply for our id', () => {
        const png = Buffer.from([137, 80, 78, 71]).toString('base64');
        const [err, bytes, ours] = parseScreenshotReply(JSON.stringify({ jsonrpc: '2.0', id: '1', result: { type: 'Screenshot', screenshot: png } }));
        assert.strictEqual(err, undefined);
        assert.strictEqual(ours, true);
        assert.deepStrictEqual([...(bytes ?? [])], [137, 80, 78, 71]);
    });

    test('should ignore stream events and other ids', () => {
        assert.strictEqual(parseScreenshotReply(JSON.stringify({ method: 'streamNotify', params: {} }))[2], false);
        assert.strictEqual(parseScreenshotReply(JSON.stringify({ id: '2', result: {} }))[2], false);
    });

    test('should surface RPC errors and missing payloads', () => {
        const [err1, , ours1] = parseScreenshotReply(JSON.stringify({ id: '1', error: { message: 'no rasterizer' } }));
        assert.ok(err1 && err1.message.includes('no rasterizer'));
        assert.strictEqual(ours1, true);
        const [err2] = parseScreenshotReply(JSON.stringify({ id: '1', result: {} }));
        assert.ok(err2);
        const [err3, , ours3] = parseScreenshotReply('not json');
        assert.ok(err3);
        assert.strictEqual(ours3, true);
    });
});

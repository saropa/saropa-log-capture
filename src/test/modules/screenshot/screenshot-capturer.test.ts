import * as assert from 'node:assert';
import { ScreenshotCapturer, type ScreenshotCapturerDeps } from '../../../modules/screenshot/screenshot-capturer';
import { ScreenshotStore, type ScreenshotSaveResult } from '../../../modules/screenshot/screenshot-store';
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

    test('should never capture on device/framework error lines (startup-noise guard)', async () => {
        const h = makeHarness();
        // Real lines from a contacts startup log (2026-07-28): benign framework errors that
        // match isErrorLine but must not burn a capture.
        h.capturer.onLine(makeLine('E/Gralloc4(14538): isSupported(1, 1, 56, 1, ...) failed with 5', { category: 'console' }));
        await h.flush();
        h.clock.now += 5000;
        h.capturer.onLine(makeLine('E/Badge   (14538): Failed to initialize badge', { category: 'stdout' }));
        await h.flush();
        h.clock.now += 5000;
        h.capturer.onLine(makeLine('E/FBI     (14538): Can\'t load library: dlopen failed: library "libmagtsync.so" not found', { category: 'console' }));
        await h.flush();
        h.clock.now += 5000;
        h.capturer.onLine(makeLine('E/GraphicBufferAllocator(14538): Failed to allocate (4 x 4) layerCount 1 format 56 usage b00: 5', { category: 'console' }));
        await h.flush();
        h.clock.now += 5000;
        // The direct logcat feed is device output wholesale — even a device-critical tag
        // (ActivityManager) arriving on category 'logcat' is skipped.
        h.capturer.onLine(makeLine('07-28 21:50:35.847  1919  2024 E ActivityManager: restart failed', { category: 'logcat' }));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 0);
    });

    test('should still capture on flutter-tagged and untagged app error lines', async () => {
        const h = makeHarness();
        h.capturer.onLine(makeLine('I/flutter (14538): === debugException break — fix this error ===', { category: 'stdout' }));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 1);
    });

    test('should capture on device-CRITICAL relays (AndroidRuntime crash) via console/stdout', async () => {
        // device-critical = "real app problems, always visible" (device-tag-tiers.ts); a native
        // crash relay is the frame most worth photographing. Only device-other is suppressed.
        const h = makeHarness();
        h.capturer.onLine(makeLine('E/AndroidRuntime(14538): FATAL EXCEPTION: main', { category: 'stdout' }));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 1);
        assert.strictEqual(h.store.saves[0].trigger, 'error');
    });

    test('should skip the tier classifier entirely when no trigger is enabled', async () => {
        const h = makeHarness({
            triggerSettings: () => ({ onError: false, onWarning: false, onNavigation: false, cooldownMs: 2000, maxPerLog: 50 }),
        });
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

    test('should pause auto captures after 3 consecutive failures and resume on a new VM URI', async () => {
        let uri = 'ws://127.0.0.1:1111/a=/ws';
        const h = makeHarness({
            getVmServiceWsUri: () => uri,
            capturePng: () => Promise.reject(new Error('socket timeout')),
        });
        // Three distinct errors → three failed attempts → breaker trips.
        for (const text of ['Unhandled Exception: alpha one', 'Unhandled Exception: beta two', 'Unhandled Exception: gamma three']) {
            h.capturer.onLine(makeLine(text));
            await h.flush();
            h.clock.now += 5000;
        }
        assert.strictEqual(h.logs.filter((l) => l.includes('paused')).length, 1);
        // Fourth error: no attempt at all (no new failure log beyond the 3 + the trip notice).
        h.capturer.onLine(makeLine('Unhandled Exception: delta four'));
        await h.flush();
        assert.strictEqual(h.logs.filter((l) => l.includes('socket timeout')).length, 3);
        // New VM URI (new run) → breaker resets → attempts resume.
        uri = 'ws://127.0.0.1:2222/b=/ws';
        h.clock.now += 5000;
        h.capturer.onLine(makeLine('Unhandled Exception: epsilon five'));
        await h.flush();
        assert.strictEqual(h.logs.filter((l) => l.includes('socket timeout')).length, 4);
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

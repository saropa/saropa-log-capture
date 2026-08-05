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

    test('should warn once about a missing VM Service — but not on startup device noise', async () => {
        const h = makeHarness({ getVmServiceWsUri: () => undefined });
        // The startup logcat replay burst streams device noise and old crashes on EVERY healthy
        // session; warning on those turns the diagnostic into a routine false alarm.
        h.capturer.onLine(makeLine('07-29 08:39:15.769 24445 24458 E AndroidRuntime: FATAL EXCEPTION: video', { category: 'logcat' }));
        h.capturer.onLine(makeLine('E/Gralloc4(14538): isSupported(1, 1, 56, 1, ...) failed with 5', { category: 'console' }));
        await h.flush();
        assert.strictEqual(h.logs.filter((l) => l.includes('no VM Service address')).length, 0);
        // A real app error with no URI known is the genuine signal — warned exactly once.
        h.capturer.onLine(makeLine('Unhandled Exception: something broke'));
        h.capturer.onLine(makeLine('Unhandled Exception: something else broke'));
        await h.flush();
        assert.strictEqual(h.logs.filter((l) => l.includes('no VM Service address')).length, 1);
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

    /**
     * Logcat feed cases. Device stamps deliberately sit 4 HOURS ahead of host arrival
     * (device on UTC, workstation on EDT — routine): the gate must be timezone-immune, and
     * an absolute "device stamp within N minutes of now" test would reject all of these.
     */
    const hostT0 = new Date(2026, 7, 4, 19, 0, 0).getTime();
    const at = (offsetMs: number): Date => new Date(hostT0 + offsetMs);
    const logcat = (text: string, offsetMs: number): LineData =>
        makeLine(text, { category: 'logcat', timestamp: at(offsetMs) });

    test('should capture a live device-critical logcat crash despite device/host timezone offset', async () => {
        const h = makeHarness();
        // Feed drains its startup burst, then live output establishes the device watermark.
        h.capturer.onLine(logcat('08-04 23:00:00.000 24732 24752 I ActivityManager: start proc', 0));
        h.capturer.onLine(logcat('08-04 23:00:06.000 24732 24752 I ActivityManager: displayed', 6000));
        await h.flush();
        h.clock.now += 5000;
        // Past the grace window and current against the watermark → the profile-mode signal fires.
        h.capturer.onLine(logcat('08-04 23:00:10.000 24445 24458 E AndroidRuntime: FATAL EXCEPTION: main', 10000));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 1);
        assert.strictEqual(h.store.saves[0].trigger, 'error');
    });

    test('should NOT capture replayed buffer crashes (startup burst or mid-session re-dump)', async () => {
        const h = makeHarness();
        // Literal line from the 2026-08-04 contacts log: a real FATAL EXCEPTION six days old,
        // arriving in the startup burst (whole buffer delivered inside milliseconds).
        const staleCrash = '07-29 08:39:15.769 24445 24458 E AndroidRuntime: FATAL EXCEPTION: video';
        h.capturer.onLine(logcat(staleCrash, 0));
        h.capturer.onLine(logcat('07-29 08:39:16.000 24732 24752 I ActivityManager: ...', 1));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 0, 'startup replay must not capture');
        // Live output advances the watermark to current device time.
        h.clock.now += 5000;
        h.capturer.onLine(logcat('08-04 23:00:00.000 24732 24752 I ActivityManager: displayed', 8000));
        // The SAME old crash re-delivered mid-session (logcat respawn) is far below the watermark.
        h.capturer.onLine(logcat(staleCrash, 9000));
        await h.flush();
        assert.strictEqual(h.store.saves.length, 0, 'mid-session re-dump must not capture');
    });

    test('should NOT capture W-level binder noise even when live', async () => {
        const h = makeHarness();
        h.capturer.onLine(logcat('08-04 23:00:00.000 24732 24752 I ActivityManager: start proc', 0));
        await h.flush();
        h.clock.now += 5000;
        // Fresh, device-critical tag, but W level — matches isErrorLine via the word "error".
        h.capturer.onLine(logcat('08-04 23:00:10.000 24732 26378 W ActivityManager: sent binder code 10 and got error -32', 10000));
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

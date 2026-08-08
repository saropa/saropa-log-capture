import * as assert from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ScreenshotCapturer } from '../../../modules/screenshot/screenshot-capturer';
import { ScreenshotStore, readScreenshotSidecar, screenshotDirUri } from '../../../modules/screenshot/screenshot-store';
import { captureVmServiceScreenshot } from '../../../modules/screenshot/vm-service-screenshot';
import { captureAdbScreenshot } from '../../../modules/screenshot/adb-screenshot';
import { makeCaptureTransport } from '../../../modules/screenshot/screenshot-transport';
import {
    recordVmServiceUriFromLogLine,
    getLatestVmServiceWsUri,
    clearVmServiceUris,
} from '../../../modules/screenshot/vm-service-uri';
import type { LineData } from '../../../modules/session/session-event-bus';

/**
 * END-TO-END pipeline proof (field report 2026-07-30: "no screenshots are EVER captured").
 *
 * Composes the REAL production pieces exactly as screenshot-wiring.ts does — URI
 * discovery from the literal console banner, trigger classification on the literal
 * exception line from a real contacts log, the real VM-then-adb transport, and the real
 * store — and asserts a PNG + metadata sidecar land on disk.
 *
 * The final save requires a live adb device; without one the test still asserts the
 * pipeline reached the transport and logged the adb failure (never a silent pass), and
 * prints a skip notice for the device-dependent tail.
 */
suite('screenshot pipeline end-to-end', () => {
    teardown(() => clearVmServiceUris());

    /** Build a capturer wired exactly as screenshot-wiring.ts does, against a temp log. */
    async function makeRig(): Promise<{ capturer: ScreenshotCapturer; store: ScreenshotStore; logs: string[]; logFsPath: string }> {
        const logDir = path.join(os.tmpdir(), `slc-e2e-${Date.now()}-${Math.floor(process.hrtime()[1] / 1000)}`);
        const logFsPath = path.join(logDir, 'e2e.log');
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(logDir));
        const logs: string[] = [];
        const store = new ScreenshotStore();
        const capturer = new ScreenshotCapturer({
            isEnabled: () => true,
            triggerSettings: () => ({ onError: true, onWarning: false, onNavigation: false, cooldownMs: 250, maxPerLog: 50, skipNearDuplicates: false, duplicateSimilarity: 0.985 }),
            getVmServiceWsUri: getLatestVmServiceWsUri,
            capturePng: makeCaptureTransport({
                vm: captureVmServiceScreenshot,
                adb: () => captureAdbScreenshot(''),
                log: (m) => logs.push(m),
            }),
            store,
            log: (m) => logs.push(m),
        });
        return { capturer, store, logs, logFsPath };
    }

    /** Wait until a save lands or the transport reports why it could not. */
    async function settle(store: ScreenshotStore, logs: string[], logFsPath: string): Promise<void> {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline && store.countForLog(logFsPath) === 0
            && !logs.some((l) => /adb (screencap failed|not available)/.test(l))) {
            await new Promise((r) => setTimeout(r, 250));
        }
    }

    test('PROFILE-MODE path: a live logcat crash should produce a PNG on disk', async function () {
        this.timeout(20000);
        // The defect this proves: profile-mode Flutter runs emit no console exception banners,
        // so the device's own crash line is the only error signal. Device stamps deliberately
        // sit hours away from host arrival time (device on another timezone) — the gate must
        // still admit the crash.
        const rig = await makeRig();
        assert.strictEqual(recordVmServiceUriFromLogLine('Connecting to VM Service at ws://127.0.0.1:1/deadbeef=/ws', rig.logFsPath), true);

        const base = Date.now();
        const lc = (text: string, offsetMs: number, lineCount = 7): LineData => ({
            text, category: 'logcat', lineCount, isMarker: false,
            timestamp: new Date(base + offsetMs), logFileUri: rig.logFsPath,
        });
        // Startup burst drains, live output establishes the device-clock watermark…
        rig.capturer.onLine(lc('08-05 10:00:00.000 24732 24752 I ActivityManager: start proc', 0));
        rig.capturer.onLine(lc('08-05 10:00:06.000 24732 24752 I ActivityManager: displayed', 6000));
        // …then the real crash, past the replay grace window.
        rig.capturer.onLine(lc('08-05 10:00:10.000 24445 24458 E AndroidRuntime: FATAL EXCEPTION: main', 10000, 99));
        await settle(rig.store, rig.logs, rig.logFsPath);

        if (rig.store.countForLog(rig.logFsPath) === 0) {
            const adbFailure = rig.logs.find((l) => /adb (screencap failed|not available)/.test(l));
            assert.ok(adbFailure, `pipeline went silent — no save and no transport log. Logs: ${rig.logs.join(' | ')}`);
            console.log(`[e2e] no device attached — logcat-path tail skipped (${adbFailure})`);
            return;
        }
        const entries = await readScreenshotSidecar(rig.logFsPath);
        assert.strictEqual(entries.length, 1, 'exactly the crash line should capture — not the info lines');
        assert.strictEqual(entries[0].logLine, 99);
        const png = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(screenshotDirUri(rig.logFsPath), entries[0].file));
        assert.ok(png[0] === 0x89 && png[1] === 0x50 && png.byteLength > 1000);
        console.log(`[e2e] profile-mode logcat path verified: ${entries[0].file}, ${png.byteLength} bytes`);
    });

    test('banner line + exception line should produce a PNG and sidecar on disk', async function () {
        this.timeout(20000);
        const logDir = path.join(os.tmpdir(), `slc-e2e-${Date.now()}`);
        const logFsPath = path.join(logDir, 'e2e.log');
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(logDir));

        const logs: string[] = [];
        const store = new ScreenshotStore();
        const capturer = new ScreenshotCapturer({
            isEnabled: () => true,
            triggerSettings: () => ({ onError: true, onWarning: false, onNavigation: false, cooldownMs: 250, maxPerLog: 50, skipNearDuplicates: false, duplicateSimilarity: 0.985 }),
            getVmServiceWsUri: getLatestVmServiceWsUri,
            capturePng: makeCaptureTransport({
                vm: captureVmServiceScreenshot,
                adb: () => captureAdbScreenshot(''),
                log: (m) => logs.push(m),
            }),
            store,
            log: (m) => logs.push(m),
        });

        const line = (text: string, category: string, lineCount: number): LineData => ({
            text, category, lineCount, isMarker: false, timestamp: new Date(), logFileUri: logFsPath,
        });

        // 1. The ONLY VM Service line real sessions emit (verbatim from a contacts log) —
        //    pointed at a dead loopback port so the VM probe fails over to adb.
        const banner = 'Connecting to VM Service at ws://127.0.0.1:1/deadbeef=/ws';
        assert.strictEqual(recordVmServiceUriFromLogLine(banner, logFsPath), true, 'banner must register a URI');
        assert.ok(getLatestVmServiceWsUri(), 'URI must be discoverable after the banner');

        // 2. The literal trigger line from the same log.
        capturer.onLine(line('════════ Exception caught by rendering library ════════', 'stderr', 42));

        // 3. Wait for the async capture to settle (VM probe fails fast on the dead port, adb runs).
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline && store.countForLog(logFsPath) === 0
            && !logs.some((l) => /adb (screencap failed|not available)/.test(l))) {
            await new Promise((r) => setTimeout(r, 250));
        }

        // The pipeline must never end silent: either a save landed or the transport logged why not.
        if (store.countForLog(logFsPath) === 0) {
            const adbFailure = logs.find((l) => /adb (screencap failed|not available)/.test(l));
            assert.ok(adbFailure, `pipeline went silent — no save and no transport log. Logs: ${logs.join(' | ')}`);
             
            console.log(`[e2e] no device attached — device-dependent tail skipped (${adbFailure})`);
            return;
        }

        // 4. Device present: assert the real artifacts.
        const entries = await readScreenshotSidecar(logFsPath);
        assert.strictEqual(entries.length, 1);
        assert.strictEqual(entries[0].trigger, 'error');
        assert.strictEqual(entries[0].logLine, 42);
        const png = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(screenshotDirUri(logFsPath), entries[0].file));
        assert.ok(png.byteLength > 1000, `PNG too small: ${png.byteLength}`);
        assert.ok(png[0] === 0x89 && png[1] === 0x50, 'saved file must be a PNG');
         
        console.log(`[e2e] full pipeline verified: ${entries[0].file}, ${png.byteLength} bytes`);
    });
});

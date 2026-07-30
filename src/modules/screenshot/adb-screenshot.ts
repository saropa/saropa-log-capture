/**
 * Device screenshot via `adb exec-out screencap -p` (plan 114 follow-up).
 *
 * WHY this transport exists: modern Flutter SDKs removed the private
 * `_flutter.screenshot` VM extension (flutter_tools now carries only
 * `_flutter.screenshotSkp`, a Skia-picture dump that is not a PNG and is dead under
 * Impeller) — verified against the local SDK on 2026-07-29 after live sessions
 * produced zero captures. For Android debug targets, screencap captures the actual
 * device frame regardless of Flutter/Impeller version. `exec-out` (not `shell`) is
 * required for binary-safe output on Windows.
 *
 * Trade-off vs the VM path: includes system chrome (status bar etc.) and needs adb —
 * which the adb-logcat integration already assumes for these sessions.
 */

import { spawn } from 'node:child_process';

/** Bound a hung adb (device asleep, USB drop) — same order as the VM capture timeout. */
const CAPTURE_TIMEOUT_MS = 7000;

/** PNG magic prefix — screencap failures sometimes exit 0 with error text on stdout. */
function looksLikePng(buf: Buffer): boolean {
    return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

/**
 * Capture one PNG from the (or the given) connected Android device.
 * Rejects with an output-channel-ready reason on any failure; never throws sync.
 */
export function captureAdbScreenshot(deviceSerial: string): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
        const args = [...(deviceSerial ? ['-s', deviceSerial] : []), 'exec-out', 'screencap', '-p'];
        const child = spawn('adb', args, { windowsHide: true });
        const out: Buffer[] = [];
        const err: Buffer[] = [];
        let settled = false;
        const finish = (e: Error | undefined, png?: Uint8Array): void => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            if (e) { reject(e); } else { resolve(png!); }
        };
        const timer = setTimeout(() => {
            try { child.kill(); } catch { /* already gone */ }
            finish(new Error(`adb screencap timed out after ${CAPTURE_TIMEOUT_MS}ms`));
        }, CAPTURE_TIMEOUT_MS);

        child.stdout.on('data', (c: Buffer) => out.push(c));
        child.stderr.on('data', (c: Buffer) => err.push(c));
        child.on('error', (e: Error) => finish(new Error(`adb not available: ${e.message}`)));
        child.on('close', (code: number | null) => {
            const buf = Buffer.concat(out);
            if (code === 0 && looksLikePng(buf)) {
                finish(undefined, new Uint8Array(buf));
                return;
            }
            const detail = Buffer.concat(err).toString().trim().slice(0, 200) || `exit ${code}, ${buf.length} bytes`;
            finish(new Error(`adb screencap failed: ${detail}`));
        });
    });
}

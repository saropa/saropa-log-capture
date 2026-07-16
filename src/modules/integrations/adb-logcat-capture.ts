/**
 * Spawns and manages an `adb logcat` child process during a debug session.
 * Follows the terminal-capture / external-log-tailer pattern: module-level
 * state, start/stop functions, and a buffer snapshot for sidecar writing.
 */

import { spawn, execFile, execFileSync } from 'child_process';
import type { ChildProcess } from 'child_process';
import { parseLogcatLine, meetsMinLevel, type LogcatLine } from './adb-logcat-parser';
import { getDeviceTier } from '../analysis/device-tag-tiers';

/** Options for starting logcat capture. */
export interface LogcatCaptureOptions {
    readonly device: string;
    readonly tagFilters: readonly string[];
    readonly minLevel: string;
    readonly filterByPid: boolean;
    readonly maxBufferLines: number;
    /** When false (default), drop device-other lines before they reach the viewer. */
    readonly captureDeviceOther: boolean;
    /** When true (default), device-critical (ANR/crash) lines bypass the level and PID gates. */
    readonly captureAnr: boolean;
    readonly outputChannel: { appendLine(msg: string): void };
    /** Called for each accepted logcat line (used to push into the active log session). */
    readonly onLine: (raw: string) => void;
}

let childProcess: ChildProcess | undefined;
let buffer: string[] = [];
let pidFilter: number | undefined;
let filterByPid = true;
let captureDeviceOther = false;
let captureAnr = true;
let minLevel = 'V';
let maxBuffer = 50_000;
let remainder = '';
let lineCb: ((raw: string) => void) | undefined;

/** Check if `adb` is available on PATH. */
export function isAdbAvailable(): boolean {
    try {
        execFileSync('adb', ['version'], { timeout: 5000, stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Parse the serials of attached, ready devices from `adb devices` output. Exported for testing.
 *
 * `adb devices` prints a header line then `<serial>\t<state>` rows. Only rows in the `device`
 * state are ready for logcat; `offline`, `unauthorized`, and `no permissions` rows are excluded so
 * the viewer never reports "streaming" for a device that cannot actually deliver logs.
 */
export function parseAdbDevices(stdout: string): string[] {
    return stdout
        .split(/\r?\n/)
        .slice(1) // drop the "List of devices attached" header
        .map((line) => line.trim())
        .filter((line) => /\tdevice$/.test(line))
        .map((line) => line.split(/\s+/)[0])
        .filter((serial) => serial.length > 0);
}

/**
 * List attached, ready device serials via `adb devices`. Async (execFile, 5s timeout) so a session
 * start never blocks the event loop on the subprocess; resolves to [] when adb is missing, errors,
 * or no device is ready. Used only to distinguish "streaming" from "idle" in the Filters panel.
 */
export function listAdbDevices(): Promise<string[]> {
    return new Promise((resolve) => {
        execFile('adb', ['devices'], { timeout: 5000 }, (err, stdout) => {
            if (err || typeof stdout !== 'string') { resolve([]); return; }
            resolve(parseAdbDevices(stdout));
        });
    });
}

/** Start adb logcat child process. Idempotent (stops previous if running). */
export function startLogcatCapture(options: LogcatCaptureOptions): void {
    stopLogcatCapture();

    filterByPid = options.filterByPid;
    captureDeviceOther = options.captureDeviceOther;
    captureAnr = options.captureAnr;
    minLevel = options.minLevel;
    maxBuffer = Math.max(1000, Math.min(500_000, options.maxBufferLines));
    lineCb = options.onLine;
    pidFilter = undefined;
    remainder = '';
    buffer = [];

    const args = buildAdbArgs(options.device, options.tagFilters);
    options.outputChannel.appendLine(`[adb-logcat] Starting: adb ${args.join(' ')}`);

    try {
        childProcess = spawn('adb', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        options.outputChannel.appendLine(`[adb-logcat] Failed to spawn: ${e}`);
        return;
    }

    childProcess.stdout?.setEncoding('utf-8');
    childProcess.stdout?.on('data', onStdoutData);

    childProcess.stderr?.setEncoding('utf-8');
    childProcess.stderr?.on('data', (data: string) => {
        options.outputChannel.appendLine(`[adb-logcat] stderr: ${data.trim()}`);
    });

    childProcess.on('error', (err) => {
        options.outputChannel.appendLine(`[adb-logcat] Process error: ${err.message}`);
    });

    childProcess.on('exit', (code) => {
        options.outputChannel.appendLine(`[adb-logcat] Exited (code ${code ?? 'null'})`);
        childProcess = undefined;
    });
}

/** Update PID filter (called when DAP process event arrives). */
export function setLogcatPidFilter(pid: number): void {
    pidFilter = pid;
}

/** Stop the adb logcat process and clear state. */
export function stopLogcatCapture(): void {
    if (childProcess) {
        childProcess.stdout?.removeAllListeners();
        childProcess.stderr?.removeAllListeners();
        childProcess.removeAllListeners();
        childProcess.kill();
        childProcess = undefined;
    }
    lineCb = undefined;
    remainder = '';
}

/** Get buffered lines snapshot (for sidecar writing). */
export function getLogcatBuffer(): readonly string[] {
    return [...buffer];
}

/** Clear the buffer (call after snapshotting for sidecar). */
export function clearLogcatBuffer(): void {
    buffer = [];
}

function buildAdbArgs(device: string, tagFilters: readonly string[]): string[] {
    const args: string[] = [];
    if (device) { args.push('-s', device); }
    args.push('logcat', '-v', 'threadtime');
    for (const f of tagFilters) {
        if (f.trim()) { args.push(f.trim()); }
    }
    return args;
}

function onStdoutData(chunk: string): void {
    const data = remainder + chunk;
    const lines = data.split('\n');
    remainder = lines.pop() ?? '';

    for (const raw of lines) {
        const trimmed = raw.trimEnd();
        if (!trimmed) { continue; }
        if (!acceptLine(trimmed)) { continue; }

        buffer.push(trimmed);
        if (buffer.length > maxBuffer) { buffer.shift(); }
        lineCb?.(trimmed);
    }
}

function acceptLine(raw: string): boolean {
    const parsed = parseLogcatLine(raw);
    if (!parsed) { return true; }
    return shouldAcceptLogcatLine(parsed, { minLevel, filterByPid, pidFilter, captureDeviceOther, captureAnr });
}

/** Filter inputs for {@link shouldAcceptLogcatLine} — a snapshot of the module's capture state. */
export interface LogcatLineFilter {
    readonly minLevel: string;
    readonly filterByPid: boolean;
    readonly pidFilter: number | undefined;
    readonly captureDeviceOther: boolean;
    readonly captureAnr: boolean;
}

/**
 * Decide whether a parsed logcat line is accepted. Pure (no module state) so the ANR-bypass
 * rule is unit-testable without spawning adb.
 *
 * ANR / native-crash evidence bypasses BOTH the level and PID gates: ActivityManager,
 * AndroidRuntime, and lowmemorykiller dump the "ANR in <pkg>" header and the frozen main-thread
 * stack from system_server — a DIFFERENT pid than the app — so PID scoping (on by default) would
 * hide exactly the richest ANR detail. When captureAnr is on (default), device-critical lines are
 * always kept regardless of level or pid. This is the concrete fix for the gap the adb-logcat
 * plan (§3.2) warned about: forced PID scoping drops cross-process ANR-killer lines.
 */
export function shouldAcceptLogcatLine(parsed: LogcatLine, f: LogcatLineFilter): boolean {
    const tier = getDeviceTier(parsed.tag);
    if (f.captureAnr && tier === 'device-critical') { return true; }
    if (!meetsMinLevel(parsed.level, f.minLevel)) { return false; }
    if (f.filterByPid && f.pidFilter !== undefined && parsed.pid !== f.pidFilter) { return false; }
    if (!f.captureDeviceOther && tier === 'device-other') { return false; }
    return true;
}

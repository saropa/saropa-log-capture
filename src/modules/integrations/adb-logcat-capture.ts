/**
 * Spawns and manages an `adb logcat` child process during a debug session.
 * Follows the terminal-capture / external-log-tailer pattern: module-level
 * state, start/stop functions, and a buffer snapshot for sidecar writing.
 */

import { spawn, execFileSync } from 'child_process';
import type { ChildProcess } from 'child_process';
import { parseLogcatLine, meetsMinLevel } from './adb-logcat-parser';

/** Options for starting logcat capture. */
export interface LogcatCaptureOptions {
    readonly device: string;
    readonly tagFilters: readonly string[];
    readonly minLevel: string;
    readonly filterByPid: boolean;
    readonly maxBufferLines: number;
    readonly outputChannel: { appendLine(msg: string): void };
    /** Called for each accepted logcat line (used to push into the active log session). */
    readonly onLine: (raw: string) => void;
}

let childProcess: ChildProcess | undefined;
let buffer: string[] = [];
let pidFilter: number | undefined;
let filterByPid = true;
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

/** Start adb logcat child process. Idempotent (stops previous if running). */
export function startLogcatCapture(options: LogcatCaptureOptions): void {
    stopLogcatCapture();

    filterByPid = options.filterByPid;
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
    if (!meetsMinLevel(parsed.level, minLevel)) { return false; }
    if (filterByPid && pidFilter !== undefined && parsed.pid !== pidFilter) { return false; }
    return true;
}

"use strict";
/**
 * Spawns and manages an `adb logcat` child process during a debug session.
 * Follows the terminal-capture / external-log-tailer pattern: module-level
 * state, start/stop functions, and a buffer snapshot for sidecar writing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdbAvailable = isAdbAvailable;
exports.startLogcatCapture = startLogcatCapture;
exports.setLogcatPidFilter = setLogcatPidFilter;
exports.stopLogcatCapture = stopLogcatCapture;
exports.getLogcatBuffer = getLogcatBuffer;
exports.clearLogcatBuffer = clearLogcatBuffer;
const child_process_1 = require("child_process");
const adb_logcat_parser_1 = require("./adb-logcat-parser");
const device_tag_tiers_1 = require("../analysis/device-tag-tiers");
let childProcess;
let buffer = [];
let pidFilter;
let filterByPid = true;
let captureDeviceOther = false;
let minLevel = 'V';
let maxBuffer = 50_000;
let remainder = '';
let lineCb;
/** Check if `adb` is available on PATH. */
function isAdbAvailable() {
    try {
        (0, child_process_1.execFileSync)('adb', ['version'], { timeout: 5000, stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
}
/** Start adb logcat child process. Idempotent (stops previous if running). */
function startLogcatCapture(options) {
    stopLogcatCapture();
    filterByPid = options.filterByPid;
    captureDeviceOther = options.captureDeviceOther;
    minLevel = options.minLevel;
    maxBuffer = Math.max(1000, Math.min(500_000, options.maxBufferLines));
    lineCb = options.onLine;
    pidFilter = undefined;
    remainder = '';
    buffer = [];
    const args = buildAdbArgs(options.device, options.tagFilters);
    options.outputChannel.appendLine(`[adb-logcat] Starting: adb ${args.join(' ')}`);
    try {
        childProcess = (0, child_process_1.spawn)('adb', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    }
    catch (e) {
        options.outputChannel.appendLine(`[adb-logcat] Failed to spawn: ${e}`);
        return;
    }
    childProcess.stdout?.setEncoding('utf-8');
    childProcess.stdout?.on('data', onStdoutData);
    childProcess.stderr?.setEncoding('utf-8');
    childProcess.stderr?.on('data', (data) => {
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
function setLogcatPidFilter(pid) {
    pidFilter = pid;
}
/** Stop the adb logcat process and clear state. */
function stopLogcatCapture() {
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
function getLogcatBuffer() {
    return [...buffer];
}
/** Clear the buffer (call after snapshotting for sidecar). */
function clearLogcatBuffer() {
    buffer = [];
}
function buildAdbArgs(device, tagFilters) {
    const args = [];
    if (device) {
        args.push('-s', device);
    }
    args.push('logcat', '-v', 'threadtime');
    for (const f of tagFilters) {
        if (f.trim()) {
            args.push(f.trim());
        }
    }
    return args;
}
function onStdoutData(chunk) {
    const data = remainder + chunk;
    const lines = data.split('\n');
    remainder = lines.pop() ?? '';
    for (const raw of lines) {
        const trimmed = raw.trimEnd();
        if (!trimmed) {
            continue;
        }
        if (!acceptLine(trimmed)) {
            continue;
        }
        buffer.push(trimmed);
        if (buffer.length > maxBuffer) {
            buffer.shift();
        }
        lineCb?.(trimmed);
    }
}
function acceptLine(raw) {
    const parsed = (0, adb_logcat_parser_1.parseLogcatLine)(raw);
    if (!parsed) {
        return true;
    }
    if (!(0, adb_logcat_parser_1.meetsMinLevel)(parsed.level, minLevel)) {
        return false;
    }
    if (filterByPid && pidFilter !== undefined && parsed.pid !== pidFilter) {
        return false;
    }
    if (!captureDeviceOther && (0, device_tag_tiers_1.getDeviceTier)(parsed.tag) === 'device-other') {
        return false;
    }
    return true;
}
//# sourceMappingURL=adb-logcat-capture.js.map
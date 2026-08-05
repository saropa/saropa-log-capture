/**
 * Capture self-test (plan 114 follow-up).
 *
 * WHY: a "no screenshots were captured" report used to be unanswerable from the artifacts —
 * the log recorded the session but nothing about whether capture was even possible, so each
 * report cost a round of live investigation. This probes every precondition once per session
 * and states the result in one line, in the log itself and the output channel.
 *
 * Every probe is soft: this is diagnostics, never a gate on capture. A probe that fails or
 * times out reports "unknown" rather than blocking or throwing.
 */

import { spawn } from 'node:child_process';

/** Probing must never delay session start; adb answers in milliseconds when present. */
const PROBE_TIMEOUT_MS = 3000;

/** Outcome of the preconditions probe. */
export interface ScreenshotSelfTest {
    /** Master toggle (`integrations.screenshots.enabled`). */
    readonly enabled: boolean;
    /** Trigger summary, e.g. "errors" or "errors+warnings". */
    readonly triggers: string;
    /** adb version string, or undefined when adb is unreachable. */
    readonly adbVersion?: string;
    /** Serials of attached, ready devices. */
    readonly devices: readonly string[];
}

/** Render the self-test as the single line written to the log header and output channel. */
export function formatSelfTest(t: ScreenshotSelfTest): string {
    if (!t.enabled) {
        return 'Screenshots: OFF (enable in Options → Integrations → Debug Screenshots)';
    }
    const parts = [`triggers ${t.triggers}`];
    parts.push(t.adbVersion ? `adb ${t.adbVersion}` : 'adb NOT FOUND (device capture unavailable)');
    if (t.devices.length === 1) {
        parts.push(`device ${t.devices[0]}`);
    } else if (t.devices.length === 0) {
        parts.push('NO DEVICE attached');
    } else {
        // Multiple devices: capture targets the adbLogcat device setting, blank = adb's default.
        parts.push(`devices ${t.devices.join(', ')} (set integrations.adbLogcat.device to choose)`);
    }
    return `Screenshots: on · ${parts.join(' · ')}`;
}

/** Run one adb subcommand, resolving to its trimmed stdout or undefined on any failure. */
function adb(args: readonly string[]): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
        let settled = false;
        const finish = (value: string | undefined): void => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => {
            try { child.kill(); } catch { /* already gone */ }
            finish(undefined);
        }, PROBE_TIMEOUT_MS);
        const child = spawn('adb', [...args], { windowsHide: true });
        const out: Buffer[] = [];
        child.stdout.on('data', (c: Buffer) => { if (out.length < 64) { out.push(c); } });
        child.on('error', () => finish(undefined));
        child.on('close', (code) => finish(code === 0 ? Buffer.concat(out).toString().trim() : undefined));
    });
}

/** Parse `adb devices` output into the serials that are actually ready. */
export function parseAdbDevices(stdout: string): string[] {
    return stdout.split(/\r?\n/)
        .slice(1) // drop the "List of devices attached" banner
        .map((l) => l.trim())
        .filter((l) => /\tdevice$/.test(l))
        .map((l) => l.split(/\s+/)[0]);
}

/** Probe the capture preconditions. Never throws; unreachable probes report as absent. */
export async function runScreenshotSelfTest(
    enabled: boolean,
    triggers: string,
): Promise<ScreenshotSelfTest> {
    if (!enabled) { return { enabled, triggers, devices: [] }; }
    const [versionOut, devicesOut] = await Promise.all([adb(['version']), adb(['devices'])]);
    // `adb version` prints "Android Debug Bridge version 1.0.41" plus build lines.
    const version = versionOut?.split(/\r?\n/)[0]?.match(/version\s+([\d.]+)/)?.[1];
    return {
        enabled,
        triggers,
        adbVersion: version,
        devices: devicesOut ? parseAdbDevices(devicesOut) : [],
    };
}

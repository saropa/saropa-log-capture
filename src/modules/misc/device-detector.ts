/** Detect target device/emulator from debug session launch config and output. */

import * as vscode from 'vscode';

/** Config keys that commonly hold a device identifier. */
const deviceConfigKeys = ['deviceId', 'device', 'target', 'deviceName'] as const;

/** Detect device identifier from launch configuration properties. */
export function detectDeviceFromConfig(config: Record<string, unknown>): string | undefined {
    for (const key of deviceConfigKeys) {
        const val = config[key];
        if (typeof val === 'string' && val.trim()) { return val.trim(); }
    }
    return undefined;
}

/** Regex for Flutter's "Launching ... on DEVICE_NAME in MODE mode" output. */
const launchOnDeviceRe = /^Launching\s.+?\son\s(.+?)\sin\s(?:debug|profile|release)\smode/;

/** Parse device name from a Flutter launch output line. */
export function detectDeviceFromOutput(text: string): string | undefined {
    const m = launchOnDeviceRe.exec(text.trim());
    return m ? m[1].trim() : undefined;
}

const headerDeviceIdRe = /^deviceId:\s+(.+)/;
const maxScanLines = 40;

/** Scan a log file for target device info (launch config header + early output). */
export async function detectTargetDevice(fileUri: vscode.Uri): Promise<string | undefined> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n', maxScanLines);
    for (const line of lines) {
        const trimmed = line.trim();
        const fromOutput = detectDeviceFromOutput(trimmed);
        if (fromOutput) { return fromOutput; }
        const headerMatch = headerDeviceIdRe.exec(trimmed);
        if (headerMatch) { return headerMatch[1].trim(); }
    }
    return undefined;
}

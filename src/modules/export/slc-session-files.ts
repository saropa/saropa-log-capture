/**
 * Helpers to find session-related files: sidecars and split part logs.
 */

import * as vscode from 'vscode';

/** Known sidecar extensions from integration providers. */
export const SIDECAR_EXTENSIONS = [
    '.perf.json',
    '.terminal.log',
    '.events.json',
    '.container.log',
    '.crash-dumps.json',
    '.linux.log',
    '.requests.json',
    '.queries.json',
    '.browser.json',
    '.security.json',
    '.audit.json',
    '.unified.jsonl',
];

/**
 * Find integration sidecar files for a session log file.
 * Sidecars are named basename.{type}.{ext} (e.g. session.perf.json, session.terminal.log).
 */
export async function findSidecarUris(mainLogUri: vscode.Uri): Promise<vscode.Uri[]> {
    const dir = vscode.Uri.joinPath(mainLogUri, '..');
    const mainName = mainLogUri.path.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) { return []; }
    const base = baseMatch[1];
    const results: vscode.Uri[] = [];
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
        return [];
    }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File) { continue; }
        if (!name.startsWith(base + '.')) { continue; }
        const isSidecar = SIDECAR_EXTENSIONS.some(ext => name.endsWith(ext));
        if (isSidecar) {
            results.push(vscode.Uri.joinPath(dir, name));
        }
    }
    results.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return results;
}

/**
 * Find split part log files for a main log file (e.g. base_002.log, base_003.log).
 * Main file is e.g. base.log or base_001.log; we look for base_002.log, base_003.log, ...
 */
export async function findSplitPartUris(mainLogUri: vscode.Uri): Promise<vscode.Uri[]> {
    const dir = vscode.Uri.joinPath(mainLogUri, '..');
    const mainName = mainLogUri.path.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) { return []; }
    const base = baseMatch[1];
    const partPrefix = `${base}_`;
    const partRegex = /^(.+)_(\d{3})\.log$/i;
    const results: vscode.Uri[] = [];
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
        return [];
    }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.startsWith(partPrefix) || !name.endsWith('.log')) {
            continue;
        }
        const m = name.match(partRegex);
        if (!m || m[1] !== base) { continue; }
        const num = parseInt(m[2], 10);
        if (num >= 2) {
            results.push(vscode.Uri.joinPath(dir, name));
        }
    }
    results.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return results;
}

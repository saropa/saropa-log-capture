/** CodeLens provider that shows Crashlytics crash indicators on affected source files. */

import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../modules/config';

/** Cached mapping: filename → { issueCount, totalEvents, totalUsers }. */
let crashIndex: Map<string, CrashFileInfo> | undefined;
let indexBuiltAt = 0;
const indexTtl = 5 * 60_000;

interface CrashFileInfo {
    readonly issueCount: number;
    readonly totalEvents: number;
    readonly totalUsers: number;
}

/** CodeLens provider showing Crashlytics production crash indicators on source files. */
export class CrashlyticsCodeLensProvider implements vscode.CodeLensProvider {
    private readonly _onChange = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onChange.event;

    /** Invalidate the index (e.g., after a new Crashlytics query). */
    invalidate(): void {
        crashIndex = undefined;
        this._onChange.fire();
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const filename = document.uri.fsPath.split(/[\\/]/).pop();
        if (!filename) { return []; }
        const index = await getOrBuildIndex();
        const info = index.get(filename);
        if (!info) { return []; }
        const range = new vscode.Range(0, 0, 0, 0);
        const label = `Crashlytics: ${info.issueCount} issue${info.issueCount !== 1 ? 's' : ''}, ${info.totalEvents} cached event${info.totalEvents !== 1 ? 's' : ''}`;
        return [new vscode.CodeLens(range, { title: label, command: '' })];
    }
}

async function getOrBuildIndex(): Promise<Map<string, CrashFileInfo>> {
    if (crashIndex && Date.now() - indexBuiltAt < indexTtl) { return crashIndex; }
    crashIndex = await buildIndexFromCache();
    indexBuiltAt = Date.now();
    return crashIndex;
}

function getCrashlyticsDir(): vscode.Uri | undefined {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return undefined; }
    return vscode.Uri.joinPath(getLogDirectoryUri(ws), '.crashlytics');
}

async function buildIndexFromCache(): Promise<Map<string, CrashFileInfo>> {
    const index = new Map<string, CrashFileInfo>();
    const cacheDir = getCrashlyticsDir();
    if (!cacheDir) { return index; }
    let entries: [string, vscode.FileType][];
    try { entries = await vscode.workspace.fs.readDirectory(cacheDir); } catch { return index; }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.endsWith('.json')) { continue; }
        try {
            const raw = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(cacheDir, name));
            const data = JSON.parse(Buffer.from(raw).toString('utf-8'));
            const events = Array.isArray(data.events) ? data.events : [data];
            const eventCount = events.length;
            // Collect all filenames touched by any event in this issue
            const issueFiles = new Set<string>();
            for (const event of events) { extractFilenames(event).forEach(fn => issueFiles.add(fn)); }
            issueFiles.forEach(fn => {
                const prev = index.get(fn) ?? { issueCount: 0, totalEvents: 0, totalUsers: 0 };
                index.set(fn, { issueCount: prev.issueCount + 1, totalEvents: prev.totalEvents + eventCount, totalUsers: prev.totalUsers });
            });
        } catch { /* skip corrupt cache files */ }
    }
    return index;
}

function extractFilenames(event: Record<string, unknown>): Set<string> {
    const names = new Set<string>();
    const thread = event.crashThread as Record<string, unknown> | undefined;
    if (!thread) { return names; }
    const frames = thread.frames as readonly Record<string, unknown>[] | undefined;
    if (!Array.isArray(frames)) { return names; }
    for (const f of frames) {
        const fileName = f.fileName as string | undefined;
        if (fileName) { names.add(fileName); }
    }
    return names;
}

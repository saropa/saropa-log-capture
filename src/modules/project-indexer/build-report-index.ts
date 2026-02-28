/**
 * Build the reports source index from the central session metadata store.
 * Reads .session-metadata.json (no per-file .meta.json sidecars).
 */

import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../config/config';
import type { ReportIndexEntry, SourceIndexFile } from './project-indexer';

const INDEX_VERSION = 1;

type MetaMap = Record<string, { trashed?: boolean; correlationTags?: string[]; fingerprints?: Array<{ n: string }>; displayName?: string; tags?: string[]; errorCount?: number; warningCount?: number }>;

/** Build the reports source index from central .session-metadata.json. Skips trashed and active session. */
export async function buildReportIndex(
    workspaceFolder: vscode.WorkspaceFolder,
    getActiveLogUri?: () => vscode.Uri | undefined,
): Promise<SourceIndexFile> {
    const logDir = getLogDirectoryUri(workspaceFolder);
    const centralUri = vscode.Uri.joinPath(logDir, '.session-metadata.json');
    const activeUri = getActiveLogUri?.();
    const entries: ReportIndexEntry[] = [];
    let data: MetaMap = {};
    try {
        const raw = await vscode.workspace.fs.readFile(centralUri);
        data = JSON.parse(Buffer.from(raw).toString('utf-8')) as MetaMap;
    } catch { return { version: INDEX_VERSION, sourceId: 'reports', buildTime: Date.now(), files: entries }; }

    for (const key of Object.keys(data)) {
        const meta = data[key];
        if (!meta || meta.trashed) { continue; }
        const logUri = vscode.Uri.joinPath(workspaceFolder.uri, key);
        if (activeUri && logUri.toString() === activeUri.toString()) { continue; }
        try {
            const stat = await vscode.workspace.fs.stat(logUri);
            const fingerprints = (meta.fingerprints ?? []).map((fp) => fp.n);
            entries.push({
                relativePath: key.replace(/\\/g, '/'),
                uri: logUri.toString(),
                sizeBytes: stat.size,
                mtime: stat.mtime,
                displayName: meta.displayName,
                tags: meta.tags,
                correlationTokens: meta.correlationTags ?? [],
                fingerprints,
                errorCount: meta.errorCount,
                warningCount: meta.warningCount,
            });
        } catch { /* log file gone */ }
    }
    return { version: INDEX_VERSION, sourceId: 'reports', buildTime: Date.now(), files: entries };
}

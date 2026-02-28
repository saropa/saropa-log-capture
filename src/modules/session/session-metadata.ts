import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from '../config/config';
import type { FingerprintEntry } from '../analysis/error-fingerprint';
import type { PerfFingerprintEntry } from '../misc/perf-fingerprint';

/** A single annotation attached to a log line. */
export interface Annotation {
    readonly lineIndex: number;
    readonly text: string;
    readonly timestamp: string;
}

/** Metadata for a log session. Stored in <logDir>/.session-metadata.json (not sidecars). */
export interface SessionMeta {
    displayName?: string;
    /** Manually applied tags. */
    tags?: string[];
    /** Automatically applied tags from auto-tag rules. */
    autoTags?: string[];
    /** Semantic tags extracted from log content (source files, error classes). */
    correlationTags?: string[];
    /** Error fingerprints extracted from log content. */
    fingerprints?: FingerprintEntry[];
    /** Performance fingerprints extracted from log content. */
    perfFingerprints?: PerfFingerprintEntry[];
    annotations?: Annotation[];
    /** Cached severity line counts from content scanning. */
    errorCount?: number;
    warningCount?: number;
    perfCount?: number;
    anrCount?: number;
    fwCount?: number;
    infoCount?: number;
    /** ANR risk level computed by anr-risk-scorer.ts on session finalization. */
    anrRiskLevel?: 'low' | 'medium' | 'high';
    /** App version detected at session finalization (e.g. from pubspec.yaml). */
    appVersion?: string;
    /** Debug adapter type used for this session (e.g. "dart", "node", "python"). */
    debugAdapterType?: string;
    /** Target device or emulator detected from launch config or output. */
    debugTarget?: string;
    /** Hidden from the Project Logs tree; permanently deleted on "Empty Trash". */
    trashed?: boolean;
}

type MetaMap = Record<string, SessionMeta>;

const maxScanDepth = 10;

/**
 * Migrate .meta.json sidecars in a given directory into the central metadata store.
 * When workspaceFolder is provided, all metadata goes in configured log dir's .session-metadata.json
 * (keys = workspace-relative paths). When not (e.g. single-folder workspace), uses logDir/.session-metadata.json.
 * @returns Number of sidecar files migrated and removed.
 */
export async function migrateSidecarsInDirectory(
    logDir: vscode.Uri,
    workspaceFolder?: vscode.WorkspaceFolder,
): Promise<number> {
    const { fileTypes, includeSubfolders } = getConfig();
    const sidecarRels = await listMetaJsonFiles(logDir, includeSubfolders ? maxScanDepth : 0, '');
    const centralUri = workspaceFolder
        ? vscode.Uri.joinPath(getLogDirectoryUri(workspaceFolder), '.session-metadata.json')
        : vscode.Uri.joinPath(logDir, '.session-metadata.json');
    let data: MetaMap = {};
    try {
        const raw = await vscode.workspace.fs.readFile(centralUri);
        data = JSON.parse(Buffer.from(raw).toString('utf-8')) as MetaMap;
    } catch { /* no central file yet */ }
    let migrated = 0;
    for (const rel of sidecarRels) {
        const base = rel.replace(/\.meta\.json$/i, '');
        let logRel: string | undefined;
        for (const ext of fileTypes) {
            const e = ext.startsWith('.') ? ext : `.${ext}`;
            const candidate = base + e;
            try {
                await vscode.workspace.fs.stat(vscode.Uri.joinPath(logDir, candidate));
                logRel = candidate.replace(/\\/g, '/');
                break;
            } catch { /* try next */ }
        }
        if (!logRel) { continue; }
        const logUri = vscode.Uri.joinPath(logDir, logRel);
        const key = vscode.workspace.asRelativePath(logUri).replace(/\\/g, '/');
        const sidecarUri = vscode.Uri.joinPath(logDir, rel);
        try {
            const raw = await vscode.workspace.fs.readFile(sidecarUri);
            const meta = JSON.parse(Buffer.from(raw).toString('utf-8')) as SessionMeta;
            data[key] = meta;
            await vscode.workspace.fs.delete(sidecarUri);
            migrated++;
        } catch { /* skip broken or locked files */ }
    }
    if (migrated > 0) {
        const dir = vscode.Uri.joinPath(centralUri, '..');
        try { await vscode.workspace.fs.createDirectory(dir); } catch { /* may exist */ }
        await vscode.workspace.fs.writeFile(centralUri, Buffer.from(JSON.stringify(data, null, 2), 'utf-8'));
    }
    return migrated;
}

/** Migrate sidecars in the configured log dir. Convenience for migrateSidecarsInDirectory(getLogDirectoryUri(folder)). */
export async function migrateAllSidecarsToCentral(workspaceFolder: vscode.WorkspaceFolder): Promise<number> {
    return migrateSidecarsInDirectory(getLogDirectoryUri(workspaceFolder));
}

async function listMetaJsonFiles(dir: vscode.Uri, depth: number, prefix: string): Promise<string[]> {
    let entries: [string, vscode.FileType][];
    try { entries = await vscode.workspace.fs.readDirectory(dir); } catch { return []; }
    const results: string[] = [];
    for (const [name, type] of entries) {
        const rel = prefix ? `${prefix}/${name}` : name;
        if (type === vscode.FileType.File && name.toLowerCase().endsWith('.meta.json')) {
            results.push(rel);
        } else if (depth > 0 && type === vscode.FileType.Directory && !name.startsWith('.')) {
            results.push(...await listMetaJsonFiles(vscode.Uri.joinPath(dir, name), depth - 1, rel));
        }
    }
    return results;
}

/** Manages session metadata in <logDir>/.session-metadata.json (no sidecars in log dir). */
export class SessionMetadataStore {

    /** URI of the central metadata file (for backward compat / tests). Same for all log files. */
    getMetaUri(logUri: vscode.Uri): vscode.Uri {
        const central = this.getCentralMetaUri(logUri);
        return central ?? this.fallbackSidecarUri(logUri);
    }

    /** Load metadata for a log file. Uses central store when in a workspace; else sidecar. Migrates from sidecar on first read. */
    async loadMetadata(logUri: vscode.Uri): Promise<SessionMeta> {
        const centralUri = this.getCentralMetaUri(logUri);
        if (!centralUri) { return this.loadSidecar(logUri); }
        const key = this.relativeKey(logUri);
        const data = await this.readCentral(centralUri);
        let meta = data[key] ? { ...data[key] } : {};
        if (Object.keys(meta).length === 0) {
            meta = await this.migrateSidecarToCentral(logUri, centralUri, key, data);
        }
        return meta;
    }

    private async migrateSidecarToCentral(logUri: vscode.Uri, centralUri: vscode.Uri, key: string, data: MetaMap): Promise<SessionMeta> {
        const sidecar = await this.loadSidecar(logUri);
        if (Object.keys(sidecar).length === 0) { return {}; }
        data[key] = sidecar;
        await this.writeCentral(centralUri, data);
        try { await vscode.workspace.fs.delete(this.fallbackSidecarUri(logUri)); } catch { /* ignore */ }
        return sidecar;
    }

    /** Save metadata for a log file. */
    async saveMetadata(logUri: vscode.Uri, meta: SessionMeta): Promise<void> {
        const centralUri = this.getCentralMetaUri(logUri);
        if (centralUri) {
            const key = this.relativeKey(logUri);
            const data = await this.readCentral(centralUri);
            data[key] = meta;
            await this.writeCentral(centralUri, data);
            return;
        }
        await this.saveSidecar(logUri, meta);
    }

    /** Remove metadata for a log file (e.g. after permanent delete or rename). */
    async deleteMetadata(logUri: vscode.Uri): Promise<void> {
        const centralUri = this.getCentralMetaUri(logUri);
        if (centralUri) {
            const key = this.relativeKey(logUri);
            const data = await this.readCentral(centralUri);
            delete data[key];
            await this.writeCentral(centralUri, data);
            return;
        }
        try {
            await vscode.workspace.fs.delete(this.fallbackSidecarUri(logUri));
        } catch { /* sidecar may not exist */ }
    }

    async setDisplayName(logUri: vscode.Uri, name: string): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.displayName = name;
        await this.saveMetadata(logUri, meta);
    }

    async setTags(logUri: vscode.Uri, tags: string[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.tags = tags;
        await this.saveMetadata(logUri, meta);
    }

    async setAutoTags(logUri: vscode.Uri, autoTags: string[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.autoTags = autoTags;
        await this.saveMetadata(logUri, meta);
    }

    async setCorrelationTags(logUri: vscode.Uri, correlationTags: string[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.correlationTags = correlationTags;
        await this.saveMetadata(logUri, meta);
    }

    async setFingerprints(logUri: vscode.Uri, fingerprints: FingerprintEntry[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.fingerprints = fingerprints;
        await this.saveMetadata(logUri, meta);
    }

    async setPerfFingerprints(logUri: vscode.Uri, perfFingerprints: PerfFingerprintEntry[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.perfFingerprints = perfFingerprints;
        await this.saveMetadata(logUri, meta);
    }

    async setAppVersion(logUri: vscode.Uri, version: string): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.appVersion = version;
        await this.saveMetadata(logUri, meta);
    }

    async setTrashed(logUri: vscode.Uri, trashed: boolean): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        if (trashed) { meta.trashed = true; } else { delete meta.trashed; }
        await this.saveMetadata(logUri, meta);
    }

    async addAnnotation(logUri: vscode.Uri, annotation: Annotation): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        if (!meta.annotations) { meta.annotations = []; }
        meta.annotations.push(annotation);
        await this.saveMetadata(logUri, meta);
    }

    async getAnnotations(logUri: vscode.Uri): Promise<readonly Annotation[]> {
        const meta = await this.loadMetadata(logUri);
        return meta.annotations ?? [];
    }

    /**
     * Rename the log file on disk and move its metadata to the new key.
     * @returns The new URI of the renamed log file, or the original if rename failed.
     */
    async renameLogFile(logUri: vscode.Uri, newDisplayName: string): Promise<vscode.Uri> {
        const oldPath = logUri.fsPath;
        const separator = oldPath.includes('\\') ? '\\' : '/';
        const lastSepIndex = oldPath.lastIndexOf(separator);
        const dirPath = oldPath.substring(0, lastSepIndex + 1);
        const oldFilename = oldPath.substring(lastSepIndex + 1);

        const prefixMatch = oldFilename.match(/^(\d{8}_(?:\d{6}|\d{2}-\d{2}(?:-\d{2})?)_)/);
        const prefix = prefixMatch ? prefixMatch[1] : '';
        const safeName = newDisplayName.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim();
        if (!safeName) { return logUri; }

        const extMatch = oldFilename.match(/\.[a-z]+$/i);
        const ext = extMatch ? extMatch[0] : '.log';
        const newFilename = `${prefix}${safeName}${ext}`;
        if (newFilename === oldFilename) { return logUri; }

        const newLogUri = vscode.Uri.file(`${dirPath}${newFilename}`);

        try {
            try {
                await vscode.workspace.fs.stat(newLogUri);
                vscode.window.showWarningMessage(`Cannot rename: "${newFilename}" already exists.`);
                return logUri;
            } catch { /* good */ }

            const meta = await this.loadMetadata(logUri);
            await vscode.workspace.fs.rename(logUri, newLogUri);
            if (Object.keys(meta).length > 0) {
                await this.saveMetadata(newLogUri, meta);
                await this.deleteMetadata(logUri);
            }
            return newLogUri;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to rename log file: ${msg}`);
            return logUri;
        }
    }

    private getCentralMetaUri(logUri: vscode.Uri): vscode.Uri | undefined {
        const folder = vscode.workspace.getWorkspaceFolder(logUri) ?? vscode.workspace.workspaceFolders?.[0];
        if (!folder) { return undefined; }
        const logDir = getLogDirectoryUri(folder);
        return vscode.Uri.joinPath(logDir, '.session-metadata.json');
    }

    private relativeKey(logUri: vscode.Uri): string {
        return vscode.workspace.asRelativePath(logUri).replace(/\\/g, '/');
    }

    private fallbackSidecarUri(logUri: vscode.Uri): vscode.Uri {
        const str = logUri.toString();
        const dotIdx = str.lastIndexOf('.');
        if (dotIdx === -1) { return vscode.Uri.parse(str + '.meta.json'); }
        return vscode.Uri.parse(str.slice(0, dotIdx) + '.meta.json');
    }

    private async readCentral(uri: vscode.Uri): Promise<MetaMap> {
        try {
            const data = await vscode.workspace.fs.readFile(uri);
            return JSON.parse(Buffer.from(data).toString('utf-8')) as MetaMap;
        } catch {
            return {};
        }
    }

    private async writeCentral(uri: vscode.Uri, data: MetaMap): Promise<void> {
        const dir = vscode.Uri.joinPath(uri, '..');
        try { await vscode.workspace.fs.createDirectory(dir); } catch { /* may exist */ }
        const json = JSON.stringify(data, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
    }

    private async loadSidecar(logUri: vscode.Uri): Promise<SessionMeta> {
        const metaUri = this.fallbackSidecarUri(logUri);
        try {
            const data = await vscode.workspace.fs.readFile(metaUri);
            return JSON.parse(Buffer.from(data).toString('utf-8')) as SessionMeta;
        } catch {
            return {};
        }
    }

    private async saveSidecar(logUri: vscode.Uri, meta: SessionMeta): Promise<void> {
        const metaUri = this.fallbackSidecarUri(logUri);
        const json = JSON.stringify(meta, null, 2);
        await vscode.workspace.fs.writeFile(metaUri, Buffer.from(json, 'utf-8'));
    }
}

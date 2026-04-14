import * as vscode from 'vscode';
import { t } from '../../l10n';
import { getLogDirectoryUri } from '../config/config';
import type { FingerprintEntry } from '../analysis/error-fingerprint';
import { parseJSONOrDefault } from '../misc/safe-json';
import { logExtensionError } from '../misc/extension-logger';
import type { PerfFingerprintEntry } from '../misc/perf-fingerprint';
import type { PersistedDriftSqlFingerprintSummaryV1 } from '../db/drift-sql-fingerprint-summary-persist';
import type { PersistedSignalSummaryV1 } from '../root-cause-hints/signal-summary-types';

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
    /** Warning fingerprints extracted from log content (mirrors error fingerprints for warnings). */
    warningFingerprints?: FingerprintEntry[];
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
    /** Integration provider payloads keyed by provider id (e.g. buildCi, windowsEvents). */
    integrations?: Record<string, unknown>;
    /** Drift `Sent` SQL fingerprint rollup (plan DB_10); validate `schemaVersion` on read. */
    driftSqlFingerprintSummary?: PersistedDriftSqlFingerprintSummaryV1;
    /** Signal summary from root-cause hints bundle; validate `schemaVersion` on read. */
    signalSummary?: PersistedSignalSummaryV1;
}

type MetaMap = Record<string, SessionMeta>;

/**
 * Whether performance integration payload contains meaningful session-level data.
 * Used for UI affordances (session badges/chips), so empty placeholder objects should not count.
 */
export function hasMeaningfulPerformanceData(perf: unknown): boolean {
    if (!perf || typeof perf !== 'object') { return false; }
    const data = perf as Record<string, unknown>;
    if (typeof data.samplesFile === 'string' && data.samplesFile.trim().length > 0) { return true; }
    const snap = data.snapshot as Record<string, unknown> | undefined;
    if (!snap || typeof snap !== 'object') { return false; }
    return (
        typeof snap.cpus === 'number' ||
        typeof snap.totalMemMb === 'number' ||
        typeof snap.freeMemMb === 'number' ||
        typeof snap.processMemMb === 'number'
    );
}

export { migrateSidecarsInDirectory, migrateAllSidecarsToCentral, isOurSidecar } from './session-metadata-migration';

/** Manages session metadata in <logDir>/.session-metadata.json (no sidecars in log dir). */
export class SessionMetadataStore {

    /** URI of the central metadata file. Returns undefined if no workspace folder is available. */
    getMetaUri(logUri: vscode.Uri): vscode.Uri | undefined {
        return this.getCentralMetaUri(logUri);
    }

    /** Load metadata for a log file from central store. Migrates legacy sidecar on first read. */
    async loadMetadata(logUri: vscode.Uri): Promise<SessionMeta> {
        const centralUri = this.getCentralMetaUri(logUri);
        if (!centralUri) { return {}; }
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

    /** Save metadata for a log file. Writes to central store only; never creates sidecar files. */
    async saveMetadata(logUri: vscode.Uri, meta: SessionMeta): Promise<void> {
        const centralUri = this.getCentralMetaUri(logUri);
        if (!centralUri) { return; }
        const key = this.relativeKey(logUri);
        const data = await this.readCentral(centralUri);
        data[key] = meta;
        await this.writeCentral(centralUri, data);
    }

    /** Remove metadata for a log file (e.g. after permanent delete or rename). */
    async deleteMetadata(logUri: vscode.Uri): Promise<void> {
        const centralUri = this.getCentralMetaUri(logUri);
        if (!centralUri) { return; }
        const key = this.relativeKey(logUri);
        const data = await this.readCentral(centralUri);
        delete data[key];
        await this.writeCentral(centralUri, data);
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

    async setDriftSqlFingerprintSummary(
        logUri: vscode.Uri,
        summary: PersistedDriftSqlFingerprintSummaryV1,
    ): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.driftSqlFingerprintSummary = summary;
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
                vscode.window.showWarningMessage(t('msg.cannotRenameExists', newFilename));
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
            logExtensionError('renameLogFile', err instanceof Error ? err : new Error(msg));
            vscode.window.showErrorMessage(t('msg.failedRenameLogFile', msg));
            return logUri;
        }
    }

    /**
     * Read the central metadata file once and return all entries keyed by relative path.
     * Used by SessionHistoryProvider to avoid N reads per refresh cycle.
     */
    async loadAllMetadata(logDir: vscode.Uri): Promise<ReadonlyMap<string, SessionMeta>> {
        const folder = vscode.workspace.getWorkspaceFolder(logDir) ?? vscode.workspace.workspaceFolders?.[0];
        if (!folder) { return new Map(); }
        const centralUri = vscode.Uri.joinPath(getLogDirectoryUri(folder), '.session-metadata.json');
        const data = await this.readCentral(centralUri);
        return new Map(Object.entries(data));
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
            const parsed = parseJSONOrDefault<MetaMap>(Buffer.from(data), {});
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
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

    /** Read a legacy .meta.json sidecar (migration only — never written by new code). */
    private async loadSidecar(logUri: vscode.Uri): Promise<SessionMeta> {
        const metaUri = this.fallbackSidecarUri(logUri);
        try {
            const data = await vscode.workspace.fs.readFile(metaUri);
            const parsed = parseJSONOrDefault<SessionMeta>(Buffer.from(data), {});
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    }
}

import * as vscode from 'vscode';
import type { FingerprintEntry } from './error-fingerprint';

/** A single annotation attached to a log line. */
export interface Annotation {
    readonly lineIndex: number;
    readonly text: string;
    readonly timestamp: string;
}

/** Metadata stored alongside a log file as a sidecar .meta.json. */
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
    annotations?: Annotation[];
    /** Cached severity line counts from content scanning. */
    errorCount?: number;
    warningCount?: number;
    perfCount?: number;
    anrCount?: number;
    /** ANR risk level computed by anr-risk-scorer.ts on session finalization. */
    anrRiskLevel?: 'low' | 'medium' | 'high';
    /** App version detected at session finalization (e.g. from pubspec.yaml). */
    appVersion?: string;
    /** Hidden from the Project Logs tree; permanently deleted on "Empty Trash". */
    trashed?: boolean;
}

/** Manages sidecar .meta.json files alongside .log files. */
export class SessionMetadataStore {

    /** Get the URI for the sidecar metadata file. */
    getMetaUri(fileUri: vscode.Uri): vscode.Uri {
        const str = fileUri.toString();
        const dotIdx = str.lastIndexOf('.');
        if (dotIdx === -1) { return vscode.Uri.parse(str + '.meta.json'); }
        return vscode.Uri.parse(str.slice(0, dotIdx) + '.meta.json');
    }

    /** Load metadata from the sidecar file, returning empty object if missing. */
    async loadMetadata(logUri: vscode.Uri): Promise<SessionMeta> {
        const metaUri = this.getMetaUri(logUri);
        try {
            const data = await vscode.workspace.fs.readFile(metaUri);
            return JSON.parse(Buffer.from(data).toString('utf-8')) as SessionMeta;
        } catch {
            return {};
        }
    }

    /** Save metadata to the sidecar file. */
    async saveMetadata(logUri: vscode.Uri, meta: SessionMeta): Promise<void> {
        const metaUri = this.getMetaUri(logUri);
        const json = JSON.stringify(meta, null, 2);
        await vscode.workspace.fs.writeFile(metaUri, Buffer.from(json, 'utf-8'));
    }

    /** Set or update the display name. */
    async setDisplayName(logUri: vscode.Uri, name: string): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.displayName = name;
        await this.saveMetadata(logUri, meta);
    }

    /** Set or update manual tags. */
    async setTags(logUri: vscode.Uri, tags: string[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.tags = tags;
        await this.saveMetadata(logUri, meta);
    }

    /** Set or update auto-tags (from auto-tag rules). */
    async setAutoTags(logUri: vscode.Uri, autoTags: string[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.autoTags = autoTags;
        await this.saveMetadata(logUri, meta);
    }

    /** Set or update correlation tags (from content scanning). */
    async setCorrelationTags(logUri: vscode.Uri, correlationTags: string[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.correlationTags = correlationTags;
        await this.saveMetadata(logUri, meta);
    }

    /** Set or update error fingerprints (from content scanning). */
    async setFingerprints(logUri: vscode.Uri, fingerprints: FingerprintEntry[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.fingerprints = fingerprints;
        await this.saveMetadata(logUri, meta);
    }

    /** Set the detected app version for this session. */
    async setAppVersion(logUri: vscode.Uri, version: string): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.appVersion = version;
        await this.saveMetadata(logUri, meta);
    }

    /** Mark or unmark a session as trashed. */
    async setTrashed(logUri: vscode.Uri, trashed: boolean): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        if (trashed) { meta.trashed = true; } else { delete meta.trashed; }
        await this.saveMetadata(logUri, meta);
    }

    /** Add an annotation to a specific line. */
    async addAnnotation(logUri: vscode.Uri, annotation: Annotation): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        if (!meta.annotations) {
            meta.annotations = [];
        }
        meta.annotations.push(annotation);
        await this.saveMetadata(logUri, meta);
    }

    /** Get all annotations for a log file. */
    async getAnnotations(logUri: vscode.Uri): Promise<readonly Annotation[]> {
        const meta = await this.loadMetadata(logUri);
        return meta.annotations ?? [];
    }

    /**
     * Rename the log file on disk to match the display name.
     * Preserves the date/time prefix from the original filename.
     * Also renames the sidecar .meta.json file.
     * @returns The new URI of the renamed log file, or the original if rename failed.
     */
    async renameLogFile(logUri: vscode.Uri, newDisplayName: string): Promise<vscode.Uri> {
        const oldPath = logUri.fsPath;
        const separator = oldPath.includes('\\') ? '\\' : '/';
        const lastSepIndex = oldPath.lastIndexOf(separator);
        const dirPath = oldPath.substring(0, lastSepIndex + 1);
        const oldFilename = oldPath.substring(lastSepIndex + 1);

        // Extract date/time prefix (YYYYMMDD_HHMMSS_ or legacy YYYYMMDD_HH-MM[-SS]_)
        const prefixMatch = oldFilename.match(/^(\d{8}_(?:\d{6}|\d{2}-\d{2}(?:-\d{2})?)_)/);
        const prefix = prefixMatch ? prefixMatch[1] : '';

        // Sanitize the new display name for use as filename
        const safeName = newDisplayName.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim();
        if (!safeName) {
            return logUri; // No valid name, keep original
        }

        const extMatch = oldFilename.match(/\.[a-z]+$/i);
        const ext = extMatch ? extMatch[0] : '.log';
        const newFilename = `${prefix}${safeName}${ext}`;

        // Don't rename if filename hasn't changed
        if (newFilename === oldFilename) {
            return logUri;
        }

        const newLogUri = vscode.Uri.file(`${dirPath}${newFilename}`);
        const oldMetaUri = this.getMetaUri(logUri);
        const newMetaUri = this.getMetaUri(newLogUri);

        try {
            // Check if target already exists
            try {
                await vscode.workspace.fs.stat(newLogUri);
                // File exists, don't overwrite
                vscode.window.showWarningMessage(`Cannot rename: "${newFilename}" already exists.`);
                return logUri;
            } catch {
                // Good, target doesn't exist
            }

            // Rename the log file
            await vscode.workspace.fs.rename(logUri, newLogUri);

            // Rename the meta file if it exists
            try {
                await vscode.workspace.fs.stat(oldMetaUri);
                await vscode.workspace.fs.rename(oldMetaUri, newMetaUri);
            } catch {
                // Meta file doesn't exist, that's fine
            }

            return newLogUri;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to rename log file: ${msg}`);
            return logUri;
        }
    }
}

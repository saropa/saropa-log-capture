import * as vscode from 'vscode';

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
    annotations?: Annotation[];
}

/** Manages sidecar .meta.json files alongside .log files. */
export class SessionMetadataStore {

    /** Get the URI for the sidecar metadata file. */
    getMetaUri(logUri: vscode.Uri): vscode.Uri {
        return vscode.Uri.parse(logUri.toString().replace(/\.log$/, '.meta.json'));
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

        // Extract date/time prefix (YYYYMMDD_HH-MM_) from original filename
        const prefixMatch = oldFilename.match(/^(\d{8}_\d{2}-\d{2}_)/);
        const prefix = prefixMatch ? prefixMatch[1] : '';

        // Sanitize the new display name for use as filename
        const safeName = newDisplayName.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim();
        if (!safeName) {
            return logUri; // No valid name, keep original
        }

        const newFilename = `${prefix}${safeName}.log`;

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

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
    tags?: string[];
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

    /** Set or update tags. */
    async setTags(logUri: vscode.Uri, tags: string[]): Promise<void> {
        const meta = await this.loadMetadata(logUri);
        meta.tags = tags;
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
}

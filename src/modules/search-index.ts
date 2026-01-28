/**
 * Lazy on-disk search index for faster repeated searches.
 * Caches file line counts and content hashes to skip unchanged files.
 */

import * as vscode from 'vscode';

/** Index entry for a single log file. */
export interface FileIndexEntry {
    readonly uri: string;
    readonly lineCount: number;
    readonly sizeBytes: number;
    readonly mtime: number;
}

/** Collection of indexed files. */
export interface SearchIndex {
    readonly version: number;
    readonly files: readonly FileIndexEntry[];
    readonly buildTime: number;
}

const INDEX_VERSION = 1;

/**
 * Manages a search index for log files.
 * Tracks file metadata to detect changes.
 */
export class SearchIndexManager {
    private index: SearchIndex | undefined;
    private indexUri: vscode.Uri | undefined;

    constructor(private readonly logDirUri: vscode.Uri) {
        this.indexUri = vscode.Uri.joinPath(logDirUri, '.search-index.json');
    }

    /** Load the index from disk if available. */
    async load(): Promise<SearchIndex | undefined> {
        if (this.index) {
            return this.index;
        }

        if (!this.indexUri) {
            return undefined;
        }

        try {
            const data = await vscode.workspace.fs.readFile(this.indexUri);
            const parsed = JSON.parse(Buffer.from(data).toString('utf-8')) as SearchIndex;
            if (parsed.version === INDEX_VERSION) {
                this.index = parsed;
                return this.index;
            }
        } catch {
            // Index doesn't exist or is invalid
        }

        return undefined;
    }

    /** Save the index to disk. */
    async save(): Promise<void> {
        if (!this.index || !this.indexUri) {
            return;
        }

        try {
            const json = JSON.stringify(this.index, null, 2);
            await vscode.workspace.fs.writeFile(this.indexUri, Buffer.from(json, 'utf-8'));
        } catch {
            // Failed to save, ignore
        }
    }

    /** Build or update the index by scanning log files. */
    async rebuild(): Promise<SearchIndex> {
        const files: FileIndexEntry[] = [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(this.logDirUri);

            for (const [name, type] of entries) {
                if (type !== vscode.FileType.File || !name.endsWith('.log')) {
                    continue;
                }

                const fileUri = vscode.Uri.joinPath(this.logDirUri, name);
                const entry = await this.indexFile(fileUri);
                if (entry) {
                    files.push(entry);
                }
            }
        } catch {
            // Directory doesn't exist or can't be read
        }

        this.index = {
            version: INDEX_VERSION,
            files,
            buildTime: Date.now(),
        };

        return this.index;
    }

    /** Index a single file, returning its metadata. */
    private async indexFile(uri: vscode.Uri): Promise<FileIndexEntry | undefined> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            const data = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(data).toString('utf-8');
            const lineCount = content.split('\n').length;

            return {
                uri: uri.toString(),
                lineCount,
                sizeBytes: stat.size,
                mtime: stat.mtime,
            };
        } catch {
            return undefined;
        }
    }

    /** Check if a file has changed since indexing. */
    async hasFileChanged(uri: vscode.Uri): Promise<boolean> {
        if (!this.index) {
            return true;
        }

        const entry = this.index.files.find(f => f.uri === uri.toString());
        if (!entry) {
            return true;
        }

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            return stat.mtime !== entry.mtime || stat.size !== entry.sizeBytes;
        } catch {
            return true;
        }
    }

    /** Get the index if fresh enough, or rebuild. */
    async getOrRebuild(maxAgeMs: number = 60000): Promise<SearchIndex> {
        const existing = await this.load();

        if (existing && Date.now() - existing.buildTime < maxAgeMs) {
            return existing;
        }

        return this.rebuild();
    }

    /** Get total line count across all indexed files. */
    getTotalLineCount(): number {
        if (!this.index) {
            return 0;
        }
        return this.index.files.reduce((sum, f) => sum + f.lineCount, 0);
    }

    /** Get total size in bytes across all indexed files. */
    getTotalSize(): number {
        if (!this.index) {
            return 0;
        }
        return this.index.files.reduce((sum, f) => sum + f.sizeBytes, 0);
    }

    /** Clear the cached index. */
    clear(): void {
        this.index = undefined;
    }
}

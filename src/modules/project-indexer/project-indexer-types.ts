/**
 * Types for the project indexer (doc/report index entries, manifest, source index).
 * Extracted to keep project-indexer.ts under the line limit.
 */

import type { HeadingEntry } from './token-extractor';

export interface DocIndexEntry {
    readonly relativePath: string;
    readonly uri: string;
    readonly sizeBytes: number;
    readonly mtime: number;
    readonly lineCount: number;
    readonly tokens: string[];
    readonly headings: readonly HeadingEntry[];
}

export interface ReportIndexEntry {
    readonly relativePath: string;
    readonly uri: string;
    readonly sizeBytes: number;
    readonly mtime: number;
    readonly lineCount?: number;
    readonly displayName?: string;
    readonly tags?: string[];
    readonly correlationTokens: string[];
    readonly fingerprints: string[];
    readonly errorCount?: number;
    readonly warningCount?: number;
}

export type IndexEntry = DocIndexEntry | ReportIndexEntry;

export interface SourceIndexFile {
    readonly version: number;
    readonly sourceId: string;
    readonly buildTime: number;
    readonly files: readonly IndexEntry[];
}

export interface ManifestSourceMeta {
    readonly id: string;
    readonly path: string;
    readonly enabled: boolean;
    readonly fileTypes?: readonly string[];
    readonly lastIndexed: string;
    readonly fileCount: number;
    readonly tokenCount: number;
}

export interface IndexManifest {
    readonly version: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly sources: readonly ManifestSourceMeta[];
}

export function tokenCountOfEntry(f: IndexEntry): number {
    if ('tokens' in f) { return (f as DocIndexEntry).tokens?.length ?? 0; }
    const r = f as ReportIndexEntry;
    return (r.correlationTokens?.length ?? 0) + (r.fingerprints?.length ?? 0);
}

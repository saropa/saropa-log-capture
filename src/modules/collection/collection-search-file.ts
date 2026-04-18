/**
 * File-level search for collection sources (single file and JSON sidecar).
 * Extracted to keep collection-search.ts under the line limit.
 */

import * as vscode from 'vscode';
import {
    CollectionSource,
    SearchMatch,
    SEARCHABLE_SIDECAR_EXTENSIONS,
    SKIP_SIDECAR_EXTENSIONS,
    MAX_SEARCH_FILE_SIZE,
} from './collection-types';

/** Gather surrounding context lines around an index, truncated to 200 chars. */
export function gatherContext(
    lines: string[], index: number, contextLines: number,
): { before: string[]; after: string[] } {
    const before: string[] = [];
    for (let j = Math.max(0, index - contextLines); j < index; j++) {
        before.push(lines[j].slice(0, 200));
    }
    const after: string[] = [];
    for (let j = index + 1; j <= Math.min(lines.length - 1, index + contextLines); j++) {
        after.push(lines[j].slice(0, 200));
    }
    return { before, after };
}

/**
 * Resolve all searchable files for a collection source.
 * For 'session' type, includes the main log and all searchable sidecars.
 * For 'file' type, returns just the file itself.
 */
export async function resolveSearchableFiles(
    source: CollectionSource,
    workspaceUri: vscode.Uri,
): Promise<{ uri: vscode.Uri; isSidecar: boolean }[]> {
    const mainUri = vscode.Uri.joinPath(workspaceUri, source.relativePath);
    const results: { uri: vscode.Uri; isSidecar: boolean }[] = [{ uri: mainUri, isSidecar: false }];

    if (source.type !== 'session') {
        return results;
    }

    const dir = vscode.Uri.joinPath(mainUri, '..');
    const mainName = source.relativePath.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) {
        return results;
    }

    const base = baseMatch[1];
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
        return results;
    }

    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File) { continue; }
        if (!name.startsWith(base + '.')) { continue; }

        const isSearchable = SEARCHABLE_SIDECAR_EXTENSIONS.some(ext => name.endsWith(ext));
        const isSkipped = SKIP_SIDECAR_EXTENSIONS.some(ext => name.endsWith(ext));

        if (isSearchable && !isSkipped) {
            results.push({ uri: vscode.Uri.joinPath(dir, name), isSidecar: true });
        }
    }

    return results;
}

export interface FileSearchParams {
    uri: vscode.Uri;
    regex: RegExp;
    contextLines: number;
    maxResults: number;
    token?: vscode.CancellationToken;
}

/** Search a single file for matches. */
export async function searchFile(
    params: FileSearchParams,
): Promise<{ matches: SearchMatch[]; truncated: boolean; largeFileWarning: boolean }> {
    const { uri, regex, contextLines, maxResults, token } = params;
    let stat: vscode.FileStat;
    try {
        stat = await vscode.workspace.fs.stat(uri);
    } catch {
        return { matches: [], truncated: false, largeFileWarning: false };
    }

    const largeFileWarning = stat.size > MAX_SEARCH_FILE_SIZE;
    const searchSize = largeFileWarning ? MAX_SEARCH_FILE_SIZE : stat.size;

    let content: string;
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const buffer = Buffer.from(data);
        content = buffer.toString('utf-8', 0, Math.min(buffer.length, searchSize));
    } catch {
        return { matches: [], truncated: false, largeFileWarning };
    }

    if (token?.isCancellationRequested) {
        return { matches: [], truncated: false, largeFileWarning };
    }

    const lines = content.split('\n');
    const matches: SearchMatch[] = [];
    let truncated = false;

    for (let i = 0; i < lines.length; i++) {
        if (token?.isCancellationRequested) {
            break;
        }

        const line = lines[i];
        regex.lastIndex = 0;
        const match = regex.exec(line);

        if (match) {
            if (matches.length >= maxResults) {
                truncated = true;
                break;
            }

            const ctx = contextLines > 0 ? gatherContext(lines, i, contextLines) : undefined;
            matches.push({
                line: i + 1,
                column: match.index + 1,
                text: line.slice(0, 300),
                contextBefore: ctx?.before.length ? ctx.before : undefined,
                contextAfter: ctx?.after.length ? ctx.after : undefined,
            });
        }
    }

    return { matches, truncated, largeFileWarning };
}

/** Search JSON sidecar files for matches in string values. */
export async function searchJsonSidecar(
    params: FileSearchParams,
): Promise<{ matches: SearchMatch[]; truncated: boolean; largeFileWarning: boolean }> {
    const { uri, regex, contextLines, maxResults, token } = params;
    let stat: vscode.FileStat;
    try {
        stat = await vscode.workspace.fs.stat(uri);
    } catch {
        return { matches: [], truncated: false, largeFileWarning: false };
    }

    const largeFileWarning = stat.size > MAX_SEARCH_FILE_SIZE;

    let content: string;
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        content = Buffer.from(data).toString('utf-8');
    } catch {
        return { matches: [], truncated: false, largeFileWarning };
    }

    if (token?.isCancellationRequested) {
        return { matches: [], truncated: false, largeFileWarning };
    }

    const lines = content.split('\n');
    const matches: SearchMatch[] = [];
    let truncated = false;

    for (let i = 0; i < lines.length; i++) {
        if (token?.isCancellationRequested) {
            break;
        }

        const line = lines[i];
        regex.lastIndex = 0;

        if (regex.test(line)) {
            if (matches.length >= maxResults) {
                truncated = true;
                break;
            }

            const ctx = contextLines > 0 ? gatherContext(lines, i, contextLines) : undefined;
            matches.push({
                line: i + 1,
                column: 1,
                text: line.slice(0, 300),
                contextBefore: ctx?.before.length ? ctx.before : undefined,
                contextAfter: ctx?.after.length ? ctx.after : undefined,
            });
        }
    }

    return { matches, truncated, largeFileWarning };
}

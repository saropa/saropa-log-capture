/** Project documentation scanner — finds references to analysis tokens in markdown files. */

import * as vscode from 'vscode';
import { getConfig } from '../config/config';
import { getGlobalProjectIndexer } from '../project-indexer/project-indexer';
import type { DocIndexEntry } from '../project-indexer/project-indexer';

/** A match found in project documentation. */
export interface DocMatch {
    readonly uri: vscode.Uri;
    readonly filename: string;
    readonly lineNumber: number;
    readonly lineText: string;
    readonly matchedToken: string;
    /** Section heading containing this line (e.g. "## Troubleshooting"), when available from index. */
    readonly heading?: string;
}

/** Results from scanning project documentation. */
export interface DocScanResults {
    readonly matches: readonly DocMatch[];
    readonly filesScanned: number;
}

const maxFiles = 50;
const maxMatchesTotal = 100;
const maxMatchesPerFile = 20;

/** Scan project docs for references to extracted tokens. Uses project index when enabled to only read matching files. */
export async function scanDocsForTokens(
    tokens: readonly string[],
    workspaceFolder: vscode.WorkspaceFolder,
): Promise<DocScanResults> {
    if (tokens.length === 0) { return { matches: [], filesScanned: 0 }; }
    const lowerTokens = tokens.map(t => t.toLowerCase());
    const cfg = getConfig().projectIndex;
    let urisToScan: vscode.Uri[];
    const entryByUri = new Map<string, DocIndexEntry>();

    if (cfg.enabled) {
        const indexer = getGlobalProjectIndexer();
        if (indexer) {
            await indexer.getOrRebuild(60_000);
            const docEntries = indexer.queryDocEntriesByTokens([...tokens]);
            for (const e of docEntries) {
                entryByUri.set(e.uri, e);
            }
            urisToScan = docEntries.length > 0
                ? docEntries.slice(0, maxFiles).map((e) => vscode.Uri.parse(e.uri))
                : await collectMarkdownFiles(workspaceFolder);
        } else {
            urisToScan = await collectMarkdownFiles(workspaceFolder);
        }
    } else {
        urisToScan = await collectMarkdownFiles(workspaceFolder);
    }

    if (urisToScan.length === 0) { return { matches: [], filesScanned: 0 }; }
    const matches: DocMatch[] = [];
    const allFileMatches = await Promise.all(
        urisToScan.slice(0, maxFiles).map((uri) => {
            const entry = entryByUri.get(uri.toString());
            const headingForLine = entry?.headings?.length
                ? (line: number) => headingAtLine(entry.headings!, line)
                : undefined;
            return searchFileForTokens(uri, lowerTokens, tokens, headingForLine);
        }),
    );
    for (const fileMatches of allFileMatches) {
        if (matches.length >= maxMatchesTotal) { break; }
        matches.push(...fileMatches.slice(0, maxMatchesPerFile));
    }
    return { matches: matches.slice(0, maxMatchesTotal), filesScanned: Math.min(urisToScan.length, maxFiles) };
}

function headingAtLine(headings: readonly { level: number; text: string; line: number }[], line: number): string {
    let best = '';
    for (const h of headings) {
        if (h.line <= line) { best = (h.level === 1 ? '#' : h.level === 2 ? '##' : '###') + ' ' + h.text; }
    }
    return best;
}

async function collectMarkdownFiles(folder: vscode.WorkspaceFolder): Promise<vscode.Uri[]> {
    const dirs = getConfig().docsScanDirs;
    const patterns: string[] = [];
    for (const dir of dirs) { patterns.push(`${dir}/**/*.md`); }
    patterns.push('*.md');
    const results = await Promise.all(
        patterns.map(p => vscode.workspace.findFiles(new vscode.RelativePattern(folder, p), '**/node_modules/**', maxFiles)),
    );
    const seen = new Set<string>();
    const uris: vscode.Uri[] = [];
    for (const batch of results) {
        for (const uri of batch) {
            const key = uri.toString();
            if (!seen.has(key)) { seen.add(key); uris.push(uri); }
        }
    }
    return uris;
}

async function searchFileForTokens(
    uri: vscode.Uri,
    lowerTokens: string[],
    originalTokens: readonly string[],
    headingForLine?: (line: number) => string,
): Promise<DocMatch[]> {
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const filename = uri.fsPath.split(/[\\/]/).pop() ?? '';
        const matches: DocMatch[] = [];
        for (let i = 0; i < doc.lineCount && matches.length < maxMatchesPerFile; i++) {
            const lineText = doc.lineAt(i).text;
            const lower = lineText.toLowerCase();
            const idx = lowerTokens.findIndex(t => lower.includes(t));
            if (idx >= 0) {
                const lineNumber = i + 1;
                const heading = headingForLine?.(lineNumber);
                matches.push({ uri, filename, lineNumber, lineText, matchedToken: originalTokens[idx], heading });
            }
        }
        return matches;
    } catch { return []; }
}

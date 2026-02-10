/** Project documentation scanner — finds references to analysis tokens in markdown files. */

import * as vscode from 'vscode';
import { getConfig } from './config';

/** A match found in project documentation. */
export interface DocMatch {
    readonly uri: vscode.Uri;
    readonly filename: string;
    readonly lineNumber: number;
    readonly lineText: string;
    readonly matchedToken: string;
}

/** Results from scanning project documentation. */
export interface DocScanResults {
    readonly matches: readonly DocMatch[];
    readonly filesScanned: number;
}

const maxFiles = 50;
const maxMatchesTotal = 100;
const maxMatchesPerFile = 20;

/** Scan project docs for references to extracted tokens. */
export async function scanDocsForTokens(
    tokens: readonly string[],
    workspaceFolder: vscode.WorkspaceFolder,
): Promise<DocScanResults> {
    if (tokens.length === 0) { return { matches: [], filesScanned: 0 }; }
    const mdUris = await collectMarkdownFiles(workspaceFolder);
    const matches: DocMatch[] = [];
    const lowerTokens = tokens.map(t => t.toLowerCase());

    const allFileMatches = await Promise.all(
        mdUris.slice(0, maxFiles).map(uri => searchFileForTokens(uri, lowerTokens, tokens)),
    );
    for (const fileMatches of allFileMatches) {
        if (matches.length >= maxMatchesTotal) { break; }
        matches.push(...fileMatches.slice(0, maxMatchesPerFile));
    }
    return { matches: matches.slice(0, maxMatchesTotal), filesScanned: Math.min(mdUris.length, maxFiles) };
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

async function searchFileForTokens(uri: vscode.Uri, lowerTokens: string[], originalTokens: readonly string[]): Promise<DocMatch[]> {
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const filename = uri.fsPath.split(/[\\/]/).pop() ?? '';
        const matches: DocMatch[] = [];
        for (let i = 0; i < doc.lineCount && matches.length < maxMatchesPerFile; i++) {
            const lineText = doc.lineAt(i).text;
            const lower = lineText.toLowerCase();
            const idx = lowerTokens.findIndex(t => lower.includes(t));
            if (idx >= 0) { matches.push({ uri, filename, lineNumber: i + 1, lineText, matchedToken: originalTokens[idx] }); }
        }
        return matches;
    } catch { return []; }
}

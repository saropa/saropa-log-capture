/** Symbol resolver — finds definitions of class names via VS Code workspace symbol provider. */

import type { AnalysisToken } from './line-analyzer';
import * as vscode from 'vscode';

/** A resolved symbol definition in the workspace. */
export interface ResolvedSymbol {
    readonly name: string;
    readonly kind: string;
    readonly uri: vscode.Uri;
    readonly line: number;
    readonly containerName: string;
}

/** Results from symbol resolution. */
export interface SymbolResults {
    readonly symbols: readonly ResolvedSymbol[];
    readonly queriesRun: number;
}

const maxQueries = 5;
const maxResultsPerQuery = 10;

const kindNames: Record<number, string> = {
    4: 'Class', 5: 'Method', 6: 'Property', 8: 'Constructor',
    9: 'Enum', 11: 'Function', 12: 'Variable', 13: 'Constant',
    14: 'String', 22: 'Struct', 23: 'Event',
};

/** Resolve error-class and class-method tokens to workspace symbols. */
export async function resolveSymbols(tokens: readonly AnalysisToken[]): Promise<SymbolResults> {
    const names = extractUniqueNames(tokens);
    if (names.length === 0) { return { symbols: [], queriesRun: 0 }; }

    const queries = names.slice(0, maxQueries);
    const results = await Promise.all(queries.map(querySymbols));
    const seen = new Set<string>();
    const symbols: ResolvedSymbol[] = [];
    for (const batch of results) {
        for (const s of batch) {
            const key = `${s.uri.toString()}:${s.line}`;
            if (!seen.has(key)) { seen.add(key); symbols.push(s); }
        }
    }
    return { symbols, queriesRun: queries.length };
}

function extractUniqueNames(tokens: readonly AnalysisToken[]): string[] {
    const names = new Set<string>();
    for (const t of tokens) {
        if (t.type === 'error-class') { names.add(t.value); }
        if (t.type === 'class-method') {
            const className = t.value.split('.')[0];
            if (className) { names.add(className); }
        }
    }
    return [...names];
}

async function querySymbols(name: string): Promise<ResolvedSymbol[]> {
    try {
        const raw = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider', name,
        );
        if (!raw) { return []; }
        return raw.slice(0, maxResultsPerQuery).map(s => ({
            name: s.name,
            kind: kindNames[s.kind] ?? 'Symbol',
            uri: s.location.uri,
            line: s.location.range.start.line + 1,
            containerName: s.containerName ?? '',
        }));
    } catch { return []; }
}

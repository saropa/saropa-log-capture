/** Import/dependency extractor — parses import statements from source files. */

import * as vscode from 'vscode';

/** A single import statement extracted from a source file. */
export interface ImportEntry {
    readonly module: string;
    readonly isLocal: boolean;
    readonly line: number;
}

/** All imports found in a source file. */
export interface ImportResults {
    readonly imports: readonly ImportEntry[];
    readonly language: string;
    readonly localCount: number;
    readonly packageCount: number;
}

interface LangPatterns { readonly language: string; readonly patterns: RegExp[]; }

const langMap: Record<string, LangPatterns> = {
    ts: { language: 'TypeScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g] },
    tsx: { language: 'TypeScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g] },
    js: { language: 'JavaScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g] },
    jsx: { language: 'JavaScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g] },
    mjs: { language: 'JavaScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g] },
    dart: { language: 'Dart', patterns: [/import\s+['"]([^'"]+)['"]/g] },
    py: { language: 'Python', patterns: [/^import\s+(\S+)/gm, /^from\s+(\S+)\s+import/gm] },
    go: { language: 'Go', patterns: [/^\s*"([^"]+)"/gm] },
    java: { language: 'Java', patterns: [/^import\s+([\w.]+)/gm] },
    kt: { language: 'Kotlin', patterns: [/^import\s+([\w.]+)/gm] },
    kts: { language: 'Kotlin', patterns: [/^import\s+([\w.]+)/gm] },
    rs: { language: 'Rust', patterns: [/^use\s+([\w:]+)/gm, /^extern\s+crate\s+(\w+)/gm] },
    c: { language: 'C', patterns: [/#include\s+[<"]([^>"]+)[>"]/g] },
    cpp: { language: 'C++', patterns: [/#include\s+[<"]([^>"]+)[>"]/g] },
    h: { language: 'C', patterns: [/#include\s+[<"]([^>"]+)[>"]/g] },
    hpp: { language: 'C++', patterns: [/#include\s+[<"]([^>"]+)[>"]/g] },
    swift: { language: 'Swift', patterns: [/^import\s+(\w+)/gm] },
    cs: { language: 'C#', patterns: [/^using\s+([\w.]+)\s*;/gm] },
};

/** Extract imports from a source file. */
export async function extractImports(uri: vscode.Uri): Promise<ImportResults> {
    const ext = uri.fsPath.split('.').pop()?.toLowerCase() ?? '';
    const lang = langMap[ext];
    if (!lang) { return { imports: [], language: ext, localCount: 0, packageCount: 0 }; }

    const doc = await vscode.workspace.openTextDocument(uri);
    const text = doc.getText();
    const entries: ImportEntry[] = [];
    const seen = new Set<string>();

    for (const pattern of lang.patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        for (const match of text.matchAll(regex)) {
            const module = match[1];
            if (!module || seen.has(module)) { continue; }
            seen.add(module);
            const line = doc.positionAt(match.index ?? 0).line + 1;
            entries.push({ module, isLocal: isLocalImport(module, ext), line });
        }
    }

    const localCount = entries.filter(e => e.isLocal).length;
    return { imports: entries, language: lang.language, localCount, packageCount: entries.length - localCount };
}

function isLocalImport(module: string, ext: string): boolean {
    if (module.startsWith('.') || module.startsWith('/')) { return true; }
    if (ext === 'dart' && module.startsWith('package:')) { return false; }
    if (ext === 'dart') { return true; }
    if (['c', 'cpp', 'h', 'hpp'].includes(ext)) { return module.includes('/') || module.includes('\\'); }
    return false;
}

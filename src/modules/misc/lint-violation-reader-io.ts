import * as vscode from 'vscode';

export interface RawExport {
    readonly schema?: string;
    readonly version?: string;
    readonly timestamp?: string;
    readonly config?: { readonly tier?: string };
    readonly summary?: {
        readonly totalViolations?: number;
        readonly issuesByFile?: Record<string, number>;
        readonly filesAnalyzed?: number;
        readonly byImpact?: Record<string, number>;
    };
    readonly violations?: readonly RawViolation[];
}

export interface RawViolation {
    readonly file?: string;
    readonly line?: number;
    readonly rule?: string;
    readonly message?: string;
    readonly correction?: string;
    readonly severity?: string;
    readonly impact?: string;
    readonly owasp?: { readonly mobile?: readonly string[]; readonly web?: readonly string[] };
}

/** Check if the Saropa Lints extension has been used (extension report files exist). */
export async function detectExtension(wsRoot: vscode.Uri): Promise<boolean> {
    const reportsUri = vscode.Uri.joinPath(wsRoot, 'reports');
    try {
        const entries = await vscode.workspace.fs.readDirectory(reportsUri);
        for (const [name, type] of entries) {
            if (type !== vscode.FileType.Directory || !/^\d{8}$/.test(name)) { continue; }
            const dirUri = vscode.Uri.joinPath(reportsUri, name);
            const files = await vscode.workspace.fs.readDirectory(dirUri);
            if (files.some(([f]) => f.endsWith('_saropa_extension.md'))) { return true; }
        }
    } catch {
        // reports/ doesn't exist or can't be read
    }
    return false;
}

export async function readExportFile(wsRoot: vscode.Uri): Promise<RawExport | undefined> {
    const uri = vscode.Uri.joinPath(wsRoot, 'reports', '.saropa_lints', 'violations.json');
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(Buffer.from(data).toString('utf-8')) as RawExport;
    } catch {
        return undefined;
    }
}

import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../modules/config';

interface SessionMetadata {
    readonly uri: vscode.Uri;
    readonly filename: string;
    readonly date?: string;
    readonly project?: string;
    readonly adapter?: string;
    readonly lineCount?: number;
    readonly size: number;
}

/** Tree data provider for listing past log sessions from the reports directory. */
export class SessionHistoryProvider implements vscode.TreeDataProvider<SessionMetadata>, vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChange.event;
    private watcher: vscode.FileSystemWatcher | undefined;
    private activeUri: vscode.Uri | undefined;

    constructor() {
        this.setupWatcher();
    }

    /** Mark the currently-recording session so it gets a distinct icon. */
    setActiveUri(uri: vscode.Uri | undefined): void {
        this.activeUri = uri;
    }

    refresh(): void {
        this._onDidChange.fire();
    }

    getTreeItem(item: SessionMetadata): vscode.TreeItem {
        const isActive = this.activeUri?.toString() === item.uri.toString();
        const ti = new vscode.TreeItem(item.filename, vscode.TreeItemCollapsibleState.None);
        ti.tooltip = buildTooltip(item);
        ti.description = buildDescription(item);
        ti.iconPath = new vscode.ThemeIcon(isActive ? 'record' : 'file');
        ti.command = { command: 'saropaLogCapture.openSession', title: 'Open', arguments: [item] };
        ti.contextValue = 'session';
        return ti;
    }

    async getChildren(): Promise<SessionMetadata[]> {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return [];
        }
        const logDir = getLogDirectoryUri(folder);
        try {
            const entries = await vscode.workspace.fs.readDirectory(logDir);
            const logFiles = entries.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.log'));
            const items = await Promise.all(logFiles.map(([name]) => this.loadMetadata(logDir, name)));
            return items.sort((a, b) => (b.date ?? b.filename).localeCompare(a.date ?? a.filename));
        } catch {
            return [];
        }
    }

    dispose(): void {
        this.watcher?.dispose();
        this._onDidChange.dispose();
    }

    private setupWatcher(): void {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return;
        }
        const logDir = getLogDirectoryUri(folder);
        const pattern = new vscode.RelativePattern(logDir, '*.log');
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.watcher.onDidCreate(() => this.refresh());
        this.watcher.onDidDelete(() => this.refresh());
        this.watcher.onDidChange(() => this.refresh());
    }

    private async loadMetadata(logDir: vscode.Uri, filename: string): Promise<SessionMetadata> {
        const uri = vscode.Uri.joinPath(logDir, filename);
        const stat = await vscode.workspace.fs.stat(uri);
        const meta: SessionMetadata = { uri, filename, size: stat.size };
        return parseHeader(uri, meta);
    }
}

async function parseHeader(uri: vscode.Uri, base: SessionMetadata): Promise<SessionMetadata> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString('utf-8');
        const headerEnd = text.indexOf('==================');
        const block = headerEnd > 0 ? text.slice(0, headerEnd) : text.slice(0, 800);
        return { ...base, ...extractFields(block) };
    } catch {
        return base;
    }
}

function extractFields(block: string): Partial<Pick<SessionMetadata, 'date' | 'project' | 'adapter' | 'lineCount'>> {
    const result: Record<string, string | number> = {};
    const dateMatch = block.match(/^Date:\s+(.+)$/m);
    if (dateMatch) {
        result.date = dateMatch[1].trim();
    }
    const projMatch = block.match(/^Project:\s+(.+)$/m);
    if (projMatch) {
        result.project = projMatch[1].trim();
    }
    const adapterMatch = block.match(/^Debug Adapter:\s+(.+)$/m);
    if (adapterMatch) {
        result.adapter = adapterMatch[1].trim();
    }
    return result;
}

function buildDescription(item: SessionMetadata): string {
    const parts: string[] = [];
    if (item.adapter) {
        parts.push(item.adapter);
    }
    parts.push(formatSize(item.size));
    return parts.join(' · ');
}

function buildTooltip(item: SessionMetadata): string {
    const parts = [item.filename];
    if (item.date) {
        parts.push(`Date: ${item.date}`);
    }
    if (item.project) {
        parts.push(`Project: ${item.project}`);
    }
    if (item.adapter) {
        parts.push(`Adapter: ${item.adapter}`);
    }
    parts.push(`Size: ${formatSize(item.size)}`);
    return parts.join('\n');
}

function formatSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

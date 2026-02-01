import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../modules/config';
import { SessionMetadataStore } from '../modules/session-metadata';
import {
    SessionMetadata, SplitGroup, TreeItem,
    isSplitGroup, groupSplitFiles, buildSplitGroupTooltip, formatSize,
} from './session-history-grouping';

/** Tree data provider for listing past log sessions from the reports directory. */
export class SessionHistoryProvider implements vscode.TreeDataProvider<TreeItem>, vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChange.event;
    private watcher: vscode.FileSystemWatcher | undefined;
    private activeUri: vscode.Uri | undefined;
    private readonly metaStore = new SessionMetadataStore();

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

    getTreeItem(item: TreeItem): vscode.TreeItem {
        if (isSplitGroup(item)) {
            return this.getSplitGroupTreeItem(item);
        }
        return this.getSessionTreeItem(item);
    }

    private getSessionTreeItem(item: SessionMetadata): vscode.TreeItem {
        const isActive = this.activeUri?.toString() === item.uri.toString();
        const label = item.displayName ?? item.filename;
        // Add visual indicator for active session
        const displayLabel = isActive ? `● ${label}` : label;
        const ti = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.None);
        ti.tooltip = buildTooltip(item);
        // Prepend "ACTIVE" to description for active session
        const baseDescription = buildDescription(item);
        ti.description = isActive ? `ACTIVE · ${baseDescription}` : baseDescription;
        // Use colored icon for active session
        ti.iconPath = new vscode.ThemeIcon(
            isActive ? 'record' : 'file',
            isActive ? new vscode.ThemeColor('charts.red') : undefined
        );
        ti.command = { command: 'saropaLogCapture.openSession', title: 'Open', arguments: [item] };
        ti.contextValue = 'session';
        return ti;
    }

    private getSplitGroupTreeItem(group: SplitGroup): vscode.TreeItem {
        const label = group.displayName ?? group.baseFilename;
        const ti = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        ti.tooltip = buildSplitGroupTooltip(group);
        ti.description = `${group.parts.length} parts · ${formatSize(group.totalSize)}`;
        ti.iconPath = new vscode.ThemeIcon('files');
        ti.contextValue = 'split-group';
        return ti;
    }

    /** Expose the metadata store for use by commands. */
    getMetaStore(): SessionMetadataStore {
        return this.metaStore;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (element && isSplitGroup(element)) {
            return element.parts.sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0));
        }

        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return [];
        }
        const logDir = getLogDirectoryUri(folder);
        try {
            const entries = await vscode.workspace.fs.readDirectory(logDir);
            const logFiles = entries.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.log'));
            const items = await Promise.all(logFiles.map(([name]) => this.loadMetadata(logDir, name)));

            const grouped = groupSplitFiles(items);
            return grouped.sort((a, b) => {
                const dateA = isSplitGroup(a) ? (a.date ?? a.baseFilename) : (a.date ?? a.filename);
                const dateB = isSplitGroup(b) ? (b.date ?? b.baseFilename) : (b.date ?? b.filename);
                return dateB.localeCompare(dateA);
            });
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
        let meta: SessionMetadata = { uri, filename, size: stat.size };
        meta = await parseHeader(uri, meta);
        const sidecar = await this.metaStore.loadMetadata(uri);
        if (sidecar.displayName) {
            meta = { ...meta, displayName: sidecar.displayName };
        }
        if (sidecar.tags && sidecar.tags.length > 0) {
            meta = { ...meta, tags: sidecar.tags };
        }
        if (sidecar.autoTags && sidecar.autoTags.length > 0) {
            meta = { ...meta, autoTags: sidecar.autoTags };
        }
        return meta;
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
    if (item.tags && item.tags.length > 0) {
        parts.push(item.tags.map(t => `#${t}`).join(' '));
    }
    if (item.autoTags && item.autoTags.length > 0) {
        parts.push(item.autoTags.map(t => `~${t}`).join(' '));
    }
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

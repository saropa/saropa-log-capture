import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../modules/config';
import { SessionMetadataStore } from '../modules/session-metadata';

interface SessionMetadata {
    readonly uri: vscode.Uri;
    readonly filename: string;
    readonly date?: string;
    readonly project?: string;
    readonly adapter?: string;
    readonly lineCount?: number;
    readonly size: number;
    readonly displayName?: string;
    readonly tags?: string[];
    readonly partNumber?: number;
}

/** Tree item representing either a single session or a split parent group. */
type TreeItem = SessionMetadata | SplitGroup;

interface SplitGroup {
    readonly type: 'split-group';
    readonly baseFilename: string;
    readonly parts: SessionMetadata[];
    readonly totalSize: number;
    readonly date?: string;
    readonly project?: string;
    readonly adapter?: string;
    readonly displayName?: string;
}

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
        const ti = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        ti.tooltip = buildTooltip(item);
        ti.description = buildDescription(item);
        ti.iconPath = new vscode.ThemeIcon(isActive ? 'record' : 'file');
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
        // If element is a split group, return its parts
        if (element && isSplitGroup(element)) {
            return element.parts.sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0));
        }

        // Top level: load all sessions and group splits
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return [];
        }
        const logDir = getLogDirectoryUri(folder);
        try {
            const entries = await vscode.workspace.fs.readDirectory(logDir);
            const logFiles = entries.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.log'));
            const items = await Promise.all(logFiles.map(([name]) => this.loadMetadata(logDir, name)));

            // Group split files
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

function isSplitGroup(item: TreeItem): item is SplitGroup {
    return (item as SplitGroup).type === 'split-group';
}

/** Pattern to detect split file parts: _001.log, _002.log, etc. */
const SPLIT_PART_PATTERN = /^(.+)_(\d{3})\.log$/;

/** Extract base filename and part number from a filename. */
function parseSplitFilename(filename: string): { base: string; part: number } | null {
    const match = filename.match(SPLIT_PART_PATTERN);
    if (match) {
        return { base: match[1], part: parseInt(match[2], 10) };
    }
    return null;
}

/** Group split files under their parent session. */
function groupSplitFiles(items: SessionMetadata[]): TreeItem[] {
    const groups = new Map<string, SessionMetadata[]>();
    const standalone: SessionMetadata[] = [];

    for (const item of items) {
        const parsed = parseSplitFilename(item.filename);
        if (parsed) {
            // This is a split part (e.g., _002.log, _003.log)
            const key = parsed.base;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push({ ...item, partNumber: parsed.part });
        } else if (item.filename.endsWith('.log')) {
            // Check if this is a base file that has split parts
            const base = item.filename.replace(/\.log$/, '');
            const hasParts = items.some(i => parseSplitFilename(i.filename)?.base === base);
            if (hasParts) {
                // This is the first part of a split session
                if (!groups.has(base)) {
                    groups.set(base, []);
                }
                groups.get(base)!.unshift({ ...item, partNumber: 1 });
            } else {
                standalone.push(item);
            }
        }
    }

    const result: TreeItem[] = [...standalone];

    for (const [base, parts] of groups) {
        if (parts.length === 1) {
            // Only one file, no grouping needed
            result.push(parts[0]);
        } else {
            // Create a split group
            const firstPart = parts.find(p => p.partNumber === 1) ?? parts[0];
            const group: SplitGroup = {
                type: 'split-group',
                baseFilename: base + '.log',
                parts,
                totalSize: parts.reduce((sum, p) => sum + p.size, 0),
                date: firstPart.date,
                project: firstPart.project,
                adapter: firstPart.adapter,
                displayName: firstPart.displayName,
            };
            result.push(group);
        }
    }

    return result;
}

function buildSplitGroupTooltip(group: SplitGroup): string {
    const parts = [`${group.parts.length} split parts`];
    if (group.date) {
        parts.push(`Date: ${group.date}`);
    }
    if (group.project) {
        parts.push(`Project: ${group.project}`);
    }
    if (group.adapter) {
        parts.push(`Adapter: ${group.adapter}`);
    }
    parts.push(`Total size: ${formatSize(group.totalSize)}`);
    return parts.join('\n');
}

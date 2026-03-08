import * as vscode from 'vscode';
import { getConfig, getFileTypeGlob, getLogDirectoryUri } from '../../modules/config/config';
import { SessionMetadataStore } from '../../modules/session/session-metadata';
import {
    SessionMetadata, SplitGroup, TreeItem,
    isSplitGroup, buildSplitGroupTooltip, formatSize, totalLineCount,
} from './session-history-grouping';
import { applyDisplayOptions, SessionDisplayOptions, defaultDisplayOptions } from './session-display';
import { buildDescription, buildTooltip, formatCount } from './session-history-helpers';
import { fetchItemsCore, type FetchTarget } from './session-history-fetching';

/** Extract the basename from a relative path (strip folder prefix). */
function getBasename(name: string): string {
    const idx = name.lastIndexOf('/');
    return idx >= 0 ? name.substring(idx + 1) : name;
}

/** Tree data provider for listing past log sessions from the reports directory. */
export class SessionHistoryProvider implements vscode.TreeDataProvider<TreeItem>, vscode.Disposable, FetchTarget {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChange.event;
    private watcher: vscode.FileSystemWatcher | undefined;
    private activeUri: vscode.Uri | undefined;
    private activeLineCount = 0;
    readonly metaStore = new SessionMetadataStore();
    readonly metaCache = new Map<string, SessionMetadata>();
    private displayOptions: SessionDisplayOptions = defaultDisplayOptions;
    private showTrash = false;
    private refreshTimer: ReturnType<typeof setTimeout> | undefined;
    /** Cached result from the last successful fetch (default log dir only). */
    private itemsCache: TreeItem[] | undefined;
    /** Guards against overlapping fetch calls — callers share the same promise. */
    private fetchInFlight: Promise<TreeItem[]> | undefined;
    /** Basenames that appear more than once — need subfolder for disambiguation. */
    private duplicateBasenames = new Set<string>();

    constructor() {
        this.setupWatcher();
    }

    /** Update display options used when rendering tree item labels. */
    setDisplayOptions(options: SessionDisplayOptions): void {
        this.displayOptions = options;
    }

    /** Toggle visibility of trashed sessions. Refreshes tree automatically. */
    setShowTrash(show: boolean): void { this.showTrash = show; this.refresh(); }
    /** Whether trashed sessions are currently visible. */
    getShowTrash(): boolean { return this.showTrash; }

    /** Mark the currently-recording session so it gets a distinct icon. */
    setActiveUri(uri: vscode.Uri | undefined): void {
        this.activeUri = uri;
        if (!uri) { this.activeLineCount = 0; }
    }

    /** Update the live line count for the active (recording) session. */
    setActiveLineCount(count: number): void { this.activeLineCount = count; }

    /** Return the URI of the currently active (recording) session. */
    getActiveUri(): vscode.Uri | undefined {
        return this.activeUri;
    }

    /** Invalidate items cache and notify the tree view to re-fetch. */
    refresh(): void {
        this.itemsCache = undefined;
        this.fetchInFlight = undefined;
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
        const fullLabel = item.displayName ?? item.filename;
        const bn = getBasename(fullLabel);
        const rawLabel = this.duplicateBasenames.has(bn) ? fullLabel : bn;
        const label = applyDisplayOptions(rawLabel, this.displayOptions);
        const displayLabel = isActive ? `● ${label}` : label;
        const ti = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.None);
        const renderItem = isActive ? { ...item, lineCount: this.activeLineCount } : item;
        ti.tooltip = buildTooltip(renderItem);
        const baseDescription = buildDescription(renderItem, this.displayOptions.showDayHeadings, isActive);
        ti.description = isActive ? `ACTIVE · ${baseDescription}` : baseDescription;
        if (item.trashed) {
            ti.iconPath = new vscode.ThemeIcon('trash', new vscode.ThemeColor('disabledForeground'));
        } else {
            ti.iconPath = new vscode.ThemeIcon(
                isActive ? 'record' : (item.hasTimestamps ? 'history' : 'output'),
                isActive ? new vscode.ThemeColor('charts.red') : undefined,
            );
        }
        ti.command = { command: 'saropaLogCapture.openSession', title: 'Open', arguments: [item] };
        ti.contextValue = item.trashed ? 'trashed-session' : 'session';
        return ti;
    }

    private getSplitGroupTreeItem(group: SplitGroup): vscode.TreeItem {
        const rawLabel = group.displayName ?? group.baseFilename;
        const label = applyDisplayOptions(rawLabel, this.displayOptions);
        const ti = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        ti.tooltip = buildSplitGroupTooltip(group);
        const total = totalLineCount(group);
        const linePart = total > 0 ? ` · ${formatCount(total)} lines` : '';
        ti.description = `${group.parts.length} parts${linePart} · ${formatSize(group.totalSize)}`;
        ti.iconPath = new vscode.ThemeIcon('files');
        ti.contextValue = 'split-group';
        return ti;
    }

    /** Expose the metadata store for use by commands. */
    getMetaStore(): SessionMetadataStore {
        return this.metaStore;
    }

    /** Invalidate cached metadata for a URI (e.g. after metadata change). */
    invalidateMeta(uri: vscode.Uri): void {
        const prefix = uri.toString() + '|';
        for (const key of this.metaCache.keys()) {
            if (key.startsWith(prefix)) { this.metaCache.delete(key); break; }
        }
        this.itemsCache = undefined;
    }

    /** Find a top-level tree item whose URI matches (or whose split group contains it). */
    async findByUri(uri: vscode.Uri): Promise<TreeItem | undefined> {
        const uriStr = uri.toString();
        const items = await this.getChildren();
        for (const item of items) {
            if (isSplitGroup(item)) {
                if (item.parts.some(p => p.uri.toString() === uriStr)) { return item; }
            } else if (item.uri.toString() === uriStr) { return item; }
        }
        return undefined;
    }

    /** Find the previous (older) and next (newer) session relative to a URI. */
    async getAdjacentSessions(currentUri: vscode.Uri): Promise<{
        prev?: vscode.Uri; next?: vscode.Uri; index: number; total: number;
    }> {
        const items = await this.getChildren();
        const currentStr = currentUri.toString();
        const idx = items.findIndex(item => {
            if (isSplitGroup(item)) {
                return item.parts.some(p => p.uri.toString() === currentStr);
            }
            return item.uri.toString() === currentStr;
        });
        const total = items.length;
        if (idx < 0) { return { index: 0, total }; }
        const getUri = (item: TreeItem): vscode.Uri => {
            if (isSplitGroup(item)) {
                const sorted = [...item.parts].sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0));
                return sorted[0].uri;
            }
            return item.uri;
        };
        return {
            next: idx > 0 ? getUri(items[idx - 1]) : undefined,
            prev: idx < total - 1 ? getUri(items[idx + 1]) : undefined,
            index: total - idx,
            total,
        };
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (element && isSplitGroup(element)) {
            return element.parts.sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0));
        }
        const all = await this.getCachedOrFetch();
        return this.showTrash ? all : all.filter(i => isSplitGroup(i) || !i.trashed);
    }

    /** Fetch all items including trashed (for the webview session panel). */
    async getAllChildren(): Promise<TreeItem[]> {
        return this.getCachedOrFetch();
    }

    /** Like getAllChildren but from an optional root folder (for Project Logs panel override). */
    async getAllChildrenFromRoot(logDirOverride: vscode.Uri | undefined): Promise<TreeItem[]> {
        if (logDirOverride) { return fetchItemsCore(this, logDirOverride); }
        return this.getCachedOrFetch();
    }

    /** Return cached items if available, or deduplicate a single in-flight fetch. */
    private async getCachedOrFetch(): Promise<TreeItem[]> {
        if (this.itemsCache) { return this.itemsCache; }
        if (this.fetchInFlight) { return this.fetchInFlight; }
        const promise = fetchItemsCore(this).then(items => {
            if (this.fetchInFlight === promise) {
                this.itemsCache = items;
                this.fetchInFlight = undefined;
                this.computeDuplicateBasenames(items);
            }
            return items;
        }).catch(() => {
            if (this.fetchInFlight === promise) { this.fetchInFlight = undefined; }
            return [];
        });
        this.fetchInFlight = promise;
        return promise;
    }

    dispose(): void {
        if (this.refreshTimer) { clearTimeout(this.refreshTimer); }
        this.watcher?.dispose();
        this._onDidChange.dispose();
    }

    private setupWatcher(): void {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) { return; }
        const logDir = getLogDirectoryUri(folder);
        const { fileTypes, includeSubfolders } = getConfig();
        const glob = includeSubfolders ? `**/${getFileTypeGlob(fileTypes)}` : getFileTypeGlob(fileTypes);
        const pattern = new vscode.RelativePattern(logDir, glob);
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.watcher.onDidCreate(() => this.refresh());
        this.watcher.onDidDelete(() => this.refresh());
        this.watcher.onDidChange(() => this.debouncedRefresh());
    }

    private debouncedRefresh(): void {
        if (this.refreshTimer) { clearTimeout(this.refreshTimer); }
        this.refreshTimer = setTimeout(() => { this.refresh(); }, this.getRefreshInterval());
    }

    private getRefreshInterval(): number {
        const cfg = getConfig().treeRefreshInterval;
        if (cfg > 0) { return cfg * 1000; }
        if (this.activeLineCount > 10_000) { return 30_000; }
        if (this.activeLineCount > 1_000) { return 10_000; }
        return 3_000;
    }

    /** Find basenames that appear more than once (need subfolder prefix). */
    private computeDuplicateBasenames(items: readonly TreeItem[]): void {
        const counts = new Map<string, number>();
        for (const item of items) {
            const label = isSplitGroup(item)
                ? (item.displayName ?? item.baseFilename)
                : (item.displayName ?? item.filename);
            const bn = getBasename(label);
            counts.set(bn, (counts.get(bn) ?? 0) + 1);
        }
        this.duplicateBasenames = new Set<string>();
        for (const [bn, count] of counts) {
            if (count > 1) { this.duplicateBasenames.add(bn); }
        }
    }
}

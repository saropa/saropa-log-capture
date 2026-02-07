import * as vscode from 'vscode';
import { getConfig, getFileTypeGlob, getLogDirectoryUri, readTrackedFiles } from '../modules/config';
import { SessionMetadataStore } from '../modules/session-metadata';
import {
    SessionMetadata, SplitGroup, TreeItem,
    isSplitGroup, groupSplitFiles, buildSplitGroupTooltip, formatSize, matchesTagFilter, totalLineCount,
} from './session-history-grouping';
import { applyDisplayOptions, SessionDisplayOptions, defaultDisplayOptions } from './session-display';
import { parseHeader, buildDescription, buildTooltip, formatCount } from './session-history-helpers';

/** Tree data provider for listing past log sessions from the reports directory. */
export class SessionHistoryProvider implements vscode.TreeDataProvider<TreeItem>, vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChange.event;
    private watcher: vscode.FileSystemWatcher | undefined;
    private activeUri: vscode.Uri | undefined;
    private activeLineCount = 0;
    private readonly metaStore = new SessionMetadataStore();
    private readonly metaCache = new Map<string, SessionMetadata>();
    private displayOptions: SessionDisplayOptions = defaultDisplayOptions;
    private tagFilter: ReadonlySet<string> | undefined;
    private showTrash = false;
    private refreshTimer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        this.setupWatcher();
    }

    /** Update display options used when rendering tree item labels. */
    setDisplayOptions(options: SessionDisplayOptions): void {
        this.displayOptions = options;
    }

    /** Set tag filter (undefined = show all). Refreshes tree automatically. */
    setTagFilter(tags: ReadonlySet<string> | undefined): void { this.tagFilter = tags; this.refresh(); }
    /** Get the current tag filter. */
    getTagFilter(): ReadonlySet<string> | undefined { return this.tagFilter; }

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
        const rawLabel = item.displayName ?? item.filename;
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

    /** Invalidate cached metadata for a URI (e.g. after sidecar change). */
    invalidateMeta(uri: vscode.Uri): void {
        const prefix = uri.toString() + '|';
        for (const key of this.metaCache.keys()) {
            if (key.startsWith(prefix)) { this.metaCache.delete(key); break; }
        }
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

        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return [];
        }
        const logDir = getLogDirectoryUri(folder);
        try {
            const { fileTypes, includeSubfolders } = getConfig();
            const logFiles = await readTrackedFiles(logDir, fileTypes, includeSubfolders);
            const items = await Promise.all(logFiles.map(rel => this.loadMetadata(logDir, rel)));
            this.pruneCache(items);
            const visible = this.showTrash ? items : items.filter(i => !i.trashed);
            const grouped = groupSplitFiles(visible);
            const sorted = grouped.sort((a, b) => b.mtime - a.mtime);
            if (this.tagFilter && this.tagFilter.size > 0) {
                return sorted.filter(item => matchesTagFilter(item, this.tagFilter!));
            }
            return sorted;
        } catch {
            return [];
        }
    }

    dispose(): void {
        if (this.refreshTimer) { clearTimeout(this.refreshTimer); }
        this.watcher?.dispose();
        this._onDidChange.dispose();
    }

    private setupWatcher(): void {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return;
        }
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

    /** Remove cache entries for files no longer present on disk. */
    private pruneCache(currentItems: SessionMetadata[]): void {
        const liveUris = new Set(currentItems.map(i => i.uri.toString()));
        for (const [key] of this.metaCache) {
            const uri = key.slice(0, key.indexOf('|'));
            if (!liveUris.has(uri)) { this.metaCache.delete(key); }
        }
    }

    private async loadMetadata(logDir: vscode.Uri, filename: string): Promise<SessionMetadata> {
        const uri = vscode.Uri.joinPath(logDir, filename);
        const stat = await vscode.workspace.fs.stat(uri);
        const cacheKey = `${uri.toString()}|${stat.mtime}|${stat.size}`;
        const cached = this.metaCache.get(cacheKey);
        if (cached) { return cached; }
        let meta: SessionMetadata = { uri, filename, size: stat.size, mtime: stat.mtime };
        meta = await parseHeader(uri, meta);
        const sidecar = await this.metaStore.loadMetadata(uri);
        if (sidecar.displayName) { meta = { ...meta, displayName: sidecar.displayName }; }
        if (sidecar.tags && sidecar.tags.length > 0) { meta = { ...meta, tags: sidecar.tags }; }
        if (sidecar.autoTags && sidecar.autoTags.length > 0) { meta = { ...meta, autoTags: sidecar.autoTags }; }
        if (sidecar.correlationTags && sidecar.correlationTags.length > 0) {
            meta = { ...meta, correlationTags: sidecar.correlationTags };
        }
        if (sidecar.trashed) { meta = { ...meta, trashed: true }; }
        this.metaCache.set(cacheKey, meta);
        return meta;
    }
}

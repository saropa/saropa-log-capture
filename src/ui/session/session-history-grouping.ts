/**
 * Split file grouping for session history.
 *
 * Detects split log files (e.g., session_001.log, session_002.log),
 * groups them under a parent entry in the tree view, and provides
 * tooltip formatting for group items.
 */

import * as vscode from 'vscode';

/** A session file's metadata used by the history tree. */
export interface SessionMetadata {
    readonly uri: vscode.Uri;
    readonly filename: string;
    readonly date?: string;
    readonly project?: string;
    readonly adapter?: string;
    readonly lineCount?: number;
    readonly size: number;
    readonly displayName?: string;
    readonly tags?: string[];
    readonly autoTags?: string[];
    readonly correlationTags?: string[];
    readonly durationMs?: number;
    readonly errorCount?: number;
    readonly warningCount?: number;
    readonly perfCount?: number;
    readonly anrCount?: number;
    readonly fwCount?: number;
    readonly infoCount?: number;
    readonly hasTimestamps?: boolean;
    readonly partNumber?: number;
    readonly trashed?: boolean;
    readonly mtime: number; // File modification time (epoch ms)
    /** True when session meta has performance integration data (snapshot or samples). */
    readonly hasPerformanceData?: boolean;
    /** Session-group id. Every file sharing this id is one logical Session. Undefined = ungrouped. */
    readonly groupId?: string;
    /** DAP debug adapter type (e.g. "dart", "node"). Set only on the debug-session's main log file.
     *  Used by `getPrimaryMember()` to pick which file represents the group at a glance. */
    readonly debugAdapterType?: string;
}

/** Group of split files under a single parent session. */
export interface SplitGroup {
    readonly type: 'split-group';
    readonly baseFilename: string;
    readonly parts: SessionMetadata[];
    readonly totalSize: number;
    readonly date?: string;
    readonly project?: string;
    readonly adapter?: string;
    readonly displayName?: string;
    readonly mtime: number; // Most recent part's mtime
}

/**
 * Logical session group \u2014 a set of log files (possibly including SplitGroups)
 * that share a `groupId`, coalesced into one tree entry.
 *
 * Several fields (`uri`, `filename`, `size`, `displayName`, `trashed`) are
 * derived from the primary member so existing call sites that operate on
 * `TreeItem` without discriminating on `type` keep working \u2014 they see the
 * group's representative values. Group-specific logic (webview rendering,
 * multi-file open) checks `isSessionGroup(item)` and reads `.members` /
 * `.primary` directly.
 */
export interface SessionGroup {
    readonly type: 'session-group';
    readonly groupId: string;
    /** Members in ascending mtime order. Always length \u2265 2 (singletons are not promoted). */
    readonly members: readonly TreeItem[];
    /** The primary member (also present in `members`). */
    readonly primary: TreeItem;
    /** Earliest member mtime \u2014 used to sort the group within the tree. */
    readonly mtime: number;
    /** Latest member mtime \u2014 useful for labels like "12:35\u201312:37 AM". */
    readonly latestMtime: number;
    // ---- Fields derived from `primary` so SessionGroup can stand in for SessionMetadata ----
    /** Primary's URI \u2014 used by click-to-open and existing file-scoped code paths. */
    readonly uri: vscode.Uri;
    /** Primary's filename (or SplitGroup baseFilename if primary is a split). */
    readonly filename: string;
    /** Primary's displayName if any. */
    readonly displayName?: string;
    /** True when the primary is trashed (for Logs panel trash-view filtering). */
    readonly trashed?: boolean;
    /** Sum of every member's size \u2014 the whole group's disk footprint. */
    readonly size: number;
}

/** Tree item representing a single session, a split parent group, or a session group. */
export type TreeItem = SessionMetadata | SplitGroup | SessionGroup;

/** Type guard: check if a tree item is a SplitGroup. */
export function isSplitGroup(item: TreeItem): item is SplitGroup {
    return (item as { type?: string }).type === 'split-group';
}

/** Type guard: check if a tree item is a SessionGroup. */
export function isSessionGroup(item: TreeItem): item is SessionGroup {
    return (item as { type?: string }).type === 'session-group';
}

/** Get the primary URI for a tree item. For groups, recurses into the primary member. */
export function getTreeItemUri(item: TreeItem): vscode.Uri {
    if (isSessionGroup(item)) { return getTreeItemUri(item.primary); }
    if (isSplitGroup(item)) {
        const sorted = [...item.parts].sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0));
        return sorted[0].uri;
    }
    return item.uri;
}

/**
 * Extract the `groupId` from a tree item. For `SessionMetadata` that's the
 * direct field; for `SplitGroup` we read the first part's field (all parts of
 * a split share the same groupId because they came from the same DAP session).
 * `SessionGroup` inputs do not reach this function \u2014 coalescing runs on the
 * flat output of `groupSplitFiles()` which never returns SessionGroup.
 */
function getTreeItemGroupId(item: TreeItem): string | undefined {
    if (isSessionGroup(item)) { return item.groupId; }
    if (isSplitGroup(item)) { return item.parts[0]?.groupId; }
    return item.groupId;
}

/**
 * Extract the debug adapter type for primary-member selection. Only
 * `SessionMetadata` (and therefore the parts of a `SplitGroup`) can carry
 * this \u2014 it's set by `session-lifecycle-finalize.ts` when a DAP session
 * finalises.
 */
function getTreeItemAdapter(item: TreeItem): string | undefined {
    if (isSessionGroup(item)) { return undefined; }
    if (isSplitGroup(item)) { return item.parts[0]?.debugAdapterType; }
    return item.debugAdapterType;
}

/**
 * Pick the primary member of a session group using the same rule as
 * `getPrimaryMember()` in modules/session/session-groups.ts:
 *   1. Any member with a non-empty `debugAdapterType` wins (earliest mtime as
 *      tie-breaker when multiple DAP members exist).
 *   2. Otherwise, earliest-mtime member wins.
 */
function pickPrimaryTreeItem(members: readonly TreeItem[]): TreeItem {
    const dap = members.filter(m => {
        const a = getTreeItemAdapter(m);
        return typeof a === 'string' && a.length > 0;
    });
    if (dap.length > 0) {
        return dap.reduce((earliest, m) => (m.mtime < earliest.mtime ? m : earliest));
    }
    return members.reduce((earliest, m) => (m.mtime < earliest.mtime ? m : earliest));
}

/**
 * Coalesce tree items that share a `groupId` into a single `SessionGroup`.
 *
 * Runs AFTER `groupSplitFiles()`. Input may contain `SessionMetadata` and
 * `SplitGroup` entries; output replaces multi-member groups with `SessionGroup`
 * wrappers and leaves ungrouped items plus singletons untouched.
 *
 * Singletons stay as standalone entries \u2014 a group-of-one is indistinguishable
 * from an ungrouped file in the tree, so we don't wrap it.
 */
export function groupSessionGroups(items: readonly TreeItem[]): TreeItem[] {
    const buckets = new Map<string, TreeItem[]>();
    const ungrouped: TreeItem[] = [];
    for (const item of items) {
        const gid = getTreeItemGroupId(item);
        if (!gid) { ungrouped.push(item); continue; }
        const bucket = buckets.get(gid);
        if (bucket) { bucket.push(item); } else { buckets.set(gid, [item]); }
    }
    const result: TreeItem[] = [...ungrouped];
    for (const [groupId, members] of buckets) {
        if (members.length < 2) { result.push(members[0]); continue; }
        const sorted = [...members].sort((a, b) => a.mtime - b.mtime);
        const primary = pickPrimaryTreeItem(sorted);
        const totalSize = sorted.reduce((sum, m) => sum + getTreeItemSize(m), 0);
        result.push({
            type: 'session-group',
            groupId,
            members: sorted,
            primary,
            mtime: sorted[0].mtime,
            latestMtime: sorted[sorted.length - 1].mtime,
            uri: getTreeItemUri(primary),
            filename: getTreeItemFilename(primary),
            displayName: getTreeItemDisplayName(primary),
            trashed: getTreeItemTrashed(primary),
            size: totalSize,
        });
    }
    return result;
}

/** Derive a filename suitable for display from any TreeItem. SplitGroup uses its baseFilename. */
function getTreeItemFilename(item: TreeItem): string {
    if (isSessionGroup(item)) { return item.filename; }
    if (isSplitGroup(item)) { return item.baseFilename; }
    return item.filename;
}

/** Derive a displayName (optional) from any TreeItem. */
function getTreeItemDisplayName(item: TreeItem): string | undefined {
    if (isSessionGroup(item)) { return item.displayName; }
    if (isSplitGroup(item)) { return item.displayName; }
    return item.displayName;
}

/** Derive the trashed flag from any TreeItem. For SplitGroup/SessionGroup, reads the primary. */
function getTreeItemTrashed(item: TreeItem): boolean | undefined {
    if (isSessionGroup(item)) { return item.trashed; }
    if (isSplitGroup(item)) { return item.parts[0]?.trashed; }
    return item.trashed;
}

/** Derive the size from any TreeItem. SplitGroup sums its parts; SessionGroup sums its members. */
function getTreeItemSize(item: TreeItem): number {
    if (isSessionGroup(item)) { return item.size; }
    if (isSplitGroup(item)) { return item.totalSize; }
    return item.size;
}

/** Pattern to detect split file parts: _001.log, _001.txt, etc. */
const SPLIT_PART_PATTERN = /^(.+)_(\d{3})\.(log|txt|md|csv|json|jsonl|html)$/;

/** Known file extensions for splitting the extension from the base name. */
const knownExtRe = /\.(log|txt|md|csv|json|jsonl|html)$/i;

/** Extract base filename, part number, and extension from a split filename. */
function parseSplitFilename(filename: string): { base: string; part: number; ext: string } | null {
    const match = filename.match(SPLIT_PART_PATTERN);
    if (match) {
        return { base: match[1], part: parseInt(match[2], 10), ext: '.' + match[3] };
    }
    return null;
}

/** Group split files under their parent session. */
export function groupSplitFiles(items: SessionMetadata[]): TreeItem[] {
    const groups = new Map<string, SessionMetadata[]>();
    const standalone: SessionMetadata[] = [];

    for (const item of items) {
        const parsed = parseSplitFilename(item.filename);
        if (parsed) {
            if (!groups.has(parsed.base)) { groups.set(parsed.base, []); }
            groups.get(parsed.base)!.push({ ...item, partNumber: parsed.part });
            continue;
        }
        const extMatch = item.filename.match(knownExtRe);
        if (!extMatch) { continue; }
        const base = item.filename.slice(0, extMatch.index);
        const hasParts = items.some(i => parseSplitFilename(i.filename)?.base === base);
        if (!hasParts) { standalone.push(item); continue; }
        if (!groups.has(base)) { groups.set(base, []); }
        groups.get(base)!.unshift({ ...item, partNumber: 1 });
    }

    const result: TreeItem[] = [...standalone];

    for (const [base, parts] of groups) {
        if (parts.length === 1) {
            result.push(parts[0]);
        } else {
            const firstPart = parts.find(p => p.partNumber === 1) ?? parts[0];
            const mostRecentMtime = Math.max(...parts.map(p => p.mtime));
            const firstExt = firstPart.filename.match(knownExtRe)?.[0] ?? '.log';
            const group: SplitGroup = {
                type: 'split-group',
                baseFilename: base + firstExt,
                parts,
                totalSize: parts.reduce((sum, p) => sum + p.size, 0),
                date: firstPart.date,
                project: firstPart.project,
                adapter: firstPart.adapter,
                displayName: firstPart.displayName,
                mtime: mostRecentMtime,
            };
            result.push(group);
        }
    }

    return result;
}

/** Sum line counts across all parts of a split group. */
export function totalLineCount(group: SplitGroup): number {
    return group.parts.reduce((sum, p) => sum + (p.lineCount ?? 0), 0);
}

/** Format a tooltip for a split group showing metadata. */
export function buildSplitGroupTooltip(group: SplitGroup): string {
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
    const total = totalLineCount(group);
    if (total > 0) { parts.push(`Total lines: ${total.toLocaleString('en-US')}`); }
    parts.push(`Total size: ${formatSize(group.totalSize)}`);
    return parts.join('\n');
}

/** Format bytes to a human-readable size string. */
export function formatSize(bytes: number): string {
    if (bytes < 1024) { return `${bytes} B`; }
    if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


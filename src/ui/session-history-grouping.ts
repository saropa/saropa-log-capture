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
    readonly hasTimestamps?: boolean;
    readonly partNumber?: number;
    readonly mtime: number; // File modification time (epoch ms)
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

/** Tree item representing either a single session or a split parent group. */
export type TreeItem = SessionMetadata | SplitGroup;

/** Type guard: check if a tree item is a SplitGroup. */
export function isSplitGroup(item: TreeItem): item is SplitGroup {
    return (item as SplitGroup).type === 'split-group';
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
            const key = parsed.base;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push({ ...item, partNumber: parsed.part });
        } else {
            const extMatch = item.filename.match(knownExtRe);
            if (!extMatch) { continue; }
            const base = item.filename.slice(0, extMatch.index);
            const hasParts = items.some(i => parseSplitFilename(i.filename)?.base === base);
            if (hasParts) {
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
    parts.push(`Total size: ${formatSize(group.totalSize)}`);
    return parts.join('\n');
}

/** Format bytes to a human-readable size string. */
export function formatSize(bytes: number): string {
    if (bytes < 1024) { return `${bytes} B`; }
    if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Check if a tree item has any correlation tag in the filter set. */
export function matchesTagFilter(item: TreeItem, filter: ReadonlySet<string>): boolean {
    if (isSplitGroup(item)) { return item.parts.some(p => hasCorrelationTag(p, filter)); }
    return hasCorrelationTag(item, filter);
}

function hasCorrelationTag(meta: SessionMetadata, filter: ReadonlySet<string>): boolean {
    return meta.correlationTags?.some(t => filter.has(t)) ?? false;
}

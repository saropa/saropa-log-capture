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
    readonly partNumber?: number;
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
}

/** Tree item representing either a single session or a split parent group. */
export type TreeItem = SessionMetadata | SplitGroup;

/** Type guard: check if a tree item is a SplitGroup. */
export function isSplitGroup(item: TreeItem): item is SplitGroup {
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
        } else if (item.filename.endsWith('.log')) {
            const base = item.filename.replace(/\.log$/, '');
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
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

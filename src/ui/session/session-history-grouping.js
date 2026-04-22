"use strict";
/**
 * Split file grouping for session history.
 *
 * Detects split log files (e.g., session_001.log, session_002.log),
 * groups them under a parent entry in the tree view, and provides
 * tooltip formatting for group items.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSplitGroup = isSplitGroup;
exports.isSessionGroup = isSessionGroup;
exports.getTreeItemUri = getTreeItemUri;
exports.groupSessionGroups = groupSessionGroups;
exports.groupSplitFiles = groupSplitFiles;
exports.totalLineCount = totalLineCount;
exports.buildSplitGroupTooltip = buildSplitGroupTooltip;
exports.formatSize = formatSize;
/** Type guard: check if a tree item is a SplitGroup. */
function isSplitGroup(item) {
    return item.type === 'split-group';
}
/** Type guard: check if a tree item is a SessionGroup. */
function isSessionGroup(item) {
    return item.type === 'session-group';
}
/** Get the primary URI for a tree item. For groups, recurses into the primary member. */
function getTreeItemUri(item) {
    if (isSessionGroup(item)) {
        return getTreeItemUri(item.primary);
    }
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
function getTreeItemGroupId(item) {
    if (isSessionGroup(item)) {
        return item.groupId;
    }
    if (isSplitGroup(item)) {
        return item.parts[0]?.groupId;
    }
    return item.groupId;
}
/**
 * Extract the debug adapter type for primary-member selection. Only
 * `SessionMetadata` (and therefore the parts of a `SplitGroup`) can carry
 * this \u2014 it's set by `session-lifecycle-finalize.ts` when a DAP session
 * finalises.
 */
function getTreeItemAdapter(item) {
    if (isSessionGroup(item)) {
        return undefined;
    }
    if (isSplitGroup(item)) {
        return item.parts[0]?.debugAdapterType;
    }
    return item.debugAdapterType;
}
/**
 * Pick the primary member of a session group using the same rule as
 * `getPrimaryMember()` in modules/session/session-groups.ts:
 *   1. Any member with a non-empty `debugAdapterType` wins (earliest mtime as
 *      tie-breaker when multiple DAP members exist).
 *   2. Otherwise, earliest-mtime member wins.
 */
function pickPrimaryTreeItem(members) {
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
function groupSessionGroups(items) {
    const buckets = new Map();
    const ungrouped = [];
    for (const item of items) {
        const gid = getTreeItemGroupId(item);
        if (!gid) {
            ungrouped.push(item);
            continue;
        }
        const bucket = buckets.get(gid);
        if (bucket) {
            bucket.push(item);
        }
        else {
            buckets.set(gid, [item]);
        }
    }
    const result = [...ungrouped];
    for (const [groupId, members] of buckets) {
        if (members.length < 2) {
            result.push(members[0]);
            continue;
        }
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
function getTreeItemFilename(item) {
    if (isSessionGroup(item)) {
        return item.filename;
    }
    if (isSplitGroup(item)) {
        return item.baseFilename;
    }
    return item.filename;
}
/** Derive a displayName (optional) from any TreeItem. */
function getTreeItemDisplayName(item) {
    if (isSessionGroup(item)) {
        return item.displayName;
    }
    if (isSplitGroup(item)) {
        return item.displayName;
    }
    return item.displayName;
}
/** Derive the trashed flag from any TreeItem. For SplitGroup/SessionGroup, reads the primary. */
function getTreeItemTrashed(item) {
    if (isSessionGroup(item)) {
        return item.trashed;
    }
    if (isSplitGroup(item)) {
        return item.parts[0]?.trashed;
    }
    return item.trashed;
}
/** Derive the size from any TreeItem. SplitGroup sums its parts; SessionGroup sums its members. */
function getTreeItemSize(item) {
    if (isSessionGroup(item)) {
        return item.size;
    }
    if (isSplitGroup(item)) {
        return item.totalSize;
    }
    return item.size;
}
/** Pattern to detect split file parts: _001.log, _001.txt, etc. */
const SPLIT_PART_PATTERN = /^(.+)_(\d{3})\.(log|txt|md|csv|json|jsonl|html)$/;
/** Known file extensions for splitting the extension from the base name. */
const knownExtRe = /\.(log|txt|md|csv|json|jsonl|html)$/i;
/** Extract base filename, part number, and extension from a split filename. */
function parseSplitFilename(filename) {
    const match = filename.match(SPLIT_PART_PATTERN);
    if (match) {
        return { base: match[1], part: parseInt(match[2], 10), ext: '.' + match[3] };
    }
    return null;
}
/** Group split files under their parent session. */
function groupSplitFiles(items) {
    const groups = new Map();
    const standalone = [];
    for (const item of items) {
        const parsed = parseSplitFilename(item.filename);
        if (parsed) {
            if (!groups.has(parsed.base)) {
                groups.set(parsed.base, []);
            }
            groups.get(parsed.base).push({ ...item, partNumber: parsed.part });
            continue;
        }
        const extMatch = item.filename.match(knownExtRe);
        if (!extMatch) {
            continue;
        }
        const base = item.filename.slice(0, extMatch.index);
        const hasParts = items.some(i => parseSplitFilename(i.filename)?.base === base);
        if (!hasParts) {
            standalone.push(item);
            continue;
        }
        if (!groups.has(base)) {
            groups.set(base, []);
        }
        groups.get(base).unshift({ ...item, partNumber: 1 });
    }
    const result = [...standalone];
    for (const [base, parts] of groups) {
        if (parts.length === 1) {
            result.push(parts[0]);
        }
        else {
            const firstPart = parts.find(p => p.partNumber === 1) ?? parts[0];
            const mostRecentMtime = Math.max(...parts.map(p => p.mtime));
            const firstExt = firstPart.filename.match(knownExtRe)?.[0] ?? '.log';
            const group = {
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
function totalLineCount(group) {
    return group.parts.reduce((sum, p) => sum + (p.lineCount ?? 0), 0);
}
/** Format a tooltip for a split group showing metadata. */
function buildSplitGroupTooltip(group) {
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
    if (total > 0) {
        parts.push(`Total lines: ${total.toLocaleString('en-US')}`);
    }
    parts.push(`Total size: ${formatSize(group.totalSize)}`);
    return parts.join('\n');
}
/** Format bytes to a human-readable size string. */
function formatSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//# sourceMappingURL=session-history-grouping.js.map
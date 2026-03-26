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
exports.groupSplitFiles = groupSplitFiles;
exports.totalLineCount = totalLineCount;
exports.buildSplitGroupTooltip = buildSplitGroupTooltip;
exports.formatSize = formatSize;
/** Type guard: check if a tree item is a SplitGroup. */
function isSplitGroup(item) {
    return item.type === 'split-group';
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
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectFilesToTrash = selectFilesToTrash;
exports.setRetentionGroupContext = setRetentionGroupContext;
exports.enforceFileRetention = enforceFileRetention;
exports.expandGroupsForTrash = expandGroupsForTrash;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const config_1 = require("./config");
const project_indexer_1 = require("../project-indexer/project-indexer");
let hasNotifiedThisSession = false;
/**
 * Pure selection logic: given file stats (name, mtime) and max count, return the names
 * of the oldest files that should be trashed so the remaining count <= maxLogFiles.
 * Sorted oldest first. Exported for unit testing.
 */
function selectFilesToTrash(fileStats, maxLogFiles) {
    if (maxLogFiles <= 0 || fileStats.length <= maxLogFiles) {
        return [];
    }
    const sorted = [...fileStats].sort((a, b) => a.mtime - b.mtime);
    const toTrash = sorted.length - maxLogFiles;
    return sorted.slice(0, toTrash).map((f) => f.name);
}
function removeReportFromIndex(uri) {
    if (!(0, config_1.getConfig)().projectIndex.enabled) {
        return;
    }
    const idx = (0, project_indexer_1.getGlobalProjectIndexer)();
    if (idx) {
        idx.removeEntry('reports', vscode.workspace.asRelativePath(uri).replace(/\\/g, '/')).catch(() => { });
    }
}
/**
 * Module-level holder for the retention group context.
 *
 * Threading this through every call site (session-manager-start, session-lifecycle-init,
 * enforceFileRetention) would churn ~4 interface signatures for one optional parameter, so we
 * accept one sanctioned module-level state: `extension-activation.ts` calls `setRetentionGroupContext`
 * once during wiring and retention reads it at sweep time. The holder is process-local and cleared
 * on deactivation via the `undefined` setter.
 */
let sharedGroupContext;
/** Inject the retention group context (tracker). Called once during activation. */
function setRetentionGroupContext(ctx) {
    sharedGroupContext = ctx;
}
/**
 * Enforce the maxLogFiles limit. Trashes oldest tracked files by mtime
 * until file count <= maxLogFiles. Includes subdirectories when enabled.
 *
 * Session-group awareness (optional, via `groupCtx`):
 *   - Files whose `groupId` matches the tracker's ACTIVE id are SKIPPED: retention
 *     never touches a group that's still being written to by a live DAP session.
 *   - Files whose `groupId` points at a CLOSED group are expanded: all members
 *     get trashed atomically so the group can never be half-deleted. This may push
 *     the non-trashed count briefly below the cap, which is preferred over leaving
 *     orphan group members.
 *   - Ungrouped files follow the original per-file rule.
 *
 * @returns The number of files trashed (after group expansion).
 */
async function enforceFileRetention(logDirUri, maxLogFiles, metaStore, groupCtxArg) {
    const groupCtx = groupCtxArg ?? sharedGroupContext;
    if (maxLogFiles <= 0) {
        return 0;
    }
    const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
    const logFiles = await (0, config_1.readTrackedFiles)(logDirUri, fileTypes, includeSubfolders);
    if (logFiles.length <= maxLogFiles) {
        return 0;
    }
    // Read the whole metadata map once \u2014 the group-expansion step needs it, and the trashed
    // filter needs per-file meta anyway, so pay the I/O once.
    const metaMap = await metaStore.loadAllMetadata(logDirUri);
    const fileStats = await collectFileStats(logDirUri, logFiles, metaMap);
    const candidateNames = selectFilesToTrash(fileStats, maxLogFiles);
    if (candidateNames.length === 0) {
        return 0;
    }
    const expanded = expandGroupsForTrash(candidateNames, metaMap, groupCtx?.getActiveGroupId());
    if (expanded.size === 0) {
        return 0;
    }
    let trashed = 0;
    for (const name of expanded) {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, name);
            await metaStore.setTrashed(uri, true);
            removeReportFromIndex(uri);
            trashed++;
        }
        catch {
            // File may be locked \u2014 skip it.
        }
    }
    if (trashed > 0 && !hasNotifiedThisSession) {
        hasNotifiedThisSession = true;
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.fileRetentionMoved', String(trashed), String(maxLogFiles)));
    }
    return trashed;
}
/** Stat every tracked file, skip trashed ones, return the subset with valid mtimes. */
async function collectFileStats(logDirUri, logFiles, metaMap) {
    const results = await Promise.all(logFiles.map(async (name) => {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, name);
            const relKey = vscode.workspace.asRelativePath(uri).replace(/\\/g, '/');
            const meta = metaMap.get(relKey);
            if (meta?.trashed) {
                return undefined;
            }
            const stat = await vscode.workspace.fs.stat(uri);
            return { name, mtime: stat.mtime };
        }
        catch {
            return undefined;
        }
    }));
    return results.filter((r) => r !== undefined);
}
/**
 * Expand a list of candidate names into the actual set to trash, respecting session groups:
 *   - Active-group members are skipped entirely.
 *   - Closed-group members expand to include every file sharing the groupId.
 *   - Ungrouped files pass through as-is.
 * Returns a Set for efficient dedup \u2014 multiple candidates in the same group collapse to one entry.
 * Exported for unit testing.
 */
function expandGroupsForTrash(candidateNames, metaMap, activeGroupId) {
    const out = new Set();
    // Build a reverse index on demand: groupId \u2192 [relPath, ...] so group expansion is O(1) per lookup.
    let byGroup;
    const ensureByGroup = () => {
        if (byGroup) {
            return byGroup;
        }
        byGroup = new Map();
        for (const [relPath, meta] of metaMap) {
            if (!meta.groupId) {
                continue;
            }
            const list = byGroup.get(meta.groupId);
            if (list) {
                list.push(relPath);
            }
            else {
                byGroup.set(meta.groupId, [relPath]);
            }
        }
        return byGroup;
    };
    for (const name of candidateNames) {
        const meta = metaMap.get(name);
        if (!meta?.groupId) {
            out.add(name);
            continue;
        }
        if (meta.groupId === activeGroupId) {
            continue;
        } // active \u2014 skip entire group
        const members = ensureByGroup().get(meta.groupId) ?? [name];
        for (const m of members) {
            out.add(m);
        }
    }
    return out;
}
//# sourceMappingURL=file-retention.js.map
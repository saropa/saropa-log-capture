"use strict";
/**
 * Fetch, cache, and migration logic for SessionHistoryProvider.
 * Extracted to keep session-history-provider.ts under the line limit.
 */
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
exports.fetchItemsCore = fetchItemsCore;
const vscode = __importStar(require("vscode"));
const config_1 = require("../../modules/config/config");
const session_metadata_1 = require("../../modules/session/session-metadata");
const session_history_grouping_1 = require("./session-history-grouping");
const session_history_metadata_1 = require("./session-history-metadata");
const migratedDirsThisActivation = new Set();
/** Run one-time sidecar migration for all relevant directories. */
async function migrateIfNeeded(folder, configuredDir, logDirOverride) {
    const allDirs = [configuredDir, logDirOverride, folder?.uri]
        .filter((d) => d !== undefined && d !== null);
    const seen = new Set();
    for (const dir of allDirs) {
        const key = dir.toString();
        if (seen.has(key) || migratedDirsThisActivation.has(key)) {
            continue;
        }
        seen.add(key);
        migratedDirsThisActivation.add(key);
        await (0, session_metadata_1.migrateSidecarsInDirectory)(dir, folder ?? undefined);
    }
}
/** Fetch session items from disk, loading metadata and grouping split files. */
async function fetchItemsCore(target, logDirOverride, callbacks) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder && !logDirOverride) {
        return [];
    }
    const configuredDir = folder ? (0, config_1.getLogDirectoryUri)(folder) : undefined;
    const logDir = logDirOverride ?? configuredDir;
    try {
        await migrateIfNeeded(folder ?? undefined, configuredDir, logDirOverride);
    }
    catch { /* migration is best-effort */ }
    try {
        const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
        const logFiles = await (0, config_1.readTrackedFiles)(logDir, fileTypes, includeSubfolders);
        try {
            callbacks?.onFilesListed?.(logFiles, logDir);
        }
        catch { /* preview is non-critical */ }
        const centralMeta = await target.metaStore.loadAllMetadata(logDir);
        const items = await (0, session_history_metadata_1.loadBatch)(target, logDir, logFiles, { centralMeta, onItemLoaded: callbacks?.onItemLoaded });
        pruneCache(target, items);
        const grouped = (0, session_history_grouping_1.groupSplitFiles)(items);
        return grouped.sort((a, b) => b.mtime - a.mtime);
    }
    catch {
        return [];
    }
}
/** Remove cache entries for files no longer present on disk. */
function pruneCache(target, currentItems) {
    const liveUris = new Set(currentItems.map(i => i.uri.toString()));
    for (const [key] of target.metaCache) {
        const uri = key.slice(0, key.indexOf('|'));
        if (!liveUris.has(uri)) {
            target.metaCache.delete(key);
        }
    }
}
//# sourceMappingURL=session-history-fetching.js.map
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
exports.enforceFileRetention = enforceFileRetention;
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
 * Enforce the maxLogFiles limit. Trashes oldest tracked files by mtime
 * until file count <= maxLogFiles. Includes subdirectories when enabled.
 * @returns The number of files trashed.
 */
async function enforceFileRetention(logDirUri, maxLogFiles, metaStore) {
    if (maxLogFiles <= 0) {
        return 0;
    }
    const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
    const logFiles = await (0, config_1.readTrackedFiles)(logDirUri, fileTypes, includeSubfolders);
    if (logFiles.length <= maxLogFiles) {
        return 0;
    }
    // Only count non-trashed files toward the limit.
    const results = await Promise.all(logFiles.map(async (name) => {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, name);
            const meta = await metaStore.loadMetadata(uri);
            if (meta.trashed) {
                return undefined;
            }
            const stat = await vscode.workspace.fs.stat(uri);
            return { name, mtime: stat.mtime };
        }
        catch {
            return undefined;
        }
    }));
    const fileStats = results.filter((r) => r !== undefined);
    const namesToTrash = selectFilesToTrash(fileStats, maxLogFiles);
    if (namesToTrash.length === 0) {
        return 0;
    }
    let trashed = 0;
    for (const name of namesToTrash) {
        try {
            const uri = vscode.Uri.joinPath(logDirUri, name);
            await metaStore.setTrashed(uri, true);
            removeReportFromIndex(uri);
            trashed++;
        }
        catch {
            // File may be locked — skip it.
        }
    }
    if (trashed > 0 && !hasNotifiedThisSession) {
        hasNotifiedThisSession = true;
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.fileRetentionMoved', String(trashed), String(maxLogFiles)));
    }
    return trashed;
}
//# sourceMappingURL=file-retention.js.map
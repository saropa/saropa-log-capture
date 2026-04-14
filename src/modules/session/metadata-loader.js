"use strict";
/**
 * Shared helpers for loading session metadata from the central store.
 * Used by cross-session-aggregator and perf-aggregator.
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
exports.parseSessionDate = parseSessionDate;
exports.filterByTime = filterByTime;
exports.listMetaFiles = listMetaFiles;
exports.loadMeta = loadMeta;
exports.loadFilteredMetas = loadFilteredMetas;
exports.loadMetasForPaths = loadMetasForPaths;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const session_metadata_1 = require("./session-metadata");
const h = 3_600_000;
const d = 24 * h;
const timeRangeMs = {
    '1h': h, '4h': 4 * h, '8h': 8 * h, '24h': d,
    '7d': 7 * d, '30d': 30 * d, '3m': 91 * d,
    '6m': 182 * d, '1y': 365 * d,
};
/** Parse a session date from a log filename like `20260224_163302_....log`. */
function parseSessionDate(filename) {
    const base = filename.split('/').pop() ?? filename;
    const m = base.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (!m) {
        return 0;
    }
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}
/** Filter metadata entries by time range. */
function filterByTime(metas, range, nowMs = Date.now()) {
    if (range === 'all') {
        return metas;
    }
    const cutoff = nowMs - (timeRangeMs[range] ?? 0);
    return metas.filter(m => parseSessionDate(m.filename) >= cutoff);
}
/** List log file relative paths under the configured log directory (used for metadata lookup). */
async function listMetaFiles(logDir) {
    const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
    return (0, config_1.readTrackedFiles)(logDir, fileTypes, includeSubfolders);
}
/** Load metadata for one log file from the central store. */
async function loadMeta(logDir, logRelPath) {
    try {
        const uri = vscode.Uri.joinPath(logDir, logRelPath);
        const store = new session_metadata_1.SessionMetadataStore();
        const meta = await store.loadMetadata(uri);
        return { filename: logRelPath, meta };
    }
    catch {
        return undefined;
    }
}
/** Load all session metadata for the current workspace, filtered by time range. */
async function loadFilteredMetas(timeRange = 'all') {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return [];
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    const entries = await listMetaFiles(logDir);
    const metas = await Promise.all(entries.map(e => loadMeta(logDir, e)));
    const valid = metas.filter((m) => m !== undefined);
    return filterByTime(valid, timeRange);
}
/** Load session metadata only for the given relative paths under the log directory. */
async function loadMetasForPaths(logDir, relativePaths) {
    const metas = await Promise.all(relativePaths.map(p => loadMeta(logDir, p)));
    return metas.filter((m) => m !== undefined);
}
//# sourceMappingURL=metadata-loader.js.map
"use strict";
/**
 * Build the reports source index from the central session metadata store.
 * Reads .session-metadata.json (no per-file .meta.json sidecars).
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
exports.buildReportIndex = buildReportIndex;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const INDEX_VERSION = 1;
/** Build the reports source index from central .session-metadata.json. Skips trashed and active session. */
async function buildReportIndex(workspaceFolder, getActiveLogUri) {
    const logDir = (0, config_1.getLogDirectoryUri)(workspaceFolder);
    const centralUri = vscode.Uri.joinPath(logDir, '.session-metadata.json');
    const activeUri = getActiveLogUri?.();
    const entries = [];
    let data = {};
    try {
        const raw = await vscode.workspace.fs.readFile(centralUri);
        data = JSON.parse(Buffer.from(raw).toString('utf-8'));
    }
    catch {
        return { version: INDEX_VERSION, sourceId: 'reports', buildTime: Date.now(), files: entries };
    }
    for (const key of Object.keys(data)) {
        const meta = data[key];
        if (!meta || meta.trashed) {
            continue;
        }
        const logUri = vscode.Uri.joinPath(workspaceFolder.uri, key);
        if (activeUri && logUri.toString() === activeUri.toString()) {
            continue;
        }
        try {
            const stat = await vscode.workspace.fs.stat(logUri);
            const fingerprints = (meta.fingerprints ?? []).map((fp) => fp.n);
            entries.push({
                relativePath: key.replace(/\\/g, '/'),
                uri: logUri.toString(),
                sizeBytes: stat.size,
                mtime: stat.mtime,
                displayName: meta.displayName,
                tags: meta.tags,
                correlationTokens: meta.correlationTags ?? [],
                fingerprints,
                errorCount: meta.errorCount,
                warningCount: meta.warningCount,
            });
        }
        catch { /* log file gone */ }
    }
    return { version: INDEX_VERSION, sourceId: 'reports', buildTime: Date.now(), files: entries };
}
//# sourceMappingURL=build-report-index.js.map
"use strict";
/**
 * Migration of .meta.json sidecars into the central .session-metadata.json store.
 * Also cleans up orphan sidecars (created by a bug where the extension wrote .meta.json
 * next to arbitrary files outside the log directory).
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
exports.isOurSidecar = isOurSidecar;
exports.migrateSidecarsInDirectory = migrateSidecarsInDirectory;
exports.migrateAllSidecarsToCentral = migrateAllSidecarsToCentral;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const maxScanDepth = 10;
/** Returns true if parsed JSON matches the extension's session metadata shape. */
function isOurSidecar(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return false;
    }
    const rec = obj;
    return typeof rec['errorCount'] === 'number' || typeof rec['infoCount'] === 'number'
        || typeof rec['fwCount'] === 'number' || typeof rec['warningCount'] === 'number';
}
/**
 * Migrate .meta.json sidecars in a given directory into the central metadata store.
 * Orphan sidecars (no matching tracked file) are deleted if they match our format.
 * @returns Number of sidecar files migrated or cleaned up.
 */
async function migrateSidecarsInDirectory(logDir, workspaceFolder) {
    const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
    const sidecarRels = await listMetaJsonFiles(logDir, includeSubfolders ? maxScanDepth : 0, '');
    const centralUri = workspaceFolder
        ? vscode.Uri.joinPath((0, config_1.getLogDirectoryUri)(workspaceFolder), '.session-metadata.json')
        : vscode.Uri.joinPath(logDir, '.session-metadata.json');
    let data = {};
    try {
        const raw = await vscode.workspace.fs.readFile(centralUri);
        data = JSON.parse(Buffer.from(raw).toString('utf-8'));
    }
    catch { /* no central file yet */ }
    let migrated = 0;
    let cleaned = 0;
    for (const rel of sidecarRels) {
        const sidecarUri = vscode.Uri.joinPath(logDir, rel);
        const base = rel.replace(/\.meta\.json$/i, '');
        const logRel = await findTrackedFile(logDir, base, fileTypes);
        if (!logRel) {
            cleaned += await deleteIfOurs(sidecarUri);
            continue;
        }
        const logUri = vscode.Uri.joinPath(logDir, logRel);
        const key = vscode.workspace.asRelativePath(logUri).replace(/\\/g, '/');
        try {
            const raw = await vscode.workspace.fs.readFile(sidecarUri);
            const meta = JSON.parse(Buffer.from(raw).toString('utf-8'));
            data[key] = meta;
            await vscode.workspace.fs.delete(sidecarUri);
            migrated++;
        }
        catch { /* skip broken or locked files */ }
    }
    if (migrated > 0) {
        const dir = vscode.Uri.joinPath(centralUri, '..');
        try {
            await vscode.workspace.fs.createDirectory(dir);
        }
        catch { /* may exist */ }
        await vscode.workspace.fs.writeFile(centralUri, Buffer.from(JSON.stringify(data, null, 2), 'utf-8'));
    }
    return migrated + cleaned;
}
/** Find a tracked file matching the sidecar base name. */
async function findTrackedFile(logDir, base, fileTypes) {
    for (const ext of fileTypes) {
        const e = ext.startsWith('.') ? ext : `.${ext}`;
        const candidate = base + e;
        try {
            await vscode.workspace.fs.stat(vscode.Uri.joinPath(logDir, candidate));
            return candidate.replace(/\\/g, '/');
        }
        catch { /* try next */ }
    }
    return undefined;
}
/** Delete a sidecar file only if its content matches our metadata format. Returns 1 if deleted. */
async function deleteIfOurs(uri) {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
        if (!isOurSidecar(parsed)) {
            return 0;
        }
        await vscode.workspace.fs.delete(uri);
        return 1;
    }
    catch {
        return 0;
    }
}
/** Migrate sidecars in the configured log dir. Convenience for migrateSidecarsInDirectory(getLogDirectoryUri(folder)). */
async function migrateAllSidecarsToCentral(workspaceFolder) {
    return migrateSidecarsInDirectory((0, config_1.getLogDirectoryUri)(workspaceFolder));
}
async function listMetaJsonFiles(dir, depth, prefix) {
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    }
    catch {
        return [];
    }
    const results = [];
    for (const [name, type] of entries) {
        const rel = prefix ? `${prefix}/${name}` : name;
        if (type === vscode.FileType.File && name.toLowerCase().endsWith('.meta.json')) {
            results.push(rel);
        }
        else if (depth > 0 && type === vscode.FileType.Directory && !name.startsWith('.')) {
            results.push(...await listMetaJsonFiles(vscode.Uri.joinPath(dir, name), depth - 1, rel));
        }
    }
    return results;
}
//# sourceMappingURL=session-metadata-migration.js.map
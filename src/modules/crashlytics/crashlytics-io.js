"use strict";
/** Low-level I/O helpers for Crashlytics: CLI runner and event cache read/write. */
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
exports.apiTimeout = void 0;
exports.runCmd = runCmd;
exports.readCachedEvents = readCachedEvents;
exports.writeCacheEvents = writeCacheEvents;
exports.migrateCrashlyticsCacheToSaropa = migrateCrashlyticsCacheToSaropa;
const vscode = __importStar(require("vscode"));
const node_child_process_1 = require("node:child_process");
const config_1 = require("../config/config");
const vscode_fs_read_directory_safe_1 = require("../misc/vscode-fs-read-directory-safe");
/** Shared timeout (ms) for both CLI commands and HTTP requests. */
exports.apiTimeout = 10_000;
/** Run a shell command and resolve with trimmed stdout, or reject on non-zero exit. */
function runCmd(cmd, args) {
    return new Promise((resolve, reject) => {
        (0, node_child_process_1.execFile)(cmd, args, { timeout: exports.apiTimeout, shell: true }, (err, stdout, stderr) => {
            if (err) {
                let error;
                if (err instanceof Error) {
                    error = err;
                }
                else if (typeof err === 'string') {
                    error = new Error(err);
                }
                else {
                    error = new Error('Command failed');
                }
                error.stderr = (stderr ?? '').trim();
                reject(error);
                return;
            }
            resolve((stdout ?? '').trim());
        });
    });
}
/** Resolve the on-disk cache path for a given Crashlytics issue ID (.saropa/cache/crashlytics/). */
function getCacheUri(issueId) {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        return undefined;
    }
    return vscode.Uri.joinPath((0, config_1.getSaropaCacheCrashlyticsUri)(ws), `${issueId}.json`);
}
/** Read cached crash events from disk; migrates v1 single-event format on the fly. */
async function readCachedEvents(issueId) {
    const uri = getCacheUri(issueId);
    if (!uri) {
        return undefined;
    }
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
        if (parsed.events && Array.isArray(parsed.events)) {
            return parsed;
        }
        // Migrate v1 single-event cache to multi-event format
        const detail = parsed;
        return { issueId, events: [detail], currentIndex: 0 };
    }
    catch {
        return undefined;
    }
}
/** Persist crash events to the on-disk cache, creating the directory if needed. Never throws. */
async function writeCacheEvents(issueId, data) {
    try {
        const uri = getCacheUri(issueId);
        if (!uri) {
            return;
        }
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2)));
    }
    catch {
        // Cache write failure is non-fatal; skip silently
    }
}
/**
 * One-time migration: move legacy `{logDirectory}/crashlytics/*.json` into
 * `.saropa/cache/crashlytics/`. Invoked from extension activation.
 *
 * Uses {@link readDirectoryIfExistsAsDirectory} so workspaces that never had the old
 * folder do not hit `readDirectory` on a missing path (avoids spurious host console noise).
 * Migration failures are swallowed; data loss is limited to failing mid-copy (extremely rare).
 */
async function migrateCrashlyticsCacheToSaropa(workspaceFolder) {
    try {
        const oldDir = vscode.Uri.joinPath((0, config_1.getLogDirectoryUri)(workspaceFolder), 'crashlytics');
        const newDir = (0, config_1.getSaropaCacheCrashlyticsUri)(workspaceFolder);
        const entries = await (0, vscode_fs_read_directory_safe_1.readDirectoryIfExistsAsDirectory)(vscode.workspace.fs, oldDir);
        const files = entries.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'));
        if (files.length === 0) {
            return;
        }
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(newDir, '..'));
        await vscode.workspace.fs.createDirectory(newDir);
        for (const [name] of files) {
            const src = vscode.Uri.joinPath(oldDir, name);
            const dest = vscode.Uri.joinPath(newDir, name);
            const raw = await vscode.workspace.fs.readFile(src);
            await vscode.workspace.fs.writeFile(dest, raw);
        }
        for (const [name] of files) {
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(oldDir, name));
        }
        await vscode.workspace.fs.delete(oldDir);
    }
    catch {
        // Migration failure is non-fatal
    }
}
//# sourceMappingURL=crashlytics-io.js.map
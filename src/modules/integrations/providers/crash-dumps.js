"use strict";
/**
 * Crash dumps integration: at session end, scans configured directories for
 * .dmp/.mdmp/.core files whose mtime falls in the session time range.
 * Optionally copies discovered files into the session folder (copyToSession).
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
exports.crashDumpsProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const workspace_path_1 = require("../workspace-path");
/** Max total bytes to copy into session folder (500 MB). */
const MAX_COPY_TOTAL_BYTES = 500 * 1024 * 1024;
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('crashDumps');
}
function resolvePath(template, workspaceFolder) {
    const workspacePath = (0, workspace_path_1.resolveWorkspaceFileUri)(workspaceFolder, '.').fsPath;
    let s = template.replace(/\$\{workspaceFolder\}/gi, workspacePath);
    s = s.replace(/\$\{env:([^}]+)\}/g, (_, name) => process.env[name] ?? '');
    return path.normalize(s);
}
/** Max directory depth to avoid stack overflow on very deep trees. */
const WALK_MAX_DEPTH = 20;
function* walkFiles(dir, opts, count, depth) {
    if (depth >= opts.maxDepth) {
        return;
    }
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const e of entries) {
        if (count.value >= opts.maxFiles) {
            return;
        }
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            yield* walkFiles(full, opts, count, depth + 1);
        }
        else if (e.isFile()) {
            const ext = path.extname(e.name).toLowerCase();
            if (!opts.extensions.has(ext)) {
                continue;
            }
            let stat;
            try {
                stat = fs.statSync(full);
            }
            catch {
                continue;
            }
            if (stat.mtimeMs >= opts.fromMs && stat.mtimeMs <= opts.toMs) {
                count.value += 1;
                yield { path: full, size: stat.size, mtime: stat.mtimeMs };
            }
        }
    }
}
exports.crashDumpsProvider = {
    id: 'crashDumps',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const { workspaceFolder, baseFileName, sessionStartTime, sessionEndTime } = context;
        const cfg = context.config.integrationsCrashDumps;
        const leadMs = cfg.leadMinutes * 60 * 1000;
        const lagMs = cfg.lagMinutes * 60 * 1000;
        const fromMs = sessionStartTime - leadMs;
        const toMs = sessionEndTime + lagMs;
        const searchPaths = cfg.searchPaths.length > 0
            ? cfg.searchPaths.map(p => resolvePath(p, workspaceFolder))
            : [
                (0, workspace_path_1.resolveWorkspaceFileUri)(workspaceFolder, '.').fsPath,
                process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'CrashDumps') : '',
                process.env.TEMP ?? '',
            ].filter(Boolean);
        const found = [];
        const walkOpts = {
            extensions: new Set(cfg.extensions.map(e => e.toLowerCase())),
            fromMs,
            toMs,
            maxFiles: cfg.maxFiles,
            maxDepth: WALK_MAX_DEPTH,
        };
        const count = { value: 0 };
        for (const dir of searchPaths) {
            try {
                if (!fs.statSync(dir).isDirectory()) {
                    continue;
                }
                for (const f of walkFiles(dir, walkOpts, count, 0)) {
                    found.push(f);
                }
            }
            catch {
                // skip
            }
            if (found.length >= cfg.maxFiles) {
                break;
            }
        }
        if (found.length === 0) {
            return undefined;
        }
        let files = found.map(f => ({ path: f.path, size: f.size, mtime: f.mtime }));
        let copiedCount = 0;
        // Optional copy into session folder: sequential copies, 500 MB cap, duplicate basenames get numeric suffix.
        if (cfg.copyToSession && context.logDirUri) {
            const usedNames = new Set();
            let totalCopiedBytes = 0;
            /** Returns a unique basename in the session folder (suffix -1, -2, … if name already used). */
            function uniqueDestBasename(originalPath) {
                const base = path.basename(originalPath);
                const ext = path.extname(base);
                const stem = ext ? base.slice(0, -ext.length) : base;
                let candidate = base;
                let n = 0;
                while (usedNames.has(candidate)) {
                    n += 1;
                    candidate = `${stem}-${n}${ext}`;
                }
                usedNames.add(candidate);
                return candidate;
            }
            const newFiles = [];
            for (const f of found) {
                const entry = { path: f.path, size: f.size, mtime: f.mtime };
                if (totalCopiedBytes + f.size > MAX_COPY_TOTAL_BYTES) {
                    newFiles.push(entry);
                    continue;
                }
                const destBasename = uniqueDestBasename(f.path);
                const destUri = vscode.Uri.joinPath(context.logDirUri, destBasename);
                try {
                    await vscode.workspace.fs.copy(vscode.Uri.file(f.path), destUri);
                    entry.copiedTo = destUri.fsPath;
                    totalCopiedBytes += f.size;
                    copiedCount += 1;
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    context.outputChannel.appendLine(`[crashDumps] Copy failed ${f.path}: ${msg}`);
                }
                newFiles.push(entry);
            }
            files = newFiles;
        }
        else if (cfg.copyToSession && !context.logDirUri) {
            context.outputChannel.appendLine('[crashDumps] copyToSession enabled but session folder path not available; skipping copy.');
        }
        const payload = {
            count: found.length,
            copiedCount,
            sidecar: `${baseFileName}.crash-dumps.json`,
            files,
        };
        const sidecarContent = JSON.stringify({ count: found.length, copiedCount, files: payload.files }, null, 2);
        return [
            { kind: 'meta', key: 'crashDumps', payload },
            { kind: 'sidecar', filename: `${baseFileName}.crash-dumps.json`, content: sidecarContent, contentType: 'json' },
        ];
    },
};
//# sourceMappingURL=crash-dumps.js.map
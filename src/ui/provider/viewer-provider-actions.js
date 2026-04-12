"use strict";
/**
 * Viewer provider actions: session list payload, open source file, copy source path.
 * Extracted from viewer-provider-helpers to keep the main file under the line limit.
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
exports.LOG_LAST_VIEWED_KEY = void 0;
exports.updateLastViewed = updateLastViewed;
exports.buildSessionItemRecord = buildSessionItemRecord;
exports.buildSessionListPayload = buildSessionListPayload;
exports.openSourceFile = openSourceFile;
exports.copySourcePath = copySourcePath;
exports.buildCopyWithSource = buildCopyWithSource;
const vscode = __importStar(require("vscode"));
const source_resolver_1 = require("../../modules/source/source-resolver");
const session_history_grouping_1 = require("../session/session-history-grouping");
const session_display_1 = require("../session/session-display");
const config_1 = require("../../modules/config/config");
const git_blame_1 = require("../../modules/git/git-blame");
const git_source_code_1 = require("../../modules/integrations/providers/git-source-code");
function isValidMtime(mtime) {
    return typeof mtime === 'number' && Number.isFinite(mtime) && mtime > 0;
}
/** Resolve mtime from item or by stating the file (fallback to filesystem). */
async function resolveMtime(uri, currentMtime) {
    if (isValidMtime(currentMtime)) {
        return currentMtime;
    }
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.mtime !== undefined && typeof stat.mtime === 'number') {
            return stat.mtime;
        }
    }
    catch {
        // File may be deleted or inaccessible; keep 0 so UI still shows the row.
    }
    return currentMtime ?? 0;
}
/** Workspace state key for "last viewed" timestamps per log URI (Record<uriString, number>). */
exports.LOG_LAST_VIEWED_KEY = 'saropaLogCapture.logLastViewed';
/** Update "last viewed" timestamp for a log (used for "updated since last viewed" indicator). Best-effort per-uri; concurrent opens may race. */
async function updateLastViewed(context, uri) {
    const uriStr = typeof uri === 'string' ? uri : uri.toString();
    const map = context.workspaceState.get(exports.LOG_LAST_VIEWED_KEY, {});
    map[uriStr] = Date.now();
    await context.workspaceState.update(exports.LOG_LAST_VIEWED_KEY, map);
}
/** Build a single webview record from session metadata. */
async function buildSessionItemRecord(m, activeStr, options) {
    const { getActiveLastWriteTime, getLastViewedAt } = options ?? {};
    const uri = m.uri instanceof vscode.Uri ? m.uri : vscode.Uri.parse(m.uri.toString());
    const mtime = await resolveMtime(uri, m.mtime);
    const uriStr = m.uri.toString();
    const isActive = activeStr === uriStr;
    const lastUpdatedAt = isActive && getActiveLastWriteTime
        ? (getActiveLastWriteTime() ?? mtime)
        : mtime;
    const lastViewedAt = getLastViewedAt?.(uriStr);
    const oneMinuteAgo = Date.now() - 60_000;
    const updatedInLastMinute = lastUpdatedAt >= oneMinuteAgo;
    const updatedSinceViewed = lastViewedAt !== undefined && lastUpdatedAt > lastViewedAt;
    return {
        filename: m.filename, displayName: m.displayName ?? m.filename, adapter: m.adapter,
        size: m.size, mtime, formattedMtime: (0, session_display_1.formatMtime)(mtime),
        formattedTime: (0, session_display_1.formatMtimeTimeOnly)(mtime), relativeTime: (0, session_display_1.formatRelativeTime)(mtime), date: m.date,
        hasTimestamps: m.hasTimestamps ?? false, lineCount: m.lineCount ?? 0,
        durationMs: m.durationMs ?? 0, errorCount: m.errorCount ?? 0,
        warningCount: m.warningCount ?? 0, perfCount: m.perfCount ?? 0,
        fwCount: m.fwCount ?? 0, infoCount: m.infoCount ?? 0,
        isActive,
        updatedSinceViewed,
        updatedInLastMinute,
        uriString: uriStr, trashed: m.trashed ?? false, tags: m.tags ?? [],
        autoTags: m.autoTags ?? [], correlationTags: m.correlationTags ?? [],
        hasPerformanceData: m.hasPerformanceData ?? false,
    };
}
/** Convert tree items to a flat session list for the webview panel. Uses filesystem stat when mtime is missing; processes items sequentially to avoid I/O burst. */
async function buildSessionListPayload(items, activeUri, options) {
    const activeStr = activeUri?.toString();
    const records = [];
    for (const item of items) {
        if ((0, session_history_grouping_1.isSplitGroup)(item)) {
            for (const part of item.parts) {
                records.push(await buildSessionItemRecord(part, activeStr, options));
            }
        }
        else {
            records.push(await buildSessionItemRecord(item, activeStr, options));
        }
    }
    return records;
}
/** Open a source file at a specific line, optionally in a split editor. If Git integration is enabled with blameOnNavigate, shows blame (last commit, author) in the status bar. */
async function openSourceFile(filePath, line, col, split) {
    const uri = (0, source_resolver_1.resolveSourceUri)(filePath);
    if (!uri) {
        return;
    }
    const pos = new vscode.Position(Math.max(0, line - 1), Math.max(0, col - 1));
    const viewColumn = split
        ? vscode.ViewColumn.Beside
        : (vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One);
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), viewColumn });
    }
    catch {
        // File may not exist on disk — ignore silently.
    }
    const config = (0, config_1.getConfig)();
    if (config.integrationsAdapters?.includes('git') &&
        config.integrationsGit.blameOnNavigate &&
        line >= 1) {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const loadingMsg = vscode.window.setStatusBarMessage('Git blame…');
        (0, git_blame_1.getGitBlame)(uri, line).then(async (blame) => {
            if (!blame) {
                loadingMsg.dispose();
                return;
            }
            let msg = `Git: ${blame.author} · ${blame.date} · ${blame.hash} ${blame.message}`;
            if (root && config.integrationsGit.commitLinks) {
                const url = await (0, git_source_code_1.getCommitUrl)(root, blame.hash);
                if (url) {
                    msg += ` · ${url}`;
                }
            }
            loadingMsg.dispose();
            vscode.window.setStatusBarMessage(msg, 8_000);
        }).catch(() => {
            loadingMsg.dispose();
        });
    }
}
/** Copy a source file path to clipboard (relative or full). */
function copySourcePath(filePath, mode) {
    if (mode === 'full') {
        const uri = (0, source_resolver_1.resolveSourceUri)(filePath);
        vscode.env.clipboard.writeText(uri ? uri.fsPath : filePath);
        return;
    }
    const isAbsolute = /^([/\\]|[a-zA-Z]:)/.test(filePath);
    const text = isAbsolute ? vscode.workspace.asRelativePath(filePath, false) : filePath.replace(/^package:[^/]+\//, '');
    vscode.env.clipboard.writeText(text);
}
/** Format a source file snippet for clipboard output. */
async function formatSourceSnippet(uri, path, lineNum) {
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const displayPath = vscode.workspace.asRelativePath(uri, false);
        const start = Math.max(0, lineNum - 1 - 2);
        const end = Math.min(doc.lineCount - 1, lineNum - 1 + 2);
        const lines = [`Source: ${displayPath}:${lineNum}`];
        for (let i = start; i <= end; i++) {
            const num = i + 1;
            const prefix = num === lineNum ? '  > ' : '    ';
            lines.push(prefix + `${num}| ${doc.lineAt(i).text}`);
        }
        lines.push('');
        return lines;
    }
    catch {
        return [`Source: ${path}:${lineNum}`, '  (could not read file)', ''];
    }
}
/** Build log excerpt plus source file names and line content for clipboard. Never throws. */
async function buildCopyWithSource(logText, sourceRefs) {
    const lines = [];
    const trimmed = typeof logText === 'string' ? logText.trim() : '';
    if (trimmed) {
        lines.push('Log excerpt:');
        lines.push('');
        lines.push(trimmed);
        lines.push('');
    }
    if (Array.isArray(sourceRefs) && sourceRefs.length > 0) {
        const seen = new Set();
        for (const ref of sourceRefs) {
            const path = typeof ref.path === 'string' ? ref.path.trim() : '';
            const lineNum = Math.max(1, Math.floor(Number(ref.line)) || 1);
            if (!path) {
                continue;
            }
            const key = `${path}:${lineNum}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            const uri = (0, source_resolver_1.resolveSourceUri)(path);
            if (!uri) {
                lines.push(`Source: ${path}:${lineNum}`, '  (file not resolved)', '');
                continue;
            }
            lines.push(...await formatSourceSnippet(uri, path, lineNum));
        }
    }
    return lines.join('\n').trim() || trimmed;
}
//# sourceMappingURL=viewer-provider-actions.js.map
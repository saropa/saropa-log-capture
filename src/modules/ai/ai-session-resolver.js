"use strict";
/**
 * Discovers Claude Code JSONL session files for the current workspace.
 *
 * Maps a workspace folder path to a project slug, then scans
 * ~/.claude/projects/<slug>/ for .jsonl files, returning the most
 * recently modified one (the active AI session).
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
exports.workspaceToProjectSlug = workspaceToProjectSlug;
exports.getClaudeProjectsDir = getClaudeProjectsDir;
exports.getProjectLogDir = getProjectLogDir;
exports.resolveActiveSession = resolveActiveSession;
exports.hasClaudeProject = hasClaudeProject;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
/**
 * Convert a workspace folder path to a Claude Code project slug.
 * Example: `d:\src\saropa-log-capture` → `d--src-saropa-log-capture`
 */
function workspaceToProjectSlug(workspacePath) {
    return workspacePath
        .replace(/:/g, '-')
        .replace(/[\\/]/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
        .toLowerCase();
}
/** Get the Claude projects directory (~/.claude/projects). */
function getClaudeProjectsDir() {
    return path.join(os.homedir(), '.claude', 'projects');
}
/** Get the project-specific log directory for a workspace path. */
function getProjectLogDir(workspacePath) {
    return path.join(getClaudeProjectsDir(), workspaceToProjectSlug(workspacePath));
}
/**
 * Find the most recently modified JSONL file in the project log directory.
 * Returns null if no matching directory or files exist.
 */
async function resolveActiveSession(workspacePath) {
    const logDir = getProjectLogDir(workspacePath);
    let entries;
    try {
        entries = await fs.promises.readdir(logDir, { withFileTypes: true });
    }
    catch {
        return null;
    }
    let best = null;
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
            continue;
        }
        const filePath = path.join(logDir, entry.name);
        try {
            const stat = await fs.promises.stat(filePath);
            if (!best || stat.mtimeMs > best.mtimeMs) {
                best = {
                    filePath,
                    sessionId: entry.name.replace('.jsonl', ''),
                    mtimeMs: stat.mtimeMs,
                };
            }
        }
        catch { /* skip inaccessible files */ }
    }
    return best;
}
/** Check whether a Claude projects directory exists for the given workspace. */
async function hasClaudeProject(workspacePath) {
    const logDir = getProjectLogDir(workspacePath);
    try {
        const stat = await fs.promises.stat(logDir);
        return stat.isDirectory();
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=ai-session-resolver.js.map
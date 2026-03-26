"use strict";
/**
 * Development environment data collector.
 *
 * Gathers git state, runtime info, workspace config, system resources,
 * and installed debug extensions. Used by the context header and bug reports.
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
exports.collectDevEnvironment = collectDevEnvironment;
exports.formatDevEnvironment = formatDevEnvironment;
const vscode = __importStar(require("vscode"));
const os = __importStar(require("os"));
const workspace_analyzer_1 = require("./workspace-analyzer");
/** Collect development environment data. All fields best-effort (never throws). */
async function collectDevEnvironment() {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const [branch, commit, porcelain, remote] = cwd
        ? await Promise.all([
            (0, workspace_analyzer_1.runGitCommand)(['rev-parse', '--abbrev-ref', 'HEAD'], cwd),
            (0, workspace_analyzer_1.runGitCommand)(['rev-parse', '--short', 'HEAD'], cwd),
            (0, workspace_analyzer_1.runGitCommand)(['status', '--porcelain'], cwd),
            (0, workspace_analyzer_1.runGitCommand)(['remote', 'get-url', 'origin'], cwd),
        ])
        : ['', '', '', ''];
    const folders = vscode.workspace.workspaceFolders;
    const wsType = !folders ? 'none' : folders.length > 1 ? 'multi-root' : 'single';
    return {
        gitBranch: branch,
        gitCommit: commit,
        gitDirty: porcelain.length > 0,
        gitRemote: stripCredentials(remote),
        nodeVersion: process.version,
        workspaceType: wsType,
        workspaceTrusted: vscode.workspace.isTrusted,
        remoteName: vscode.env.remoteName ?? '',
        cpuCount: os.cpus().length,
        totalMemoryMb: Math.round(os.totalmem() / 1048576),
        debugExtensions: listDebugExtensions(),
    };
}
/** Format DevEnvironment as key-value pairs for display. */
function formatDevEnvironment(env) {
    const result = {};
    if (env.gitBranch) {
        result['Git Branch'] = env.gitBranch;
    }
    if (env.gitCommit) {
        result['Git Commit'] = `${env.gitCommit}${env.gitDirty ? ' (dirty)' : ''}`;
    }
    if (env.gitRemote) {
        result['Git Remote'] = env.gitRemote;
    }
    result['Node'] = env.nodeVersion;
    result['Workspace'] = `${env.workspaceType}${env.workspaceTrusted ? '' : ' (untrusted)'}`;
    if (env.remoteName) {
        result['Remote'] = env.remoteName;
    }
    result['System'] = `${env.cpuCount} CPUs, ${env.totalMemoryMb} MB RAM`;
    if (env.debugExtensions.length > 0) {
        result['Debug Extensions'] = env.debugExtensions.join(', ');
    }
    return result;
}
function stripCredentials(url) {
    return url.replace(/\/\/[^@]+@/, '//');
}
function listDebugExtensions() {
    return vscode.extensions.all
        .filter(ext => {
        const cats = ext.packageJSON?.categories ?? [];
        return cats.some(c => c.toLowerCase() === 'debuggers');
    })
        .map(ext => `${ext.id}@${ext.packageJSON?.version ?? '?'}`)
        .sort();
}
//# sourceMappingURL=environment-collector.js.map
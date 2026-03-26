"use strict";
/**
 * Workspace-aware analysis: find source files, git history, and code annotations.
 *
 * Searches the user's project (not log files) to provide context about
 * source files referenced in log output.
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
exports.findInWorkspace = findInWorkspace;
exports.getGitHistory = getGitHistory;
exports.getGitHistoryForLines = getGitHistoryForLines;
exports.findAnnotations = findAnnotations;
exports.getSourcePreview = getSourcePreview;
exports.analyzeSourceFile = analyzeSourceFile;
exports.runGitCommand = runGitCommand;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const annotationPattern = /\b(TODO|FIXME|HACK|BUG|NOTE|XXX)\b[:\s]*(.*)/i;
/** Find a source file in the workspace by filename, preferring app-code directories. */
async function findInWorkspace(filename, packageHint) {
    const results = await vscode.workspace.findFiles(`**/${filename}`, '**/node_modules/**', 5);
    if (results.length === 0) {
        return undefined;
    }
    if (results.length === 1 || !packageHint) {
        return results[0];
    }
    const hintParts = packageHint.split('.').slice(-2);
    const preferred = results.find(r => hintParts.some(p => r.fsPath.includes(p)));
    return preferred ?? results.find(r => /[/\\](?:lib|src|app)[/\\]/i.test(r.fsPath)) ?? results[0];
}
/** Get recent git commits that touched a file. Returns empty on error. */
async function getGitHistory(uri, maxCommits = 15) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
        return [];
    }
    const relPath = vscode.workspace.asRelativePath(uri, false);
    const format = '--format=%h|%ad|%s';
    const args = ['log', format, '--date=short', `-${maxCommits}`, '--', relPath];
    return runGit(args, root);
}
/** Get git commits that changed a specific line range. Returns empty on error. */
async function getGitHistoryForLines(uri, startLine, endLine) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
        return [];
    }
    const relPath = vscode.workspace.asRelativePath(uri, false);
    const args = ['log', '--format=%h|%ad|%s', '--date=short', '-10', `-L${startLine},${endLine}:${relPath}`];
    return runGit(args, root);
}
/** Scan a source file for TODO/FIXME/HACK/BUG/NOTE annotations. */
async function findAnnotations(uri) {
    const doc = await vscode.workspace.openTextDocument(uri);
    const annotations = [];
    for (let i = 0; i < doc.lineCount && annotations.length < 30; i++) {
        const line = doc.lineAt(i).text;
        const match = annotationPattern.exec(line);
        if (match) {
            annotations.push({ line: i + 1, type: match[1].toUpperCase(), text: match[2].trim() || match[0].trim() });
        }
    }
    return annotations;
}
/** Read source lines around a target line. */
async function getSourcePreview(uri, targetLine, context = 5) {
    const doc = await vscode.workspace.openTextDocument(uri);
    if (targetLine < 1 || targetLine > doc.lineCount) {
        return undefined;
    }
    const start = Math.max(0, targetLine - 1 - context);
    const end = Math.min(doc.lineCount - 1, targetLine - 1 + context);
    const lines = [];
    for (let i = start; i <= end; i++) {
        lines.push({ num: i + 1, text: doc.lineAt(i).text });
    }
    return { lines, targetLine };
}
/** Analyze a source file: find it, get git history, annotations, and source preview. */
async function analyzeSourceFile(filename, crashLine, packageHint) {
    const uri = await findInWorkspace(filename, packageHint);
    if (!uri) {
        return undefined;
    }
    const [gitCommits, lineCommits, annotations, sourcePreview] = await Promise.all([
        getGitHistory(uri),
        crashLine ? getGitHistoryForLines(uri, Math.max(1, crashLine - 2), crashLine + 2) : Promise.resolve([]),
        findAnnotations(uri),
        crashLine ? getSourcePreview(uri, crashLine) : Promise.resolve(undefined),
    ]);
    const allCommits = mergeCommits(gitCommits, lineCommits);
    return { uri, gitCommits: allCommits, lineCommits, annotations, sourcePreview };
}
function mergeCommits(file, line) {
    const seen = new Set(file.map(c => c.hash));
    return [...file, ...line.filter(c => !seen.has(c.hash))];
}
/** Run a git command and return stdout. Returns empty string on error. */
function runGitCommand(args, cwd) {
    return new Promise((resolve) => {
        (0, child_process_1.execFile)('git', args, { cwd, timeout: 5000 }, (err, stdout) => {
            resolve(err ? '' : (stdout ?? '').trim());
        });
    });
}
function runGit(args, cwd) {
    return new Promise((resolve) => {
        (0, child_process_1.execFile)('git', args, { cwd, timeout: 5000 }, (err, stdout) => {
            if (err || !stdout) {
                resolve([]);
                return;
            }
            resolve(stdout.trim().split('\n').filter(Boolean).map(parseCommitLine).filter(Boolean));
        });
    });
}
function parseCommitLine(line) {
    const [hash, date, ...rest] = line.split('|');
    if (!hash || !date) {
        return undefined;
    }
    return { hash: hash.trim(), date: date.trim(), message: rest.join('|').trim() };
}
//# sourceMappingURL=workspace-analyzer.js.map
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
exports.findHeaderEnd = findHeaderEnd;
exports.extractEnvironment = extractEnvironment;
exports.extractLogContext = extractLogContext;
exports.extractStackTrace = extractStackTrace;
exports.collectWorkspaceData = collectWorkspaceData;
exports.collectFileAnalyses = collectFileAnalyses;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../capture/ansi");
const source_linker_1 = require("../source/source-linker");
const stack_parser_1 = require("../analysis/stack-parser");
const workspace_analyzer_1 = require("../misc/workspace-analyzer");
const git_blame_1 = require("../git/git-blame");
const cross_session_aggregator_1 = require("../misc/cross-session-aggregator");
const import_extractor_1 = require("../source/import-extractor");
const headerSeparator = '==================';
const maxContextLines = 15;
const maxStackFrames = 100;
const maxAnalyzedFiles = 5;
function findHeaderEnd(lines) {
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
        if (lines[i].startsWith(headerSeparator)) {
            return i + 1;
        }
    }
    return 0;
}
function extractEnvironment(lines, headerEnd) {
    const env = {};
    for (let i = 0; i < headerEnd; i++) {
        const match = lines[i].match(/^(\w[\w\s.]+?):\s+(.+)$/);
        if (match) {
            env[match[1].trim()] = match[2].trim();
        }
    }
    return env;
}
function extractLogContext(lines, errorIdx) {
    const start = Math.max(0, errorIdx - maxContextLines);
    return lines.slice(start, errorIdx).map(l => (0, ansi_1.stripAnsi)(l));
}
function extractStackTrace(lines, errorIdx) {
    const frames = [];
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let currentThread;
    for (let i = errorIdx + 1; i < lines.length && frames.length < maxStackFrames; i++) {
        const line = lines[i];
        if ((0, stack_parser_1.isStackFrameLine)(line)) {
            const text = (0, ansi_1.stripAnsi)(line).trimEnd();
            const sourceRef = (0, source_linker_1.extractSourceReference)(text);
            frames.push({ text, isApp: !(0, stack_parser_1.isFrameworkFrame)(text, wsPath), sourceRef, threadName: currentThread });
        }
        else {
            const header = (0, stack_parser_1.parseThreadHeader)((0, ansi_1.stripAnsi)(line));
            if (header) {
                currentThread = header.name;
                continue;
            }
            break;
        }
    }
    return frames;
}
async function collectWorkspaceData(filePath, crashLine, fingerprint) {
    const uri = filePath ? await resolveSourceUri(filePath) : undefined;
    const lineStart = crashLine ? Math.max(1, crashLine - 2) : 0;
    const lineEnd = crashLine ? crashLine + 2 : 0;
    const [preview, blame, history, lineHistory, insights, imports] = await Promise.all([
        uri && crashLine ? (0, workspace_analyzer_1.getSourcePreview)(uri, crashLine) : Promise.resolve(undefined),
        uri && crashLine ? (0, git_blame_1.getGitBlame)(uri, crashLine).catch(() => undefined) : Promise.resolve(undefined),
        uri ? (0, workspace_analyzer_1.getGitHistory)(uri, 10) : Promise.resolve([]),
        uri && crashLine ? (0, workspace_analyzer_1.getGitHistoryForLines)(uri, lineStart, lineEnd) : Promise.resolve([]),
        (0, cross_session_aggregator_1.aggregateInsights)(),
        uri ? (0, import_extractor_1.extractImports)(uri).catch(() => undefined) : Promise.resolve(undefined),
    ]);
    const match = insights.recurringErrors.find(e => e.hash === fingerprint);
    const crossMatch = match ? {
        sessionCount: match.sessionCount, totalOccurrences: match.totalOccurrences,
        firstSeen: match.firstSeen, lastSeen: match.lastSeen,
    } : undefined;
    return [preview, blame, history, crossMatch, lineHistory, imports];
}
async function collectFileAnalyses(frames, primaryFile) {
    const fileMap = new Map();
    for (const f of frames) {
        if (!f.isApp || !f.sourceRef) {
            continue;
        }
        const key = f.sourceRef.filePath;
        if (primaryFile && key === primaryFile) {
            continue;
        }
        const entry = fileMap.get(key) ?? { lines: [], hint: (0, source_linker_1.extractPackageHint)(f.text) };
        entry.lines.push(f.sourceRef.line);
        fileMap.set(key, entry);
    }
    const entries = [...fileMap.entries()].slice(0, maxAnalyzedFiles);
    const results = await Promise.all(entries.map(([p, v]) => analyzeOneFile(p, v.lines, v.hint)));
    return results.filter((r) => r !== undefined);
}
async function analyzeOneFile(filePath, frameLines, hint) {
    const uri = await resolveSourceUri(filePath, hint);
    if (!uri) {
        return undefined;
    }
    const [blame, commits] = await Promise.all([
        (0, git_blame_1.getGitBlame)(uri, frameLines[0]).catch(() => undefined),
        (0, workspace_analyzer_1.getGitHistory)(uri, 5).catch(() => []),
    ]);
    return { filePath, uri, blame, recentCommits: commits, frameLines };
}
async function resolveSourceUri(path, hint) {
    if (/^[A-Za-z]:[\\/]|^\//.test(path)) {
        try {
            const uri = vscode.Uri.file(path);
            await vscode.workspace.fs.stat(uri);
            return uri;
        }
        catch {
            // fall through to workspace search
        }
    }
    const name = path.split(/[\\/]/).pop();
    return name ? (0, workspace_analyzer_1.findInWorkspace)(name, hint) : undefined;
}
//# sourceMappingURL=bug-report-collector-helpers.js.map
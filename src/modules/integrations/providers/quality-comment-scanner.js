"use strict";
/**
 * Comment density scanner for the code quality metrics integration.
 * Scans referenced source files for comment-to-code ratio and
 * JSDoc/dartdoc coverage on exported symbols.
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
exports.isScanSupported = isScanSupported;
exports.countCommentLines = countCommentLines;
exports.countDocumentedExports = countDocumentedExports;
exports.scanSingleFile = scanSingleFile;
exports.scanCommentDensity = scanCommentDensity;
const vscode = __importStar(require("vscode"));
const MAX_SCAN_FILES = 20;
const MAX_FILE_BYTES = 100 * 1024; // 100 KB
/** File extensions where we know how to count comments. */
const cStyleExts = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'java', 'go', 'rs', 'cs', 'swift', 'kt', 'kts', 'scala', 'cpp', 'cc', 'c', 'h', 'hpp']);
const dartExt = 'dart';
const hashExts = new Set(['py', 'rb', 'r', 'ex', 'exs', 'lua', 'php']);
/** Check if we support comment scanning for this extension. */
function isScanSupported(ext) {
    const lower = ext.toLowerCase();
    return cStyleExts.has(lower) || lower === dartExt || hashExts.has(lower);
}
/** Count comment lines in source content. Handles single-line and block comments. */
function countCommentLines(lines, ext) {
    const lower = ext.toLowerCase();
    const useCStyle = cStyleExts.has(lower) || lower === dartExt;
    const useHash = hashExts.has(lower);
    let count = 0;
    let inBlock = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        if (useCStyle && inBlock) {
            count++;
            if (trimmed.includes('*/')) {
                inBlock = false;
            }
            continue;
        }
        if (useCStyle && trimmed.startsWith('//')) {
            count++;
            continue;
        }
        if (useCStyle && trimmed.startsWith('/*')) {
            count++;
            inBlock = !trimmed.includes('*/');
            continue;
        }
        if (useHash && trimmed.startsWith('#')) {
            count++;
        }
    }
    return count;
}
/** Count non-blank lines. */
function countCodeLines(lines) {
    let count = 0;
    for (const line of lines) {
        if (line.trim()) {
            count++;
        }
    }
    return count;
}
/**
 * Count exported symbols and how many have preceding doc comments.
 * Heuristic: looks for `export function|class|const|interface|type` (TS/JS)
 * or top-level `class|void|String|int|Future` declarations (Dart).
 */
function countDocumentedExports(lines, ext) {
    const lower = ext.toLowerCase();
    const isDart = lower === dartExt;
    const isJsTs = cStyleExts.has(lower);
    let total = 0;
    let documented = 0;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        const isExport = isJsTs
            ? /^export\s+(function|class|const|interface|type|enum|abstract)\s/.test(trimmed)
            : isDart && /^(class|void|String|int|double|bool|Future|Stream|List|Map|Set|dynamic)\s/.test(trimmed) && !trimmed.startsWith('//');
        if (!isExport) {
            continue;
        }
        total++;
        if (hasPrecedingDocComment(lines, i, lower)) {
            documented++;
        }
    }
    return { documented, total };
}
/** Check if the line above (skipping blanks) is a doc comment. */
function hasPrecedingDocComment(lines, idx, ext) {
    for (let j = idx - 1; j >= 0; j--) {
        const prev = lines[j].trim();
        if (!prev) {
            continue;
        }
        if (ext === dartExt) {
            return prev.startsWith('///');
        }
        return prev.endsWith('*/') || prev.startsWith('/**');
    }
    return false;
}
/**
 * Scan a single file's content for comment density and doc coverage.
 * Pure function — no I/O.
 */
function scanSingleFile(content, ext) {
    const lines = content.split(/\r?\n/);
    const codeLines = countCodeLines(lines);
    const commentLines = countCommentLines(lines, ext);
    const commentRatio = codeLines > 0 ? Math.round((commentLines / codeLines) * 100) / 100 : 0;
    const { documented, total } = countDocumentedExports(lines, ext);
    return { commentRatio, documentedExports: documented, totalExports: total };
}
/**
 * Scan referenced source files for comment density and doc coverage.
 * Caps at MAX_SCAN_FILES and MAX_FILE_BYTES per file.
 */
async function scanCommentDensity(workspaceFolder, referencedPaths) {
    const result = new Map();
    const toScan = referencedPaths.slice(0, MAX_SCAN_FILES);
    for (const relPath of toScan) {
        const ext = relPath.split('.').pop() ?? '';
        if (!isScanSupported(ext)) {
            continue;
        }
        try {
            const uri = vscode.Uri.joinPath(workspaceFolder.uri, relPath);
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.size > MAX_FILE_BYTES) {
                continue;
            }
            const raw = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(raw).toString('utf-8');
            result.set(relPath, scanSingleFile(content, ext));
        }
        catch {
            // File not found or unreadable — skip silently.
        }
    }
    return result;
}
//# sourceMappingURL=quality-comment-scanner.js.map
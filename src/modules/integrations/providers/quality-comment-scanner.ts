/**
 * Comment density scanner for the code quality metrics integration.
 * Scans referenced source files for comment-to-code ratio and
 * JSDoc/dartdoc coverage on exported symbols.
 */

import * as vscode from 'vscode';
import type { FileCommentData } from './quality-types';

const MAX_SCAN_FILES = 20;
const MAX_FILE_BYTES = 100 * 1024; // 100 KB

/** File extensions where we know how to count comments. */
const cStyleExts = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'java', 'go', 'rs', 'cs', 'swift', 'kt', 'kts', 'scala', 'cpp', 'cc', 'c', 'h', 'hpp']);
const dartExt = 'dart';
const hashExts = new Set(['py', 'rb', 'r', 'ex', 'exs', 'lua', 'php']);

/** Check if we support comment scanning for this extension. */
export function isScanSupported(ext: string): boolean {
    const lower = ext.toLowerCase();
    return cStyleExts.has(lower) || lower === dartExt || hashExts.has(lower);
}

/** Count comment lines in source content. Handles single-line and block comments. */
export function countCommentLines(lines: readonly string[], ext: string): number {
    const lower = ext.toLowerCase();
    const useCStyle = cStyleExts.has(lower) || lower === dartExt;
    const useHash = hashExts.has(lower);
    let count = 0;
    let inBlock = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { continue; }
        if (useCStyle && inBlock) {
            count++;
            if (trimmed.includes('*/')) { inBlock = false; }
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
function countCodeLines(lines: readonly string[]): number {
    let count = 0;
    for (const line of lines) {
        if (line.trim()) { count++; }
    }
    return count;
}

/**
 * Count exported symbols and how many have preceding doc comments.
 * Heuristic: looks for `export function|class|const|interface|type` (TS/JS)
 * or top-level `class|void|String|int|Future` declarations (Dart).
 */
export function countDocumentedExports(
    lines: readonly string[],
    ext: string,
): { documented: number; total: number } {
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
        if (!isExport) { continue; }
        total++;
        if (hasPrecedingDocComment(lines, i, lower)) { documented++; }
    }
    return { documented, total };
}

/** Check if the line above (skipping blanks) is a doc comment. */
function hasPrecedingDocComment(lines: readonly string[], idx: number, ext: string): boolean {
    for (let j = idx - 1; j >= 0; j--) {
        const prev = lines[j].trim();
        if (!prev) { continue; }
        if (ext === dartExt) { return prev.startsWith('///'); }
        return prev.endsWith('*/') || prev.startsWith('/**');
    }
    return false;
}

/**
 * Scan a single file's content for comment density and doc coverage.
 * Pure function — no I/O.
 */
export function scanSingleFile(content: string, ext: string): FileCommentData {
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
export async function scanCommentDensity(
    workspaceFolder: vscode.WorkspaceFolder,
    referencedPaths: readonly string[],
): Promise<ReadonlyMap<string, FileCommentData>> {
    const result = new Map<string, FileCommentData>();
    const toScan = referencedPaths.slice(0, MAX_SCAN_FILES);
    for (const relPath of toScan) {
        const ext = relPath.split('.').pop() ?? '';
        if (!isScanSupported(ext)) { continue; }
        try {
            const uri = vscode.Uri.joinPath(workspaceFolder.uri, relPath);
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.size > MAX_FILE_BYTES) { continue; }
            const raw = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(raw).toString('utf-8');
            result.set(relPath, scanSingleFile(content, ext));
        } catch {
            // File not found or unreadable — skip silently.
        }
    }
    return result;
}

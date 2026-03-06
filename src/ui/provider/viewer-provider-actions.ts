/**
 * Viewer provider actions: session list payload, open source file, copy source path.
 * Extracted from viewer-provider-helpers to keep the main file under the line limit.
 */

import * as vscode from "vscode";
import { resolveSourceUri } from "../../modules/source/source-resolver";
import { TreeItem, isSplitGroup } from "../session/session-history-grouping";
import { formatMtime, formatMtimeTimeOnly, formatRelativeTime } from "../session/session-display";
import { getConfig } from "../../modules/config/config";
import { getGitBlame } from "../../modules/git/git-blame";

/** Convert tree items to a flat session list for the webview panel. */
export function buildSessionListPayload(
    items: readonly TreeItem[],
    activeUri: vscode.Uri | undefined,
): Record<string, unknown>[] {
    const activeStr = activeUri?.toString();
    type Meta = { filename: string; displayName?: string; adapter?: string; size: number; mtime: number; date?: string; hasTimestamps?: boolean; lineCount?: number; durationMs?: number; errorCount?: number; warningCount?: number; perfCount?: number; fwCount?: number; infoCount?: number; uri: { toString(): string }; trashed?: boolean; tags?: string[]; autoTags?: string[]; correlationTags?: string[] };
    const toRecord = (m: Meta): Record<string, unknown> => ({
        filename: m.filename, displayName: m.displayName ?? m.filename, adapter: m.adapter,
        size: m.size, mtime: m.mtime, formattedMtime: formatMtime(m.mtime),
        formattedTime: formatMtimeTimeOnly(m.mtime), relativeTime: formatRelativeTime(m.mtime), date: m.date,
        hasTimestamps: m.hasTimestamps ?? false, lineCount: m.lineCount ?? 0,
        durationMs: m.durationMs ?? 0, errorCount: m.errorCount ?? 0,
        warningCount: m.warningCount ?? 0, perfCount: m.perfCount ?? 0,
        fwCount: m.fwCount ?? 0, infoCount: m.infoCount ?? 0,
        isActive: activeStr === m.uri.toString(),
        uriString: m.uri.toString(), trashed: m.trashed ?? false, tags: m.tags ?? [],
        autoTags: m.autoTags ?? [], correlationTags: m.correlationTags ?? [],
    });
    return items.flatMap(item =>
        isSplitGroup(item) ? item.parts.map(toRecord) : [toRecord(item)],
    );
}

/** Open a source file at a specific line, optionally in a split editor. If Git integration is enabled with blameOnNavigate, shows blame (last commit, author) in the status bar. */
export async function openSourceFile(
    filePath: string,
    line: number,
    col: number,
    split: boolean,
): Promise<void> {
    const uri = resolveSourceUri(filePath);
    if (!uri) { return; }
    const pos = new vscode.Position(Math.max(0, line - 1), Math.max(0, col - 1));
    const viewColumn = split
        ? vscode.ViewColumn.Beside
        : (vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One);
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), viewColumn });
    } catch {
        // File may not exist on disk — ignore silently.
    }
    const config = getConfig();
    if (
        config.integrationsAdapters?.includes('git') &&
        config.integrationsGit.blameOnNavigate &&
        line >= 1
    ) {
        getGitBlame(uri, line).then((blame) => {
            if (!blame) { return; }
            const msg = `Git: ${blame.author} · ${blame.date} · ${blame.hash} ${blame.message}`;
            vscode.window.setStatusBarMessage(msg, 8_000);
        }).catch(() => {});
    }
}

/** Copy a source file path to clipboard (relative or full). */
export function copySourcePath(filePath: string, mode: string): void {
    if (mode === 'full') {
        const uri = resolveSourceUri(filePath);
        vscode.env.clipboard.writeText(uri ? uri.fsPath : filePath);
        return;
    }
    const isAbsolute = /^([/\\]|[a-zA-Z]:)/.test(filePath);
    const text = isAbsolute ? vscode.workspace.asRelativePath(filePath, false) : filePath.replace(/^package:[^/]+\//, '');
    vscode.env.clipboard.writeText(text);
}

/** Source reference from the viewer (path and line from a source-link). */
export interface CopySourceRef {
    path: string;
    line: number;
}

/** Build log excerpt plus source file names and line content for clipboard. Never throws. */
export async function buildCopyWithSource(logText: string, sourceRefs: CopySourceRef[]): Promise<string> {
    const lines: string[] = [];
    const trimmed = typeof logText === 'string' ? logText.trim() : '';
    if (trimmed) {
        lines.push('Log excerpt:');
        lines.push('');
        lines.push(trimmed);
        lines.push('');
    }
    if (Array.isArray(sourceRefs) && sourceRefs.length > 0) {
        const seen = new Set<string>();
        for (const ref of sourceRefs) {
            const path = typeof ref.path === 'string' ? ref.path.trim() : '';
            const lineNum = Math.max(1, Math.floor(Number(ref.line)) || 1);
            if (!path) { continue; }
            const key = `${path}:${lineNum}`;
            if (seen.has(key)) { continue; }
            seen.add(key);
            const uri = resolveSourceUri(path);
            if (!uri) {
                lines.push(`Source: ${path}:${lineNum}`);
                lines.push('  (file not resolved)');
                lines.push('');
                continue;
            }
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                const displayPath = vscode.workspace.asRelativePath(uri, false);
                const start = Math.max(0, lineNum - 1 - 2);
                const end = Math.min(doc.lineCount - 1, lineNum - 1 + 2);
                lines.push(`Source: ${displayPath}:${lineNum}`);
                for (let i = start; i <= end; i++) {
                    const num = i + 1;
                    const prefix = num === lineNum ? '  > ' : '    ';
                    lines.push(prefix + `${num}| ${doc.lineAt(i).text}`);
                }
                lines.push('');
            } catch {
                lines.push(`Source: ${path}:${lineNum}`);
                lines.push('  (could not read file)');
                lines.push('');
            }
        }
    }
    return lines.join('\n').trim() || trimmed;
}

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
import { getCommitUrl } from "../../modules/integrations/providers/git-source-code";

function isValidMtime(mtime: number | undefined): mtime is number {
    return typeof mtime === 'number' && Number.isFinite(mtime) && mtime > 0;
}

/** Resolve mtime from item or by stating the file (fallback to filesystem). */
async function resolveMtime(
    uri: vscode.Uri,
    currentMtime: number | undefined,
): Promise<number> {
    if (isValidMtime(currentMtime)) { return currentMtime; }
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.mtime !== undefined && typeof stat.mtime === 'number') { return stat.mtime; }
    } catch {
        // File may be deleted or inaccessible; keep 0 so UI still shows the row.
    }
    return currentMtime ?? 0;
}

/** Convert tree items to a flat session list for the webview panel. Uses filesystem stat when mtime is missing; processes items sequentially to avoid I/O burst. */
export async function buildSessionListPayload(
    items: readonly TreeItem[],
    activeUri: vscode.Uri | undefined,
): Promise<Record<string, unknown>[]> {
    const activeStr = activeUri?.toString();
    type Meta = { filename: string; displayName?: string; adapter?: string; size: number; mtime: number; date?: string; hasTimestamps?: boolean; lineCount?: number; durationMs?: number; errorCount?: number; warningCount?: number; perfCount?: number; fwCount?: number; infoCount?: number; uri: { toString(): string }; trashed?: boolean; tags?: string[]; autoTags?: string[]; correlationTags?: string[]; hasPerformanceData?: boolean };
    const toRecord = async (m: Meta): Promise<Record<string, unknown>> => {
        const uri = m.uri instanceof vscode.Uri ? m.uri : vscode.Uri.parse(m.uri.toString());
        const mtime = await resolveMtime(uri, m.mtime);
        return {
            filename: m.filename, displayName: m.displayName ?? m.filename, adapter: m.adapter,
            size: m.size, mtime, formattedMtime: formatMtime(mtime),
            formattedTime: formatMtimeTimeOnly(mtime), relativeTime: formatRelativeTime(mtime), date: m.date,
            hasTimestamps: m.hasTimestamps ?? false, lineCount: m.lineCount ?? 0,
            durationMs: m.durationMs ?? 0, errorCount: m.errorCount ?? 0,
            warningCount: m.warningCount ?? 0, perfCount: m.perfCount ?? 0,
            fwCount: m.fwCount ?? 0, infoCount: m.infoCount ?? 0,
            isActive: activeStr === m.uri.toString(),
            uriString: m.uri.toString(), trashed: m.trashed ?? false, tags: m.tags ?? [],
            autoTags: m.autoTags ?? [], correlationTags: m.correlationTags ?? [],
            hasPerformanceData: m.hasPerformanceData ?? false,
        };
    };
    const records: Record<string, unknown>[] = [];
    for (const item of items) {
        if (isSplitGroup(item)) {
            for (const part of item.parts) { records.push(await toRecord(part)); }
        } else {
            records.push(await toRecord(item));
        }
    }
    return records;
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
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const loadingMsg = vscode.window.setStatusBarMessage('Git blame…');
        getGitBlame(uri, line).then(async (blame) => {
            if (!blame) { loadingMsg.dispose(); return; }
            let msg = `Git: ${blame.author} · ${blame.date} · ${blame.hash} ${blame.message}`;
            if (root && config.integrationsGit.commitLinks) {
                const url = await getCommitUrl(root, blame.hash);
                if (url) { msg += ` · ${url}`; }
            }
            loadingMsg.dispose();
            vscode.window.setStatusBarMessage(msg, 8_000);
        }).catch(() => {
            loadingMsg.dispose();
        });
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

/** Format a source file snippet for clipboard output. */
async function formatSourceSnippet(uri: vscode.Uri, path: string, lineNum: number): Promise<string[]> {
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
    } catch {
        return [`Source: ${path}:${lineNum}`, '  (could not read file)', ''];
    }
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
                lines.push(`Source: ${path}:${lineNum}`, '  (file not resolved)', '');
                continue;
            }
            lines.push(...await formatSourceSnippet(uri, path, lineNum));
        }
    }
    return lines.join('\n').trim() || trimmed;
}

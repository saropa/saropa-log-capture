/**
 * Viewer provider actions: session list payload, open source file, copy source path.
 * Extracted from viewer-provider-helpers to keep the main file under the line limit.
 */

import * as vscode from "vscode";
import { resolveSourceUri } from "../../modules/source/source-resolver";
import { TreeItem, isSplitGroup } from "../session/session-history-grouping";
import { formatMtime, formatMtimeTimeOnly, formatRelativeTime } from "../session/session-display";

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

/** Open a source file at a specific line, optionally in a split editor. */
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

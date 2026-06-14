/**
 * Viewer provider actions: session list payload, open source file, copy source path.
 * Extracted from viewer-provider-helpers to keep the main file under the line limit.
 */

import * as vscode from "vscode";
import { resolveSourceUri } from "../../modules/source/source-resolver";
import { TreeItem, isSplitGroup, isSessionGroup } from "../session/session-history-grouping";
import { formatMtime, formatMtimeTimeOnly, formatRelativeTime } from "../session/session-display";
import { getConfig } from "../../modules/config/config";
import { getGitBlame } from "../../modules/git/git-blame";
import { getCommitUrl } from "../../modules/integrations/providers/git-source-code";
import {
    classifySessionKind,
    classifySessionRole,
    compileReportPatterns,
    type SessionKind,
    type SessionKindInput,
    type SessionRole,
    type SessionRoleInput,
} from "../../modules/session/session-kind-classifier";

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

/** Workspace state key for "last viewed" timestamps per log URI (Record<uriString, number>). */
export const LOG_LAST_VIEWED_KEY = 'saropaLogCapture.logLastViewed';

/** Workspace state key for the Logs panel's "newer-log dismiss" cursor (single number ms).
 *  A log is unread (drives the newer-log banner and per-row dot) when its mtime is greater
 *  than this cursor. Acknowledged via the `acknowledgeUnreadLogs` webview message; seeded
 *  to activation-time on first install so the user isn't carpet-bombed with "newer" cues
 *  for pre-existing logs. See [plans/history/2026.06/2026.06.02/001_plan-newer-alert-and-reports-grouping.md]. */
export const LOGS_PANEL_DISMISSED_AT_KEY = 'saropaLogCapture.logsPanelDismissedAt';

/** Pre-built classifier callable handed to every per-record build. Pattern compile + folder
 *  lookup happen once per payload, not once per row — `buildClassifierInputs()` is the factory. */
export type ClassifyMeta = (input: SessionKindInput) => SessionKind;

/** Build a `classifyMeta` callable from the user's regex list + the active workspace folder name.
 *  Returns a no-op project-fallback when the inputs are unavailable so callers never need a null check. */
export function buildClassifierInputs(
    kindPatterns: readonly string[],
    workspaceFolderName: string | undefined,
): ClassifyMeta {
    const compiled = compileReportPatterns(kindPatterns);
    return (input) => classifySessionKind(input, compiled, workspaceFolderName);
}

/** Pre-built role classifier callable. Like `ClassifyMeta`, the folder lookup + list happen once
 *  per payload (via `buildRoleClassifier`), then it's called per row. */
export type ClassifyRole = (input: SessionRoleInput) => SessionRole;

/** Build a `classifyRole` callable from the user's controller-name list + the active workspace
 *  folder name. The folder-name match is what makes the project's own log the day's Controller. */
export function buildRoleClassifier(
    controllerNames: readonly string[],
    workspaceFolderName: string | undefined,
): ClassifyRole {
    return (input) => classifySessionRole(input, controllerNames, workspaceFolderName);
}

/** Options for recent-updates indicators (orange = since last viewed, red = last minute) and
 *  the newer-log banner / per-row dot (blue = newer than the panel's dismiss cursor). */
export interface SessionListPayloadOptions {
    /** Returns last write time (ms) for the active session, if any. */
    getActiveLastWriteTime?: () => number | undefined;
    /** Returns last viewed time (ms) for a log URI. */
    getLastViewedAt?: (uri: string) => number | undefined;
    /** Returns the Logs panel's "newer-log dismiss" cursor (ms). Logs with mtime greater than this
     *  carry `unreadSinceFocus: true` and trigger the banner + per-row dot. Undefined disables both. */
    getDismissedAt?: () => number | undefined;
    /** Pre-built `classifySessionKind` callable. Omitted = every record falls back to 'project'. */
    classifyMeta?: ClassifyMeta;
    /** Pre-built `classifySessionRole` callable. Omitted = every record falls back to 'peripheral'
     *  (so with no controllers detected the day renders as a flat list — the safe degradation). */
    classifyRole?: ClassifyRole;
}

/** Update "last viewed" timestamp for a log (used for "updated since last viewed" indicator). Best-effort per-uri; concurrent opens may race. */
export async function updateLastViewed(context: vscode.ExtensionContext, uri: vscode.Uri | string): Promise<void> {
    const uriStr = typeof uri === 'string' ? uri : uri.toString();
    const map = context.workspaceState.get<Record<string, number>>(LOG_LAST_VIEWED_KEY, {});
    map[uriStr] = Date.now();
    await context.workspaceState.update(LOG_LAST_VIEWED_KEY, map);
}

/** Shared type for session metadata fields needed to build a webview record. */
type Meta = { filename: string; displayName?: string; note?: string; adapter?: string; size: number; mtime: number; date?: string; hasTimestamps?: boolean; lineCount?: number; durationMs?: number; errorCount?: number; warningCount?: number; perfCount?: number; anrCount?: number; fwCount?: number; infoCount?: number; debugCount?: number; databaseCount?: number; todoCount?: number; noticeCount?: number; uri: { toString(): string }; trashed?: boolean; pinned?: boolean; pinnedAt?: number; tags?: string[]; autoTags?: string[]; correlationTags?: string[]; hasPerformanceData?: boolean; groupId?: string;
    /** Parsed log header `Project:` value — feeds the session-kind classifier's workspace-match rule. */
    project?: string;
    /** DAP adapter type ("dart", "node", …) — feeds the session-kind classifier's debug-session rule. */
    debugAdapterType?: string;
    /** Explicit kind override (user's manual decision) — the classifier reads this first. */
    kind?: SessionKind;
    /** Explicit Controller/Peripheral override (user's manual decision) — the role classifier reads this first. */
    role?: SessionRole;
    /** True for rows injected from the loaded-files history (Open Log File picker). */
    loadedManually?: boolean;
};

/** Extra fields written onto session-group member records so the webview can render groupings. */
type GroupRenderExtras = { groupId?: string; isGroupPrimary?: boolean; groupSize?: number };

/** Build a single webview record from session metadata. */
export async function buildSessionItemRecord(
    m: Meta,
    activeStr: string | undefined,
    options?: SessionListPayloadOptions,
    extras?: GroupRenderExtras,
): Promise<Record<string, unknown>> {
    const { getActiveLastWriteTime, getLastViewedAt, getDismissedAt, classifyMeta, classifyRole } = options ?? {};
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
    // Newer-log unread state: any log whose mtime exceeds the dismiss cursor AND that the user
    // hasn't viewed since then. We don't AND with `lastViewedAt`: a never-viewed-but-old log
    // shouldn't keep nagging if the user has already cleared it from the banner. The cursor
    // moves to Date.now() on dismiss, so "older than cursor" reliably means "user moved past it".
    const dismissedAt = getDismissedAt?.();
    const unreadSinceFocus = typeof dismissedAt === 'number' && lastUpdatedAt > dismissedAt;
    // Session kind (project vs report) — drives the per-day Reports bucket. classifyMeta is built
    // once per payload (compiled patterns + workspace folder), then called per record.
    const kind: SessionKind = classifyMeta
        ? classifyMeta({ kind: m.kind, debugAdapterType: m.debugAdapterType, project: m.project, displayName: m.displayName })
        : 'project';
    // Controller vs peripheral — the day's tree root that peripherals nest under. Defaults to
    // peripheral when no classifier is supplied so the panel degrades to a flat list rather than
    // promoting an arbitrary row to a controller root.
    const role: SessionRole = classifyRole
        ? classifyRole({ role: m.role, kind: m.kind, debugAdapterType: m.debugAdapterType, project: m.project, displayName: m.displayName })
        : 'peripheral';
    return {
        filename: m.filename, displayName: m.displayName ?? m.filename, note: m.note, adapter: m.adapter,
        size: m.size, mtime, formattedMtime: formatMtime(mtime),
        formattedTime: formatMtimeTimeOnly(mtime), relativeTime: formatRelativeTime(mtime), date: m.date,
        hasTimestamps: m.hasTimestamps ?? false, lineCount: m.lineCount ?? 0,
        durationMs: m.durationMs ?? 0, errorCount: m.errorCount ?? 0,
        warningCount: m.warningCount ?? 0, perfCount: m.perfCount ?? 0,
        anrCount: m.anrCount ?? 0,
        fwCount: m.fwCount ?? 0, infoCount: m.infoCount ?? 0,
        debugCount: m.debugCount ?? 0, databaseCount: m.databaseCount ?? 0,
        todoCount: m.todoCount ?? 0, noticeCount: m.noticeCount ?? 0,
        isActive,
        updatedSinceViewed,
        updatedInLastMinute,
        unreadSinceFocus,
        kind,
        role,
        uriString: uriStr, trashed: m.trashed ?? false,
        pinned: m.pinned ?? false, pinnedAt: m.pinnedAt ?? 0,
        tags: m.tags ?? [],
        autoTags: m.autoTags ?? [], correlationTags: m.correlationTags ?? [],
        hasPerformanceData: m.hasPerformanceData ?? false,
        // Session-group render hints. `groupId` prefers the explicit extras value (from a
        // SessionGroup's expansion in buildSessionListPayload) over the raw SessionMeta field so
        // that groups built via auto-grouping AND manual grouping both carry the id uniformly.
        groupId: extras?.groupId ?? m.groupId,
        isGroupPrimary: extras?.isGroupPrimary ?? false,
        groupSize: extras?.groupSize ?? 0,
        // Flags rows sourced from the loaded-files history so the webview can mark them.
        loadedManually: m.loadedManually ?? false,
    };
}

/** Convert tree items to a flat session list for the webview panel. Uses filesystem stat when mtime is missing; processes items sequentially to avoid I/O burst. */
export async function buildSessionListPayload(
    items: readonly TreeItem[],
    activeUri: vscode.Uri | undefined,
    options?: SessionListPayloadOptions,
): Promise<Record<string, unknown>[]> {
    const activeStr = activeUri?.toString();
    const records: Record<string, unknown>[] = [];
    for (const item of items) {
        if (isSessionGroup(item)) {
            records.push(...await expandSessionGroupToRecords(item, activeStr, options));
        } else if (isSplitGroup(item)) {
            for (const part of item.parts) { records.push(await buildSessionItemRecord(part, activeStr, options)); }
        } else {
            records.push(await buildSessionItemRecord(item, activeStr, options));
        }
    }
    return records;
}

/**
 * Expand a SessionGroup into one webview record per member. Each record carries the shared
 * groupId, an isGroupPrimary flag for the member chosen by pickPrimaryTreeItem(), and the group's
 * total member count (so the webview can render the "+N" badge without recounting).
 *
 * SplitGroup members are flattened to their parts, inheriting the same extras; nested SessionGroups
 * aren't produced by groupSessionGroups() today but are handled defensively in case a future
 * refactor introduces them.
 */
async function expandSessionGroupToRecords(
    group: { groupId: string; members: readonly TreeItem[]; primary: TreeItem },
    activeStr: string | undefined,
    options: SessionListPayloadOptions | undefined,
): Promise<Record<string, unknown>[]> {
    const records: Record<string, unknown>[] = [];
    const groupSize = group.members.length;
    for (const member of group.members) {
        const extras = { groupId: group.groupId, isGroupPrimary: member === group.primary, groupSize };
        if (isSplitGroup(member)) {
            for (const part of member.parts) {
                records.push(await buildSessionItemRecord(part, activeStr, options, extras));
            }
        } else {
            records.push(await buildSessionItemRecord(member, activeStr, options, extras));
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

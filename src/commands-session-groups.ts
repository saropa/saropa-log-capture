/**
 * Session-group user commands: manual group + ungroup.
 *
 * These commands are the escape hatch when auto-grouping (driven by the DAP
 * anchor in `session-group-tracker.ts`) gets something wrong or doesn't fire.
 * They bypass the "never re-claim" rule enforced by `stampGroupIdBatch` \u2014 user
 * intent is explicit, so clearing the existing `groupId` is the correct move.
 *
 * See bugs/auto-group-related-sessions.md \u00a7"Manual group" and \u00a7"Ungroup".
 */

import * as vscode from 'vscode';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import type { LogViewerProvider } from './ui/provider/log-viewer-provider';
import { generateGroupId } from './modules/session/session-groups';

/** Extract the Uri out of either a bare Uri or a context-menu item { uri }. Returns undefined for unknown input. */
function toUri(arg: unknown): vscode.Uri | undefined {
    if (!arg) { return undefined; }
    if (arg instanceof vscode.Uri) { return arg; }
    const maybe = arg as { uri?: unknown };
    return maybe.uri instanceof vscode.Uri ? maybe.uri : undefined;
}

/**
 * Resolve the command target into a list of log-file URIs.
 *
 * VS Code passes multi-selection as the second argument; the first is the
 * primary item. When nothing is supplied, fall back to the active editor.
 */
function resolveUris(primary: unknown, selection: unknown): vscode.Uri[] {
    const uris: vscode.Uri[] = [];
    const seen = new Set<string>();
    const push = (u: vscode.Uri | undefined): void => {
        if (!u) { return; }
        const key = u.toString();
        if (seen.has(key)) { return; }
        seen.add(key);
        uris.push(u);
    };
    if (Array.isArray(selection)) {
        for (const item of selection) { push(toUri(item)); }
    }
    push(toUri(primary));
    if (uris.length === 0) {
        push(vscode.window.activeTextEditor?.document.uri);
    }
    return uris;
}

/** Register the three session-group commands. Returns disposables for `context.subscriptions`. */
export function sessionGroupCommands(
    historyProvider: SessionHistoryProvider,
    viewerProvider: LogViewerProvider,
): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.groupSelectedSessions', (primary?: unknown, selection?: unknown) =>
            runGroupSelectedSessions(historyProvider, resolveUris(primary, selection)),
        ),
        vscode.commands.registerCommand('saropaLogCapture.ungroupSession', (primary?: unknown, selection?: unknown) =>
            runUngroupSession(historyProvider, resolveUris(primary, selection)),
        ),
        vscode.commands.registerCommand('saropaLogCapture.openSessionGroup', (primary?: unknown, selection?: unknown) =>
            runOpenSessionGroup(historyProvider, viewerProvider, resolveUris(primary, selection)),
        ),
    ];
}

/**
 * Manually group a set of log files.
 *
 *   1. Clear any existing `groupId` on every target (override the heuristic).
 *   2. Mint a fresh `groupId`.
 *   3. Stamp every target with the new id in a single batch write.
 *
 * Re-exported for tests.
 */
export async function runGroupSelectedSessions(
    historyProvider: SessionHistoryProvider,
    uris: readonly vscode.Uri[],
): Promise<void> {
    if (uris.length === 0) {
        vscode.window.showWarningMessage('Select at least one log file to group.');
        return;
    }
    const store = historyProvider.getMetaStore();
    try {
        // Step 1: clear the old groupId from every target so we can override the never-re-claim rule.
        await store.stampGroupIdBatch(uris, undefined);
        // Step 2: mint a new id.
        const groupId = generateGroupId();
        // Step 3: stamp. The store's never-re-claim guard is satisfied because we just cleared.
        const stamped = await store.stampGroupIdBatch(uris, groupId);
        historyProvider.refresh();
        if (uris.length === 1) {
            // A single-member "group" is effectively just a manual clear \u2014 still valid, user had a reason.
            vscode.window.showInformationMessage(`Removed group membership from the selected log.`);
        } else {
            vscode.window.showInformationMessage(
                `Grouped ${stamped.length} log${stamped.length === 1 ? '' : 's'} into a single Session.`,
            );
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Could not group selected sessions: ${msg}`);
    }
}

/**
 * Ungroup the session(s) containing the given target file(s).
 *
 * Reads each target's `groupId`, collects every other file sharing that id
 * from the central metadata map, and clears `groupId` on all of them in one
 * batch. Multiple targets belonging to different groups ungroup them all.
 *
 * Re-exported for tests.
 */
export async function runUngroupSession(
    historyProvider: SessionHistoryProvider,
    uris: readonly vscode.Uri[],
): Promise<void> {
    if (uris.length === 0) {
        vscode.window.showWarningMessage('Select a grouped log file to ungroup.');
        return;
    }
    const store = historyProvider.getMetaStore();
    const logDir = vscode.Uri.joinPath(uris[0], '..');
    try {
        const all = await store.loadAllMetadata(logDir);
        // Collect the set of groupIds to dismantle (one per target).
        const groupIds = new Set<string>();
        for (const uri of uris) {
            const relKey = vscode.workspace.asRelativePath(uri).replace(/\\/g, '/');
            const meta = all.get(relKey);
            if (meta?.groupId) { groupIds.add(meta.groupId); }
        }
        if (groupIds.size === 0) {
            vscode.window.showInformationMessage('Selected log is not part of a group.');
            return;
        }
        // Fan out: every file in the metadata map whose groupId is in our set gets cleared.
        const toClear: vscode.Uri[] = [];
        for (const [relKey, meta] of all) {
            if (meta.groupId && groupIds.has(meta.groupId)) {
                toClear.push(vscode.Uri.joinPath(logDir, relKey));
            }
        }
        await store.stampGroupIdBatch(toClear, undefined);
        historyProvider.refresh();
        vscode.window.showInformationMessage(
            `Ungrouped ${toClear.length} log${toClear.length === 1 ? '' : 's'} ` +
            `from ${groupIds.size} group${groupIds.size === 1 ? '' : 's'}.`,
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Could not ungroup: ${msg}`);
    }
}

/**
 * Open every file in the target's session group as a single merged view.
 *
 * Resolution rules:
 *   - If a target URI carries a `groupId`, expand to every other file sharing
 *     that groupId (the user likely clicked one member and wants the whole
 *     bundle).
 *   - Targets without a groupId are opened as-is: multi-selection of
 *     standalone files becomes an ad-hoc merged view, which is useful when a
 *     user wants a one-off merge without creating a persistent group.
 *
 * Delegates to `LogViewerProvider.loadFromFiles()` for the actual stream.
 * Re-exported for tests.
 */
export async function runOpenSessionGroup(
    historyProvider: SessionHistoryProvider,
    viewerProvider: LogViewerProvider,
    uris: readonly vscode.Uri[],
): Promise<void> {
    if (uris.length === 0) {
        vscode.window.showWarningMessage('Select one or more log files to open as a merged group.');
        return;
    }
    try {
        const expanded = await expandGroupMembership(historyProvider, uris);
        await viewerProvider.loadFromFiles(expanded);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Could not open session group: ${msg}`);
    }
}

/**
 * Expand any group-member URI into the full set of its group's members.
 * Non-grouped URIs pass through unchanged. Result preserves input order for
 * the targets that had no group, with group expansions inserted at the
 * position where the target appeared.
 */
async function expandGroupMembership(
    historyProvider: SessionHistoryProvider,
    uris: readonly vscode.Uri[],
): Promise<vscode.Uri[]> {
    if (uris.length === 0) { return []; }
    const store = historyProvider.getMetaStore();
    const logDir = vscode.Uri.joinPath(uris[0], '..');
    const all = await store.loadAllMetadata(logDir);
    const seen = new Set<string>();
    const out: vscode.Uri[] = [];
    const push = (u: vscode.Uri): void => {
        const key = u.toString();
        if (seen.has(key)) { return; }
        seen.add(key);
        out.push(u);
    };
    for (const target of uris) {
        const relKey = vscode.workspace.asRelativePath(target).replace(/\\/g, '/');
        const meta = all.get(relKey);
        if (meta?.groupId) {
            pushGroupMembers(all, meta.groupId, logDir, push);
        } else {
            push(target);
        }
    }
    return out;
}

/** Push every file sharing `groupId` through the caller's dedupe function. */
function pushGroupMembers(
    all: ReadonlyMap<string, import('./modules/session/session-metadata').SessionMeta>,
    groupId: string,
    logDir: vscode.Uri,
    push: (u: vscode.Uri) => void,
): void {
    for (const [relPath, other] of all) {
        if (other.groupId === groupId) {
            push(vscode.Uri.joinPath(logDir, relPath));
        }
    }
}

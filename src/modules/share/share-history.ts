/**
 * Share history: recent Gist shares stored in workspace state for quick re-copy of links.
 */

import * as vscode from 'vscode';
import type { GistShareResult } from './share-types';

const SHARE_HISTORY_KEY = 'slc.shareHistory';
const MAX_RECENT_SHARES = 10;

export interface ShareHistoryEntry {
    readonly gistId: string;
    readonly deepLinkUrl: string;
    readonly gistUrl: string;
    readonly collectionName: string;
    readonly sharedAt: number;
}

export async function getShareHistory(context: vscode.ExtensionContext): Promise<ShareHistoryEntry[]> {
    const raw = context.workspaceState.get<ShareHistoryEntry[]>(SHARE_HISTORY_KEY, []);
    return raw.slice(0, MAX_RECENT_SHARES);
}

export async function addToShareHistory(
    context: vscode.ExtensionContext,
    result: GistShareResult,
    collectionName: string,
): Promise<void> {
    const entry: ShareHistoryEntry = {
        gistId: result.gistId,
        deepLinkUrl: result.deepLinkUrl,
        gistUrl: result.gistUrl,
        collectionName,
        sharedAt: Date.now(),
    };
    const list = await getShareHistory(context);
    const filtered = list.filter((e) => e.gistId !== result.gistId);
    const updated = [entry, ...filtered].slice(0, MAX_RECENT_SHARES);
    await context.workspaceState.update(SHARE_HISTORY_KEY, updated);
}

export async function clearShareHistory(context: vscode.ExtensionContext): Promise<void> {
    await context.workspaceState.update(SHARE_HISTORY_KEY, []);
}

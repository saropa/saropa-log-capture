/**
 * Collection workspace state (active id, recent list, search history).
 * Extracted to keep collection-store.ts under the line limit.
 */

import * as vscode from 'vscode';
import { MAX_SEARCH_HISTORY } from './collection-types';

export const ACTIVE_COLLECTION_KEY = 'slc.activeCollectionId';
export const RECENT_COLLECTIONS_KEY = 'slc.recentCollectionIds';
export const SEARCH_HISTORY_KEY = 'slc.searchHistory';
export const MAX_RECENT = 5;

export async function getActiveCollectionId(context: vscode.ExtensionContext): Promise<string | undefined> {
    return context.workspaceState.get<string>(ACTIVE_COLLECTION_KEY);
}

export async function setActiveCollectionId(context: vscode.ExtensionContext, id: string | undefined): Promise<void> {
    await context.workspaceState.update(ACTIVE_COLLECTION_KEY, id);
    if (id) {
        await addToRecent(context, id);
    }
}

export function getRecentCollectionIds(context: vscode.ExtensionContext): string[] {
    return context.workspaceState.get<string[]>(RECENT_COLLECTIONS_KEY, []);
}

export async function addToRecent(context: vscode.ExtensionContext, id: string): Promise<void> {
    const recent = getRecentCollectionIds(context);
    const filtered = recent.filter(r => r !== id);
    const updated = [id, ...filtered].slice(0, MAX_RECENT);
    await context.workspaceState.update(RECENT_COLLECTIONS_KEY, updated);
}

export function getSearchHistory(context: vscode.ExtensionContext): string[] {
    return context.workspaceState.get<string[]>(SEARCH_HISTORY_KEY, []);
}

export async function addToSearchHistory(context: vscode.ExtensionContext, query: string): Promise<void> {
    if (!query.trim()) { return; }
    const history = getSearchHistory(context);
    const filtered = history.filter(q => q !== query);
    const updated = [query, ...filtered].slice(0, MAX_SEARCH_HISTORY);
    await context.workspaceState.update(SEARCH_HISTORY_KEY, updated);
}

export async function clearSearchHistory(context: vscode.ExtensionContext): Promise<void> {
    await context.workspaceState.update(SEARCH_HISTORY_KEY, []);
}

/**
 * Investigation workspace state (active id, recent list, search history).
 * Extracted to keep investigation-store.ts under the line limit.
 */

import * as vscode from 'vscode';
import { MAX_SEARCH_HISTORY } from './investigation-types';

export const ACTIVE_INVESTIGATION_KEY = 'slc.activeInvestigationId';
export const RECENT_INVESTIGATIONS_KEY = 'slc.recentInvestigationIds';
export const SEARCH_HISTORY_KEY = 'slc.searchHistory';
export const MAX_RECENT = 5;

export async function getActiveInvestigationId(context: vscode.ExtensionContext): Promise<string | undefined> {
    return context.workspaceState.get<string>(ACTIVE_INVESTIGATION_KEY);
}

export async function setActiveInvestigationId(context: vscode.ExtensionContext, id: string | undefined): Promise<void> {
    await context.workspaceState.update(ACTIVE_INVESTIGATION_KEY, id);
    if (id) {
        await addToRecent(context, id);
    }
}

export function getRecentInvestigationIds(context: vscode.ExtensionContext): string[] {
    return context.workspaceState.get<string[]>(RECENT_INVESTIGATIONS_KEY, []);
}

export async function addToRecent(context: vscode.ExtensionContext, id: string): Promise<void> {
    const recent = getRecentInvestigationIds(context);
    const filtered = recent.filter(r => r !== id);
    const updated = [id, ...filtered].slice(0, MAX_RECENT);
    await context.workspaceState.update(RECENT_INVESTIGATIONS_KEY, updated);
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

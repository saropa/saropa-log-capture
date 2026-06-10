/**
 * Initializes noise-learning services (workspace-scoped). Accessed from activation and handlers.
 */

import * as vscode from "vscode";
import type { SessionManagerImpl } from "../session/session-manager";
import { InteractionTracker } from "./interaction-tracker";
import { LearningStore } from "./learning-store";
import { GlobalAggregateStore, canPromote } from "./global-aggregates";

let store: LearningStore | undefined;
let tracker: InteractionTracker | undefined;
let globalStore: GlobalAggregateStore | undefined;
let workspaceState: vscode.Memento | undefined;

/** Workspace-local memo of patterns already promoted from HERE, so re-accepting the same
 *  pattern can't inflate the cross-workspace count. Kept in workspace (not global) state so
 *  global storage never holds anything workspace-identifying. */
const PROMOTED_KEY = "saropaLogCapture.learning.promotedPatterns.v1";

export function initLearningRuntime(
    context: vscode.ExtensionContext,
    sessionManager: SessionManagerImpl,
): void {
    store = new LearningStore(context.workspaceState);
    globalStore = new GlobalAggregateStore(context.globalState);
    workspaceState = context.workspaceState;
    tracker = new InteractionTracker({
        store,
        getSessionId: () => sessionManager.getActiveSession()?.fileUri.toString() ?? "none",
        getMaxLineLength: () =>
            vscode.workspace.getConfiguration("saropaLogCapture").get<number>("learning.maxStoredLineLength", 2000) ?? 2000,
        isEnabled: () =>
            vscode.workspace.getConfiguration("saropaLogCapture").get<boolean>("learning.enabled", true) !== false,
    });
}

export function getLearningStore(): LearningStore | undefined {
    return store;
}

export function getGlobalAggregateStore(): GlobalAggregateStore | undefined {
    return globalStore;
}

/** Read the opt-in flag (default OFF, per the privacy posture). */
export function globalAggregatesOptedIn(): boolean {
    return vscode.workspace
        .getConfiguration("saropaLogCapture")
        .get<boolean>("learning.globalAggregates", false) === true;
}

/**
 * Promote a just-accepted suggestion to cross-workspace storage when eligible (opt-in,
 * framework-class, high confidence, deny-list clean) and not already promoted from this
 * workspace. Looks the row up by id so callers need only the id; no-op when ineligible —
 * safe to call on every accept. Plan 053-D.
 */
export async function promoteAcceptedSuggestion(id: string): Promise<void> {
    if (!globalStore || !workspaceState || !store) { return; }
    const row = (await store.listSuggestions()).find((s) => s.id === id);
    if (!row) { return; }
    if (!canPromote(row.pattern, row.category, row.confidence, globalAggregatesOptedIn())) { return; }
    const promoted = workspaceState.get<string[]>(PROMOTED_KEY, []);
    if (promoted.includes(row.pattern)) { return; } // this workspace already counted
    await workspaceState.update(PROMOTED_KEY, [...promoted, row.pattern]);
    await globalStore.promote(row.pattern, row.category, Date.now());
}

export function getInteractionTracker(): InteractionTracker | undefined {
    return tracker;
}

export async function flushLearningBuffer(): Promise<void> {
    await tracker?.flush();
}

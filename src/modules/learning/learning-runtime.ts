/**
 * Initializes noise-learning services (workspace-scoped). Accessed from activation and handlers.
 */

import * as vscode from "vscode";
import type { SessionManagerImpl } from "../session/session-manager";
import { InteractionTracker } from "./interaction-tracker";
import { LearningStore } from "./learning-store";

let store: LearningStore | undefined;
let tracker: InteractionTracker | undefined;

export function initLearningRuntime(
    context: vscode.ExtensionContext,
    sessionManager: SessionManagerImpl,
): void {
    store = new LearningStore(context.workspaceState);
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

export function getInteractionTracker(): InteractionTracker | undefined {
    return tracker;
}

export async function flushLearningBuffer(): Promise<void> {
    await tracker?.flush();
}

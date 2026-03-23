/**
 * Periodic prompt when new filter suggestions exceed confidence (respects suggestionFrequency).
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import type { ViewerBroadcaster } from "../../ui/provider/viewer-broadcaster";
import { showFilterSuggestionsQuickPick } from "../../ui/panels/filter-suggestions-ui";
import { flushLearningBuffer, getLearningStore } from "./learning-runtime";
import { SuggestionEngine } from "./suggestion-engine";

export async function maybeShowLearningSuggestionPrompt(broadcaster: ViewerBroadcaster): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
    if (cfg.get<boolean>("learning.enabled", true) === false) {
        return;
    }
    const freq = cfg.get<string>("learning.suggestionFrequency", "weekly");
    if (freq === "never") {
        return;
    }
    const store = getLearningStore();
    if (!store) {
        return;
    }
    const intervalMs = freq === "daily" ? 86_400_000 : 7 * 86_400_000;
    const last = await store.getLastSuggestionPromptMs();
    if (last > 0 && Date.now() - last < intervalMs) {
        return;
    }
    // Flush only when we may prompt (avoids persisting batches on every cooldown check).
    await flushLearningBuffer();
    const engine = new SuggestionEngine(store);
    const pending = await engine.refreshAndListPending();
    const minC = cfg.get<number>("learning.minConfidence", 0.8);
    const good = pending.filter((s) => s.confidence >= minC);
    if (good.length === 0) {
        return;
    }
    await store.setLastSuggestionPromptMs(Date.now());
    const choice = await vscode.window.showInformationMessage(
        t("learning.notification", String(good.length)),
        t("learning.review"),
        t("learning.notNow"),
    );
    if (choice === t("learning.review")) {
        await showFilterSuggestionsQuickPick(good, store, (patterns) => {
            broadcaster.setExclusions(patterns);
        });
    }
}

/** Schedule a deferred check so activation stays fast. */
export function scheduleLearningSuggestionCheck(
    context: vscode.ExtensionContext,
    broadcaster: ViewerBroadcaster,
    delayMs = 12_000,
): void {
    const handle = setTimeout(() => {
        void maybeShowLearningSuggestionPrompt(broadcaster);
    }, delayMs);
    context.subscriptions.push(new vscode.Disposable(() => clearTimeout(handle)));
}

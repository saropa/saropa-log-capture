/**
 * Commands for noise learning: review suggestions and clear stored data.
 */

import * as vscode from "vscode";
import { t } from "./l10n";
import type { CommandDeps } from "./commands-deps";
import { showFilterSuggestionsQuickPick } from "./ui/panels/filter-suggestions-ui";
import {
    flushLearningBuffer,
    getGlobalAggregateStore,
    getLearningStore,
} from "./modules/learning/learning-runtime";
import { SuggestionEngine } from "./modules/learning/suggestion-engine";
import { maybeShowLearningSuggestionPrompt } from "./modules/learning/learning-notifications";

export function learningCommands(deps: CommandDeps): vscode.Disposable[] {
    const { broadcaster } = deps;
    return [
        vscode.commands.registerCommand("saropaLogCapture.showFilterSuggestions", async () => {
            const store = getLearningStore();
            if (!store) {
                return;
            }
            await flushLearningBuffer();
            const engine = new SuggestionEngine(store, getGlobalAggregateStore());
            const pending = await engine.refreshAndListPending();
            await showFilterSuggestionsQuickPick(pending, store, (patterns) => {
                broadcaster.setExclusions(patterns);
            });
        }),
        vscode.commands.registerCommand("saropaLogCapture.clearLearningData", async () => {
            const store = getLearningStore();
            if (!store) {
                return;
            }
            const confirm = await vscode.window.showWarningMessage(
                t("learning.clearConfirm"),
                { modal: true },
                t("learning.clearConfirmYes"),
            );
            if (confirm !== t("learning.clearConfirmYes")) {
                return;
            }
            await store.clearAll();
            void vscode.window.showInformationMessage(t("learning.cleared"));
        }),
        vscode.commands.registerCommand("saropaLogCapture.clearGlobalAggregates", async () => {
            // Plan 053-D4: a one-action wipe of the machine-global noise patterns, behind a modal
            // confirm because it affects every workspace on this machine, not just the current one.
            const globalStore = getGlobalAggregateStore();
            if (!globalStore) {
                return;
            }
            const confirm = await vscode.window.showWarningMessage(
                t("learning.clearGlobalConfirm"),
                { modal: true },
                t("learning.clearConfirmYes"),
            );
            if (confirm !== t("learning.clearConfirmYes")) {
                return;
            }
            await globalStore.clear();
            void vscode.window.showInformationMessage(t("learning.globalCleared"));
        }),
        vscode.commands.registerCommand("saropaLogCapture.checkFilterSuggestions", async () => {
            await maybeShowLearningSuggestionPrompt(deps.broadcaster);
        }),
    ];
}

/**
 * Quick Pick UI to review and accept/reject filter suggestions from noise learning.
 *
 * Accept path: workspace `exclusions` update then `applyExclusionPatterns` so sidebar and pop-out
 * viewers stay in sync. Suggestion status is set to **accepted** only after a successful config write.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import type { RuleSuggestion } from "../../modules/learning/suggestion-engine";
import { LearningStore } from "../../modules/learning/learning-store";

export async function showFilterSuggestionsQuickPick(
    suggestions: readonly RuleSuggestion[],
    store: LearningStore,
    applyExclusionPatterns: (patterns: readonly string[]) => void,
): Promise<void> {
    if (suggestions.length === 0) {
        void vscode.window.showInformationMessage(t("learning.noSuggestions"));
        return;
    }
    const items: (vscode.QuickPickItem & { sid: string; pattern: string })[] = suggestions.map((s) => ({
        label: s.pattern.length > 72 ? `${s.pattern.slice(0, 69)}…` : s.pattern,
        description: `~${s.impact.linesAffected} lines · ${s.impact.percentageReduction}%`,
        detail: s.sampleLines[0] ? s.sampleLines[0].slice(0, 200) : s.description,
        sid: s.id,
        pattern: s.pattern,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: t("learning.pickTitle"),
        placeHolder: t("learning.pickPlaceholder"),
        canPickMany: false,
    });
    if (!picked) {
        return;
    }
    const action = await vscode.window.showInformationMessage(
        t("learning.applyPrompt", picked.pattern),
        t("learning.accept"),
        t("learning.reject"),
    );
    if (action === t("learning.accept")) {
        const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
        const cur = cfg.get<string[]>("exclusions", []);
        const next = cur.includes(picked.pattern) ? cur : [...cur, picked.pattern];
        try {
            if (!cur.includes(picked.pattern)) {
                await cfg.update("exclusions", next, vscode.ConfigurationTarget.Workspace);
            }
        } catch {
            void vscode.window.showErrorMessage(t("learning.acceptFailed", picked.pattern));
            return;
        }
        applyExclusionPatterns(next);
        await store.setSuggestionStatus(picked.sid, "accepted");
        void vscode.window.showInformationMessage(t("learning.accepted", picked.pattern));
    } else if (action === t("learning.reject")) {
        await store.setSuggestionStatus(picked.sid, "rejected");
    }
}

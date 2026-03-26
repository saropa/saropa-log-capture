"use strict";
/**
 * Quick Pick UI to review and accept/reject filter suggestions from noise learning.
 *
 * Accept path: workspace `exclusions` update then `applyExclusionPatterns` so sidebar and pop-out
 * viewers stay in sync. Suggestion status is set to **accepted** only after a successful config write.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.showFilterSuggestionsQuickPick = showFilterSuggestionsQuickPick;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
async function showFilterSuggestionsQuickPick(suggestions, store, applyExclusionPatterns) {
    if (suggestions.length === 0) {
        void vscode.window.showInformationMessage((0, l10n_1.t)("learning.noSuggestions"));
        return;
    }
    const items = suggestions.map((s) => ({
        label: s.pattern.length > 72 ? `${s.pattern.slice(0, 69)}…` : s.pattern,
        description: `~${s.impact.linesAffected} lines · ${s.impact.percentageReduction}%`,
        detail: s.sampleLines[0] ? s.sampleLines[0].slice(0, 200) : s.description,
        sid: s.id,
        pattern: s.pattern,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: (0, l10n_1.t)("learning.pickTitle"),
        placeHolder: (0, l10n_1.t)("learning.pickPlaceholder"),
        canPickMany: false,
    });
    if (!picked) {
        return;
    }
    const action = await vscode.window.showInformationMessage((0, l10n_1.t)("learning.applyPrompt", picked.pattern), (0, l10n_1.t)("learning.accept"), (0, l10n_1.t)("learning.reject"));
    if (action === (0, l10n_1.t)("learning.accept")) {
        const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
        const cur = cfg.get("exclusions", []);
        const next = cur.includes(picked.pattern) ? cur : [...cur, picked.pattern];
        try {
            if (!cur.includes(picked.pattern)) {
                await cfg.update("exclusions", next, vscode.ConfigurationTarget.Workspace);
            }
        }
        catch {
            void vscode.window.showErrorMessage((0, l10n_1.t)("learning.acceptFailed", picked.pattern));
            return;
        }
        applyExclusionPatterns(next);
        await store.setSuggestionStatus(picked.sid, "accepted");
        void vscode.window.showInformationMessage((0, l10n_1.t)("learning.accepted", picked.pattern));
    }
    else if (action === (0, l10n_1.t)("learning.reject")) {
        await store.setSuggestionStatus(picked.sid, "rejected");
    }
}
//# sourceMappingURL=filter-suggestions-ui.js.map
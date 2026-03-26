"use strict";
/**
 * Periodic prompt when new filter suggestions exceed confidence (respects suggestionFrequency).
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
exports.maybeShowLearningSuggestionPrompt = maybeShowLearningSuggestionPrompt;
exports.scheduleLearningSuggestionCheck = scheduleLearningSuggestionCheck;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const filter_suggestions_ui_1 = require("../../ui/panels/filter-suggestions-ui");
const learning_runtime_1 = require("./learning-runtime");
const suggestion_engine_1 = require("./suggestion-engine");
async function maybeShowLearningSuggestionPrompt(broadcaster) {
    const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
    if (cfg.get("learning.enabled", true) === false) {
        return;
    }
    const freq = cfg.get("learning.suggestionFrequency", "weekly");
    if (freq === "never") {
        return;
    }
    const store = (0, learning_runtime_1.getLearningStore)();
    if (!store) {
        return;
    }
    const intervalMs = freq === "daily" ? 86_400_000 : 7 * 86_400_000;
    const last = await store.getLastSuggestionPromptMs();
    if (last > 0 && Date.now() - last < intervalMs) {
        return;
    }
    // Flush only when we may prompt (avoids persisting batches on every cooldown check).
    await (0, learning_runtime_1.flushLearningBuffer)();
    const engine = new suggestion_engine_1.SuggestionEngine(store);
    const pending = await engine.refreshAndListPending();
    const minC = cfg.get("learning.minConfidence", 0.8);
    const good = pending.filter((s) => s.confidence >= minC);
    if (good.length === 0) {
        return;
    }
    await store.setLastSuggestionPromptMs(Date.now());
    const choice = await vscode.window.showInformationMessage((0, l10n_1.t)("learning.notification", String(good.length)), (0, l10n_1.t)("learning.review"), (0, l10n_1.t)("learning.notNow"));
    if (choice === (0, l10n_1.t)("learning.review")) {
        await (0, filter_suggestions_ui_1.showFilterSuggestionsQuickPick)(good, store, (patterns) => {
            broadcaster.setExclusions(patterns);
        });
    }
}
/** Schedule a deferred check so activation stays fast. */
function scheduleLearningSuggestionCheck(context, broadcaster, delayMs = 12_000) {
    const handle = setTimeout(() => {
        void maybeShowLearningSuggestionPrompt(broadcaster);
    }, delayMs);
    context.subscriptions.push(new vscode.Disposable(() => clearTimeout(handle)));
}
//# sourceMappingURL=learning-notifications.js.map
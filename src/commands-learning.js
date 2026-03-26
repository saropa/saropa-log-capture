"use strict";
/**
 * Commands for noise learning: review suggestions and clear stored data.
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
exports.learningCommands = learningCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const filter_suggestions_ui_1 = require("./ui/panels/filter-suggestions-ui");
const learning_runtime_1 = require("./modules/learning/learning-runtime");
const suggestion_engine_1 = require("./modules/learning/suggestion-engine");
const learning_notifications_1 = require("./modules/learning/learning-notifications");
function learningCommands(deps) {
    const { broadcaster } = deps;
    return [
        vscode.commands.registerCommand("saropaLogCapture.showFilterSuggestions", async () => {
            const store = (0, learning_runtime_1.getLearningStore)();
            if (!store) {
                return;
            }
            await (0, learning_runtime_1.flushLearningBuffer)();
            const engine = new suggestion_engine_1.SuggestionEngine(store);
            const pending = await engine.refreshAndListPending();
            await (0, filter_suggestions_ui_1.showFilterSuggestionsQuickPick)(pending, store, (patterns) => {
                broadcaster.setExclusions(patterns);
            });
        }),
        vscode.commands.registerCommand("saropaLogCapture.clearLearningData", async () => {
            const store = (0, learning_runtime_1.getLearningStore)();
            if (!store) {
                return;
            }
            const confirm = await vscode.window.showWarningMessage((0, l10n_1.t)("learning.clearConfirm"), { modal: true }, (0, l10n_1.t)("learning.clearConfirmYes"));
            if (confirm !== (0, l10n_1.t)("learning.clearConfirmYes")) {
                return;
            }
            await store.clearAll();
            void vscode.window.showInformationMessage((0, l10n_1.t)("learning.cleared"));
        }),
        vscode.commands.registerCommand("saropaLogCapture.checkFilterSuggestions", async () => {
            await (0, learning_notifications_1.maybeShowLearningSuggestionPrompt)(deps.broadcaster);
        }),
    ];
}
//# sourceMappingURL=commands-learning.js.map
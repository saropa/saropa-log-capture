"use strict";
/** Command registration for cross-session insights. Retargets to the unified Insight panel in the viewer. */
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
exports.insightsCommands = insightsCommands;
const vscode = __importStar(require("vscode"));
const insight_tab_panel_1 = require("./ui/viewer-panels/insight-tab-panel");
/** Register cross-session insights commands. Opens the viewer's Insight panel (no separate WebviewPanel). */
function insightsCommands(deps) {
    return [
        vscode.commands.registerCommand('saropaLogCapture.showInsights', () => {
            deps.viewerProvider.postMessage({ type: 'openInsight', tab: 'recurring' });
        }),
        vscode.commands.registerCommand('saropaLogCapture.openInsightsInTab', () => {
            (0, insight_tab_panel_1.openInsightTab)({
                getCurrentFileUri: () => deps.viewerProvider.getCurrentFileUri(),
                context: deps.context,
                extensionUri: deps.context.extensionUri,
                version: '',
            });
        }),
        vscode.commands.registerCommand('saropaLogCapture.refreshRecurringErrors', () => {
            deps.viewerProvider.postMessage({ type: 'insightRefreshRecurring' });
        }),
    ];
}
//# sourceMappingURL=commands-insights.js.map
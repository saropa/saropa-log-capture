"use strict";
/**
 * Extension entry point for Saropa Log Capture.
 *
 * Activates the sidebar log viewer, session history, capture pipeline, integrations,
 * and all commands. Registers webview providers, URI handler, and config listeners.
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const extension_logger_1 = require("./modules/misc/extension-logger");
const project_indexer_1 = require("./modules/project-indexer/project-indexer");
const extension_activation_1 = require("./extension-activation");
const session_comparison_1 = require("./ui/session/session-comparison");
const analysis_panel_1 = require("./ui/analysis/analysis-panel");
const insights_panel_1 = require("./ui/insights/insights-panel");
const insight_tab_panel_1 = require("./ui/viewer-panels/insight-tab-panel");
const bug_report_panel_1 = require("./ui/panels/bug-report-panel");
const timeline_panel_1 = require("./ui/panels/timeline-panel");
const signal_report_panel_1 = require("./ui/signals/signal-report-panel");
/** Refs returned by runActivation; used in deactivate to stop sessions, dispose API, indexer and pop-out. */
let activationRefs = null;
function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('Saropa Log Capture');
    (0, extension_logger_1.setExtensionLogger)(outputChannel);
    activationRefs = (0, extension_activation_1.runActivation)(context, outputChannel);
    return activationRefs.api;
}
function deactivate() {
    if (activationRefs) {
        // Dispose API listeners before stopping sessions (removes event bridges cleanly).
        activationRefs.disposeApi();
        // Stop all log sessions first, then dispose indexer and pop-out (order matters for cleanup).
        activationRefs.sessionManager?.stopAll();
        activationRefs.projectIndexer?.dispose();
        activationRefs.projectIndexer = null;
        (0, project_indexer_1.setGlobalProjectIndexer)(null);
        activationRefs.popOutPanel?.dispose();
        activationRefs = null;
    }
    // Dispose editor panels that are not tied to activationRefs.
    (0, session_comparison_1.disposeComparisonPanel)();
    (0, analysis_panel_1.disposeAnalysisPanel)();
    (0, insights_panel_1.disposeInsightsPanel)();
    (0, insight_tab_panel_1.disposeInsightTabPanel)();
    (0, bug_report_panel_1.disposeBugReportPanel)();
    (0, timeline_panel_1.disposeTimelinePanel)();
    (0, signal_report_panel_1.disposeSignalReportPanel)();
}
//# sourceMappingURL=extension.js.map
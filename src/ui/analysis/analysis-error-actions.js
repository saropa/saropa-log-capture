"use strict";
/**
 * Extension-side handlers for error action bar messages in the analysis panel.
 *
 * Routes user actions (triage toggle, export, bug report, AI explain)
 * to existing infrastructure.
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
exports.handleTriageToggle = handleTriageToggle;
exports.handleCopyContext = handleCopyContext;
exports.handleBugReport = handleBugReport;
exports.handleExportAction = handleExportAction;
exports.handleAiExplain = handleAiExplain;
const vscode = __importStar(require("vscode"));
const error_status_store_1 = require("../../modules/misc/error-status-store");
/** Handle triage status toggle from the analysis panel. */
async function handleTriageToggle(hash, status) {
    const validStatuses = ['open', 'closed', 'muted'];
    const s = validStatuses.includes(status) ? status : 'open';
    await (0, error_status_store_1.setErrorStatus)(hash, s);
}
/** Copy error context to clipboard. */
async function handleCopyContext(errorText, hash) {
    const context = [
        `Error: ${errorText}`,
        `Fingerprint: #${hash}`,
        `Date: ${new Date().toISOString()}`,
    ].join('\n');
    await vscode.env.clipboard.writeText(context);
    vscode.window.showInformationMessage('Error context copied to clipboard');
}
/** Trigger bug report generation via existing command. */
async function handleBugReport(errorText, lineIndex, fileUri, extensionContext) {
    if (!fileUri) {
        vscode.window.showWarningMessage('No log file available for bug report');
        return;
    }
    const { showBugReport } = await import('../panels/bug-report-panel.js');
    await showBugReport(errorText, lineIndex, fileUri, extensionContext);
}
/** Trigger export via existing commands. */
function handleExportAction(format) {
    const commandMap = {
        slc: 'saropaLogCapture.exportSlc',
        json: 'saropaLogCapture.exportJson',
        csv: 'saropaLogCapture.exportCsv',
    };
    const cmd = commandMap[format];
    if (cmd) {
        vscode.commands.executeCommand(cmd).then(undefined, () => { });
    }
}
/** Trigger AI explanation via existing command. */
function handleAiExplain(errorText) {
    vscode.commands.executeCommand('saropaLogCapture.explainError', errorText).then(undefined, () => {
        vscode.window.showWarningMessage('AI explanation is not available');
    });
}
//# sourceMappingURL=analysis-error-actions.js.map
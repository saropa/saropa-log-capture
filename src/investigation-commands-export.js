"use strict";
/**
 * Investigation export command: export active investigation to .slc file.
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
exports.registerExportInvestigationCommand = registerExportInvestigationCommand;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const slc_bundle_1 = require("./modules/export/slc-bundle");
function registerExportInvestigationCommand(investigationStore) {
    return vscode.commands.registerCommand('saropaLogCapture.exportInvestigation', async () => {
        const investigation = await investigationStore.getActiveInvestigation();
        if (!investigation) {
            vscode.window.showWarningMessage((0, l10n_1.t)('msg.noActiveInvestigation'));
            return;
        }
        if (investigation.sources.length === 0) {
            vscode.window.showWarningMessage((0, l10n_1.t)('msg.noSourcesInInvestigation'));
            return;
        }
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            vscode.window.showWarningMessage((0, l10n_1.t)('msg.slcImportNoWorkspace'));
            return;
        }
        try {
            const outUri = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.exportInvestigation') }, () => (0, slc_bundle_1.exportInvestigationToSlc)(investigation, folder.uri));
            if (outUri) {
                const action = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''), (0, l10n_1.t)('action.open'));
                if (action === (0, l10n_1.t)('action.open')) {
                    await vscode.window.showTextDocument(outUri);
                }
            }
        }
        catch (e) {
            vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        }
    });
}
//# sourceMappingURL=investigation-commands-export.js.map
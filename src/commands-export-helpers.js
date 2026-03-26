"use strict";
/**
 * Export command helpers: HTML/file export wrappers, Build/CI token commands, SLC import.
 * Extracted to keep commands-export.ts under the line limit.
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
exports.buildCiTokenCmd = buildCiTokenCmd;
exports.htmlExportCmd = htmlExportCmd;
exports.fileExportCmd = fileExportCmd;
exports.importInvestigationFromSlc = importInvestigationFromSlc;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
function buildCiTokenCmd(context, opts) {
    const { commandId, label, setFn, clearFn } = opts;
    return vscode.commands.registerCommand(`saropaLogCapture.${commandId}`, async () => {
        if (setFn) {
            const token = await vscode.window.showInputBox({
                prompt: `Build/CI: enter ${label} token`,
                password: true,
                placeHolder: 'Token or PAT',
            });
            if (token === undefined) {
                return;
            }
            const trimmed = token.trim();
            if (!trimmed) {
                void vscode.window.showWarningMessage('Empty value not stored.');
                return;
            }
            await setFn(context, trimmed);
            void vscode.window.showInformationMessage(`Build/CI: ${label} token stored.`);
        }
        else if (clearFn) {
            await clearFn(context);
            void vscode.window.showInformationMessage(`Build/CI: ${label} token cleared.`);
        }
    });
}
function htmlExportCmd(name, fn) {
    return vscode.commands.registerCommand(`saropaLogCapture.${name}`, async (item) => {
        if (!item?.uri) {
            return;
        }
        await vscode.env.openExternal(await fn(item.uri));
    });
}
function fileExportCmd(name, fn) {
    return vscode.commands.registerCommand(`saropaLogCapture.${name}`, async (item) => {
        if (!item?.uri) {
            return;
        }
        const outUri = await fn(item.uri);
        const action = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''), (0, l10n_1.t)('action.open'));
        if (action === (0, l10n_1.t)('action.open')) {
            await vscode.window.showTextDocument(outUri);
        }
    });
}
/** Import an investigation from an SLC bundle result into the store. */
async function importInvestigationFromSlc(inv, store, historyProvider) {
    const created = await store.createInvestigation({ name: inv.name, notes: inv.notes });
    try {
        for (const src of inv.sources) {
            await store.addSource(created.id, { type: src.type, relativePath: src.relativePath, label: src.label });
        }
        await store.setActiveInvestigationId(created.id);
        historyProvider.refresh();
        await vscode.commands.executeCommand('saropaLogCapture.openInvestigation');
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.investigationImported', inv.name));
    }
    catch (e) {
        await store.deleteInvestigation(created.id).catch(() => { });
        vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    }
}
//# sourceMappingURL=commands-export-helpers.js.map
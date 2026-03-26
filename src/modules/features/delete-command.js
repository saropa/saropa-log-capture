"use strict";
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
exports.handleDeleteCommand = handleDeleteCommand;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const config_1 = require("../config/config");
/** Show a quick pick to delete session files from the reports directory. */
async function handleDeleteCommand() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return;
    }
    const logDirUri = (0, config_1.getLogDirectoryUri)(folder);
    const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
    const logFiles = (await (0, config_1.readTrackedFiles)(logDirUri, fileTypes, includeSubfolders))
        .sort()
        .reverse();
    if (logFiles.length === 0) {
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.noSessionFiles'));
        return;
    }
    const selected = await vscode.window.showQuickPick(logFiles, {
        placeHolder: (0, l10n_1.t)('prompt.selectSessionsToDelete'),
        canPickMany: true,
    });
    if (selected && selected.length > 0) {
        for (const file of selected) {
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(logDirUri, file));
        }
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.deletedSessionFiles', String(selected.length)));
    }
}
//# sourceMappingURL=delete-command.js.map
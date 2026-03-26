"use strict";
/** Trash management command registrations. */
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
exports.trashCommands = trashCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const config_1 = require("./modules/config/config");
const project_indexer_1 = require("./modules/project-indexer/project-indexer");
/** Register trash-related commands. */
function trashCommands(historyProvider, getCurrentFileUri) {
    const metaStore = historyProvider.getMetaStore();
    return [
        vscode.commands.registerCommand('saropaLogCapture.trashSession', async (item) => {
            const uri = item?.uri ?? getCurrentFileUri();
            if (!uri) {
                return;
            }
            await metaStore.setTrashed(uri, true);
            if ((0, config_1.getConfig)().projectIndex.enabled) {
                const idx = (0, project_indexer_1.getGlobalProjectIndexer)();
                if (idx) {
                    idx.removeEntry('reports', vscode.workspace.asRelativePath(uri).replace(/\\/g, '/')).catch(() => { });
                }
            }
            historyProvider.invalidateMeta(uri);
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.restoreSession', async (item) => {
            const uri = item?.uri ?? getCurrentFileUri();
            if (!uri) {
                return;
            }
            await metaStore.setTrashed(uri, false);
            if ((0, config_1.getConfig)().projectIndex.enabled) {
                const idx = (0, project_indexer_1.getGlobalProjectIndexer)();
                if (idx) {
                    metaStore.loadMetadata(uri).then((meta) => idx.upsertReportEntryFromMeta(uri, meta)).catch(() => { });
                }
            }
            historyProvider.invalidateMeta(uri);
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.emptyTrash', async () => {
            const count = await emptyTrash(metaStore);
            if (count === 0) {
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.trashEmpty'));
            }
            if (count > 0) {
                historyProvider.refresh();
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.toggleTrash', () => {
            const show = !historyProvider.getShowTrash();
            historyProvider.setShowTrash(show);
        }),
    ];
}
async function emptyTrash(metaStore) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return 0;
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
    const files = await (0, config_1.readTrackedFiles)(logDir, fileTypes, includeSubfolders);
    const trashed = [];
    for (const rel of files) {
        const uri = vscode.Uri.joinPath(logDir, rel);
        const meta = await metaStore.loadMetadata(uri);
        if (meta.trashed) {
            trashed.push(uri);
        }
    }
    if (trashed.length === 0) {
        return 0;
    }
    const answer = await vscode.window.showWarningMessage((0, l10n_1.t)('msg.deleteTrashConfirm', String(trashed.length)), { modal: true }, (0, l10n_1.t)('action.delete'));
    if (answer !== (0, l10n_1.t)('action.delete')) {
        return -1;
    }
    let deleted = 0;
    for (const uri of trashed) {
        try {
            await vscode.workspace.fs.delete(uri);
            await metaStore.deleteMetadata(uri);
            deleted++;
        }
        catch { /* file may be locked */ }
    }
    vscode.window.showInformationMessage((0, l10n_1.t)('msg.permanentlyDeletedFromTrash', String(deleted)));
    return deleted;
}
//# sourceMappingURL=commands-trash.js.map
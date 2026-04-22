"use strict";
/**
 * Session action dispatch for viewer targets.
 * Extracted from viewer-handler-wiring.ts for file-length compliance.
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
exports.handleSessionAction = handleSessionAction;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const deep_links_1 = require("../../modules/features/deep-links");
/**
 * Dispatch a session action (open, trash, export, etc.) from the webview session panel.
 * Supports multi-select: when multiple sessions are selected, actions run per session
 * (sequentially for open/export/tag/trash to avoid overlapping dialogs).
 */
async function handleSessionAction(action, uriStrings, filenames, ctx) {
    const n = Math.max(uriStrings.length, filenames.length);
    const items = Array.from({ length: n }, (_, i) => {
        const uri = uriStrings[i] ? vscode.Uri.parse(uriStrings[i]) : undefined;
        const filename = filenames[i] ?? '';
        return uri ? { uri, filename } : undefined;
    }).filter((x) => x !== undefined);
    const mutating = ['trash', 'restore', 'emptyTrash', 'deletePermanently', 'rename', 'tag'];
    switch (action) {
        case 'open':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.openSession', item);
            }
            break;
        case 'replay':
            if (items.length > 0 && ctx.openSessionForReplay) {
                await ctx.openSessionForReplay(items[0].uri);
            }
            else if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.openSession', items[0]);
            }
            break;
        case 'trash':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.trashSession', item);
            }
            break;
        case 'restore':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.restoreSession', item);
            }
            break;
        case 'emptyTrash':
            await vscode.commands.executeCommand('saropaLogCapture.emptyTrash');
            break;
        case 'deletePermanently':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.deleteSession', item);
            }
            break;
        case 'rename':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.renameSession', item);
            }
            break;
        case 'tag':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.tagSession', item);
            }
            break;
        case 'exportHtml':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportHtml', item);
            }
            break;
        case 'exportCsv':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportCsv', item);
            }
            break;
        case 'exportJson':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportJson', item);
            }
            break;
        case 'exportJsonl':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportJsonl', item);
            }
            break;
        case 'exportSlc':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportSlc', item);
            }
            break;
        case 'exportToLoki':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportToLoki', item);
            }
            break;
        case 'copyDeepLink': {
            const lines = items.map((it) => (0, deep_links_1.generateDeepLink)(it.filename)).filter(Boolean);
            if (lines.length > 0) {
                await vscode.env.clipboard.writeText(lines.join('\n'));
                vscode.window.showInformationMessage(lines.length === 1 ? (0, l10n_1.t)('msg.deepLinkCopied', '') : (0, l10n_1.t)('msg.deepLinksCopied', String(lines.length)));
            }
            break;
        }
        case 'copyFilePath': {
            const paths = items.map((it) => it.uri.fsPath);
            if (paths.length > 0) {
                await vscode.env.clipboard.writeText(paths.join('\n'));
                vscode.window.showInformationMessage(paths.length === 1 ? (0, l10n_1.t)('msg.filePathCopied') : (0, l10n_1.t)('msg.filePathsCopied', String(paths.length)));
            }
            break;
        }
        // Reveal each selected log in the OS file explorer (Explorer/Finder/containing folder).
        // Runs the built-in VS Code command per item; failures are swallowed because the native
        // OS call may not be available in restricted/remote contexts and a thrown error would
        // be surfaced as a modal that isn't actionable.
        case 'revealInOS': {
            for (const item of items) {
                await vscode.commands.executeCommand('revealFileInOS', item.uri).then(() => { }, () => { });
            }
            break;
        }
        case 'addToCollection':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.addToCollection', { uri: item.uri });
            }
            break;
        // Session groups: Group, Ungroup, and Open-as-Merged-Group take the full selection in a
        // single invocation (not one command per item) because they operate on the group as a
        // whole. Running them per-item would produce N singletons for Group, and N separate
        // viewer loads for Open, defeating the point.
        case 'group':
            if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.groupSelectedSessions', items[0], items);
            }
            break;
        case 'ungroup':
            if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.ungroupSession', items[0], items);
            }
            break;
        case 'openGroup':
            if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.openSessionGroup', items[0], items);
            }
            break;
        case 'addGroupToCollection':
            if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.addGroupToCollection', items[0], items);
            }
            break;
    }
    if (mutating.includes(action) || action === 'group' || action === 'ungroup') {
        await ctx.refreshList();
    }
}
//# sourceMappingURL=viewer-handler-sessions.js.map
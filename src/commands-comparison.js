"use strict";
/** Session comparison command registrations. */
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
exports.comparisonCommands = comparisonCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const config_1 = require("./modules/config/config");
const session_comparison_1 = require("./ui/session/session-comparison");
/** URI of session marked for comparison (first selection). */
let comparisonMarkUri;
/** Register session comparison commands. */
function comparisonCommands(extensionUri, broadcaster) {
    return [
        vscode.commands.registerCommand('saropaLogCapture.markForComparison', (item) => {
            if (!item?.uri) {
                return;
            }
            comparisonMarkUri = item.uri;
            vscode.window.showInformationMessage((0, l10n_1.t)('msg.markedForComparison', item.filename));
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareWithMarked', async (item) => {
            if (!item?.uri) {
                return;
            }
            if (!comparisonMarkUri) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.noSessionMarked'));
                return;
            }
            if (comparisonMarkUri.fsPath === item.uri.fsPath) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.cannotCompareWithSelf'));
                return;
            }
            const panel = (0, session_comparison_1.getComparisonPanel)(extensionUri);
            await panel.compare(comparisonMarkUri, item.uri);
            comparisonMarkUri = undefined;
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareSessions', async () => {
            const sessions = await pickTwoSessions();
            if (sessions) {
                const panel = (0, session_comparison_1.getComparisonPanel)(extensionUri, broadcaster);
                await panel.compare(sessions[0], sessions[1]);
            }
        }),
    ];
}
/** Show Quick Pick to select two sessions for comparison. */
async function pickTwoSessions() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return undefined;
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
    const tracked = await (0, config_1.readTrackedFiles)(logDir, fileTypes, includeSubfolders);
    const files = tracked
        .map(rel => ({ label: rel, uri: vscode.Uri.joinPath(logDir, rel) }))
        .sort((a, b) => b.label.localeCompare(a.label));
    if (files.length < 2) {
        vscode.window.showWarningMessage((0, l10n_1.t)('msg.needTwoSessions'));
        return undefined;
    }
    const first = await vscode.window.showQuickPick(files, {
        placeHolder: (0, l10n_1.t)('prompt.selectFirstSession'),
        title: (0, l10n_1.t)('title.compareSessions1'),
    });
    if (!first) {
        return undefined;
    }
    const second = await vscode.window.showQuickPick(files.filter(f => f.uri.fsPath !== first.uri.fsPath), {
        placeHolder: (0, l10n_1.t)('prompt.selectSecondSession'),
        title: (0, l10n_1.t)('title.compareSessions2'),
    });
    return second ? [first.uri, second.uri] : undefined;
}
//# sourceMappingURL=commands-comparison.js.map
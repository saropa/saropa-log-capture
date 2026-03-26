"use strict";
/**
 * Commands for the Application / file logs (externalLogs) integration:
 * Add external log path, Open external logs for this session.
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
exports.externalLogsCommands = externalLogsCommands;
const vscode = __importStar(require("vscode"));
const context_loader_1 = require("./modules/context/context-loader");
const CONFIG_SECTION = 'saropaLogCapture';
const EXTERNAL_LOGS_PATHS_KEY = 'integrations.externalLogs.paths';
function externalLogsCommands(deps) {
    const { viewerProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.addExternalLogPath', async () => {
            const path = await vscode.window.showInputBox({
                prompt: 'Path to external log file (relative to workspace or absolute)',
                placeHolder: 'e.g. logs/app.log or logs/nginx/error.log',
            });
            if (path === undefined || path.trim() === '') {
                return;
            }
            const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
            const raw = cfg.get(EXTERNAL_LOGS_PATHS_KEY);
            const current = Array.isArray(raw) ? raw : [];
            if (current.includes(path.trim())) {
                void vscode.window.showInformationMessage('That path is already in the list.');
                return;
            }
            await cfg.update(EXTERNAL_LOGS_PATHS_KEY, [...current, path.trim()], vscode.ConfigurationTarget.Workspace);
            void vscode.window.showInformationMessage('Added external log path. Enable Application / file logs in Configure integrations so it is tailed during debug sessions.');
        }),
        vscode.commands.registerCommand('saropaLogCapture.openExternalLogsForSession', async () => {
            const logUri = viewerProvider.getCurrentFileUri();
            if (!logUri) {
                void vscode.window.showWarningMessage('No log file is currently open in the viewer.');
                return;
            }
            const sidecars = await (0, context_loader_1.findSidecarUris)(logUri);
            const externalSidecars = sidecars.filter((u) => u.fsPath.endsWith('.log') && !u.fsPath.endsWith('.terminal.log'));
            if (externalSidecars.length === 0) {
                void vscode.window.showInformationMessage('This session has no external log sidecars.');
                return;
            }
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Opening external log sidecars',
                cancellable: false,
            }, async (progress) => {
                const total = externalSidecars.length;
                for (let i = 0; i < total; i += 1) {
                    const name = externalSidecars[i].fsPath.split(/[/\\]/).pop() ?? '';
                    progress.report({ message: `${i + 1}/${total}: ${name}` });
                    await vscode.window.showTextDocument(externalSidecars[i], { preview: false });
                }
            });
        }),
    ];
}
//# sourceMappingURL=commands-external-logs.js.map
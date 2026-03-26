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
exports.checkGitignore = checkGitignore;
exports.checkGitignoreSaropa = checkGitignoreSaropa;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const config_1 = require("./config");
const STATE_KEY = 'gitignoreChecked';
const STATE_KEY_SAROPA = 'gitignoreCheckedSaropa';
/**
 * Check if the log directory is covered by .gitignore.
 * If not, offer to add it. Only runs once per workspace.
 */
async function checkGitignore(context, workspaceFolder, logDirectory) {
    if (context.workspaceState.get(STATE_KEY)) {
        return;
    }
    const config = (0, config_1.getConfig)();
    if (!config.gitignoreCheck) {
        await context.workspaceState.update(STATE_KEY, true);
        return;
    }
    const gitignoreUri = vscode.Uri.joinPath(workspaceFolder.uri, '.gitignore');
    let content;
    try {
        const raw = await vscode.workspace.fs.readFile(gitignoreUri);
        content = Buffer.from(raw).toString('utf-8');
    }
    catch {
        // No .gitignore — nothing to check.
        await context.workspaceState.update(STATE_KEY, true);
        return;
    }
    const normalizedDir = logDirectory.replace(/^\//, '').replace(/\/$/, '');
    const lines = content.split(/\r?\n/).map(l => l.trim());
    const isCovered = lines.some(line => {
        if (line.startsWith('#') || line.length === 0) {
            return false;
        }
        const normalized = line.replace(/^\//, '').replace(/\/$/, '');
        return normalized === normalizedDir;
    });
    if (isCovered) {
        await context.workspaceState.update(STATE_KEY, true);
        return;
    }
    const action = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.gitignoreLogPrompt', logDirectory), (0, l10n_1.t)('action.addToGitignore'), (0, l10n_1.t)('action.dontAskAgain'));
    if (action === (0, l10n_1.t)('action.addToGitignore')) {
        try {
            const suffix = content.endsWith('\n') ? '' : '\n';
            const entry = `${suffix}\n# Saropa Log Capture\n${logDirectory}/\n`;
            const updated = content + entry;
            await vscode.workspace.fs.writeFile(gitignoreUri, Buffer.from(updated, 'utf-8'));
        }
        catch (err) {
            vscode.window.showErrorMessage((0, l10n_1.t)('msg.failedUpdateGitignore', String(err)));
        }
    }
    await context.workspaceState.update(STATE_KEY, true);
}
/** Offer to add .saropa/ to .gitignore if not already present. Only runs once per workspace. */
async function checkGitignoreSaropa(context, workspaceFolder) {
    if (context.workspaceState.get(STATE_KEY_SAROPA)) {
        return;
    }
    const config = (0, config_1.getConfig)();
    if (!config.gitignoreCheck) {
        await context.workspaceState.update(STATE_KEY_SAROPA, true);
        return;
    }
    const gitignoreUri = vscode.Uri.joinPath(workspaceFolder.uri, '.gitignore');
    let content;
    try {
        const raw = await vscode.workspace.fs.readFile(gitignoreUri);
        content = Buffer.from(raw).toString('utf-8');
    }
    catch {
        await context.workspaceState.update(STATE_KEY_SAROPA, true);
        return;
    }
    const lines = content.split(/\r?\n/).map(l => l.trim());
    const isCovered = lines.some(line => {
        if (line.startsWith('#') || line.length === 0) {
            return false;
        }
        const normalized = line.replace(/^\//, '').replace(/\/$/, '');
        return normalized === '.saropa' || normalized === '.saropa/';
    });
    if (isCovered) {
        await context.workspaceState.update(STATE_KEY_SAROPA, true);
        return;
    }
    const action = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.gitignoreSaropaPrompt'), (0, l10n_1.t)('action.addToGitignore'), (0, l10n_1.t)('action.dontAskAgain'));
    if (action === (0, l10n_1.t)('action.addToGitignore')) {
        try {
            const suffix = content.endsWith('\n') ? '' : '\n';
            const entry = `${suffix}\n# Saropa Log Capture (index & cache)\n.saropa/\n`;
            await vscode.workspace.fs.writeFile(gitignoreUri, Buffer.from(content + entry, 'utf-8'));
        }
        catch (err) {
            vscode.window.showErrorMessage((0, l10n_1.t)('msg.failedUpdateGitignore', String(err)));
        }
    }
    await context.workspaceState.update(STATE_KEY_SAROPA, true);
}
//# sourceMappingURL=gitignore-checker.js.map
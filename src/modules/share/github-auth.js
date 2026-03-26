"use strict";
/**
 * GitHub token for Gist sharing. Uses VS Code Secret Storage and built-in GitHub auth.
 * Token is cleared when the user signs out of GitHub (see extension-activation).
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
exports.getGitHubToken = getGitHubToken;
exports.getGitHubTokenKey = getGitHubTokenKey;
exports.clearGitHubToken = clearGitHubToken;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const GITHUB_TOKEN_KEY = 'saropa.githubToken';
async function getGitHubToken(context) {
    const stored = await context.secrets.get(GITHUB_TOKEN_KEY);
    if (stored) {
        return stored;
    }
    const action = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.githubAuthRequired'), (0, l10n_1.t)('action.authenticate'), (0, l10n_1.t)('action.cancel'));
    if (action !== (0, l10n_1.t)('action.authenticate')) {
        throw new Error((0, l10n_1.t)('msg.githubAuthRequired'));
    }
    const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: true });
    await context.secrets.store(GITHUB_TOKEN_KEY, session.accessToken);
    return session.accessToken;
}
function getGitHubTokenKey() {
    return GITHUB_TOKEN_KEY;
}
/**
 * Clear stored GitHub token (e.g. when user signs out). Call from onDidChangeSessions for 'github'.
 */
async function clearGitHubToken(context) {
    await context.secrets.delete(GITHUB_TOKEN_KEY);
}
//# sourceMappingURL=github-auth.js.map
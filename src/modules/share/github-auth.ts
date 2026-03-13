/**
 * GitHub token for Gist sharing. Uses VS Code Secret Storage and built-in GitHub auth.
 * Token is cleared when the user signs out of GitHub (see extension-activation).
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';

const GITHUB_TOKEN_KEY = 'saropa.githubToken';

export async function getGitHubToken(context: vscode.ExtensionContext): Promise<string> {
    const stored = await context.secrets.get(GITHUB_TOKEN_KEY);
    if (stored) {
        return stored;
    }

    const action = await vscode.window.showInformationMessage(
        t('msg.githubAuthRequired'),
        t('action.authenticate'),
        t('action.cancel'),
    );

    if (action !== t('action.authenticate')) {
        throw new Error(t('msg.githubAuthRequired'));
    }

    const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: true });
    await context.secrets.store(GITHUB_TOKEN_KEY, session.accessToken);
    return session.accessToken;
}

export function getGitHubTokenKey(): string {
    return GITHUB_TOKEN_KEY;
}

/**
 * Clear stored GitHub token (e.g. when user signs out). Call from onDidChangeSessions for 'github'.
 */
export async function clearGitHubToken(context: vscode.ExtensionContext): Promise<void> {
    await context.secrets.delete(GITHUB_TOKEN_KEY);
}

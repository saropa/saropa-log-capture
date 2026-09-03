/**
 * GitHub token for Gist sharing. Uses VS Code Secret Storage and built-in GitHub auth.
 * Token is cleared when the user signs out of GitHub (see extension-activation).
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { logExtensionError } from '../misc/extension-logger';

const GITHUB_TOKEN_KEY = 'saropa.githubToken';
/** Log/output-channel scope tag for GitHub auth failures. */
const LOG_SCOPE = 'github-auth';

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

/**
 * Prompt the user to re-authenticate after a GitHub token was cleared. Fire-and-forget:
 * the caller (share/import flow) has already failed and surfaced its own error, so a
 * failure here is non-critical — the user can still trigger auth manually via the next
 * share/import attempt, which calls getGitHubToken() and prompts again.
 */
function promptGitHubReauth(context: vscode.ExtensionContext): void {
    vscode.window
        .showWarningMessage(t('msg.githubTokenExpired'), t('action.authenticate'), t('action.cancel'))
        .then((action) => {
            if (action !== t('action.authenticate')) {
                return undefined;
            }
            // Reuses getGitHubToken's own prompt/session flow rather than duplicating it here.
            return getGitHubToken(context);
        })
        .then(undefined, (err: unknown) => {
            logExtensionError(LOG_SCOPE, err instanceof Error ? err : String(err));
        });
}

/**
 * Bug 044 / bug_041 item 4: a revoked/expired GitHub token was never cleared on a 401
 * response, so it stayed cached in Secret Storage and every subsequent share/import call
 * failed with the same opaque "Bad credentials" error until the user manually re-ran the
 * "Sign out of GitHub" command. Detecting 401 here, clearing the stale token, and offering
 * an immediate re-auth prompt closes that loop.
 *
 * Returns true if the response was a 401 that was handled (token cleared, re-auth offered),
 * so callers can decide whether to still surface their own generic error message.
 */
export async function handleGitHubApiUnauthorized(
    context: vscode.ExtensionContext,
    response: Response,
): Promise<boolean> {
    if (response.status !== 401) {
        return false;
    }
    await clearGitHubToken(context);
    promptGitHubReauth(context);
    return true;
}

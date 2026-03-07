import * as vscode from 'vscode';
import { t } from '../../l10n';
import { getConfig } from './config';

const STATE_KEY = 'gitignoreChecked';
const STATE_KEY_SAROPA = 'gitignoreCheckedSaropa';

/**
 * Check if the log directory is covered by .gitignore.
 * If not, offer to add it. Only runs once per workspace.
 */
export async function checkGitignore(
    context: vscode.ExtensionContext,
    workspaceFolder: vscode.WorkspaceFolder,
    logDirectory: string
): Promise<void> {
    if (context.workspaceState.get<boolean>(STATE_KEY)) {
        return;
    }

    const config = getConfig();
    if (!config.gitignoreCheck) {
        await context.workspaceState.update(STATE_KEY, true);
        return;
    }

    const gitignoreUri = vscode.Uri.joinPath(workspaceFolder.uri, '.gitignore');

    let content: string;
    try {
        const raw = await vscode.workspace.fs.readFile(gitignoreUri);
        content = Buffer.from(raw).toString('utf-8');
    } catch {
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

    const action = await vscode.window.showInformationMessage(
        t('msg.gitignoreLogPrompt', logDirectory),
        t('action.addToGitignore'),
        t('action.dontAskAgain'),
    );

    if (action === t('action.addToGitignore')) {
        try {
            const suffix = content.endsWith('\n') ? '' : '\n';
            const entry = `${suffix}\n# Saropa Log Capture\n${logDirectory}/\n`;
            const updated = content + entry;
            await vscode.workspace.fs.writeFile(
                gitignoreUri,
                Buffer.from(updated, 'utf-8')
            );
        } catch (err) {
            vscode.window.showErrorMessage(
                t('msg.failedUpdateGitignore', String(err)),
            );
        }
    }

    await context.workspaceState.update(STATE_KEY, true);
}

/** Offer to add .saropa/ to .gitignore if not already present. Only runs once per workspace. */
export async function checkGitignoreSaropa(
    context: vscode.ExtensionContext,
    workspaceFolder: vscode.WorkspaceFolder,
): Promise<void> {
    if (context.workspaceState.get<boolean>(STATE_KEY_SAROPA)) { return; }
    const config = getConfig();
    if (!config.gitignoreCheck) {
        await context.workspaceState.update(STATE_KEY_SAROPA, true);
        return;
    }
    const gitignoreUri = vscode.Uri.joinPath(workspaceFolder.uri, '.gitignore');
    let content: string;
    try {
        const raw = await vscode.workspace.fs.readFile(gitignoreUri);
        content = Buffer.from(raw).toString('utf-8');
    } catch {
        await context.workspaceState.update(STATE_KEY_SAROPA, true);
        return;
    }
    const lines = content.split(/\r?\n/).map(l => l.trim());
    const isCovered = lines.some(line => {
        if (line.startsWith('#') || line.length === 0) { return false; }
        const normalized = line.replace(/^\//, '').replace(/\/$/, '');
        return normalized === '.saropa' || normalized === '.saropa/';
    });
    if (isCovered) {
        await context.workspaceState.update(STATE_KEY_SAROPA, true);
        return;
    }
    const action = await vscode.window.showInformationMessage(
        t('msg.gitignoreSaropaPrompt'),
        t('action.addToGitignore'),
        t('action.dontAskAgain'),
    );
    if (action === t('action.addToGitignore')) {
        try {
            const suffix = content.endsWith('\n') ? '' : '\n';
            const entry = `${suffix}\n# Saropa Log Capture (index & cache)\n.saropa/\n`;
            await vscode.workspace.fs.writeFile(gitignoreUri, Buffer.from(content + entry, 'utf-8'));
        } catch (err) {
            vscode.window.showErrorMessage(t('msg.failedUpdateGitignore', String(err)));
        }
    }
    await context.workspaceState.update(STATE_KEY_SAROPA, true);
}

import * as vscode from 'vscode';
import { getConfig } from './config';

const STATE_KEY = 'gitignoreChecked';

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
        `Saropa Log Capture saves logs to '${logDirectory}/'. Add it to .gitignore to prevent accidental commits?`,
        'Add to .gitignore',
        "Don't Ask Again"
    );

    if (action === 'Add to .gitignore') {
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
                `Failed to update .gitignore: ${err}`
            );
        }
    }

    await context.workspaceState.update(STATE_KEY, true);
}

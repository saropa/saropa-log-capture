/**
 * Deep links module for Saropa Log Capture.
 * Enables vscode:// URIs to open specific log sessions and lines.
 * Format: vscode://saropa.saropa-log-capture/open?session=<filename>&line=<n>
 */

import * as vscode from 'vscode';
import { getLogDirectoryUri } from './config';

/** Deep link parameters extracted from a URI. */
export interface DeepLinkParams {
    readonly session: string;
    readonly line?: number;
}

/**
 * Parse a deep link URI into parameters.
 * Expected format: /open?session=<filename>&line=<n>
 */
export function parseDeepLinkUri(uri: vscode.Uri): DeepLinkParams | undefined {
    if (uri.path !== '/open') {
        return undefined;
    }

    const params = new URLSearchParams(uri.query);
    const session = params.get('session');
    if (!session) {
        return undefined;
    }

    const lineStr = params.get('line');
    const line = lineStr ? parseInt(lineStr, 10) : undefined;

    return {
        session,
        line: line && !isNaN(line) ? line : undefined,
    };
}

/**
 * Generate a deep link URI for a session and optional line number.
 * @param sessionFilename The log filename (e.g., "20260128_14-32_myapp.log")
 * @param line Optional 1-based line number
 * @returns The deep link URI string
 */
export function generateDeepLink(sessionFilename: string, line?: number): string {
    const baseUri = 'vscode://saropa.saropa-log-capture/open';
    const params = new URLSearchParams();
    params.set('session', sessionFilename);
    if (line !== undefined && line > 0) {
        params.set('line', String(line));
    }
    return `${baseUri}?${params.toString()}`;
}

/**
 * Handle a deep link URI by opening the session and navigating to the line.
 * @returns true if the link was handled successfully
 */
export async function handleDeepLink(uri: vscode.Uri): Promise<boolean> {
    const params = parseDeepLinkUri(uri);
    if (!params) {
        vscode.window.showErrorMessage('Invalid deep link format');
        return false;
    }

    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace open. Please open a workspace first.');
        return false;
    }

    const logDir = getLogDirectoryUri(folder);
    const logUri = vscode.Uri.joinPath(logDir, params.session);

    // Check if file exists
    try {
        await vscode.workspace.fs.stat(logUri);
    } catch {
        vscode.window.showErrorMessage(`Log file not found: ${params.session}`);
        return false;
    }

    // Open the file
    const doc = await vscode.workspace.openTextDocument(logUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Navigate to line if specified
    if (params.line !== undefined && params.line > 0) {
        const lineNum = Math.min(params.line - 1, doc.lineCount - 1);
        const pos = new vscode.Position(lineNum, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }

    return true;
}

/**
 * Copy a deep link to the clipboard.
 * Shows an information message confirming the copy.
 */
export async function copyDeepLinkToClipboard(sessionFilename: string, line?: number): Promise<void> {
    const link = generateDeepLink(sessionFilename, line);
    await vscode.env.clipboard.writeText(link);
    const lineInfo = line ? ` (line ${line})` : '';
    vscode.window.showInformationMessage(`Deep link copied${lineInfo}`);
}

/**
 * Create a URI handler for the extension.
 * Register this with context.subscriptions.
 */
export function createUriHandler(): vscode.UriHandler {
    return {
        handleUri: async (uri: vscode.Uri) => {
            await handleDeepLink(uri);
        },
    };
}

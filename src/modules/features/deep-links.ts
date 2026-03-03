/**
 * Deep links module for Saropa Log Capture.
 *
 * Enables shareable vscode:// URIs that open specific log sessions and lines.
 * Use case: paste a link in Slack/email, teammate clicks it, VS Code opens
 * and navigates directly to that log entry.
 *
 * URI Format: vscode://saropa.saropa-log-capture/open?session=<filename>&line=<n>
 *
 * The extension ID "saropa.saropa-log-capture" is derived from publisher.name
 * in package.json. VS Code routes all vscode://saropa.saropa-log-capture/* URIs
 * to our registered UriHandler.
 */

import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../config/config';
import { logExtensionWarn } from '../misc/extension-logger';
import { MAX_SAFE_LINE, MAX_SESSION_FILENAME_LENGTH } from '../config/config-validation';

/**
 * Parameters extracted from a deep link URI.
 * Session is required (identifies the log file), line is optional.
 */
export interface DeepLinkParams {
    /** Log filename, e.g., "20260128_143205_myapp.log" */
    readonly session: string;
    /** 1-based line number to navigate to (optional) */
    readonly line?: number;
}

/**
 * Parse a deep link URI into structured parameters.
 *
 * Only accepts URIs with path "/open" - this allows future expansion
 * to other actions like "/search" or "/compare" without breaking
 * existing links.
 *
 * @param uri - The URI received from VS Code's URI handler
 * @returns Parsed parameters, or undefined if URI format is invalid
 *
 * @example
 * // Valid URI
 * parseDeepLinkUri(Uri.parse('vscode://saropa.saropa-log-capture/open?session=app.log&line=42'))
 * // Returns: { session: 'app.log', line: 42 }
 *
 * @example
 * // Missing session parameter
 * parseDeepLinkUri(Uri.parse('vscode://saropa.saropa-log-capture/open?line=42'))
 * // Returns: undefined
 */
/** Reject session names that could escape log directory (path traversal, absolute paths). */
function isValidSessionName(session: string): boolean {
    const trimmed = session.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_SESSION_FILENAME_LENGTH) {return false;}
    if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.startsWith('/')) {return false;}
    return true;
}

export function parseDeepLinkUri(uri: vscode.Uri): DeepLinkParams | undefined {
    if (!uri || typeof uri.path !== 'string') {
        return undefined;
    }
    // Only handle /open path - reject unknown paths for forward compatibility
    if (uri.path !== '/open') {
        return undefined;
    }

    // URLSearchParams handles URL decoding automatically
    const params = new URLSearchParams(uri.query ?? '');
    const session = params.get('session');

    // Session is required - can't open a log without knowing which file
    if (!session || !isValidSessionName(session)) {
        return undefined;
    }

    // Line is optional - if missing or invalid, we just open the file; clamp to safe range
    const lineStr = params.get('line');
    const parsed = lineStr ? parseInt(lineStr, 10) : NaN;
    const line =
        Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_SAFE_LINE ? parsed : undefined;

    return {
        session: session.trim(),
        line,
    };
}

/**
 * Generate a deep link URI for a log session.
 *
 * Uses URLSearchParams for proper URL encoding of special characters
 * in filenames (spaces, unicode, etc.).
 *
 * @param sessionFilename - The log filename (e.g., "20260128_143205_myapp.log")
 * @param line - Optional 1-based line number to include in the link
 * @returns Complete vscode:// URI string ready to share
 *
 * @example
 * generateDeepLink('myapp.log', 42)
 * // Returns: "vscode://saropa.saropa-log-capture/open?session=myapp.log&line=42"
 */
export function generateDeepLink(sessionFilename: string, line?: number): string {
    const baseUri = 'vscode://saropa.saropa-log-capture/open';
    const params = new URLSearchParams();

    const safeName = typeof sessionFilename === 'string' && sessionFilename.trim().length > 0
        ? sessionFilename.trim()
        : 'session.log';
    params.set('session', safeName);

    // Only include line parameter if it's a positive number within safe range
    if (line !== undefined && Number.isFinite(line) && line >= 1 && line <= MAX_SAFE_LINE) {
        params.set('line', String(Math.floor(line)));
    }

    return `${baseUri}?${params.toString()}`;
}

/**
 * Handle an incoming deep link by opening the referenced log file.
 *
 * This is called by VS Code when a vscode://saropa.saropa-log-capture/* URI
 * is opened (from browser, terminal, another app, etc.).
 *
 * @param uri - The deep link URI to handle
 * @returns true if the link was handled successfully, false otherwise
 */
export async function handleDeepLink(uri: vscode.Uri): Promise<boolean> {
    if (!uri) {
        logExtensionWarn('deepLink', 'No URI provided');
        return false;
    }
    const params = parseDeepLinkUri(uri);
    if (!params) {
        logExtensionWarn('deepLink', 'Invalid deep link URI');
        vscode.window.showErrorMessage(vscode.l10n.t('msg.invalidDeepLink'));
        return false;
    }

    // Deep links require a workspace - log files are stored relative to it
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        logExtensionWarn('deepLink', 'No workspace open');
        vscode.window.showErrorMessage(vscode.l10n.t('msg.noWorkspaceOpen'));
        return false;
    }

    // Construct full path: workspace/reports/<session>
    const logDir = getLogDirectoryUri(folder);
    const logUri = vscode.Uri.joinPath(logDir, params.session);

    // Verify file exists before trying to open - better error message
    try {
        await vscode.workspace.fs.stat(logUri);
    } catch {
        logExtensionWarn('deepLink', `Log file not found: ${params.session}`);
        vscode.window.showErrorMessage(vscode.l10n.t('msg.logFileNotFound', params.session));
        return false;
    }

    // Open the log file in the editor
    const doc = await vscode.workspace.openTextDocument(logUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Navigate to specific line if provided
    if (params.line !== undefined && params.line > 0) {
        // Convert 1-based line to 0-based, clamp to file bounds
        const lineNum = Math.min(params.line - 1, doc.lineCount - 1);
        const pos = new vscode.Position(lineNum, 0);

        // Set cursor and center the line in the viewport
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }

    return true;
}

/**
 * Copy a deep link to the clipboard for sharing.
 *
 * Shows a confirmation message so the user knows the copy succeeded.
 * This is the action behind the "Copy Deep Link" context menu command.
 *
 * @param sessionFilename - The log filename to create a link for
 * @param line - Optional line number to include in the link
 */
export async function copyDeepLinkToClipboard(sessionFilename: string, line?: number): Promise<void> {
    const link = generateDeepLink(sessionFilename, line);
    await vscode.env.clipboard.writeText(link);

    // Show confirmation with line info if applicable
    const lineInfo = line ? ` (line ${line})` : '';
    vscode.window.showInformationMessage(vscode.l10n.t('msg.deepLinkCopied', lineInfo));
}

/**
 * Create a URI handler instance for registration with VS Code.
 *
 * The returned handler is registered via `vscode.window.registerUriHandler()`
 * in extension.ts. VS Code then routes all vscode://saropa.saropa-log-capture/*
 * URIs to our handleUri method.
 *
 * @returns A UriHandler object to register with VS Code
 */
export function createUriHandler(): vscode.UriHandler {
    return {
        handleUri: async (uri: vscode.Uri) => {
            await handleDeepLink(uri);
        },
    };
}

/**
 * Host-side handlers for the "Log file" modal (viewer-log-file-modal.ts):
 * filename click and Ctrl+Shift+E surface these actions.
 *
 * Centralized here because the previous inline implementation only emitted
 * setStatusBarMessage (easy to miss) and was a silent no-op when
 * currentFileUri was unset — the user reported the modal closing with no
 * feedback. Toasts via showInformationMessage are visible; an explicit
 * warning toast covers the missing-URI case so it can no longer fail silently.
 */

import * as vscode from "vscode";
import * as path from "node:path";
import { t } from "../../l10n";
import type { ViewerMessageContext } from "./viewer-message-types";

/** Message types this module handles, exported for the catalog generator. */
export const LOG_FILE_ACTION_TYPES = [
    "openLogFileInEditor",
    "openLogFileBeside",
    "openCurrentFileFolder",
    "revealLogFileInExplorer",
    "openLogFileFolderInTerminal",
    "copyCurrentFilePath",
    "copyCurrentFileName",
    "copyCurrentFileRelativePath",
] as const;

function warnNoLogFile(): void {
    vscode.window.showWarningMessage(t("msg.noActiveLogFile"));
}

function writeClipboard(value: string, successKey: string): void {
    vscode.env.clipboard.writeText(value).then(
        () => { vscode.window.showInformationMessage(t(successKey, value)); },
        (err: unknown) => {
            const reason = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(t("msg.logCopyFailed", reason));
        },
    );
}

/** Compute a relative path; falls back to the absolute fsPath when outside any workspace. */
function relativeOrAbsolute(uri: vscode.Uri): string {
    return vscode.workspace.asRelativePath(uri, false);
}

/**
 * Dispatch a log-file modal message. Returns true when handled.
 *
 * Why a single dispatcher: keeps the missing-URI guard in one place so no
 * future action accidentally re-introduces the silent no-op behavior.
 */
export function handleLogFileAction(type: string, ctx: ViewerMessageContext): boolean {
    if (!(LOG_FILE_ACTION_TYPES as readonly string[]).includes(type)) { return false; }
    const uri = ctx.currentFileUri;
    if (!uri) { warnNoLogFile(); return true; }
    switch (type) {
        case "openLogFileInEditor":
            vscode.window.showTextDocument(uri, { preview: true }).then(undefined, () => {});
            return true;
        case "openLogFileBeside":
            vscode.window.showTextDocument(uri, { preview: true, viewColumn: vscode.ViewColumn.Beside })
                .then(undefined, () => {});
            return true;
        case "openCurrentFileFolder":
            vscode.commands.executeCommand("revealFileInOS", uri).then(undefined, () => {});
            return true;
        case "revealLogFileInExplorer":
            vscode.commands.executeCommand("revealInExplorer", uri).then(undefined, () => {});
            return true;
        case "openLogFileFolderInTerminal": {
            /* openInIntegratedTerminal accepts a folder URI and opens a terminal cwd'd there,
               which is what the user wants — not a terminal in the file itself. */
            const folder = vscode.Uri.joinPath(uri, "..");
            vscode.commands.executeCommand("openInIntegratedTerminal", folder).then(undefined, () => {});
            return true;
        }
        case "copyCurrentFilePath":
            writeClipboard(uri.fsPath, "msg.fileFullPathCopied");
            return true;
        case "copyCurrentFileName":
            writeClipboard(path.basename(uri.fsPath), "msg.fileNameCopied");
            return true;
        case "copyCurrentFileRelativePath":
            writeClipboard(relativeOrAbsolute(uri), "msg.fileRelativePathCopied");
            return true;
        default:
            return false;
    }
}

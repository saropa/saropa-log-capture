/**
 * Export the current session list as a JSON file under the project's reports
 * (log) directory. Wired by the "Export session list to JSON" action in the
 * Logs panel kebab menu.
 *
 * The export uses the same buildSessionListPayload pipeline that powers the
 * panel itself so the written records match what the panel showed at the
 * time of the click, modulo client-side filters (tags, name, date range,
 * Latest-only). Those are display-time decisions and re-applying them on the
 * host would duplicate the webview's filter logic — the export instead
 * captures everything visible to the host so the consumer can filter on their
 * own terms.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import { getLogDirectoryUri } from "../../modules/config/config";
import { logExtensionError } from "../../modules/misc/extension-logger";
import type { SessionHistoryProvider } from "../session/session-history-provider";
import { buildSessionListPayload, type SessionListPayloadOptions } from "./viewer-provider-helpers";

/** Build a YYYYMMDDTHHMMSS-prefixed filename so exports sort chronologically. */
export function buildSessionListExportFilename(projectName: string, now: Date): string {
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    /* Restrict to filename-safe characters: the project name flows straight
       into the OS file table and must not introduce path separators or
       reserved chars on Windows. */
    const safe = (projectName || "project").replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${y}${mo}${d}T${h}${mi}${s}_${safe}_session-list.json`;
}

/** Dependencies needed to enumerate sessions and resolve the destination folder. */
export interface ExportSessionListDeps {
    readonly historyProvider: SessionHistoryProvider;
    readonly payloadOptions: SessionListPayloadOptions;
    /** Optional override URI for the panel's current root (folder the user browsed to). */
    readonly overrideRoot?: vscode.Uri;
}

/** Write the current session list to JSON in the reports folder; show a result toast. */
export async function exportSessionListToJson(deps: ExportSessionListDeps): Promise<void> {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    const projectName = wsFolder?.name ?? "project";
    const logDirUri = getLogDirectoryUri(wsFolder);
    /* createDirectory is idempotent in the VS Code FS API but still throws on
       some host implementations when the directory already exists; the
       failure mode is benign so we swallow it and proceed to the write. */
    try { await vscode.workspace.fs.createDirectory(logDirUri); } catch { /* already exists */ }

    const items = deps.overrideRoot
        ? await deps.historyProvider.getAllChildrenFromRoot(deps.overrideRoot)
        : await deps.historyProvider.getAllChildren();
    const records = await buildSessionListPayload(items, deps.historyProvider.getActiveUri(), deps.payloadOptions);

    const now = new Date();
    const filename = buildSessionListExportFilename(projectName, now);
    const fileUri = vscode.Uri.joinPath(logDirUri, filename);
    /* Shape mirrors what the panel receives over postMessage so the file is
       drop-in usable for downstream tools (jq filters, AI prompts, custom
       dashboards) without a translation step. Schema is versioned so future
       additions don't silently break consumers. */
    const payload = {
        schema: "saropa-log-capture.session-list/1",
        generatedAt: now.toISOString(),
        project: projectName,
        totalSessions: records.length,
        sessions: records,
    };
    const content = JSON.stringify(payload, null, 2);

    try {
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, "utf-8"));
        vscode.window.showInformationMessage(t("msg.sessionListExported", String(records.length), filename));
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logExtensionError("exportSessionListToJson", err instanceof Error ? err : new Error(message));
        vscode.window.showErrorMessage(t("msg.sessionListExportFailed", message));
    }
}
